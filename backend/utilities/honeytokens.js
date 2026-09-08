// Honeytokens — the canary credentials we plant inside the fake config-file
// honeypots (.env, wp-config.php, …). Each value is unique and high-entropy, so
// if one ever comes back in a login attempt the attacker provably harvested it
// from one of our fake files first: a complete scrape -> harvest -> replay
// attack chain, caught end to end.
//
// This is the SINGLE SOURCE OF TRUTH. The honeypot handlers interpolate these
// values into the files they serve, and the replay detector matches login
// attempts against the same list — so the two can never drift apart.
//
// Deliberately EXCLUDES guessable/known values that would false-positive:
// env-local's root/root (attackers guess it blind) and the well-known AWS
// example key AKIAIOSFODNN7EXAMPLE (public, in every tutorial).

export const HONEYTOKENS = [
    { value: 'Xp9#mK2$vL7@nR4',         type: 'password', source: '.env',          field: 'DB_PASSWORD' },
    { value: 'rK8$pM3#wN6@vT1',         type: 'password', source: '.env',          field: 'REDIS_PASSWORD' },
    { value: 'mg-fake-password-here',   type: 'password', source: '.env',          field: 'MAIL_PASSWORD' },
    { value: 'Wp@dMin#2024!fake',       type: 'password', source: 'wp-config.php', field: 'DB_PASSWORD' },
    { value: 'bw_admin',                type: 'username', source: '.env',          field: 'DB_USERNAME' },
    { value: 'postmaster@botwatch.xyz', type: 'username', source: '.env',          field: 'MAIL_USERNAME' },
];

// Flat list of just the secret strings — passed to the replay-detection query.
export const HONEYTOKEN_VALUES = HONEYTOKENS.map((t) => t.value);

// Config-file traps whose responses carry planted honeytokens — used to
// correlate a replay back to the scrape event that harvested it.
export const HONEYTOKEN_TRAP_TYPES = [
    'env-file', 'env-local', 'wp-config', 'git-config', 'aws-credentials', 'k8s-secrets',
];
