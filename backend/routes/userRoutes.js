import express from 'express';
import { getUsers, createUser, updateUserRole, deleteUser } from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;