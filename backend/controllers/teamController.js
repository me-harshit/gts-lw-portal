import TeamMap from '../models/TeamMap.js';
import TeamConfig from '../models/TeamConfig.js';
import Tag from '../models/Tag.js';
import QcRecord from '../models/AllRecords.js';

// --- TAGS ---
export const getTags = async (req, res) => {
    try {
        const tags = await Tag.find().sort({ name: 1 });
        res.json(tags);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const createTag = async (req, res) => {
    try {
        const tag = new Tag({ name: req.body.name });
        await tag.save();
        res.json(tag);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- TEAM CONFIGS ---
export const getTeamConfigs = async (req, res) => {
    try {
        const teams = await TeamConfig.find().sort({ name: 1 });
        res.json(teams);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const createTeamConfig = async (req, res) => {
    try {
        const team = new TeamConfig(req.body);
        await team.save();
        res.json(team);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- PRODUCER MAPPINGS ---
export const getUniqueProducers = async (req, res) => {
    try {
        const producers = await QcRecord.distinct('producer');
        const cleanProducers = producers.filter(p => p && p.trim() !== '');
        res.json(cleanProducers);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getTeamMappings = async (req, res) => {
    try {
        const mappings = await TeamMap.find().sort({ teamName: 1, username: 1 });
        res.json(mappings);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const assignTeam = async (req, res) => {
    const { username, teamName } = req.body;
    try {
        const updatedMapping = await TeamMap.findOneAndUpdate(
            { username: username }, 
            { teamName: teamName },
            { returnDocument: 'after', upsert: true } 
        );
        res.json(updatedMapping);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// NEW: Batch Move Multiple Producers
export const assignTeamBatch = async (req, res) => {
    const { usernames, teamName } = req.body;
    try {
        if (teamName === 'Unassigned') {
            await TeamMap.deleteMany({ username: { $in: usernames } });
        } else {
            const bulkOps = usernames.map(username => ({
                updateOne: {
                    filter: { username },
                    update: { teamName },
                    upsert: true
                }
            }));
            await TeamMap.bulkWrite(bulkOps);
        }
        res.json({ message: 'Batch updated successfully' });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const removeMapping = async (req, res) => {
    try {
        await TeamMap.findOneAndDelete({ username: req.params.username });
        res.json({ message: `Removed mapping for ${req.params.username}` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};