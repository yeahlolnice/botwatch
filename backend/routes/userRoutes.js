import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/userControllers.js';

const router = express.Router();

router.post('/', createUser);
router.get('/', getAllUsers);
// router.get('/db-init', initializeDatabase);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);


export default router;