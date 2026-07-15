/**
 * ODT book exporter.
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

import {ODTExporterCitations} from "@fiduswriter/document/exporter/odt/citations"
import {ODTExporterImages} from "@fiduswriter/document/exporter/odt/images"
import {ODTExporterFootnotes} from "@fiduswriter/document/exporter/odt/footnotes"
import {ODTExporterMath} from "@fiduswriter/document/exporter/odt/math"
import {ODTExporterMetadata} from "@fiduswriter/document/exporter/odt/metadata"
import {ODTExporterRichtext} from "@fiduswriter/document/exporter/odt/richtext"
import {ODTExporterStyles} from "@fiduswriter/document/exporter/odt/styles"
import {ODTExporterTracks} from "@fiduswriter/document/exporter/odt/track"

import type {Book, DocumentListEntry} from "../../types.js"
import {getMissingChapterData} from "../tools.js"
import {ODTBookExporterRender} from "./render.js"

export class ODTBookExporter {
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
        this.templateUrl = book.odt_template || ""
        this.updated = updated
        this.textFiles = []
        this.httpFiles = []

        this.mimeType = "application/vnd.oasis.opendocument.text"
    }

    init(progressCallback?: ProgressCallback): Promise<Blob> | false {
        this.progressCallback = progressCallback
        this.progressCallback?.(
            gettext("ODT book export has been initiated."),
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
        this.progressCallback?.(gettext("Preparing ODT book..."), 10)
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        const xml = new XmlZip(this.templateUrl, this.mimeType)
        const styles = new ODTExporterStyles(xml)
        const math = new ODTExporterMath(xml)
        const tracks = new ODTExporterTracks(xml)
        const render = new ODTBookExporterRender(xml, styles)
        const metadata = new ODTExporterMetadata(
            xml,
            styles,
            this.getBaseMetadata(),
            this.csl
        )

        return xml
            .init()
            .then(() => styles.init())
            .then(() => tracks.init())
            .then(() => render.init())
            .then(() => metadata.init())
            .then(() => math.init())
            .then(() => this.exportChapters(xml, render, styles, math, tracks))
            .then(() => {
                this.progressCallback?.(gettext("Finalizing ODT book..."), 90)
                return xml.prepareBlob()
            })
            .then(blob => {
                this.progressCallback?.(
                    gettext("ODT book export complete."),
                    100
                )
                return this.download(blob)
            })
    }

    exportChapters(
        xml: XmlZip,
        render: ODTBookExporterRender,
        styles: ODTExporterStyles,
        math: ODTExporterMath,
        tracks: ODTExporterTracks
    ): Promise<void> {
        return this.book.chapters
            .map((chapter, chapterIndex) => {
                return (): Promise<void> => {
                    const doc = this.docList.find(d => d.id === chapter.text)
                    if (!doc) {
                        return Promise.resolve()
                    }
                    const docContent = fixTables(
                        removeHidden(
                            doc.rawContent as unknown as FidusNode
                        ) as FidusNode
                    )
                    const citations = new ODTExporterCitations(
                        docContent,
                        doc.settings,
                        styles,
                        {db: doc.bibliography || {}},
                        this.csl
                    )
                    const footnotes = new ODTExporterFootnotes(
                        docContent,
                        doc.settings,
                        xml,
                        citations,
                        styles,
                        {db: doc.bibliography || {}},
                        {db: doc.images || {}},
                        this.csl
                    )

                    const images = new ODTExporterImages(docContent, xml, {
                        db: doc.images || {}
                    })
                    const richtext = new ODTExporterRichtext(
                        doc.comments || {},
                        doc.settings,
                        styles,
                        tracks,
                        footnotes,
                        citations,
                        math,
                        images
                    )
                    return citations
                        .init()
                        .then(() => images.init())
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
        return `${createSlug(this.book.title)}.odt`
    }
}
