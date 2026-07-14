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
