// Small hand-rolled tech-fingerprinting ruleset — not exhaustive (that's the
// job of something like Wappalyzer's full dataset), just the ~20 most common
// platforms/tools so a site profile has something useful to show.
//
// Each rule's test(page) receives:
//   page.html          - raw page HTML (already fetched, no extra requests)
//   page.scriptSrcs     - array of <script src> values
//   page.metaGenerator  - <meta name="generator"> content, or null
//   page.techHeaders    - { server, poweredBy, cookieNames } from the response

function anyScriptIncludes(scriptSrcs, needle) {
    return scriptSrcs.some(src => src.toLowerCase().includes(needle));
}

function htmlIncludes(html, needle) {
    return html.toLowerCase().includes(needle);
}

function anyCookieStartsWith(cookieNames, prefix) {
    return cookieNames.some(name => name.toLowerCase().startsWith(prefix));
}

export const techStackRules = [
    {
        name: 'WordPress',
        category: 'CMS',
        test: (page) =>
            (page.metaGenerator?.toLowerCase().includes('wordpress')) ||
            anyScriptIncludes(page.scriptSrcs, '/wp-content/') ||
            anyScriptIncludes(page.scriptSrcs, '/wp-includes/') ||
            anyCookieStartsWith(page.techHeaders.cookieNames, 'wordpress_') ||
            anyCookieStartsWith(page.techHeaders.cookieNames, 'wp-settings'),
    },
    {
        name: 'Shopify',
        category: 'Ecommerce',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'cdn.shopify.com') ||
            htmlIncludes(page.html, 'shopify.theme') ||
            page.techHeaders.poweredBy?.toLowerCase() === 'shopify',
    },
    {
        name: 'Wix',
        category: 'Website Builder',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'static.wixstatic.com') ||
            htmlIncludes(page.html, 'wix.com'),
    },
    {
        name: 'Squarespace',
        category: 'Website Builder',
        test: (page) =>
            (page.metaGenerator?.toLowerCase().includes('squarespace')) ||
            anyScriptIncludes(page.scriptSrcs, 'squarespace.com'),
    },
    {
        name: 'Webflow',
        category: 'Website Builder',
        test: (page) =>
            htmlIncludes(page.html, 'data-wf-site') ||
            anyScriptIncludes(page.scriptSrcs, 'assets-global.website-files.com'),
    },
    {
        name: 'Next.js',
        category: 'JS Framework',
        test: (page) =>
            htmlIncludes(page.html, 'id="__next"') ||
            anyScriptIncludes(page.scriptSrcs, '_next/static'),
    },
    {
        name: 'React',
        category: 'JS Framework',
        test: (page) =>
            htmlIncludes(page.html, 'data-reactroot') ||
            anyScriptIncludes(page.scriptSrcs, 'react-dom'),
    },
    {
        name: 'Vue.js',
        category: 'JS Framework',
        test: (page) =>
            htmlIncludes(page.html, 'data-v-app') ||
            anyScriptIncludes(page.scriptSrcs, 'vue.js') ||
            anyScriptIncludes(page.scriptSrcs, 'vue.min.js'),
    },
    {
        name: 'Angular',
        category: 'JS Framework',
        test: (page) => htmlIncludes(page.html, 'ng-version'),
    },
    {
        name: 'jQuery',
        category: 'JS Library',
        test: (page) => anyScriptIncludes(page.scriptSrcs, 'jquery'),
    },
    {
        name: 'Bootstrap',
        category: 'CSS Framework',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'bootstrap') ||
            htmlIncludes(page.html, 'bootstrap.min.css'),
    },
    {
        name: 'Tailwind CSS',
        category: 'CSS Framework',
        test: (page) => htmlIncludes(page.html, 'tailwindcss'),
    },
    {
        name: 'Google Analytics',
        category: 'Analytics',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'google-analytics.com') ||
            anyScriptIncludes(page.scriptSrcs, 'gtag/js'),
    },
    {
        name: 'Google Tag Manager',
        category: 'Analytics',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'googletagmanager.com') ||
            htmlIncludes(page.html, 'gtm-'),
    },
    {
        name: 'Cloudflare',
        category: 'CDN/Security',
        test: (page) =>
            page.techHeaders.server?.toLowerCase() === 'cloudflare' ||
            anyCookieStartsWith(page.techHeaders.cookieNames, '__cf'),
    },
    {
        name: 'Stripe',
        category: 'Payments',
        test: (page) => anyScriptIncludes(page.scriptSrcs, 'js.stripe.com'),
    },
    {
        name: 'Google reCAPTCHA',
        category: 'Bot Protection',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'google.com/recaptcha') ||
            anyScriptIncludes(page.scriptSrcs, 'gstatic.com/recaptcha'),
    },
    {
        name: 'Cookiebot',
        category: 'Cookie Consent',
        test: (page) => anyScriptIncludes(page.scriptSrcs, 'consent.cookiebot.com'),
    },
    {
        name: 'OneTrust',
        category: 'Cookie Consent',
        test: (page) =>
            anyScriptIncludes(page.scriptSrcs, 'cdn.cookielaw.org') ||
            anyScriptIncludes(page.scriptSrcs, 'onetrust.com'),
    },
    {
        name: 'PHP',
        category: 'Language/Runtime',
        test: (page) =>
            page.techHeaders.poweredBy?.toLowerCase().startsWith('php') ||
            page.techHeaders.cookieNames.includes('PHPSESSID'),
    },
    {
        name: 'ASP.NET',
        category: 'Language/Runtime',
        test: (page) =>
            page.techHeaders.poweredBy?.toLowerCase().includes('asp.net') ||
            anyCookieStartsWith(page.techHeaders.cookieNames, 'asp.net_') ||
            page.techHeaders.cookieNames.some(name => name.toUpperCase().startsWith('ASPSESSIONID')),
    },
    {
        name: 'nginx',
        category: 'Web Server',
        test: (page) => page.techHeaders.server?.toLowerCase().includes('nginx'),
    },
    {
        name: 'Apache',
        category: 'Web Server',
        test: (page) => page.techHeaders.server?.toLowerCase().includes('apache'),
    },
];
