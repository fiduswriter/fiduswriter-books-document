/**
 * Native `.fidusbook` exporter.
 */

import type {Schema} from "prosemirror-model"
import {ShrinkFidus} from "@fiduswriter/document/exporter/native/shrink"
import {createSlug} from "@fiduswriter/document/exporter/tools/file"
import {ZipFileCreator} from "@fiduswriter/document/exporter/tools/zip"
import {addAlert} from "fwtoolkit"

import {FIDUSBOOK_VERSION} from "../../schema/index.js"
import type {Book, DocumentListEntry, User} from "../../types.js"
import {getMissingChapterData} from "../tools.js"

interface FileInclude {
    url: string
    filename: string
}

interface TextFile {
    filename: string
    contents: string
}

export {FIDUSBOOK_VERSION}

export class NativeBookExporter {
    schema: Schema
    book: Book
    user: User
    documentList: DocumentListEntry[]
    updated: any

    constructor(
        schema: Schema,
        book: Book,
        user: User,
        documentList: DocumentListEntry[],
        updated: any
    ) {
        this.schema = schema
        this.book = book
        this.user = user
        this.documentList = documentList
        this.updated = updated
    }

    init(): Promise<Blob> {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return Promise.resolve(new Blob([]))
        }

        addAlert(
            "info",
            `${this.book.title}: ${gettext("Fidusbook export has been initiated.")}`
        )

        return getMissingChapterData(this.book, this.documentList, this.schema)
            .then(() => this.exportContents())
            .catch(error => {
                addAlert(
                    "error",
                    `${this.book.title}: ${gettext("Fidusbook export failed.")}`
                )
                throw error
            })
    }

    exportContents(): Promise<Blob> {
        const textFiles: TextFile[] = []
        const httpFiles: FileInclude[] = []

        const sortedChapters = [...this.book.chapters].sort(
            (a, b) => a.number - b.number
        )

        const bookData: Record<string, unknown> = {
            title: this.book.title,
            path: this.book.path || "/",
            metadata: this.book.metadata || {},
            settings: this.book.settings || {},
            chapters: sortedChapters.map((chapter, index) => ({
                number: chapter.number,
                part: chapter.part || "",
                chapter_index: index
            }))
        }

        if (this.book.cover_image_data) {
            const coverImage = this.book.cover_image_data
            const imageUrl = (coverImage.image || "").split("?")[0]
            const filename = imageUrl.split("/").pop() || "cover"
            bookData.cover_image = {
                title: coverImage.title || "",
                checksum: coverImage.checksum || "",
                file_type: coverImage.file_type,
                image: `cover/${filename}`
            }
            httpFiles.push({url: imageUrl, filename: `cover/${filename}`})
        }

        const processChapter = (index: number): Promise<void> => {
            if (index >= sortedChapters.length) {
                return Promise.resolve()
            }
            const chapter = sortedChapters[index]
            const doc = this.documentList.find(d => d.id === chapter.text)
            if (!doc) {
                return processChapter(index + 1)
            }

            const shrinker = new ShrinkFidus(
                doc as any,
                {db: doc.images || {}},
                {db: doc.bibliography || {}},
                true
            )

            return shrinker
                .init()
                .then(
                    ({
                        doc: shrunkDoc,
                        shrunkImageDB,
                        shrunkBibDB,
                        httpIncludes
                    }: {
                        doc: Record<string, unknown>
                        shrunkImageDB: Record<string, unknown>
                        shrunkBibDB: Record<string, unknown>
                        httpIncludes: FileInclude[]
                    }) => {
                        httpIncludes.forEach(include => {
                            include.filename = `chapters/${index}/${include.filename}`
                        })

                        textFiles.push(
                            {
                                filename: `chapters/${index}/document.json`,
                                contents: JSON.stringify(shrunkDoc)
                            },
                            {
                                filename: `chapters/${index}/images.json`,
                                contents: JSON.stringify(shrunkImageDB)
                            },
                            {
                                filename: `chapters/${index}/bibliography.json`,
                                contents: JSON.stringify(shrunkBibDB)
                            }
                        )
                        httpFiles.push(...httpIncludes)
                    }
                )
                .then(() => processChapter(index + 1))
        }

        return processChapter(0).then(() => {
            textFiles.push(
                {filename: "book.json", contents: JSON.stringify(bookData)},
                {filename: "filetype-version", contents: FIDUSBOOK_VERSION}
            )

            const zipper = new ZipFileCreator(
                textFiles,
                httpFiles,
                [],
                "application/fidusbook+zip",
                this.updated
            )
            return zipper.init().then(blob => this.download(blob))
        })
    }

    download(blob: Blob): Blob {
        // Base implementation returns the Blob.  Browser/CLI subclasses can
        // override this method to trigger a real download.
        return blob
    }

    get defaultFilename(): string {
        return `${createSlug(this.book.title)}.fidusbook`
    }
}
