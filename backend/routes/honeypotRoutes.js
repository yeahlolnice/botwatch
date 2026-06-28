import express from 'express';
import {
    fakeEnv,
    fakeEnvLocal,
    fakeGitConfig,
    fakeGitHead,
    fakeWpLogin,
    fakeWpAdmin,
    fakeWpConfig,
    fakePhpInfo,
    fakeActuator,
    fakeActuatorEnv,
    fakeAdmin,
    fakeAdminPost,
    fakeBackupSql,
    fakeAwsCredentials,
    fakeK8sSecrets,
    fakeHtpasswd,
    fakeSshKey,
    fakeRobotsTxt,
    fakeServerStatus,
} from '../controllers/honeypotController.js';

const router = express.Router();

// Environment / config files
router.get('/.env',              ...fakeEnv);
router.get('/.env.local',        ...fakeEnvLocal);
router.get('/.env.production',   ...fakeEnvLocal);
router.get('/.env.backup',       ...fakeEnvLocal);
router.get('/config.php',        ...fakeEnv);
router.get('/config.yml',        ...fakeEnv);
router.get('/config.json',       ...fakeEnv);

// Git
router.get('/.git/config',       ...fakeGitConfig);
router.get('/.git/HEAD',         ...fakeGitHead);

// WordPress
router.get('/wp-login.php',      ...fakeWpLogin);
router.post('/wp-login.php',     ...fakeWpLogin);
router.get('/wp-admin',          ...fakeWpAdmin);
router.get('/wp-admin/',         ...fakeWpAdmin);
router.get('/wp-config.php',     ...fakeWpConfig);
router.get('/wp-config.php.bak', ...fakeWpConfig);

// PHP
router.get('/phpinfo.php',       ...fakePhpInfo);
router.get('/info.php',          ...fakePhpInfo);
router.get('/test.php',          ...fakePhpInfo);
router.get('/php.php',           ...fakePhpInfo);

// Spring Boot actuator
router.get('/actuator',          ...fakeActuator);
router.get('/actuator/health',   ...fakeActuator);
router.get('/actuator/env',      ...fakeActuatorEnv);
router.get('/actuator/beans',    ...fakeActuatorEnv);
router.get('/actuator/mappings', ...fakeActuatorEnv);

// Admin panels
router.get('/admin',             ...fakeAdmin);
router.get('/admin/',            ...fakeAdmin);
router.get('/administrator',     ...fakeAdmin);
router.get('/administrator/',    ...fakeAdmin);
router.get('/panel',             ...fakeAdmin);
router.get('/cpanel',            ...fakeAdmin);
router.post('/admin',            ...fakeAdminPost);
router.post('/admin/',           ...fakeAdminPost);
router.post('/administrator',    ...fakeAdminPost);

// Backup / database files
router.get('/backup.sql',        ...fakeBackupSql);
router.get('/dump.sql',          ...fakeBackupSql);
router.get('/database.sql',      ...fakeBackupSql);
router.get('/db.sql',            ...fakeBackupSql);

// AWS / cloud credentials
router.get('/.aws/credentials',  ...fakeAwsCredentials);
router.get('/credentials',       ...fakeAwsCredentials);

// Kubernetes
router.get('/api/v1/secrets',    ...fakeK8sSecrets);
router.get('/api/v1/namespaces/default/secrets', ...fakeK8sSecrets);

// SSH
router.get('/.ssh/id_rsa',       ...fakeSshKey);
router.get('/.ssh/id_ed25519',   ...fakeSshKey);

// Web server recon
router.get('/.htpasswd',         ...fakeHtpasswd);
router.get('/robots.txt',        ...fakeRobotsTxt);
router.get('/server-status',     ...fakeServerStatus);

// Common shell uploads / webshells
router.all('/shell.php',         ...fakePhpInfo);
router.all('/cmd.php',           ...fakePhpInfo);
router.all('/c.php',             ...fakePhpInfo);
router.all('/webshell.php',      ...fakePhpInfo);

export default router;
