import React, { useState, useEffect } from 'react';
import { 
  User, 
  Truck, 
  MapPin, 
  Phone,
  Save,
  AlertCircle,
  CheckCircle,
  Loader,
  ArrowLeft,
  Shield,
  Star
} from 'lucide-react';
import { getAuthHeader, authManager, getUser } from '../../utils/auth';

const DriverProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    vehicleType: '',
    vehicleCapacity: '',
    vehiclePlate: '',
    vehicleModel: '',
    vehicleYear: '',
    licenseNumber: '',
    licenseExpiry: '',
    experienceYears: '',
    emergencyContact: '',
    emergencyPhone: '',
    bio: ''
  });

  const vehicleTypes = [
    { value: 'pickup', label: 'Pickup Truck' },
    { value: 'van', label: 'Van' },
    { value: 'small_truck', label: 'Small Truck' },
    { value: 'medium_truck', label: 'Medium Truck' },
    { value: 'large_truck', label: 'Large Truck' },
    { value: 'heavy_truck', label: 'Heavy Truck' },
    { value: 'trailer', label: 'Trailer' },
    { value: 'refrigerated_truck', label: 'Refrigerated Truck' },
    { value: 'flatbed', label: 'Flatbed' },
    { value: 'container_truck', label: 'Container Truck' }
  ];

  useEffect(() => {
    // Try to get user from local storage first
    const currentUser = getUser();
    if (currentUser) {
      setUser(currentUser);
      populateFormData(currentUser);
    }
    
    // Then fetch fresh data from API
    fetchProfile();
  }, []);

  const populateFormData = (profile) => {
    setFormData({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      zipCode: profile.zipCode || '',
      vehicleType: profile.vehicleType || '',
      vehicleCapacity: profile.vehicleCapacity || '',
      vehiclePlate: profile.vehiclePlate || '',
      vehicleModel: profile.vehicleModel || '',
      vehicleYear: profile.vehicleYear || '',
      licenseNumber: profile.licenseNumber || '',
      licenseExpiry: profile.licenseExpiry ? profile.licenseExpiry.split('T')[0] : '',
      experienceYears: profile.experienceYears || '',
      emergencyContact: profile.emergencyContact || '',
      emergencyPhone: profile.emergencyPhone || '',
      bio: profile.driverProfile?.bio || profile.bio || ''
    });
  };

  const fetchProfile = async () => {
    try {
      setError('');
      const authHeaders = getAuthHeader();
      const currentUser = getUser();
      
      // Debug: Check if we have proper auth headers and user data
      console.log('Auth headers:', authHeaders);
      console.log('Current user from getUser():', currentUser);
      
      if (!authHeaders.Authorization) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }

      // Check if we have a valid user with driver userType
      if (!currentUser || currentUser.userType !== 'driver') {
        setError('Invalid user type. This page is only for drivers.');
        setLoading(false);
        return;
      }

      console.log('Making request to fetch driver profile...');
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        method: 'GET',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data:', data);
        const profile = data.data.driver;
        setUser(profile);
        populateFormData(profile);
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        
        // Handle specific error cases
        if (response.status === 400 && errorData.message === 'Invalid driver ID') {
          setError('Authentication issue detected. Please logout and login again to refresh your session.');
        } else if (response.status === 403) {
          setError('Access denied. Make sure you are logged in as a driver.');
        } else {
          setError(errorData.message || `Failed to load profile (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Network error loading profile. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Validate required fields
      const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'vehicleType', 'vehicleCapacity', 'licenseNumber'];
      const missingFields = requiredFields.filter(field => !formData[field] || formData[field].toString().trim() === '');
      
      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(', ')}`);
        setSaving(false);
        return;
      }

      const authHeaders = getAuthHeader();
      const currentUser = getUser();
      
      console.log('Auth headers for update:', authHeaders);
      console.log('Current user for update:', currentUser);
      
      if (!authHeaders.Authorization) {
        setError('No authentication token found. Please login again.');
        setSaving(false);
        return;
      }

      // Check if we have a valid user with driver userType
      if (!currentUser || currentUser.userType !== 'driver') {
        setError('Invalid user type. This page is only for drivers.');
        setSaving(false);
        return;
      }

      const updateData = {
        ...formData,
        vehicleCapacity: formData.vehicleCapacity ? parseFloat(formData.vehicleCapacity) : null,
        experienceYears: formData.experienceYears ? parseInt(formData.experienceYears) : null,
        vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : null
      };

      console.log('Sending update data:', updateData);

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      console.log('Update response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const updatedProfile = data.data.driver;
        setUser(updatedProfile);
        
        // Update auth storage
        authManager.setAuth(
          authManager.getToken(),
          updatedProfile,
          localStorage.getItem('infiniteCargoRememberMe') === 'true'
        );
        
        // Update form data with the latest profile data
        populateFormData(updatedProfile);
        
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        const errorData = await response.json();
        console.error('Update error response:', errorData);
        
        // Handle specific error cases
        if (response.status === 400 && errorData.message === 'Invalid driver ID') {
          setError('Authentication issue detected. Please logout and login again to refresh your session.');
        } else if (response.status === 403) {
          setError('Access denied. Make sure you are logged in as a driver.');
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map(err => err.msg || err.message).join(', ');
          setError(`Validation errors: ${errorMessages}`);
        } else {
          setError(errorData.message || `Failed to update profile (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Network error updating profile. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const calculateProfileCompletion = () => {
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'vehicleType', 'vehicleCapacity', 'licenseNumber'];
    const optionalFields = ['location', 'address', 'city', 'vehiclePlate', 'vehicleModel', 'experienceYears', 'bio'];
    
    const completedRequired = requiredFields.filter(field => formData[field] && formData[field].toString().trim() !== '').length;
    const completedOptional = optionalFields.filter(field => formData[field] && formData[field].toString().trim() !== '').length;
    
    const requiredPercentage = (completedRequired / requiredFields.length) * 70;
    const optionalPercentage = (completedOptional / optionalFields.length) * 30;
    
    return Math.round(requiredPercentage + optionalPercentage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const profileCompletion = calculateProfileCompletion();
  const fullName = `${formData.firstName} ${formData.lastName}`.trim();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Update Profile</h1>
                <p className="text-sm text-gray-600">
                  {fullName ? `Welcome, ${fullName}` : 'Manage your driver profile and vehicle information'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Profile Completion</div>
              <div className="flex items-center mt-1">
                <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{profileCompletion}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="mt-1 text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Stats */}
        {user?.statistics && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Star size={18} className="mr-2 text-yellow-500" />
              Driver Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{user.statistics.totalJobs}</div>
                <div className="text-sm text-gray-600">Total Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{user.statistics.completedJobs}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center">
                  <Star className="h-5 w-5 mr-1 fill-current" />
                  {user.statistics.averageRating.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Rating</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{user.statistics.successRate}%</div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User size={18} className="mr-2 text-gray-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Nairobi, Kenya"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Experience Years
                </label>
                <input
                  type="number"
                  name="experienceYears"
                  value={formData.experienceYears}
                  onChange={handleInputChange}
                  min="0"
                  max="50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MapPin size={18} className="mr-2 text-gray-600" />
              Address Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State/County
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zip/Postal Code
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Truck size={18} className="mr-2 text-gray-600" />
              Vehicle Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type *
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Vehicle Type</option>
                  {vehicleTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Capacity (Tonnes) *
                </label>
                <input
                  type="number"
                  name="vehicleCapacity"
                  value={formData.vehicleCapacity}
                  onChange={handleInputChange}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Model
                </label>
                <input
                  type="text"
                  name="vehicleModel"
                  value={formData.vehicleModel}
                  onChange={handleInputChange}
                  placeholder="e.g., Toyota Hiace, Isuzu NPR"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Year
                </label>
                <input
                  type="number"
                  name="vehicleYear"
                  value={formData.vehicleYear}
                  onChange={handleInputChange}
                  min="1990"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Plate Number
                </label>
                <input
                  type="text"
                  name="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={handleInputChange}
                  placeholder="e.g., KBZ 123A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* License Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield size={18} className="mr-2 text-gray-600" />
              License Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Number *
                </label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Expiry Date
                </label>
                <input
                  type="date"
                  name="licenseExpiry"
                  value={formData.licenseExpiry}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Phone size={18} className="mr-2 text-gray-600" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Professional Bio
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brief Description (Optional)
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                maxLength={1000}
                placeholder="Tell cargo owners about your experience, specializations, and what makes you a reliable driver..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-600">
                {formData.bio.length}/1000 characters
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
            >
              {saving ? (
                <>
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Update Profile
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverProfile;