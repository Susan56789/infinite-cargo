import React, { useState, useEffect } from 'react';
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
  Navigation,
  MessageSquare,
  Star
} from 'lucide-react';
import { isAuthenticated, getUser, getAuthHeader } from '../../utils/auth';

const DriverJobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

  useEffect(() => {
    if (!isUserAuthenticated()) {
      navigate('/login');
      return;
    }

    const user = getUser();
    if (user?.userType !== 'driver') {
      navigate('/driver-dashboard');
      return;
    }
setIsUserAuthenticated(true);
    fetchJobDetails();
  }, [id, navigate]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/jobs/${id}/details`, {
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
        throw new Error(`HTTP ${response.status}: Failed to fetch job details`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.data?.job) {
        setJob(data.data.job);
      } else {
        throw new Error(data.message || 'No job data received');
      }
    } catch (err) {
      console.error('Fetch job details error:', err);
      setError(err.message || 'Failed to fetch job details');
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (newStatus) => {
    setUpdating(true);
    setError('');
    
    try {
      const requestBody = {
        status: newStatus,
        notes: notes || undefined,
        location: currentLocation || undefined
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/jobs/${id}/update-status`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error(`Failed to update job status (${response.status})`);
      }

      const data = await response.json();

      if (data.status === 'success') {
        await fetchJobDetails(); // Refresh job details
        setNotes('');
        alert(`Job status updated to ${newStatus.replace(/_/g, ' ')}`);
      } else {
        throw new Error(data.message || 'Failed to update job status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      const errorMessage = err.message || 'Network error occurred';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date()
          });
          alert('Location captured successfully!');
        },
        (error) => {
          alert('Failed to get current location');
          console.error('Location error:', error);
        }
      );
    } else {
      alert('Geolocation is not supported by this browser');
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'assigned': 'bg-blue-100 text-blue-800',
      'accepted': 'bg-green-100 text-green-800',
      'confirmed': 'bg-purple-100 text-purple-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'en_route_pickup': 'bg-orange-100 text-orange-800',
      'at_pickup': 'bg-indigo-100 text-indigo-800',
      'picked_up': 'bg-emerald-100 text-emerald-800',
      'in_transit': 'bg-cyan-100 text-cyan-800',
      'at_delivery': 'bg-rose-100 text-rose-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  };

  const getNextActions = (currentStatus) => {
    const statusActions = {
      'assigned': [
        { label: 'Confirm Job', status: 'confirmed', icon: CheckCircle },
        { label: 'Start Journey', status: 'en_route_pickup', icon: Navigation }
      ],
      'accepted': [
        { label: 'Confirm Job', status: 'confirmed', icon: CheckCircle },
        { label: 'Start Journey', status: 'en_route_pickup', icon: Navigation }
      ],
      'confirmed': [
        { label: 'Start Journey', status: 'en_route_pickup', icon: Navigation }
      ],
      'en_route_pickup': [
        { label: 'Arrived at Pickup', status: 'at_pickup', icon: MapPin }
      ],
      'at_pickup': [
        { label: 'Cargo Picked Up', status: 'picked_up', icon: Package }
      ],
      'picked_up': [
        { label: 'Start Transit', status: 'in_transit', icon: Truck }
      ],
      'in_transit': [
        { label: 'Arrived at Delivery', status: 'at_delivery', icon: MapPin }
      ],
      'at_delivery': [
        { label: 'Complete Delivery', status: 'completed', icon: CheckCircle }
      ]
    };
    return statusActions[currentStatus] || [];
  };

  const LoadingSpinner = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-600">Loading job details...</span>
      </div>
    </div>
  );

  const ErrorState = ({ message, onRetry }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Job</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="space-x-3">
          <button onClick={onRetry} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Try Again
          </button>
          <button onClick={() => navigate('/driver-dashboard')} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  const RouteInfo = ({ pickup, delivery, pickupDate, deliveryDate }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Route Information</h2>
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">Pickup Location</p>
            <p className="text-gray-600">{pickup}</p>
            {pickupDate && (
              <div className="flex items-center space-x-1 mt-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {new Date(pickupDate).toLocaleDateString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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
            <p className="text-gray-600">{delivery}</p>
            {deliveryDate && (
              <div className="flex items-center space-x-1 mt-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {new Date(deliveryDate).toLocaleDateString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const CargoDetails = ({ cargoType, weight, dimensions, specialInstructions }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Cargo Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Cargo Type</p>
          <p className="mt-1 text-gray-900">{cargoType}</p>
        </div>
        {weight && (
          <div>
            <p className="text-sm font-medium text-gray-500">Weight</p>
            <p className="mt-1 text-gray-900">{weight} kg</p>
          </div>
        )}
        {dimensions && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-500">Dimensions</p>
            <p className="mt-1 text-gray-900">{dimensions}</p>
          </div>
        )}
        {specialInstructions && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-500">Special Instructions</p>
            <p className="mt-1 text-gray-900 bg-yellow-50 p-3 rounded-md">{specialInstructions}</p>
          </div>
        )}
      </div>
    </div>
  );

  const StatusUpdatePanel = ({ nextActions, notes, setNotes, currentLocation, onLocationGet, onStatusUpdate, updating }) => {
    if (nextActions.length === 0) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Job Status</h2>
        
        {/* Notes Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add any notes about this status update..."
          />
        </div>

        {/* Location Update */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current Location</span>
            <button onClick={onLocationGet} className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1">
              <Navigation className="w-4 h-4" />
              <span>Get Location</span>
            </button>
          </div>
          {currentLocation && (
            <p className="text-sm text-green-600 mt-1">
              Location captured: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nextActions.map((action) => (
            <button
              key={action.status}
              onClick={() => onStatusUpdate(action.status)}
              disabled={updating}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <action.icon className="w-4 h-4" />
              <span>{updating ? 'Updating...' : action.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const CargoOwnerInfo = ({ ownerDetails }) => {
    if (!ownerDetails) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cargo Owner</h3>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-gray-900">{ownerDetails.name || 'N/A'}</p>
            {ownerDetails.companyName && (
              <p className="text-sm text-gray-600">{ownerDetails.companyName}</p>
            )}
          </div>
          
          {ownerDetails.phone && (
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <a href={`tel:${ownerDetails.phone}`} className="text-blue-600 hover:text-blue-800">
                {ownerDetails.phone}
              </a>
            </div>
          )}
          
          {ownerDetails.email && (
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href={`mailto:${ownerDetails.email}`} className="text-blue-600 hover:text-blue-800 text-sm">
                {ownerDetails.email}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  const JobSummary = ({ job }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Job ID</span>
          <span className="text-gray-900 text-sm font-mono">{job._id?.slice(-8) || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Assigned</span>
          <span className="text-gray-900 text-sm">
            {job.assignedAt ? new Date(job.assignedAt).toLocaleDateString('en-KE') : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Currency</span>
          <span className="text-gray-900">{job.currency || 'KES'}</span>
        </div>
        <hr className="my-3" />
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-900">Total Amount</span>
          <span className="text-lg font-bold text-green-600">
            {job.currency || 'KES'} {job.agreedAmount?.toLocaleString() || 0}
          </span>
        </div>
      </div>
    </div>
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchJobDetails} />;
  if (!job) return <ErrorState message="Job not found" onRetry={fetchJobDetails} />;

  const nextActions = getNextActions(job.status);
  const ownerDetails = job.cargoOwnerDetails || job.cargoOwnerInfo;

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
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(job.status)}`}>
                  {job.statusDisplay || job.status?.replace(/_/g, ' ').toUpperCase()}
                </span>
                {job.isUrgent && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Urgent
                  </span>
                )}
                {job.isOverdue && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Overdue
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Job Value</p>
              <p className="text-2xl font-bold text-green-600">
                {job.currency || 'KES'} {job.agreedAmount?.toLocaleString() || 0}
              </p>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <RouteInfo 
              pickup={job.pickupLocation}
              delivery={job.deliveryLocation}
              pickupDate={job.pickupDate}
              deliveryDate={job.deliveryDate}
            />

            <CargoDetails 
              cargoType={job.cargoType}
              weight={job.weight}
              dimensions={job.dimensions}
              specialInstructions={job.specialInstructions}
            />

            {/* Job Timeline */}
            {job.timeline && job.timeline.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Timeline</h2>
                <div className="space-y-4">
                  {job.timeline.map((event, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-3"></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{event.event?.replace(/_/g, ' ').toUpperCase()}</p>
                            <p className="text-sm text-gray-600">{event.description}</p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(event.timestamp).toLocaleString('en-KE')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <StatusUpdatePanel 
              nextActions={nextActions}
              notes={notes}
              setNotes={setNotes}
              currentLocation={currentLocation}
              onLocationGet={getCurrentLocation}
              onStatusUpdate={updateJobStatus}
              updating={updating}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CargoOwnerInfo ownerDetails={ownerDetails} />
            <JobSummary job={job} />

            {/* Emergency Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition">
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact Support</span>
                </button>
                <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition">
                  <AlertCircle className="w-4 h-4" />
                  <span>Report Issue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverJobDetails;