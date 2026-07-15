import type {DocSettings, FidusNode} from "@fiduswriter/document"
import {XMLElement} from "@fiduswriter/document/exporter/tools/xml"
import type {XmlZip} from "@fiduswriter/document/exporter/tools/xml_zip"
import {ODTExporterCitations} from "@fiduswriter/document/exporter/odt/citations"
import {ODTExporterRender} from "@fiduswriter/document/exporter/odt/render"
import {ODTExporterRichtext} from "@fiduswriter/document/exporter/odt/richtext"
import type {ODTExporterStyles} from "@fiduswriter/document/exporter/odt/styles"

export class ODTBookExporterRender extends ODTExporterRender {
    styles: ODTExporterStyles
    preamble: XMLElement | null
    bodyTemplate: XMLElement | null
    postamble: XMLElement | null
    bodyParts: XMLElement[]
    fileXml: XMLElement | null

    constructor(xml: XmlZip, styles: ODTExporterStyles) {
        super(xml)

        this.styles = styles

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null

        this.bodyParts = []
        this.fileXml = null
    }

    init(): Promise<void> {
        return this.xml.getXml(this.filePath).then(xml => {
            this.fileXml = xml
            const text = xml.query("office:text") as XMLElement
            this.preamble = text.cloneNode(false)
            this.bodyTemplate = text.cloneNode(false)
            this.postamble = text.cloneNode(false)
            let currentSection: XMLElement | null = null
            const textChildren = Array.from(text.children).filter(
                (node): node is XMLElement => node instanceof XMLElement
            )
            textChildren.forEach(node => {
                if (node.tagName && ["text:p", "text:h"].includes(node.tagName)) {
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

    render(
        docContent: FidusNode,
        pmBib: unknown,
        settings: DocSettings,
        richtext: ODTExporterRichtext,
        citations: ODTExporterCitations,
        chapterIndex = 0
    ): void {
        this.text = this.bodyTemplate!.cloneNode(true)
        const textEl = this.text as XMLElement
        const bodyBookmark = textEl.query("text:bookmark", {
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
        const usedTags: Array<{
            title: string
            content?: unknown
            block: XMLElement
        }> = []
        const ambles = [this.preamble, this.postamble].filter(
            (amble): amble is XMLElement => amble !== null
        )
        ambles.forEach(amble => {
            const blocks = amble.queryAll(["text:p", "text:h"])
            blocks.forEach(block => {
                if (block.parentElement?.tagName === "text:deletion") {
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
        const text = this.fileXml!.query("office:text") as XMLElement
        Array.from(this.preamble!.children)
            .filter((node): node is XMLElement => node instanceof XMLElement)
            .forEach(node => text.appendChild(node))
        this.bodyParts.forEach((bodyPart, index) => {
            const children = bodyPart.children
                .slice()
                .filter((node): node is XMLElement => node instanceof XMLElement)
            children.forEach(node => {
                text.appendChild(node)
            })
            if (index < this.bodyParts.length - 1) {
                text.appendXML('<text:p text:style-name="PageBreak"/>')
            }
        })
        Array.from(this.postamble!.children)
            .filter((node): node is XMLElement => node instanceof XMLElement)
            .forEach(node => text.appendChild(node))
    }
}
