import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, RefreshCw, Users, User, DollarSign, Truck, Star, 
  Phone, MapPin, CheckCircle2, XCircle, Loader2, Clock,
  AlertCircle, MessageSquare, Calendar, SortDesc, SortAsc
} from 'lucide-react';
import { isAuthenticated, getAuthHeader, getUser, clearAuth, getToken } from '../../utils/auth';

const LoadBidsPage = () => {
  // Extract load ID from URL path with better validation
  const getLoadIdFromPath = () => {
    const path = window.location.pathname;
    const matches = path.match(/\/loads\/([a-f\d]{24})\/bids/i);
    return matches ? matches[1] : null;
  };

  const [loadId] = useState(getLoadIdFromPath());
  const [load, setLoad] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
      return;
    }

    const userData = getUser();
    setUser(userData);

    if (!loadId) {
      setError('Invalid load ID in URL');
      setLoading(false);
      return;
    }

    // Validate load ID format
    if (!/^[a-f\d]{24}$/i.test(loadId)) {
      setError('Invalid load ID format');
      setLoading(false);
      return;
    }

    fetchLoadAndBids();
  }, [loadId]);

  const fetchLoadAndBids = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = getToken();
      const currentUser = getUser();
      
      if (!token) {
        clearAuth();
        window.location.href = '/login';
        return;
      }

      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Try multiple endpoints for load details
      let loadData = null;
      let loadResponse = null;

      // Primary endpoint: /loads/:id
      try {
        loadResponse = await fetch(`${API_BASE_URL}/loads/${loadId}`, {
          method: 'GET',
          headers: authHeaders
        });

        if (loadResponse.status === 401) {
          clearAuth();
          window.location.href = '/login';
          return;
        }

        if (loadResponse.status === 404) {
          setError('Load not found. It may have been deleted or you may not have permission to view it.');
          return;
        }

        if (loadResponse.ok) {
          const responseText = await loadResponse.text();
          if (responseText) {
            const parsedData = JSON.parse(responseText);
            loadData = parsedData.data?.load || parsedData.data || parsedData;
          }
        }
      } catch (fetchError) {
        console.error('Primary load fetch failed:', fetchError);
      }

      // Fallback endpoint: /loads (get all and filter)
      if (!loadData) {
        try {
          const allLoadsResponse = await fetch(`${API_BASE_URL}/loads`, {
            method: 'GET',
            headers: authHeaders
          });

          if (allLoadsResponse.ok) {
            const allLoadsText = await allLoadsResponse.text();
            if (allLoadsText) {
              const allLoadsData = JSON.parse(allLoadsText);
              const loads = allLoadsData.data?.loads || allLoadsData.data || allLoadsData;
              
              if (Array.isArray(loads)) {
                loadData = loads.find(l => l._id === loadId || l.id === loadId);
              }
            }
          }
        } catch (fallbackError) {
          console.error('Fallback load fetch failed:', fallbackError);
        }
      }

      // Another fallback: user's own loads
      if (!loadData) {
        try {
          const userLoadsResponse = await fetch(`${API_BASE_URL}/loads/my-loads`, {
            method: 'GET',
            headers: authHeaders
          });

          if (userLoadsResponse.ok) {
            const userLoadsText = await userLoadsResponse.text();
            if (userLoadsText) {
              const userLoadsData = JSON.parse(userLoadsText);
              const userLoads = userLoadsData.data?.loads || userLoadsData.data || userLoadsData;
              
              if (Array.isArray(userLoads)) {
                loadData = userLoads.find(l => l._id === loadId || l.id === loadId);
              }
            }
          }
        } catch (userLoadsError) {
          console.error('User loads fetch failed:', userLoadsError);
        }
      }

      if (!loadData) {
        setError('Load not found or you do not have permission to view it. The load may have been deleted, or there may be a server issue.');
        return;
      }

      setLoad(loadData);

      // Verify user owns this load
      const loadOwnerId = loadData.postedBy?._id || loadData.postedBy?.id || loadData.postedBy || 
                         loadData.createdBy?._id || loadData.createdBy?.id || loadData.createdBy;
      const currentUserId = currentUser?.id || currentUser?._id;

      if (loadOwnerId && currentUserId && loadOwnerId.toString() !== currentUserId.toString()) {
        setError('You do not have permission to view bids for this load.');
        return;
      }

      // Fetch bids with multiple fallback strategies
      let bidsData = [];
      
      // Strategy 1: /loads/:id/bids
      try {
        const bidsResponse = await fetch(`${API_BASE_URL}/loads/${loadId}/bids`, {
          method: 'GET',
          headers: authHeaders
        });

        if (bidsResponse.ok) {
          const bidsResponseText = await bidsResponse.text();
          if (bidsResponseText) {
            const bidsResponseData = JSON.parse(bidsResponseText);
            bidsData = bidsResponseData.data?.bids || bidsResponseData.bids || bidsResponseData.data || [];
          }
        }
      } catch (bidsError) {
        console.error('Primary bids fetch failed:', bidsError);
      }

      // Strategy 2: /bids?loadId=
      if (!Array.isArray(bidsData) || bidsData.length === 0) {
        try {
          const altBidsResponse = await fetch(`${API_BASE_URL}/bids?loadId=${loadId}`, {
            method: 'GET',
            headers: authHeaders
          });
          
          if (altBidsResponse.ok) {
            const altBidsText = await altBidsResponse.text();
            if (altBidsText) {
              const altBidsData = JSON.parse(altBidsText);
              bidsData = altBidsData.data?.bids || altBidsData.bids || altBidsData.data || [];
            }
          }
        } catch (altBidsError) {
          console.error('Alternative bids fetch failed:', altBidsError);
        }
      }

      // Strategy 3: /bids (get all and filter)
      if (!Array.isArray(bidsData) || bidsData.length === 0) {
        try {
          const allBidsResponse = await fetch(`${API_BASE_URL}/bids`, {
            method: 'GET',
            headers: authHeaders
          });
          
          if (allBidsResponse.ok) {
            const allBidsText = await allBidsResponse.text();
            if (allBidsText) {
              const allBidsData = JSON.parse(allBidsText);
              const allBids = allBidsData.data?.bids || allBidsData.bids || allBidsData.data || [];
              
              if (Array.isArray(allBids)) {
                bidsData = allBids.filter(bid => {
                  const bidLoadId = bid.loadId || bid.load?._id || bid.load?.id || bid.load;
                  return bidLoadId === loadId;
                });
              }
            }
          }
        } catch (allBidsError) {
          console.error('All bids fetch failed:', allBidsError);
        }
      }

      setBids(Array.isArray(bidsData) ? bidsData : []);

    } catch (error) {
      console.error('Error fetching load and bids:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.message.includes('timeout')) {
        setError('Request timed out. The server may be busy. Please try again.');
      } else {
        setError('Failed to load data. The server may be experiencing issues. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bid) => {
    const driverName = bid.driverInfo?.name || bid.driver?.name || 'Unknown Driver';
    const confirmMessage = `Are you sure you want to accept this bid?\n\nDriver: ${driverName}\nAmount: ${formatCurrency(bid.bidAmount)}\n\nThis will:\n• Assign the load to this driver\n• Create an active job\n• Reject all other bids\n• Notify the driver`;
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        setError('');

        const token = getToken();
        if (!token) {
          setError('Session expired. Please refresh and login again.');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/bids/${bid._id}/accept`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (response.status === 401) {
          clearAuth();
          window.location.href = '/login';
          return;
        }

        if (response.status === 403) {
          setError('You don\'t have permission to accept this bid.');
          return;
        }

        if (response.status === 404) {
          setError('Bid not found. It may have been withdrawn.');
          return;
        }

        if (response.status === 409) {
          setError('This bid has already been processed.');
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorData = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            // ignore parse error
          }
          throw new Error(errorData.message || `Server error (${response.status})`);
        }

        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : {};
        
        setSuccess(`Bid accepted! ${driverName} has been assigned to your load.`);
        await fetchLoadAndBids();

      } catch (error) {
        console.error('Error accepting bid:', error);
        setError(`Failed to accept bid: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRejectBid = async (bid) => {
    const driverName = bid.driverInfo?.name || bid.driver?.name || 'this driver';
    const reason = window.prompt(`Reason for rejecting ${driverName}'s bid (optional):`);
    
    if (reason !== null) {
      try {
        setLoading(true);
        setError('');

        const token = getToken();
        if (!token) {
          setError('Session expired. Please refresh and login again.');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/bids/${bid._id}/reject`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ reason: reason?.trim() || 'No reason provided' })
        });

        if (response.status === 401) {
          clearAuth();
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorData = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            // ignore parse error
          }
          throw new Error(errorData.message || `Server error (${response.status})`);
        }

        setSuccess(`Bid from ${driverName} has been rejected.`);
        await fetchLoadAndBids();

      } catch (error) {
        console.error('Error rejecting bid:', error);
        setError(`Failed to reject bid: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getTimeSinceBid = (createdAt) => {
    if (!createdAt) return 'Unknown';
    
    try {
      const now = new Date();
      const bidTime = new Date(createdAt);
      const diffInHours = Math.floor((now - bidTime) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  const getBidPriority = (bid) => {
    if (!bid) return 'normal';
    
    if (bid.status === 'counter_offered') return 'high';
    if (bid.status === 'shortlisted') return 'medium';
    
    try {
      const hoursSinceBid = (new Date() - new Date(bid.createdAt)) / (1000 * 60 * 60);
      if (hoursSinceBid > 24) return 'low';
    } catch {
      // ignore error
    }
    
    return 'normal';
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'submitted': 'bg-yellow-100 text-yellow-800',
      'accepted': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'shortlisted': 'bg-blue-100 text-blue-800',
      'counter_offered': 'bg-purple-100 text-purple-800',
      'withdrawn': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Filter and sort bids
  const filteredAndSortedBids = bids
    .filter(bid => {
      if (statusFilter && bid.status !== statusFilter) return false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const driverInfo = bid.driverInfo || bid.driver || {};
        return (
          driverInfo.name?.toLowerCase().includes(searchLower) ||
          driverInfo.phone?.includes(searchTerm) ||
          bid.message?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'bidAmount':
          aValue = a.bidAmount || 0;
          bValue = b.bidAmount || 0;
          break;
        case 'driverRating':
          aValue = (a.driverInfo || a.driver || {}).rating || 0;
          bValue = (b.driverInfo || b.driver || {}).rating || 0;
          break;
        case 'driverTrips':
          aValue = (a.driverInfo || a.driver || {}).totalTrips || 0;
          bValue = (b.driverInfo || b.driver || {}).totalTrips || 0;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt || 0);
          bValue = new Date(b.createdAt || 0);
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const bidStats = {
    total: bids.length,
    pending: bids.filter(b => ['pending', 'submitted'].includes(b.status)).length,
    accepted: bids.filter(b => b.status === 'accepted').length,
    rejected: bids.filter(b => b.status === 'rejected').length,
    avgAmount: bids.length > 0 ? bids.reduce((sum, bid) => sum + (bid.bidAmount || 0), 0) / bids.length : 0,
    highestBid: Math.max(...bids.map(b => b.bidAmount || 0), 0),
    lowestBid: bids.length > 0 ? Math.min(...bids.map(b => b.bidAmount || 0).filter(amount => amount > 0)) : 0
  };

  if (loading && !load) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading load details and bids...</p>
        </div>
      </div>
    );
  }

  if (error && !load) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Error Loading Page</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bids for Load</h1>
              <p className="text-gray-600">{load?.title || 'Loading...'}</p>
            </div>
          </div>
          <button
            onClick={fetchLoadAndBids}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Load Details Card */}
        {load && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{load.title}</h3>
                <p className="text-gray-600 mb-4">{load.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <span className="text-sm text-gray-500">From:</span>
                      <span className="text-sm font-medium text-gray-900 ml-1">{load.pickupLocation}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <span className="text-sm text-gray-500">To:</span>
                      <span className="text-sm font-medium text-gray-900 ml-1">{load.deliveryLocation}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Budget</span>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(load.budget)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Weight</span>
                    <p className="text-sm font-medium text-gray-900">{load.weight}kg</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Vehicle Type</span>
                    <p className="text-sm font-medium text-gray-900">{load.vehicleType?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(load.status)}`}>
                      {load.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bid Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{bidStats.total}</div>
            <div className="text-sm text-gray-600">Total Bids</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{bidStats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{bidStats.accepted}</div>
            <div className="text-sm text-gray-600">Accepted</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{bidStats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-lg font-bold text-purple-600">{formatCurrency(bidStats.avgAmount)}</div>
            <div className="text-sm text-gray-600">Avg Bid</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-lg font-bold text-orange-600">{formatCurrency(bidStats.highestBid)}</div>
            <div className="text-sm text-gray-600">Highest</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Driver name, phone, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="counter_offered">Counter Offered</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="createdAt">Date Submitted</option>
                <option value="bidAmount">Bid Amount</option>
                <option value="driverRating">Driver Rating</option>
                <option value="driverTrips">Driver Experience</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
        </div>

        {/* Bids List */}
        <div className="space-y-4">
          {loading && bids.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-2 text-gray-500">Loading bids...</p>
            </div>
          ) : filteredAndSortedBids.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {bids.length === 0 ? 'No bids yet' : 'No bids match your filters'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {bids.length === 0 
                  ? 'Bids from drivers will appear here when they\'re submitted.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
            </div>
          ) : (
            filteredAndSortedBids.map(bid => {
              const priority = getBidPriority(bid);
              const timeSince = getTimeSinceBid(bid.createdAt);
              const driverInfo = bid.driverInfo || bid.driver || {};
              
              return (
                <div 
                  key={bid._id} 
                  className={`bg-white border rounded-lg p-6 transition-all hover:shadow-md ${
                    priority === 'high' ? 'border-red-200 bg-red-50' :
                    priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                    'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header with Status and Time */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bid.status)}`}>
                          {bid.status === 'submitted' ? 'pending' : bid.status}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeSince}
                        </span>
                      </div>

                      {/* Driver Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {driverInfo.name || 'Unknown Driver'}
                            </span>
                            {driverInfo.isVerified && (
                              <CheckCircle2 className="h-3 w-3 text-green-500 inline ml-1" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-lg font-semibold text-gray-900">
                            {formatCurrency(bid.bidAmount || 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {bid.vehicleDetails?.type || driverInfo.vehicleType || 'N/A'}
                            {bid.vehicleDetails?.capacity && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({bid.vehicleDetails.capacity}T)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm text-gray-600">
                            {driverInfo.rating || 'No rating'} 
                            {driverInfo.totalTrips && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({driverInfo.totalTrips} trips)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {driverInfo.phone || 'No phone provided'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {driverInfo.location || 'Location not specified'}
                          </span>
                        </div>
                      </div>

                      {/* Proposed Dates */}
                      {(bid.proposedPickupDate || bid.proposedDeliveryDate) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {bid.proposedPickupDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="text-xs text-gray-500">Proposed Pickup:</span>
                                <span className="text-sm text-gray-700 ml-1">
                                  {formatDate(bid.proposedPickupDate)}
                                </span>
                              </div>
                            </div>
                          )}
                          {bid.proposedDeliveryDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="text-xs text-gray-500">Proposed Delivery:</span>
                                <span className="text-sm text-gray-700 ml-1">
                                  {formatDate(bid.proposedDeliveryDate)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bid Message */}
                      {bid.message && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <span className="text-xs font-medium text-gray-600">Driver's Message:</span>
                          </div>
                          <p className="text-sm text-gray-700">{bid.message}</p>
                        </div>
                      )}

                      {/* Cover Letter */}
                      {bid.coverLetter && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">Cover Letter:</span>
                          </div>
                          <p className="text-sm text-gray-700">{bid.coverLetter}</p>
                        </div>
                      )}

                      {/* Counter Offer Info */}
                      {bid.status === 'counter_offered' && bid.counterOffer && (
                        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-purple-700">Counter Offer Pending</span>
                          </div>
                          <div className="text-sm text-purple-600">
                            <p>Amount: {formatCurrency(bid.counterOffer.amount || 0)}</p>
                            {bid.counterOffer.message && (
                              <p className="mt-1">Message: {bid.counterOffer.message}</p>
                            )}
                            <p className="text-xs text-purple-500 mt-1">
                              Sent: {formatDate(bid.counterOffer.createdAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Additional Services */}
                      {bid.additionalServices && bid.additionalServices.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Additional Services:</h5>
                          <div className="flex flex-wrap gap-2">
                            {bid.additionalServices.map((service, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {service.service || service}
                                {service.cost && <span className="ml-1">+{formatCurrency(service.cost)}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Terms */}
                      {bid.terms && (
                        <div className="mb-4 text-sm text-gray-600">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {bid.terms.paymentMethod && (
                              <div>
                                <span className="font-medium">Payment:</span> {bid.terms.paymentMethod}
                              </div>
                            )}
                            {bid.terms.paymentTiming && (
                              <div>
                                <span className="font-medium">Timing:</span> {bid.terms.paymentTiming.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Bid submitted: {formatDate(bid.createdAt)}
                        </p>
                        
                        {/* Pricing Breakdown Button */}
                        {bid.pricingBreakdown && (
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              const breakdown = bid.pricingBreakdown;
                              alert(`Pricing Breakdown:\nBase Fare: ${formatCurrency(breakdown.baseFare || 0)}\nDistance Fare: ${formatCurrency(breakdown.distanceFare || 0)}\nWeight Surcharge: ${formatCurrency(breakdown.weightSurcharge || 0)}\nService Fees: ${formatCurrency(breakdown.serviceFees || 0)}\nTotal: ${formatCurrency(breakdown.totalAmount || bid.bidAmount)}`);
                            }}
                          >
                            View Pricing Breakdown
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(['pending', 'submitted', 'viewed', 'shortlisted'].includes(bid.status)) && (
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleAcceptBid(bid)}
                          disabled={loading}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectBid(bid)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Status-specific info */}
                    {bid.status === 'accepted' && (
                      <div className="ml-4 text-right">
                        <div className="text-green-600 font-medium text-sm">✓ Accepted</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(bid.acceptedAt || bid.updatedAt)}
                        </div>
                      </div>
                    )}

                    {bid.status === 'rejected' && (
                      <div className="ml-4 text-right">
                        <div className="text-red-600 font-medium text-sm">✗ Rejected</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(bid.rejectedAt || bid.updatedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Actions Footer */}
        {bids.length > 0 && (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {filteredAndSortedBids.length} of {bids.length} bids
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setSearchTerm('');
                    setSortBy('createdAt');
                    setSortOrder('desc');
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                >
                  Print Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadBidsPage;