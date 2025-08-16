import  { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Truck, 
  Star, 
  User, 
  Package, 
  Award,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  SlidersHorizontal,
  Lock
} from 'lucide-react';
import {  isAuthenticated, getAuthHeader } from '../../utils/auth';

const FindDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const [filters, setFilters] = useState({
    location: '',
    vehicleType: '',
    capacity: '',
    experienceYears: '',
    rating: '',
    availability: 'all',
    verified: false
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

  const capacityRanges = [
    { value: '0-2', label: 'Up to 2 tonnes' },
    { value: '2-5', label: '2-5 tonnes' },
    { value: '5-10', label: '5-10 tonnes' },
    { value: '10-20', label: '10-20 tonnes' },
    { value: '20+', label: '20+ tonnes' }
  ];

  // Function to check authentication status
  const checkAuthStatus = () => {
    const authStatus = isAuthenticated();
    setIsUserAuthenticated(authStatus);
    return authStatus;
  };

  useEffect(() => {
    // Check authentication status
    checkAuthStatus();
    fetchDrivers();
  }, []);

  // Listen for storage changes to update auth status
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'infiniteCargoToken' || e.key === 'infiniteCargoUser') {
        checkAuthStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchQuery, filters, drivers]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      
      const headers = {
        'Content-Type': 'application/json'
      };

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers', {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setDrivers(data.data?.drivers || []);
        setFilteredDrivers(data.data?.drivers || []);
      } else {
        setError('Failed to fetch drivers');
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverDetails = async (driverId) => {
    // Check authentication before fetching details
    const currentAuthStatus = checkAuthStatus();
    
    if (!currentAuthStatus) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/${driverId}`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDriver({
          ...data.data?.driver,
          stats: data.data?.driver?.stats
        });
        setShowDriverModal(true);
      } else {
        setError('Failed to fetch driver details');
      }
    } catch (error) {
      console.error('Error fetching driver details:', error);
      setError('Network error. Please try again.');
    }
  };

  const filterDrivers = () => {
    let filtered = drivers.filter(driver => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = driver.name?.toLowerCase().includes(query);
        const matchesLocation = driver.location?.toLowerCase().includes(query);
        const matchesVehicle = driver.vehicleType?.toLowerCase().includes(query);
        if (!matchesName && !matchesLocation && !matchesVehicle) return false;
      }

      // Location filter
      if (filters.location && !driver.location?.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }

      // Vehicle type filter
      if (filters.vehicleType && driver.vehicleType !== filters.vehicleType) {
        return false;
      }

      // Capacity filter
      if (filters.capacity) {
        const capacity = parseFloat(driver.vehicleCapacity) || 0;
        const [min, max] = filters.capacity.split('-').map(v => v.replace('+', '')).map(parseFloat);
        if (max) {
          if (capacity < min || capacity > max) return false;
        } else {
          if (capacity < min) return false;
        }
      }

      // Experience filter
      if (filters.experienceYears) {
        const experience = parseInt(driver.experienceYears) || 0;
        const minExperience = parseInt(filters.experienceYears);
        if (experience < minExperience) return false;
      }

      // Rating filter
      if (filters.rating) {
        const rating = parseFloat(driver.driverProfile?.rating || driver.rating) || 0;
        const minRating = parseFloat(filters.rating);
        if (rating < minRating) return false;
      }

      // Availability filter
      if (filters.availability !== 'all') {
        const isAvailable = driver.driverProfile?.isAvailable !== false;
        if (filters.availability === 'available' && !isAvailable) return false;
        if (filters.availability === 'busy' && isAvailable) return false;
      }

      // Verified filter
      if (filters.verified && !driver.driverProfile?.verified) {
        return false;
      }

      return true;
    });

    setFilteredDrivers(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      location: '',
      vehicleType: '',
      capacity: '',
      experienceYears: '',
      rating: '',
      availability: 'all',
      verified: false
    });
    setSearchQuery('');
  };

  const getVehicleTypeLabel = (type) => {
    const vehicle = vehicleTypes.find(v => v.value === type);
    return vehicle ? vehicle.label : type;
  };

  const getAvailabilityStatus = (driver) => {
    const isAvailable = driver.driverProfile?.isAvailable !== false;
    return isAvailable ? 'Available' : 'Busy';
  };

  const renderStars = (rating) => {
    const stars = [];
    const numRating = parseFloat(rating) || 0;
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={16}
          className={i <= numRating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding available drivers...</p>
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
                <h1 className="text-2xl font-bold text-gray-900">Browse Drivers</h1>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    checkAuthStatus();
                    fetchDrivers();
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Authentication Notice */}
        {!isUserAuthenticated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Browse drivers publicly!</strong> To view detailed profiles including contact information and reviews, please login or create an account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search by name, location, or vehicle type..."
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal size={16} className="mr-2" />
              Filters
              {showFilters ? <ChevronUp size={16} className="ml-2" /> : <ChevronDown size={16} className="ml-2" />}
            </button>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear All
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                  <select
                    value={filters.vehicleType}
                    onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">All Types</option>
                    {vehicleTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                  <select
                    value={filters.capacity}
                    onChange={(e) => handleFilterChange('capacity', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">All Capacities</option>
                    {capacityRanges.map(range => (
                      <option key={range.value} value={range.value}>{range.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Experience</label>
                  <select
                    value={filters.experienceYears}
                    onChange={(e) => handleFilterChange('experienceYears', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Any Experience</option>
                    <option value="1">1+ years</option>
                    <option value="3">3+ years</option>
                    <option value="5">5+ years</option>
                    <option value="10">10+ years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Rating</label>
                  <select
                    value={filters.rating}
                    onChange={(e) => handleFilterChange('rating', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Any Rating</option>
                    <option value="3">3+ stars</option>
                    <option value="4">4+ stars</option>
                    <option value="4.5">4.5+ stars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                  <select
                    value={filters.availability}
                    onChange={(e) => handleFilterChange('availability', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Drivers</option>
                    <option value="available">Available Only</option>
                    <option value="busy">Busy Only</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center mt-8">
                    <input
                      type="checkbox"
                      checked={filters.verified}
                      onChange={(e) => handleFilterChange('verified', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Verified Only</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Found {filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Drivers Grid */}
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrivers.map((driver) => (
              <div key={driver._id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Driver Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="text-blue-600" size={24} />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900">{driver.name}</h3>
                        {driver.driverProfile?.verified && (
                          <div className="flex items-center mt-1">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                            <span className="text-xs text-green-600">Verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getAvailabilityStatus(driver) === 'Available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {getAvailabilityStatus(driver)}
                      </span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center mb-4">
                    <div className="flex items-center mr-2">
                      {renderStars(driver.driverProfile?.rating || 0)}
                    </div>
                    <span className="text-sm text-gray-600">
                      {driver.driverProfile?.rating ? parseFloat(driver.driverProfile.rating).toFixed(1) : 'New'}
                      {driver.driverProfile?.completedJobs && ` (${driver.driverProfile.completedJobs} trips)`}
                    </span>
                  </div>

                  {/* Driver Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin size={16} className="mr-2" />
                      <span>{driver.location || 'Location not specified'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Truck size={16} className="mr-2" />
                      <span>{getVehicleTypeLabel(driver.vehicleType)} - {driver.vehicleCapacity || 'N/A'} tonnes</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Award size={16} className="mr-2" />
                      <span>{driver.experienceYears || 0} years experience</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchDriverDetails(driver._id)}
                      className={`w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isUserAuthenticated
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {isUserAuthenticated ? (
                        <>
                          <Eye size={16} className="mr-2" />
                          View Details
                        </>
                      ) : (
                        <>
                          <Lock size={16} className="mr-2" />
                          Login to View Details
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Driver Details Modal */}
        {showDriverModal && selectedDriver && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Driver Profile</h2>
                  <button
                    onClick={() => setShowDriverModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Driver Profile */}
                <div className="space-y-6">
                  <div className="flex items-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="text-blue-600" size={32} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedDriver.name}</h3>
                      <div className="flex items-center mt-1">
                        {renderStars(selectedDriver.driverProfile?.rating || 0)}
                        <span className="ml-2 text-sm text-gray-600">
                          {selectedDriver.driverProfile?.rating ? parseFloat(selectedDriver.driverProfile.rating).toFixed(1) : 'New Driver'}
                        </span>
                      </div>
                      {selectedDriver.driverProfile?.verified && (
                        <div className="flex items-center mt-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-sm text-green-600">Verified Driver</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
                    <div className="space-y-2">
                      {selectedDriver.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <span className="font-medium mr-2">Email:</span>
                          <span>{selectedDriver.email}</span>
                        </div>
                      )}
                      {selectedDriver.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <span className="font-medium mr-2">Phone:</span>
                          <span>{selectedDriver.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin size={16} className="mr-2" />
                        <span>{selectedDriver.location || 'Location not specified'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Vehicle Information</h4>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Truck size={16} className="mr-2" />
                        <span>{getVehicleTypeLabel(selectedDriver.vehicleType)}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Package size={16} className="mr-2" />
                        <span>Capacity: {selectedDriver.vehicleCapacity || 'Not specified'} tonnes</span>
                      </div>
                    </div>
                  </div>

                  {/* Experience & Availability */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Experience & Availability</h4>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Award size={16} className="mr-2" />
                        <span>{selectedDriver.experienceYears || 0} years of experience</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getAvailabilityStatus(selectedDriver) === 'Available' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {getAvailabilityStatus(selectedDriver)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Statistics */}
                  {selectedDriver.stats && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Performance Statistics</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-blue-600">
                              {selectedDriver.stats.completedTrips || 0}
                            </div>
                            <div className="text-sm text-gray-600">Completed Trips</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-green-600">
                              {selectedDriver.driverProfile?.rating ? parseFloat(selectedDriver.driverProfile.rating).toFixed(1) : '0.0'}
                            </div>
                            <div className="text-sm text-gray-600">Average Rating</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Reviews */}
                  {selectedDriver.stats?.recentReviews && selectedDriver.stats.recentReviews.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Recent Reviews</h4>
                      <div className="space-y-3 max-h-40 overflow-y-auto">
                        {selectedDriver.stats.recentReviews.slice(0, 3).map((review, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center mb-2">
                              {renderStars(review.rating)}
                              <span className="ml-2 text-sm text-gray-600">
                                {review.loadTitle || 'Trip Review'}
                              </span>
                            </div>
                            {review.review && (
                              <p className="text-sm text-gray-700">{review.review}</p>
                            )}
                            {review.date && (
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(review.date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setShowDriverModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Prompt Modal */}
        {showLoginPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="text-blue-600" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Login Required</h3>
                  <p className="text-gray-600 mb-6">
                    You need to be logged in to view detailed driver profiles. Please login or create an account to continue.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowLoginPrompt(false);
                        // Navigate to login - adjust based on your routing setup
                        window.location.href = '/login';
                      }}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => {
                        setShowLoginPrompt(false);
                        // Navigate to register - adjust based on your routing setup
                        window.location.href = '/register';
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                  <button
                    onClick={() => setShowLoginPrompt(false)}
                    className="mt-3 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindDrivers;