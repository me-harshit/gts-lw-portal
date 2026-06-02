import TeamMap from '../models/TeamMap.js';
import TeamConfig from '../models/TeamConfig.js';
import Tag from '../models/Tag.js';
import Shift from '../models/Shift.js';
import Supervisor from '../models/Supervisor.js';
import QcRecord from '../models/AllRecords.js';

// --- METADATA (Tags, Shifts, Supervisors) ---
const buildCrud = (Model) => ({
    get: async (req, res) => res.json(await Model.find().sort({ name: 1 })),
    create: async (req, res) => res.json(await new Model({ name: req.body.name }).save()),
    delete: async (req, res) => { await Model.findByIdAndDelete(req.params.id); res.json({ success: true }); }
});

export const tagsCrud = buildCrud(Tag);
export const shiftsCrud = buildCrud(Shift);
export const supervisorsCrud = buildCrud(Supervisor);

// --- TEAM CONFIGS ---
export const getTeamConfigs = async (req, res) => {
    try { res.json(await TeamConfig.find().sort({ name: 1 })); } 
    catch (error) { res.status(500).json({ error: error.message }); }
};

export const createTeamConfig = async (req, res) => {
    try { res.json(await new TeamConfig(req.body).save()); } 
    catch (error) { res.status(500).json({ error: error.message }); }
};

export const updateTeamConfig = async (req, res) => {
    const { oldName } = req.params;
    const updates = req.body;
    try {
        const team = await TeamConfig.findOneAndUpdate({ name: oldName }, updates, { new: true });
        // If the team name was changed, update all producer mappings to match
        if (updates.name && updates.name !== oldName) {
            await TeamMap.updateMany({ teamName: oldName }, { teamName: updates.name });
        }
        res.json(team);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const deleteTeamConfig = async (req, res) => {
    const { name } = req.params;
    try {
        await TeamConfig.findOneAndDelete({ name });
        // Send all assigned producers back to 'Unassigned'
        await TeamMap.deleteMany({ teamName: name });
        res.json({ message: 'Team deleted successfully' });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- PRODUCER MAPPINGS ---
export const getUniqueProducers = async (req, res) => {
    try {
        const producers = await QcRecord.distinct('producer');
        res.json(producers.filter(p => p && p.trim() !== ''));
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const getTeamMappings = async (req, res) => {
    try { res.json(await TeamMap.find().sort({ teamName: 1, username: 1 })); } 
    catch (error) { res.status(500).json({ error: error.message }); }
};

export const assignTeam = async (req, res) => {
    try {
        const updated = await TeamMap.findOneAndUpdate(
            { username: req.body.username }, { teamName: req.body.teamName }, { returnDocument: 'after', upsert: true }
        );
        res.json(updated);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const assignTeamBatch = async (req, res) => {
    const { usernames, teamName } = req.body;
    try {
        if (teamName === 'Unassigned') {
            await TeamMap.deleteMany({ username: { $in: usernames } });
        } else {
            const bulkOps = usernames.map(username => ({
                updateOne: { filter: { username }, update: { teamName }, upsert: true }
            }));
            await TeamMap.bulkWrite(bulkOps);
        }
        res.json({ message: 'Batch updated successfully' });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

export const removeMapping = async (req, res) => {
    try {
        await TeamMap.findOneAndDelete({ username: req.params.username });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
};