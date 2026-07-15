/**
 * Shared fixtures/helpers for the book exporter tests.
 *
 * The helpers deliberately return `any` so the loosely-typed fixture data can
 * be handed to the strictly-typed exporter constructors without friction; the
 * production sources are type-checked separately via `npm run typecheck`.
 */

import {readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import type {Schema} from "prosemirror-model"
import type {CSL, FidusNode, User} from "@fiduswriter/document"
import type {Book, DocumentListEntry} from "../../src/types.js"
import {docSchema} from "@fiduswriter/document/schema/document/index"

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(currentDir, "..", "fixtures")

export const schema: Schema = docSchema

export const sampleDocContent: FidusNode = JSON.parse(
    readFileSync(join(fixturesDir, "sample-doc.json"), "utf-8")
)

const sampleBook: Book = JSON.parse(
    readFileSync(join(fixturesDir, "sample-book.json"), "utf-8")
)

export const sampleSettings: Record<string, unknown> = {
    language: "en-US",
    citationstyle: "apa",
    bibliography_header: {},
    copyright: {holder: false, year: false, freeToRead: true, licenses: []}
}

export const fakeCSL: CSL = {}

export const user: User = {id: 1, name: "Test User", username: "test"}

function makeChapterDoc(id: number, title: string): DocumentListEntry {
    const raw = JSON.parse(JSON.stringify(sampleDocContent))
    // Give each chapter a distinct title so combined output can be checked.
    raw.content[0].content = [{type: "text", text: title}]
    // Normalise through the schema so the top `doc` node carries the default
    // attrs (copyright, language, papersize, ...) that stored documents have
    // and that the exporters read.
    const content = docSchema.nodeFromJSON(raw).toJSON()
    return {
        id,
        title,
        path: `/Sample Book/${title}`,
        content,
        rawContent: JSON.parse(JSON.stringify(content)),
        settings: {...sampleSettings},
        comments: {},
        images: {},
        bibliography: {}
    }
}

/** A fresh, deep-cloned copy of the sample book. */
export function makeBook(): Book {
    return JSON.parse(JSON.stringify(sampleBook))
}

/** Two chapter documents (ids 1 and 2) with distinct titles. */
export function makeDocumentList(): DocumentListEntry[] {
    return [makeChapterDoc(1, "Chapter One"), makeChapterDoc(2, "Chapter Two")]
}
