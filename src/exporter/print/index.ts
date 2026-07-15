/**
 * Print book exporter.
 *
 * Uses @vivliostyle/print to render the book in the browser.
 */

import type {Schema} from "prosemirror-model"
import type {CSL, User} from "@fiduswriter/document"
import {printHTML} from "@vivliostyle/print"

import type {Book, BookStyles, DocumentListEntry} from "../../types.js"
import {HTMLBookExporter} from "../html/index.js"
import {chapterTemplate} from "./templates.js"

export class PrintBookExporter extends HTMLBookExporter {
    constructor(
        schema: Schema,
        csl: CSL,
        documentStyles: BookStyles,
        book: Book,
        user: User,
        docList: DocumentListEntry[]
    ) {
        super(schema, csl, documentStyles, book, user, docList, 0, false, {
            relativeUrls: false
        })
        this.chapterTemplate = chapterTemplate
    }

    addBookStyle(): boolean {
        const bookStyle = this.bookStyles.find(
            style => style.slug === this.book.settings.book_style
        )
        if (!bookStyle) {
            return false
        }
        let contents = bookStyle.contents
        bookStyle.bookstylefile_set.forEach(
            ([url, filename]: [string, string]) =>
                (contents = contents.replace(
                    new RegExp(filename, "g"),
                    url
                ))
        )

        this.styleSheets.push({contents})
        return true
    }

    async createZip(): Promise<void> {
        const htmlDoc = this.textFiles.find(
            file => file.filename === "index.html"
        )?.contents
        if (!htmlDoc) {
            return
        }
        const config: {title: string; printCallback?: (iframeWin: Window) => void} = {
            title: this.book.title
        }

        if (navigator.userAgent.includes("Gecko/")) {
            config.printCallback = (iframeWin: Window) => {
                const oldBody = document.body
                document.body.parentElement!.dataset.vivliostylePaginated =
                    "true"
                document.body = iframeWin.document.body
                iframeWin.document
                    .querySelectorAll("style")
                    .forEach(el => document.body.appendChild(el))
                const backgroundStyle = document.createElement("style")
                backgroundStyle.innerHTML = "body {background-color: white;}"
                document.body.appendChild(backgroundStyle)
                window.print()
                document.body = oldBody
                delete document.body.parentElement!.dataset
                    .vivliostylePaginated
            }
        }

        printHTML(htmlDoc, config)
    }

    async loadStyle(sheet: {
        url?: string
        filename?: string
        contents?: string
    }): Promise<{url?: string; filename?: string; contents?: string}> {
        if (sheet.url) {
            sheet.filename = sheet.url
            delete sheet.url
        }
        return sheet
    }
}
