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
