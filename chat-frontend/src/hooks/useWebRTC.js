// hooks/useWebRTC.js
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './useSocket';
import api from '../services/api';

export const useWebRTC = () => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  
  // WebRTC refs
  const peerConnection = useRef(null);
  const signalingClient = useRef(null);
  const remoteUserId = useRef(null);
  const currentCallId = useRef(null);
  const isProcessingCall = useRef(false);
  const isInitializing = useRef(false);
  const currentRole = useRef(null);
  const useKinesis = useRef(false);
  const pendingIceCandidates = useRef([]);
  
  // Stream refs
  const originalStream = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animationFrameId = useRef(null);
  const currentFilter = useRef('none');

  // ICE servers
  const iceServers = useRef([]);

  // Load Kinesis SDK (optional)
  const loadKinesisSDK = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.KVSWebRTC) {
        resolve(window.KVSWebRTC);
        return;
      }

      const checkInterval = setInterval(() => {
        if (window.KVSWebRTC) {
          clearInterval(checkInterval);
          resolve(window.KVSWebRTC);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Kinesis SDK not available'));
      }, 5000);
    });
  }, []);
  

  // Initialize signaling (Kinesis or Socket-based)
  const initializeSignaling = async (callId, role) => {
    try {
      console.log('🔧 Getting signaling credentials');
      
      const response = await api.post('/calls/signaling-credentials', {
        callId,
        role
      });

      const { channelArn, endpoints, iceServers: servers, useKinesis: shouldUseKinesis } = response.data;
      
      // Format ICE servers
      iceServers.current = servers.map(server => ({
        urls: server.Uris || server.urls,
        username: server.Username || server.username,
        credential: server.Password || server.credential,
      }));
      
      console.log('🧊 Got ICE servers:', iceServers.current.length);
      useKinesis.current = shouldUseKinesis;

      if (shouldUseKinesis && channelArn) {
        // Try to use Kinesis signaling
        try {
          console.log('📡 Attempting AWS Kinesis signaling');
          const KVS = await loadKinesisSDK();

          const wssEndpoint = endpoints.find(e => e.Protocol === 'WSS');
          if (!wssEndpoint) {
            throw new Error('WSS endpoint not found');
          }

          signalingClient.current = new KVS.SignalingClient({
            channelARN: channelArn,
            channelEndpoint: wssEndpoint.ResourceEndpoint,
            role: role,
            region: import.meta.env.VITE_AWS_REGION || 'ap-south-1',
            clientId: role === 'VIEWER' ? socket.id : undefined,
            systemClockOffset: 0,
          });

          setupKinesisListeners(role);
          signalingClient.current.open();
          console.log('✅ Kinesis signaling ready');
        } catch (error) {
          console.warn('⚠️ Kinesis failed, falling back to Socket.io:', error);
          useKinesis.current = false;
          setupSocketListeners();
        }
      } else {
        // Use socket-based signaling
        console.log('📡 Using Socket.io signaling');
        setupSocketListeners();
      }

      return true;
    } catch (error) {
      console.error('❌ Signaling init failed:', error);
      throw error;
    }
  };

  // Kinesis signaling listeners
  const setupKinesisListeners = (role) => {
    const client = signalingClient.current;

    client.on('sdpOffer', async (offer, remoteClientId) => {
      console.log('📥 [Kinesis] SDP offer');
      
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        client.sendSdpAnswer(peerConnection.current.localDescription, remoteClientId);
        setCallStatus('connecting');
      } catch (error) {
        console.error('❌ Error handling offer:', error);
      }
    });

    client.on('sdpAnswer', async (answer) => {
      console.log('📥 [Kinesis] SDP answer');
      
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connecting');
      } catch (error) {
        console.error('❌ Error handling answer:', error);
      }
    });

    client.on('iceCandidate', async (candidate) => {
      console.log('📥 [Kinesis] ICE candidate');
      
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('❌ Error adding candidate:', error);
      }
    });

    client.on('open', () => console.log('✅ Kinesis connection open'));
    client.on('close', () => console.log('🔌 Kinesis connection closed'));
    client.on('error', (error) => console.error('❌ Kinesis error:', error));
  };

  // Socket-based signaling listeners
  const setupSocketListeners = () => {
    if (!socket) {
      console.warn('⚠️ Socket not available for signaling');
      return;
    }

    console.log('👂 Setting up socket signaling listeners');
    
    // Remove existing listeners to avoid duplicates
    socket.off('call:answer', handleAnswer);
    socket.off('call:ice-candidate', handleIceCandidate);
    
    // Add new listeners
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
  };

  const handleAnswer = async ({ answer }) => {
    try {
      console.log('📥 [Socket] Received answer');
      setCallStatus('accepted');
      
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Process pending ICE candidates
      for (const candidate of pendingIceCandidates.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      }
      pendingIceCandidates.current = [];
      
      isProcessingCall.current = false;
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    try {
      console.log('📥 [Socket] ICE candidate');
      
      if (!peerConnection.current?.remoteDescription) {
        pendingIceCandidates.current.push(candidate);
        return;
      }

      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('❌ Error adding candidate:', error);
    }
  };

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    console.log('🔧 Initializing peer connection');
    
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    peerConnection.current = new RTCPeerConnection({
      iceServers: iceServers.current,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📤 Sending ICE candidate');
        
        if (useKinesis.current && signalingClient.current) {
          signalingClient.current.sendIceCandidate(event.candidate);
        } else if (socket && remoteUserId.current) {
          socket.emit('call:ice-candidate', {
            to: remoteUserId.current,
            candidate: event.candidate,
          });
        }
      }
    };

    peerConnection.current.ontrack = (event) => {
      console.log('📺 Received remote track');
      setRemoteStream(event.streams[0]);
      setCallStatus('connected');
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('🔌 ICE State:', state);
      
      if (state === 'connected' || state === 'completed') {
        setCallStatus('connected');
      } else if (state === 'disconnected') {
        setCallStatus('reconnecting');
      } else if (state === 'failed') {
        setCallStatus('failed');
        setTimeout(() => cleanup(), 1000);
      }
    };
  }, [socket]);

  // Start local stream
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      originalStream.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media:', error);
      throw error;
    }
  };

  // Start call (USER = VIEWER)
  const startCall = async (hostId, callId) => {
    try {
      if (isProcessingCall.current || isInitializing.current) {
        return;
      }
      
      isProcessingCall.current = true;
      isInitializing.current = true;
      currentRole.current = 'VIEWER';
      
      console.log('📞 Starting call');
      
      const stream = await startLocalStream();
      await initializeSignaling(callId, 'VIEWER');
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      remoteUserId.current = hostId;
      currentCallId.current = callId;
      
      // Create and send offer
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.current.setLocalDescription(offer);

      if (useKinesis.current && signalingClient.current) {
        // Send via Kinesis (VIEWER waits for MASTER's offer in Kinesis model)
        console.log('⏳ Waiting for MASTER offer via Kinesis');
      } else {
        // Send via Socket
        if (!socket) {
          throw new Error('Socket not connected');
        }
        
        console.log('📤 Sending offer via Socket.io to:', hostId);
        socket.emit('call:offer', { 
          to: hostId, 
          offer, 
          callId 
        });
      }
      
      setCallStatus('calling');
      
      setTimeout(() => {
        isInitializing.current = false;
      }, 300);
      
    } catch (error) {
      console.error('❌ Error starting call:', error);
      isProcessingCall.current = false;
      isInitializing.current = false;
      cleanup();
      throw error;
    }
  };

  // Accept call (HOST = MASTER)
  const acceptCall = async (from, offer, callId) => {
    try {
      if (isProcessingCall.current || isInitializing.current) {
        return;
      }
      
      isProcessingCall.current = true;
      isInitializing.current = true;
      currentRole.current = 'MASTER';
      
      console.log('📲 Accepting call');
      
      const stream = await startLocalStream();
      await initializeSignaling(callId, 'MASTER');
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      remoteUserId.current = from;
      currentCallId.current = callId;

      if (useKinesis.current && signalingClient.current) {
        // Kinesis: MASTER sends offer
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const rtcOffer = await peerConnection.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peerConnection.current.setLocalDescription(rtcOffer);
        signalingClient.current.sendSdpOffer(peerConnection.current.localDescription);
        console.log('📤 Sent offer as MASTER');
      } else {
        // Socket: Set remote description and create answer
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        
        if (socket) {
          socket.emit('call:answer', { to: from, answer });
          console.log('📤 Sent answer via socket');
        }
      }
      
      setCallStatus('connecting');
      
      setTimeout(() => {
        isInitializing.current = false;
        isProcessingCall.current = false;
      }, 300);
      
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      isProcessingCall.current = false;
      isInitializing.current = false;
      cleanup();
      throw error;
    }
  };

  // Cleanup
  const cleanup = useCallback(() => {
    if (isInitializing.current) {
      return;
    }
    
    console.log('🧹 Cleaning up');
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    if (originalStream.current) {
      originalStream.current.getTracks().forEach(track => track.stop());
      originalStream.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (signalingClient.current) {
      try {
        signalingClient.current.close();
      } catch (e) {}
      signalingClient.current = null;
    }

    setRemoteStream(null);
    setCallStatus('idle');
    remoteUserId.current = null;
    currentCallId.current = null;
    currentRole.current = null;
    isProcessingCall.current = false;
    pendingIceCandidates.current = [];
    
    console.log('✅ Cleanup complete');
  }, [localStream]);

  // End call
  const endCall = useCallback(() => {
    console.log('☎️ Ending call');
    
    if (remoteUserId.current && currentCallId.current && socket) {
      socket.emit('call:end', { 
        to: remoteUserId.current,
        callId: currentCallId.current,
        endedBy: currentRole.current === 'MASTER' ? 'host' : 'user'
      });
    }
    
    cleanup();
  }, [socket, cleanup]);

  // Toggle controls
  const toggleAudio = () => {
    const stream = originalStream.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  };

  const toggleVideo = () => {
    const stream = originalStream.current || localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  };

  // Filter functions
  const applyFilterToStream = useCallback((filterCSS) => {
    if (!originalStream.current || !canvasRef.current || !videoRef.current) {
      return originalStream.current;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    video.srcObject = originalStream.current;
    video.play();

    canvas.width = 1280;
    canvas.height = 720;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.filter = filterCSS;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      animationFrameId.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    const filteredStream = canvas.captureStream(30);
    const audioTracks = originalStream.current.getAudioTracks();
    audioTracks.forEach(track => filteredStream.addTrack(track));

    return filteredStream;
  }, []);

  const updateVideoTrack = useCallback((newStream) => {
    if (!peerConnection.current) return;

    const senders = peerConnection.current.getSenders();
    const videoSender = senders.find(sender => sender.track?.kind === 'video');
    
    if (videoSender) {
      const newVideoTrack = newStream.getVideoTracks()[0];
      videoSender.replaceTrack(newVideoTrack);
    }
  }, []);

  const changeFilter = useCallback((filterCSS) => {
    if (filterCSS === 'none') {
      if (originalStream.current && peerConnection.current) {
        updateVideoTrack(originalStream.current);
        setLocalStream(originalStream.current);
        
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      }
    } else {
      const filteredStream = applyFilterToStream(filterCSS);
      if (filteredStream) {
        updateVideoTrack(filteredStream);
        setLocalStream(filteredStream);
      }
    }
  }, [applyFilterToStream, updateVideoTrack]);

  // Socket listeners for call end
  useEffect(() => {
    if (!socket) return;

    const handleCallEnded = () => {
      console.log('📞 Call ended by remote');
      cleanup();
    };

    socket.on('call:ended', handleCallEnded);

    return () => {
      if (!isInitializing.current) {
        socket.off('call:ended', handleCallEnded);
        socket.off('call:answer', handleAnswer);
        socket.off('call:ice-candidate', handleIceCandidate);
      }
    };
  }, [socket, cleanup]);

  return {
    localStream,
    remoteStream,
    callStatus,
    startCall,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo,
    changeFilter,
    canvasRef,
    videoRef,
  };
};