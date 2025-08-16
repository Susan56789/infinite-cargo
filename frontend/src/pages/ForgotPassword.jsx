import React, { useState } from 'react';
import { Mail, ArrowLeft, Truck, Package, AlertCircle, CheckCircle, Loader2, Shield, Star, Users, Clock, Send } from 'lucide-react';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState('email'); // 'email', 'sent', 'expired'
  const [focusedField, setFocusedField] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  // API Configuration
  const API_BASE_URL = process.env.REACT_APP_API_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://infinite-cargo-api.onrender.com/api' 
      : 'http://localhost:5000/api');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateEmail()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const resetData = {
        email: formData.email.trim().toLowerCase()
      };

      const response = await fetch(`${API_BASE_URL}/users/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify(resetData)
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No account found with this email address');
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

      // Success - move to sent step
      setSuccess('Password reset instructions sent! Check your email.');
      setStep('sent');
      startResendTimer();

    } catch (error) {
      console.error('Forgot password error:', error);
      
      // Handle specific network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('🌐 Network error: Unable to connect to server. Please check your internet connection and try again.');
      } else if (error.message.includes('CORS')) {
        setError('🔒 Connection error: Unable to communicate with server. Please try again.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('🌐 Connection failed: Please check your internet connection and try again.');
      } else {
        setError(error.message || '❌ Failed to send reset instructions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resendCount >= 3) return;
    
    setResendCount(prev => prev + 1);
    await handleSubmit(new Event('submit'));
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
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
                      Reset Password
                    </h1>
                    <p className="text-blue-100 text-xl">
                      Secure your Infinite Cargo account
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
                      Your password reset link is encrypted and expires in 15 minutes for maximum security
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Mail className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Email Verification</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      We'll send reset instructions to your registered email address only
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
                <a 
                  href="/login" 
                 
                  className="inline-flex items-center gap-3 text-blue-600 hover:text-blue-700 font-semibold transition-all duration-200 group"
                >
                  <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20} />
                  <span>Back to Sign In</span>
                </a>
              </div>

              {step === 'email' && (
                <>
                  <div className="text-center mb-10">
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                      Forgot Password?
                    </h2>
                    <p className="text-slate-600 text-lg">
                      No worries! Enter your email and we'll send you reset instructions
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-slate-500">
                      <Shield size={16} />
                      <span>Secure password recovery</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-7">
                    
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
                        We'll send password reset instructions to this email
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
                          <span>Sending Instructions...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <Send size={24} />
                          <span>Send Reset Instructions</span>
                        </div>
                      )}
                    </button>

                    {/* Error Message */}
                    {error && (
                      <div className="flex items-center gap-3 p-5 bg-red-50 border-l-4 border-red-400 rounded-xl transform transition-all duration-300 scale-100 animate-pulse">
                        <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
                        <span className="text-red-700 text-sm font-medium">{error}</span>
                      </div>
                    )}

                    {/* Success Message */}
                    {success && (
                      <div className="flex items-center gap-3 p-5 bg-green-50 border-l-4 border-green-400 rounded-xl transform transition-all duration-300 scale-100">
                        <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                        <span className="text-green-700 text-sm font-medium">{success}</span>
                      </div>
                    )}

                    {/* Help Text */}
                    <div className="text-center pt-6 border-t border-slate-200">
                      <p className="text-slate-600 mb-4">
                        Remember your password?{' '}
                        <a 
                          href="/login" 
                         
                          className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                        >
                          Sign In
                        </a>
                      </p>
                      
                      <p className="text-slate-600 mb-6">
                        Don't have an account?{' '}
                        <a 
                          href="/register" 
                         
                          className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                        >
                          Create Account
                        </a>
                      </p>
                    </div>

                  </form>
                </>
              )}

              {step === 'sent' && (
                <div className="text-center">
                  <div className="mb-8">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle className="text-green-600" size={40} />
                    </div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-3">
                      Check Your Email
                    </h2>
                    <p className="text-slate-600 text-lg mb-4">
                      We've sent password reset instructions to:
                    </p>
                    <p className="text-blue-600 font-semibold text-xl mb-6">
                      {formData.email}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <h3 className="font-bold text-blue-800 mb-3">Next Steps:</h3>
                      <ol className="text-left text-blue-700 space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">1</span>
                          <span>Check your email inbox (and spam folder)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">2</span>
                          <span>Click the "Reset Password" link in the email</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">3</span>
                          <span>Create your new secure password</span>
                        </li>
                      </ol>
                    </div>

                    {/* Resend Option */}
                    <div className="border-t border-slate-200 pt-6">
                      <p className="text-slate-600 mb-4">Didn't receive the email?</p>
                      
                      {resendTimer > 0 ? (
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <Clock size={16} />
                          <span>Resend available in {formatTimer(resendTimer)}</span>
                        </div>
                      ) : resendCount >= 3 ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                          <p className="text-yellow-700 text-sm">
                            Maximum resend attempts reached. Please contact support if you need assistance.
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleResend}
                          disabled={loading}
                          className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200 disabled:opacity-50"
                        >
                          Resend Email
                        </button>
                      )}
                      
                      {resendCount > 0 && resendCount < 3 && (
                        <p className="text-xs text-slate-500 mt-2">
                          Resent {resendCount} time{resendCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Back Options */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                      <button
                        onClick={() => {
                          setStep('email');
                          setError('');
                          setSuccess('');
                          setResendTimer(0);
                          setResendCount(0);
                        }}
                        className="flex-1 py-3 px-6 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all duration-200"
                      >
                        Try Different Email
                      </button>
                      <a
                        href="/login"
                       
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 text-center"
                      >
                        Back to Sign In
                      </a>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg mt-8">
                    <Shield size={16} />
                    <span>Reset link expires in 15 minutes for security</span>
                  </div>
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