import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {ODTBookExporter} from "../../src/exporter/odt/index.js"
import {
    fakeCSL,
    makeBook,
    makeDocumentList,
    schema,
    user
} from "./support.js"

describe("ODT book exporter", () => {
    it("produces an ODT blob with a content.xml", async () => {
        const book = makeBook()
        // The fixture book points odt_template at the bundled template.
        const documentList = makeDocumentList()

        const exporter = new ODTBookExporter(
            schema,
            fakeCSL,
            book,
            user,
            documentList,
            0
        )
        const result = exporter.init()
        expect(result).not.toBe(false)
        const blob = (await result) as Blob
        expect(blob).toBeInstanceOf(Blob)

        const zip = await JSZip.loadAsync(await blob.arrayBuffer())

        expect(zip.files["mimetype"]).toBeDefined()
        expect(await zip.file("mimetype")?.async("string")).toBe(
            "application/vnd.oasis.opendocument.text"
        )
        expect(zip.files["content.xml"]).toBeDefined()

        const contentXml = await zip.file("content.xml")?.async("string")
        expect(contentXml).toContain("office:text")
    })
})
