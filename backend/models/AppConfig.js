import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    configId: { type: String, default: 'global_settings', unique: true },
    
    lightwheelToken: { type: String, default: '' },
    lightwheelUsername: { type: String, default: '' },
    lightwheelQcApi: { type: String, default: '' },
    lightwheelTaskApi: { type: String, default: '' },
    lastQcSync: { type: Date, default: null },
    lastTaskSync: { type: Date, default: null }
}, {
    timestamps: true
});

export default mongoose.model('AppConfig', appConfigSchema);