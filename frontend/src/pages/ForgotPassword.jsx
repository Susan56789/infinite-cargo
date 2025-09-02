import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Truck, Package, AlertCircle, CheckCircle, Loader2, Shield, Star, Users, Clock, Send, Key, RefreshCw } from 'lucide-react';
import Breadcrumb from '../components/common/Breadcrumb';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
    verificationCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState('email'); // 'email', 'verify', 'expired'
  const [focusedField, setFocusedField] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  const navigate = useNavigate();

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  const handleChange = (e) => {
  const { name, value } = e.target;
  
  // For verification code, only allow numbers and limit to 6 digits
  if (name === 'verificationCode') {
    // Remove all non-numeric characters and spaces, limit to 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setFormData({
      ...formData,
      [name]: numericValue // Store clean numeric value, not formatted
    });
  } else {
    setFormData({
      ...formData,
      [name]: value
    });
  }
  
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

  const validateEmail = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please provide a valid email address');
      return false;
    }
    return true;
  };

  const validateCode = () => {
  const cleanCode = formData.verificationCode.trim();
  
  if (!cleanCode) {
    setError('Verification code is required');
    return false;
  }
  if (cleanCode.length !== 6) {
    setError('Please enter the complete 6-digit verification code');
    return false;
  }
  if (!/^\d{6}$/.test(cleanCode)) {
    setError('Verification code must contain only numbers');
    return false;
  }
  return true;
};
  const startResendTimer = () => {
    const timerDuration = Math.min(60 + (resendCount * 30), 300); // Max 5 minutes
    setResendTimer(timerDuration);
    
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendVerificationCode = async () => {
  if (!validateEmail()) return false;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    const response = await fetch(`${API_BASE_URL}/users/forgot-password-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ email: formData.email.trim().toLowerCase() })
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      if (response.status === 404 && result.status === 'alert') {
        // Handle account not found - show alert message
        setError(`⚠️ ${result.message}`);
        return false;
      } else if (response.status === 429) {
        throw new Error('Too many password reset requests. Please try again later.');
      } else if (response.status === 400 && result.errors) {
        const errorMessages = result.errors.map(err => err.message).join('. ');
        throw new Error(errorMessages);
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later');
      } else {
        throw new Error(result.message || `Request failed (${response.status})`);
      }
    }

    // Success - account exists and code sent
    return true;

  } catch (error) {
    console.error('Send verification code error:', error);
    
    // Handle specific network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('🌐 Network error: Unable to connect to server. Please check your internet connection and try again.');
    } else if (error.message.includes('CORS')) {
      setError('🔒 Connection error: Unable to communicate with server. Please try again.');
    } else if (error.message.includes('Failed to fetch')) {
      setError('🌐 Connection failed: Please check your internet connection and try again.');
    } else {
      setError(error.message || '❌ Failed to send verification code. Please try again.');
    }
    return false;
  } finally {
    setLoading(false);
  }
};

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    const success = await sendVerificationCode();
    if (success) {
      setSuccess('Verification code sent! Check your email.');
      setStep('verify');
      startResendTimer();
    }
  };

  const handleCodeSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateCode()) return;

  setLoading(true);
  setError('');
  setSuccess('');

  try {
    // Send the clean numeric code, not the formatted display version
    const requestBody = {
      email: formData.email.trim().toLowerCase(),
      code: formData.verificationCode.trim() 
    };

    

    const response = await fetch(`${API_BASE_URL}/users/verify-reset-code`, {
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
      throw new Error('Invalid response from server');
    }

    

    if (!response.ok) {
      if (response.status === 400) {
        // Provide more specific error messages
        if (result.message.includes('expired')) {
          throw new Error('Verification code has expired. Please request a new one.');
        } else if (result.message.includes('Invalid')) {
          throw new Error('Invalid verification code. Please check and try again.');
        } else {
          throw new Error(result.message || 'Invalid or expired verification code');
        }
      } else if (response.status === 500) {
        throw new Error('Server error. Please try again later');
      } else {
        throw new Error(result.message || `Request failed (${response.status})`);
      }
    }

    // Success - navigate to reset password page with token
    setSuccess('Code verified! Redirecting to create new password...');
    
    setTimeout(() => {
      navigate(`/reset-password?token=${result.resetToken}&email=${encodeURIComponent(result.email)}`);
    }, 1500);

  } catch (error) {
    console.error('Verify code error:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
    } else {
      setError(error.message || 'Invalid verification code. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};


  const handleResend = async () => {
  if (resendTimer > 0 || resendCount >= 3) return;
  
  
  setResendCount(prev => prev + 1);
  const success = await sendVerificationCode();
  if (success) {
    setSuccess('Verification code resent! Check your email.');
    startResendTimer();
  }
};

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCodeDisplay = (code) => {
    // Format as XXX XXX for better readability
    if (code.length <= 3) return code;
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <Breadcrumb items={[{text: 'Forgot Password'}]} />
        <div className="flex flex-col xl:flex-row min-h-[800px]">
          
          {/* Left Side - Enhanced Branding & Benefits */}
          <div className="xl:w-2/5 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 p-8 lg:p-12 text-white relative overflow-hidden">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white/30 rounded-full animate-pulse"></div>
              <div className="absolute top-32 right-16 w-16 h-16 border-2 border-white/20 rounded-full animate-pulse delay-300"></div>
              <div className="absolute bottom-20 left-20 w-24 h-24 border-2 border-white/20 rounded-full animate-pulse delay-700"></div>
              <div className="absolute top-1/2 right-1/4 w-12 h-12 border border-white/10 rounded-full animate-pulse delay-500"></div>
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
                      {step === 'email' ? 'Reset Password' : 'Verify Code'}
                    </h1>
                    <p className="text-blue-100 text-xl">
                      {step === 'email' ? 'Secure your Infinite Cargo account' : 'Enter your verification code'}
                    </p>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                    <Users className="mx-auto mb-2 text-blue-200" size={24} />
                    <div className="text-2xl font-bold">10K+</div>
                    <div className="text-xs text-blue-200">Active Users</div>
                  </div>
                  <div className="text-center p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                    <Truck className="mx-auto mb-2 text-blue-200" size={24} />
                    <div className="text-2xl font-bold">5K+</div>
                    <div className="text-xs text-blue-200">Verified Drivers</div>
                  </div>
                  <div className="text-center p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                    <Package className="mx-auto mb-2 text-blue-200" size={24} />
                    <div className="text-2xl font-bold">50K+</div>
                    <div className="text-xs text-blue-200">Deliveries Made</div>
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
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Secure Recovery</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Your verification code is encrypted and expires in 10 minutes for maximum security
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Key className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Code Verification</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      We'll send a 6-digit code to your registered email address for verification
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Clock className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Quick Process</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Reset your password in under 2 minutes and get back to managing your cargo
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Testimonial */}
              <div className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-300 fill-current" />
                    ))}
                  </div>
                  <span className="text-blue-100 text-sm font-medium">4.9/5 Rating</span>
                </div>
                <p className="text-blue-100 text-center text-lg italic mb-3">
                  "Fast and secure password recovery. Got back to work in minutes!"
                </p>
                <p className="text-blue-200 text-center text-sm">
                  - Peter Mwangi, Cargo Owner
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Password Reset Form */}
          <div className="xl:w-3/5 p-8 lg:p-12 bg-gradient-to-br from-white to-slate-50">
            <div className="max-w-lg mx-auto">
              
              {/* Back to Login Link */}
              <div className="mb-8">
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-3 text-blue-600 hover:text-blue-700 font-semibold transition-all duration-200 group"
                >
                  <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                  <span>Back to Sign In</span>
                </Link>
              </div>

              {/* Step 1: Email Input */}
              {step === 'email' && (
                <>
                  <div className="text-center mb-10">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                      Forgot Password?
                    </h2>
                    <p className="text-slate-600 text-lg">
                      No worries! Enter your email and we'll send you a verification code
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-slate-500">
                      <Shield size={16} />
                      <span>Secure 6-digit code verification</span>
                    </div>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-7">
                    
                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-bold text-blue-800 mb-2">
                        Email Address *
                      </label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                          focusedField === 'email' ? 'text-blue-500' : 'text-slate-400'
                        }`} size={20} />
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onFocus={() => handleFocus('email')}
                          onBlur={handleBlur}
                          placeholder="Enter your registered email"
                          className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                            focusedField === 'email' 
                              ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                              : 'border-slate-200 hover:border-blue-300'
                          }`}
                          required
                          disabled={loading}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        We'll send a 6-digit verification code to this email
                      </p>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                        loading
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                      }`}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="animate-spin" size={24} />
                          <span>Sending Code...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <Send size={24} />
                          <span>Send Verification Code</span>
                        </div>
                      )}
                    </button>

                    {/* Help Text */}
                    <div className="text-center pt-6 border-t border-slate-200">
                      <p className="text-slate-600 mb-4">
                        Remember your password?{' '}
                        <Link 
                          to="/login" 
                          className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                        >
                          Sign In
                        </Link>
                      </p>
                      
                      <p className="text-slate-600 mb-6">
                        Don't have an account?{' '}
                        <Link 
                          to="/register" 
                          className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                        >
                          Create Account
                        </Link>
                      </p>
                    </div>

                  </form>
                </>
              )}

              {/* Step 2: Code Verification */}
              {step === 'verify' && (
                <>
                  <div className="text-center mb-10">
                    <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                      <Key className="text-blue-600" size={40} />
                    </div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                      Enter Verification Code
                    </h2>
                    <p className="text-slate-600 text-lg mb-4">
                      We've sent a 6-digit code to:
                    </p>
                    <p className="text-blue-600 font-semibold text-xl mb-6">
                      {formData.email}
                    </p>
                  </div>

                  <form onSubmit={handleCodeSubmit} className="space-y-7">
                    
                    {/* Verification Code */}
                    <div>
                      <label htmlFor="verificationCode" className="block text-sm font-bold text-blue-800 mb-2">
                        6-Digit Verification Code *
                      </label>
                      <div className="relative group">
                        <Key className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                          focusedField === 'verificationCode' ? 'text-blue-500' : 'text-slate-400'
                        }`} size={20} />
                        <input
  type="text"
  id="verificationCode"
  name="verificationCode"
  value={formatCodeDisplay(formData.verificationCode)} 
  onChange={handleChange} 
  onFocus={() => handleFocus('verificationCode')}
  onBlur={handleBlur}
  placeholder="000 000"
  className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-center text-2xl font-mono tracking-widest ${
    focusedField === 'verificationCode' 
      ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
      : 'border-slate-200 hover:border-blue-300'
  }`}
  required
  disabled={loading}
  maxLength={7} // 6 digits + 1 space for formatting
  inputMode="numeric" // Show numeric keyboard on mobile
  pattern="[0-9\s]*" // Allow only numbers and spaces
/>

                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Check your email for the 6-digit verification code
                      </p>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading || formData.verificationCode.length !== 6}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                        loading || formData.verificationCode.length !== 6
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                      }`}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="animate-spin" size={24} />
                          <span>Verifying Code...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <CheckCircle size={24} />
                          <span>Verify Code</span>
                        </div>
                      )}
                    </button>

                    {/* Resend Option */}
                    <div className="text-center pt-6 border-t border-slate-200">
                      <p className="text-slate-600 mb-4">Didn't receive the code?</p>
                      
                      {resendTimer > 0 ? (
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Clock size={16} />
                          <span>Resend available in {formatTimer(resendTimer)}</span>
                        </div>
                      ) : resendCount >= 3 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                          <p className="text-yellow-700 text-sm">
                            Maximum resend attempts reached. Please start over or contact support.
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleResend}
                          disabled={loading}
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200 disabled:opacity-50"
                        >
                          <RefreshCw size={16} />
                          Resend Code
                        </button>
                      )}
                      
                      {resendCount > 0 && resendCount < 3 && (
                        <p className="text-xs text-slate-500 mt-2">
                          Resent {resendCount} time{resendCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Back Options */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('email');
                          setFormData({ ...formData, verificationCode: '' });
                          setError('');
                          setSuccess('');
                          setResendTimer(0);
                          setResendCount(0);
                        }}
                        className="flex-1 py-3 px-6 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all duration-200"
                      >
                        Change Email
                      </button>
                      <Link
                        to="/login"
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-slate-600 to-slate-700 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all duration-200 text-center"
                      >
                        Cancel
                      </Link>
                    </div>
                  </form>

                  {/* Code expires notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg mt-6">
                    <Shield size={16} />
                    <span>Verification code expires in 10 minutes</span>
                  </div>
                </>
              )}

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

export default ForgotPassword;