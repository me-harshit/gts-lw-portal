import mongoose from 'mongoose';
export default mongoose.model('Shift', new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true }));