import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './useSocket';

const ICE_SERVERS = [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4',
      credential: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4',
      credential: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4'
    },
    {
      urls: 'turn:a.relay.metered.ca:443?transport=tcp',
      username: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4',
      credential: 'Tjg_puqMFIT8F0RvHBFsmysYZ3Fhz01PfchtTki89PhmsgW4'
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

  // useEffect(() => {
  //   const initCall = async () => {
  //     console.log('🎬 Initializing call:', { 
  //       // isHost, 
  //       hasIncomingOffer: !!incomingOffer, 
  //       remoteUserId, 
  //       callId 
  //     });
      
  //     try {
  //       if (incomingOffer && remoteUserId) {
  //         // This is the receiver - accept the incoming call
  //         console.log('📲 Accepting incoming call from:', remoteUserId);
  //         await acceptCall(remoteUserId, incomingOffer, callId);
  //       } else if (callId && remoteUserId) {
  //         // This is the caller - start a new call
  //         console.log('📞 Starting outgoing call to:', remoteUserId);
  //         await startCall(remoteUserId, callId);
  //       } else {
  //         console.error('❌ Missing required call parameters');
  //       }
  //     } catch (error) {
  //       console.error('Failed to initialize call:', error);
  //       toast.error('Failed to initialize call');
  //       onEnd();
  //     }
  //   };

  //   initCall();
  // }, []);

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
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      throw error;
    }
  };

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
  };

  const rejectCall = (from, callId, reason = 'User declined') => {
    console.log('❌ Rejecting call from:', from);
    socket.emit('call:reject', { to: from, callId, reason });
    endCall();
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      console.log('🎤 Audio:', audioTrack.enabled ? 'enabled' : 'disabled');
      return audioTrack.enabled;
    }
    return false;
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
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
      // Auto-accept for now - you can add UI confirmation later
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
  };
};