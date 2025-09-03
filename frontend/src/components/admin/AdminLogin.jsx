import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, AlertCircle, CheckCircle, Lock, Mail, ArrowLeft } from 'lucide-react';
import { authManager } from '../../utils/auth'; 
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Check if admin is already logged in
  useEffect(() => {
    if (authManager.isAuthenticated(true)) {
      
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    if (message.text) {
      setMessage({ type: '', text: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    setErrors({});

    try {
      const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
      

      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(), 
          password: formData.password
        })
      });

      const data = await response.json();
     

      if (response.ok && data.status === 'success' && data.token && data.admin) {
        
        // Store admin auth data - using sessionStorage for admin (rememberMe = false, isAdmin = true)
        authManager.setAuth(data.token, data.admin, false, true);
        
        // Verify the storage worked
        const isAuth = authManager.isAuthenticated(true);
        const storedUser = authManager.getUser(true);
        const storedToken = authManager.getToken(true);
        
        
        if (isAuth && storedUser && storedToken) {
          setLoginSuccess(true);
          setMessage({ 
            type: 'success', 
            text: 'Login successful! Redirecting to dashboard...' 
          });

          setTimeout(() => {
            navigate('/admin/dashboard');
          }, 1500);
        } else {
          throw new Error('Failed to store authentication data');
        }
        
      } else {
        console.error('Login failed:', data);
        
        if (data.errors && Array.isArray(data.errors)) {
          const fieldErrors = {};
          data.errors.forEach(error => {
            if (error.field) {
              fieldErrors[error.field] = error.message;
            }
          });
          
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          } else {
            setMessage({ 
              type: 'error', 
              text: data.message || 'Validation failed. Please check your input.' 
            });
          }
        } else {
          setMessage({ 
            type: 'error', 
            text: data.message || 'Login failed. Please check your credentials.' 
          });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setMessage({ 
          type: 'error', 
          text: 'Unable to connect to server. Please check your internet connection.' 
        });
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setMessage({ 
          type: 'error', 
          text: 'Network error. Please check your connection and try again.' 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: error.message || 'An unexpected error occurred. Please try again later.' 
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  if (loginSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full mb-6 shadow-lg">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Login Successful!</h1>
            <p className="text-slate-300 mb-6">
              Welcome back! You will be redirected to the admin dashboard shortly.
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-300">
              <div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin"></div>
              <span className="text-sm">Redirecting...</span>
            </div>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="mt-6 text-blue-300 hover:text-white transition-colors duration-200 text-sm underline"
            >
              Click here if not redirected automatically
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}
      ></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-slate-300">
            Secure access for authorized personnel
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
          {message.text && (
            <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-3 bg-white/10 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.email
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-white/20 focus:ring-purple-500 focus:border-transparent'
                  }`}
                  placeholder="Enter your admin email"
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-12 py-3 bg-white/10 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                    errors.password
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-white/20 focus:ring-purple-500 focus:border-transparent'
                  }`}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors duration-200"
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm text-amber-200">
              This is a secure admin area. All activities are logged and monitored.
            </span>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleBackToMain}
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors duration-200 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Main Site
            </button>
            <div className="mt-4"></div>
              <button
                type="button"
                onClick={() => navigate('/admin/forgot-password')}
                className="text-sm text-blue-300 hover:text-white transition-colors duration-200 underline"
              >
                Forgot Password?
              </button>
            </div>
          </div>
        </div>
      </div>
   
  );
};

export default AdminLogin;