import {ODTExporterRender} from "@fiduswriter/document/exporter/odt/render"

export class ODTBookExporterRender extends ODTExporterRender {
    styles: any
    preamble: any
    bodyTemplate: any
    postamble: any
    bodyParts: any[]
    fileXml: any

    constructor(xml: any, styles: any) {
        super(xml)

        this.styles = styles

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null

        this.bodyParts = []
        this.fileXml = null
    }

    init(): Promise<void> {
        return this.xml.getXml(this.filePath).then((xml: any) => {
            this.fileXml = xml
            const text = xml.query("office:text")
            this.preamble = text.cloneNode(false)
            this.bodyTemplate = text.cloneNode(false)
            this.postamble = text.cloneNode(false)
            let currentSection: any
            const textChildren = Array.from(text.children)
            textChildren.forEach((node: any) => {
                if (["text:p", "text:h"].includes(node.tagName)) {
                    const bookmark = node.query("text:bookmark")
                    if (bookmark) {
                        const sectionName = String(
                            bookmark.getAttribute("text:name")
                        ).toLowerCase()
                        if (sectionName === "preamble") {
                            currentSection = this.preamble
                        } else if (sectionName === "postamble") {
                            currentSection = this.postamble
                        } else if (sectionName === "body") {
                            currentSection = this.bodyTemplate
                        } else {
                            currentSection = currentSection || this.bodyTemplate
                        }
                    } else {
                        currentSection = currentSection || this.bodyTemplate
                    }
                }
                if (currentSection) {
                    currentSection.appendChild(node)
                }
            })
            return Promise.resolve()
        })
    }

    render(...args: any[]): void {
        const [docContent, pmBib, settings, richtext, citations, chapterIndex] = args
        this.text = this.bodyTemplate.cloneNode(true)
        const bodyBookmark = (this.text as any).query("text:bookmark", {
            "text:name": "body"
        })
        if (bodyBookmark) {
            bodyBookmark.setAttribute(
                "text:name",
                `chapter ${chapterIndex + 1}`
            )
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
            const blocks = amble.queryAll(["text:p", "text:h"])
            blocks.forEach((block: any) => {
                if (block.parentElement.nodeName === "text:deletion") {
                    return
                }
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
        this.styles.addPageBreakStyle()
        const text = this.fileXml.query("office:text")
        Array.from(this.preamble.children).forEach((node: any) =>
            text.appendChild(node)
        )
        this.bodyParts.forEach((bodyPart: any, index: number) => {
            const children = bodyPart.children.slice()
            children.forEach((node: any) => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML('<text:p text:style-name="PageBreak"/>')
            }
        })
        Array.from(this.postamble.children).forEach((node: any) =>
            text.appendChild(node)
        )
    }
}
