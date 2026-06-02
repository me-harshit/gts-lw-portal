import mongoose from 'mongoose';
export default mongoose.model('Supervisor', new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true }));