import { useState, useEffect, useCallback } from 'react';
import { Coins, Search, Power, PowerOff, Camera, Phone, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfileMenu } from './ProfileMenu';
import { VideoCallComponent } from '../components/VideoCall';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { HostProfileModal } from '../components/HostProfileModal';
import { callService } from '../services/callService';
import { useSocket } from '../hooks/useSocket';

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
  
  const { socket, connected, setHostOnlineStatus } = useSocket();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5500/api/v1';

  // FIXED: Memoized fetch functions
  const fetchUser = useCallback(async () => {
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
          if (data.data.hostProfile.photos && data.data.hostProfile.photos.length === 0) {
            setShowPhotoModal(true);
          }
        }
        setHost(data.data.hostProfile?.totalEarnings || 0);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  }, [API_URL]);

  const fetchHosts = useCallback(async (search = '') => {
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
  }, [API_URL]);

  // Fetch user and hosts on mount
  useEffect(() => {
    fetchUser();
    fetchHosts();
  }, [fetchUser, fetchHosts]);

  // FIXED: Proper socket event listener cleanup
  useEffect(() => {
    if (!socket || !connected) {
      console.log('⚠️ Socket not available or not connected');
      return;
    }

    console.log('👂 Setting up socket listeners for host dashboard');
    console.log('🆔 Host socket ID:', socket.id);

    // Define all handler functions
    const handleIncomingCall = ({ from, offer, callId, caller }) => {
      console.log('📞 HOST: Incoming call from:', from, 'caller:', caller);
      
      if (!isOnline) {
        console.log('❌ Host is offline, rejecting call');
        socket.emit('call:reject', { 
          to: from, 
          callId, 
          reason: 'Host is offline' 
        });
        return;
      }

      setIncomingCall({
        from,
        offer,
        callId,
        caller: caller || { name: 'User' }
      });
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

    const handleHostOffline = (data) => {
      console.log('📡 Host went offline:', data);
      fetchHosts();
    };

    const handleHostOnline = (data) => {
      console.log('📡 Host came online:', data);
      fetchHosts();
    };

    // Register all listeners
    socket.on('call:offer', handleIncomingCall);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:cancelled', handleCallCancelled);
    socket.on('host:offline', handleHostOffline);
    socket.on('host:online', handleHostOnline);

    // IMPORTANT: Cleanup function removes all listeners
    return () => {
      console.log('🧹 Cleaning up host dashboard socket listeners');
      socket.off('call:offer', handleIncomingCall);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:cancelled', handleCallCancelled);
      socket.off('host:offline', handleHostOffline);
      socket.off('host:online', handleHostOnline);
    };
  }, [socket, connected, isOnline, fetchHosts]);

  // Update socket with online status
  useEffect(() => {
    if (user?.role === 'host' || user?.role === 'coinSeller') {
      setHostOnlineStatus(isOnline);
    }
  }, [isOnline, user, setHostOnlineStatus]);

  // Search debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHosts(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, fetchHosts]);

  // FIXED: Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log('🧹 HostDashboard unmounting');
      // Clear any incoming call state
      if (incomingCall) {
        setIncomingCall(null);
      }
    };
  }, [incomingCall]);

  const acceptIncomingCall = useCallback((from, offer, callId) => {
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
  }, []);

  const rejectIncomingCall = useCallback((from, callId) => {
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
  }, [socket]);

  const handleEndCall = useCallback(async () => {
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
  }, [currentCall, socket, fetchHosts]);

  const handleCallHost = useCallback(async (host) => {
    console.log('📞 HOST: Calling another host:', host);
    
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    try {
      const response = await callService.initiateCall(host._id);
      const callData = response.data.call;
      
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
  }, [user, navigate]);

  const checkPhotosAndToggle = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        const currentHostProfile = data.data.hostProfile;
        
        if (!currentHostProfile.photos || currentHostProfile.photos.length === 0) {
          setShowPhotoModal(true);
          return false;
        }
        
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
        toast.success(`You are now ${newOnlineStatus ? 'online' : 'offline'}`);
        
        if (!newOnlineStatus && incomingCall) {
          rejectIncomingCall(incomingCall.from, incomingCall.callId);
        }
        
        return true;
      } else {
        toast.error(data.message || 'Failed to toggle online status');
        return false;
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
    if (isOnline && (user?.role === 'host' || user?.role === 'coinSeller')) {
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Live Hosts</h1>
            <div className="flex items-center gap-3">
              {user?.role === 'host' && (
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
                onClick={() => navigate('/coins')}
                className="flex items-center space-x-1.5 bg-yellow-50 px-3 py-1.5 rounded-full hover:bg-yellow-100 transition-colors"
              >
                <img src='/coin.png' alt="Coin"/>
                <span className="font-semibold text-gray-900">{user?.coinBalance || 0}</span>
              </button>

              <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-200 cursor-pointer" onClick={() => navigate("/withdraw")}>
                <p className="text-lg text-purple-600">💎</p>
                <span className="font-semibold text-gray-900">
                  {host || 0}
                </span>
              </div>
            </div>
          </div>
          
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

                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
                    {hostItem.userId?.name || 'Host'}
                  </h3>
                  
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2 min-h-[2rem]">
                    {hostItem.bio || 'Available for call'}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <img src='/coin.png' alt="Coin"/>
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
              <img src='/coin.png' alt="Coin"/>
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

      <div className="h-20" />

      <IncomingCallModal />
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