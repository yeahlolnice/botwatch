import * as cheerio from 'cheerio';

// Parses the page HTML once and runs every extractor against the same
// cheerio tree — loading cheerio repeatedly on the same HTML (one call per
// extractor) re-parses the whole page each time for no benefit.
export function parsePage(html) {
    const $ = cheerio.load(html);

    return {
        links: extractLinks($),
        emails: extractEmails($),
        phoneNumbers: extractPhoneNumbers($),
        jsonLd: extractJsonLd($),
        title: extractTitle($),
        metaDescription: extractMetaDescription($),
        metaGenerator: extractMetaGenerator($),
        scriptSrcs: extractScriptSrcs($),
    };
}

function extractTitle($) {
    const title = $('title').first().text().trim();
    return title || null;
}

function extractMetaDescription($) {
    const description = $('meta[name="description"]').attr('content');
    return description?.trim() || null;
}

function extractMetaGenerator($) {
    const generator = $('meta[name="generator"]').attr('content');
    return generator?.trim() || null;
}

function extractScriptSrcs($) {
    const srcs = [];

    $('script[src]').each((i, element) => {
        const src = $(element).attr('src');
        if (src) srcs.push(src);
    });

    return srcs;
}

function extractLinks($) {
    const links = [];

    $('a[href]').each((i, element) => {
        const href = $(element).attr('href');

        if (href) {
            links.push(href);
        }
    });

    return links;
}

function extractPhoneNumbers($) {
    const phoneNumbers = new Set();

    $('a[href^="tel:"]').each((i, element) => {
        const href = $(element).attr('href');

        if (!href) return;

        const number = decodeURIComponent(href.replace(/^tel:/, '')).trim();

        if (number) phoneNumbers.add(number);
    });

    return Array.from(phoneNumbers);
}

function extractEmails($) {
    const emails = new Set();

    $('a[href^="mailto:"]').each((i, element) => {
        const href = $(element).attr('href');

        if (!href) return;

        // Strip mailto: prefix and any ?subject=/?body= query string, then
        // split on commas — mailto: allows multiple comma-separated recipients.
        const recipients = href
            .replace(/^mailto:/, '')
            .split('?')[0]
            .split(',');

        for (const raw of recipients) {
            const email = decodeURIComponent(raw).trim().toLowerCase();
            if (email) emails.add(email);
        }
    });

    return Array.from(emails);
}

// AI readiness signal: JSON-LD structured data (schema.org) embedded in the page.
function extractJsonLd($) {
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
