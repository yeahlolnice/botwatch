// Known AI-training crawler user-agent tokens, checked against a domain's
// robots.txt to build its AI training policy. Not an exhaustive list —
// covers the crawlers site owners are most likely to have deliberately
// allowed or blocked.
export const AI_TRAINING_BOTS = [
    'GPTBot',          // OpenAI
    'ChatGPT-User',    // OpenAI
    'OAI-SearchBot',   // OpenAI
    'CCBot',           // Common Crawl (feeds many LLM training sets)
    'Google-Extended', // Google Gemini training
    'ClaudeBot',       // Anthropic
    'anthropic-ai',    // Anthropic
    'Claude-Web',       // Anthropic
    'PerplexityBot',   // Perplexity
    'Bytespider',      // ByteDance/TikTok
    'Applebot-Extended', // Apple
    'Amazonbot',       // Amazon
    'Diffbot',         // Diffbot
    'cohere-ai',       // Cohere
    'meta-externalagent', // Meta
];

// Display metadata for the AI-crawler access matrix on the company profile —
// who operates each crawler and what it's for, so the allow/block grid reads
// as "which AI systems can reach this site" rather than a wall of UA tokens.
// purpose ∈ Training | Search | Agent | Crawler.
export const AI_BOT_META = {
    'GPTBot': { operator: 'OpenAI', purpose: 'Training' },
    'ChatGPT-User': { operator: 'OpenAI', purpose: 'Agent' },
    'OAI-SearchBot': { operator: 'OpenAI', purpose: 'Search' },
    'CCBot': { operator: 'Common Crawl', purpose: 'Training' },
    'Google-Extended': { operator: 'Google (Gemini)', purpose: 'Training' },
    'ClaudeBot': { operator: 'Anthropic', purpose: 'Training' },
    'anthropic-ai': { operator: 'Anthropic', purpose: 'Training' },
    'Claude-Web': { operator: 'Anthropic', purpose: 'Agent' },
    'PerplexityBot': { operator: 'Perplexity', purpose: 'Search' },
    'Bytespider': { operator: 'ByteDance', purpose: 'Training' },
    'Applebot-Extended': { operator: 'Apple', purpose: 'Training' },
    'Amazonbot': { operator: 'Amazon', purpose: 'Search' },
    'Diffbot': { operator: 'Diffbot', purpose: 'Crawler' },
    'cohere-ai': { operator: 'Cohere', purpose: 'Training' },
    'meta-externalagent': { operator: 'Meta', purpose: 'Training' },
};
