/**
 * Scans request data for attack signatures.
 * Returns a list of signals found and a numeric threat score.
 * Designed to be permissive — flag everything, let analysts decide.
 */

const SIGNATURES = [
    // ── SQL Injection ─────────────────────────────────────────────────────────
    { id: 'sqli_union',       category: 'sqli',     score: 40, pattern: /union\s+select/i },
    { id: 'sqli_or_true',     category: 'sqli',     score: 35, pattern: /(\bor\b|\band\b)\s+[\w'"]+\s*=\s*[\w'"]+/i },
    // -- and # must be preceded by a quote, paren, or digit (SQL context)
    // /* requires a closing */ with no commas/semicolons between — MIME type
    // lists like image/*,*/* accidentally form /* */ pairs across entries
    { id: 'sqli_comment',     category: 'sqli',     score: 30, pattern: /(?<=['")\d])\s*(--|#)|\/\*[^,;]*?\*\//i },
    { id: 'sqli_sleep',       category: 'sqli',     score: 50, pattern: /\b(sleep|benchmark|pg_sleep|waitfor\s+delay)\s*\(/i },
    { id: 'sqli_drop',        category: 'sqli',     score: 60, pattern: /\b(drop|truncate|alter)\s+(table|database|schema)\b/i },
    { id: 'sqli_information', category: 'sqli',     score: 45, pattern: /information_schema|sys\.tables|pg_catalog/i },
    { id: 'sqli_stacked',     category: 'sqli',     score: 40, pattern: /;\s*(select|insert|update|delete|drop|exec)\b/i },
    { id: 'sqli_hex',         category: 'sqli',     score: 25, pattern: /0x[0-9a-f]{4,}/i },
    { id: 'sqli_cast',        category: 'sqli',     score: 30, pattern: /\bcast\s*\(.*\bas\b/i },
    { id: 'sqli_char',        category: 'sqli',     score: 25, pattern: /\bchar\s*\(\s*\d+/i },

    // ── XSS ──────────────────────────────────────────────────────────────────
    { id: 'xss_script_tag',   category: 'xss',      score: 50, pattern: /<script[\s>]/i },
    { id: 'xss_js_proto',     category: 'xss',      score: 45, pattern: /javascript\s*:/i },
    { id: 'xss_event_handler',category: 'xss',      score: 40, pattern: /\bon\w+\s*=/i },
    { id: 'xss_iframe',       category: 'xss',      score: 35, pattern: /<iframe[\s>]/i },
    { id: 'xss_svg',          category: 'xss',      score: 35, pattern: /<svg[\s>].*on\w+\s*=/i },
    { id: 'xss_data_uri',     category: 'xss',      score: 30, pattern: /data:\s*text\/html/i },
    { id: 'xss_vbscript',     category: 'xss',      score: 40, pattern: /vbscript\s*:/i },
    { id: 'xss_expression',   category: 'xss',      score: 35, pattern: /expression\s*\(/i },

    // ── Path Traversal ────────────────────────────────────────────────────────
    { id: 'traversal_dotdot', category: 'traversal', score: 45, pattern: /\.\.[\/\\]/ },
    { id: 'traversal_encoded',category: 'traversal', score: 45, pattern: /(%2e%2e|%252e|\.\.%2f|%2f\.\.)/i },
    { id: 'traversal_etc',    category: 'traversal', score: 55, pattern: /\/etc\/(passwd|shadow|hosts|crontab|sudoers)/i },
    { id: 'traversal_win',    category: 'traversal', score: 50, pattern: /(windows|winnt)[\\\/]system32/i },
    { id: 'traversal_proc',   category: 'traversal', score: 50, pattern: /\/proc\/(self|[0-9]+)\//i },

    // ── Command Injection ─────────────────────────────────────────────────────
    { id: 'cmdi_shell_ops',   category: 'cmdi',     score: 50, pattern: /[;&|`]\s*(ls|cat|id|whoami|uname|wget|curl|bash|sh|python|perl|ruby|php)\b/ },
    { id: 'cmdi_subshell',    category: 'cmdi',     score: 55, pattern: /(\$\(|\`)[^)]*\)/ },
    { id: 'cmdi_redirect',    category: 'cmdi',     score: 35, pattern: /\s(>>?|2>&1)\s/ },
    { id: 'cmdi_nc',          category: 'cmdi',     score: 65, pattern: /\bnc\b.*-[el]|-e\s+\/bin/ },
    { id: 'cmdi_reverse',     category: 'cmdi',     score: 70, pattern: /bash\s+-i\s*>&?\s*\/dev\/tcp/i },
    { id: 'cmdi_python_rev',  category: 'cmdi',     score: 70, pattern: /python.*socket.*connect/i },

    // ── SSRF ──────────────────────────────────────────────────────────────────
    { id: 'ssrf_localhost',   category: 'ssrf',     score: 40, pattern: /(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/i },
    { id: 'ssrf_internal',    category: 'ssrf',     score: 45, pattern: /(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/ },
    { id: 'ssrf_metadata_aws',category: 'ssrf',     score: 70, pattern: /169\.254\.169\.254/ },
    { id: 'ssrf_metadata_gcp',category: 'ssrf',     score: 70, pattern: /metadata\.google\.internal|metadata\.goog/i },
    { id: 'ssrf_metadata_az', category: 'ssrf',     score: 70, pattern: /169\.254\.169\.254|metadata\.azure\.com/i },
    { id: 'ssrf_file',        category: 'ssrf',     score: 55, pattern: /file:\/\/\//i },
    { id: 'ssrf_dict',        category: 'ssrf',     score: 40, pattern: /dict:\/\//i },
    { id: 'ssrf_gopher',      category: 'ssrf',     score: 50, pattern: /gopher:\/\//i },

    // ── Template Injection ────────────────────────────────────────────────────
    { id: 'ssti_jinja',       category: 'ssti',     score: 50, pattern: /\{\{[\s\S]*?\}\}/ },
    { id: 'ssti_twig',        category: 'ssti',     score: 45, pattern: /\{%[\s\S]*?%\}/ },
    { id: 'ssti_freemarker',  category: 'ssti',     score: 45, pattern: /\$\{[\s\S]*?\}/ },
    { id: 'ssti_velocity',    category: 'ssti',     score: 40, pattern: /#\w+\s*\(/ },
    { id: 'ssti_ruby',        category: 'ssti',     score: 45, pattern: /<%=[\s\S]*?%>/ },

    // ── Log4Shell / Log4j ─────────────────────────────────────────────────────
    { id: 'log4j_jndi',       category: 'log4j',    score: 90, pattern: /\$\{jndi:/i },
    { id: 'log4j_nested',     category: 'log4j',    score: 90, pattern: /\$\{[^\}]*\$\{/i },
    { id: 'log4j_ldap',       category: 'log4j',    score: 85, pattern: /\$\{.*ldap[si]?:/i },
    { id: 'log4j_rmi',        category: 'log4j',    score: 85, pattern: /\$\{.*rmi:/i },

    // ── XXE / XML ─────────────────────────────────────────────────────────────
    { id: 'xxe_entity',       category: 'xxe',      score: 60, pattern: /<!ENTITY\s+\w+\s+SYSTEM/i },
    { id: 'xxe_doctype',      category: 'xxe',      score: 45, pattern: /<!DOCTYPE\s+\w+\s+\[/i },

    // ── Deserialization ───────────────────────────────────────────────────────
    { id: 'deser_java',       category: 'deser',    score: 70, pattern: /rO0AB/ },  // Java serialized base64 magic
    { id: 'deser_php',        category: 'deser',    score: 60, pattern: /O:\d+:"[A-Za-z]/ },
    { id: 'deser_pickle',     category: 'deser',    score: 65, pattern: /cos\nsystem/ },

    // ── Sensitive file probing ────────────────────────────────────────────────
    { id: 'probe_env',        category: 'probe',    score: 30, pattern: /\.(env|config|cfg|ini|conf)$/i },
    { id: 'probe_backup',     category: 'probe',    score: 35, pattern: /\.(bak|old|orig|backup|sql|dump|tar|gz|zip)$/i },
    { id: 'probe_git',        category: 'probe',    score: 40, pattern: /\/\.git\//i },
    { id: 'probe_ssh',        category: 'probe',    score: 50, pattern: /\/(\.ssh|id_rsa|authorized_keys)/i },
    { id: 'probe_aws',        category: 'probe',    score: 55, pattern: /\/(\.aws|credentials|aws_secret)/i },

    // ── Scanner fingerprints in headers/UA ────────────────────────────────────
    { id: 'scanner_sqlmap',   category: 'scanner',  score: 80, pattern: /sqlmap/i },
    { id: 'scanner_nikto',    category: 'scanner',  score: 80, pattern: /nikto/i },
    { id: 'scanner_nuclei',   category: 'scanner',  score: 75, pattern: /nuclei/i },
    { id: 'scanner_acunetix', category: 'scanner',  score: 75, pattern: /acunetix/i },
    { id: 'scanner_nessus',   category: 'scanner',  score: 75, pattern: /nessus/i },
    { id: 'scanner_zap',      category: 'scanner',  score: 70, pattern: /owasp[\s_-]?zap/i },
    { id: 'scanner_burp',     category: 'scanner',  score: 70, pattern: /burpsuite|burp\s+suite/i },
    { id: 'scanner_masscan',  category: 'scanner',  score: 65, pattern: /masscan/i },
    { id: 'scanner_zgrab',    category: 'scanner',  score: 60, pattern: /zgrab/i },
    { id: 'scanner_hydra',    category: 'scanner',  score: 70, pattern: /hydra/i },
];

/**
 * Flatten all inspectable string data from a request into a single target map.
 * Keeps track of where each string came from so signals can be attributed.
 */
function buildTargets(req) {
    const targets = [];

    // Path + raw URL
    targets.push({ source: 'path', value: req.originalUrl || req.path || '' });

    // Query string (each value individually + raw)
    const qs = req.query || {};
    for (const [key, val] of Object.entries(qs)) {
        const v = Array.isArray(val) ? val.join(' ') : String(val);
        targets.push({ source: `query.${key}`, value: v });
    }

    // Headers (all of them)
    const headers = req.headers || {};
    for (const [key, val] of Object.entries(headers)) {
        targets.push({ source: `header.${key}`, value: String(val) });
    }

    // Raw body — the verbatim bytes captured for every content type. This is
    // where payloads sent on odd/unparsed content types show up.
    if (req.rawBody) {
        targets.push({ source: 'raw_body', value: req.rawBody });
    }

    // Parsed body (JSON/form/text). Skip raw Buffers — raw_body already covers
    // those, and JSON.stringify on a Buffer produces useless noise.
    if (req.body && !Buffer.isBuffer(req.body)) {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        targets.push({ source: 'body', value: bodyStr });
        // Also inspect individual body fields if it's an object
        if (typeof req.body === 'object') {
            flattenObject(req.body, 'body', targets);
        }
    }

    return targets;
}

function flattenObject(obj, prefix, out, depth = 0) {
    if (depth > 5) return;
    for (const [key, val] of Object.entries(obj)) {
        const path = `${prefix}.${key}`;
        if (typeof val === 'string') {
            out.push({ source: path, value: val });
        } else if (val && typeof val === 'object') {
            flattenObject(val, path, out, depth + 1);
        }
    }
}

export function analyzeRequest(req) {
    const targets = buildTargets(req);
    const signals = [];
    const seenIds = new Set();

    for (const sig of SIGNATURES) {
        for (const { source, value } of targets) {
            if (!value) continue;
            if (sig.pattern.test(value)) {
                if (!seenIds.has(sig.id)) {
                    seenIds.add(sig.id);
                    const match = value.match(sig.pattern);
                    signals.push({
                        id: sig.id,
                        category: sig.category,
                        score: sig.score,
                        source,
                        // Store a short excerpt around the match for forensics
                        excerpt: match ? excerpt(value, match.index, 120) : null,
                    });
                }
            }
        }
    }

    const threatScore = Math.min(signals.reduce((sum, s) => sum + s.score, 0), 100);

    return { signals, threatScore };
}

function excerpt(str, index, maxLen) {
    const start = Math.max(0, index - 20);
    const end = Math.min(str.length, index + maxLen);
    const snip = str.slice(start, end);
    return (start > 0 ? '…' : '') + snip + (end < str.length ? '…' : '');
}
