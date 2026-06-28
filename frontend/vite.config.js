import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Honeypot paths that must be forwarded to Express.
// Vite handles everything else (React app, assets, HMR).
const HONEYPOT_PATHS = [
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.backup',
    '/config.php',
    '/config.yml',
    '/config.json',
    '/.git',
    '/wp-login.php',
    '/wp-admin',
    '/wp-config.php',
    '/phpinfo.php',
    '/info.php',
    '/test.php',
    '/php.php',
    '/actuator',
    '/admin',
    '/administrator',
    '/panel',
    '/cpanel',
    '/backup.sql',
    '/dump.sql',
    '/database.sql',
    '/db.sql',
    '/.aws',
    '/credentials',
    '/.ssh',
    '/.htpasswd',
    '/robots.txt',
    '/server-status',
    '/shell.php',
    '/cmd.php',
    '/c.php',
    '/webshell.php',
    '/api/v1',
];

const proxyTarget = 'http://localhost:5000';

const honeypotProxy = Object.fromEntries(
    HONEYPOT_PATHS.map(path => [
        path,
        { target: proxyTarget, changeOrigin: true },
    ])
);

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': { target: proxyTarget, changeOrigin: true },
            ...honeypotProxy,
        },
    },
})
