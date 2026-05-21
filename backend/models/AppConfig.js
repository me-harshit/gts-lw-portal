import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    configId: { type: String, default: 'global_settings', unique: true },
    
    lightwheelToken: { type: String, default: '' },
    lightwheelUsername: { type: String, default: '' },
    lightwheelQcApi: { type: String, default: 'https://data.lightwheel.net/api/humancase/v1/qc-export' },
    lightwheelTaskApi: { type: String, default: 'https://data.lightwheel.net/api/humancase/v1/human-task/list' },
    
    // We can also store the Last Global Sync timestamps here later!
    lastQcSync: { type: Date, default: null },
    lastTaskSync: { type: Date, default: null }
}, {
    timestamps: true
});

export default mongoose.model('AppConfig', appConfigSchema);