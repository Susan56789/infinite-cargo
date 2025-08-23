import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Truck, Package, Mail, Lock, AlertCircle, CheckCircle, Loader2, Shield, Star, Users, Clock, ArrowRight } from 'lucide-react';
import { authManager } from '../utils/auth'; 
import Breadcrumb from '../components/common/Breadcrumb';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [focusedField, setFocusedField] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  useEffect(() => {
    // Check if user is already authenticated
    if (authManager.isAuthenticated()) {
      window.location.href = authManager.getDefaultDashboard();
      return;
    }

    // Check if there's a remember me preference
    const remembered = localStorage.getItem('infiniteCargoRememberMe') === 'true';
    setRememberMe(remembered);
  }, []);

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
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please provide a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
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
      const loginData = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password
      };


      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify(loginData)
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(result.message || 'Invalid email or password');
        } else if (response.status === 423) {
          throw new Error(result.message || 'Account is temporarily locked. Please contact support.');
        } else if (response.status === 429) {
          throw new Error(result.message || 'Too many login attempts. Please try again later.');
        } else if (response.status === 400 && result.errors) {
          const errorMessages = result.errors.map(err => err.message).join('. ');
          throw new Error(errorMessages);
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later');
        } else {
          throw new Error(result.message || `Login failed (${response.status})`);
        }
      }

      if (!result.token || !result.user) {
        throw new Error('Invalid login response: missing token or user data');
      }

    
      // Login successful
      setSuccess('🎉 Login successful! Welcome back.');

      
      authManager.setAuth(result.token, result.user, rememberMe);
      
     
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!authManager.isAuthenticated()) {
        console.error('Authentication failed to store properly');
        throw new Error('Failed to authenticate user. Please try again.');
      }


      window.dispatchEvent(new CustomEvent('userLoggedIn', { 
        detail: { user: result.user, token: result.token } 
      }));
      window.dispatchEvent(new CustomEvent('authStateChanged'));

      // Clear form
      setFormData({
        email: '',
        password: ''
      });

   
      const redirectUrl = authManager.getDefaultDashboard();
     
      if (!redirectUrl || redirectUrl === '/dashboard') {
        console.warn('Default dashboard URL may be incorrect, using fallback');
      }

     
      setTimeout(() => {
        
        if (authManager.isAuthenticated()) {
         
          window.location.href = redirectUrl;
        } else {
          console.error('User no longer authenticated at redirect time');
          setError('Authentication lost during login. Please try again.');
          setLoading(false);
        }
      }, 1500); 

    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('🌐 Network error: Unable to connect to server. Please check your internet connection and try again.');
      } else if (error.message.includes('CORS')) {
        setError('🔒 Connection error: Unable to communicate with server. Please try again.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('🌐 Connection failed: Please check your internet connection and try again.');
      } else {
        setError(error.message || '❌ Login failed. Please try again.');
      }
    } finally {
      // FIXED: Only set loading to false if we're not redirecting
      if (!success) {
        setLoading(false);
      }
    }
  };

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
     <Breadcrumb items={[{text: 'Login'}]} />
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
                      Welcome Back
                    </h1>
                    <p className="text-blue-100 text-xl">
                      Sign in to Infinite Cargo
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
              
              {/* Benefits */}
              <div className="space-y-8">
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Truck className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">For Drivers</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Access thousands of cargo loads and grow your transport business across Kenya
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Package className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">For Cargo Owners</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Connect with verified drivers and ship your goods safely with real-time tracking
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 group cursor-pointer">
                  <div className="p-3 bg-blue-400/30 rounded-xl group-hover:bg-blue-400/40 transition-all duration-300 group-hover:scale-110">
                    <Shield className="text-blue-200" size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">Secure & Reliable</h4>
                    <p className="text-blue-100 leading-relaxed group-hover:text-white transition-colors">
                      Safe payments, comprehensive insurance, and 24/7 customer support
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
                  "The most reliable transport platform in Kenya. Easy to use and trustworthy!"
                </p>
                <p className="text-blue-200 text-center text-sm">
                  - Mary Wanjiku, Cargo Owner
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Enhanced Login Form */}
          <div className="xl:w-3/5 p-8 lg:p-12 bg-gradient-to-br from-white to-slate-50">
            <div className="max-w-lg mx-auto">
              
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                  Sign In
                </h2>
                <p className="text-slate-600 text-lg">
                  Access your Infinite Cargo account
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-slate-500">
                  <Clock size={16} />
                  <span>Quick and secure login</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-5 bg-red-50 border-l-4 border-red-400 rounded-xl mb-6 transform transition-all duration-300 scale-100 animate-pulse">
                  <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
                  <span className="text-red-700 text-sm font-medium">{error}</span>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-3 p-5 bg-green-50 border-l-4 border-green-400 rounded-xl mb-6 transform transition-all duration-300 scale-100">
                  <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                  <span className="text-green-700 text-sm font-medium">{success}</span>
                </div>
              )}

              {/* Login Form */}
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
                      placeholder="Enter your email address"
                      className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        focusedField === 'email' 
                          ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-bold text-blue-800 mb-2">
                    Password *
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
                      placeholder="Enter your password"
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
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors duration-200 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all duration-200"
                      disabled={loading}
                    />
                    <span className="ml-2 text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                      Remember me
                    </span>
                  </label>
                  
                  <a 
                    href="/forgot-password" 
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                  >
                    Forgot Password?
                  </a>
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
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <ArrowRight size={24} />
                      <span>Sign In</span>
                    </div>
                  )}
                </button>

                {/* Create Account Link */}
                <div className="text-center pt-6 border-t border-slate-200">
                  <p className="text-slate-600 mb-6">
                    Don't have an account?{' '}
                    <a 
                      href="/register" 
                      className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                    >
                      Create Account
                    </a>
                  </p>
                  
                  {/* Quick Access */}
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">Quick Access:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <a 
                        href="/register" 
                        className="flex items-center justify-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 border border-blue-200 hover:border-blue-300 hover:scale-105"
                      >
                        <Truck size={20} />
                        <span>Join as Driver</span>
                      </a>
                      <a 
                        href="/register" 
                        className="flex items-center justify-center gap-3 bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 border border-green-200 hover:border-green-300 hover:scale-105"
                      >
                        <Package size={20} />
                        <span>Ship Cargo</span>
                      </a>
                    </div>
                  </div>
                  
                  {/* Security Notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg mt-6">
                    <Shield size={16} />
                    <span>Your login is protected with 256-bit SSL encryption</span>
                  </div>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;