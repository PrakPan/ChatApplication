import { useState, useEffect } from 'react';
import { Check, X, Eye, AlertCircle, Image as ImageIcon, Clock } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5500/api/v1';

export const PhotoApprovalPanel = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const { data } = await axios.get(`${API_BASE_URL}/admin/photos/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📸 Received data:', data.data.approvals); // Add logging
      setPendingApprovals(data.data.approvals);
    } catch (error) {
      alert('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (hostId, photoIndex) => {
  try {
    const token = localStorage.getItem('adminToken');
    console.log(`🟢 Approving: hostId=${hostId}, photoIndex=${photoIndex}`);
    
    await axios.patch(
      `${API_BASE_URL}/admin/photos/${hostId}/${photoIndex}/approve`, // Use photoIndex
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    alert('Photo approved successfully!');
    fetchPendingApprovals();
  } catch (error) {
    console.error('❌ Approve error:', error.response?.data);
    alert(error.response?.data?.message || 'Failed to approve photo');
  }
};

const openRejectModal = (hostId, photoIndex) => {
  console.log(`📝 Opening reject: hostId=${hostId}, photoIndex=${photoIndex}`);
  setSelectedHost(hostId);
  setSelectedPhoto(photoIndex);
  setShowRejectModal(true);
};

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      console.log(`🔴 Rejecting: hostId=${selectedHost}, photoId=${selectedPhoto}`); // Add logging
      
      await axios.patch(
        `${API_BASE_URL}/admin/photos/${selectedHost}/${selectedPhoto}/reject`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Photo rejected successfully!');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedHost(null);
      setSelectedPhoto(null);
      fetchPendingApprovals();
    } catch (error) {
      console.error('❌ Reject error:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to reject photo');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Photo Approvals</h2>
          <p className="text-sm text-gray-500 mt-1">
            {pendingApprovals.length} host(s) waiting for photo approval
          </p>
        </div>
        <button
          onClick={fetchPendingApprovals}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">All caught up!</h3>
          <p className="text-gray-500">No pending photo approvals at the moment</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingApprovals.map((approval) => (
            <div key={approval.hostId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Host Info Header */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{approval.hostName}</h3>
                    <p className="text-sm text-gray-600">{approval.hostEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      approval.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : approval.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {approval.status}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      {approval.pendingPhotos.length} photos pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Photos Grid */}
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {approval.pendingPhotos.map((photo) => (
  <div key={photo.photoIndex} className="group relative"> {/* Use photoIndex as key */}
    {/* Photo content */}
    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
      <img
        src={photo.url}
        alt={`Photo ${photo.photoIndex + 1}`}
        className="w-full h-full object-cover"
      />
    </div>

    {/* Overlay with Actions */}
    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-xl flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
      <button
        onClick={() => handleApprove(approval.hostId, photo.photoIndex)} 
        className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg transform hover:scale-110"
        title="Approve"
      >
        <Check className="w-5 h-5" />
      </button>
      <button
        onClick={() => openRejectModal(approval.hostId, photo.photoIndex)}
        className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg transform hover:scale-110"
        title="Reject"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Photo Index Badge */}
    <div className="absolute top-2 left-2 bg-black bg-opacity-50 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-semibold">
      #{photo.photoIndex + 1}
    </div>

    {/* Pending Badge */}
    <div className="absolute top-2 right-2">
      <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
        <Clock className="w-3 h-3" />
        Pending
      </div>
    </div>
  </div>
))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reject Photo</h3>
                <p className="text-sm text-gray-600">Provide a reason for rejection</p>
              </div>
            </div>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="E.g., Photo quality is poor, inappropriate content, etc."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows="4"
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedHost(null);
                  setSelectedPhoto(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};