const express = require('express');
const router = express.Router();
const {
  initiateCall,
  acceptCall,
  endCall,
  rateCall,
  getCallHistory,
  getCallDetails
} = require('../controllers/callController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const validators = require('../utils/validators');
const { callLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);

router.post('/initiate', callLimiter, validate(validators.initiateCall), initiateCall);
router.post('/accept', authorize('host', 'admin','coinSeller'), acceptCall);
router.post('/end', validate(validators.endCall), endCall);
router.post('/rate', validate(validators.rateCall), rateCall);
router.get('/history', getCallHistory);
router.get('/:callId', getCallDetails);


module.exports = router;