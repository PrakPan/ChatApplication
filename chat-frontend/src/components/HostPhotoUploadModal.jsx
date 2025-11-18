import { useState } from 'react';
import { X, Upload, Image, Trash2, Camera, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

// Create axios instance with base config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1'
});

// Add request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const HostPhotoUploadModal = ({ isOpen, onClose, currentPhotos = [], onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Cloudinary config - replace with your values
  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dw3gi24uf';
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'host_photos_preset';

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (files) => {
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error('Only images are allowed!');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return false;
      }
      return true;
    });

    if (selectedFiles.length + validFiles.length > 5) {
      toast.error('Max 5 photos allowed!');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Upload directly to Cloudinary using fetch
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'host-photos');

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error('Cloudinary upload failed');
      }
      
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload to Cloudinary');
    }
  };

  const savePhotosToBackend = async (photoUrls) => {
    try {
      console.log('Sending to backend:', photoUrls);
      console.log('Type check:', photoUrls.map(u => typeof u));
      
      const response = await api.post('/hosts/photos/save', {
        photos: photoUrls // This should be ["url1", "url2"]
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') }`
        }
      });
      
      console.log('Backend response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Backend save error:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  };
  // Save photo URLs to backend
//  const savePhotosToBackend = async (photoUrls) => {
//     try {
//       const response = await api.post('/hosts/photos/save', {
//         photos: photoUrls 
//       }, {
//         headers: {
//           'Content-Type': 'application/json',
//            Authorization: `Bearer ${localStorage.getItem('accessToken') }`
//         }
//       });
//       return response.data;
//     } catch (error) {
//       console.error('Backend save error:', error);
//       console.error('Error details:', error.response?.data);
//       throw error;
//     }
//   };

   const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one photo');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      toast.loading('Uploading photos to Cloudinary...', { id: 'upload' });

      // Upload all files to Cloudinary first (no auth needed)
      const uploadPromises = selectedFiles.map((file, index) => {
        return uploadToCloudinary(file).then(url => {
          const progress = Math.round(((index + 1) / selectedFiles.length) * 100);
          setUploadProgress(progress);
          toast.loading(`Uploaded ${index + 1}/${selectedFiles.length}...`, { id: 'upload' });
          return url;
        });
      });

      const photoUrls = await Promise.all(uploadPromises);

      // Now check token before saving to backend
      const token = 
                    localStorage.getItem('accessToken') || 
                    localStorage.getItem('authToken') || 
                    sessionStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login to save photos', { id: 'upload' });
        console.error('No token found. Photos uploaded to Cloudinary but not saved to database.');
        console.log('Photo URLs (save these):', photoUrls);
        return;
      }

      // Save URLs to backend
      toast.loading('Saving to database...', { id: 'upload' });
      const response = await savePhotosToBackend(photoUrls);

      toast.success('Photos uploaded successfully! 🔥', { id: 'upload' });
      onUploadSuccess && onUploadSuccess(response.data.photos);
      
      // Reset state
      setSelectedFiles([]);
      setPreviews([]);
      setUploadProgress(0);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload photos';
      toast.error(errorMessage, { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-purple-900 via-pink-900 to-rose-900 rounded-3xl shadow-2xl max-h-[120vh] overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
        
        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Upload Your Vibe</h2>
              <p className="text-sm text-white/70">Show off your personality ✨</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="relative p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Current Photos */}
          {currentPhotos.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-white/90">Current Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {currentPhotos.map((photo, index) => (
                  <div key={index} className="relative overflow-hidden rounded-2xl aspect-square group">
                    <img
                      src={photo.url || photo}
                      alt={`Current ${index + 1}`}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center transition-opacity bg-black/50 opacity-0 group-hover:opacity-100">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-3xl p-8 transition-all ${
              dragActive
                ? 'border-pink-400 bg-pink-500/10'
                : 'border-white/30 hover:border-white/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="photo-upload"
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
            />
            
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="p-4 mb-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-600">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Drop your fire pics here</h3>
              <p className="mb-4 text-sm text-white/70">or click to browse (max 5 photos, 5MB each)</p>
              <div className="px-6 py-2 font-semibold text-white transition-all bg-white/20 rounded-full hover:bg-white/30 backdrop-blur-sm">
                Choose Files
              </div>
            </label>
          </div>

          {/* Preview Grid */}
          {previews.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-white/90">
                Selected Photos ({previews.length}/5)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative overflow-hidden rounded-2xl aspect-square group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="object-cover w-full h-full"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute flex items-center justify-center w-8 h-8 transition-all transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full shadow-lg top-2 right-2 hover:bg-red-600 hover:scale-110"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-xs text-center text-white bg-gradient-to-t from-black/50 to-transparent">
                      {selectedFiles[index]?.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && uploadProgress > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">Uploading...</span>
                <span className="text-sm text-white/70">{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div 
                  className="h-full transition-all duration-300 bg-gradient-to-r from-pink-500 to-purple-600"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="p-4 mt-6 border rounded-2xl bg-white/5 border-white/10 backdrop-blur-sm">
            <h4 className="mb-2 text-sm font-semibold text-white">Pro Tips 💡</h4>
            <ul className="space-y-1 text-xs text-white/70">
              <li>• Use good lighting for the best results</li>
              <li>• Show your personality - be authentic!</li>
              <li>• Mix close-ups with full body shots</li>
              <li>• Keep it classy and professional</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="relative flex gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 font-semibold text-white transition-all bg-white/10 rounded-xl hover:bg-white/20 backdrop-blur-sm"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            className="relative flex-1 px-6 py-3 overflow-hidden font-semibold text-white transition-all rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Image className="w-5 h-5" />
                Upload Photos
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};