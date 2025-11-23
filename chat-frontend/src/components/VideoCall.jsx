import { useEffect, useRef, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  RefreshCw,
  SwitchCamera,
  Sparkles,
  X
} from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import toast from 'react-hot-toast';

const FILTERS = [
  { id: 'none', name: 'None', filter: 'none' },
  { id: 'beautiful', name: 'Beautiful', filter: 'brightness(1.1) contrast(1.05) saturate(1.2) blur(0.3px)' },
  { id: 'cute', name: 'Cute', filter: 'brightness(1.15) saturate(1.3) contrast(0.95) hue-rotate(-5deg)' },
  { id: 'white', name: 'Fair', filter: 'brightness(1.2) contrast(1.1) saturate(0.9)' },
];

export const VideoCallComponent = ({ callId, remoteUserId, onEnd, isHost = false, incomingOffer = null }) => {
  const {
    localStream,
    remoteStream,
    callStatus,
    startCall,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo,
    changeFilter,
    canvasRef: webRTCCanvasRef,
    videoRef: webRTCVideoRef,
  } = useWebRTC();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [facingMode, setFacingMode] = useState('user');
  const [availableCameras, setAvailableCameras] = useState([]);

  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        console.log('📹 Available cameras:', videoDevices.length);
      } catch (error) {
        console.error('Error getting cameras:', error);
      }
    };
    getCameras();
  }, []);

  // Initialize call
  useEffect(() => {
    const initCall = async () => {
      console.log('🎬 Initializing call:', { 
        isHost, 
        hasIncomingOffer: !!incomingOffer, 
        callId, 
        remoteUserId 
      });
      
      try {
        if (incomingOffer && remoteUserId) {
          console.log('📲 Accepting incoming call from:', remoteUserId);
          await acceptCall(remoteUserId, incomingOffer, callId);
        } else if (!isHost && callId && remoteUserId) {
          console.log('📞 Starting outgoing call to:', remoteUserId);
          await startCall(remoteUserId, callId);
        } else if (isHost) {
          console.log('🎬 Waiting for incoming call as host');
        }
      } catch (error) {
        console.error('Failed to initialize call:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error('Camera/microphone access denied. Please allow permissions and refresh.');
        } else if (error.name === 'NotFoundError') {
          toast.error('No camera or microphone found on this device.');
        } else {
          toast.error('Failed to initialize call: ' + error.message);
        }
        
        onEnd();
      }
    };

    initCall();
  }, []);

  // Update local video and apply current filter
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log('🎥 Local video stream attached');
      
      // Apply current filter to the video element
      const filter = FILTERS.find(f => f.id === selectedFilter);
      if (filter) {
        localVideoRef.current.style.filter = filter.filter !== 'none' ? filter.filter : 'none';
      }
    }
  }, [localStream, selectedFilter]);

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

  const switchCamera = async () => {
    if (availableCameras.length < 2) {
      toast.error('No other camera available');
      return;
    }

    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
      
      setFacingMode(newFacingMode);
      toast.success(`Switched to ${newFacingMode === 'user' ? 'front' : 'back'} camera`);
    } catch (error) {
      console.error('Error switching camera:', error);
      toast.error('Failed to switch camera');
    }
  };

  const applyFilter = (filterId) => {
    const filter = FILTERS.find(f => f.id === filterId);
    
    // Apply filter immediately to local video preview
    if (localVideoRef.current) {
      localVideoRef.current.style.filter = filter.filter !== 'none' ? filter.filter : 'none';
    }
    
    // Also update the WebRTC canvas filter for remote stream
    if (changeFilter) {
      changeFilter(filter.filter);
    }
    
    const previousFilter = selectedFilter;
    setSelectedFilter(filterId);
    setShowFilters(false);
    
    if (previousFilter !== filterId) {
      const filterName = filter?.name;
      if (filterId === 'none') {
        toast.success('Filter removed');
      } else {
        toast.success(`${filterName} filter applied`);
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentFilter = FILTERS.find(f => f.id === selectedFilter);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Hidden canvas and video for filter processing */}
      <canvas ref={webRTCCanvasRef} className="hidden" />
      <video ref={webRTCVideoRef} className="hidden" />

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
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-xl">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                  <Video className="h-12 w-12 text-white" />
                </div>
                <p className="text-white text-lg font-semibold">Waiting for video...</p>
                <p className="text-white/60 text-sm mt-2">Status: {callStatus}</p>
              </div>
            </div>
          )}
        </div>

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-32 right-4 w-32 h-44 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoEnabled && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-white" />
            </div>
          )}
          {selectedFilter !== 'none' && videoEnabled && isHost && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="text-white text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {currentFilter?.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && isHost && (
        <div className="absolute bottom-28 left-0 right-0 bg-black/90 backdrop-blur-xl p-4 border-t border-white/10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Beauty Filters
            </h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => applyFilter(filter.id)}
                className={`flex-shrink-0 transition-all ${
                  selectedFilter === filter.id
                    ? 'ring-2 ring-purple-500 scale-105'
                    : 'hover:scale-105'
                }`}
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 relative">
                  <div 
                    className="w-full h-full bg-white/20"
                    style={{ filter: filter.filter !== 'none' ? filter.filter : 'none' }}
                  />
                  {selectedFilter === filter.id && (
                    <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                      <div className="w-4 h-4 bg-white rounded-full" />
                    </div>
                  )}
                </div>
                <p className="text-white text-xs mt-1 text-center">{filter.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gradient-to-t from-black/90 to-transparent p-6 absolute bottom-0 left-0 right-0">
        <div className="flex justify-center items-center space-x-3 max-w-md mx-auto mb-4">
          {/* Audio Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-4 rounded-full transition-all transform active:scale-95 shadow-lg ${
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

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all transform active:scale-95 shadow-xl scale-110"
          >
            <Phone className="h-7 w-7 text-white transform rotate-135" />
          </button>

          {/* Video Toggle */}
          <button
            onClick={handleToggleVideo}
            className={`p-4 rounded-full transition-all transform active:scale-95 shadow-lg ${
              videoEnabled
                ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {videoEnabled ? (
              <Video className="h-6 w-6 text-white" />
            ) : (
              <VideoOff className="h-6 w-6 text-white" />
            )}
          </button>
        </div>

        {/* Secondary Controls */}
        <div className="flex justify-center items-center space-x-3 max-w-md mx-auto">
          {/* Switch Camera */}
          {availableCameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all transform active:scale-95"
              title="Switch Camera"
            >
              <SwitchCamera className="h-5 w-5 text-white" />
            </button>
          )}

          {/* Filters - Only for Host */}
          {isHost && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-full backdrop-blur-sm transition-all transform active:scale-95 ${
                showFilters || selectedFilter !== 'none'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              title="Beauty Filters"
            >
              <Sparkles className="h-5 w-5 text-white" />
            </button>
          )}
        </div>

        <div className="text-center mt-4">
          <p className="text-white/60 text-sm">
            {callStatus === 'connected' ? '🟢 Call in progress' : '🔄 Establishing connection...'}
          </p>
          {isHost && selectedFilter !== 'none' && (
            <p className="text-purple-400 text-xs mt-1">
              ✨ {currentFilter?.name} filter active
            </p>
          )}
        </div>
      </div>
    </div>
  );
};