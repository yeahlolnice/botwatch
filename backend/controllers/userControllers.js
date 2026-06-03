import { query } from "../utilities/connectDB.js";

const getAllUsers = async (req, res) => {
    try {
        const result = await query('SELECT id, username, email FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching users: ', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    } finally { 
        // Any cleanup code can go here if needed
    }
};

const getUserById = async (req, res) => {
    const userId = req.params.id;
    try {
        const result = await query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user: ', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    } finally {
        // Any cleanup code can go here if needed
    }
};

const deleteUser = async (req, res) => {

};

const updateUser = async (req, res) => {

};

const createUser = async (req, res) => {

};

export { getAllUsers, getUserById, createUser, updateUser, deleteUser };