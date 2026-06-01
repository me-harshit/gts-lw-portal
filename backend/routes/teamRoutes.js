import express from 'express';
import { 
    getUniqueProducers, getTeamMappings, assignTeam, assignTeamBatch, removeMapping,
    getTags, createTag, getTeamConfigs, createTeamConfig
} from '../controllers/teamController.js';

const router = express.Router();

router.get('/tags', getTags);
router.post('/tags', createTag);

router.get('/configs', getTeamConfigs);
router.post('/configs', createTeamConfig);

router.get('/producers', getUniqueProducers);
router.get('/', getTeamMappings);

router.post('/assign', assignTeam);
router.post('/assign-batch', assignTeamBatch); // NEW BATCH ROUTE
router.delete('/:username', removeMapping);

export default router;