import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Truck, Package, Mail, Lock, User, Phone, MapPin, AlertCircle, CheckCircle, Loader2, Shield, Star, Users, Clock } from 'lucide-react';
import Breadcrumb from '../components/common/Breadcrumb';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    userType: '',
    location: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  // Password strength checker with enhanced validation
  useEffect(() => {
    const { password } = formData;
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[^a-zA-Z\d]/)) strength++;
    
    setPasswordStrength(strength);
  }, [formData.password]);

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

  const handleUserTypeSelect = (type) => {
    setFormData({
      ...formData,
      userType: type
    });
    
    if (error) setError('');
    if (success) setSuccess('');
  };

  const validateForm = () => {
    // Name validation
    if (!formData.name.trim()) {
      setError('Full name is required');
      return false;
    }
    if (formData.name.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return false;
    }
    if (!/^[a-zA-Z\s'-]+$/.test(formData.name.trim())) {
      setError('Name can only contain letters, spaces, hyphens, and apostrophes');
      return false;
    }

    // Email validation
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please provide a valid email address');
      return false;
    }

    // Enhanced password validation
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return false;
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Phone validation - Kenyan format
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    const phoneRegex = /^(\+254|0)[0-9]{9}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      setError('Please provide a valid Kenyan phone number (e.g., +254712345678 or 0712345678)');
      return false;
    }

    // User type validation
    if (!formData.userType) {
      setError('Please select your account type');
      return false;
    }

    // Location validation
    if (!formData.location.trim()) {
      setError('Location is required');
      return false;
    }

    // Terms acceptance
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy');
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
      const registrationData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        userType: formData.userType,
        location: formData.location.trim()
      };

      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify(registrationData)
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 400 && result.errors) {
          const errorMessages = result.errors.map(err => err.message).join('. ');
          throw new Error(errorMessages);
        } else if (response.status === 409) {
          throw new Error(result.message || 'An account with this email or phone number already exists');
        } else if (response.status === 429) {
          throw new Error(result.message || 'Too many registration attempts. Please try again later.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later');
        } else {
          throw new Error(result.message || `Registration failed (${response.status})`);
        }
      }
      
      // Registration successful
      setSuccess('🎉 Registration successful! Welcome to Infinite Cargo.');
      
      // Store token if provided
      if (result.token) {
        localStorage.setItem('infiniteCargoToken', result.token);
        localStorage.setItem('infiniteCargoUser', JSON.stringify(result.user));
      }
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        userType: '',
        location: ''
      });
      setTermsAccepted(false);

      // Redirect after success
      setTimeout(() => {
        // Add your navigation logic here
        window.location.href = '/login';
      }, 2000);

    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('🌐 Network error: Unable to connect to server. Please check your internet connection and try again.');
      } else if (error.message.includes('CORS')) {
        setError('🔒 Connection error: Unable to communicate with server. Please try again.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('🌐 Connection failed: Please check your internet connection and try again.');
      } else {
        setError(error.message || '❌ Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthConfig = () => {
    switch (passwordStrength) {
      case 0:
      case 1: return { text: 'Weak', color: 'bg-red-500', width: 'w-1/4', textColor: 'text-red-600' };
      case 2: return { text: 'Fair', color: 'bg-yellow-500', width: 'w-2/4', textColor: 'text-yellow-600' };
      case 3: return { text: 'Good', color: 'bg-blue-500', width: 'w-3/4', textColor: 'text-blue-600' };
      case 4: return { text: 'Strong', color: 'bg-green-500', width: 'w-full', textColor: 'text-green-600' };
      default: return { text: '', color: '', width: 'w-0', textColor: '' };
    }
  };

  const kenyanCounties = [
    'Nairobi', 'Mombasa', 'Kiambu', 'Nakuru', 'Machakos', 'Meru', 'Kisumu',
    'Uasin Gishu', 'Kajiado', 'Nyandarua', 'Murang\'a', 'Nyeri', 'Kirinyaga',
    'Embu', 'Tharaka Nithi', 'Kitui', 'Makueni', 'Nzoia', 'Vihiga', 'Bungoma',
    'Busia', 'Siaya', 'Kisii', 'Homa Bay', 'Migori', 'Nyamira', 'Narok',
    'Bomet', 'Kericho', 'Nandi', 'Baringo', 'Laikipia', 'Samburu', 'Trans Nzoia',
    'Elgeyo Marakwet', 'West Pokot', 'Turkana', 'Marsabit', 'Isiolo',
    'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera'
  ];

  const strengthConfig = getPasswordStrengthConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
     <Breadcrumb items={[{text: 'Register'}]} />
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex flex-col xl:flex-row min-h-[900px]">
          
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
                      Join Infinite Cargo
                    </h1>
                    <p className="text-blue-100 text-xl">
                      Kenya's Leading Transport Network
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
                      Access thousands of cargo loads, connect with verified cargo owners, 
                      and grow your transport business across Kenya
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
                      Connect with verified drivers, get competitive rates, 
                      and ship your goods safely with real-time tracking
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
                      Safe payments, comprehensive insurance, verified users, 
                      and 24/7 customer support
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
                  "Infinite Cargo has transformed my trucking business. More loads, better rates!"
                </p>
                <p className="text-blue-200 text-center text-sm">
                  - James Kimani, Truck Driver
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Enhanced Registration Form */}
          <div className="xl:w-3/5 p-8 lg:p-12 bg-gradient-to-br from-white to-slate-50">
            <div className="max-w-lg mx-auto">
              
              <div className="text-center mb-10">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-800 to-indigo-600 bg-clip-text text-transparent mb-3">
                  Create Your Account
                </h2>
                <p className="text-slate-600 text-lg">
                  Join thousands of users already using Infinite Cargo
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 text-sm text-slate-500">
                  <Clock size={16} />
                  <span>Takes less than 2 minutes</span>
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

              <form onSubmit={handleSubmit} className="space-y-7">
                
                {/* User Type Selection */}
                <div>
                  <label className="block text-sm font-bold text-blue-800 mb-4">
                    Choose Your Account Type *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      className={`p-6 border-2 rounded-2xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                        formData.userType === 'driver'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg ring-4 ring-blue-100 scale-105'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                      } ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                      onClick={() => handleUserTypeSelect('driver')}
                      disabled={loading}
                    >
                      <Truck className={`mx-auto mb-4 ${formData.userType === 'driver' ? 'text-blue-600' : 'text-slate-500'} transition-colors`} size={40} />
                      <div className={`font-bold text-lg mb-2 ${formData.userType === 'driver' ? 'text-blue-700' : 'text-slate-700'}`}>
                        Find Loads
                      </div>
                      <div className={`text-sm ${formData.userType === 'driver' ? 'text-blue-600' : 'text-slate-500'}`}>
                        Join as Driver
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      className={`p-6 border-2 rounded-2xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                        formData.userType === 'cargo_owner'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg ring-4 ring-blue-100 scale-105'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                      } ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                      onClick={() => handleUserTypeSelect('cargo_owner')}
                      disabled={loading}
                    >
                      <Package className={`mx-auto mb-4 ${formData.userType === 'cargo_owner' ? 'text-blue-600' : 'text-slate-500'} transition-colors`} size={40} />
                      <div className={`font-bold text-lg mb-2 ${formData.userType === 'cargo_owner' ? 'text-blue-700' : 'text-slate-700'}`}>
                        Ship Cargo
                      </div>
                      <div className={`text-sm ${formData.userType === 'cargo_owner' ? 'text-blue-600' : 'text-slate-500'}`}>
                        Join as Cargo Owner
                      </div>
                    </button>
                  </div>
                </div>

                {/* Name and Phone Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-bold text-blue-800 mb-2">
                      Full Name *
                    </label>
                    <div className="relative group">
                      <User className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                        focusedField === 'name' ? 'text-blue-500' : 'text-slate-400'
                      }`} size={20} />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        onFocus={() => handleFocus('name')}
                        onBlur={handleBlur}
                        placeholder="Enter your full name"
                        className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          focusedField === 'name' 
                            ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-bold text-blue-800 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative group">
                      <Phone className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                        focusedField === 'phone' ? 'text-blue-500' : 'text-slate-400'
                      }`} size={20} />
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onFocus={() => handleFocus('phone')}
                        onBlur={handleBlur}
                        placeholder="e.g., +254712345678"
                        className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          focusedField === 'phone' 
                            ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

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

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-bold text-blue-800 mb-2">
                    Location (County) *
                  </label>
                  <div className="relative group">
                    <MapPin className={`absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors duration-200 z-10 ${
                      focusedField === 'location' ? 'text-blue-500' : 'text-slate-400'
                    }`} size={20} />
                    <select
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      onFocus={() => handleFocus('location')}
                      onBlur={handleBlur}
                      className={`w-full pl-12 pr-10 py-4 border-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-white cursor-pointer ${
                        focusedField === 'location' 
                          ? 'border-blue-500 ring-4 ring-blue-100 shadow-lg' 
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                      required
                      disabled={loading}
                    >
                      <option value="">Select your county</option>
                      {kenyanCounties.map((county) => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Password Fields Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                        placeholder="Create a strong password"
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
                    {formData.password && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="h-2 bg-slate-200 rounded-full flex-1 overflow-hidden">
                            <div className={`h-full ${strengthConfig.color} ${strengthConfig.width} transition-all duration-500 rounded-full`}></div>
                          </div>
                          <span className={`text-xs ml-3 font-medium ${strengthConfig.textColor}`}>{strengthConfig.text}</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Use 8+ chars, uppercase, lowercase, numbers, and symbols
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-blue-800 mb-2">
                      Confirm Password *
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
                        placeholder="Confirm your password"
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
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors duration-200 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={loading}
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <div className="text-red-500 text-sm mt-2 flex items-center gap-2 animate-pulse">
                        <AlertCircle size={16} />
                        Passwords do not match
                      </div>
                    )}
                    {formData.confirmPassword && formData.password === formData.confirmPassword && formData.confirmPassword.length > 0 && (
                      <div className="text-green-500 text-sm mt-2 flex items-center gap-2">
                        <CheckCircle size={16} />
                        Passwords match
                      </div>
                    )}
                  </div>
                </div>

                {/* Terms Checkbox */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-200">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      required
                      disabled={loading}
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 mt-0.5 cursor-pointer transition-all duration-200"
                    />
                    <span className="text-sm text-slate-700 leading-relaxed">
                      I agree to the{' '}
                      <a 
                        href="/terms" 
                        
                        className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                      >
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a 
                        href="/privacy" 
                        
                        className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                      >
                        Privacy Policy
                      </a>. I understand that my data will be processed securely and I can withdraw consent at any time.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                    loading || !termsAccepted
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="animate-spin" size={24} />
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle size={24} />
                      <span>Create My Account</span>
                    </div>
                  )}
                </button>

                {/* Sign In Link */}
                <div className="text-center pt-6 border-t border-slate-200">
                  <p className="text-slate-600 mb-4">
                    Already have an account?{' '}
                    <a 
                      href="/login" 
                     
                      className="text-blue-600 hover:text-blue-700 font-semibold underline hover:no-underline transition-all duration-200"
                    >
                      Sign In
                    </a>
                  </p>
                  
                  {/* Security Notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                    <Shield size={16} />
                    <span>Your information is protected with 256-bit SSL encryption</span>
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

export default Register;