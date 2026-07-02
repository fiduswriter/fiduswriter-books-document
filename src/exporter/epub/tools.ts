export function getTimestamp(date: Date): string {
    return date.toISOString().replace(/\.\d{3}/, "")
}

export function getFontMimeType(filename: string): string | null {
    const fontMimeTypes: Record<string, string> = {
        ttf: "font/ttf",
        otf: "font/otf",
        woff: "font/woff",
        woff2: "font/woff2"
    }
    const ext = filename.split(".").pop()?.toLowerCase()
    return ext ? fontMimeTypes[ext] || null : null
}

export function getImageMimeType(filename: string): string | null {
    const imageMimeTypes: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        svg: "image/svg+xml"
    }
    const ext = filename.split(".").pop()?.toLowerCase()
    return ext ? imageMimeTypes[ext] || null : null
}

export function buildHierarchy(
    flatItems: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
    const root: Array<Record<string, unknown>> = []
    const idMap: Record<string | number, Record<string, unknown>> = {}

    flatItems.forEach(item => {
        idMap[item.id as string | number] = {
            ...item,
            children: []
        }
    })

    flatItems.forEach(item => {
        const node = idMap[item.id as string | number]
        if (item.level === -1 || item.level === 0) {
            root.push(node)
        } else {
            let parentLevel = (item.level as number) - 1
            let parent: Record<string, unknown> | undefined
            while (parentLevel >= 0 && !parent) {
                parent = flatItems.find(
                    p =>
                        p.level === parentLevel &&
                        p.docNum === item.docNum &&
                        (p.id as number) < (item.id as number)
                )
                parentLevel--
            }
            if (parent) {
                ;(idMap[parent.id as string | number].children as Array<
                    Record<string, unknown>
                >).push(node)
            } else {
                root.push(node)
            }
        }
    })

    return root
}
