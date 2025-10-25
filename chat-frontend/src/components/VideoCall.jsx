import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Phone, RefreshCw } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import toast from 'react-hot-toast';

export const VideoCallComponent = ({ callId, remoteUserId, onEnd, isHost = false, incomingOffer = null }) => {
  const {
    localStream,
    remoteStream,
    callStatus,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useWebRTC();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // Initialize call
useEffect(() => {
  const initCall = async () => {
    console.log('🎬 Initializing call:', { isHost, callId, remoteUserId });
    
    try {
      if (!isHost && callId && remoteUserId) {
        console.log('📞 Starting outgoing call to:', remoteUserId);
        await startCall(remoteUserId, callId);
      } else if (isHost) {
        console.log('🎬 Waiting for incoming call as host');
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error('Failed to start call');
      onEnd();
    }
  };

  initCall();
}, []);

  // Initialize call - only caller initiates
  // useEffect(() => {
  //   if (!isHost && callId && remoteUserId) {
  //     console.log('🎬 VideoCallComponent: Initiating call as caller');
  //     startCall(remoteUserId, callId).catch((error) => {
  //       console.error('Failed to start call:', error);
  //       toast.error('Failed to start call');
  //       onEnd();
  //     });
  //   } else if (isHost) {
  //     console.log('🎬 VideoCallComponent: Waiting for incoming call as host');
  //   }
  // }, []); // Empty dependency array - run once on mount

  // Update local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log('🎥 Local video stream attached');
    }
  }, [localStream]);

  // Update remote video
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log('📺 Remote video stream attached');
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    setAudioEnabled(enabled);
  };

  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    setVideoEnabled(enabled);
  };

  const handleEndCall = async () => {
    endCall();
    await onEnd();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-black/80 to-transparent p-4 absolute top-0 left-0 right-0 z-10">
        <div className="flex justify-between items-center">
          <div className="text-white">
            <p className="text-sm font-medium capitalize">
              {callStatus === 'connected' ? 'Connected' : 
               callStatus === 'connecting' ? 'Connecting...' : 
               callStatus === 'calling' ? 'Calling...' : 
               isHost ? 'Waiting for call...' : 'Initializing...'}
            </p>
            {callStatus === 'connected' && (
              <p className="text-2xl font-bold">{formatDuration(callDuration)}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {callStatus !== 'connected' && (
              <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                <div className="animate-spin">
                  <RefreshCw className="h-4 w-4 text-white" />
                </div>
                <span className="text-white text-sm">
                  {callStatus === 'calling' ? 'Calling' : 
                   callStatus === 'connecting' ? 'Connecting' :
                   isHost ? 'Waiting' : 'Loading'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) */}
        <div className="absolute inset-0 bg-gray-900">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Placeholder if no remote stream */}
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <VideoIcon className="h-12 w-12 text-gray-500" />
                </div>
                <p className="text-white text-lg">Waiting for video...</p>
                <p className="text-white/60 text-sm mt-2">Status: {callStatus}</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-20 right-4 w-32 h-44 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-t from-black/80 to-transparent p-6 absolute bottom-0 left-0 right-0">
        <div className="flex justify-center items-center space-x-4 max-w-md mx-auto">
          <button
            onClick={handleToggleAudio}
            className={`p-4 rounded-full transition-all transform active:scale-95 ${
              audioEnabled
                ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {audioEnabled ? (
              <Mic className="h-6 w-6 text-white" />
            ) : (
              <MicOff className="h-6 w-6 text-white" />
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all transform active:scale-95 shadow-lg"
          >
            <Phone className="h-7 w-7 text-white transform rotate-135" />
          </button>

          <button
            onClick={handleToggleVideo}
            className={`p-4 rounded-full transition-all transform active:scale-95 ${
              videoEnabled
                ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {videoEnabled ? (
              <VideoIcon className="h-6 w-6 text-white" />
            ) : (
              <VideoOff className="h-6 w-6 text-white" />
            )}
          </button>
        </div>

        <div className="text-center mt-4">
          <p className="text-white/60 text-sm">
            {callStatus === 'connected' ? 'Call in progress' : 'Establishing connection...'}
          </p>
        </div>
      </div>
    </div>
  );
};