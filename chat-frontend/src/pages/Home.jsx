import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { hostService } from '../services/hostService';
import { callService } from '../services/callService';
import { HostCard } from '../components/HostCard';
import { VideoCallComponent } from '../components/VideoCall';
import toast from 'react-hot-toast';
import { Coins } from 'lucide-react';

export const Home = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);

  useEffect(() => {
    fetchHosts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('call:offer', handleIncomingCall);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('call:offer');
      socket.off('call:rejected');
      socket.off('call:ended');
    };
  }, [socket]);

  const fetchHosts = async () => {
    try {
      const response = await hostService.getOnlineHosts({ page: 1, limit: 50 });
      console.log('📋 Fetched hosts:', response.data.hosts); // ADD THIS
      setHosts(response.data.hosts);
    } catch (error) {
      toast.error('Failed to load hosts');
    } finally {
      setLoading(false);
    }
  };

  const handleIncomingCall = ({ from, offer, callId, caller }) => {
    console.log('📞 Incoming call from:', from, 'caller:', caller); // ADD THIS
    toast((t) => (
      <div className="flex flex-col">
        <p className="font-semibold mb-2">Incoming call from {caller.name}</p>
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
    console.log('✅ Accepting call from:', from); // ADD THIS
    setCurrentCall({ from, callId, offer, isIncoming: true }); // ADD isIncoming flag
    setInCall(true);
  };

  const rejectIncomingCall = (from, callId) => {
    if (socket) {
      socket.emit('call:reject', { to: from, callId, reason: 'User declined' });
    }
  };

  const handleCallRejected = ({ callId, reason }) => {
    toast.error(`Call rejected: ${reason}`);
    setInCall(false);
    setCurrentCall(null);
  };

  const handleCallEnded = () => {
    setInCall(false);
    setCurrentCall(null);
    toast.success('Call ended');
    fetchHosts();
  };

  const handleCallHost = async (host) => {
    console.log('📞 Calling host:', host); // ADD THIS
    
    // if (!user) {
    //   toast.error('Please login first');
    //   navigate('/login');
    //   return;
    // }

    // if (user.coinBalance < host.ratePerMinute) {
    //   toast.error('Insufficient coins. Please recharge!');
    //   navigate('/coins');
    //   return;
    // }

    try {
      const response = await callService.initiateCall(host._id);
      const callData = response.data.call;
      
      console.log('📞 Call data:', callData); // ADD THIS
      console.log('📞 Host data:', host); // ADD THIS
      
      // FIX: Determine the correct user ID path
      // The host user ID might be in different locations depending on your API response
      const hostUserId = host.userId?._id || host.userId || host.user?._id || host._id;
      
      console.log('🆔 Using host user ID:', hostUserId); // ADD THIS
      
      setCurrentCall({ 
        callId: callData._id || callData.id, 
        hostId: hostUserId, // FIXED
        host,
        isIncoming: false
      });
      setInCall(true);
    } catch (error) {
      console.error('❌ Error initiating call:', error); // ADD THIS
      toast.error(error.response?.data?.message || 'Failed to initiate call');
    }
  };

  const handleEndCall = async () => {
    console.log('☎️ Ending call:', currentCall); // ADD THIS
    
    if (currentCall?.callId) {
      try {
        await callService.endCall(currentCall.callId);
        if (socket) {
          const recipientId = currentCall.hostId || currentCall.from;
          console.log('📤 Sending call:end to:', recipientId); // ADD THIS
          
          socket.emit('call:end', { 
            to: recipientId, 
            callId: currentCall.callId 
          });
        }
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    setInCall(false);
    setCurrentCall(null);
    fetchHosts();
  };

  if (inCall && currentCall) {
    const remoteUserId = currentCall.hostId || currentCall.from;
    console.log('🎥 Rendering video call with remote user:', remoteUserId); // ADD THIS
    
    return (
      <VideoCallComponent
        callId={currentCall.callId}
        remoteUserId={remoteUserId}
        onEnd={handleEndCall}
        isHost={currentCall.isIncoming} // Host is the one receiving the call
        incomingOffer={currentCall.offer} // Pass the offer if it's an incoming call
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Live Hosts</h1>
          <button 
            onClick={() => navigate('/coins')}
            className="flex items-center space-x-1.5 bg-yellow-50 px-3 py-1.5 rounded-full hover:bg-yellow-100 transition-colors"
          >
            <Coins className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold text-gray-900">{user?.coinBalance || 0}</span>
          </button>
        </div>
      </div>

      {/* Hosts Grid */}
      <main className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : hosts.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {hosts.map((host) => (
              <HostCard key={host._id} host={host} onCall={handleCallHost} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hosts available</p>
            <p className="text-gray-400 text-sm mt-2">Check back later</p>
          </div>
        )}
      </main>
    </div>
  );
};