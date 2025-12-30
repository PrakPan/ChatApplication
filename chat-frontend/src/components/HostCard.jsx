import { Star, Zap } from "lucide-react";

export const HostCard = ({ host, onCall, onViewProfile }) => {
  const user = host.userId || host.user;

  // Get first approved photo or avatar
  const approvedPhotos = (host.photos || []).filter(
    (photo) => photo.approvalStatus === "approved" || !photo.approvalStatus
  );
  const displayPhoto =
    approvedPhotos[0]?.url || approvedPhotos[0] || user?.avatar;

  // Default avatar SVG
  const defaultAvatar =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234F46E5;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%237C3AED;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23grad)'/%3E%3Ccircle cx='200' cy='150' r='60' fill='white' opacity='0.3'/%3E%3Ccircle cx='200' cy='280' r='80' fill='white' opacity='0.3'/%3E%3C/svg%3E";

  return (
    <div
      onClick={() => onViewProfile(host)}
      className="group relative bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
    >
      {/* Image Container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
        <img
          src={displayPhoto || defaultAvatar}
          alt={user?.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Online Status Badge */}
        {host.isOnline ? (
          host.callStatus === "busy" ? (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-xs font-medium text-gray-700">On Call</span>
            </div>
          ) : (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-700">
                Available
              </span>
            </div>
          )
        ) : (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full shadow-sm">
            <div className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-xs font-medium text-gray-700">Offline</span>
          </div>
        )}

        {/* Rating Badge */}
        {host.rating > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-lg">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-gray-900">
              {host.rating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Quick View Overlay (appears on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <span className="text-sm font-bold text-gray-900">
              View Profile
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name */}
        <div>
          <h3 className="text-base font-bold text-gray-900 truncate mb-0.5">
            {user?.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                host.isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                host.isOnline ? "text-green-600" : "text-gray-500"
              }`}
            >
              {host.isOnline ? "Available now" : "Offline"}
            </span>
          </div>
        </div>

        {/* Bio */}
        {host.bio && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
            {host.bio}
          </p>
        )}

        {/* Rate and Call Button */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold text-gray-900">
              {host.ratePerMinute}
            </span>
            <span className="text-xs text-gray-500">coins/min</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onCall(host);
            }}
            disabled={!host.isOnline || host.callStatus === "busy"}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              host.isOnline && host.callStatus !== "busy"
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {host.callStatus === "busy" ? "On Call" : "Call Now"}
          </button>
        </div>
      </div>

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0  bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer pointer-events-none" />
    </div>
  );
};
