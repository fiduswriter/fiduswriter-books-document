import {describe, expect, it, jest} from "@jest/globals"

import {getMissingChapterData} from "../../src/exporter/tools.js"
import {schema} from "./support.js"

function bookWithChapters(chapters: any[]): any {
    return {
        title: "Injection Book",
        metadata: {},
        settings: {language: "en-US"},
        chapters
    }
}

describe("getMissingChapterData dependency injection", () => {
    it("calls the injected ChapterLoader with the chapter ids", async () => {
        const book = bookWithChapters([
            {text: 1, number: 1},
            {text: 2, number: 2}
        ])
        const documentList: any[] = [
            {id: 1, title: "One", content: {type: "doc", content: []}},
            {id: 2, title: "Two", content: {type: "doc", content: []}}
        ]

        const loadChapters = jest.fn(async () => {})
        const loader = {loadChapters}

        await getMissingChapterData(book, documentList, schema, {loader})

        expect(loadChapters).toHaveBeenCalledTimes(1)
        const call = loadChapters.mock.calls[0] as unknown[]
        expect(call[0]).toEqual([1, 2])
        expect(call[1]).toBe(documentList)
        expect(call[2]).toBe(schema)
        expect(call[3]).toBe(false)
    })

    it("throws when a chapter document is missing from the document list", async () => {
        const book = bookWithChapters([{text: 99, number: 1}])
        await expect(
            getMissingChapterData(book, [], schema)
        ).rejects.toThrow(/access rights/)
    })

    it("uses the injected E2EEStrategy to decrypt encrypted chapters", async () => {
        const encryptedPayload = "ENCRYPTED-SNAPSHOT"
        const decryptedDoc = {
            type: "doc",
            content: [
                {
                    type: "title",
                    content: [{type: "text", text: "Decrypted Title"}]
                },
                {
                    type: "richtext_part",
                    attrs: {id: "body", title: "Body"},
                    content: [
                        {
                            type: "paragraph",
                            content: [{type: "text", text: "secret body"}]
                        }
                    ]
                }
            ]
        }

        const book = bookWithChapters([{text: 1, number: 1}])
        const doc: any = {
            id: 1,
            title: "Encrypted Chapter",
            content: encryptedPayload,
            e2ee: true,
            e2ee_salt: btoa("saltsaltsaltsalt"),
            e2ee_iterations: 1000,
            images: {}
        }
        const documentList: any[] = [doc]

        const fakeKey = {name: "fake-key"} as unknown as CryptoKey
        const ensurePassphraseUnlocked = jest.fn(async () => true)
        const getDocumentPassword = jest.fn(async () => "correct horse")
        const resolvePasswordToKey = jest.fn(async () => fakeKey)
        const decryptObject = jest.fn(async () => decryptedDoc)
        const decryptImageToUrl = jest.fn(async () => "blob:decrypted")

        const e2ee = {
            ensurePassphraseUnlocked,
            getDocumentPassword,
            resolvePasswordToKey,
            decryptObject,
            decryptImageToUrl
        }

        await getMissingChapterData(book, documentList, schema, {e2ee})

        expect(ensurePassphraseUnlocked).toHaveBeenCalledTimes(1)
        expect(getDocumentPassword).toHaveBeenCalledWith(1)
        expect(resolvePasswordToKey).toHaveBeenCalledTimes(1)
        const keyCall = resolvePasswordToKey.mock.calls[0] as unknown[]
        expect(keyCall[0]).toBe("correct horse")
        expect(keyCall[1]).toBeInstanceOf(Uint8Array)
        expect(keyCall[2]).toBe(1000)
        expect(decryptObject).toHaveBeenCalledTimes(1)
        const decryptCall = decryptObject.mock.calls[0] as unknown[]
        expect(decryptCall[0]).toBe(encryptedPayload)
        expect(decryptCall[1]).toBe(fakeKey)

        // The encrypted string content has been replaced by the decrypted doc
        // and the plaintext title extracted.
        expect(typeof doc.content).toBe("object")
        expect(doc.content.type).toBe("doc")
        expect(doc.title).toBe("Decrypted Title")
    })
})
