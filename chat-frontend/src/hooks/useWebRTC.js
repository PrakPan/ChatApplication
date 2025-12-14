import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './useSocket';

const ICE_SERVERS = [
  {
    urls: 'stun:stun.l.google.com:19302'
  },
  {
    urls: 'stun:13.203.182.183:3478'
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
  
  // New refs for filter processing
  const originalStream = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const animationFrameId = useRef(null);
  const currentFilter = useRef('none');

  const initializePeerConnection = useCallback(() => {
    console.log('🔧 Initializing peer connection');
    peerConnection.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
    };

    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log('🔌 ICE Connection State:', state);
      
      if (state === 'connected' || state === 'completed') {
        setCallStatus('connected');
        console.log('✅ Call connected!');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('disconnected');
        console.log('❌ Call disconnected/failed');
      } else if (state === 'checking') {
        setCallStatus('connecting');
      }
    };

    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current?.connectionState;
      console.log('🔗 Connection State:', state);
    };

    peerConnection.current.onsignalingstatechange = () => {
      const state = peerConnection.current?.signalingState;
      console.log('📡 Signaling State:', state);
    };
  }, [socket]);

  const startLocalStream = async () => {
    try {
      console.log('🎥 Requesting media devices...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
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

  // Apply filter to video stream
  const applyFilterToStream = useCallback((filterCSS) => {
    if (!originalStream.current || !canvasRef.current || !videoRef.current) {
      return originalStream.current;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Set video source
    video.srcObject = originalStream.current;
    video.play();

    // Set canvas size to match video
    canvas.width = 1280;
    canvas.height = 720;

    // Store current filter
    currentFilter.current = filterCSS;

    // Stop previous animation if exists
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    const processFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Apply CSS filter to context
        ctx.filter = filterCSS;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      animationFrameId.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    // Create new stream from canvas
    const filteredStream = canvas.captureStream(30);
    
    // Add audio from original stream
    const audioTracks = originalStream.current.getAudioTracks();
    audioTracks.forEach(track => filteredStream.addTrack(track));

    return filteredStream;
  }, []);

  // Update video track in peer connection
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

  // Method to change filter
  const changeFilter = useCallback((filterCSS) => {
    console.log('🎨 Applying filter:', filterCSS);
    
    if (filterCSS === 'none') {
      // Revert to original stream
      if (originalStream.current && peerConnection.current) {
        updateVideoTrack(originalStream.current);
        setLocalStream(originalStream.current);
        
        // Stop animation
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      }
    } else {
      // Apply filter
      const filteredStream = applyFilterToStream(filterCSS);
      if (filteredStream) {
        updateVideoTrack(filteredStream);
        setLocalStream(filteredStream);
      }
    }
  }, [applyFilterToStream, updateVideoTrack]);

  const startCall = async (hostId, callId) => {
    try {
      console.log('📞 Starting call to:', hostId, 'callId:', callId);
      console.log('🆔 My socket ID:', socket?.id);
      
      const stream = await startLocalStream();
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('➕ Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      console.log('📝 Creating offer...');
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      console.log('✅ Local description set (offer)');

      remoteUserId.current = hostId;
      currentCallId.current = callId;
      
      console.log('📤 Emitting call:offer to:', hostId);
      socket.emit('call:offer', { to: hostId, offer, callId });
      
      setCallStatus('calling');
    } catch (error) {
      console.error('❌ Error starting call:', error);
      throw error;
    }
  };

  const acceptCall = async (from, offer, callId) => {
    try {
      console.log('📲 Accepting call from:', from, 'callId:', callId);
      console.log('📥 Received offer:', offer);
      
      const stream = await startLocalStream();
      initializePeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('➕ Adding track to peer connection:', track.kind);
        peerConnection.current.addTrack(track, stream);
      });

      console.log('📝 Setting remote description (offer)...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set');

      // Process any pending ICE candidates
      console.log('Processing', pendingIceCandidates.current.length, 'pending ICE candidates');
      for (const candidate of pendingIceCandidates.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
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
      
      setCallStatus('connecting');
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      throw error;
    }
  };

  const handleAnswer = async (answer) => {
    try {
      console.log('📥 Received answer');
      console.log('📝 Setting remote description (answer)...');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote description set');
      
      // Process any pending ICE candidates
      console.log('Processing', pendingIceCandidates.current.length, 'pending ICE candidates');
      for (const candidate of pendingIceCandidates.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceCandidates.current = [];
      
      setCallStatus('connecting');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
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

  const endCall = () => {
    console.log('☎️ Ending call');
    
    // Stop animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    if (originalStream.current) {
      originalStream.current.getTracks().forEach((track) => {
        track.stop();
        console.log('⏹️ Stopped original track:', track.kind);
      });
      originalStream.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('⏹️ Stopped track:', track.kind);
      });
      setLocalStream(null);
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
      console.log('🔌 Peer connection closed');
    }

    if (remoteUserId.current && currentCallId.current) {
      console.log('📤 Emitting call:end to:', remoteUserId.current);
      socket.emit('call:end', { 
        to: remoteUserId.current,
        callId: currentCallId.current 
      });
    }

    setRemoteStream(null);
    setCallStatus('idle');
    remoteUserId.current = null;
    currentCallId.current = null;
    pendingIceCandidates.current = [];
    currentFilter.current = 'none';
  };

  const rejectCall = (from, callId, reason = 'User declined') => {
    console.log('❌ Rejecting call from:', from);
    socket.emit('call:reject', { to: from, callId, reason });
    endCall();
  };

  const toggleAudio = () => {
    const stream = originalStream.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      console.log('🎤 Audio:', audioTrack.enabled ? 'enabled' : 'disabled');
      return audioTrack.enabled;
    }
    return false;
  };

  const toggleVideo = () => {
    const stream = originalStream.current || localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      console.log('📹 Video:', videoTrack.enabled ? 'enabled' : 'disabled');
      return videoTrack.enabled;
    }
    return false;
  };

  useEffect(() => {
    if (!socket) {
      console.log('⚠️ Socket not available');
      return;
    }

    console.log('👂 Setting up socket listeners');
    console.log('🆔 My socket ID:', socket.id);

    // Log all socket events for debugging
    const anyHandler = (eventName, ...args) => {
      console.log('📨 Received socket event:', eventName, args);
    };
    socket.onAny(anyHandler);

    // Handle incoming call offer
    socket.on('call:offer', ({ from, offer, callId, caller }) => {
      console.log('📞 ✅ Received call:offer from:', from, 'caller:', caller?.name, 'callId:', callId);
      acceptCall(from, offer, callId);
    });

    // Handle call answer
    socket.on('call:answer', ({ from, answer }) => {
      console.log('📞 ✅ Received call:answer from:', from);
      handleAnswer(answer);
    });

    // Handle ICE candidates
    socket.on('call:ice-candidate', ({ from, candidate }) => {
      console.log('📞 ✅ Received call:ice-candidate from:', from);
      handleIceCandidate(candidate);
    });

    // Handle call ended
    socket.on('call:ended', ({ from, callId }) => {
      console.log('📞 ✅ Received call:ended from:', from, 'callId:', callId);
      endCall();
    });

    // Handle call rejected
    socket.on('call:rejected', ({ from, callId, reason }) => {
      console.log('📞 ❌ Call rejected by:', from, 'reason:', reason);
      endCall();
    });

    // Handle call errors
    socket.on('call:error', ({ message }) => {
      console.error('📞 ❌ Call error:', message);
    });

    return () => {
      console.log('🧹 Cleaning up socket listeners');
      socket.offAny(anyHandler);
      socket.off('call:offer');
      socket.off('call:answer');
      socket.off('call:ice-candidate');
      socket.off('call:ended');
      socket.off('call:rejected');
      socket.off('call:error');
    };
  }, [socket]);

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
    changeFilter, 
    canvasRef, 
    videoRef,
  };
};