// Mock for `fwtoolkit`.
//
// Mirrors the browser helpers the exporters rely on. `get` is "smart": when a
// DOCX/ODT export template is requested it returns the matching binary fixture
// so the XmlZip loader can unpack a real template; every other request returns
// an empty text/blob response.

import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures")

const readFixture = name => {
    const path = join(fixturesDir, name)
    return existsSync(path) ? readFileSync(path) : Buffer.from([])
}

export const addAlert = (_type, _message) => {}

export const get = url => {
    let buffer = Buffer.from([])
    if (typeof url === "string") {
        if (url.endsWith(".docx")) {
            buffer = readFixture("template.docx")
        } else if (url.endsWith(".odt")) {
            buffer = readFixture("template.odt")
        }
    }
    return Promise.resolve({
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({}),
        // ZipFileCreator/XmlZip pass the returned value straight to
        // JSZip.loadAsync, which accepts a Node Buffer.
        blob: () => Promise.resolve(buffer)
    })
}

export const post = (_url, _params) => Promise.resolve({ok: true})

export const postJson = (_url, _data) => Promise.resolve({json: {}})

export const getJson = _url => Promise.resolve({})

export const convertDataURIToBlob = _dataURI => new Blob([])

export const escapeText = text =>
    String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")

export const shortFileTitle = (title, path) => title || path || "untitled"

export const longFilePath = (path, filename) => `${path}${filename}`

export const localizeDate = date => new Date(date).toISOString()

export const staticUrl = path => `/static/${path}`

export const gettext = text => text

export const interpolate = (fmt, ...args) => {
    const values = Array.isArray(args[0]) ? args[0] : args
    return fmt.replace(/%s/g, () => values.shift())
}

export const noSpaceTmp = (strings, ...values) => {
    const tmpStrings = Array.from(strings)
    let combined = ""
    while (tmpStrings.length > 0 || values.length > 0) {
        if (tmpStrings.length > 0) {
            combined += tmpStrings.shift()
        }
        if (values.length > 0) {
            const value = values.shift()
            combined += value !== undefined && value !== null ? String(value) : ""
        }
    }
    return combined
        .split("\n")
        .map(line => line.replace(/^\s*/g, ""))
        .join("")
}
