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
  Star,
  X,
  Send
} from 'lucide-react';
import { authManager, isAuthenticated, getUser, getAuthHeader } from '../../utils/auth';

const DriverJobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({
    type: '',
    description: '',
    priority: 'medium'
  });
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    
    const checkAuthAndInit = async () => {
      try {
        
        if (!authManager.isInitialized) {
          authManager.initialize();
       
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Force a fresh auth check
        const authenticated = isAuthenticated();
        const user = getUser();

        if (!authenticated) {
          navigate('/login');
          return;
        }

        if (user?.userType !== 'driver') {
          navigate('/driver-dashboard');
          return;
        }

        setAuthCheckComplete(true);
        
        // Only fetch job details if authentication passes
        await fetchJobDetails();
        
      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication error occurred');
        navigate('/login');
      }
    };

    checkAuthAndInit();
  }, [id, navigate]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // Double-check auth before making request
      if (!isAuthenticated()) {
        navigate('/login');
        return;
      }

      const authHeader = getAuthHeader();
      if (!authHeader.Authorization) {
        console.error('No authorization header available');
        navigate('/login');
        return;
      }

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/jobs/${id}/details`, {
        method: 'GET',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          authManager.clearAuth();
          navigate('/login');
          return;
        }
        
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch job details`);
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
      // Check auth before making request
      if (!isAuthenticated()) {
        navigate('/login');
        return;
      }

      const requestBody = {
        status: newStatus,
        notes: notes.trim() || undefined,
        location: currentLocation || undefined
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/jobs/${id}/update-status`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 401) {
          authManager.clearAuth();
          navigate('/login');
          return;
        }
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `Failed to update job status (${response.status})`);
      }

      const data = await response.json();

      if (data.status === 'success') {
        // Send notification to cargo owner with notes
        await sendCargoOwnerNotification(newStatus, notes.trim());
        
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

  const sendCargoOwnerNotification = async (status, notes) => {
    try {
      if (!job.cargoOwnerDetails?.id) return;

      const notificationData = {
        userId: job.cargoOwnerDetails.id,
        userType: 'cargo_owner',
        type: 'status_update',
        title: `Job Status Update: ${job.title}`,
        message: `Driver has updated job status to "${status.replace(/_/g, ' ')}"${notes ? `. Driver Notes: ${notes}` : ''}`,
        priority: 'medium',
        data: {
          jobId: job._id,
          newStatus: status,
          driverNotes: notes,
          location: currentLocation,
          timestamp: new Date(),
          driverName: getUser()?.name
        },
        actionUrl: `/jobs/${job._id}/tracking`
      };

      await fetch('https://infinite-cargo-api.onrender.com/api/notifications/send', {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData)
      });

    } catch (error) {
      console.error('Error sending cargo owner notification:', error);
    }
  };

  const submitIssueReport = async () => {
  if (!reportForm.type || !reportForm.description.trim()) {
    alert('Please fill in all required fields');
    return;
  }

  setSubmittingReport(true);
  
  try {
    
    const reportData = {
      type: 'driver_issue_report',
      title: `Driver Issue Report: ${reportForm.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      message: `Driver ${getUser()?.name} reported an issue with job "${job.title}": ${reportForm.description}`,
      priority: reportForm.priority,
      userType: 'admin', 
      isRead: false,
      data: {
        reportId: Date.now().toString(),
        jobId: job._id,
        driverId: getUser()?.id,
        driverName: getUser()?.name,
        driverPhone: getUser()?.phone,
        issueType: reportForm.type,
        description: reportForm.description,
        location: currentLocation,
        jobDetails: {
          title: job.title,
          status: job.status,
          pickupLocation: job.pickupLocation,
          deliveryLocation: job.deliveryLocation
        }
      },
      createdAt: new Date()
    };

    // Use the general notifications endpoint instead of admin-specific one
    const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/create-admin', {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData)
    });

    if (!response.ok) {
      throw new Error('Failed to submit issue report');
    }

    // Reset form and close modal
    setReportForm({ type: '', description: '', priority: 'medium' });
    setShowReportForm(false);
    alert('Issue report submitted successfully. Support will contact you soon.');

  } catch (err) {
    console.error('Submit report error:', err);
    alert('Failed to submit issue report. Please try again.');
  } finally {
    setSubmittingReport(false);
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
      'arrived_pickup': 'bg-indigo-100 text-indigo-800',
      'picked_up': 'bg-emerald-100 text-emerald-800',
      'in_transit': 'bg-cyan-100 text-cyan-800',
      'arrived_delivery': 'bg-rose-100 text-rose-800',
      'delivered': 'bg-green-100 text-green-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800';
  };

  const getNextActions = (currentStatus) => {
    const statusActions = {
      'assigned': [
        { label: 'Confirm Job', status: 'confirmed', icon: CheckCircle },
        { label: 'En Route to Pickup', status: 'en_route_pickup', icon: Navigation }
      ],
      'accepted': [
        { label: 'Confirm Job', status: 'confirmed', icon: CheckCircle },
        { label: 'En Route to Pickup', status: 'en_route_pickup', icon: Navigation }
      ],
      'confirmed': [
        { label: 'En Route to Pickup', status: 'en_route_pickup', icon: Navigation },
        { label: 'Arrived at Pickup', status: 'arrived_pickup', icon: MapPin }
      ],
      'en_route_pickup': [
        { label: 'Arrived at Pickup', status: 'arrived_pickup', icon: MapPin }
      ],
      'arrived_pickup': [
        { label: 'Cargo Picked Up', status: 'picked_up', icon: Package }
      ],
      'picked_up': [
        { label: 'Start Transit', status: 'in_transit', icon: Truck }
      ],
      'in_transit': [
        { label: 'Arrived at Delivery', status: 'arrived_delivery', icon: MapPin }
      ],
      'arrived_delivery': [
        { label: 'Mark as Delivered', status: 'delivered', icon: CheckCircle }
      ],
      'delivered': [
        { label: 'Complete Job', status: 'completed', icon: CheckCircle }
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
        
        {/*  Notes Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Driver Notes <span className="text-blue-600">(Will be shared with cargo owner)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add notes about current status, location updates, delays, or any information for the cargo owner..."
          />
          <p className="text-xs text-blue-600 mt-1">
            ℹ️ These notes will be included in the notification sent to the cargo owner and saved in the job timeline
          </p>
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
            <div className="text-sm text-green-600 mt-1 p-2 bg-green-50 rounded border border-green-200">
              <p className="font-medium">Location captured:</p>
              <p>Lat: {currentLocation.latitude.toFixed(6)}, Lng: {currentLocation.longitude.toFixed(6)}</p>
              <p className="text-xs text-gray-500">
                Captured: {new Date(currentLocation.timestamp).toLocaleString()}
              </p>
            </div>
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

  
  const IssueReportModal = () => {
    if (!showReportForm) return null;

    const issueTypes = [
      { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
      { value: 'traffic_delay', label: 'Traffic Delay' },
      { value: 'weather_conditions', label: 'Weather Conditions' },
      { value: 'cargo_damage', label: 'Cargo Damage' },
      { value: 'route_issues', label: 'Route Issues' },
      { value: 'customer_unavailable', label: 'Customer Unavailable' },
      { value: 'security_concern', label: 'Security Concern' },
      { value: 'payment_issue', label: 'Payment Issue' },
      { value: 'documentation_issue', label: 'Documentation Issue' },
      { value: 'other', label: 'Other' }
    ];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Report an Issue</h2>
              <p className="text-sm text-gray-500">This will be sent to admin support</p>
            </div>
            <button 
              onClick={() => setShowReportForm(false)} 
              className="text-gray-400 hover:text-gray-600"
              disabled={submittingReport}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            {/* Job Info */}
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm font-medium text-gray-700">Job: {job.title}</p>
              <p className="text-xs text-gray-500">ID: {job._id?.slice(-8)}</p>
            </div>

            {/* Issue Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Issue Type *</label>
              <select
                value={reportForm.type}
                onChange={(e) => setReportForm({...reportForm, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                required
                disabled={submittingReport}
              >
                <option value="">Select an issue type</option>
                {issueTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={reportForm.priority}
                onChange={(e) => setReportForm({...reportForm, priority: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={submittingReport}
              >
                <option value="low">Low - Can wait</option>
                <option value="medium">Medium - Needs attention</option>
                <option value="high">High - Urgent support needed</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={reportForm.description}
                onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Please describe the issue in detail. Include any relevant information that will help support resolve this quickly..."
                required
                disabled={submittingReport}
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about what happened, when, and any immediate actions needed
              </p>
            </div>

            {/* Current Location Info */}
            {currentLocation ? (
              <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="font-medium flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Current location will be included</span>
                </p>
                <p className="text-xs mt-1">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </p>
              </div>
            ) : (
              <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded border border-amber-200">
                <p className="font-medium">📍 Location not captured</p>
                <p className="text-xs mb-2">Adding your location helps support respond faster</p>
                <button 
                  onClick={getCurrentLocation}
                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                  disabled={submittingReport}
                >
                  Capture Current Location
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
            <button
              onClick={() => setShowReportForm(false)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              disabled={submittingReport}
            >
              Cancel
            </button>
            <button
              onClick={submitIssueReport}
              disabled={submittingReport || !reportForm.type || !reportForm.description.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submittingReport ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
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

  
  const JobTimeline = ({ timeline }) => {
    if (!timeline || timeline.length === 0) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Timeline</h2>
        <div className="space-y-4">
          {timeline.map((event, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-3"></div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{event.event?.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-sm text-gray-600">{event.description}</p>
                    
                    {/* Driver Notes Display */}
                    {event.notes && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-xs font-medium text-blue-800 mb-1">Driver Notes:</p>
                        <p className="text-sm text-blue-700">{event.notes}</p>
                      </div>
                    )}
                    
                    {/* Location Display */}
                    {event.location && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                        <p className="font-medium text-green-800">Location:</p>
                        <p className="text-green-700">
                          {event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)}
                        </p>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 ml-4">
                    {new Date(event.timestamp).toLocaleString('en-KE')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Show loading while auth is being checked
  if (!authCheckComplete || loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={fetchJobDetails} />;
  if (!job) return <ErrorState message="Job not found" onRetry={fetchJobDetails} />;

  const nextActions = getNextActions(job.status);
  const ownerDetails = job.cargoOwnerDetails || job.cargoOwnerInfo;

  return (
    <>
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

              <JobTimeline timeline={job.timeline} />

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
                  <button 
                    onClick={() => setShowReportForm(true)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Report Issue</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Report Modal */}
      <IssueReportModal />
    </>
  );
};

export default DriverJobDetails;