import mongoose from 'mongoose';

const teamConfigSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    tag: { type: String, required: true },
    location: { type: String, required: true },
    timingSlot: { type: String, required: true },
    supervisor: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('TeamConfig', teamConfigSchema);