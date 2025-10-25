import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { callService } from '../services/callService';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Coins, User, LogOut } from 'lucide-react';

export const Profile = () => {
  const { user, logout } = useAuth();
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const fetchCallHistory = async () => {
    try {
      const response = await callService.getHistory({ page: 1, limit: 10 });
      setCallHistory(response.data.calls);
    } catch (error) {
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en', { month: 'short' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${month}. ${year} ${time}`;
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          {/* Avatar & Name */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-4xl font-bold mb-4 shadow-lg">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {user?.name || 'User'}
            </h2>
            {user?.role && (
              <span className="text-sm text-gray-500 capitalize">{user.role}</span>
            )}
          </div>

          {/* Menu Items */}
          <div className="space-y-1">
            {/* Get More Coins */}
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <span className="text-base font-medium text-gray-700">Get More Coins</span>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </button>

            {/* Coin Balance */}
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <span className="text-base font-medium text-gray-700">Coin Balance</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{user?.coinBalance || 0}</span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
              </div>
            </button>

            {/* Video Chat History */}
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <span className="text-base font-medium text-gray-700">Video Chat History</span>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </button>

            {/* Following */}
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <span className="text-base font-medium text-gray-700">Following</span>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
            </button>
          </div>
        </div>

        {/* Log in Button (or Logout if authenticated) */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors mb-4"
        >
          <LogOut className="w-5 h-5 text-gray-700" />
          <span className="text-base font-medium text-gray-700">Log out</span>
        </button>

        {/* Call History Section (expanded view) */}
        {callHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Calls</h3>
            <div className="space-y-4">
              {callHistory.slice(0, 3).map((call) => (
                <div
                  key={call._id}
                  className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0"
                >
                  {/* Host Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {call.hostId?.userId?.avatar ? (
                      <img
                        src={call.hostId.userId.avatar}
                        alt={call.hostId?.userId?.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      call.hostId?.userId?.name?.charAt(0)?.toUpperCase() || 'H'
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {call.hostId?.userId?.name || 'Unknown Host'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatDate(call.startTime)}
                    </p>
                  </div>

                  {/* Duration & Coins */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      Tday {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Used {call.coinsSpent} coins
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Spacer */}
      <div className="h-20" />
    </div>
  );
};