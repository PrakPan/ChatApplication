import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hostService } from '../services/hostService';
import toast from 'react-hot-toast';
import { ChevronLeft, Coins } from 'lucide-react';

export const HostDashboard = () => {
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const response = await hostService.getHosts({ status: 'online' });
      setHosts(response.data.hosts);
    } catch (error) {
      toast.error('Failed to load hosts');
    } finally {
      setLoading(false);
    }
  };

  const handleCallHost = (hostId) => {
    // Navigate to call screen
    console.log('Calling host:', hostId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Live Hosts</h1>
            <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-full border border-yellow-200">
              <Coins className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-gray-900">{user?.coinBalance || 0}</span>
            </div>
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
                onClick={() => handleCallHost(host._id)}
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
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No hosts online</h3>
            <p className="text-gray-500">Check back later for available hosts</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Spacer */}
      <div className="h-20" />
    </div>
  );
};