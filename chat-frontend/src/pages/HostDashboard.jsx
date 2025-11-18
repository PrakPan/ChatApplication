import { useState, useEffect } from 'react';
import { Coins, Search, Power, PowerOff, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProfileMenu } from './ProfileMenu';
import { VideoCallComponent } from '../components/VideoCall';
import { useSocket } from '../hooks/useSocket';
import { callService } from '../services/callService';
import toast from 'react-hot-toast';

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
  
  const { socket } = useSocket();
  const navigate = useNavigate();

  const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5500/api/v1';

  useEffect(() => {
    fetchUser();
    fetchHosts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for incoming calls
    socket.on('call:offer', handleIncomingCall);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:cancelled', handleCallCancelled);

    return () => {
      socket.off('call:offer');
      socket.off('call:rejected');
      socket.off('call:ended');
      socket.off('call:cancelled');
    };
  }, [socket]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHosts(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  console.log("User", user);

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

  // ============= CALL HANDLERS =============
  const handleIncomingCall = ({ from, offer, callId, caller }) => {
    console.log('📞 Incoming call from:', from, 'caller:', caller);
    
    // Only show incoming call notification if host is online
    if (!isOnline) return;

    toast((t) => (
      <div className="flex flex-col">
        <p className="font-semibold mb-2">Incoming call from {caller?.name || 'User'}</p>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              acceptIncomingCall(from, offer, callId);
              toast.dismiss(t.id);
            }}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium"
          >
            Accept
          </button>
          <button
            onClick={() => {
              rejectIncomingCall(from, callId);
              toast.dismiss(t.id);
            }}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium"
          >
            Reject
          </button>
        </div>
      </div>
    ), { duration: 30000 });
  };

  const acceptIncomingCall = (from, offer, callId) => {
    console.log('✅ Accepting call from:', from);
    setCurrentCall({ 
      from, 
      callId, 
      offer, 
      isIncoming: true,
      isHost: true 
    });
    setInCall(true);
  };

  const rejectIncomingCall = (from, callId) => {
    console.log('❌ Rejecting call from:', from);
    if (socket) {
      socket.emit('call:reject', { 
        to: from, 
        callId, 
        reason: 'Host declined call' 
      });
    }
    toast.success('Call rejected');
  };

  const handleCallRejected = ({ callId, reason }) => {
    console.log('📞 Call rejected:', reason);
    toast.error(`Call rejected: ${reason}`);
    setInCall(false);
    setCurrentCall(null);
  };

  const handleCallEnded = ({ callId, reason }) => {
    console.log('📞 Call ended:', reason);
    setInCall(false);
    setCurrentCall(null);
    toast.success('Call ended');
    fetchHosts(); // Refresh hosts list
  };

  const handleCallCancelled = ({ callId, reason }) => {
    console.log('📞 Call cancelled:', reason);
    toast.info(`Call cancelled: ${reason}`);
    setInCall(false);
    setCurrentCall(null);
  };

  const handleEndCall = async () => {
    console.log('☎️ Ending call:', currentCall);
    
    if (currentCall?.callId) {
      try {
        await callService.endCall(currentCall.callId);
        if (socket) {
          const recipientId = currentCall.from;
          console.log('📤 Sending call:end to:', recipientId);
          
          socket.emit('call:end', { 
            to: recipientId, 
            callId: currentCall.callId 
          });
        }
      } catch (error) {
        console.error('Error ending call:', error);
        toast.error('Failed to end call properly');
      }
    }
    setInCall(false);
    setCurrentCall(null);
    fetchHosts();
  };

  const handleCallHost = async (host) => {
    console.log('📞 Calling host:', host);
    
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    try {
      const response = await callService.initiateCall(host._id);
      const callData = response.data.call;
      
      console.log('📞 Call data:', callData);
      console.log('📞 Host data:', host);
      
      const hostUserId = host.userId?._id || host.userId || host.user?._id || host._id;
      
      console.log('🆔 Using host user ID:', hostUserId);
      
      setCurrentCall({ 
        callId: callData._id || callData.id, 
        hostId: hostUserId,
        host,
        isIncoming: false,
        isHost: false
      });
      setInCall(true);
    } catch (error) {
      console.error('❌ Error initiating call:', error);
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
      
      if (data.success && data.data.hostProfile) {
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
        setIsOnline(data.data.isOnline);
        toast.success(`You are now ${data.data.isOnline ? 'online' : 'offline'}`);
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

  const handleUploadPhotos = () => {
    setShowPhotoModal(false);
    navigate('/profile?tab=photos');
  };

  // ============= RENDER VIDEO CALL =============
  if (inCall && currentCall) {
    const remoteUserId = currentCall.hostId || currentCall.from;
    console.log('🎥 Rendering video call with remote user:', remoteUserId);
    
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
              {user?.role === 'host' && (
                <button
                  onClick={handleToggleOnline}
                  disabled={togglingOnline || inCall}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                    isOnline
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600'
                  } ${togglingOnline || inCall ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                >
                  {isOnline ? (
                    <>
                      <Power className="w-5 h-5" />
                      <span className="font-semibold">Online</span>
                    </>
                  ) : (
                    <>
                      <PowerOff className="w-5 h-5" />
                      <span className="font-semibold">Offline</span>
                    </>
                  )}
                </button>
              )}
              <ProfileMenu
                user={user} 
                onLogout={()=>{}}
                onNavigateToProfile={() => navigate('/profile')}
              />
              {/* Coin Balance */}
              <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-200 cursor-pointer" onClick={()=>navigate("/coins")}>
                <Coins className="w-5 h-5 text-yellow-600" />
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
            {hosts.map((host) => (
              <div
                key={host._id}
                onClick={() => handleCallHost(host)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100"
              >
                {/* Host Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-purple-100 to-pink-100">
                  {host.userId?.avatar ? (
                    <img
                      src={host.userId.avatar}
                      alt={host.userId?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : host.photos?.[0] ? (
                    <img
                      src={host.photos[0]}
                      alt={host.userId?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-purple-400">
                      {host.userId?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  
                  {/* Online Status Badge */}
                  {host.isOnline && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-gray-700">Online</span>
                    </div>
                  )}
                </div>

                {/* Host Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-base mb-1 truncate">
                    {host.userId?.name || 'Host'}
                  </h3>
                  
                  {/* Bio or Status */}
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2 min-h-[2rem]">
                    {host.bio || 'Available for call'}
                  </p>

                  {/* Rate */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-gray-900">
                        {host.ratePerMinute}
                      </span>
                      <span className="text-xs text-gray-500">coins/min</span>
                    </div>
                    {host.rating > 0 && (
                      <div className="flex items-center gap-0.5">
                        <span className="text-yellow-500 text-sm">★</span>
                        <span className="text-xs font-medium text-gray-600">
                          {host.rating.toFixed(1)}
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

      {/* Photo Upload Modal */}
      {showPhotoModal && <PhotoUploadModal />}
    </div>
  );
}

export default HostDashboard;