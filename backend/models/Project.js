import mongoose from 'mongoose';

// Learning Note: This collection is the single source of truth for "task lists" (projects).
// Every Task / QC record is tagged with a project `key`; enabling/disabling a project here
// controls whether its data is visible and synced anywhere on the platform.
const projectSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, uppercase: true, trim: true }, // stored on Task.category / AllRecords.project_category
    name: { type: String, required: true, trim: true },                                // display name
    projectId: { type: String, required: true, unique: true, trim: true },             // Lightwheel project UUID
    icon: { type: String, default: 'FolderKanban' },                                   // lucide icon name (see frontend projectIcons)
    syncQc: { type: Boolean, default: false },                                         // include in QC-record sync
    enabled: { type: Boolean, default: true },                                         // disabled => invisible & not synced
    order: { type: Number, default: 0 }                                                // display order
}, {
    timestamps: true
});

export default mongoose.model('Project', projectSchema);
