/**
 * One-time script: hash all plaintext passwords in the users table.
 * Run once before going live, then delete or archive this file.
 *
 * Usage:  node backend/scripts/migratePasswords.js
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from '../utilities/connectDB.js';
import { migrateUsersTableQuery } from '../utilities/sqlUserQuerys.js';

const BCRYPT_ROUNDS = 12;

async function run() {
    console.log('Widening password column to VARCHAR(255)...');
    await query(migrateUsersTableQuery);
    console.log('Done.');

    const result = await query('SELECT id, password FROM users');
    const users = result.rows;
    console.log(`Found ${users.length} user(s) to process.`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
        // bcrypt hashes always start with $2b$ — skip already-hashed rows
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            console.log(`  [skip] user ${user.id} already hashed`);
            skipped++;
            continue;
        }

        const hashed = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
        await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
        console.log(`  [ok]   user ${user.id} migrated`);
        migrated++;
    }

    console.log(`\nMigration complete. Migrated: ${migrated}, Skipped: ${skipped}`);
    process.exit(0);
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
