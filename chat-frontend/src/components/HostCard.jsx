import { Video, Star, DollarSign, Globe, Radio } from 'lucide-react';

export const HostCard = ({ host, onCall }) => {
  const user = host.userId;
  
  // Default avatar with gradient background and user icon
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234F46E5;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%237C3AED;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23grad)'/%3E%3Ccircle cx='200' cy='150' r='60' fill='white' opacity='0.3'/%3E%3Ccircle cx='200' cy='280' r='80' fill='white' opacity='0.3'/%3E%3C/svg%3E";

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col items-center w-full max-w-[160px] sm:max-w-[140px] mx-auto relative group hover:shadow-lg transition-shadow duration-300">
      {/* Online Status Badge - Top Right */}
      {host.isOnline && (
        <div className="absolute top-2 right-2 z-10">
          <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-md"></div>
        </div>
      )}

      {/* Profile Image */}
      <div className="relative w-full aspect-square overflow-hidden bg-gray-100">
        <img
          src={user.avatar || defaultAvatar}
          alt={user.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="w-full p-3 space-y-1">
        {/* Name */}
        <h3 className="text-sm font-semibold text-gray-900 truncate text-center">
          {user.name}
        </h3>

        {/* Online Status Text */}
        <div className="flex items-center justify-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${host.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <p className="text-xs text-gray-600">
            {host.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Bio/Description */}
        {host.bio && (
          <p className="text-xs text-gray-500 text-center line-clamp-2 leading-relaxed">
            {host.bio}
          </p>
        )}

        {/* Rate */}
        <p className="text-xs text-gray-700 font-medium text-center">
          ${host.ratePerMinute} coins/min
        </p>

        {/* Call Button */}
        <button
          onClick={() => onCall(host)}
          disabled={!host.isOnline}
          className={`w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
            host.isOnline
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {host.isOnline ? 'Call' : 'Offline'}
        </button>
      </div>
    </div>
  );
};