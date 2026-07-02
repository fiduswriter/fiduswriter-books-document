import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {LatexBookExporter} from "../../src/exporter/latex/index.js"
import {makeBook, makeDocumentList, schema, user} from "./support.js"

describe("LaTeX book exporter", () => {
    it("produces a zip with a book.tex and one .tex per chapter", async () => {
        const book = makeBook()
        const documentList = makeDocumentList()

        const exporter = new LatexBookExporter(
            schema,
            book,
            user,
            documentList,
            new Date()
        )
        const blob = await exporter.init()
        expect(blob).toBeInstanceOf(Blob)

        const zip = await JSZip.loadAsync(await blob.arrayBuffer())

        expect(zip.files["book.tex"]).toBeDefined()
        expect(zip.files["chapter-1.tex"]).toBeDefined()
        expect(zip.files["chapter-2.tex"]).toBeDefined()

        const bookTex = await zip.file("book.tex")?.async("string")
        expect(bookTex).toContain("\\documentclass")

        const chapter1 = (await zip
            .file("chapter-1.tex")
            ?.async("string")) as string
        expect(chapter1).toContain("Introduction")
    })
})
