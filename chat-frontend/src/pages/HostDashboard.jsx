import { useState, useEffect } from 'react';
import { Coins, Search, Power, PowerOff, Camera, Phone, PhoneOff, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfileMenu } from './ProfileMenu';
import { VideoCallComponent } from '../components/VideoCall';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { HostProfileModal } from '../components/HostProfileModal';
import { callService } from '../services/callService';
import { useSocket } from '../hooks/useSocket';
import { chatService } from '../services/chatService';

const HostDashboard = () => { 
  const [user, setUser] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [host, setHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [hostProfile, setHostProfile] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [selectedHost, setSelectedHost] = useState(null);
  
  const { socket, connected,onHostStatusChange, emitHostStatusChange } = useSocket();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

   const fetchUnreadCount = async () => {
      try {
        const response = await chatService.getUnreadCount();
        setUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
  const API_URL = import.meta.env?.VITE_API_URL || 'https://chatapplication-1-gspo.onrender.com/api/v1';

  // Fetch user and hosts on mount
  useEffect(() => {
    fetchUser();
    fetchHosts();
  }, []);

    const handleNewMessage = () => {
    // Increment unread count when new message arrives
    fetchUnreadCount();
  };

  // Socket event listeners
  useEffect(() => {
  if (!socket || !connected) {
    console.log('⚠️ Socket not available in HostDashboard');
    console.log('Socket exists:', !!socket);
    console.log('Connected:', connected);
    return;
  }

  console.log('👂 Setting up HOST socket listeners');
  console.log('🆔 Host socket ID:', socket.id);
  console.log('👤 User:', user?.email);

  const handleIncomingCall = ({ from, offer, callId, caller }) => {
    console.log('📞 ===== HOST RECEIVED INCOMING CALL =====');
    console.log('From:', from);
    console.log('Caller:', caller);
    console.log('Call ID:', callId);
    console.log('Is Online:', isOnline);
    console.log('=======================================');
    
    // Only accept calls if host is online
    if (!isOnline) {
      console.log('❌ Host is offline, rejecting call');
      socket.emit('call:reject', { 
        to: from, 
        callId, 
        reason: 'Host is offline' 
      });
      return;
    }

    // Show incoming call notification
    setIncomingCall({
      from,
      offer,
      callId,
      caller: caller || { name: 'User' }
    });

    console.log('✅ Incoming call state set');
  };

  const handleCallRejected = ({ callId, reason }) => {
    console.log('📞 HOST: Call rejected:', reason);
    toast.error(`Call rejected: ${reason}`);
    setInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
  };

  const handleCallEnded = ({ from, callId, reason }) => {
    console.log('📞 HOST: Call ended:', reason);
    setInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
    toast.success('Call ended');
    fetchHosts();
  };

  const handleCallCancelled = ({ callId, reason }) => {
    console.log('📞 HOST: Call cancelled:', reason);
    setIncomingCall(null);
    toast.info(`Call cancelled: ${reason}`);
  };

  const handleCallAnswer = ({ from, answer }) => {
    console.log('📞 HOST: Received answer from:', from);
  };

  // Register listeners
  socket.on('call:offer', handleIncomingCall);
  socket.on('call:rejected', handleCallRejected);
  socket.on('call:ended', handleCallEnded);
  socket.on('call:cancelled', handleCallCancelled);
  socket.on('call:answer', handleCallAnswer);

  // Host status change listeners
  socket.on('host:offline', (data) => {
    console.log('📡 Host went offline:', data);
    fetchHosts();
  });

  socket.on('host:online', (data) => {
    console.log('📡 Host came online:', data);
    fetchHosts();
  });

  console.log('✅ All HOST listeners registered');

  return () => {
    console.log('🧹 Cleaning up HOST socket listeners');
    socket.off('call:offer', handleIncomingCall);
    socket.off('call:rejected', handleCallRejected);
    socket.off('call:ended', handleCallEnded);
    socket.off('call:cancelled', handleCallCancelled);
    socket.off('call:answer', handleCallAnswer);
    socket.off('host:offline');
    socket.off('host:online');
  };
}, [socket, connected, isOnline, user]);


useEffect(() => {
  if (!onHostStatusChange) return;

  const unsubscribe = onHostStatusChange((data) => {
    console.log('🔄 Updating host status:', data);
    
    setHosts(prevHosts => {
      return prevHosts.map(host => {
        if (host._id === data.hostId || host.userId?._id === data.userId) {
          return {
            ...host,
            isOnline: data.isOnline,
            callStatus: data.callStatus || host.callStatus, // NEW
            lastSeen: data.timestamp
          };
        }
        return host;
      });
    });

  });

  return () => unsubscribe();
}, [onHostStatusChange]);



  // useEffect(() => {
  //   if (user?.role === 'host' || user?.role == 'coinSeller') {
  //     setHostOnlineStatus(isOnline);
  //   }
  // }, [isOnline, user, setHostOnlineStatus]);

  // Search debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHosts(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // ============= CALL HANDLERS =============
  const handleIncomingCall = ({ from, offer, callId, caller }) => {
    console.log('📞 HOST: Incoming call from:', from, 'caller:', caller);
    
    // Only accept calls if host is online
    if (!isOnline) {
      console.log('❌ Host is offline, rejecting call');
      socket.emit('call:reject', { 
        to: from, 
        callId, 
        reason: 'Host is offline' 
      });
      return;
    }

    // Show incoming call notification
    setIncomingCall({
      from,
      offer,
      callId,
      caller: caller || { name: 'User' }
    });

    // Show toast notification
    // toast((t) => (
    //   <div className="flex flex-col bg-white p-4 rounded-lg shadow-lg border">
    //     <p className="font-semibold text-lg mb-2 text-gray-900">
    //       📞 Incoming Call
    //     </p>
    //     <p className="text-gray-700 mb-3">
    //       From: <strong>{caller?.name || 'User'}</strong>
    //     </p>
    //     <div className="flex space-x-2">
    //       <button
    //         onClick={() => {
    //           acceptIncomingCall(from, offer, callId);
    //           toast.dismiss(t.id);
    //         }}
    //         className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
    //       >
    //         <Phone className="w-4 h-4 inline mr-1" />
    //         Accept
    //       </button>
    //       <button
    //         onClick={() => {
    //           rejectIncomingCall(from, callId);
    //           toast.dismiss(t.id);
    //         }}
    //         className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
    //       >
    //         <PhoneOff className="w-4 h-4 inline mr-1" />
    //         Reject
    //       </button>
    //     </div>
    //   </div>
    // ), { 
    //   duration: 30000,
    //   position: 'top-center'
    // });
  };

  const acceptIncomingCall = (from, offer, callId) => {
    console.log('✅ HOST: Accepting call from:', from);
    setCurrentCall({ 
      from, 
      callId, 
      offer, 
      isIncoming: true,
      isHost: true 
    });
    setIncomingCall(null);
    setInCall(true);
  };

  const rejectIncomingCall = (from, callId) => {
    console.log('❌ HOST: Rejecting call from:', from);
    if (socket) {
      socket.emit('call:reject', { 
        to: from, 
        callId, 
        reason: 'Host declined call' 
      });
    }
    setIncomingCall(null);
    toast.success('Call rejected');
  };

  const handleCallRejected = ({ callId, reason }) => {
    console.log('📞 HOST: Call rejected:', reason);
    toast.error(`Call rejected: ${reason}`);
    setInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
  };

  const handleCallEnded = ({ callId, reason }) => {
    console.log('📞 HOST: Call ended:', reason);
    setInCall(false);
    setCurrentCall(null);
    setIncomingCall(null);
    toast.success('Call ended');
    fetchHosts();
  };

  const handleCallCancelled = ({ callId, reason }) => {
    console.log('📞 HOST: Call cancelled:', reason);
    setIncomingCall(null);
    toast.info(`Call cancelled: ${reason}`);
  };

  const handleCallAnswer = ({ from, answer }) => {
    console.log('📞 HOST: Received answer from:', from);
    // This will be handled by the VideoCallComponent
    
  };

  const handleEndCall = async () => {
    console.log('☎️ HOST: Ending call:', currentCall);
    
    if (currentCall?.callId) {
      try {
        await callService.endCall(currentCall.callId);
        if (socket) {
          const recipientId = currentCall.from;
          console.log('📤 HOST: Sending call:end to:', recipientId);
          
          socket.emit('call:end', { 
            to: recipientId, 
            callId: currentCall.callId 
          });
        }
      } catch (error) {
        console.error('HOST: Error ending call:', error);
        toast.error('Failed to end call properly');
      }
    }
    setInCall(false);
    setCurrentCall(null);
    fetchHosts();
  };

  const handleCallHost = async (host) => {
    console.log('📞 HOST: Calling another host:', host);
    
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    try {
      const response = await callService.initiateCall(host._id);
      const callData = response.data.call;
      
      console.log('📞 HOST: Call data:', callData);
      
      const hostUserId = host.userId?._id || host.userId || host.user?._id || host._id;
      
      console.log('🆔 HOST: Using host user ID:', hostUserId);
      
      setCurrentCall({ 
        callId: callData._id || callData.id, 
        hostId: hostUserId,
        host,
        isIncoming: false,
        isHost: false
      });
      setInCall(true);
    } catch (error) {
      console.error('❌ HOST: Error initiating call:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate call');
    }
  };

  // ============= ONLINE STATUS HANDLERS =============
  const checkPhotosAndToggle = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success 
        // && data.data.hostProfile
      ) {
        const currentHostProfile = data.data.hostProfile;
        
        // Check if host has uploaded at least one photo
        if (!currentHostProfile.photos || currentHostProfile.photos.length === 0) {
          setShowPhotoModal(true);
          return false;
        }
        
        // If photos exist, proceed with toggle
        return await toggleOnlineStatus();
      }
    } catch (error) {
      console.error('Failed to check photos:', error);
      toast.error('Failed to check photo status');
      return false;
    }
  };

   const toggleOnlineStatus = async () => {
    try {
      setTogglingOnline(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/hosts/toggle-online`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        const newOnlineStatus = data.data.isOnline;
        setIsOnline(newOnlineStatus);
        
        // Emit socket event for real-time update
        if (emitHostStatusChange && hostProfile?._id) {
          emitHostStatusChange(hostProfile._id, newOnlineStatus);
        }
        
        toast.success(`You are now ${newOnlineStatus ? 'online' : 'offline'}`);
        
        if (!newOnlineStatus && incomingCall) {
          rejectIncomingCall(incomingCall.from, incomingCall.callId);
        }
        
        return true;
      }
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      toast.error('Failed to toggle online status');
      return false;
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleToggleOnline = async () => {
    await checkPhotosAndToggle();
  };

  const handleLogout = async () => {
    // Mark host offline before logging out
    if (isOnline && (user?.role === 'host' || user?.role === 'coinSeller') ) {
      try {
        const token = localStorage.getItem('accessToken');
        await fetch(`${API_URL}/hosts/toggle-online`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ forceOffline: true })
        });
        console.log('✅ Host marked offline on logout');
      } catch (error) {
        console.error('Failed to mark offline on logout:', error);
      }
    }
    
    logout();
    toast.success('Logged out successfully');
  };

  const handleUploadPhotos = () => {
    setShowPhotoModal(false);
    navigate('/profile?tab=photos');
  };

  // ============= USER DATA FETCHING =============
  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data.user);
        if (data.data.hostProfile) {
          setIsOnline(data.data.hostProfile.isOnline);
          setHostProfile(data.data.hostProfile);
          // Check if host has uploaded photos
          if (data.data.hostProfile.photos && data.data.hostProfile.photos.length === 0) {
            setShowPhotoModal(true);
          }
        }
        setHost(data.data.hostProfile?.totalEarnings || 0);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchHosts = async (search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const queryParams = new URLSearchParams({
        status: 'approved',
        isOnline: 'true',
        ...(search && { search })
      });
      
      const response = await fetch(`${API_URL}/hosts?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setHosts(data.data.hosts);
      }
    } catch (error) {
      console.error('Failed to load hosts:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============= RENDER VIDEO CALL =============
  if (inCall && currentCall) {
    const remoteUserId = currentCall.hostId || currentCall.from;
    console.log('🎥 HOST: Rendering video call with remote user:', remoteUserId);
    
    return (
      <VideoCallComponent
        callId={currentCall.callId}
        remoteUserId={remoteUserId}
        onEnd={handleEndCall}
        isHost={currentCall.isHost || currentCall.isIncoming}
        incomingOffer={currentCall.offer}
      />
    );
  }

  // ============= INCOMING CALL MODAL =============
  const IncomingCallModal = () => {
    if (!incomingCall) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-pulse">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <Phone className="w-10 h-10 text-green-600" />
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Incoming Call
            </h3>
            
            <p className="text-gray-600 mb-2 text-lg">
              From: <strong>{incomingCall.caller.name}</strong>
            </p>
            
            <p className="text-gray-500 text-sm mb-6">
              You have 30 seconds to respond
            </p>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={() => rejectIncomingCall(incomingCall.from, incomingCall.callId)}
                className="flex-1 px-6 py-4 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={() => acceptIncomingCall(incomingCall.from, incomingCall.offer, incomingCall.callId)}
                className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Photo Upload Modal Component
  const PhotoUploadModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-purple-600" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Upload Photos Required
          </h3>
          
          <p className="text-gray-600 mb-6">
            You need to upload at least one photo before you can go online and start receiving calls.
          </p>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleUploadPhotos}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              Upload Photos
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Live Hosts</h1>
            <div className="flex items-center gap-3">
            

              {/* Online Toggle - Only for hosts */}
              {user?.role === 'host'  && (
                <div className="flex flex-row items-center gap-2">
                  <span className={`text-sm font-semibold ${
                    isOnline ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  
                  <button
                    onClick={handleToggleOnline}
                    disabled={togglingOnline || inCall}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ${
                      isOnline ? 'bg-green-500' : 'bg-gray-300'
                    } ${togglingOnline || inCall ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                        isOnline ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    >
                      {isOnline ? (
                        <Power className="w-4 h-4 text-green-600 m-1" />
                      ) : (
                        <PowerOff className="w-4 h-4 text-gray-500 m-1" />
                      )}
                    </span>
                  </button>
                </div>
              )}

              <ProfileMenu
                user={user} 
                onLogout={handleLogout}
                onNavigateToProfile={() => navigate('/profile')}
              />

              <button
              onClick={() => navigate('/messages')}
              className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MessageCircle className="w-6 h-6 text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>


              <button 
                            onClick={() => navigate('/coins')}
                            className="flex items-center space-x-1.5 bg-yellow-50 px-3 py-1.5 rounded-full hover:bg-yellow-100 transition-colors"
                          >
                            <Coins className="h-5 w-5 text-yellow-600" />
                            <span className="font-semibold text-gray-900">{user?.coinBalance || 0}</span>
                          </button>

              {/* Coin Balance */}
              <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-200 cursor-pointer" onClick={() => navigate("/withdraw")}>
                <p className="text-lg text-purple-600">💎</p>
                <span className="font-semibold text-gray-900">
                  {host || 0}
                </span>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search hosts by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Hosts Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-500">Loading hosts...</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {hosts.map((hostItem) => (
              <div
                key={hostItem._id}
                onClick={() => setSelectedHost(hostItem)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100"
              >
                {/* Host Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-100 to-pink-100">
                  {hostItem.userId?.avatar ? (
                    <img
                      src={hostItem.userId.avatar || hostItem?.photos?.[0]?.url}
                      alt={hostItem.userId?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : hostItem.photos?.[0] ? (
                    <img
                      src={hostItem.photos[0]?.url}
                      alt={hostItem.userId?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-purple-400">
                      {hostItem.userId?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  
                  {/* Online Status Badge */}
                  {hostItem.isOnline ? (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-gray-700">Online</span>
                    </div>
                  ) : (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                      <span className="text-xs font-medium text-gray-700">Offline</span>
                    </div>
                  )}
                </div>

                {/* Host Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
                    {hostItem.userId?.name || 'Host'}
                  </h3>
                  
                  {/* Bio or Status */}
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2 min-h-[2rem]">
                    {hostItem.bio || 'Available for call'}
                  </p>

                  {/* Rate */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-gray-900">
                        {hostItem.ratePerMinute}
                      </span>
                      <span className="text-xs text-gray-500">coins/min</span>
                    </div>
                    {hostItem.rating > 0 && (
                      <div className="flex items-center gap-0.5">
                        <span className="text-yellow-500 text-sm">★</span>
                        <span className="text-xs font-medium text-gray-600">
                          {hostItem.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && hosts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-2">
              <Coins className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">
              {searchQuery ? 'No hosts found' : 'No hosts online'}
            </h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Check back later for available hosts'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Spacer */}
      <div className="h-20" />

      {/* Incoming Call Modal */}
      <IncomingCallModal />

      {/* Photo Upload Modal */}
      {showPhotoModal && <PhotoUploadModal />}

     
      {selectedHost && (
        <HostProfileModal
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
        />
      )}
    </div>
  );
}

export default HostDashboard;