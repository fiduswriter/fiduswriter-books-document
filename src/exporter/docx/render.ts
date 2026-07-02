import {DOCXExporterRender} from "@fiduswriter/document/exporter/docx/render"

export class DOCXBookExporterRender extends DOCXExporterRender {
    preamble: any
    bodyTemplate: any
    postamble: any
    fileXML: any
    bodyParts: any[]

    constructor(xml: any) {
        super(xml)

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null
        this.fileXML = null
        this.bodyParts = []
    }

    init(): Promise<void> {
        return super.init().then(() => {
            this.fileXML = this.text
            const text = this.fileXML.query("w:body")
            this.preamble = text.cloneNode(false)
            this.bodyTemplate = text.cloneNode(false)
            this.postamble = text.cloneNode(false)
            let currentSection = this.bodyTemplate
            const textChildren = Array.from(text.children)
            textChildren.forEach((node: any) => {
                const bookmarkStart = node.query("w:bookmarkStart")
                if (bookmarkStart) {
                    const bookmarkName = String(
                        bookmarkStart.getAttribute("w:name")
                    ).toLowerCase()
                    if (bookmarkName === "preamble") {
                        currentSection = this.preamble
                    } else if (bookmarkName === "body") {
                        currentSection = this.bodyTemplate
                    } else if (bookmarkName === "postamble") {
                        currentSection = this.postamble
                    }
                }
                currentSection.appendChild(node)
            })
            return Promise.resolve()
        })
    }

    render(...args: any[]): void {
        const [docContent, pmBib, settings, richtext, citations, chapterIndex] = args
        this.text = this.bodyTemplate.cloneNode(true)
        const bodyBookmark = (this.text as any).query("w:bookmarkStart", {
            "w:name": "body"
        })
        if (bodyBookmark) {
            bodyBookmark.setAttribute("w:name", `chapter ${chapterIndex + 1}`)
        }
        super.render(docContent, pmBib, settings, richtext, citations)
        this.bodyParts.push(this.text)
    }

    renderAmbles({
        title,
        subtitle,
        version,
        publisher,
        copyright,
        author,
        keywords,
        language,
        description,
        isbn,
        publication_date,
        series_title,
        series_position
    }: Record<string, unknown>): void {
        const tags = [
            {title: "book.title", content: title},
            {title: "book.subtitle", content: subtitle},
            {title: "book.version", content: version},
            {title: "book.publisher", content: publisher},
            {title: "book.copyright", content: copyright},
            {title: "book.author", content: author},
            {title: "book.keywords", content: keywords},
            {title: "book.language", content: language},
            {title: "book.description", content: description},
            {title: "book.isbn", content: isbn},
            {title: "book.publication_date", content: publication_date},
            {title: "book.series_title", content: series_title},
            {title: "book.series_position", content: series_position}
        ]
        const usedTags: any[] = []
        const ambles = [this.preamble, this.postamble]
        ambles.forEach(amble => {
            const blocks = amble.queryAll(["w:p", "w:sectPr"])
            blocks.forEach((block: any) => {
                const text = block.textContent
                tags.forEach(tag => {
                    const tagString = tag.title
                    if (text.includes(`{${tagString}}`)) {
                        usedTags.push(Object.assign({block}, tag))
                    }
                })
            })
        })
        usedTags.forEach(tag => this.inlineRender(tag))
    }

    assemble(): void {
        const text = this.fileXML.query("w:body")
        Array.from(this.preamble.children).forEach((node: any) =>
            text.appendChild(node)
        )
        this.bodyParts.forEach((bodyPart: any, index: number) => {
            const children = bodyPart.children.slice()
            children.forEach((node: any) => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML(
                    `<w:p>
                  <w:pPr>
                    <w:pStyle w:val="Normal"/>
                    <w:bidi w:val="0"/>
                    <w:jc w:val="start"/>
                    <w:rPr/>
                  </w:pPr>
                  <w:r>
                    <w:rPr/>
                  </w:r>
                  <w:r>
                    <w:br w:type="page"/>
                  </w:r>
                </w:p>`
                )
            }
        })
        Array.from(this.postamble.children).forEach((node: any) =>
            text.appendChild(node)
        )
    }
}
