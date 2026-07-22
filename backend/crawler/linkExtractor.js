import * as cheerio from 'cheerio';

export function extractLinks(html) {
    const $ = cheerio.load(html);

    const links = [];

    $('a[href]').each((i, element) => {
        const href = $(element).attr('href');

        if (href) {
            links.push(href);
        }
    });

    return links;
}

// AI readiness signal: JSON-LD structured data (schema.org) embedded in the page.
export function extractJsonLd(html) {
    const $ = cheerio.load(html);

    const types = new Set();
    let count = 0;

    $('script[type="application/ld+json"]').each((i, element) => {
        const raw = $(element).contents().text();

        if (!raw || !raw.trim()) {
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        const blocks = Array.isArray(parsed) ? parsed : [parsed];

        for (const block of blocks) {
            if (!block || typeof block !== 'object') continue;

            count += 1;

            const type = block['@type'];
            if (Array.isArray(type)) {
                type.forEach(t => typeof t === 'string' && types.add(t));
            } else if (typeof type === 'string') {
                types.add(type);
            }
        }
    });

    return {
        found: count > 0,
        types: Array.from(types),
        count
    };
}
