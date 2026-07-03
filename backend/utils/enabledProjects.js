import Project from '../models/Project.js';

// Learning Note: The project registry changes rarely but is read on nearly every request
// (every project-tagged query is gated by it). We cache it in-memory with a short TTL and
// also invalidate explicitly whenever an admin mutates a project.
let cache = null;
let cacheAt = 0;
const TTL_MS = 30 * 1000;

export const invalidateProjectsCache = () => {
    cache = null;
    cacheAt = 0;
};

const loadProjects = async () => {
    if (cache && (Date.now() - cacheAt < TTL_MS)) return cache;
    cache = await Project.find().lean();
    cacheAt = Date.now();
    return cache;
};

// Array of enabled project keys, e.g. ['OFFICE', 'HOUSE', ...]. Used to gate every read query.
export const getEnabledKeys = async () => {
    const projects = await loadProjects();
    return projects.filter(p => p.enabled).map(p => p.key);
};

// Build a match value for `category` / `project_category`. If a specific category is requested
// it is honoured only when enabled; otherwise ('ALL'/absent) it resolves to all enabled keys.
// Result is always a `{ $in: [...] }` clause so disabled projects can never leak.
export const buildCategoryMatch = async (requested) => {
    const enabled = await getEnabledKeys();
    if (requested && requested !== 'ALL') {
        return { $in: enabled.filter(k => k === requested) };
    }
    return { $in: enabled };
};

// Projects shaped for the sync controllers / cron: [{ id, category, name }].
// `qcOnly` returns only projects flagged for QC-record sync.
export const getSyncProjects = async ({ qcOnly = false } = {}) => {
    const projects = await loadProjects();
    return projects
        .filter(p => p.enabled && (!qcOnly || p.syncQc))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(p => ({ id: p.projectId, category: p.key, name: p.name }));
};
