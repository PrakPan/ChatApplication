const logger = require('../utils/logger');

const getIceServers = () => {
  const servers = [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: process.env.METERED_API_KEY,
      credential: process.env.METERED_API_KEY
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: process.env.METERED_API_KEY,
      credential: process.env.METERED_API_KEY
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: process.env.METERED_API_KEY,
      credential: process.env.METERED_API_KEY
    }
  ];
  
  logger.info('ICE Servers configured:', servers);
  logger.info('METERED_API_KEY exists:', !!process.env.METERED_API_KEY);
  
  return servers;
};

const validateSdp = (sdp) => {
  if (!sdp || typeof sdp !== 'object') {
    return false;
  }

  if (!sdp.type || !sdp.sdp) {
    return false;
  }

  if (!['offer', 'answer'].includes(sdp.type)) {
    return false;
  }

  return true;
};

const validateIceCandidate = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  return true;
};

module.exports = {
  getIceServers,
  validateSdp,
  validateIceCandidate
};