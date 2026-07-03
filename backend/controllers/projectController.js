import Project from '../models/Project.js';
import { invalidateProjectsCache } from '../utils/enabledProjects.js';

// "Furniture Showroom" -> "FURNITURE_SHOWROOM"
const slugifyKey = (name) =>
    (name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// GET /api/projects  — full list (admin table + frontend useProjects hook)
export const listProjects = async (req, res) => {
    try {
        const projects = await Project.find().sort({ order: 1, createdAt: 1 }).lean();
        res.json(projects);
    } catch (error) {
        console.error('List projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

// POST /api/projects
export const createProject = async (req, res) => {
    try {
        const { name, projectId, icon, syncQc, enabled } = req.body;
        if (!name || !name.trim() || !projectId || !projectId.trim()) {
            return res.status(400).json({ error: 'Project name and Lightwheel ID are required.' });
        }

        // Generate a unique, stable key from the name.
        let base = slugifyKey(name);
        if (!base) return res.status(400).json({ error: 'Project name must contain letters or numbers.' });
        let key = base;
        let i = 2;
        while (await Project.findOne({ key })) { key = `${base}_${i}`; i++; }

        const dupeId = await Project.findOne({ projectId: projectId.trim() });
        if (dupeId) return res.status(409).json({ error: 'A project with this Lightwheel ID already exists.' });

        const last = await Project.findOne().sort({ order: -1 }).select('order').lean();

        const project = await Project.create({
            key,
            name: name.trim(),
            projectId: projectId.trim(),
            icon: icon || 'FolderKanban',
            syncQc: !!syncQc,
            enabled: enabled === undefined ? true : !!enabled,
            order: (last?.order || 0) + 1
        });

        invalidateProjectsCache();
        res.status(201).json(project);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

// PUT /api/projects/:id  — note: `key` is immutable (it ties to already-stored records)
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, projectId, icon, syncQc, enabled, order } = req.body;

        const update = {};
        if (name !== undefined) update.name = String(name).trim();
        if (projectId !== undefined) update.projectId = String(projectId).trim();
        if (icon !== undefined) update.icon = icon;
        if (syncQc !== undefined) update.syncQc = !!syncQc;
        if (enabled !== undefined) update.enabled = !!enabled;
        if (order !== undefined) update.order = Number(order);

        if (update.projectId) {
            const dupe = await Project.findOne({ projectId: update.projectId, _id: { $ne: id } });
            if (dupe) return res.status(409).json({ error: 'Another project already uses this Lightwheel ID.' });
        }

        const project = await Project.findByIdAndUpdate(id, { $set: update }, { new: true });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        invalidateProjectsCache();
        res.json(project);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
};

// DELETE /api/projects/:id
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        invalidateProjectsCache();
        res.json({ message: 'Project deleted', project });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};
