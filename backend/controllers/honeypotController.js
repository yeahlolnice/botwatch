/**
 * Honeypot handlers.
 * Each sets req.isTrap = true and req.trapType before responding.
 * The tracking middleware reads those fields after res.finish.
 *
 * Responses are intentionally plausible — the goal is to keep scanners
 * engaged long enough to fingerprint them and encourage further probing.
 */

function trap(type) {
    return (req, res, next) => {
        req.isTrap = true;
        req.trapType = type;
        next();
    };
}

// ── .env / config files ───────────────────────────────────────────────────────

export const fakeEnv = [trap('env-file'), (req, res) => {
    res.type('text/plain').status(200).send(
`APP_NAME=BotWatch
APP_ENV=production
APP_KEY=base64:xK9mP2qR7vL4nJ8wE1uY6tA3oS5hF0cI
APP_DEBUG=false
APP_URL=https://botwatch.xyz

DB_CONNECTION=pgsql
DB_HOST=db.internal.botwatch.xyz
DB_PORT=5432
DB_DATABASE=botwatch_prod
DB_USERNAME=bw_admin
DB_PASSWORD=Xp9#mK2$vL7@nR4

REDIS_HOST=redis.internal.botwatch.xyz
REDIS_PASSWORD=rK8$pM3#wN6@vT1
REDIS_PORT=6379

AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=ap-southeast-2
AWS_BUCKET=botwatch-prod-uploads

STRIPE_KEY=${'sk_live_' + '51HxEXAMPLEkEy000fake000'}
STRIPE_SECRET=${'rk_live_' + '51HxEXAMPLEsEcReT000fake'}

MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=postmaster@botwatch.xyz
MAIL_PASSWORD=mg-fake-password-here

PUSHER_APP_ID=123456
PUSHER_APP_KEY=fake_pusher_key_here
PUSHER_APP_SECRET=fake_pusher_secret
`);
}];

export const fakeEnvLocal = [trap('env-local'), (req, res) => {
    res.type('text/plain').send(
`APP_ENV=local
APP_DEBUG=true
DB_HOST=127.0.0.1
DB_USERNAME=root
DB_PASSWORD=root
`);
}];

export const fakeGitConfig = [trap('git-config'), (req, res) => {
    res.type('text/plain').send(
`[core]
\trepositoryformatversion = 0
\tfilemode = true
\tbare = false
\tlogallrefupdates = true
[remote "origin"]
\turl = git@github.com:botwatch/botwatch-private.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
\tmerge = refs/heads/main
`);
}];

export const fakeGitHead = [trap('git-head'), (req, res) => {
    res.type('text/plain').send('ref: refs/heads/main\n');
}];

// ── WordPress ─────────────────────────────────────────────────────────────────

export const fakeWpLogin = [trap('wp-login'), (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Log In &lsaquo; BotWatch &#8212; WordPress</title></head>
<body class="login">
<div id="login">
  <h1><a href="https://botwatch.xyz">BotWatch</a></h1>
  <form method="post" action="/wp-login.php">
    <p><label>Username<input type="text" name="log" /></label></p>
    <p><label>Password<input type="password" name="pwd" /></label></p>
    <input type="hidden" name="wp-submit" value="Log In" />
    <input type="hidden" name="redirect_to" value="/wp-admin/" />
    <input type="submit" value="Log In" />
  </form>
</div>
</body></html>`);
}];

export const fakeWpAdmin = [trap('wp-admin'), (req, res) => {
    res.redirect(302, '/wp-login.php');
}];

export const fakeWpConfig = [trap('wp-config'), (req, res) => {
    res.type('text/plain').send(
`<?php
define('DB_NAME', 'botwatch_wp');
define('DB_USER', 'wp_admin');
define('DB_PASSWORD', 'Wp@dMin#2024!fake');
define('DB_HOST', 'localhost');
define('AUTH_KEY',         'fake-key-here-do-not-use');
define('SECURE_AUTH_KEY',  'fake-key-here-do-not-use');
define('LOGGED_IN_KEY',    'fake-key-here-do-not-use');
define('NONCE_KEY',        'fake-key-here-do-not-use');
`);
}];

// ── PHP ───────────────────────────────────────────────────────────────────────

export const fakePhpInfo = [trap('phpinfo'), (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>phpinfo()</title></head><body>
<table><tr><td>PHP Version</td><td>8.1.12</td></tr>
<tr><td>System</td><td>Linux botwatch 5.15.0-1034-aws x86_64</td></tr>
<tr><td>Server API</td><td>FPM/FastCGI</td></tr>
<tr><td>Configuration File (php.ini) Path</td><td>/etc/php/8.1/fpm</td></tr>
<tr><td>allow_url_fopen</td><td>On</td></tr>
<tr><td>disable_functions</td><td>exec,passthru,shell_exec,system</td></tr>
</table></body></html>`);
}];

// ── Spring Boot actuator ──────────────────────────────────────────────────────

export const fakeActuator = [trap('actuator-health'), (req, res) => {
    res.json({ status: 'UP', components: { db: { status: 'UP' }, diskSpace: { status: 'UP' } } });
}];

export const fakeActuatorEnv = [trap('actuator-env'), (req, res) => {
    res.json({
        activeProfiles: ['production'],
        propertySources: [
            {
                name: 'applicationConfig: [classpath:/application.properties]',
                properties: {
                    'spring.datasource.url': { value: 'jdbc:postgresql://db.internal:5432/botwatch' },
                    'spring.datasource.username': { value: 'bw_service' },
                    'spring.datasource.password': { value: '******' },
                    'server.port': { value: '8080' },
                },
            },
        ],
    });
}];

// ── Admin panels ──────────────────────────────────────────────────────────────

export const fakeAdmin = [trap('admin-panel'), (req, res) => {
    res.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Admin Login</title></head><body>
<h2>Administration Panel</h2>
<form method="post">
  <input type="text" name="username" placeholder="Username" /><br/>
  <input type="password" name="password" placeholder="Password" /><br/>
  <button type="submit">Login</button>
</form>
</body></html>`);
}];

export const fakeAdminPost = [trap('admin-login-attempt'), (req, res) => {
    // Log attempted credentials via tracking middleware, then return 401
    res.status(401).type('text/html').send(`<!DOCTYPE html>
<html><body><p>Invalid credentials.</p><a href="/admin">Try again</a></body></html>`);
}];

// ── Database / backup files ───────────────────────────────────────────────────

export const fakeBackupSql = [trap('sql-backup'), (req, res) => {
    res.type('application/octet-stream')
       .set('Content-Disposition', 'attachment; filename="backup.sql"')
       .status(200)
       .send('-- BotWatch database backup\n-- Generated: 2024-01-01\n-- THIS FILE IS INTENTIONALLY EMPTY\n');
}];

// ── Cloud metadata ────────────────────────────────────────────────────────────

export const fakeAwsCredentials = [trap('aws-credentials'), (req, res) => {
    res.type('text/plain').send(
`[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`);
}];

// ── Kubernetes / Docker ───────────────────────────────────────────────────────

export const fakeK8sSecrets = [trap('k8s-secrets'), (req, res) => {
    res.json({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'botwatch-secrets', namespace: 'production' },
        data: {
            DB_PASSWORD: 'ZmFrZS1wYXNzd29yZA==',
            API_KEY: 'ZmFrZS1hcGkta2V5LWhlcmU=',
        },
    });
}];

// ── Misc common targets ───────────────────────────────────────────────────────

export const fakeHtpasswd = [trap('htpasswd'), (req, res) => {
    res.type('text/plain').send('admin:$apr1$fake$hashedpasswordhere\n');
}];

export const fakeSshKey = [trap('ssh-private-key'), (req, res) => {
    res.type('text/plain').send(
`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xHn/ygWep4AkFWPKSm4xFvNbTNTJosoE7BfR
THISISAFAKEKEYDONOTUSE0000000000000000000000000000000000000000000
-----END RSA PRIVATE KEY-----
`);
}];

export const fakeRobotsTxt = [trap('robots-recon'), (req, res) => {
    // Real robots.txt is fine — but record that someone fetched it
    // (often the first step of automated recon)
    res.type('text/plain').send(
`User-agent: *
Disallow: /admin/
Disallow: /api/internal/
Disallow: /.env
Disallow: /backup/
Sitemap: https://botwatch.xyz/sitemap.xml
`);
}];

export const fakeServerStatus = [trap('server-status'), (req, res) => {
    res.type('text/html').send(`<html><body>
<h1>Apache Server Status</h1>
<p>Server Version: Apache/2.4.54 (Ubuntu)</p>
<p>Current Time: ${new Date().toUTCString()}</p>
<p>Total Accesses: 48291 - Total Traffic: 1.2 GB</p>
</body></html>`);
}];

