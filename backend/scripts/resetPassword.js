/**
 * One-time password reset utility.
 * Usage:  node backend/scripts/resetPassword.js <email> <newPassword>
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from '../utilities/connectDB.js';

const [,, email, newPassword] = process.argv;

if (!email || !newPassword) {
    console.error('Usage: node backend/scripts/resetPassword.js <email> <newPassword>');
    process.exit(1);
}

const hashed = await bcrypt.hash(newPassword, 12);
const result = await query(
    'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email',
    [hashed, email.toLowerCase().trim()]
);

if (result.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
}

console.log(`Password reset for ${result.rows[0].email} (id: ${result.rows[0].id})`);
process.exit(0);
