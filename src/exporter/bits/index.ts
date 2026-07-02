/**
 * BITS (Book Interchange Tag Suite) book exporter.
 */

import type {Schema} from "prosemirror-model"
import pretty from "pretty"
import {JATSExporterConverter} from "@fiduswriter/document/exporter/jats/convert"
import {darManifest} from "@fiduswriter/document/exporter/jats/templates"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {ZipFileCreator} from "@fiduswriter/document/exporter/tools/zip"
import {addAlert} from "fwtoolkit"

import type {Book, CSL, DocumentListEntry, User} from "../../types.js"
import {getMissingChapterData} from "../tools.js"
import {bitsTemplate} from "./templates.js"

interface TextFile {
    filename: string
    contents: string
}

interface HttpFile {
    filename: string
    url: string
    title?: string
}

export class BITSBookExporter {
    schema: Schema
    csl: CSL
    book: Book
    user: User
    docList: DocumentListEntry[]
    updated: any
    type: string
    textFiles: TextFile[]
    httpFiles: HttpFile[]
    zipFileName: string

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
        this.updated = updated
        this.type = "book"
        this.textFiles = []
        this.httpFiles = []
        this.zipFileName = ""
    }

    init(): Promise<Blob> | false {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return false
        }
        return getMissingChapterData(this.book, this.docList, this.schema).then(
            () => this.export()
        )
    }

    export(): Promise<Blob> {
        this.book.chapters.sort((a, b) => (a.number > b.number ? 1 : -1))

        const imageDict: Record<string, {image: string; title?: string}> = {}
        return Promise.all(
            this.book.chapters.map(chapter => {
                const doc = this.docList.find(d => d.id === chapter.text)
                if (!doc) {
                    return Promise.resolve({front: "", body: "", back: ""})
                }
                const converter = new JATSExporterConverter(
                    this.type,
                    doc,
                    this.csl,
                    {db: doc.images || {}},
                    {db: doc.bibliography || {}}
                )
                return converter.init().then(({front, body, back, imageIds}) => {
                    imageIds.forEach(
                        (imageId: string | number) =>
                            (imageDict[imageId] = doc.images?.[imageId] as {
                                image: string
                                title?: string
                            })
                    )
                    return {front, body, back}
                })
            })
        ).then(chapters => this.createFiles(chapters, imageDict))
    }

    createFiles(
        chapters: Array<{front: string; body: string; back: string}>,
        imageDict: Record<string, {image: string; title?: string}>
    ): Promise<Blob> {
        const images = Object.values(imageDict).map(image => ({
            filename: image.image.split("/").pop()?.split("?")[0] || "",
            url: image.image.split("?")[0],
            title: image.title || ""
        }))

        this.zipFileName = `${createSlug(this.book.title)}.bits.zip`

        this.textFiles = [
            {
                filename: "manuscript.xml",
                contents: pretty(bitsTemplate(this.book, chapters), {ocd: true})
            },
            {
                filename: "manifest.xml",
                contents: pretty(
                    darManifest({
                        title: this.book.title,
                        type: this.type,
                        images
                    }),
                    {ocd: true}
                )
            }
        ]

        images.forEach(image => {
            this.httpFiles.push({
                filename: image.filename,
                url: image.url,
                title: image.title
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
