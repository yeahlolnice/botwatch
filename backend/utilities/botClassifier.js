const BOT_PATTERNS = [
    // LLM / AI crawlers
    { pattern: /GPTBot/i, label: 'OpenAI GPTBot', type: 'llm-crawler' },
    { pattern: /ChatGPT-User/i, label: 'ChatGPT User', type: 'llm-crawler' },
    { pattern: /OAI-SearchBot/i, label: 'OpenAI SearchBot', type: 'llm-crawler' },
    { pattern: /ClaudeBot/i, label: 'Anthropic ClaudeBot', type: 'llm-crawler' },
    { pattern: /Claude-Web/i, label: 'Anthropic Claude Web', type: 'llm-crawler' },
    { pattern: /anthropic-ai/i, label: 'Anthropic', type: 'llm-crawler' },
    { pattern: /PerplexityBot/i, label: 'Perplexity Bot', type: 'llm-crawler' },
    { pattern: /YouBot/i, label: 'You.com Bot', type: 'llm-crawler' },
    { pattern: /cohere-ai/i, label: 'Cohere AI', type: 'llm-crawler' },
    { pattern: /Diffbot/i, label: 'Diffbot', type: 'llm-crawler' },
    { pattern: /Applebot-Extended/i, label: 'Apple AI Bot', type: 'llm-crawler' },
    { pattern: /meta-externalagent/i, label: 'Meta AI Agent', type: 'llm-crawler' },
    { pattern: /Bytespider/i, label: 'ByteDance Spider', type: 'llm-crawler' },

    // Search engine crawlers
    { pattern: /Googlebot/i, label: 'Googlebot', type: 'search-crawler' },
    { pattern: /bingbot/i, label: 'Bingbot', type: 'search-crawler' },
    { pattern: /Slurp/i, label: 'Yahoo Slurp', type: 'search-crawler' },
    { pattern: /DuckDuckBot/i, label: 'DuckDuckGo Bot', type: 'search-crawler' },
    { pattern: /Baiduspider/i, label: 'Baidu Spider', type: 'search-crawler' },
    { pattern: /YandexBot/i, label: 'Yandex Bot', type: 'search-crawler' },
    { pattern: /Sogou/i, label: 'Sogou Spider', type: 'search-crawler' },
    { pattern: /Exabot/i, label: 'Exabot', type: 'search-crawler' },
    { pattern: /facebot/i, label: 'Facebook Bot', type: 'search-crawler' },
    { pattern: /ia_archiver/i, label: 'Wayback Machine', type: 'search-crawler' },

    // Monitoring / uptime
    { pattern: /UptimeRobot/i, label: 'UptimeRobot', type: 'monitor' },
    { pattern: /Pingdom/i, label: 'Pingdom', type: 'monitor' },
    { pattern: /StatusCake/i, label: 'StatusCake', type: 'monitor' },
    { pattern: /Site24x7/i, label: 'Site24x7', type: 'monitor' },
    { pattern: /DatadogSynthetics/i, label: 'Datadog Synthetics', type: 'monitor' },

    // Generic HTTP tools / scripts
    { pattern: /^python-requests/i, label: 'Python Requests', type: 'script' },
    { pattern: /^curl\//i, label: 'cURL', type: 'script' },
    { pattern: /^Wget\//i, label: 'Wget', type: 'script' },
    { pattern: /^axios\//i, label: 'Axios', type: 'script' },
    { pattern: /^node-fetch/i, label: 'Node Fetch', type: 'script' },
    { pattern: /^Go-http-client/i, label: 'Go HTTP Client', type: 'script' },
    { pattern: /^Java\//i, label: 'Java HTTP', type: 'script' },
    { pattern: /^Apache-HttpClient/i, label: 'Apache HttpClient', type: 'script' },
    { pattern: /httpx/i, label: 'httpx', type: 'script' },
    { pattern: /aiohttp/i, label: 'aiohttp', type: 'script' },
    { pattern: /Scrapy/i, label: 'Scrapy', type: 'script' },

    // Security / scanning tools
    { pattern: /Nikto/i, label: 'Nikto Scanner', type: 'scanner' },
    { pattern: /sqlmap/i, label: 'SQLMap', type: 'scanner' },
    { pattern: /Nmap/i, label: 'Nmap', type: 'scanner' },
    { pattern: /masscan/i, label: 'Masscan', type: 'scanner' },
    { pattern: /ZAP/i, label: 'OWASP ZAP', type: 'scanner' },
    { pattern: /Burp Suite/i, label: 'Burp Suite', type: 'scanner' },
    { pattern: /nuclei/i, label: 'Nuclei', type: 'scanner' },
    { pattern: /WPScan/i, label: 'WPScan', type: 'scanner' },
    { pattern: /dirbuster/i, label: 'DirBuster', type: 'scanner' },
];

export function classifyUserAgent(userAgent) {
    if (!userAgent) return { label: null, type: null };

    for (const { pattern, label, type } of BOT_PATTERNS) {
        if (pattern.test(userAgent)) {
            return { label, type };
        }
    }

    return { label: null, type: null };
}
