import {escapeText} from "fwtoolkit"

export const chapterTemplate = ({
    part,
    contents
}: Record<string, unknown>) => `
    ${part && (part as string).length ? `<h1 class="part">${escapeText(part as string)}</h1>` : ""}
    ${contents}`
