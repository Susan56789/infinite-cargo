import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  Calendar, 
  DollarSign, 
  Weight, 
  Clock, 
  User, 
  Package, 
  AlertCircle, 
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Plus,
  MessageSquare,
  Loader,
  CheckCircle,
  Phone,
  Mail,
  Shield,
  Eye,
  X,
  Star,
  ExternalLink
} from 'lucide-react';

import { 
  isAuthenticated, 
  getUser, 
  getAuthHeader 
} from '../utils/auth';

// BidForm Component - Same as before
const BidForm = ({ load, onBidSubmit, onCancel, submitting }) => {
  const [bidData, setBidData] = useState({
    bidAmount: '',
    proposedPickupDate: '',
    proposedDeliveryDate: '',
    message: '',
    coverLetter: '',
    vehicleDetails: {
      type: 'medium_truck',
      capacity: 5
    },
    additionalServices: [],
    terms: {
      paymentMethod: 'cash',
      paymentTiming: 'on_delivery'
    },
    currency: 'KES'
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!bidData.bidAmount || parseFloat(bidData.bidAmount) < 1) {
      newErrors.bidAmount = 'Bid amount must be at least 1 KES';
    }
    
    if (load.budget && parseFloat(bidData.bidAmount) > parseFloat(load.budget) * 2) {
      newErrors.bidAmount = 'Bid amount seems unusually high compared to budget';
    }
    
    if (!bidData.proposedPickupDate) {
      newErrors.proposedPickupDate = 'Valid proposed pickup date is required';
    } else {
      const pickupDate = new Date(bidData.proposedPickupDate);
      if (isNaN(pickupDate.getTime())) {
        newErrors.proposedPickupDate = 'Invalid pickup date format';
      } else if (pickupDate < new Date()) {
        newErrors.proposedPickupDate = 'Pickup date cannot be in the past';
      }
    }
    
    if (!bidData.proposedDeliveryDate) {
      newErrors.proposedDeliveryDate = 'Valid proposed delivery date is required';
    } else {
      const deliveryDate = new Date(bidData.proposedDeliveryDate);
      const pickupDate = new Date(bidData.proposedPickupDate);
      
      if (isNaN(deliveryDate.getTime())) {
        newErrors.proposedDeliveryDate = 'Invalid delivery date format';
      } else if (bidData.proposedPickupDate && deliveryDate <= pickupDate) {
        newErrors.proposedDeliveryDate = 'Proposed delivery date must be after pickup date';
      }
    }

    if (bidData.message && bidData.message.length > 1000) {
      newErrors.message = 'Message cannot exceed 1000 characters';
    }

    if (bidData.coverLetter && bidData.coverLetter.length > 2000) {
      newErrors.coverLetter = 'Cover letter cannot exceed 2000 characters';
    }

    const validVehicleTypes = [
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ];
    if (!validVehicleTypes.includes(bidData.vehicleDetails.type)) {
      newErrors.vehicleType = 'Invalid vehicle type selected';
    }

    if (!bidData.vehicleDetails.capacity || parseFloat(bidData.vehicleDetails.capacity) < 0.1) {
      newErrors.vehicleCapacity = 'Vehicle capacity must be at least 0.1 tonnes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const bidPayload = {
      load: load._id,
      bidAmount: parseFloat(bidData.bidAmount),
      currency: bidData.currency,
      proposedPickupDate: bidData.proposedPickupDate,
      proposedDeliveryDate: bidData.proposedDeliveryDate,
      message: bidData.message || undefined,
      coverLetter: bidData.coverLetter || undefined,
      vehicleDetails: {
        type: bidData.vehicleDetails.type,
        capacity: parseFloat(bidData.vehicleDetails.capacity)
      },
      additionalServices: bidData.additionalServices,
      pricingBreakdown: {
        baseFare: parseFloat(bidData.bidAmount),
        totalAmount: parseFloat(bidData.bidAmount)
      },
      terms: bidData.terms
    };

    await onBidSubmit(bidPayload);
  };

  const handleInputChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleVehicleDetailsChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      vehicleDetails: {
        ...prev.vehicleDetails,
        [field]: value
      }
    }));
  };

  const handleTermsChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      terms: {
        ...prev.terms,
        [field]: value
      }
    }));
  };

  return (
    <div className="bg-gray-50 border rounded-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Place Your Bid
        </h4>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bid Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign size={16} className="inline mr-1" />
            Bid Amount (KES) *
          </label>
          <input
            type="number"
            value={bidData.bidAmount}
            onChange={(e) => handleInputChange('bidAmount', e.target.value)}
            placeholder={`Budget: KES ${load.budget || 'Not specified'}`}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.bidAmount ? 'border-red-300' : 'border-gray-300'
            }`}
            min="1"
            step="0.01"
          />
          {errors.bidAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.bidAmount}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Pickup Date *
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedPickupDate}
              onChange={(e) => handleInputChange('proposedPickupDate', e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.proposedPickupDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.proposedPickupDate && (
              <p className="mt-1 text-sm text-red-600">{errors.proposedPickupDate}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Delivery Date *
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedDeliveryDate}
              onChange={(e) => handleInputChange('proposedDeliveryDate', e.target.value)}
              min={bidData.proposedPickupDate || new Date().toISOString().slice(0, 16)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.proposedDeliveryDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.proposedDeliveryDate && (
              <p className="mt-1 text-sm text-red-600">{errors.proposedDeliveryDate}</p>
            )}
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type *
            </label>
            <select
              value={bidData.vehicleDetails.type}
              onChange={(e) => handleVehicleDetailsChange('type', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.vehicleType ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="pickup">Pickup Truck</option>
              <option value="van">Van</option>
              <option value="small_truck">Small Truck</option>
              <option value="medium_truck">Medium Truck</option>
              <option value="large_truck">Large Truck</option>
              <option value="heavy_truck">Heavy Truck</option>
              <option value="trailer">Trailer</option>
              <option value="refrigerated_truck">Refrigerated Truck</option>
              <option value="flatbed">Flatbed</option>
              <option value="container_truck">Container Truck</option>
            </select>
            {errors.vehicleType && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleType}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (tonnes) *
            </label>
            <input
              type="number"
              value={bidData.vehicleDetails.capacity}
              onChange={(e) => handleVehicleDetailsChange('capacity', parseFloat(e.target.value) || '')}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.vehicleCapacity ? 'border-red-300' : 'border-gray-300'
              }`}
              min="0.1"
              step="0.1"
              placeholder="e.g. 5.0"
            />
            {errors.vehicleCapacity && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleCapacity}</p>
            )}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MessageSquare size={16} className="inline mr-1" />
            Brief Message (Optional)
          </label>
          <textarea
            value={bidData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            placeholder="Add a brief message about your bid..."
            rows={2}
            maxLength={1000}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.message ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">{bidData.message.length}/1000 characters</p>
            {errors.message && (
              <p className="text-xs text-red-600">{errors.message}</p>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Submit Bid
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const LoadDetail = () => {
  // Enhanced parameter extraction with multiple fallbacks
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  
  const getLoadId = () => {
    
    if (params.loadId) {
      return params.loadId;
    }
    
    if (params.id) {
      return params.id;
    }
    
    const pathParts = location.pathname.split('/');
    const loadIndex = pathParts.findIndex(part => part === 'loads');
    if (loadIndex >= 0 && pathParts[loadIndex + 1]) {
      const extractedId = pathParts[loadIndex + 1];
      return extractedId;
    }
    
    // Method 4: Try to match MongoDB ObjectId pattern in URL
    const mongoIdPattern = /[a-fA-F0-9]{24}/;
    const mongoIdMatch = location.pathname.match(mongoIdPattern);
    if (mongoIdMatch) {
      return mongoIdMatch[0];
    }
    return null;
  };
  
  const loadId = getLoadId();
  
  const [load, setLoad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showBidForm, setShowBidForm] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Utility functions
  const checkAuthStatus = () => {
    try {
      const authenticated = isAuthenticated(false);
      const userData = getUser(false);
      
      setIsUserAuthenticated(authenticated);
      setUser(userData);
      
      return authenticated;
    } catch (error) {
      console.warn('Auth check failed:', error);
      setIsUserAuthenticated(false);
      setUser(null);
      return false;
    }
  };

  const getAuthHeaders = () => {
    try {
      if (isUserAuthenticated) {
        const authHeader = getAuthHeader(false);
        if (authHeader && typeof authHeader === 'object') {
          return authHeader;
        }
        return {};
      }
      return {};
    } catch (error) {
      console.warn('Failed to get auth headers:', error);
      return {};
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString));
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const getCargoTypeLabel = (type) => {
    if (!type) return 'N/A';
    const cargoTypes = {
      'electronics': 'Electronics',
      'furniture': 'Furniture', 
      'construction_materials': 'Construction Materials',
      'food_beverages': 'Food & Beverages',
      'textiles': 'Textiles',
      'machinery': 'Machinery',
      'medical_supplies': 'Medical Supplies',
      'automotive_parts': 'Automotive Parts',
      'agricultural_products': 'Agricultural Products',
      'chemicals': 'Chemicals',
      'fragile_items': 'Fragile Items',
      'hazardous_materials': 'Hazardous Materials',
      'livestock': 'Livestock',
      'containers': 'Containers',
      'other': 'Other'
    };
    return cargoTypes[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getVehicleTypeLabel = (type) => {
    if (!type) return 'N/A';
    const vehicleTypes = {
      'pickup': 'Pickup Truck',
      'van': 'Van',
      'small_truck': 'Small Truck',
      'medium_truck': 'Medium Truck',
      'large_truck': 'Large Truck',
      'heavy_truck': 'Heavy Truck',
      'trailer': 'Trailer',
      'refrigerated_truck': 'Refrigerated Truck',
      'flatbed': 'Flatbed',
      'container_truck': 'Container Truck'
    };
    return vehicleTypes[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Load the specific load details
  const fetchLoadDetail = async () => {
    try {
      setLoading(true);
      setError('');

      if (!loadId) {
        console.error('Load ID is missing');
        throw new Error('Load ID is required but not found in the URL');
      }
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/loads/${loadId}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Load not found. This load may have been removed or the link is invalid.');
        } else if (response.status === 403) {
          throw new Error('Access denied. You do not have permission to view this load.');
        } else {
          let errorMsg = 'Failed to load details';
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } catch (parseError) {
            console.warn('Could not parse error response');
          }
          throw new Error(`${errorMsg} (HTTP ${response.status})`);
        }
      }

      const data = await response.json();

      if (data.status !== 'success' || !data.data?.load) {
        throw new Error('Invalid load data received from server');
      }

      const loadData = data.data.load;

      // Process load to ensure consistent data structure
      const processedLoad = {
        ...loadData,
        _id: loadData._id || loadData.id,
        title: loadData.title || 'Untitled Load',
        description: loadData.description || 'No description available',
        cargoOwnerName: loadData.cargoOwnerName || loadData.postedBy?.name || 'Anonymous',
        pickupLocation: loadData.pickupLocation || 'Location not specified',
        deliveryLocation: loadData.deliveryLocation || 'Location not specified',
        weight: loadData.weight || 0,
        budget: loadData.budget || 0,
        cargoType: loadData.cargoType || 'other',
        vehicleType: loadData.vehicleType || 'van',
        status: loadData.status || 'available',
        createdAt: loadData.createdAt || new Date().toISOString(),
        isUrgent: Boolean(loadData.isUrgent),
        isPriorityListing: Boolean(loadData.isPriorityListing),
        bidCount: loadData.bidCount || 0,
        viewCount: loadData.viewCount || 0,
        postedBy: loadData.postedBy || {
          _id: loadData.postedBy || loadData.cargoOwnerId,
          name: loadData.cargoOwnerName || 'Anonymous',
          rating: 4.5,
          isVerified: false
        }
      };
      setLoad(processedLoad);
      
    } catch (error) {
      console.error('Error loading load detail:', error);
      setError(error.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Handle bid submission
  const handleBidSubmit = async (bidData) => {
    try {
      setSubmittingBid(true);

      if (!isUserAuthenticated) {
        setShowLoginPrompt(true);
        return;
      }

      if (user?.userType !== 'driver') {
        setError('Only drivers can place bids on loads.');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(bidData)
      });

      if (!response.ok) {
        let errorMsg = 'Failed to place bid';
        
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
          
          if (response.status === 400) {
            if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMsg = errorData.errors[0].msg || errorData.errors[0].message || errorMsg;
            } else if (errorMsg.includes('already')) {
              errorMsg = 'You already have a bid on this load.';
            }
          } else if (response.status === 403) {
            errorMsg = 'Only drivers can place bids.';
          } else if (response.status === 404) {
            errorMsg = 'Load not found or no longer available.';
          }
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (result.status === 'success') {
        setSuccessMessage('Bid placed successfully! The cargo owner will be notified.');
        setShowBidForm(false);
        
        // Refresh load data to update bid count
        await fetchLoadDetail();
      } else {
        throw new Error(result.message || 'Unexpected response from server');
      }

    } catch (error) {
      console.error('Bid submit error:', error);
      setError(error.message || 'Failed to place bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleBidClick = () => {
    if (!isUserAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    if (user?.userType !== 'driver') {
      setError('Only drivers can place bids on loads.');
      return;
    }

    setShowBidForm(true);
  };

  const handleLogin = () => {
    setShowLoginPrompt(false);
    navigate('/login');
  };

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    checkAuthStatus();
    
    if (loadId) {
      fetchLoadDetail();
    } else {
      console.error('No load ID detected from URL');
      setError('No load ID provided in URL. Please check the link and try again.');
      setLoading(false);
    }
  }, [loadId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading load details...</p>
          {loadId && (
            <p className="text-sm text-gray-500 mt-2">Load ID: {loadId}</p>
          )}
        </div>
      </div>
    );
  }

  if (error && !load) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Load Not Found</h1>
            <p className="text-gray-600 mb-2">{error}</p>
            {loadId && (
              <p className="text-sm text-gray-500 mb-6">Attempted Load ID: {loadId}</p>
            )}
            <div className="bg-gray-100 p-4 rounded-md mb-6">
              <h3 className="font-medium text-gray-800 mb-2">Debug Information:</h3>
              <div className="text-left text-sm text-gray-600">
                <p><strong>Current URL:</strong> {window.location.href}</p>
                <p><strong>Pathname:</strong> {location.pathname}</p>
                <p><strong>URL Params:</strong> {JSON.stringify(params)}</p>
                <p><strong>Detected Load ID:</strong> {loadId || 'None'}</p>
              </div>
            </div>
            <div className="flex justify-center space-x-3">
              <Link
                to="/search-loads"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Browse Loads
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Link
                  to="/search-loads"
                  className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Loads
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Load Details</h1>
                  <p className="text-gray-600">Complete load information and bidding</p>
                </div>
              </div>
              <button
                onClick={fetchLoadDetail}
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={loading}
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-green-400 hover:text-green-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error occurred:</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {load && (
          <div className="space-y-8">
            {/* Main Load Information */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              {/* Header with status badges */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{load.title}</h1>
                  <p className="text-gray-600 leading-relaxed">{load.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 lg:mt-0 lg:ml-6">
                  {load.isUrgent && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      <Clock className="w-4 h-4 mr-1" />
                      Urgent
                    </span>
                  )}
                  {load.isPriorityListing && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      Featured
                    </span>
                  )}
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    load.status === 'posted' || load.status === 'available' ? 'bg-green-100 text-green-800' :
                    load.status === 'receiving_bids' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {load.status?.replace('_', ' ').toUpperCase() || 'AVAILABLE'}
                  </span>
                </div>
              </div>

              {/* Route Information */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-gray-900">Pickup Location</h4>
                        <p className="text-gray-700 mt-1">{load.pickupLocation}</p>
                        {load.pickupAddress && (
                          <p className="text-sm text-gray-600 mt-1">{load.pickupAddress}</p>
                        )}
                        {load.pickupDate && (
                          <div className="mt-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="w-4 h-4 mr-1" />
                              <span>{formatDate(load.pickupDate)}</span>
                            </div>
                            {load.pickupTimeWindow && (
                              <p className="text-xs text-gray-500 ml-5">Time: {load.pickupTimeWindow}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-red-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-gray-900">Delivery Location</h4>
                        <p className="text-gray-700 mt-1">{load.deliveryLocation}</p>
                        {load.deliveryAddress && (
                          <p className="text-sm text-gray-600 mt-1">{load.deliveryAddress}</p>
                        )}
                        {load.deliveryDate && (
                          <div className="mt-2">
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="w-4 h-4 mr-1" />
                              <span>{formatDate(load.deliveryDate)}</span>
                            </div>
                            {load.deliveryTimeWindow && (
                              <p className="text-xs text-gray-500 ml-5">Time: {load.deliveryTimeWindow}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {load.distance && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center text-gray-600">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      <span className="font-medium">Distance: </span>
                      <span className="ml-1">{load.distance} km</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Load Specifications */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Load Specifications</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex items-center">
                        <Weight className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-700">Weight</span>
                      </div>
                      <span className="text-gray-900 font-semibold">{load.weight || 0} kg</span>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-700">Cargo Type</span>
                      </div>
                      <span className="text-gray-900">{getCargoTypeLabel(load.cargoType)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex items-center">
                        <Truck className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-700">Vehicle Type</span>
                      </div>
                      <span className="text-gray-900">{getVehicleTypeLabel(load.vehicleType)}</span>
                    </div>

                    {load.dimensions && (
                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="font-medium text-gray-700">Dimensions</span>
                        </div>
                        <span className="text-gray-900">
                          {load.dimensions.length}×{load.dimensions.width}×{load.dimensions.height} cm
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Payment & Terms</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div className="flex items-center">
                        <DollarSign className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-700">Budget</span>
                      </div>
                      <span className="text-green-600 font-bold text-lg">{formatCurrency(load.budget)}</span>
                    </div>

                    {load.paymentTerms && (
                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <span className="font-medium text-gray-700">Payment Terms</span>
                        <span className="text-gray-900">{load.paymentTerms.replace('_', ' ').toUpperCase()}</span>
                      </div>
                    )}

                    {load.insuranceRequired && (
                      <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <div className="flex items-center">
                          <Shield className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="font-medium text-gray-700">Insurance</span>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-900">Required</p>
                          {load.insuranceValue && (
                            <p className="text-sm text-gray-600">{formatCurrency(load.insuranceValue)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {load.bidAnalytics && load.bidAnalytics.totalBids > 0 && (
                      <div className="py-3">
                        <div className="flex items-center mb-2">
                          <Eye className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="font-medium text-gray-700">Bidding Activity</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Total Bids</p>
                            <p className="font-semibold text-gray-900">{load.bidAnalytics.totalBids}</p>
                          </div>
                          {load.bidAnalytics.avgBid && (
                            <div>
                              <p className="text-gray-600">Avg Bid</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(load.bidAnalytics.avgBid)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Requirements */}
              {(load.specialRequirements || load.specialInstructions || load.loadingInstructions) && (
                <div className="bg-blue-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Requirements & Instructions</h3>
                  <div className="space-y-3">
                    {load.specialRequirements && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-1">Special Requirements</h4>
                        <p className="text-gray-700">{load.specialRequirements}</p>
                      </div>
                    )}
                    {load.specialInstructions && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-1">Special Instructions</h4>
                        <p className="text-gray-700">{load.specialInstructions}</p>
                      </div>
                    )}
                    {load.loadingInstructions && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-1">Loading Instructions</h4>
                        <p className="text-gray-700">{load.loadingInstructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {load.postedBy && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Posted By</h3>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h4 className="font-semibold text-gray-900">
                          {load.cargoOwnerName || load.postedBy?.name || 'Anonymous'}
                        </h4>
                        {load.postedBy.isVerified && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Shield className="w-3 h-3 mr-1" />
                            Verified
                          </span>
                        )}
                      </div>
                      
                      {load.postedBy.rating && (
                        <div className="flex items-center mt-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= load.postedBy.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="ml-2 text-sm text-gray-600">
                            {load.postedBy.rating} ({load.postedBy.reviewCount || 0} reviews)
                          </span>
                        </div>
                      )}

                      {load.postedBy.location && (
                        <div className="flex items-center mt-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span>{load.postedBy.location}</span>
                        </div>
                      )}

                      <div className="mt-3 text-sm text-gray-500">
                        <span>Posted {formatDate(load.createdAt)}</span>
                        {load.viewCount > 0 && (
                          <span className="ml-4">{load.viewCount} views</span>
                        )}
                      </div>

                      {/* Contact Info (for authenticated users) */}
                      {isUserAuthenticated && load.contactPerson && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h5 className="font-medium text-gray-800 mb-2">Contact Information</h5>
                          {typeof load.contactPerson === 'object' ? (
                            <div className="space-y-2 text-sm">
                              {load.contactPerson.name && (
                                <div className="flex items-center">
                                  <User className="w-4 h-4 mr-2 text-gray-400" />
                                  <span>{load.contactPerson.name}</span>
                                </div>
                              )}
                              {load.contactPerson.phone && (
                                <div className="flex items-center">
                                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                  <a href={`tel:${load.contactPerson.phone}`} className="text-blue-600 hover:underline">
                                    {load.contactPerson.phone}
                                  </a>
                                </div>
                              )}
                              {load.contactPerson.email && (
                                <div className="flex items-center">
                                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                                  <a href={`mailto:${load.contactPerson.email}`} className="text-blue-600 hover:underline">
                                    {load.contactPerson.email}
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700">{load.contactPerson}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* Authentication Notice */}
              {!isUserAuthenticated && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
                    <div>
                      <p className="text-sm text-blue-800">
                        <strong>Login required to place bids.</strong> Create a driver account or login to bid on this load.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Driver Status Notice */}
              {isUserAuthenticated && user?.userType !== 'driver' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-orange-400 mr-3" />
                    <div>
                      <p className="text-sm text-orange-800">
                        <strong>Driver account required.</strong> Only registered drivers can place bids on loads.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                {!showBidForm && (
                  <button
                    onClick={handleBidClick}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    {isUserAuthenticated && user?.userType === 'driver' ? 'Place Bid' : 'Login to Bid'}
                  </button>
                )}
                
                <Link
                  to="/search-loads"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Browse More Loads
                </Link>
              </div>
            </div>

            {/* Bid Form */}
            {showBidForm && (
              <div className="bg-white rounded-lg shadow-sm">
                <BidForm 
                  load={load}
                  onBidSubmit={handleBidSubmit}
                  onCancel={() => setShowBidForm(false)}
                  submitting={submittingBid}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <User className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Login Required</h3>
            </div>
            <p className="text-gray-600 mb-6">
              You need to be logged in as a driver to place bids on loads. Please login or create a driver account to continue.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Login / Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadDetail;