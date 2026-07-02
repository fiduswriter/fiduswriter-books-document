import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {BITSBookExporter} from "../../src/exporter/bits/index.js"
import {
    fakeCSL,
    makeBook,
    makeDocumentList,
    schema,
    user
} from "./support.js"

describe("BITS book exporter", () => {
    it("produces a zip with manuscript.xml and manifest.xml", async () => {
        const book = makeBook()
        const documentList = makeDocumentList()

        const exporter = new BITSBookExporter(
            schema,
            fakeCSL,
            book,
            user,
            documentList,
            new Date()
        )
        const result = exporter.init()
        expect(result).not.toBe(false)
        const blob = (await result) as Blob
        expect(blob).toBeInstanceOf(Blob)

        const zip = await JSZip.loadAsync(await blob.arrayBuffer())

        expect(zip.files["manuscript.xml"]).toBeDefined()
        expect(zip.files["manifest.xml"]).toBeDefined()

        const manuscript = (await zip
            .file("manuscript.xml")
            ?.async("string")) as string
        expect(manuscript).toContain("Chapter One")
        expect(manuscript).toContain("Chapter Two")
    })
})
