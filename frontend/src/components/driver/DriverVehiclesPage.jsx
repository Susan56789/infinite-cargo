import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Info,
  Save,
  X,
  Loader
} from 'lucide-react';
import { getAuthHeader, isAuthenticated, getUser } from '../../utils/auth';

const DriverVehiclesPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    type: '',
    model: '',
    year: '',
    plateNumber: '',
    capacity: '',
    color: '',
    insuranceExpiry: '',
    roadworthyExpiry: '',
    maintenanceSchedule: '',
    status: 'active',
    description: ''
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

  const vehicleStatuses = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
    { value: 'maintenance', label: 'Under Maintenance', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'inactive', label: 'Inactive', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    // Check authentication before fetching data
    if (!isAuthenticated()) {
      setError('You must be logged in to view vehicles');
      setLoading(false);
      // Redirect to login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    const currentUser = getUser();
    if (currentUser?.userType !== 'driver') {
      setError('Only drivers can access this page');
      setLoading(false);
      return;
    }

    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      // Double-check authentication before making the request
      if (!isAuthenticated()) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        setError('Authentication failed. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const profile = data.data.driver;
        
        // Create a vehicle entry from profile data if it exists
        const simulatedVehicles = [];
        if (profile.vehicleType) {
          simulatedVehicles.push({
            id: 'primary',
            type: profile.vehicleType,
            model: profile.vehicleModel || 'Not specified',
            year: profile.vehicleYear || null,
            plateNumber: profile.vehiclePlate || 'Not specified',
            capacity: profile.vehicleCapacity || 0,
            color: 'Not specified',
            insuranceExpiry: null,
            roadworthyExpiry: null,
            maintenanceSchedule: null,
            status: 'active',
            description: 'Primary vehicle',
            isPrimary: true
          });
        }
        
        setVehicles(simulatedVehicles);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || `Failed to load vehicle information (${response.status})`);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error: Unable to connect to server');
      } else {
        setError('Network error loading vehicles');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: '',
      model: '',
      year: '',
      plateNumber: '',
      capacity: '',
      color: '',
      insuranceExpiry: '',
      roadworthyExpiry: '',
      maintenanceSchedule: '',
      status: 'active',
      description: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    // Check authentication before submitting
    if (!isAuthenticated()) {
      setError('You must be logged in to save vehicles');
      return;
    }

    // Basic validation
    if (!formData.type) {
      setError('Please select a vehicle type');
      return;
    }

    try {
      const updateData = {
        vehicleType: formData.type,
        vehicleModel: formData.model,
        vehicleYear: formData.year ? parseInt(formData.year) : null,
        vehiclePlate: formData.plateNumber,
        vehicleCapacity: formData.capacity ? parseFloat(formData.capacity) : null
      };

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/profile', {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (response.status === 401 || response.status === 403) {
        setError('Authentication failed. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        setSuccess(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!');
        setShowAddModal(false);
        setEditingVehicle(null);
        resetForm();
        fetchVehicles();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || `Failed to save vehicle (${response.status})`);
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error: Unable to connect to server');
      } else {
        setError('Network error saving vehicle');
      }
    }
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      type: vehicle.type || '',
      model: vehicle.model || '',
      year: vehicle.year?.toString() || '',
      plateNumber: vehicle.plateNumber || '',
      capacity: vehicle.capacity?.toString() || '',
      color: vehicle.color || '',
      insuranceExpiry: vehicle.insuranceExpiry || '',
      roadworthyExpiry: vehicle.roadworthyExpiry || '',
      maintenanceSchedule: vehicle.maintenanceSchedule || '',
      status: vehicle.status || 'active',
      description: vehicle.description || ''
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingVehicle(null);
    resetForm();
    setError('');
  };

  const getStatusColor = (status) => {
    return vehicleStatuses.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
  };

  const getVehicleTypeLabel = (type) => {
    return vehicleTypes.find(v => v.value === type)?.label || type;
  };

  const isExpiringSoon = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  };

  // Show authentication error if user is not authenticated
  if (!isAuthenticated() && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-sm p-8 max-w-md">
          <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">You must be logged in to view your vehicles.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading vehicles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Vehicles</h1>
                <p className="text-sm text-gray-600">Manage your fleet and vehicle information</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2" />
              Add Vehicle
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
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

        {/* Vehicles Grid */}
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Truck className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {vehicle.model}
                      </h3>
                      <p className="text-sm text-gray-600">{getVehicleTypeLabel(vehicle.type)}</p>
                    </div>
                  </div>
                  {vehicle.isPrimary && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Primary
                    </span>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Plate Number:</span>
                    <span className="text-sm font-medium text-gray-900">{vehicle.plateNumber}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Year:</span>
                    <span className="text-sm font-medium text-gray-900">{vehicle.year || 'N/A'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Capacity:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {vehicle.capacity ? `${vehicle.capacity} tonnes` : 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                      {vehicleStatuses.find(s => s.value === vehicle.status)?.label || vehicle.status}
                    </span>
                  </div>
                </div>

                {/* Alerts for expiring documents */}
                <div className="space-y-2 mb-4">
                  {vehicle.insuranceExpiry && (
                    <div className={`flex items-center p-2 rounded-lg text-xs ${
                      isExpired(vehicle.insuranceExpiry) ? 'bg-red-50 text-red-700' :
                      isExpiringSoon(vehicle.insuranceExpiry) ? 'bg-yellow-50 text-yellow-700' : 'hidden'
                    }`}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Insurance {isExpired(vehicle.insuranceExpiry) ? 'expired' : 'expiring soon'}
                    </div>
                  )}
                  
                  {vehicle.roadworthyExpiry && (
                    <div className={`flex items-center p-2 rounded-lg text-xs ${
                      isExpired(vehicle.roadworthyExpiry) ? 'bg-red-50 text-red-700' :
                      isExpiringSoon(vehicle.roadworthyExpiry) ? 'bg-yellow-50 text-yellow-700' : 'hidden'
                    }`}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Roadworthy {isExpired(vehicle.roadworthyExpiry) ? 'expired' : 'expiring soon'}
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <Edit size={14} className="mr-1" />
                    Edit
                  </button>
                  
                  {!vehicle.isPrimary && (
                    <button className="flex items-center justify-center px-3 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {vehicle.description && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{vehicle.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck className="h-24 w-24 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles registered</h3>
            <p className="text-gray-600 mb-6">Add your first vehicle to start managing your fleet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Add Your First Vehicle
            </button>
          </div>
        )}

        {/* Vehicle Management Tips */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Vehicle Management Tips</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Keep your insurance and roadworthy certificates up to date</li>
                  <li>Regular maintenance helps prevent breakdowns and extends vehicle life</li>
                  <li>Accurate vehicle information helps you get better job matches</li>
                  <li>Update vehicle status when under maintenance to avoid job conflicts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vehicle Type and Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    placeholder="e.g., Toyota Hiace, Isuzu NPR"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Year and Plate Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    min="1990"
                    max="2030"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    name="plateNumber"
                    value={formData.plateNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., KBZ 123A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Capacity and Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity (Tonnes)
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    min="0.1"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    placeholder="e.g., White, Blue"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Document Expiry Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Expiry
                  </label>
                  <input
                    type="date"
                    name="insuranceExpiry"
                    value={formData.insuranceExpiry}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roadworthy Expiry
                  </label>
                  <input
                    type="date"
                    name="roadworthyExpiry"
                    value={formData.roadworthyExpiry}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status and Maintenance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vehicleStatuses.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Maintenance
                  </label>
                  <input
                    type="date"
                    name="maintenanceSchedule"
                    value={formData.maintenanceSchedule}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Additional notes about this vehicle..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
              >
                <Save size={16} className="mr-2" />
                {editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverVehiclesPage;