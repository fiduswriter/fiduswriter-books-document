/**
 * LaTeX book exporter.
 */

import type {Schema} from "prosemirror-model"
import type {User} from "@fiduswriter/document"
import {BibLatexExporter} from "biblatex-csl-converter"
import {LatexExporterConvert} from "@fiduswriter/document/exporter/latex/convert"
import {removeHidden} from "@fiduswriter/document/exporter/tools/doc_content"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {ZipFileCreator} from "@fiduswriter/document/exporter/tools/zip"

import type {Book, DocumentListEntry} from "../../types.js"
import {getMissingChapterData} from "../tools.js"
import {bookTexTemplate} from "./templates.js"

interface TextFile {
    filename: string
    contents: string
}

interface HttpFile {
    url: string
    filename: string
}

export class LatexBookExporter {
    schema: Schema
    book: Book
    user: User
    docList: DocumentListEntry[]
    updated: any
    textFiles: TextFile[]
    httpFiles: HttpFile[]
    zipFileName: string

    constructor(
        schema: Schema,
        book: Book,
        user: User,
        docList: DocumentListEntry[],
        updated: any
    ) {
        this.schema = schema
        this.book = book
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))
        this.user = user
        this.docList = docList
        this.updated = updated

        this.textFiles = []
        this.httpFiles = []
        this.zipFileName = ""
    }

    init(): Promise<Blob> {
        return getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.export()
        )
    }

    export(): Promise<Blob> {
        this.zipFileName = `${createSlug(this.book.title)}.latex.zip`
        let bibIds: string[] = []
        let imageIds: string[] = []
        const features: Record<string, boolean> = {}
        const combinedBibliography: Record<string, unknown> = {}
        const combinedImages: Record<string, {image: string}> = {}
        this.book.chapters.forEach((chapter, index) => {
            const doc = this.docList.find(d => d.id === chapter.text)
            if (!doc) {
                return
            }
            const converter = new LatexExporterConvert(
                this as any,
                {db: doc.images || {}},
                {db: doc.bibliography || {}},
                doc.settings
            )
            const chapterContent = removeHidden(doc.content as any)
            const convertedDoc = converter.init(chapterContent)
            this.textFiles.push({
                filename: `chapter-${index + 1}.tex`,
                contents: convertedDoc.latex
            })
            bibIds = [
                ...new Set(bibIds.concat(Object.keys(convertedDoc.usedBibDB)))
            ]
            imageIds = [...new Set(imageIds.concat(convertedDoc.imageIds))]
            Object.assign(features, converter.features as Record<string, boolean>)
            Object.keys(convertedDoc.usedBibDB).forEach(
                bibId =>
                    (combinedBibliography[bibId] = doc.bibliography?.[bibId])
            )
            convertedDoc.imageIds.forEach(
                (imageId: string) =>
                    (combinedImages[imageId] = doc.images?.[imageId] as {
                        image: string
                    })
            )
        })
        if (bibIds.length > 0) {
            const bibExport = new BibLatexExporter(
                combinedBibliography as any,
                bibIds
            )
            this.textFiles.push({
                filename: "bibliography.bib",
                contents: (bibExport as any).output
            })
        }
        imageIds.forEach(id => {
            const image = combinedImages[id]
            if (image?.image) {
                this.httpFiles.push({
                    filename: image.image.split("/").pop() || id,
                    url: image.image
                })
            }
        })
        const bookConverter = new LatexExporterConvert(
            this as any,
            {db: combinedImages as any},
            {db: combinedBibliography as any},
            {language: this.book.settings.language, bibliography_header: {}}
        )
        bookConverter.features = features
        const preamble = bookConverter.assemblePreamble()
        const epilogue = bookConverter.assembleEpilogue()
        this.textFiles.push({
            filename: "book.tex",
            contents: bookTexTemplate({
                book: this.book,
                preamble,
                epilogue
            })
        })

        return this.createZip()
    }

    createZip(): Promise<Blob> {
        const zipper = new ZipFileCreator(
            this.textFiles,
            this.httpFiles,
            undefined,
            undefined,
            this.updated
        )

        return zipper.init().then(blob => this.download(blob))
    }

    download(blob: Blob): Blob {
        return blob
    }

    get defaultFilename(): string {
        return this.zipFileName
    }
}
