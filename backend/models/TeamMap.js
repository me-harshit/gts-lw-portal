import mongoose from 'mongoose';

const teamMapSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // e.g., 'vandana.yadav'
    teamName: { type: String, required: true }              // e.g., 'Pali Team'
}, {
    timestamps: true
});

export default mongoose.model('TeamMap', teamMapSchema);