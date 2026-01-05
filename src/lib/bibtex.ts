import { ReadingItem, ReadingType } from "@/types/tracking";

export function parseBulkBibtex(fileContent: string): ReadingItem[] {
    const rawEntries = fileContent.split(/^@/m).filter((e) => e.trim().length > 10);
    const items: ReadingItem[] = [];

    rawEntries.forEach((entryRaw) => {
        const typeMatch = entryRaw.match(/^(\w+)\s*\{([^,]+),/);
        if (!typeMatch) return;

        const entryType = typeMatch[1].toLowerCase();
        const bibKey = typeMatch[2].trim();

        const getField = (key: string) => {
            const re = new RegExp(`${key}\\s*=\\s*[\\{"](.*?)[\\}"](?=,\\s*\\n|\\s*\\})`, "is");
            const m = entryRaw.match(re);
            return m ? m[1].replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim() : "";
        };

        const title = getField("title").replace(/[{}]/g, "");
        const author = getField("author").replace(/\s+and\s+/gi, ", ").replace(/[{}]/g, "");
        const year = getField("year");
        const doi = getField("doi");
        const url = getField("url");
        const abstract = getField("abstract");
        const keywords = getField("keywords");

        let type: ReadingType = "other";
        if (entryType.includes("book")) type = "book";
        else if (entryType.includes("article") || entryType.includes("periodical")) type = "article";
        else if (entryType.includes("incollection") || entryType.includes("chapter")) type = "chapter";
        else if (entryType.includes("thesis")) type = "thesis";

        if (title) {
            items.push({
                id: `bib_${bibKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title,
                authors: author,
                year,
                type,
                status: "to_read",
                tags: keywords ? keywords.split(/[,;]/).map(t => t.trim()) : [],
                doi,
                url,
                notes: abstract ? `Özet: ${abstract.substring(0, 300)}...` : "",
                updatedAt: Date.now(),
            });
        }
    });
    return items;
}
