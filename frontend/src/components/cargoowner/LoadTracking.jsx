import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Package, 
  Phone, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  User,
  Star,
  Navigation2,
  Timer,
  Weight,
  Package2,
  DollarSign
} from 'lucide-react';
import { authManager, isAuthenticated, getUser, getAuthHeader } from '../../utils/auth';

const LoadTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!authManager.isInitialized) {
          authManager.initialize();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const authenticated = isAuthenticated();
        const user = getUser();

        if (!authenticated) {
          navigate('/login');
          return;
        }

        if (user?.userType !== 'cargo_owner') {
          navigate('/cargo-owner-dashboard');
          return;
        }

        setAuthCheckComplete(true);
      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication error occurred');
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  // Fetch tracking data
  const fetchTrackingData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      // Use the same auth utility as the driver component
      const authHeader = getAuthHeader();
      if (!authHeader.Authorization) {
        throw new Error('No authorization token available');
      }

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/loads/${id}/tracking`, {
        method: 'GET',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch tracking data`);
      }

      const data = await response.json();
      if (data.status === 'success') {
        setTrackingData(data.data);
        setLastUpdateTime(new Date());
      } else {
        throw new Error(data.message || 'Failed to load tracking data');
      }
    } catch (err) {
      console.error('Fetch tracking error:', err);
      setError(err.message || 'Failed to load tracking information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Check for live updates
  const checkLiveUpdates = useCallback(async () => {
    if (!lastUpdateTime) return;

    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/loads/${id}/tracking/live?lastUpdate=${lastUpdateTime.toISOString()}`, {
        method: 'GET',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data.hasUpdates) {
          fetchTrackingData(true);
        }
      }
    } catch (err) {
      console.error('Live updates check error:', err);
    }
  }, [id, lastUpdateTime, fetchTrackingData]);

  // Initial load with auth check
  useEffect(() => {
    if (authCheckComplete) {
      fetchTrackingData();
    }
  }, [authCheckComplete, fetchTrackingData]);

  // Auto-refresh for live updates
  useEffect(() => {
    if (!autoRefreshEnabled || !trackingData) return;

    const interval = setInterval(checkLiveUpdates, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, trackingData, checkLiveUpdates]);

  const getStatusColor = (status) => {
    const colors = {
      'assigned': 'text-blue-600 bg-blue-50',
      'accepted': 'text-green-600 bg-green-50',
      'confirmed': 'text-purple-600 bg-purple-50',
      'in_progress': 'text-yellow-600 bg-yellow-50',
      'en_route_pickup': 'text-orange-600 bg-orange-50',
      'arrived_pickup': 'text-indigo-600 bg-indigo-50',
      'picked_up': 'text-emerald-600 bg-emerald-50',
      'in_transit': 'text-cyan-600 bg-cyan-50',
      'arrived_delivery': 'text-rose-600 bg-rose-50',
      'delivered': 'text-green-600 bg-green-50',
      'completed': 'text-green-700 bg-green-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'assigned': Clock,
      'accepted': CheckCircle,
      'confirmed': CheckCircle,
      'in_progress': Truck,
      'en_route_pickup': Navigation2,
      'arrived_pickup': MapPin,
      'picked_up': Package,
      'in_transit': Truck,
      'arrived_delivery': MapPin,
      'delivered': CheckCircle,
      'completed': CheckCircle
    };
    return icons[status] || Clock;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount, currency = 'KES') => {
    if (!amount) return '0';
    return `${currency} ${parseFloat(amount).toLocaleString()}`;
  };

  // Show loading while auth is being checked
  if (!authCheckComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (loading && !trackingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading tracking information...</span>
        </div>
      </div>
    );
  }

  if (error && !trackingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Tracking</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-3">
            <button 
              onClick={() => fetchTrackingData()} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
            <button 
              onClick={() => navigate('/cargo-owner-dashboard')} 
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { load, job, driver, progress, timeline, currentLocation, estimatedArrival } = trackingData || {};
  const StatusIcon = getStatusIcon(job?.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/cargo-owner-dashboard')}
                className="text-blue-600 hover:text-blue-800 flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{load?.title}</h1>
                <p className="text-gray-600">Load ID: {id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                className={`px-3 py-2 text-sm rounded-md transition ${
                  autoRefreshEnabled 
                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => fetchTrackingData(true)}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${getStatusColor(job?.status)}`}>
                <StatusIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {job?.statusDisplay}
                </h2>
                <p className="text-gray-600">
                  Last updated: {formatDateTime(job?.updatedAt || lastUpdateTime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-2xl font-bold text-blue-600">
                {progress?.percentage || 0}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progress?.percentage || 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Assigned</span>
              <span>In Transit</span>
              <span>Delivered</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Route Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Information</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Pickup Location</p>
                    <p className="text-gray-600">{load?.pickupLocation}</p>
                    {load?.pickupDate && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          Scheduled: {formatDateTime(load.pickupDate)}
                        </span>
                      </div>
                    )}
                    {job?.actualPickupDate && (
                      <div className="flex items-center space-x-1 mt-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">
                          Actual: {formatDateTime(job.actualPickupDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-l-2 border-dashed border-gray-300 ml-1.5 h-8"></div>
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Delivery Location</p>
                    <p className="text-gray-600">{load?.deliveryLocation}</p>
                    {estimatedArrival && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Timer className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          Expected: {formatDateTime(estimatedArrival)}
                        </span>
                      </div>
                    )}
                    {job?.actualDeliveryDate && (
                      <div className="flex items-center space-x-1 mt-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">
                          Delivered: {formatDateTime(job.actualDeliveryDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Location */}
              {currentLocation && progress?.isInTransit && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Navigation2 className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Current Location</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Lat: {currentLocation.latitude?.toFixed(6)}, Lng: {currentLocation.longitude?.toFixed(6)}
                  </p>
                  <button className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline">
                    View on Map
                  </button>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tracking Timeline</h3>
              {timeline && timeline.length > 0 ? (
                <div className="space-y-4">
                  {timeline.map((event, index) => {
                    const EventIcon = getStatusIcon(event.status);
                    return (
                      <div key={event._id || index} className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${getStatusColor(event.status)}`}>
                          <EventIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {event.status?.replace(/_/g, ' ').toUpperCase() || 'Update'}
                              </p>
                              {event.message && (
                                <p className="text-sm text-gray-600 mt-1">{event.message}</p>
                              )}
                              {event.location && (
                                <div className="text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                                  Location: {event.location.latitude?.toFixed(4)}, {event.location.longitude?.toFixed(4)}
                                </div>
                              )}
                            </div>
                            <span className="text-sm text-gray-500 ml-4">
                              {formatDateTime(event.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No tracking updates yet</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Load Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Details</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Package2 className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Cargo Type</p>
                    <p className="font-medium">{load?.cargoType}</p>
                  </div>
                </div>
                {load?.weight && (
                  <div className="flex items-center space-x-2">
                    <Weight className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Weight</p>
                      <p className="font-medium">{load.weight} kg</p>
                    </div>
                  </div>
                )}
                {load?.dimensions && (
                  <div>
                    <p className="text-sm text-gray-500">Dimensions</p>
                    <p className="font-medium">{load.dimensions}</p>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Value</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(job?.totalAmount, job?.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Information */}
            {driver && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Driver</h3>
                <div className="space-y-3">
                                    <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{driver.name}</p>
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-gray-600">
                          {driver.rating?.toFixed(1) || 'No rating'} ({driver.totalJobs || 0} jobs)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${driver.phone}`} className="text-blue-600 hover:text-blue-800">
                        {driver.phone}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {driver.vehicleType} {driver.vehicleNumber && `- ${driver.vehicleNumber}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Job Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Job ID</span>
                  <span className="text-gray-900 text-sm font-mono">
                    {job?._id?.slice(-8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Assigned</span>
                  <span className="text-gray-900 text-sm">
                    {formatDateTime(job?.assignedAt)}
                  </span>
                </div>
                {job?.estimatedDistance && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Distance</span>
                    <span className="text-gray-900">{job.estimatedDistance} km</span>
                  </div>
                )}
                {job?.estimatedDuration && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Duration</span>
                    <span className="text-gray-900">{job.estimatedDuration}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Special Requirements */}
            {load?.specialRequirements && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-medium text-amber-800">Special Requirements</h4>
                </div>
                <p className="text-amber-700">{load.specialRequirements}</p>
              </div>
            )}

            {/* Support Contact */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Contact our support team if you have any questions about your shipment.
                </p>
                <div className="space-y-2">
                  <a 
                    href={`tel:${trackingData?.supportContact?.phone || '+254700000000'}`}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{trackingData?.supportContact?.phone || '+254 700 000 000'}</span>
                  </a>
                  <a 
                    href={`mailto:${trackingData?.supportContact?.email || 'support@infinitecargo.com'}`}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{trackingData?.supportContact?.email || 'support@infinitecargo.com'}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Cards Grid */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Pickup Date</p>
            <p className="font-medium text-gray-900">
              {load?.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-KE') : 'TBD'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Delivery Date</p>
            <p className="font-medium text-gray-900">
              {estimatedArrival ? new Date(estimatedArrival).toLocaleDateString('en-KE') : 'TBD'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <Package className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Cargo Type</p>
            <p className="font-medium text-gray-900">{load?.cargoType || 'General'}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow text-center">
            <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium text-gray-900">
              {job?.status?.replace(/_/g, ' ').toUpperCase() || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Last updated: {lastUpdateTime ? lastUpdateTime.toLocaleString('en-KE') : 'Never'}
            {autoRefreshEnabled && (
              <span className="ml-2 text-green-600">• Auto-refresh enabled</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadTracking;