import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {HTMLBookExporter} from "../../src/exporter/html/index.js"
import {
    fakeCSL,
    makeBook,
    makeDocumentList,
    schema,
    user
} from "./support.js"

async function combinedHTML(blob: Blob): Promise<string> {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const htmlNames = Object.keys(zip.files).filter(name =>
        name.endsWith(".html")
    )
    const parts = await Promise.all(
        htmlNames.map(name => zip.file(name)!.async("string"))
    )
    return parts.join("\n")
}

describe("HTML book exporter", () => {
    it("exports a two-chapter book with both titles and per-chapter id prefixes", async () => {
        const book = makeBook()
        const documentList = makeDocumentList()

        const exporter = new HTMLBookExporter(
            schema,
            fakeCSL,
            [],
            book,
            user,
            documentList,
            0
        )
        const blob = (await exporter.init()) as Blob
        expect(blob).toBeInstanceOf(Blob)

        const zip = await JSZip.loadAsync(await blob.arrayBuffer())
        expect(zip.files["index.html"]).toBeDefined()
        expect(zip.files["document-1.html"]).toBeDefined()
        expect(zip.files["document-2.html"]).toBeDefined()

        const html = await combinedHTML(blob)
        expect(html).toContain("Chapter One")
        expect(html).toContain("Chapter Two")
        // The HTML exporter prefixes every chapter's ids with `c-<number>-`.
        expect(html).toContain("c-1-")
        expect(html).toContain("c-2-")
    })
})
