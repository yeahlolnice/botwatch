import bcrypt from 'bcrypt';
import { query } from '../utilities/connectDB.js';
import {
    getAllUsersQuery,
    getUserByIdQuery,
    createUserQuery,
    updateUserQuery,
    deleteUserQuery,
    migrateUsersTableQuery,
} from '../utilities/sqlUserQuerys.js';

const BCRYPT_ROUNDS = 12;

const getAllUsers = async (req, res) => {
    try {
        const result = await query(getAllUsersQuery);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
};

const getUserById = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const result = await query(getUserByIdQuery, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
    }
};

const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await query(createUserQuery, [name, email.toLowerCase().trim(), hashed, role || 'user']);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email already in use' });
        }
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Failed to create user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, password, role } = req.body;
        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await query(updateUserQuery, [name, email.toLowerCase().trim(), hashed, role, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Failed to update user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        await query(deleteUserQuery, [userId]);
        return res.status(200).json({ message: `User #${userId} deleted` });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
};

export { getAllUsers, getUserById, createUser, updateUser, deleteUser };
