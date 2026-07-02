import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {EpubBookExporter} from "../../src/exporter/epub/index.js"
import {
    fakeCSL,
    makeBook,
    makeDocumentList,
    schema,
    user
} from "./support.js"

describe("EPUB book exporter", () => {
    it("produces an EPUB blob containing mimetype and container.xml", async () => {
        const book = makeBook()
        const documentList = makeDocumentList()

        const exporter = new EpubBookExporter(
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

        expect(zip.files["mimetype"]).toBeDefined()
        expect(await zip.file("mimetype")?.async("string")).toBe(
            "application/epub+zip"
        )
        expect(zip.files["META-INF/container.xml"]).toBeDefined()

        // The OPF/nav/ncx are emitted under the EPUB/ directory.
        expect(zip.files["EPUB/document.opf"]).toBeDefined()
        expect(zip.files["EPUB/document.ncx"]).toBeDefined()

        const container = await zip
            .file("META-INF/container.xml")
            ?.async("string")
        expect(container).toContain("document.opf")
    })
})
