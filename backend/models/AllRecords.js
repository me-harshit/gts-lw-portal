import mongoose from 'mongoose';

// Renamed the variable to match your new naming convention
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
    platform_task_id: String
}, {
    timestamps: true
});

export default mongoose.model('AllRecord', allRecordSchema);