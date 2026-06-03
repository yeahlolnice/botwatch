import { query } from "../utilities/connectDB.js";
import { createUsersTableQuery, createRoleQuery, createUserQuery, updateUserQuery, deleteUserQuery, getAllUsersQuery, getUserByIdQuery } from "../utilities/sqlUserQuerys.js";

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

const deleteUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const result = await query(deleteUserQuery, [userId]);
        return res.status(200).json({ message: `User: #ID ${userId} - deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Failed to delete user' });
    }

};

const updateUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, password, role } = req.body;
        const result = await query(updateUserQuery, [name, email, password, role, userId]);
        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Failed to update user' });
    }
};

const createUser = async (req, res) => {
    try {
        // check if user table is created, if not create it
        
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = await query(createUserQuery, [name, email, password, role]);
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Failed to create user' });
    }
};

// const initializeDatabase = async (req, res) => {
//     try {
//         await query(createRoleQuery);
//         await query(createUsersTableQuery);
//         return res.status(200).json({ message: 'Users database initialized successfully' });
//     } catch (error) {
//         console.error('Error initializing database:', error);
//         return res.status(500).json({ error: 'Failed to initialize database' });
//     }
// };

export { getAllUsers, getUserById, createUser, updateUser, deleteUser };