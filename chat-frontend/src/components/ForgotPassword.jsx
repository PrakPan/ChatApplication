import { useState } from 'react';
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle, Key } from 'lucide-react';

export const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL || 'https://chatapplication-1-gspo.onrender.com/api/v1';

  // Start countdown for resend
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/password-reset/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setStep(2);
        startCountdown();
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOTP = [...otp];
    newOTP[index] = value;
    setOtp(newOTP);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter complete OTP');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/password-reset/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });

      const data = await response.json();

      if (data.success) {
        setResetToken(data.data.resetToken);
        setStep(3);
      } else {
        setError(data.error || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/password-reset/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        setStep(4);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      await fetch(`${API_URL}/password-reset/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      startCountdown();
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.location.href = '/login';
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg">
              <Key className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {step === 1 && 'Forgot Password?'}
            {step === 2 && 'Verify OTP'}
            {step === 3 && 'Create New Password'}
            {step === 4 && 'Password Reset!'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === 1 && "Enter your email to receive an OTP"}
            {step === 2 && "Enter the 6-digit code sent to your email"}
            {step === 3 && "Create a strong password for your account"}
            {step === 4 && "Your password has been successfully reset"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg"
              >
                {loading ? 'Sending...' : 'Send OTP'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
                  Enter OTP
                </label>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && index > 0) {
                          document.getElementById(`otp-${index - 1}`)?.focus();
                        }
                      }}
                      className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={countdown > 0 || loading}
                  className="text-sm text-blue-600 hover:text-blue-500 disabled:text-gray-400"
                >
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.join('').length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your password"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="bg-green-100 p-4 rounded-full">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Password Reset Successful!
                </h3>
                <p className="text-gray-600">
                  You can now log in with your new password
                </p>
              </div>
              <button
                onClick={goToLogin}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                Go to Login
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <p className="text-center text-sm text-gray-600 mt-6">
            Remember your password?{' '}
            <button onClick={goToLogin} className="text-blue-600 hover:text-blue-500 font-semibold">
              Back to Login
            </button>
          </p>
        )}
      </div>
    </div>
  );
};