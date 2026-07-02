/**
 * DOCX book exporter.
 */

import type {Schema} from "prosemirror-model"
import type {CSL, User} from "@fiduswriter/document"
import {
    fixTables,
    removeHidden
} from "@fiduswriter/document/exporter/tools/doc_content"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {XmlZip} from "@fiduswriter/document/exporter/tools/xml_zip"
import {addAlert} from "fwtoolkit"

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
    updated: any
    textFiles: Array<Record<string, unknown>>
    httpFiles: Array<Record<string, unknown>>
    mimeType: string

    constructor(
        schema: Schema,
        csl: CSL,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: any
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

    init(): Promise<Blob> | false {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }
        return getMissingChapterData(
            this.book,
            this.docList,
            this.schema,
            {rawContent: true}
        ).then(() => this.export())
    }

    export(): Promise<Blob> {
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        const xml = new XmlZip(this.templateUrl, this.mimeType)

        const tables = new DOCXExporterTables(xml as any)
        const math = new DOCXExporterMath(xml as any)
        const render = new DOCXBookExporterRender(xml as any)
        const rels = new DOCXExporterRels(xml as any, "document")
        const metadata = new DOCXExporterMetadata(
            xml as any,
            this.getBaseMetadata() as any
        )

        return xml
            .init()
            .then(() => metadata.init())
            .then(() => tables.init())
            .then(() => math.init())
            .then(() => render.init())
            .then(() => rels.init())
            .then(() => this.exportChapters(xml as any, render, rels, math, tables))
            .then(() => xml.prepareBlob())
            .then(blob => this.download(blob))
    }

    exportChapters(
        xml: any,
        render: DOCXBookExporterRender,
        rels: any,
        math: any,
        tables: any
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
                            removeHidden(doc.rawContent as any) as any
                        ) as any
                    ) as any

                    const images = new DOCXExporterImages(
                        docContent as any,
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
                        doc as any,
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
                        doc as any,
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
                                docContent as any,
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

    getBaseMetadata(): Record<string, unknown> {
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
