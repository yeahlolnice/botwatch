import { ensurePage, countPagesForDomain } from './db.js';

export async function seedDomainHomepage(domain) {
    const pageCount = await countPagesForDomain(domain.id);

    if (pageCount > 0) {
        return {
            seeded: false,
            reason: 'Domain already has pages'
        };
    }

    const homepage = await ensurePage({
        domainId: domain.id,
        url: `https://${domain.hostname}/`,
        path: '/',
        depth: 0
    });

    return {
        seeded: true,
        page: homepage
    };
}
