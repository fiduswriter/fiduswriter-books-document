// Minimal mock for bibliojson.
//
// The document/book exporters import several named exports from this package
// at module load time. Because the test documents contain no citations, none
// of these are actually exercised, but the named bindings must exist so the
// ESM link step does not fail.

export class BibLatexExporter {
    constructor(_db, _ids) {
        this.output = ""
    }
}

export class CSLExporter {
    constructor(_db, _ids) {
        this.output = {}
    }
}

export class DocxCitationsParser {
    constructor() {}
    parse() {
        return {}
    }
}

export class OdtCitationsParser {
    constructor() {}
    parse() {
        return {}
    }
}

export function parseCSL(_input) {
    return {}
}

export const cslBibSpec = {
    nodes: {
        doc: {content: "cslbib"},
        cslbib: {
            content: "cslentry*",
            parseDOM: [{tag: "div.csl-bib-body"}]
        },
        cslentry: {
            content: "block*",
            parseDOM: [{tag: "div.csl-entry"}]
        },
        cslinline: {
            group: "block",
            content: "text*",
            marks: "_",
            parseDOM: [{tag: "div.csl-inline"}]
        },
        cslblock: {
            group: "block",
            content: "text*",
            marks: "_",
            parseDOM: [{tag: "div.csl-block"}]
        },
        cslleftmargin: {
            group: "block",
            content: "text*",
            marks: "_",
            parseDOM: [{tag: "div.csl-left-margin"}]
        },
        cslrightinline: {
            group: "block",
            content: "text*",
            marks: "_",
            parseDOM: [{tag: "div.csl-right-inline"}]
        },
        cslindent: {
            group: "block",
            content: "text*",
            marks: "_",
            parseDOM: [{tag: "div.csl-indent"}]
        },
        text: {
            group: "inline"
        }
    },
    marks: {
        em: {
            parseDOM: [
                {tag: "i"},
                {tag: "em"},
                {style: "font-style=italic"},
                {style: "font-style=normal"}
            ]
        },
        strong: {
            parseDOM: [
                {tag: "strong"},
                {tag: "b"},
                {style: "font-weight=400"},
                {style: "font-weight"}
            ]
        },
        smallcaps: {
            parseDOM: [{tag: "span.smallcaps"}, {style: "font-variant"}]
        },
        sup: {
            parseDOM: [{tag: "sup"}, {style: "vertical-align"}]
        },
        sub: {
            parseDOM: [{tag: "sub"}, {style: "vertical-align"}]
        }
    }
}
