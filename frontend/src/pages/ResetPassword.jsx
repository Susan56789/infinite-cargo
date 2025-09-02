import { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, ArrowLeft, Shield, CheckCircle, AlertCircle, Loader2, Key, RefreshCw, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/common/Breadcrumb';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [focusedField, setFocusedField] = useState('');
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [isValidToken, setIsValidToken] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
   const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email');

    if (!tokenParam || !emailParam) {
      setError('Invalid reset link. Please start the password reset process again.');
      setIsValidToken(false);
    } else {
      setToken(tokenParam);
      setEmail(decodeURIComponent(emailParam));
      setIsValidToken(true);
      
      setTimeRemaining(15 * 60);
    }
  }, []);

  useEffect(() => {
    // Countdown timer
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setError('Reset link has expired. Please request a new password reset.');
            setIsValidToken(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemaining]);


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const handleBlur = () => {
    setFocusedField('');
  };

  const validateForm = () => {
  const { password, confirmPassword } = formData;
  
  if (!password.trim()) {
    setError('Password is required');
    return false;
  }

  if (password.length < 8) {
    setError('Password must be at least 8 characters long');
    return false;
  }

  if (password.length > 128) {
    setError('Password must not exceed 128 characters');
    return false;
  }

  const passwordRequirements = [
    { test: /[a-z]/, message: 'at least one lowercase letter' },
    { test: /[A-Z]/, message: 'at least one uppercase letter' },
    { test: /\d/, message: 'at least one number' },
    { test: /[@$!%*?&]/, message: 'at least one special character (@$!%*?&)' }
  ];

  for (const requirement of passwordRequirements) {
    if (!requirement.test.test(password)) {
      setError(`Password must contain ${requirement.message}`);
      return false;
    }
  }

  if (!confirmPassword.trim()) {
    setError('Please confirm your password');
    return false;
  }

  if (password !== confirmPassword) {
    setError('Passwords do not match');
    return false;
  }

  return true;
};

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const requestBody = {
      token,
      email,
      password: formData.password
    };

    // Debug logging
    console.log('Reset password request:', {
      email: requestBody.email,
      hasToken: !!requestBody.token,
      tokenLength: requestBody.token?.length,
      hasPassword: !!requestBody.password,
      passwordLength: requestBody.password?.length
    });

    const response = await fetch(`${API_BASE_URL}/users/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify(requestBody)
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      throw new Error('Invalid response from server');
    }

    console.log('Reset password response:', { 
      status: response.status, 
      result: result 
    });

    if (!response.ok) {
      if (response.status === 400) {
        if (result.errors && Array.isArray(result.errors)) {
          const errorMessages = result.errors.map(err => err.message).join('. ');
          throw new Error(errorMessages);
        } else if (result.message) {
          if (result.message.includes('Invalid or expired')) {
            throw new Error('This reset link has expired or is invalid. Please request a new password reset.');
          } else if (result.message.includes('verification code not confirmed')) {
            throw new Error('Verification code was not properly confirmed. Please start the reset process again.');
          } else if (result.message.includes('Validation failed')) {
            throw new Error('Password does not meet security requirements. Please check the requirements below.');
          } else {
            throw new Error(result.message);
          }
        } else {
          throw new Error('Invalid request. Please check your information and try again.');
        }
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again in a few moments.');
      } else if (response.status === 503) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      } else {
        throw new Error(result.message || `Request failed (${response.status})`);
      }
    }

    // Success
    setSuccess('Password has been reset successfully! Redirecting to login...');
    
    // Clear form
    setFormData({
      password: '',
      confirmPassword: ''
    });

    // Redirect to login after 3 seconds
    setTimeout(() => {
      
    navigate('/login', { 
        state: { 
          message: 'Password reset successful! Please sign in with your new password.',
          email: email 
        }
      });
      alert('Redirecting to login page...');
    }, 3000);

  } catch (error) {
    console.error('Reset password error:', error);
    
    // Handle specific network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
    } else if (error.message.includes('CORS')) {
      setError('Connection error: Unable to communicate with server. Please try again.');
    } else if (error.message.includes('Failed to fetch')) {
      setError('Connection failed: Please check your internet connection and try again.');
    } else if (error.message.includes('Invalid response from server')) {
      setError('Server communication error. Please try again.');
    } else {
      setError(error.message || 'Failed to reset password. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { strength: 0, label: '', color: '' };

    let score = 0;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[@$!%*?&]/.test(password)
    ];

    score = checks.filter(Boolean).length;

    if (score <= 2) return { strength: score * 20, label: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { strength: 60, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { strength: 80, label: 'Good', color: 'bg-blue-500' };
    return { strength: 100, label: 'Strong', color: 'bg-green-500' };
  };

const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const goToForgotPassword = () => {
    alert('Redirecting to forgot password page...');
    // In real implementation: navigate('/forgot-password');
  };

  const goToLogin = () => {
    alert('Redirecting to login page...');
    // In real implementation: navigate('/login');
  };

  const passwordStrength = getPasswordStrength();

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
         <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <Breadcrumb items={[{text: 'Reset Password'}]} />
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-8 text-white text-center">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl">
                <AlertCircle className="text-white" size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Invalid Reset Link</h2>
            <p className="text-red-100">
              This password reset link is invalid or has expired.
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="space-y-4">
              <button
                onClick={goToForgotPassword}
                className="block w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 text-center"
              >
                Start Password Reset
              </button>
              <button
                onClick={goToLogin}
                className="block w-full py-3 px-6 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all duration-200 text-center"
              >
                Back to Sign In
              </button>
            </div>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h3 className="font-semibold text-blue-800 mb-2">Why did this happen?</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Reset link may have expired (15 min limit)</li>
                <li>• Link may have been used already</li>
                <li>• Invalid or corrupted link</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex flex-col lg:flex-row min-h-[700px]">
          
          {/* Left Side - Branding */}
          <div className="lg:w-2/5 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 p-8 lg:p-12 text-white relative overflow-hidden">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white/30 rounded-full animate-pulse"></div>
              <div className="absolute top-32 right-16 w-16 h-16 border-2 border-white/20 rounded-full animate-pulse delay-300"></div>
              <div className="absolute bottom-20 left-20 w-24 h-24 border-2 border-white/20 rounded-full animate-pulse delay-700"></div>
            </div>
            
            <div className="relative z-10 h-full flex flex-col justify-center">
              
              {/* Header */}
              <div className="mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <Truck className="text-white" size={56} />
                  </div>
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent mb-2">
                      Create New Password
                    </h1>
                    <p className="text-blue-100 text-xl">
                      Secure your Infinite Cargo account
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Security Features */}
              <div className="space-y-8">
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Shield className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Secure Process</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Your password is encrypted with industry-standard security protocols
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Key className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Strong Password</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Create a strong password with uppercase, lowercase, numbers, and symbols
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Lock className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Account Protection</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Your account will be immediately secured with your new password
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Reset Form */}
          <div className="lg:w-3/5 p-8 lg:p-12 bg-gradient-to-br from-white to-slate-50">
            <div className="max-w-lg mx-auto">
              
              {/* Back to Login Link */}
              <div className="mb-8">
                <button 
                  onClick={goToLogin}
                  className="inline-flex items-center gap-3 text-blue-600 hover:text-blue-700 font-semibold transition-all duration-200 group bg-transparent border-none cursor-pointer"
                >
                  <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                  <span>Back to Sign In</span>
                </button>
              </div>

              {/* Header */}
              <div className="text-center mb-10">
                <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <Lock className="text-blue-600" size={40} />
                </div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                  Create New Password
                </h2>
                <p className="text-slate-600 text-lg mb-4">
                  Choose a strong password for your account
                </p>
                <p className="text-blue-600 font-semibold text-xl">
                  {email || 'user@example.com'}
                </p>
                
                {/* Timer */}
                {timeRemaining > 0 && (
        <div className="flex items-center justify-center gap-2 mt-4 text-orange-600 bg-orange-50 p-3 rounded-xl">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm font-medium">
            Link expires in {formatTimeRemaining(timeRemaining)}
          </span>
        </div>
      )}
              </div>

              <div className="space-y-7">
                
                {/* New Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-bold text-blue-800 mb-2">
                    New Password *
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                      focusedField === 'password' ? 'text-blue-500' : 'text-slate-400'
                    }`} size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => handleFocus('password')}
                      onBlur={handleBlur}
                      placeholder="Enter your new password"
                      className={`w-full pl-12 pr-12 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        focusedField === 'password' 
                          ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600">Password Strength</span>
                        <span className={`text-xs font-semibold ${
                          passwordStrength.strength <= 40 ? 'text-red-600' : 
                          passwordStrength.strength <= 60 ? 'text-yellow-600' :
                          passwordStrength.strength <= 80 ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Password Requirements */}
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <p>Password must contain:</p>
                    <ul className="grid grid-cols-2 gap-1 ml-2">
                      <li className={formData.password.length >= 8 ? 'text-green-600' : 'text-slate-400'}>
                        • 8+ characters
                      </li>
                      <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}>
                        • Uppercase letter
                      </li>
                      <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}>
                        • Lowercase letter  
                      </li>
                      <li className={/\d/.test(formData.password) ? 'text-green-600' : 'text-slate-400'}>
                        • Number
                      </li>
                      <li className={/[@$!%*?&]/.test(formData.password) ? 'text-green-600' : 'text-slate-400'} style={{gridColumn: 'span 2'}}>
                        • Special character (@$!%*?&)
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-bold text-blue-800 mb-2">
                    Confirm New Password *
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                      focusedField === 'confirmPassword' ? 'text-blue-500' : 'text-slate-400'
                    }`} size={20} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => handleFocus('confirmPassword')}
                      onBlur={handleBlur}
                      placeholder="Confirm your new password"
                      className={`w-full pl-12 pr-12 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        focusedField === 'confirmPassword' 
                          ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  
                  {/* Password Match Indicator */}
                  {formData.confirmPassword && (
                    <div className={`mt-2 text-xs flex items-center gap-2 ${
                      formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <CheckCircle size={16} className={
                        formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-600'
                      } />
                      {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !formData.password || !formData.confirmPassword || formData.password !== formData.confirmPassword}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                    loading || !formData.password || !formData.confirmPassword || formData.password !== formData.confirmPassword
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="animate-spin" size={24} />
                      <span>Resetting Password...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle size={24} />
                      <span>Reset Password</span>
                    </div>
                  )}
                </button>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Shield className="text-blue-600 flex-shrink-0" size={20} />
                    <div>
                      <h4 className="font-semibold text-blue-800 text-sm">Security Notice</h4>
                      <p className="text-blue-700 text-xs mt-1">
                        After resetting your password, you'll be automatically signed out of all devices and need to sign in again.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-5 bg-red-50 border-l-4 border-red-400 rounded-xl transform transition-all duration-300 scale-100 animate-pulse mt-6">
                  <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
                  <span className="text-red-700 text-sm font-medium">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-3 p-5 bg-green-50 border-l-4 border-green-400 rounded-xl transform transition-all duration-300 scale-100 mt-6">
                  <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                  <span className="text-green-700 text-sm font-medium">{success}</span>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;