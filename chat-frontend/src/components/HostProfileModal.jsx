import { X, Star, DollarSign, Globe, MapPin, Check, Clock, Phone } from 'lucide-react';
import { useState } from 'react';

export const HostProfileModal = ({ host, onClose, onCall }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  const user = host.userId || host.user;
  const approvedPhotos = (host.photos || []).filter(photo => 
    photo.approvalStatus === 'approved' || !photo.approvalStatus
  );
  
  const displayPhoto = approvedPhotos[selectedPhotoIndex]?.url || 
                       approvedPhotos[selectedPhotoIndex] || 
                       user?.avatar;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Host Profile</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Main Photo */}
        <div className="relative">
          <div className="aspect-[4/5] bg-gradient-to-br from-purple-100 to-pink-100">
            <img
              src={displayPhoto}
              alt={user?.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Online Status Badge */}
          {host.isOnline && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-900">Online</span>
            </div>
          )}

          {/* Photo Navigation */}
          {approvedPhotos.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {approvedPhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPhotoIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === selectedPhotoIndex
                      ? 'bg-white w-6'
                      : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name and Basic Info */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{user?.name}</h3>
            
            {/* Stats Row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold text-gray-900">
                  {host.rating ? host.rating.toFixed(1) : '5.0'}
                </span>
                <span className="text-gray-500">
                  ({host.totalRatings || 0} reviews)
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{host.totalCalls || 0} calls</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-gray-900">
                  {host.ratePerMinute} coins/min
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          {host.bio && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">About</h4>
              <p className="text-gray-700 leading-relaxed">{host.bio}</p>
            </div>
          )}

          {/* Languages */}
          {host.languages && host.languages.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                Languages
              </h4>
              <div className="flex flex-wrap gap-2">
                {host.languages.map((lang, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {host.interests && host.interests.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Interests</h4>
              <div className="flex flex-wrap gap-2">
                {host.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {approvedPhotos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Photos</h4>
              <div className="grid grid-cols-4 gap-2">
                {approvedPhotos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`aspect-square rounded-lg overflow-hidden ${
                      index === selectedPhotoIndex
                        ? 'ring-2 ring-purple-600'
                        : ''
                    }`}
                  >
                    <img
                      src={photo.url || photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Call Button */}
          <button
            onClick={() => {
              onCall(host);
              onClose();
            }}
            disabled={!host.isOnline}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
              host.isOnline
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {host.isOnline ? '📞 Start Call' : 'Host is Offline'}
          </button>

          {!host.isOnline && (
            <p className="text-center text-sm text-gray-500">
              This host is currently offline. Try again later!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};