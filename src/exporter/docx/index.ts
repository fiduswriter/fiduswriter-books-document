/**
 * DOCX book exporter.
 */

import type {Schema} from "prosemirror-model"
import type {CSL, ExportMetadata, FidusNode, User} from "@fiduswriter/document"
import type {ProgressCallback} from "@fiduswriter/document/exporter/tools/progress"
import {
    fixTables,
    removeHidden
} from "@fiduswriter/document/exporter/tools/doc_content"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {XmlZip} from "@fiduswriter/document/exporter/tools/xml_zip"
import {gettext} from "fwtoolkit"

import {DOCXExporterCitations} from "@fiduswriter/document/exporter/docx/citations"
import {DOCXExporterComments} from "@fiduswriter/document/exporter/docx/comments"
import {DOCXExporterFootnotes} from "@fiduswriter/document/exporter/docx/footnotes"
import {DOCXExporterImages} from "@fiduswriter/document/exporter/docx/images"
import {DOCXExporterLists} from "@fiduswriter/document/exporter/docx/lists"
import {DOCXExporterMath} from "@fiduswriter/document/exporter/docx/math"
import {DOCXExporterMetadata} from "@fiduswriter/document/exporter/docx/metadata"
import {DOCXExporterRels} from "@fiduswriter/document/exporter/docx/rels"
import {DOCXExporterRichtext} from "@fiduswriter/document/exporter/docx/richtext"
import {DOCXExporterTables} from "@fiduswriter/document/exporter/docx/tables"
import {moveFootnoteComments} from "@fiduswriter/document/exporter/docx/tools"

import type {Book, DocumentListEntry} from "../../types.js"
import {getMissingChapterData} from "../tools.js"
import {DOCXBookExporterRender} from "./render.js"

export class DOCXBookExporter {
    schema: Schema
    csl: CSL
    book: Book
    user: User
    docList: DocumentListEntry[]
    templateUrl: string
    updated: number
    textFiles: Array<Record<string, unknown>>
    httpFiles: Array<Record<string, unknown>>
    mimeType: string
    progressCallback?: ProgressCallback

    constructor(
        schema: Schema,
        csl: CSL,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: number
    ) {
        this.schema = schema
        this.csl = csl
        this.book = book
        this.user = user
        this.docList = docList
        this.templateUrl = book.docx_template || ""
        this.updated = updated
        this.textFiles = []
        this.httpFiles = []

        this.mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }

    init(progressCallback?: ProgressCallback): Promise<Blob> | false {
        this.progressCallback = progressCallback
        this.progressCallback?.(
            gettext("DOCX book export has been initiated."),
            0
        )
        if (this.book.chapters.length === 0) {
            throw new Error(
                gettext("Book cannot be exported due to lack of chapters.")
            )
        }
        return getMissingChapterData(
            this.book,
            this.docList,
            this.schema,
            {rawContent: true, progressCallback: this.progressCallback}
        ).then(() => this.export())
    }

    export(): Promise<Blob> {
        this.progressCallback?.(gettext("Preparing DOCX book..."), 10)
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        const xml = new XmlZip(this.templateUrl, this.mimeType)

        const tables = new DOCXExporterTables(xml)
        const math = new DOCXExporterMath(xml)
        const render = new DOCXBookExporterRender(xml)
        const rels = new DOCXExporterRels(xml, "document")
        const metadata = new DOCXExporterMetadata(
            xml,
            this.getBaseMetadata(),
            this.csl
        )

        return xml
            .init()
            .then(() => metadata.init())
            .then(() => tables.init())
            .then(() => math.init())
            .then(() => render.init())
            .then(() => rels.init())
            .then(() => this.exportChapters(xml, render, rels, math, tables))
            .then(() => {
                this.progressCallback?.(gettext("Finalizing DOCX book..."), 90)
                return xml.prepareBlob()
            })
            .then(blob => {
                this.progressCallback?.(
                    gettext("DOCX book export complete."),
                    100
                )
                return this.download(blob)
            })
    }

    exportChapters(
        xml: XmlZip,
        render: DOCXBookExporterRender,
        rels: DOCXExporterRels,
        math: DOCXExporterMath,
        tables: DOCXExporterTables
    ): Promise<void> {
        return this.book.chapters
            .map((chapter, chapterIndex) => {
                return (): Promise<void> => {
                    const doc = this.docList.find(d => d.id === chapter.text)
                    if (!doc) {
                        return Promise.resolve()
                    }
                    const docContent = moveFootnoteComments(
                        fixTables(
                            removeHidden(
                                doc.rawContent as unknown as FidusNode
                            ) as FidusNode
                        )
                    )

                    const images = new DOCXExporterImages(
                        docContent,
                        {db: doc.images || {}},
                        xml,
                        rels
                    )
                    const lists = new DOCXExporterLists(docContent, xml, rels)
                    const citations = new DOCXExporterCitations(
                        docContent,
                        doc.settings,
                        {db: doc.bibliography || {}},
                        this.csl,
                        xml
                    )

                    const footnotes = new DOCXExporterFootnotes(
                        doc,
                        docContent,
                        doc.settings,
                        {db: doc.images || {}},
                        {db: doc.bibliography || {}},
                        xml,
                        citations,
                        this.csl,
                        lists,
                        math,
                        tables,
                        rels
                    )

                    const richtext = new DOCXExporterRichtext(
                        doc,
                        doc.settings,
                        lists,
                        footnotes,
                        math,
                        tables,
                        rels,
                        citations,
                        images
                    )

                    const comments = new DOCXExporterComments(
                        docContent,
                        doc.comments || {},
                        xml,
                        rels,
                        richtext
                    )

                    return citations
                        .init()
                        .then(() => images.init())
                        .then(() => comments.init())
                        .then(() => lists.init())
                        .then(() => footnotes.init())
                        .then(() => {
                            const pmBib = footnotes.pmBib || citations.pmBib
                            render.render(
                                docContent,
                                pmBib,
                                doc.settings,
                                richtext,
                                citations,
                                chapterIndex
                            )
                            return Promise.resolve()
                        })
                }
            })
            .reduce(
                (promiseChain, currentChapter) =>
                    promiseChain.then(() => currentChapter()),
                Promise.resolve()
            )
            .then(() =>
                render.renderAmbles(
                    Object.assign(
                        {
                            title: this.book.title,
                            language: this.book.settings.language
                        },
                        this.book.metadata
                    )
                )
            )
            .then(() => render.assemble())
    }

    getBaseMetadata(): ExportMetadata {
        const authors = this.book.metadata.author?.length
            ? [{institution: this.book.metadata.author}]
            : []
        const keywords = this.book.metadata.keywords?.length
            ? this.book.metadata.keywords
                  .split(",")
                  .map(keyword => keyword.trim())
            : []
        return {
            authors,
            contributors: [],
            keywords,
            title: this.book.title,
            language: this.book.settings.language
        }
    }

    download(blob: Blob): Blob {
        return blob
    }

    get defaultFilename(): string {
        return `${createSlug(this.book.title)}.docx`
    }
}
