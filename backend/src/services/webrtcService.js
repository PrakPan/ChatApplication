const logger = require('../utils/logger');

const getIceServers = () => {
  return [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'stun:stun1.l.google.com:19302'
    },
    {
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    }
  ];
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