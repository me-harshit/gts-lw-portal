import TeamMap from '../models/TeamMap.js';
import QcRecord from '../models/AllRecords.js';

// 1. Get all unique producers from the raw Lightwheel data
export const getUniqueProducers = async (req, res) => {
    try {
        // .distinct() is a lightning-fast MongoDB command that returns an array of unique values
        const producers = await QcRecord.distinct('producer');
        
        // Filter out empty strings or nulls just in case Lightwheel sent bad rows
        const cleanProducers = producers.filter(p => p && p.trim() !== '');
        
        res.json(cleanProducers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Get all currently mapped teams
export const getTeamMappings = async (req, res) => {
    try {
        const mappings = await TeamMap.find().sort({ teamName: 1, username: 1 });
        res.json(mappings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Assign or Update a producer's team
export const assignTeam = async (req, res) => {
    const { username, teamName } = req.body;

    if (!username || !teamName) {
        return res.status(400).json({ error: "Username and Team Name are required." });
    }

    try {
        // FIX: Replaced { new: true } with { returnDocument: 'after' }
        const updatedMapping = await TeamMap.findOneAndUpdate(
            { username: username }, 
            { teamName: teamName },
            { returnDocument: 'after', upsert: true } 
        );

        res.json(updatedMapping);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Remove a producer from a team
export const removeMapping = async (req, res) => {
    const { username } = req.params;

    try {
        await TeamMap.findOneAndDelete({ username });
        res.json({ message: `Successfully removed mapping for ${username}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};