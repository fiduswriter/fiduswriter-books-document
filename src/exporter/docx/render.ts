import {XMLElement} from "@fiduswriter/document/exporter/tools/xml"
import type {XmlZip} from "@fiduswriter/document/exporter/tools/xml_zip"
import {DOCXExporterCitations} from "@fiduswriter/document/exporter/docx/citations"
import {DOCXExporterRender} from "@fiduswriter/document/exporter/docx/render"
import {DOCXExporterRichtext} from "@fiduswriter/document/exporter/docx/richtext"
import type {DocSettings, FidusNode} from "@fiduswriter/document"

interface TagData {
    title: string
    content?: string | unknown[]
    block: XMLElement
    dimensions?: {width: number; height: number}
}

export class DOCXBookExporterRender extends DOCXExporterRender {
    preamble: XMLElement | null
    bodyTemplate: XMLElement | null
    postamble: XMLElement | null
    fileXML: XMLElement | null
    bodyParts: XMLElement[]

    constructor(xml: XmlZip) {
        super(xml)

        this.preamble = null
        this.bodyTemplate = null
        this.postamble = null
        this.fileXML = null
        this.bodyParts = []
    }

    init(): Promise<void> {
        return super.init().then(() => {
            this.fileXML = this.text as XMLElement
            const text = this.fileXML.query("w:body") as XMLElement
            this.preamble = text.cloneNode(false)
            this.bodyTemplate = text.cloneNode(false)
            this.postamble = text.cloneNode(false)
            let currentSection: XMLElement | null = this.bodyTemplate
            const textChildren = Array.from(text.children).filter(
                (node): node is XMLElement => node instanceof XMLElement
            )
            textChildren.forEach(node => {
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
                currentSection!.appendChild(node)
            })
            return Promise.resolve()
        })
    }

    render(
        docContent: FidusNode,
        pmBib: unknown,
        settings: DocSettings,
        richtext: DOCXExporterRichtext,
        citations: DOCXExporterCitations,
        chapterIndex = 0
    ): void {
        this.text = this.bodyTemplate!.cloneNode(true)
        const textEl = this.text as XMLElement
        const bodyBookmark = textEl.query("w:bookmarkStart", {
            "w:name": "body"
        })
        if (bodyBookmark) {
            bodyBookmark.setAttribute("w:name", `chapter ${chapterIndex + 1}`)
        }
        super.render(
            docContent,
            pmBib as false | FidusNode,
            settings,
            richtext,
            citations
        )
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
            content?: string | unknown[]
            block: XMLElement
        }> = []
        const ambles = [this.preamble, this.postamble].filter(
            (amble): amble is XMLElement => amble !== null
        )
        ambles.forEach(amble => {
            const blocks = amble.queryAll(["w:p", "w:sectPr"])
            blocks.forEach(block => {
                const text = block.textContent
                tags.forEach(tag => {
                    const tagString = tag.title
                    if (text.includes(`{${tagString}}`)) {
                        usedTags.push(Object.assign({block}, tag) as TagData)
                    }
                })
            })
        })
        usedTags.forEach(tag => this.inlineRender(tag as unknown as TagData))
    }

    assemble(): void {
        const text = this.fileXML!.query("w:body") as XMLElement
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
        Array.from(this.postamble!.children)
            .filter((node): node is XMLElement => node instanceof XMLElement)
            .forEach(node => text.appendChild(node))
    }
}
