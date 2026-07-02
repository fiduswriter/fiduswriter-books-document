import {readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {describe, expect, it} from "@jest/globals"

import {
    FidusBookReader,
    readFidusBookFile
} from "../../src/importer/native/reader.js"

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(currentDir, "..", "fixtures", "minimal.fidusbook")

describe("FidusBookReader", () => {
    it("reads a minimal .fidusbook into {book, documentList}", async () => {
        const buffer = readFileSync(fixturePath)

        const reader = new FidusBookReader()
        const result = await reader.read(buffer)

        expect(result).toHaveProperty("book")
        expect(result).toHaveProperty("documentList")

        const {book, documentList} = result
        expect(book.title).toBe("Minimal Book")
        expect(Array.isArray(book.chapters)).toBe(true)
        expect((book.chapters as unknown[]).length).toBe(2)

        expect(documentList).toHaveLength(2)
        // Chapters are returned ordered by chapter_index.
        expect(documentList.map(doc => doc.title)).toEqual([
            "Chapter One",
            "Chapter Two"
        ])

        const first = documentList[0]
        expect(first.id).toBe(1)
        const content = first.content as {
            type: string
            content: Array<{type: string; content?: Array<{text?: string}>}>
        }
        expect(content.type).toBe("doc")
        expect(content.content[0].type).toBe("title")
        expect(content.content[0].content?.[0]?.text).toBe("Chapter One")

        // The document list entries carry image/bibliography databases.
        expect(first.images).toBeDefined()
        expect(first.bibliography).toBeDefined()
    })

    it("exposes readFidusBookFile as a standalone function", async () => {
        const buffer = readFileSync(fixturePath)
        const {book, documentList} = await readFidusBookFile(buffer)
        expect(book.title).toBe("Minimal Book")
        expect(documentList).toHaveLength(2)
    })

    it("rejects a file that is not a Fidusbook", async () => {
        const notABook = new Uint8Array([1, 2, 3, 4]).buffer
        await expect(readFidusBookFile(notABook)).rejects.toThrow()
    })
})
