import express from 'express';
import { 
    getUniqueProducers, 
    getTeamMappings, 
    assignTeam, 
    removeMapping 
} from '../controllers/teamController.js';

const router = express.Router();

router.get('/producers', getUniqueProducers);
router.get('/', getTeamMappings);
router.post('/assign', assignTeam);
router.delete('/:username', removeMapping);

export default router;