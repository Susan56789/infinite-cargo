import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Truck, 
  Calendar, 
  DollarSign, 
  Weight, 
  Clock, 
  X, 
  User, 
  Package, 
  AlertCircle, 
  Eye, 
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Plus,
  MessageSquare,
  Loader,
  CheckCircle
} from 'lucide-react';

import { 
  isAuthenticated, 
  getUser, 
  getAuthHeader, 
  logout 
} from '../../utils/auth';

// BidForm Component - FIXED
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
    
    // Bid amount validation (must be at least 1 KES)
    if (!bidData.bidAmount || parseFloat(bidData.bidAmount) < 1) {
      newErrors.bidAmount = 'Bid amount must be at least 1 KES';
    }
    
    // Check if bid amount is reasonable compared to budget
    if (load.budget && parseFloat(bidData.bidAmount) > parseFloat(load.budget) * 2) {
      newErrors.bidAmount = 'Bid amount seems unusually high compared to budget';
    }
    
    // Proposed pickup date validation (ISO 8601 format required)
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
    
    // Proposed delivery date validation (ISO 8601 format required)
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

    // Message length validation (max 1000 characters)
    if (bidData.message && bidData.message.length > 1000) {
      newErrors.message = 'Message cannot exceed 1000 characters';
    }

    // Cover letter length validation (max 2000 characters)
    if (bidData.coverLetter && bidData.coverLetter.length > 2000) {
      newErrors.coverLetter = 'Cover letter cannot exceed 2000 characters';
    }

    // Vehicle type validation
    const validVehicleTypes = [
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ];
    if (!validVehicleTypes.includes(bidData.vehicleDetails.type)) {
      newErrors.vehicleType = 'Invalid vehicle type selected';
    }

    // Vehicle capacity validation (min 0.1 tonnes)
    if (!bidData.vehicleDetails.capacity || parseFloat(bidData.vehicleDetails.capacity) < 0.1) {
      newErrors.vehicleCapacity = 'Vehicle capacity must be at least 0.1 tonnes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    //  Match backend API expectations exactly
    const bidPayload = {
      load: load._id,  // Backend expects 'load' field
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
    <div className="bg-gray-50 border rounded-lg p-4 mt-4">
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

        {/* Cover Letter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cover Letter (Optional)
          </label>
          <textarea
            value={bidData.coverLetter}
            onChange={(e) => handleInputChange('coverLetter', e.target.value)}
            placeholder="Tell the cargo owner why you're the best choice for this job..."
            rows={3}
            maxLength={2000}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.coverLetter ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">{bidData.coverLetter.length}/2000 characters</p>
            {errors.coverLetter && (
              <p className="text-xs text-red-600">{errors.coverLetter}</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={bidData.terms.paymentMethod}
              onChange={(e) => handleTermsChange('paymentMethod', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Timing
            </label>
            <select
              value={bidData.terms.paymentTiming}
              onChange={(e) => handleTermsChange('paymentTiming', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="on_pickup">On Pickup</option>
              <option value="on_delivery">On Delivery</option>
              <option value="advance">50% Advance</option>
              <option value="weekly">Weekly</option>
            </select>
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

const LoadSearch = () => {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [bidStates, setBidStates] = useState({}); 
  const [successMessage, setSuccessMessage] = useState('');
  const [userBids, setUserBids] = useState(new Set()); 

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLoads, setTotalLoads] = useState(0);
  const limit = 12;

  const [filters, setFilters] = useState({
    pickupLocation: '',
    deliveryLocation: '',
    cargoType: '',
    vehicleType: '',
    minBudget: '',
    maxBudget: '',
    minWeight: '',
    maxWeight: '',
    isUrgent: ''
  });

  // Cargo and vehicle types
  const cargoTypes = [
    { value: '', label: 'All Cargo Types' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'construction_materials', label: 'Construction Materials' },
    { value: 'food_beverages', label: 'Food & Beverages' },
    { value: 'textiles', label: 'Textiles' },
    { value: 'machinery', label: 'Machinery' },
    { value: 'medical_supplies', label: 'Medical Supplies' },
    { value: 'automotive_parts', label: 'Automotive Parts' },
    { value: 'agricultural_products', label: 'Agricultural Products' },
    { value: 'chemicals', label: 'Chemicals' },
    { value: 'fragile_items', label: 'Fragile Items' },
    { value: 'hazardous_materials', label: 'Hazardous Materials' },
    { value: 'livestock', label: 'Livestock' },
    { value: 'containers', label: 'Containers' },
    { value: 'other', label: 'Other' }
  ];

  const vehicleTypes = [
    { value: '', label: 'All Vehicle Types' },
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

  // Authentication functions
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

  useEffect(() => {
    checkAuthStatus();
    fetchLoads();
    fetchUserBids(); // Fetch user's existing bids
  }, []);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Fetch user's existing bids to track which loads they've already bid on
  const fetchUserBids = async () => {
    try {
      if (!isUserAuthenticated || user?.userType !== 'driver') {
        setUserBids(new Set());
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids/my-bids', {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data && Array.isArray(data.data.bids)) {
          // Extract load IDs that user has bid on
          const bidLoadIds = new Set(
            data.data.bids
              .filter(bid => bid.load && (bid.status === 'pending' || bid.status === 'accepted'))
              .map(bid => typeof bid.load === 'object' ? bid.load._id : bid.load)
          );
          
          
          setUserBids(bidLoadIds);
        } else {
          setUserBids(new Set());
        }
      } else {
        console.warn('Failed to fetch user bids:', response.status);
        setUserBids(new Set());
      }
    } catch (error) {
      console.warn('Error fetching user bids:', error);
      setUserBids(new Set());
    }
  };

  const fetchLoads = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      // Add search query if provided
      if (searchQuery && searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      // Add filters only if they have values
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.toString().trim()) {
          // Map frontend filter names to backend expected names
          const filterMap = {
            pickupLocation: 'pickupLocation',
            deliveryLocation: 'deliveryLocation', 
            cargoType: 'cargoType',
            vehicleType: 'vehicleType',
            minBudget: 'minBudget',
            maxBudget: 'maxBudget',
            minWeight: 'minWeight',
            maxWeight: 'maxWeight',
            isUrgent: 'urgentOnly'
          };
          
          const backendKey = filterMap[key] || key;
          params.append(backendKey, value.toString());
        }
      });

      // Add default sorting
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', 'desc');

      const url = `https://infinite-cargo-api.onrender.com/api/loads?${params.toString()}`;
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
      });


      if (!response.ok) {
        let serverError = 'Failed to fetch loads.';
        
        try {
          const resData = await response.json();
          serverError = resData.message || serverError;
          
          
          // Log detailed error for debugging
          console.error('Server error details:', resData);
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
          const responseText = await response.text();
          console.error('Raw response:', responseText);
        }
        
        throw new Error(`${serverError} (HTTP ${response.status})`);
      }

      const data = await response.json();

      console.log('Raw loads data from server:', data);
      

      if (data.status !== 'success') {
        throw new Error(data.message || 'Unexpected server response format.');
      }

      if (!data.data) {
        throw new Error('No data returned from server.');
      }

      // Extract loads and pagination
      const { loads: loadsArray, pagination } = data.data;

      if (!Array.isArray(loadsArray)) {
        console.error('Invalid loads data:', loadsArray);
        throw new Error('Invalid loads data format received from server.');
      }

      // Process loads to ensure consistent data structure
      const processedLoads = loadsArray.map(load => ({
        ...load,
        // Ensure these fields exist with fallbacks
        _id: load._id || load.id,
        title: load.title || 'Untitled Load',
        description: load.description || 'No description available',
        cargoOwnerName: load.cargoOwnerName || load.postedBy?.name || 'Anonymous',
        pickupLocation: load.pickupLocation || 'Location not specified',
        deliveryLocation: load.deliveryLocation || 'Location not specified',
        weight: load.weight || 0,
        budget: load.budget || 0,
        cargoType: load.cargoType || 'other',
        vehicleType: load.vehicleType || 'van',
        status: load.status || 'available',
        createdAt: load.createdAt || new Date().toISOString(),
        isUrgent: Boolean(load.isUrgent),
        isPriorityListing: Boolean(load.isPriorityListing),
        bidCount: load.bidCount || 0,
        viewCount: load.viewCount || 0,
        // Ensure postedBy has minimum required structure
        postedBy: load.postedBy || {
          _id: load.postedBy || load.cargoOwnerId,
          name: load.cargoOwnerName || 'Anonymous',
          rating: 4.5,
          isVerified: false
        }
      }));

      

      // Update state
      setLoads(processedLoads);
      
      // Update pagination
      if (pagination) {
        setCurrentPage(pagination.currentPage || page);
        setTotalPages(pagination.totalPages || 1);
        setTotalLoads(pagination.totalLoads || processedLoads.length);
      } else {
        // Fallback when pagination not present
        setCurrentPage(page);
        setTotalPages(1);
        setTotalLoads(processedLoads.length);
      }


    } catch (err) {
      console.error('Error loading loads:', err);
      
      // Set user-friendly error messages
      let userMessage = '';
      if (err.message.includes('Failed to fetch')) {
        userMessage = 'Network error: Could not reach server. Please check your internet connection.';
      } else if (err.message.includes('404')) {
        userMessage = 'Loads service not found. Please try again later.';
      } else if (err.message.includes('500')) {
        userMessage = 'Server error occurred. Please try again in a few moments.';
      } else if (err.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
      } else {
        userMessage = err.message || 'An unexpected error occurred while loading loads.';
      }
      
      setError(userMessage);
      
      // Don't clear existing loads on error unless it's the first load
      if (page === 1) {
        setLoads([]);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalLoads(0);
      }
      
    } finally {
      setLoading(false);
    }
  };

  // FIXED Place bid function - matches backend API expectations
  const handleBidSubmit = async (bidData) => {
    try {
      // Check auth
      if (!isUserAuthenticated) {
        setShowLoginPrompt(true);
        return { success: false, error: 'Please login to place a bid' };
      }

      if (user?.userType !== 'driver') {
        setError('Only drivers can place bids on loads.');
        return { success: false, error: 'Only drivers can place bids' };
      }

      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      //  Prepare payload to match backend validation exactly
      const payload = {
        load: bidData.load,  // Backend expects 'load' field (MongoDB ObjectId)
        bidAmount: parseFloat(bidData.bidAmount),
        currency: bidData.currency || 'KES',
        proposedPickupDate: bidData.proposedPickupDate,
        proposedDeliveryDate: bidData.proposedDeliveryDate,
        message: bidData.message || undefined,
        coverLetter: bidData.coverLetter || undefined,
        vehicleDetails: {
          type: bidData.vehicleDetails.type,
          capacity: parseFloat(bidData.vehicleDetails.capacity)
        },
        additionalServices: bidData.additionalServices || [],
        pricingBreakdown: bidData.pricingBreakdown || {
          baseFare: parseFloat(bidData.bidAmount),
          totalAmount: parseFloat(bidData.bidAmount)
        },
        terms: bidData.terms || {
          paymentMethod: 'cash',
          paymentTiming: 'on_delivery'
        }
      };

      

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMsg = 'Failed to place bid';
        
        try {
          const errorData = await response.json();
          console.error('Bid submission error details:', errorData);
          
          errorMsg = errorData.message || errorMsg;
          
          // Handle specific error cases
          if (response.status === 400) {
            if (errorData.errors && Array.isArray(errorData.errors)) {
              // Validation errors - show first error
              errorMsg = errorData.errors[0].msg || errorData.errors[0].message || errorMsg;
            } else if (errorMsg.includes('already')) {
              errorMsg = 'You already have a bid on this load.';
            } else if (errorMsg.includes('validation')) {
              errorMsg = 'Please check your bid details and try again.';
            }
          } else if (response.status === 403) {
            errorMsg = 'Only drivers can place bids.';
          } else if (response.status === 404) {
            errorMsg = 'Load not found or no longer available.';
          } else if (response.status === 429) {
            errorMsg = 'Too many bid requests. Please wait and try again.';
          }
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const result = await response.json();
     

      if (result.status === 'success') {
        setSuccessMessage('Bid placed successfully! The cargo owner will be notified.');
        
        // Add this load to user's bid list
        setUserBids(prev => new Set([...prev, payload.load]));
        
        // Close bid form
        setBidStates(prev => ({
          ...prev,
          [payload.load]: { showBidForm: false, submitting: false }
        }));
        
        // Refresh loads to update bid count
        await fetchLoads(currentPage);
        return { success: true };
      } else {
        const errorMsg = result.message || 'Unexpected response from server';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

    } catch (error) {
      console.error('Bid submit network error:', error);
      let errorMsg = 'Network error: Could not place bid.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMsg = 'Network connection failed. Please check your internet and try again.';
      } else if (error.message.includes('timeout')) {
        errorMsg = 'Request timed out. Please try again.';
      }
      
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const retryFetch = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fetchLoads(currentPage);
        break;
      } catch (error) {
        if (i === retries - 1) {
          setError('Failed to load after multiple attempts. Please refresh the page.');
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      pickupLocation: '',
      deliveryLocation: '',
      cargoType: '',
      vehicleType: '',
      minBudget: '',
      maxBudget: '',
      minWeight: '',
      maxWeight: '',
      isUrgent: ''
    });
    setSearchQuery('');
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
    const cargoType = cargoTypes.find(t => t.value === type);
    return cargoType ? cargoType.label : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getVehicleTypeLabel = (type) => {
    if (!type) return 'N/A';
    const vehicleType = vehicleTypes.find(t => t.value === type);
    return vehicleType ? vehicleType.label : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleRefresh = () => {
    checkAuthStatus();
    fetchLoads(currentPage);
    fetchUserBids(); // Also refresh user bids
  };

  const handleViewDetails = async (load) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/loads/${load._id}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setSelectedLoad(data.data.load);
          setShowLoadModal(true);
        } else {
          setSelectedLoad(load);
          setShowLoadModal(true);
        }
      } else {
        console.warn('Failed to fetch detailed load info, using basic data');
        setSelectedLoad(load);
        setShowLoadModal(true);
      }
    } catch (error) {
      console.warn('Error fetching load details:', error);
      setSelectedLoad(load);
      setShowLoadModal(true);
    }
  };

  const handleBidClick = (load) => {
    if (!isUserAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    if (user?.userType !== 'driver') {
      setError('Only drivers can place bids on loads.');
      return;
    }

    setBidStates(prev => ({
      ...prev,
      [load._id]: { showBidForm: true, submitting: false }
    }));
  };

  const handleBidCancel = (loadId) => {
    setBidStates(prev => ({
      ...prev,
      [loadId]: { showBidForm: false, submitting: false }
    }));
  };

  //  Handle bid form submission with proper error handling
  const handleBidFormSubmit = async (loadId, bidData) => {
    setBidStates(prev => ({
      ...prev,
      [loadId]: { ...prev[loadId], submitting: true }
    }));

    try {
      const result = await handleBidSubmit(bidData);
      
      if (!result.success) {
        setBidStates(prev => ({
          ...prev,
          [loadId]: { ...prev[loadId], submitting: false }
        }));
      }
      // If successful, the bid form is closed in handleBidSubmit
    } catch (error) {
      console.error('Bid form submission error:', error);
      setBidStates(prev => ({
        ...prev,
        [loadId]: { ...prev[loadId], submitting: false }
      }));
      setError('An error occurred while submitting your bid. Please try again.');
    }
  };

  const handleLogin = () => {
    setShowLoginPrompt(false);
    try {
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/login');
        window.location.reload();
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.warn('Navigation error:', error);
      window.location.href = '/login';
    }
  };

  const handleErrorDismiss = () => {
    setError('');
  };

  const handleSuccessDismiss = () => {
    setSuccessMessage('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available loads...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Find Loads</h1>
                <p className="text-gray-600">Discover available cargo loads for transport</p>
              </div>
              <div className="flex items-center space-x-4">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      <span>Welcome, {user.name || 'User'}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.userType === 'driver' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.userType || 'user'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        checkAuthStatus();
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Login / Register
                  </button>
                )}
                <button
                  onClick={handleRefresh}
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-green-800 font-medium">{successMessage}</p>
              </div>
              <button
                onClick={handleSuccessDismiss}
                className="text-green-400 hover:text-green-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error occurred:</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                {error.includes('Server error') && (
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={retryFetch}
                      className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      Refresh Page
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleErrorDismiss}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Public Access Notice */}
        {!isUserAuthenticated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Browse loads publicly!</strong> To place bids and access full features, please login as a driver or create an account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Driver Status Notice */}
        {isUserAuthenticated && user?.userType !== 'driver' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-400 mr-3" />
              <div>
                <p className="text-sm text-orange-800">
                  <strong>Driver account required!</strong> Only registered drivers can place bids on loads. 
                  Please contact support to upgrade your account to a driver account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search loads by title, description, or location..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    fetchLoads(1);
                  }
                }}
              />
            </div>
            <button
              onClick={() => fetchLoads(1)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <input
                type="text"
                value={filters.pickupLocation}
                onChange={(e) => handleFilterChange('pickupLocation', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="City, County"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location</label>
              <input
                type="text"
                value={filters.deliveryLocation}
                onChange={(e) => handleFilterChange('deliveryLocation', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="City, County"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Type</label>
              <select
                value={filters.cargoType}
                onChange={(e) => handleFilterChange('cargoType', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {cargoTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                value={filters.vehicleType}
                onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {vehicleTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={() => fetchLoads(1)}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Applying...' : 'Apply Filters'}
            </button>
          </div>
        </div>

        {/* Results */}
        {loads.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search criteria or filters'
                : 'No loads are currently available'
              }
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => fetchLoads(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Found {totalLoads} load{totalLoads !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {loads.map((load) => {
                const bidState = bidStates[load._id] || { showBidForm: false, submitting: false };
                const hasUserBid = userBids.has(load._id); // Check if user has already bid
                
                return (
                  <div key={load._id} className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 ${load.isPriorityListing ? 'ring-2 ring-yellow-400' : ''}`}>
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{load.title || 'Untitled Load'}</h3>
                        <div className="flex flex-col items-end space-y-1">
                          {load.isUrgent && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Urgent
                            </span>
                          )}
                          {load.isPriorityListing && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Featured
                            </span>
                          )}
                          {hasUserBid && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Bid Placed
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">{load.description || 'No description available'}</p>

                      {/* Route */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                          <span className="font-medium">From:</span>
                          <span className="ml-1 truncate">{load.pickupLocation || 'N/A'}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                          <span className="font-medium">To:</span>
                          <span className="ml-1 truncate">{load.deliveryLocation || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="flex items-center text-gray-600">
                          <Weight className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{load.weight || 0} kg</span>
                        </div>
                        <div className="flex items-center text-green-600 font-medium">
                          <DollarSign className="w-4 h-4 mr-1 flex-shrink-0" />
                          <span>{formatCurrency(load.budget)}</span>
                        </div>
                      </div>

                      {/* Cargo and Vehicle Type */}
                      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                        <div className="flex items-center text-gray-500">
                          <Package className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{getCargoTypeLabel(load.cargoType)}</span>
                        </div>
                        <div className="flex items-center text-gray-500">
                          <Truck className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{getVehicleTypeLabel(load.vehicleType)}</span>
                        </div>
                      </div>

                      {/* Posted info */}
                      <div className="text-xs text-gray-500 mb-4">
                        <div className="flex items-center justify-between">
                          <span>By {load.cargoOwnerName || load.postedBy?.name || 'Anonymous'}</span>
                          <span>{formatDate(load.createdAt)}</span>
                        </div>
                        {load.bidCount > 0 && (
                          <div className="flex items-center mt-1">
                            <Eye className="w-3 h-3 mr-1" />
                            <span>{load.bidCount} bid{load.bidCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2 mb-4">
                        <button 
                          onClick={() => handleViewDetails(load)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1 inline" />
                          Details
                        </button>
                        {!bidState.showBidForm && (
                          <>
                            {hasUserBid ? (
                              <button 
                                disabled={true}
                                className="flex-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-md cursor-not-allowed"
                              >
                                <CheckCircle className="w-4 h-4 mr-1 inline" />
                                Bid Already Placed
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleBidClick(load)}
                                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              >
                                <Plus className="w-4 h-4 mr-1 inline" />
                                {isUserAuthenticated && user?.userType === 'driver' ? 'Place Bid' : 'Login to Bid'}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Bid Form */}
                      {bidState.showBidForm && !hasUserBid && (
                        <BidForm 
                          load={load}
                          onBidSubmit={(bidData) => handleBidFormSubmit(load._id, bidData)}
                          onCancel={() => handleBidCancel(load._id)}
                          submitting={bidState.submitting}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={() => fetchLoads(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => fetchLoads(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
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

      {/* Load Details Modal */}
      {showLoadModal && selectedLoad && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Load Details</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">{selectedLoad.title || 'Untitled Load'}</h4>
                <p className="text-gray-600 mt-1">{selectedLoad.description || 'No description available'}</p>
              </div>

              {/* Status and Priority Indicators */}
              <div className="flex flex-wrap gap-2">
                {selectedLoad.isUrgent && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <Clock className="w-4 h-4 mr-1" />
                    Urgent
                  </span>
                )}
                {selectedLoad.isPriorityListing && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Featured
                  </span>
                )}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedLoad.status === 'posted' ? 'bg-green-100 text-green-800' :
                  selectedLoad.status === 'receiving_bids' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedLoad.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pickup Location</label>
                  <p className="text-gray-900">{selectedLoad.pickupLocation || 'Not specified'}</p>
                  {selectedLoad.pickupAddress && (
                    <p className="text-sm text-gray-600 mt-1">{selectedLoad.pickupAddress}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
                  <p className="text-gray-900">{selectedLoad.deliveryLocation || 'Not specified'}</p>
                  {selectedLoad.deliveryAddress && (
                    <p className="text-sm text-gray-600 mt-1">{selectedLoad.deliveryAddress}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight</label>
                  <p className="text-gray-900">{selectedLoad.weight || 0} kg</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget</label>
                  <p className="text-green-600 font-semibold">{formatCurrency(selectedLoad.budget)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cargo Type</label>
                  <p className="text-gray-900">{getCargoTypeLabel(selectedLoad.cargoType)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
                  <p className="text-gray-900">{getVehicleTypeLabel(selectedLoad.vehicleType)}</p>
                </div>
              </div>

              {/* Date Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLoad.pickupDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pickup Date</label>
                    <p className="text-gray-900">{formatDate(selectedLoad.pickupDate)}</p>
                    {selectedLoad.pickupTimeWindow && (
                      <p className="text-sm text-gray-600">Time: {selectedLoad.pickupTimeWindow}</p>
                    )}
                  </div>
                )}
                {selectedLoad.deliveryDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
                    <p className="text-gray-900">{formatDate(selectedLoad.deliveryDate)}</p>
                    {selectedLoad.deliveryTimeWindow && (
                      <p className="text-sm text-gray-600">Time: {selectedLoad.deliveryTimeWindow}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Distance */}
              {selectedLoad.distance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Distance</label>
                  <p className="text-gray-900">{selectedLoad.distance} km</p>
                </div>
              )}

              {/* Special Requirements and Instructions */}
              {selectedLoad.specialRequirements && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Requirements</label>
                  <p className="text-gray-900">{selectedLoad.specialRequirements}</p>
                </div>
              )}

              {selectedLoad.specialInstructions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Instructions</label>
                  <p className="text-gray-900">{selectedLoad.specialInstructions}</p>
                </div>
              )}

              {/* Payment and Insurance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLoad.paymentTerms && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
                    <p className="text-gray-900">{selectedLoad.paymentTerms.replace('_', ' ').toUpperCase()}</p>
                  </div>
                )}
                {selectedLoad.insuranceRequired && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Insurance</label>
                    <p className="text-gray-900">
                      Required
                      {selectedLoad.insuranceValue && ` - ${formatCurrency(selectedLoad.insuranceValue)}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Posted By Information */}
              {selectedLoad.postedBy && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700">Posted By</label>
                  <div className="flex items-center mt-1">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-gray-900">
                        {selectedLoad.cargoOwnerName || selectedLoad.postedBy?.name || 'Anonymous'}
                      </span>
                      {selectedLoad.postedBy.isVerified && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedLoad.postedBy.location && (
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <MapPin className="w-3 h-3 mr-1" />
                      <span>{selectedLoad.postedBy.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bid Analytics */}
              {selectedLoad.bidAnalytics && selectedLoad.bidAnalytics.totalBids > 0 && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bidding Activity</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Bids</p>
                      <p className="font-semibold text-gray-900">{selectedLoad.bidAnalytics.totalBids}</p>
                    </div>
                    {selectedLoad.bidAnalytics.avgBid && (
                      <div>
                        <p className="text-gray-600">Avg Bid</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(selectedLoad.bidAnalytics.avgBid)}</p>
                      </div>
                    )}
                    {selectedLoad.bidAnalytics.minBid && (
                      <div>
                        <p className="text-gray-600">Lowest Bid</p>
                        <p className="font-semibold text-green-600">{formatCurrency(selectedLoad.bidAnalytics.minBid)}</p>
                      </div>
                    )}
                    {selectedLoad.bidAnalytics.maxBid && (
                      <div>
                        <p className="text-gray-600">Highest Bid</p>
                        <p className="font-semibold text-red-600">{formatCurrency(selectedLoad.bidAnalytics.maxBid)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information (for authenticated users) */}
              {isUserAuthenticated && selectedLoad.contactPerson && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                  <div className="text-gray-900">
                    {typeof selectedLoad.contactPerson === 'object' ? (
                      <div className="space-y-1">
                        {selectedLoad.contactPerson.name && <p><strong>Name:</strong> {selectedLoad.contactPerson.name}</p>}
                        {selectedLoad.contactPerson.phone && <p><strong>Phone:</strong> {selectedLoad.contactPerson.phone}</p>}
                        {selectedLoad.contactPerson.email && <p><strong>Email:</strong> {selectedLoad.contactPerson.email}</p>}
                      </div>
                    ) : (
                      <p>{selectedLoad.contactPerson}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6 pt-6 border-t">
              <button
                onClick={() => setShowLoadModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowLoadModal(false);
                  handleBidClick(selectedLoad);
                }}
                disabled={userBids.has(selectedLoad._id)}
                className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${
                  userBids.has(selectedLoad._id) 
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {userBids.has(selectedLoad._id) 
                  ? 'Bid Already Placed'
                  : (isUserAuthenticated && user?.userType === 'driver' ? 'Place Bid' : 'Login to Bid')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadSearch;