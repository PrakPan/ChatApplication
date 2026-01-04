import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './useSocket';

const ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]
  },
  {
    urls: 'turn:13.203.182.183:3478',
    username: '557980386236',
    credential: '4Star@4911'
  },
  {
    urls: 'turn:13.203.182.183:3478?transport=tcp',
    username: '557980386236',
    credential: '4Star@4911'
  }
];

export const useWebRTC = () => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const peerConnection = useRef(null);
  const remoteUserId = useRef(null);
  const pendingIceCandidates = useRef([]);
  const currentCallId = useRef(null);
  const isProcessingCall = useRef(false);
  const isInitializing = useRef(false);
  
  // Warm-up specific refs
  const isWarmedUp = useRef(false);
  const warmUpStream = useRef(null);
  const warmUpPeerConnection = useRef(null);
  
  // Filter processing refs
  const originalStream = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animationFrameId = useRef(null);
  const currentFilter = useRef('none');

  // 🔥 WARM-UP: Pre-initialize WebRTC resources
  const warmUpConnection = useCallback(async () => {
    if (isWarmedUp.current) {
      console.log('ℹ️ WebRTC already warmed up, skipping');
      return;
    }

    try {
      console.log('🔥 Pre-warming WebRTC connection...');
      
      // 1️⃣ Initialize local media stream
      console.log('🎥 Warming up: Requesting media devices...');
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
      
      warmUpStream.current = stream;
      console.log(`✅ Warm-up: Local stream ready with ${stream.getTracks().length} tracks`);

      // 2️⃣ Create peer connection
      warmUpPeerConnection.current = new RTCPeerConnection({ 
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      
      console.log('✅ Warm-up: Peer connection created');

      // Add tracks to trigger ICE gathering
      stream.getTracks().forEach(track => {
        warmUpPeerConnection.current.addTrack(track, stream);
      });

      // 3️⃣ Create dummy offer to start ICE gathering and TURN allocation
      const offer = await warmUpPeerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: false,
      });
      
      await warmUpPeerConnection.current.setLocalDescription(offer);
      console.log('📝 Warm-up: Dummy local description set');

      // 4️⃣ Wait for ICE gathering (this pre-allocates TURN resources)
      await new Promise(resolve => {
        let candidateCount = 0;
        const timeout = setTimeout(() => {
          console.log(`⏰ Warm-up: ICE gathering timeout after ${candidateCount} candidates`);
          resolve();
        }, 3000); // Max 3 seconds for warm-up

        warmUpPeerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            candidateCount++;
            console.log(`🧊 Warm-up: Gathered ICE candidate ${candidateCount} (${event.candidate.type})`);
          } else {
            console.log(`✅ Warm-up: ICE gathering complete (${candidateCount} candidates)`);
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      isWarmedUp.current = true;
      console.log('🔥 WebRTC warm-up completed successfully!');
      
    } catch (error) {
      console.error('🔴 Error during WebRTC warm-up:', error);
      // Don't fail silently, but don't block calls either
      isWarmedUp.current = false;
    }
  }, []);

  // 🔥 Use warmed-up resources for actual call
  const reuseWarmUpResources = useCallback(() => {
    if (!isWarmedUp.current) {
      console.log('⚠️ No warm-up resources available');
      return null;
    }

    console.log('♻️ Reusing warmed-up resources for call');
    
    // Transfer the warmed-up stream
    const stream = warmUpStream.current;
    originalStream.current = stream;
    setLocalStream(stream);
    
    // Close the warm-up peer connection (we'll create a fresh one for the call)
    if (warmUpPeerConnection.current) {
      warmUpPeerConnection.current.close();
      warmUpPeerConnection.current = null;
    }
    
    return stream;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (isInitializing.current) {
      console.log('⚠️ Skipping cleanup during call initialization');
      return;
    }
    
    console.log('🧹 Performing complete cleanup');
    
    // Stop animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    // Stop original stream tracks
    if (originalStream.current) {
      originalStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log('⏹️ Stopped original track:', track.kind);
      });
      originalStream.current = null;
    }
    
    // Stop local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('⏹️ Stopped local track:', track.kind);
      });
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnection.current) {
      peerConnection.current.onicecandidate = null;
      peerConnection.current.ontrack = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.onsignalingstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
      console.log('🔌 Peer connection closed');
    }

    setRemoteStream(null);
    setCallStatus('idle');
    remoteUserId.current = null;
    currentCallId.current = null;
    pendingIceCandidates.current = [];
    currentFilter.current = 'none';
    isProcessingCall.current = false;
    
    console.log('✅ Cleanup completed');
  }, [localStream]);

  const initializePeerConnection = useCallback(() => {
    console.log('🔧 Initializing peer connection');
    
    if (peerConnection.current) {
      console.log('⚠️ Closing existing peer connection');
      peerConnection.current.close();
    }
    
    peerConnection.current = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && remoteUserId.current) {
        console.log('📤 Sending ICE candidate to:', remoteUserId.current);
        socket.emit('call:ice-candidate', {
          to: remoteUserId.current,
          candidate: event.candidate,
        });
      } else if (!event.candidate) {
        console.log('✅ ICE gathering completed');
      }
    };

    peerConnection.current.ontrack = (event) => {
      console.log('📺 Received remote track:', event.track.kind);
      setRemoteStream(event.streams[0]);
      setCallStatus('connected'); // Update status immediately when we get remote track
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('🔌 ICE Connection State:', state);
      
      if (state === 'connected' || state === 'completed') {
        setCallStatus('connected');
        console.log('✅ Call connected!');
      } else if (state === 'disconnected') {
        setCallStatus('reconnecting');
        console.log('🔄 Call reconnecting...');
      } else if (state === 'failed') {
        setCallStatus('failed');
        console.log('❌ Call failed');
        setTimeout(() => cleanup(), 1000);
      } else if (state === 'checking') {
        setCallStatus('connecting');
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState;
      console.log('🔗 Connection State:', state);
      
      if (state === 'failed' || state === 'closed') {
        cleanup();
      }
    };

    peerConnection.current.onsignalingstatechange = () => {
      const state = peerConnection.current?.signalingState;
      console.log('📡 Signaling State:', state);
    };
  }, [socket, cleanup]);

  const startLocalStream = async () => {
    try {
      // Try to reuse warmed-up stream first
      const warmedStream = reuseWarmUpResources();
      if (warmedStream) {
        console.log('✅ Using pre-warmed stream (instant!)');
        return warmedStream;
      }

      // Fallback: request new stream
      console.log('🎥 Requesting media devices...');
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

      console.log('✅ Got local stream with tracks:', 
        stream.getTracks().map(t => `${t.kind}: ${t.label}`));
      
      originalStream.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw error;
    }
  };

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

    currentFilter.current = filterCSS;

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
      console.log('🔄 Replaced video track with filtered stream');
    }
  }, []);

  const changeFilter = useCallback((filterCSS) => {
    console.log('🎨 Applying filter:', filterCSS);
    
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

 const startCall = async (hostId, callId) => {
    try {
      if (isProcessingCall.current || isInitializing.current) {
        console.log('⚠️ Already processing a call, ignoring');
        return;
      }
      
      isProcessingCall.current = true;
      isInitializing.current = true;
      
      console.log('📞 Starting call to:', hostId, 'callId:', callId);
      console.log('🆔 My socket ID:', socket?.id);
      
      const stream = await startLocalStream();
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('➕ Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      console.log('📝 Creating offer...');
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.current.setLocalDescription(offer);
      console.log('✅ Local description set (offer)');

      remoteUserId.current = hostId;
      currentCallId.current = callId;
      
      console.log('📤 Emitting call:offer to:', hostId);
      socket.emit('call:offer', { to: hostId, offer, callId });
      
      setCallStatus('calling');
      
      // Faster initialization complete
      setTimeout(() => {
        isInitializing.current = false;
        console.log('✅ Call initialization complete');
      }, 300); // Reduced from 1000ms
      
    } catch (error) {
      console.error('❌ Error starting call:', error);
      isProcessingCall.current = false;
      isInitializing.current = false;
      cleanup();
      throw error;
    }
  };

  const acceptCall = async (from, offer, callId) => {
    try {
      if (isProcessingCall.current || isInitializing.current) {
        console.log('⚠️ Already processing a call, ignoring');
        return;
      }
      
      isProcessingCall.current = true;
      isInitializing.current = true;
      
      console.log('📲 Accepting call from:', from, 'callId:', callId);
      
      const stream = await startLocalStream();
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('➕ Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      console.log('📝 Setting remote description (offer)...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set');

      // Process pending ICE candidates
      console.log('Processing', pendingIceCandidates.current.length, 'pending ICE candidates');
      for (const candidate of pendingIceCandidates.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      }
      pendingIceCandidates.current = [];

      console.log('📝 Creating answer...');
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      console.log('✅ Local description set (answer)');

      remoteUserId.current = from;
      currentCallId.current = callId;
      
      console.log('📤 Emitting call:answer to:', from);
      socket.emit('call:answer', { to: from, answer });
      
      // setCallStatus('connecting');
      
      setTimeout(() => {
        isInitializing.current = false;
        isProcessingCall.current = false;
        console.log('✅ Accept call complete');
      }, 300);
      
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      isProcessingCall.current = false;
      isInitializing.current = false;
      cleanup();
      throw error;
    }
  };

  const handleAnswer = async (answer) => {
    try {
      console.log('📥 Received answer');
      setCallStatus('accepted');
      
      if (!peerConnection.current) {
        console.warn('⚠️ No peer connection to handle answer');
        return;
      }
      
      console.log('📝 Setting remote description (answer)...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote description set');
      
      // Process pending ICE candidates
      console.log('Processing', pendingIceCandidates.current.length, 'pending ICE candidates');
      for (const candidate of pendingIceCandidates.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      }
      pendingIceCandidates.current = [];
      
      // setCallStatus('connecting');
      isProcessingCall.current = false;
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      isProcessingCall.current = false;
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      console.log('📥 Received ICE candidate');
      
      if (!peerConnection.current) {
        console.warn('⚠️ Peer connection not initialized, ignoring candidate');
        return;
      }

      const remoteDesc = peerConnection.current.remoteDescription;
      
      if (!remoteDesc) {
        console.log('⏳ Remote description not set yet, queuing candidate');
        pendingIceCandidates.current.push(candidate);
        return;
      }

      console.log('➕ Adding ICE candidate');
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  };

const endCall = useCallback(() => {
  console.log('☎️ Ending call');
  
  if (remoteUserId.current && currentCallId.current && socket) {
    console.log('📤 Emitting call:end to:', remoteUserId.current);
    socket.emit('call:end', { 
      to: remoteUserId.current,
      callId: currentCallId.current,
      endedBy: 'user' // NEW: Add this to identify who ended the call
    });
  }
  
  cleanup();
  
  // Re-warm up after call ends for next call
  setTimeout(() => {
    console.log('🔄 Re-warming WebRTC for next call...');
    isWarmedUp.current = false;
    warmUpConnection();
  }, 2000);
}, [socket, cleanup, warmUpConnection]);

  const rejectCall = useCallback((from, callId, reason = 'User declined') => {
    console.log('❌ Rejecting call from:', from);
    if (socket) {
      socket.emit('call:reject', { to: from, callId, reason });
    }
    cleanup();
  }, [socket, cleanup]);

  const toggleAudio = () => {
    const stream = originalStream.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('🎤 Audio:', audioTrack.enabled ? 'enabled' : 'disabled');
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
        console.log('📹 Video:', videoTrack.enabled ? 'enabled' : 'disabled');
        return videoTrack.enabled;
      }
    }
    return false;
  };

  // Socket listeners
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ Socket not available');
      return;
    }

    console.log('👂 Setting up WebRTC socket listeners');
    console.log('🆔 My socket ID:', socket.id);

    const handleAnswerReceived = ({ from, answer }) => {
      console.log('📞 ✅ Received call:answer from:', from);
      handleAnswer(answer);
    };

    const handleIceCandidateReceived = ({ from, candidate }) => {
      console.log('📞 ✅ Received call:ice-candidate from:', from);
      handleIceCandidate(candidate);
    };

    const handleCallEnded = ({ from, callId }) => {
      console.log('📞 ✅ Received call:ended from:', from);
      endCall();
    };

    const handleCallRejected = ({ from, callId, reason }) => {
      console.log('📞 ❌ Call rejected by:', from, 'reason:', reason);
      cleanup();
    };

    const handleCallError = ({ message }) => {
      console.error('📞 ❌ Call error:', message);
      cleanup();
    };

    // Register listeners
    socket.on('call:answer', handleAnswerReceived);
    socket.on('call:ice-candidate', handleIceCandidateReceived);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:error', handleCallError);

    // Cleanup function
    return () => {
      if (!isInitializing.current) {
        console.log('🧹 Cleaning up WebRTC socket listeners');
        socket.off('call:answer', handleAnswerReceived);
        socket.off('call:ice-candidate', handleIceCandidateReceived);
        socket.off('call:ended', handleCallEnded);
        socket.off('call:rejected', handleCallRejected);
        socket.off('call:error', handleCallError);
      } else {
        console.log('⏭️ Skipping socket cleanup - call is initializing');
      }
    };
  }, [socket, endCall, cleanup]);

  // 🔥 AUTO WARM-UP: Warm up WebRTC when component mounts
  useEffect(() => {
    console.log('🚀 useWebRTC mounted, starting auto warm-up...');
    warmUpConnection();
    
    return () => {
      if (!isInitializing.current) {
        console.log('🧹 Component unmounting, cleaning up WebRTC');
        cleanup();
        
        // Clean up warm-up resources
        if (warmUpStream.current) {
          warmUpStream.current.getTracks().forEach(track => track.stop());
          warmUpStream.current = null;
        }
        if (warmUpPeerConnection.current) {
          warmUpPeerConnection.current.close();
          warmUpPeerConnection.current = null;
        }
      }
    };
  }, [warmUpConnection, cleanup]);

  return {
    localStream,
    remoteStream,
    callStatus,
    startCall,
    acceptCall,
    endCall,
    rejectCall,
    toggleAudio,
    toggleVideo,
    canvasRef,
    videoRef,
    warmUpConnection, 
  };
};