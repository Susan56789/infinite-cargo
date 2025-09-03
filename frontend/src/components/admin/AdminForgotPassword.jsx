import React, { useState } from 'react';
import { Eye, EyeOff, Shield, AlertCircle, CheckCircle, Lock, Mail, ArrowLeft, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminForgotPassword = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState('email'); 
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
    resetToken: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend functionality
  React.useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

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

  const validateEmail = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCode = () => {
    const newErrors = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Verification code is required';
    } else if (formData.code.length !== 6 || !/^\d{6}$/.test(formData.code)) {
      newErrors.code = 'Please enter a valid 6-digit code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8 || formData.password.length > 128) {
      newErrors.password = 'Password must be between 8 and 128 characters long';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateEmail()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
      
      const response = await fetch(`${API_BASE_URL}/admin/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase()
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setMessage({
          type: 'success',
          text: 'A 6-digit verification code has been sent to your email address.'
        });
        setCurrentStep('verify');
        setCountdown(60); // Start 60-second countdown for resend
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          const fieldErrors = {};
          data.errors.forEach(error => {
            if (error.field) {
              fieldErrors[error.field] = error.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          setMessage({
            type: 'error',
            text: data.message || 'Failed to send verification code. Please try again.'
          });
        }
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setMessage({
        type: 'error',
        text: 'Unable to connect to server. Please check your internet connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateCode()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
      
      const response = await fetch(`${API_BASE_URL}/admin/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          code: formData.code.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success' && data.resetToken) {
        setFormData(prev => ({
          ...prev,
          resetToken: data.resetToken
        }));
        setMessage({
          type: 'success',
          text: 'Verification code confirmed! Please set your new password.'
        });
        setCurrentStep('reset');
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          const fieldErrors = {};
          data.errors.forEach(error => {
            if (error.field) {
              fieldErrors[error.field] = error.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          setMessage({
            type: 'error',
            text: data.message || 'Invalid or expired verification code.'
          });
        }
      }
    } catch (error) {
      console.error('Code verification error:', error);
      setMessage({
        type: 'error',
        text: 'Unable to verify code. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePassword()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
      
      const response = await fetch(`${API_BASE_URL}/admin/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: formData.resetToken,
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setMessage({
          type: 'success',
          text: 'Password has been reset successfully!'
        });
        setCurrentStep('success');
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          const fieldErrors = {};
          data.errors.forEach(error => {
            if (error.field) {
              fieldErrors[error.field] = error.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          setMessage({
            type: 'error',
            text: data.message || 'Failed to reset password. Please try again.'
          });
        }
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setMessage({
        type: 'error',
        text: 'Unable to reset password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
      
      const response = await fetch(`${API_BASE_URL}/admin/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase()
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setMessage({
          type: 'success',
          text: 'A new verification code has been sent to your email.'
        });
        setCountdown(60);
        setFormData(prev => ({ ...prev, code: '' }));
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to resend code. Please try again.'
        });
      }
    } catch (error) {
      console.error('Resend code error:', error);
      setMessage({
        type: 'error',
        text: 'Unable to resend code. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'email', label: 'Email', icon: Mail },
      { key: 'verify', label: 'Verify', icon: Key },
      { key: 'reset', label: 'Reset', icon: Lock },
      { key: 'success', label: 'Complete', icon: CheckCircle }
    ];

    const stepIndex = steps.findIndex(step => step.key === currentStep);

    return (
      <div className="flex justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === stepIndex;
          const isCompleted = index < stepIndex;
          
          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                isCompleted 
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/20 text-slate-400'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs ${
                isActive ? 'text-white font-medium' : 'text-slate-400'
              }`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-full h-0.5 mt-2 ${
                  isCompleted ? 'bg-green-500' : 'bg-white/20'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderEmailStep = () => (
    <form onSubmit={handleEmailSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Reset Admin Password</h2>
        <p className="text-slate-300">Enter your admin email address to receive a verification code</p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
          Admin Email Address
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

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        disabled={loading}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Sending Code...</span>
          </div>
        ) : (
          'Send Verification Code'
        )}
      </button>
    </form>
  );

  const renderVerifyStep = () => (
    <form onSubmit={handleCodeSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Enter Verification Code</h2>
        <p className="text-slate-300">
          We've sent a 6-digit code to <span className="font-medium text-white">{formData.email}</span>
        </p>
      </div>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-slate-200 mb-2">
          6-Digit Verification Code
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            className={`w-full pl-10 pr-4 py-3 bg-white/10 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 text-center text-2xl tracking-widest font-mono ${
              errors.code
                ? 'border-red-500 focus:ring-red-500'
                : 'border-white/20 focus:ring-purple-500 focus:border-transparent'
            }`}
            placeholder="000000"
            disabled={loading}
            maxLength={6}
            pattern="[0-9]{6}"
            required
          />
        </div>
        {errors.code && (
          <p className="mt-2 text-sm text-red-400">{errors.code}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Verifying...</span>
            </div>
          ) : (
            'Verify Code'
          )}
        </button>
        
        <button
          type="button"
          onClick={handleResendCode}
          className="px-4 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          disabled={loading || countdown > 0}
        >
          {countdown > 0 ? `Resend (${countdown}s)` : 'Resend Code'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setCurrentStep('email')}
        className="w-full text-slate-300 hover:text-white transition-colors duration-200 text-sm"
      >
        Back to email step
      </button>
    </form>
  );

  const renderResetStep = () => (
    <form onSubmit={handlePasswordSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Set New Password</h2>
        <p className="text-slate-300">Create a strong password for your admin account</p>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
          New Password
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
            placeholder="Enter new password"
            disabled={loading}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors duration-200"
            disabled={loading}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-2 text-sm text-red-400">{errors.password}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200 mb-2">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full pl-10 pr-12 py-3 bg-white/10 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
              errors.confirmPassword
                ? 'border-red-500 focus:ring-red-500'
                : 'border-white/20 focus:ring-purple-500 focus:border-transparent'
            }`}
            placeholder="Confirm new password"
            disabled={loading}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors duration-200"
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-blue-300 font-medium mb-2">Password Requirements:</h3>
        <ul className="text-blue-200 text-sm space-y-1">
          <li>• At least 8 characters long</li>
          <li>• Contains uppercase and lowercase letters</li>
          <li>• Contains at least one number</li>
          <li>• Contains at least one special character (@$!%*?&)</li>
        </ul>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-500 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        disabled={loading}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Resetting Password...</span>
          </div>
        ) : (
          'Reset Password'
        )}
      </button>
    </form>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-6 shadow-lg">
        <CheckCircle className="w-8 h-8 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-4">Password Reset Successful!</h2>
      
      <p className="text-slate-300 mb-6">
        Your admin password has been successfully reset. You can now sign in with your new password.
      </p>

      <button
        onClick={() => navigate('/admin/login')}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      >
        Go to Admin Login
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Password Reset</h1>
          <p className="text-slate-300">
            Secure password recovery for admin accounts
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-8">
          {renderStepIndicator()}

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

          {currentStep === 'email' && renderEmailStep()}
          {currentStep === 'verify' && renderVerifyStep()}
          {currentStep === 'reset' && renderResetStep()}
          {currentStep === 'success' && renderSuccessStep()}

          {currentStep !== 'success' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/admin/login')}
                className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors duration-200 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Admin Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminForgotPassword;