import express from 'express';
import { 
    getUniqueProducers, getTeamMappings, assignTeam, assignTeamBatch, removeMapping,
    getTeamConfigs, createTeamConfig, updateTeamConfig, deleteTeamConfig,
    tagsCrud, shiftsCrud, supervisorsCrud
} from '../controllers/teamController.js';

const router = express.Router();

// Metadata
router.get('/tags', tagsCrud.get); router.post('/tags', tagsCrud.create); router.delete('/tags/:id', tagsCrud.delete);
router.get('/shifts', shiftsCrud.get); router.post('/shifts', shiftsCrud.create); router.delete('/shifts/:id', shiftsCrud.delete);
router.get('/supervisors', supervisorsCrud.get); router.post('/supervisors', supervisorsCrud.create); router.delete('/supervisors/:id', supervisorsCrud.delete);

// Team Configs
router.get('/configs', getTeamConfigs);
router.post('/configs', createTeamConfig);
router.put('/configs/:oldName', updateTeamConfig);
router.delete('/configs/:name', deleteTeamConfig);

// Mappings
router.get('/producers', getUniqueProducers);
router.get('/', getTeamMappings);
router.post('/assign', assignTeam);
router.post('/assign-batch', assignTeamBatch);
router.delete('/:username', removeMapping);

export default router;