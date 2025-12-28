import { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Phone, SwitchCamera, 
  Sparkles, X, MessageCircle, Send, AlertCircle
} from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';


const FILTERS = [
  { id: 'none', name: 'None', filter: 'none' },
  { id: 'beautiful', name: 'Beautiful', filter: 'brightness(1.1) contrast(1.05) saturate(1.2) blur(0.3px)' },
  { id: 'cute', name: 'Cute', filter: 'brightness(1.15) saturate(1.3) contrast(0.95) hue-rotate(-5deg)' },
  { id: 'white', name: 'Fair', filter: 'brightness(1.2) contrast(1.1) saturate(0.9)' },
];

export const VideoCallComponent = ({ 
  callId, 
  remoteUserId, 
  onEnd, 
  isHost = false, 
  incomingOffer = null 
}) => {
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

  const {
    messages,
    typing,
    sendMessage,
    startTyping,
    stopTyping,
    messagesEndRef,
    scrollToBottom
  } = useChat(remoteUserId);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messageInputRef = useRef(null);
  const balanceCheckIntervalRef = useRef(null);
  
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [facingMode, setFacingMode] = useState('user');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [lowBalanceWarning, setLowBalanceWarning] = useState(false);
  const { user, refreshUser } = useAuth();
  
  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  // CRITICAL: Track if call has been initialized
  const callInitializedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!showChat && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const userId = localStorage.getItem('userId');
      
      if (lastMessage.sender._id !== userId && lastMessage.sender !== userId) {
        setUnreadMessages(prev => prev + 1);
      }
    }
  }, [messages, showChat]);

  // Reset unread when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadMessages(0);
    }
  }, [showChat]);

  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      } catch (error) {
        console.error('Error getting cameras:', error);
      }
    };
    getCameras();
  }, []);

  // NEW: Balance checking for users (not hosts)
  useEffect(() => {
    if (isHost || callStatus !== 'connected') {
      return;
    }

    // Check balance every 30 seconds during active call
    const checkBalance = async () => {
      try {
        const response = await api.post('/calls/check-balance', { callId });
        
        if (!response.data.data.shouldContinue) {
          if (response.data.data.insufficientBalance) {
            toast.error('Insufficient balance. Call ending...');
            console.log('💰 Insufficient balance detected, ending call');
            await handleEndCall();
          }
        } else {
          const currentBalance = user?.coinBalance || 0;
          if (currentBalance < 50) { 
            setLowBalanceWarning(true);
          }
        }
      } catch (error) {
        console.error('Balance check error:', error);
      }
    };

    // Check immediately
    checkBalance();

    // Then check every 30 seconds
    balanceCheckIntervalRef.current = setInterval(checkBalance, 30000);

    return () => {
      if (balanceCheckIntervalRef.current) {
        clearInterval(balanceCheckIntervalRef.current);
      }
    };
  }, [callStatus, isHost, callId, user?.coinBalance]);

  // FIXED: Initialize call only once
  useEffect(() => {
    isMountedRef.current = true;

    const initCall = async () => {
      if (callInitializedRef.current) {
        console.log('⚠️ Call already initialized, skipping');
        return;
      }

      console.log('🎬 Initializing video call component');
      console.log('📞 Call ID:', callId);
      console.log('👤 Remote User ID:', remoteUserId);
      console.log('🎭 Is Host:', isHost);
      console.log('📨 Has Incoming Offer:', !!incomingOffer);

      try {
        callInitializedRef.current = true;

        if (incomingOffer && remoteUserId) {
          console.log('📲 Accepting incoming call...',callId);
          await acceptCall(remoteUserId, incomingOffer, callId);
        } else if (!isHost && callId && remoteUserId) {
          console.log('📞 Starting outgoing call...');
          await startCall(remoteUserId, callId);
        } else {
          console.error('❌ Invalid call parameters');
          toast.error('Invalid call parameters');
          onEnd();
        }
      } catch (error) {
        console.error('❌ Failed to initialize call:', error);
        toast.error('Failed to initialize call');
        callInitializedRef.current = false;
        onEnd();
      }
    };

    initCall();

    return () => {
      console.log('🧹 VideoCallComponent unmounting');
      isMountedRef.current = false;
      if (balanceCheckIntervalRef.current) {
        clearInterval(balanceCheckIntervalRef.current);
      }
    };
  }, []);

  // Update local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
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
    const wasDisconnected = false; 
    const hostManuallyDisconnected = isHost; 
    try {
      await api.post('/calls/end', { 
        callId,
        wasDisconnected,
        hostManuallyDisconnected 
      });
    } catch (error) {
      console.error('Error ending call:', error);
    }
    
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
    
    if (localVideoRef.current) {
      localVideoRef.current.style.filter = filter.filter !== 'none' ? filter.filter : 'none';
    }
    
    if (changeFilter) {
      changeFilter(filter.filter);
    }
    
    setSelectedFilter(filterId);
    setShowFilters(false);
    
    if (filterId === 'none') {
      toast.success('Filter removed');
    } else {
      toast.success(`${filter.name} filter applied`);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessage(messageText, callId);
      setMessageText('');
      stopTyping();
      scrollToBottom();
    }
  };

  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMessageTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const currentFilter = FILTERS.find(f => f.id === selectedFilter);
  const userId = localStorage.getItem('userId');

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col md:flex-row">
      {/* Hidden elements for filter processing */}
      <canvas ref={webRTCCanvasRef} className="hidden" />
      <video ref={webRTCVideoRef} className="hidden" />

      {/* Low Balance Warning */}
      {lowBalanceWarning && !isHost && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <AlertCircle className="h-5 w-5" />
          <span className="font-semibold">Low Balance! Please recharge soon.</span>
          <button 
            onClick={() => setLowBalanceWarning(false)}
            className="ml-2 hover:bg-yellow-600 rounded-full p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Video Section */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showChat ? 'md:w-2/3' : 'w-full'}`}>
        {/* Header */}
        <div className="bg-gradient-to-b from-black/80 to-transparent p-4 absolute top-0 left-0 right-0 z-10">
          <div className={`flex justify-between items-center ${showChat ? 'md:pr-0' : ''}`}>
            <div className="text-white">
              <p className="text-sm font-medium capitalize">
                {callStatus === 'connected' ? 'Connected' : 
                 callStatus === 'connecting' ? 'Connecting...' : 
                 callStatus === 'calling' ? 'Calling...' : 
                 callStatus === 'reconnecting' ? 'Reconnecting...' :
                 'Loading...'}
              </p>
              {callStatus === 'connected' && (
                <p className="text-2xl font-bold">{formatDuration(callDuration)}</p>
              )}
              {!isHost && user && (
                <p className="text-xs opacity-75 mt-1">Balance: {user.coinBalance} beans</p>
              )}
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="relative p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
            >
              <MessageCircle className="h-6 w-6 text-white" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                  {unreadMessages}
                </span>
              )}
            </button>
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
            
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-xl">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
                    <Video className="h-12 w-12 text-white" />
                  </div>
                  <p className="text-white text-lg font-semibold mb-2">
                    {callStatus === 'calling' ? 'Calling...' : 
                     callStatus === 'accepted' ? 'Host Accepted!' :
                     callStatus === 'connecting' ? 'Connecting video...' :
                     callStatus === 'connected' ? 'Connected' :
                     callStatus === 'reconnecting' ? 'Reconnecting...' :
                     'Waiting for video...'}
                  </p>
                  <p className="text-white/60 text-sm">
                    {callStatus === 'calling' ? 'Waiting for host to answer' :
                     callStatus === 'accepted' ? 'Setting up video connection...' :
                     callStatus === 'connecting' ? 'Establishing video stream' :
                     callStatus === 'connected' ? 'Enjoy your call' :
                     callStatus === 'reconnecting' ? 'Connection interrupted' :
                     'Please wait...'}
                  </p>
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
            <div className="flex gap-3 overflow-x-auto pb-2">
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

            <button
              onClick={handleEndCall}
              className="p-5 rounded-full bg-red-600 hover:bg-red-700 transition-all transform active:scale-95 shadow-xl scale-110"
            >
              <Phone className="h-7 w-7 text-white transform rotate-135" />
            </button>

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

          <div className="flex justify-center items-center space-x-3 max-w-md mx-auto">
            {availableCameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all transform active:scale-95"
              >
                <SwitchCamera className="h-5 w-5 text-white" />
              </button>
            )}

            {isHost && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 rounded-full backdrop-blur-sm transition-all transform active:scale-95 ${
                  showFilters || selectedFilter !== 'none'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      {showChat && (
        <div className="w-2/3 md:w-1/3 bg-gray-900 border-l border-gray-800 flex flex-col absolute right-0 md:relative inset-0 md:inset-auto z-20">
          {/* Chat Header */}
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Chat
            </h3>
            <button
              onClick={() => setShowChat(false)}
              className="p-1 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Send a message to start the conversation</p>
                </div>
              </div>
            )}

            {messages.map((message) => {
  const isOwn = message.sender?._id === userId || message.senderId === userId;
  const senderAvatar = message.sender?.avatar || 'https://ui-avatars.com/api/?name=' + (message.sender?.name || 'User');
  
  return (
    <div
      key={message._id}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end gap-2 animate-fadeIn`}
    >
      {/* Avatar for incoming messages (left side) */}
      {!isOwn && (
        <img 
          src={senderAvatar}
          alt={message.sender?.name}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      )}
      
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 break-words ${
          isOwn
            ? 'bg-purple-600 text-white rounded-br-sm'
            : 'bg-gray-800 text-white rounded-bl-sm'
        }`}
      >
        {/* Show sender name for incoming messages */}
        {!isOwn && (
          <p className="text-xs font-semibold text-gray-300 mb-1">
            {message.sender?.name || 'User'}
          </p>
        )}
        
        {message.messageType === 'text' && (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
        {message.messageType === 'image' && (
          <img 
            src={message.mediaUrl} 
            alt="Shared" 
            className="max-w-full rounded-lg"
          />
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs opacity-70">
            {formatMessageTime(message.createdAt)}
          </span>
          {isOwn && (
            <span className="text-xs opacity-70">
              {message.status === 'read' ? '✓✓' : 
               message.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
      
    
      {isOwn && (
        <img 
          src={user?.avatar || 'https://ui-avatars.com/api/?name=' + (user?.name || 'You')}
          alt="You"
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      )}
    </div>
  );
})}
            
            {typing && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form 
            onSubmit={handleSendMessage}
            className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0"
          >
            <div className="flex items-center gap-2">
              <input
                ref={messageInputRef}
                type="text"
                value={messageText}
                onChange={handleInputChange}
                onBlur={stopTyping}
                placeholder="Type a message..."
                autoComplete="off"
                className="flex-1 bg-gray-700 text-white rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={!messageText.trim()}
                className="p-2.5 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600 transition-colors flex-shrink-0"
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};