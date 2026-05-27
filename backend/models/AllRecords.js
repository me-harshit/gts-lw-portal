import mongoose from 'mongoose';

const allRecordSchema = new mongoose.Schema({
    data_name: { type: String, required: true, unique: true },
    project_category: { type: String, enum: ['OFFICE', 'HOUSE'], required: true },
    project: String,
    producer: String,
    team: String,
    internalTeam: { type: String, default: 'Unassigned' }, 
    start_produce_time: Date,
    inspect_time: Date,
    fps: Number,
    video_duration: Number,
    inspect_result: { type: String, index: true }, 
    inspect_error_type_cn: String,
    inspect_error_type_en: String,
    inspect_issue_description: String,
    inspect_issue_description_en: String,
    data_name_en: String,
    task_name: String,
    platform_task_id: String,

    // --- NEW: ANOMALY TRACKING & VAULT FIELDS ---
    is_downgraded: { type: Boolean, default: false }, // Trips to true if PASSED -> FAILED
    locked_duration: { type: Number, default: null }, // Stores duration when initially PASSED
    status_history: [{
        status: String,
        changedAt: { type: Date, default: Date.now }
    }]

}, {
    timestamps: true
});

export default mongoose.model('AllRecord', allRecordSchema);