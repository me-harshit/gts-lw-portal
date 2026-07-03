import express from 'express';
import { listProjects, createProject, updateProject, deleteProject } from '../controllers/projectController.js';

const router = express.Router();

// Note: access is frontend-role-gated (admin-only UI), matching the existing configRoutes pattern.
router.get('/', listProjects);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
