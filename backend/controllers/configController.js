import AppConfig from '../models/AppConfig.js';

// Get the global configuration
export const getConfig = async (req, res) => {
    try {
        let config = await AppConfig.findOne({ configId: 'global_settings' });
        
        // If it doesn't exist yet, create a default one
        if (!config) {
            config = await AppConfig.create({});
        }
        
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
};

// Update the global configuration (Token, Username, APIs)
export const updateConfig = async (req, res) => {
    try {
        const { lightwheelToken, lightwheelUsername, lightwheelQcApi, lightwheelTaskApi } = req.body;

        const config = await AppConfig.findOneAndUpdate(
            { configId: 'global_settings' },
            { 
                $set: { 
                    lightwheelToken, 
                    lightwheelUsername, 
                    lightwheelQcApi, 
                    lightwheelTaskApi 
                } 
            },
            { returnDocument: 'after', upsert: true }
        );

        res.json({ message: 'Settings updated successfully', config });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update configuration' });
    }
};