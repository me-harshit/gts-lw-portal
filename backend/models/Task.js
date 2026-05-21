import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true },
    taskId: { type: String, required: true, index: true },
    taskName: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['OFFICE', 'HOUSE'], required: true },
    
    pulledNum: { type: Number, default: 0 },
    totalNum: { type: Number, default: 0 },
    status: { type: String, default: 'UNKNOWN' },
    
    initialData: { type: String, default: 'No initial data provided.' },
    goalData: { type: String, default: 'No goal data provided.' }
}, {
    timestamps: true
});

export default mongoose.model('Task', taskSchema);