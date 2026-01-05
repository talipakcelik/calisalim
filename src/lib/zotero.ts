import { ReadingItem, ReadingType } from "@/types/tracking";

const ZOTERO_API_BASE = "https://api.zotero.org";

export type ZoteroConfig = {
    userId: string;
    apiKey: string;
};

type ZoteroItem = {
    key: string;
    data: {
        title: string;
        itemType: string; // journalArticle, book, thesis...
        creators?: { creatorType: string; firstName?: string; lastName?: string }[];
        date?: string;
        url?: string;
        DOI?: string;
        tags?: { tag: string }[];
        abstractNote?: string;
    };
};

function mapZoteroType(zType: string): ReadingType {
    const t = zType.toLowerCase();
    if (t === "book") return "book";
    if (t === "booksection") return "chapter";
    if (t === "thesis") return "thesis";
    if (t === "journalarticle" || t === "conferencepaper") return "article";
    return "other";
}

function parseZoteroDate(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;
    const match = dateStr.match(/(\d{4})/);
    return match ? match[1] : undefined;
}

export async function fetchZoteroItems(config: ZoteroConfig, limit = 50): Promise<ReadingItem[]> {
    if (!config.userId || !config.apiKey) throw new Error("API Konfigürasyonu eksik");

    const url = `${ZOTERO_API_BASE}/users/${config.userId}/items?format=json&limit=${limit}&sort=dateAdded&direction=desc&itemType=-attachment`;

    const res = await fetch(url, {
        headers: {
            "Zotero-API-Key": config.apiKey
        }
    });

    if (!res.ok) {
        if (res.status === 403) throw new Error("Erişim reddedildi. Key veya User ID hatalı.");
        throw new Error(`Zotero API Hatası: ${res.status}`);
    }

    const data = (await res.json()) as ZoteroItem[];

    return data.map(item => {
        const authors = item.data.creators
            ?.map(c => `${c.firstName || ""} ${c.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", ");

        const tags = item.data.tags?.map(t => t.tag) || [];

        return {
            id: `zotero_${item.key}`,
            title: item.data.title || "(Başlıksız)",
            authors: authors,
            year: parseZoteroDate(item.data.date),
            type: mapZoteroType(item.data.itemType),
            status: "to_read", // Varsayılan olarak okunacak
            tags: tags,
            url: item.data.url,
            doi: item.data.DOI,
            notes: item.data.abstractNote?.slice(0, 500), // Özet notlara eklensin
            updatedAt: Date.now(),
            zoteroKey: item.key
        };
    });
}
