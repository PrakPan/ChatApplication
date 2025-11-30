import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { callService } from '../services/callService';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, Coins, LogOut, X, Users, 
  Heart, History, Trophy, Link2, ImagePlus,
  Phone, Mail, Edit3, Crown, Gem, Calendar, User,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HostPhotoUploadModal } from '../components/HostPhotoUploadModal';
import api from '../services/api';

export const Profile = () => {
  const { user, logout, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [drawerData, setDrawerData] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [userPhotos, setUserPhotos] = useState([]);
  
  // Edit modals
  const [showEditModal, setShowEditModal] = useState(null); // 'name', 'bio', 'dob', 'avatar'
  const [editValue, setEditValue] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';
  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dw3gi24uf';
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'host_photos_preset';
  
  const navigate = useNavigate();

  const handleUploadSuccess = (newPhotos) => {
  setUserPhotos(newPhotos);
  // Optionally refresh user data
};

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProfileData(data.data);
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const openDrawer = async (type) => {
    setActiveDrawer(type);
    setDrawerLoading(true);
    setDrawerData([]);

    try {
      let response;
      switch(type) {
        case 'history':
          response = await callService.getHistory({ page: 1, limit: 50 });
          setDrawerData(response.data.calls);
          break;
        case 'followers':
          response = await fetch(`${API_URL}/follow/followers`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
          });
          const followersData = await response.json();
          setDrawerData(followersData.data?.followers || []);
          break;
        case 'following':
          response = await fetch(`${API_URL}/follow/following`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
          });
          const followingData = await response.json();
          setDrawerData(followingData.data?.following || []);
          break;
        case 'levels':
          // Data already in profileData
          break;
        case 'agent':
          response = await fetch(`${API_URL}/agents/dashboard`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
          });
          const agentData = await response.json();
          setDrawerData(agentData.data);
          break;
        case 'richLevelTable':
        case 'charmLevelTable':
          // Show level progression tables
          break;
      }
    } catch (error) {
      console.error('Drawer error:', error);
      toast.error(`Failed to load ${type}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
    setDrawerData([]);
  };

  const handleEditClick = (type, currentValue = '') => {
    setShowEditModal(type);
    setEditValue(currentValue);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim() && showEditModal !== 'dob') {
      toast.error('Value cannot be empty');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/profile/${showEditModal}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [showEditModal]: editValue })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`${showEditModal} updated successfully`);
        setShowEditModal(null);
        fetchProfile();
        if (updateUser) {
          updateUser({ [showEditModal]: editValue });
        }
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

 const handleAvatarUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast.error('Please select an image');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.error('Image size should be less than 5MB');
    return;
  }

  setUploading(true);

  try {
    // 1. Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'avatars');

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    const cloudData = await cloudRes.json();
    const avatarUrl = cloudData.secure_url;

    // 2. Save URL to backend
    const res = await api.put('/profile/avatar', { avatar: avatarUrl });

    if (res.success) {
      toast.success('Avatar updated!');
      updateUser?.({ avatar: avatarUrl });
    } else {
      toast.error('Failed to save avatar');
    }

  } catch (err) {
    toast.error('Upload failed',err.message);
    console.error('Upload failed',err.message);
  } finally {
    setUploading(false);
  }
};


  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const getNextLevelInfo = (type, current) => {
    // You'll need to get this from API or hardcode the thresholds
    
    const RICH_THRESHOLDS = [
      { level: 1, diamonds: 0 },
      { level: 2, diamonds: 1000 },
      { level: 3, diamonds: 6000 },
      { level: 4, diamonds: 125000 },
      { level: 5, diamonds: 250000 },
      { level: 6, diamonds: 500000 },
      { level: 7, diamonds: 1000000 },
      { level: 8, diamonds: 2000000 },
      { level: 9, diamonds: 3125000 }
    ];

    const CHARM_THRESHOLDS = [
      { level: 1, beans: 0 },
      { level: 2, beans: 1 },
      { level: 3, beans: 10 },
      { level: 4, beans: 1000000 },
      { level: 5, beans: 2000000 },
      { level: 6, beans: 2500000 },
      { level: 7, beans: 3000000 }
    ];

    const thresholds = type === 'rich' ? RICH_THRESHOLDS : CHARM_THRESHOLDS;
    const key = type === 'rich' ? 'diamonds' : 'beans';
    
    for (let threshold of thresholds) {
      if (current < threshold[key]) {
        return {
          nextLevel: threshold.level,
          needed: threshold[key] - current,
          total: threshold[key]
        };
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  const { level, followStats, hostInfo, agentInfo } = profileData || {};
  const nextRichLevel = getNextLevelInfo('rich', level?.totalDiamondsRecharged || 0);
  const nextCharmLevel = user?.role === 'host' ? getNextLevelInfo('charm', level?.totalBeansEarned || 0) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-purple-100 rounded-full transition-all duration-300"
            >
              <ChevronLeft className="w-6 h-6 text-purple-700" />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              My Profile
            </h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile Card */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl p-6 border border-purple-100">
          {/* Avatar & Name */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 flex items-center justify-center text-white text-4xl font-bold shadow-2xl ring-4 ring-purple-100">
                {uploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                ) : user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0)?.toUpperCase() || 'U'
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50"
              >
                <ImagePlus className="w-5 h-5 " />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {user?.name || 'User'}
              </h2>
              <button 
                onClick={() => handleEditClick('name', user?.name)}
                className="text-gray-400 hover:text-purple-600 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            
            {user?.role && (
              <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-full font-medium">
                {user.role}
              </span>
            )}

            {/* DOB */}
            {user?.dob && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(user.dob).split(',')[0]}</span>
                <button 
                  onClick={() => handleEditClick('dob', user?.dob)}
                  className="text-gray-400 hover:text-purple-600 transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Level Badges */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => openDrawer('richLevelTable')}
                className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full hover:scale-105 transition-transform"
              >
                <Crown className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">Rich Lv {level?.richLevel || 1}</span>
              </button>
              
              {user?.role === 'host' && (
                <button
                  onClick={() => openDrawer('charmLevelTable')}
                  className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full hover:scale-105 transition-transform"
                >
                  <Gem className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">Charm Lv {level?.charmLevel || 1}</span>
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <button 
                onClick={() => openDrawer('followers')}
                className="text-center hover:scale-105 transition-transform"
              >
                <div className="text-2xl font-bold text-purple-600">{followStats?.followersCount || 0}</div>
                <div className="text-xs text-gray-500">Followers</div>
              </button>
              <button 
                onClick={() => openDrawer('following')}
                className="text-center hover:scale-105 transition-transform"
              >
                <div className="text-2xl font-bold text-pink-600">{followStats?.followingCount || 0}</div>
                <div className="text-xs text-gray-500">Following</div>
              </button>
              {user?.role === 'host' && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{hostInfo?.totalCalls || 0}</div>
                  <div className="text-xs text-gray-500">Calls</div>
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="w-full mt-4">
              {user?.bio ? (
                <div className="relative">
                  <p className="text-center text-gray-600 max-w-md mx-auto">{user.bio}</p>
                  <button 
                    onClick={() => handleEditClick('bio', user?.bio)}
                    className="absolute top-0 right-0 text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleEditClick('bio', '')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  + Add bio
                </button>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-2">
            {/* Levels */}
             
             {user?.role == 'host' ? <> <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <span className="text-base font-medium text-gray-700 flex gap-2"> <ImagePlus className="w-9 h-9  bg-gradient-to-r from-purple-500 to-pink-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50" /> Upload Photos</span>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" onClick={()=>setShowPhotoModal(true)}/>
              </div>
            </button> </>: null} 


            <button 
              onClick={() => openDrawer('levels')}
              className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-semibold text-gray-700">My Levels</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-600">
                  Rich {level?.richLevel || 1} {user?.role === 'host' && `• Charm ${level?.charmLevel || 1}`}
                </span>
              </div>
            </button>

            {/* Get More Coins */}
            <button 
              onClick={() => navigate('/coins')}
              className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-semibold text-gray-700">Get More Coins</span>
              </div>
            </button>

            {/* Coin Balance */}
            <button 
              className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-xl">
                  <Gem className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-semibold text-gray-700">Balance</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {user?.coinBalance || hostInfo?.totalEarnings || 0}
              </span>
            </button>

            {/* Video Chat History */}
            <button 
              onClick={() => openDrawer('history')}
              className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all duration-300 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl">
                  <History className="w-5 h-5 text-white" />
                </div>
                <span className="text-base font-semibold text-gray-700">Call History</span>
              </div>
            </button>

            {/* Agent Section */}
            {(agentInfo || hostInfo?.agentId) && (
              <button 
                onClick={() => openDrawer('agent')}
                className="w-full flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 rounded-2xl transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-xl">
                    <Link2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base font-semibold text-gray-700">
                    {agentInfo ? 'Agent Dashboard' : 'My Agent'}
                  </span>
                </div>
                {hostInfo?.agentId && (
                  <span className="text-sm font-mono text-purple-600">{hostInfo.agentId}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-4 flex items-center justify-center gap-3 hover:bg-red-50 transition-all duration-300 border border-red-100 group"
        >
          <LogOut className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
          <span className="text-base font-semibold text-red-500">Log out</span>
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 capitalize">Edit {showEditModal}</h3>
            
            {showEditModal === 'bio' ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="4"
                maxLength="500"
                placeholder="Tell us about yourself..."
              />
            ) : showEditModal === 'dob' ? (
              <input
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder={`Enter your ${showEditModal}`}
              />
            )}
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowEditModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer - CONTINUE IN NEXT PART */}

{/* Drawer */}
{activeDrawer && (
  <div 
    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
    onClick={closeDrawer}
  >
    <div 
      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drawer Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-3xl z-10">
        <h3 className="text-xl font-bold text-gray-900 capitalize">
          {activeDrawer.replace('Table', ' Progression')}
        </h3>
        <button 
          onClick={closeDrawer}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-4">
        {drawerLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {activeDrawer === 'history' && (
              <div className="space-y-3">
                {drawerData.length > 0 ? drawerData.map((call) => (
                  <div key={call._id} className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                        {call.hostId?.userId?.name?.charAt(0) || 'H'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{call.hostId?.userId?.name || 'Unknown'}</h4>
                        <p className="text-sm text-gray-500">{formatDate(call.startTime)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{Math.floor(call.duration / 60)}m</p>
                        <p className="text-xs text-gray-500">{call.coinsSpent} coins</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">No call history</div>
                )}
              </div>
            )}

            {activeDrawer === 'followers' && (
              <div className="space-y-3">
                {drawerData.length > 0 ? drawerData.map((follower) => (
                  <div key={follower._id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                      {follower.avatar ? (
                        <img src={follower.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                      ) : (
                        follower.name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{follower.name}</h4>
                      <p className="text-sm text-gray-500">{follower.email}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">No followers yet</div>
                )}
              </div>
            )}

            {activeDrawer === 'following' && (
              <div className="space-y-3">
                {drawerData.length > 0 ? drawerData.map((following) => (
                  <div key={following._id} className="bg-gray-50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                      {following.avatar ? (
                        <img src={following.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                      ) : (
                        following.name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{following.name}</h4>
                      <p className="text-sm text-gray-500">{following.role}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">Not following anyone yet</div>
                )}
              </div>
            )}

            {activeDrawer === 'richLevelTable' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Current Level</div>
                      <div className="text-4xl font-bold text-yellow-600">Level {level?.richLevel || 1}</div>
                    </div>
                    <Crown className="w-16 h-16 text-yellow-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Diamonds Recharged</span>
                      <span className="font-bold text-yellow-600">{(level?.totalDiamondsRecharged || 0).toLocaleString()}</span>
                    </div>
                    {nextRichLevel && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Next Level</span>
                          <span className="font-bold">Level {nextRichLevel.nextLevel}</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${((level?.totalDiamondsRecharged || 0) / nextRichLevel.total) * 100}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          {nextRichLevel.needed.toLocaleString()} diamonds to Level {nextRichLevel.nextLevel}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4">
                    <h4 className="font-bold text-white">Rich Level Progression</h4>
                    <p className="text-xs text-yellow-100 mt-1">Based on total diamonds recharged</p>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Level</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Diamonds Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { level: 1, diamonds: 0 },
                        { level: 2, diamonds: 1000 },
                        { level: 3, diamonds: 6000 },
                        { level: 4, diamonds: 125000 },
                        { level: 5, diamonds: 250000 },
                        { level: 6, diamonds: 500000 },
                        { level: 7, diamonds: 1000000 },
                        { level: 8, diamonds: 2000000 },
                        { level: 9, diamonds: 3125000 }
                      ].map((item) => (
                        <tr 
                          key={item.level}
                          className={`${(level?.richLevel || 1) === item.level ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(level?.richLevel || 1) === item.level && (
                                <Crown className="w-4 h-4 text-yellow-500" />
                              )}
                              <span className={`font-semibold ${(level?.richLevel || 1) === item.level ? 'text-yellow-600' : 'text-gray-700'}`}>
                                Level {item.level}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                            {item.diamonds.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeDrawer === 'charmLevelTable' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 border-2 border-pink-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Current Level</div>
                      <div className="text-4xl font-bold text-pink-600">Level {level?.charmLevel || 1}</div>
                    </div>
                    <Gem className="w-16 h-16 text-pink-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Beans Earned</span>
                      <span className="font-bold text-pink-600">{(level?.totalBeansEarned || 0).toLocaleString()}</span>
                    </div>
                    {nextCharmLevel && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Next Level</span>
                          <span className="font-bold">Level {nextCharmLevel.nextLevel}</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-pink-400 to-purple-400 h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${((level?.totalBeansEarned || 0) / nextCharmLevel.total) * 100}%`
                            }}
                          ></div>
                        </div>
                        <div className="text-center text-sm text-gray-600">
                          {nextCharmLevel.needed.toLocaleString()} beans to Level {nextCharmLevel.nextLevel}
                        </div>
                      </>
                    )}
                    <div className="mt-4 p-3 bg-white rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Your Rate</div>
                      <div className="text-2xl font-bold text-pink-600">
                        {hostInfo?.ratePerMinute || 50} beans/min
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-4">
                    <h4 className="font-bold text-white">Charm Level Progression</h4>
                    <p className="text-xs text-pink-100 mt-1">Based on total beans earned from calls</p>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Level</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Beans Required</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Rate/Min</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { level: 1, beans: 0, rate: 50 },
                        { level: 2, beans: 1, rate: 100 },
                        { level: 3, beans: 10, rate: 150 },
                        { level: 4, beans: 1000000, rate: 200 },
                        { level: 5, beans: 2000000, rate: 250 },
                        { level: 6, beans: 2500000, rate: 300 },
                        { level: 7, beans: 3000000, rate: 350 }
                      ].map((item) => (
                        <tr 
                          key={item.level}
                          className={`${(level?.charmLevel || 1) === item.level ? 'bg-pink-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(level?.charmLevel || 1) === item.level && (
                                <Gem className="w-4 h-4 text-pink-500" />
                              )}
                              <span className={`font-semibold ${(level?.charmLevel || 1) === item.level ? 'text-pink-600' : 'text-gray-700'}`}>
                                Level {item.level}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                            {item.beans.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-pink-600">
                            {item.rate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeDrawer === 'levels' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-6 h-6 text-yellow-600" />
                    <h4 className="text-lg font-bold text-gray-900">Rich Level</h4>
                  </div>
                  <div className="text-3xl font-bold text-yellow-600 mb-2">Level {level?.richLevel || 1}</div>
                  <p className="text-sm text-gray-600">Total Diamonds: {(level?.totalDiamondsRecharged || 0).toLocaleString()}</p>
                  <button
                    onClick={() => {
                      closeDrawer();
                      setTimeout(() => openDrawer('richLevelTable'), 300);
                    }}
                    className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 font-semibold"
                  >
                    View Progression Table →
                  </button>
                </div>

                {user?.role === 'host' && (
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Gem className="w-6 h-6 text-pink-600" />
                      <h4 className="text-lg font-bold text-gray-900">Charm Level</h4>
                    </div>
                    <div className="text-3xl font-bold text-pink-600 mb-2">Level {level?.charmLevel || 1}</div>
                    <p className="text-sm text-gray-600">Total Beans Earned: {(level?.totalBeansEarned || 0).toLocaleString()}</p>
                    <p className="text-sm text-pink-600 font-semibold mt-2">Rate: {hostInfo?.ratePerMinute || 50} beans/min</p>
                    <button
                      onClick={() => {
                        closeDrawer();
                        setTimeout(() => openDrawer('charmLevelTable'), 300);
                      }}
                      className="mt-3 text-sm text-pink-600 hover:text-pink-700 font-semibold"
                    >
                      View Progression Table →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeDrawer === 'agent' && (
              <div className="space-y-4">
                {agentInfo ? (
                  <>
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-1">Agent ID</div>
                        <div className="text-2xl font-mono font-bold text-indigo-600">{agentInfo.agentId}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-600">{agentInfo.hostCount || 0}</div>
                          <div className="text-xs text-gray-600">Hosts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-600">{agentInfo.totalHostEarnings || 0}</div>
                          <div className="text-xs text-gray-600">Total Earnings</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-600">{agentInfo.agentCommission || 0}</div>
                          <div className="text-xs text-gray-600">Commission</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 text-center">
                    <div className="text-sm text-gray-600 mb-1">Linked to Agent</div>
                    <div className="text-2xl font-mono font-bold text-indigo-600">{hostInfo?.agentId}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
)}

<HostPhotoUploadModal
  isOpen={showPhotoModal}
  onClose={() => setShowPhotoModal(false)}
  currentPhotos={userPhotos}
  onUploadSuccess={handleUploadSuccess}
/>
</div>
); 
}; 