import {describe, expect, it} from "@jest/globals"
import JSZip from "jszip"

import {DOCXBookExporter} from "../../src/exporter/docx/index.js"
import {
    fakeCSL,
    makeBook,
    makeDocumentList,
    schema,
    user
} from "./support.js"

describe("DOCX book exporter", () => {
    it("produces a DOCX blob with a word/document.xml", async () => {
        const book = makeBook()
        // The fixture book points docx_template at the bundled template.
        const documentList = makeDocumentList()

        const exporter = new DOCXBookExporter(
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

        expect(zip.files["[Content_Types].xml"]).toBeDefined()
        expect(zip.files["word/document.xml"]).toBeDefined()

        const documentXml = await zip.file("word/document.xml")?.async("string")
        expect(documentXml).toContain("<w:document")
        expect(documentXml).toContain("</w:document>")
    })
})
