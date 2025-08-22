import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Truck, 
  Phone, 
  Mail, 
  Calendar,
  Star,
  Edit3, 
  Save, 
  X,
  Shield,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { isAuthenticated, getUser, getAuthHeader } from '../../utils/auth';

const DriverProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = getUser();
    if (user?.userType !== 'driver') {
      navigate('/driver-dashboard');
      return;
    }

    fetchProfile();
  }, [navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const profileData = data.data?.driver || data.driver || data;

      if (!profileData?._id) {
        throw new Error('Invalid profile data received');
      }

      // Ensure profile structure
      const formattedProfile = {
        ...profileData,
        driverProfile: profileData.driverProfile || {},
        statistics: profileData.statistics || {
          totalJobs: 0,
          completedJobs: 0,
          averageRating: 0,
          totalRatingsReceived: 0,
          successRate: 0
        },
        profileCompletion: profileData.profileCompletion || calculateProfileCompletion(profileData)
      };

      setProfile(formattedProfile);
      setEditedProfile(formattedProfile);

    } catch (err) {
      console.error('Fetch profile error:', err);
      setError(err.message || 'Failed to fetch profile data');
      
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateProfileCompletion = (profile) => {
    if (!profile) return 0;
    
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'vehicleType', 'vehicleCapacity', 'licenseNumber', 'licenseExpiry'];
    const optionalFields = ['dateOfBirth', 'address', 'city', 'state', 'vehicleMake', 'vehicleModel', 'vehicleYear', 'vehiclePlate', 'nationalId', 'experienceYears'];
    
    let completed = 0;
    let total = requiredFields.length + optionalFields.length;
    
    requiredFields.forEach(field => {
      if (profile[field]) completed += 1.5;
    });
    
    optionalFields.forEach(field => {
      if (profile[field]) completed += 1;
    });
    
    total = requiredFields.length * 1.5 + optionalFields.length;
    return Math.round((completed / total) * 100);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        method: 'PUT',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProfile)
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error(`Failed to update profile (${response.status})`);
      }

      const data = await response.json();
      const updatedProfile = data.data?.driver || data.driver || data;
      
      const formattedProfile = {
        ...updatedProfile,
        driverProfile: updatedProfile.driverProfile || {},
        statistics: updatedProfile.statistics || profile.statistics,
        profileCompletion: updatedProfile.profileCompletion || calculateProfileCompletion(updatedProfile)
      };
      
      setProfile(formattedProfile);
      setEditedProfile(formattedProfile);
      setEditing(false);
      alert('Profile updated successfully!');
      
    } catch (err) {
      console.error('Update profile error:', err);
      const errorMessage = err.message || 'Network error occurred while updating profile';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setEditedProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setEditedProfile(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const getCompletionColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const FormField = ({ label, field, type = "text", required = false, options = null }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      {editing ? (
        options ? (
          <select
            value={editedProfile?.[field] || ''}
            onChange={(e) => handleInputChange(field, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select {label}</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={editedProfile?.[field] || ''}
            onChange={(e) => handleInputChange(field, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <input
            type={type}
            value={editedProfile?.[field] || ''}
            onChange={(e) => handleInputChange(field, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
      ) : (
        <p className="py-2 text-gray-900">
          {type === 'date' && profile?.[field] 
            ? new Date(profile[field]).toLocaleDateString('en-KE') 
            : profile?.[field] || 'Not set'}
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-3">
            <button onClick={() => fetchProfile()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Try Again
            </button>
            <button onClick={() => navigate('/driver-dashboard')} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Not Found</h2>
          <button onClick={() => fetchProfile()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const vehicleTypes = [
    { value: 'pickup', label: 'Pickup' },
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

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <button onClick={() => navigate('/driver-dashboard')} className="text-blue-600 hover:text-blue-800 mb-2">
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Driver Profile</h1>
            </div>
            <div className="flex items-center space-x-3">
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <>
                  <button onClick={() => { setEditedProfile(profile); setEditing(false); setError(''); }} className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Profile Overview Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-12 h-12 text-blue-600" />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900">
                  {profile?.firstName} {profile?.lastName}
                </h2>
                <p className="text-gray-600">{profile?.vehicleType?.replace(/_/g, ' ').toUpperCase()}</p>
                
                {/* Rating */}
                <div className="flex items-center justify-center space-x-1 mt-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{profile?.statistics?.averageRating?.toFixed(1) || '0.0'}</span>
                  <span className="text-gray-500">({profile?.statistics?.totalRatingsReceived || 0} reviews)</span>
                </div>
              </div>

              {/* Profile Completion */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Profile Completion</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded ${getCompletionColor(profile?.profileCompletion || 0)}`}>
                    {profile?.profileCompletion || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      (profile?.profileCompletion || 0) >= 80 ? 'bg-green-500' : 
                      (profile?.profileCompletion || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${profile?.profileCompletion || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Jobs</span>
                  <span className="font-medium">{profile?.statistics?.totalJobs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium text-green-600">{profile?.statistics?.completedJobs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium">{profile?.statistics?.successRate || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Navigation Tabs */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'personal', label: 'Personal Info', icon: User },
                    { id: 'vehicle', label: 'Vehicle Info', icon: Truck },
                    { id: 'documents', label: 'Documents', icon: FileText },
                    { id: 'settings', label: 'Settings', icon: Shield }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow p-6">
              {activeTab === 'personal' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="First Name" field="firstName" required />
                    <FormField label="Last Name" field="lastName" required />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <p className="py-2 text-gray-900">{profile?.email}</p>
                        {profile?.emailVerified && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>
                    <FormField label="Phone" field="phone" type="tel" required />
                    <FormField label="Date of Birth" field="dateOfBirth" type="date" />
                    <FormField label="Gender" field="gender" options={genderOptions} />
                    <div className="md:col-span-2">
                      <FormField label="Address" field="address" />
                    </div>
                    <FormField label="City" field="city" />
                    <FormField label="State/County" field="state" />
                    <div className="md:col-span-2">
                      <FormField label="Bio" field="driverProfile.bio" type="textarea" />
                    </div>
                    <FormField label="Emergency Contact Name" field="emergencyContact" />
                    <FormField label="Emergency Contact Phone" field="emergencyPhone" type="tel" />
                  </div>
                </div>
              )}

              {activeTab === 'vehicle' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Vehicle Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Vehicle Type" field="vehicleType" options={vehicleTypes} required />
                    <FormField label="Vehicle Capacity (tonnes)" field="vehicleCapacity" type="number" required />
                    <FormField label="Vehicle Make" field="vehicleMake" />
                    <FormField label="Vehicle Model" field="vehicleModel" />
                    <FormField label="Vehicle Year" field="vehicleYear" type="number" />
                    <FormField label="License Plate" field="vehiclePlate" />
                    <FormField label="Experience Years" field="experienceYears" type="number" />
                    <FormField label="Insurance Valid Until" field="insuranceExpiry" type="date" />
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Documents & Licenses</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Driving License Number" field="licenseNumber" required />
                    <FormField label="License Expiry Date" field="licenseExpiry" type="date" required />
                    <FormField label="National ID Number" field="nationalId" />
                    <FormField label="KRA PIN" field="kraPin" />
                    
                    <div className="md:col-span-2">
                      <h4 className="font-medium text-gray-900 mb-3">Document Status</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          {profile?.driverProfile?.verified ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className="text-sm">Profile Verified</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {profile?.documentsVerified ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className="text-sm">Documents Verified</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {profile?.backgroundCheckPassed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                          )}
                          <span className="text-sm">Background Check</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Settings</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Account Information</h4>
                      <div className="bg-gray-50 p-4 rounded-md space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Account Created</span>
                          <span className="text-sm text-gray-900">
                            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-KE') : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Last Updated</span>
                          <span className="text-sm text-gray-900">
                            {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString('en-KE') : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Account Status</span>
                          <span className={`text-sm px-2 py-1 rounded ${profile?.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {profile?.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Verification Status</span>
                          <span className={`text-sm px-2 py-1 rounded ${profile?.driverProfile?.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {profile?.driverProfile?.verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </div>
                      </div>
                    </div>
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

export default DriverProfile;