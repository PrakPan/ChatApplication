import { useState } from 'react';
import { Video, User, Crown, ArrowLeft, Mail, Phone, Lock, UserCircle, DollarSign, FileText } from 'lucide-react';

const Register = () => {
  const [step, setStep] = useState('role-selection'); // 'role-selection', 'user-form', 'host-form'
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    // Host specific fields
    bio: '',
    ratePerMinute: 50,
    languages: [],
    interests: [],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setFormData({ ...formData, role });
    setStep(role === 'user' ? 'user-form' : 'host-form');
  };

  const handleBack = () => {
    setStep('role-selection');
    setSelectedRole(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArrayInput = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(Boolean);
    setFormData({ ...formData, [field]: array });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { confirmPassword, ...registerData } = formData;
      
      // Convert ratePerMinute to number if it's a host
      if (registerData.role === 'host' && registerData.ratePerMinute) {
        registerData.ratePerMinute = Number(registerData.ratePerMinute);
      }
      
      // API call to register
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store tokens and userId
      localStorage.setItem('accessToken', data.data.token);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('userId', data.data.user.userId);
      
      setMessage({ 
        type: 'success', 
        text: `Account created successfully! Your User ID is: ${data.data.user.userId}. Please save it for login.` 
      });
      
      // Redirect after success (you can use react-router here)
      setTimeout(() => {
        window.location.href = '/'; // Update with your dashboard route
      }, 3000);
      
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ type: 'error', text: error.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Role Selection Screen
  if (step === 'role-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-2xl">
                <Video className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Join Our Platform</h1>
            <p className="text-gray-600 text-lg">Choose how you want to get started</p>
          </div>

          {/* Role Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* User Card */}
            <div
              onClick={() => handleRoleSelection('user')}
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-purple-500 group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="bg-purple-100 p-6 rounded-full mb-6 group-hover:bg-purple-600 transition-colors duration-300">
                  <User className="w-12 h-12 text-purple-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Join as User</h3>
                <p className="text-gray-600 mb-6">
                  Connect with amazing hosts, enjoy video calls, and explore engaging conversations
                </p>
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                    Browse verified hosts
                  </li>
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                    Instant video connections
                  </li>
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                    Secure payment system
                  </li>
                </ul>
                <button className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors">
                  Continue as User
                </button>
              </div>
            </div>

            {/* Host Card */}
            <div
              onClick={() => handleRoleSelection('host')}
              className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500 group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="bg-blue-100 p-6 rounded-full mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                  <Crown className="w-12 h-12 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Become a Host</h3>
                <p className="text-gray-600 mb-6">
                  Monetize your time, connect with users worldwide, and earn on your schedule
                </p>
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Set your own rates
                  </li>
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Flexible schedule
                  </li>
                  <li className="flex items-center text-gray-700">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    Direct earnings withdrawal
                  </li>
                </ul>
                <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                  Continue as Host
                </button>
              </div>
            </div>
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-purple-600 font-semibold hover:text-purple-700">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User Registration Form
  if (step === 'user-form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Header */}
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-purple-100 p-4 rounded-2xl">
                  <User className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Create User Account</h2>
              <p className="text-gray-600">Start your journey with us</p>
            </div>

            {/* Form */}
            <div onSubmit={handleSubmit}>
              {message.text && (
                <div className={`mb-5 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-700 border-2 border-green-200' : 'bg-red-50 text-red-700 border-2 border-red-200'}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="1234567890"
                    pattern="[0-9]{10}"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }
  if (step === 'host-form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Header */}
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>

            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-4 rounded-2xl">
                  <Crown className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Become a Host</h2>
              <p className="text-gray-600">Set up your hosting profile</p>
            </div>

            {/* Form */}
            <div onSubmit={handleSubmit}>
              {message.text && (
                <div className={`mb-5 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-700 border-2 border-green-200' : 'bg-red-50 text-red-700 border-2 border-red-200'}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="1234567890"
                    pattern="[0-9]{10}"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rate per Minute (coins)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="ratePerMinute"
                    value={formData.ratePerMinute}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="50"
                    min="10"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 10 coins per minute</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors resize-none"
                    placeholder="Tell users about yourself..."
                    rows="3"
                    maxLength="500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/500 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Languages (comma-separated)</label>
                <input
                  type="text"
                  name="languages"
                  onChange={(e) => handleArrayInput('languages', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="English, Hindi, Spanish"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Interests (comma-separated)</label>
                <input
                  type="text"
                  name="interests"
                  onChange={(e) => handleArrayInput('interests', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Music, Travel, Technology"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? 'Creating account...' : 'Create Host Account'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Register;