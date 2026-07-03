import Project from '../models/Project.js';

// The 6 projects that must always exist. Seeded keys MUST match existing data
// (OFFICE/HOUSE/GYM) so historical Task / QC records keep displaying.
const SEED = [
    { key: 'OFFICE',     name: 'Office',             projectId: '64469240-0c5d-471e-9008-9ccbf03672a3', icon: 'Building2', syncQc: true,  order: 1 },
    { key: 'HOUSE',      name: 'House',              projectId: '730284cd-4b8b-4975-a8bd-28df1e7aaa06', icon: 'Home',      syncQc: true,  order: 2 },
    { key: 'GYM',        name: 'Gym',                projectId: 'd5490d37-77dc-4f6a-8f41-791e7268fbc4', icon: 'Dumbbell',  syncQc: false, order: 3 },
    { key: 'RESTAURANT', name: 'Restaurant',         projectId: 'f81e5d71-373e-4c68-b9a4-32c80f91c23f', icon: 'Utensils',  syncQc: false, order: 4 },
    { key: 'BAKERY',     name: 'Bakery',             projectId: '9feaf0f6-f547-4e57-935c-e2a82c3dbb71', icon: 'Croissant', syncQc: false, order: 5 },
    { key: 'FURNITURE',  name: 'Furniture Showroom', projectId: 'a59abd2a-53b3-41c4-b6d1-f54ee92c2978', icon: 'Sofa',      syncQc: false, order: 6 }
];

// Idempotent + non-destructive: only inserts missing projects. $setOnInsert means re-running
// never clobbers admin edits (e.g. a changed icon or a disabled toggle) on projects that exist.
export const seedProjects = async () => {
    try {
        for (const p of SEED) {
            await Project.updateOne({ key: p.key }, { $setOnInsert: p }, { upsert: true });
        }
        console.log('✅ [Seed] Project registry ensured (6 base projects).');
    } catch (err) {
        console.error('[Seed] Failed to seed projects:', err.message);
    }
};
