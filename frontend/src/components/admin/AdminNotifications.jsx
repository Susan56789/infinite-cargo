import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCircle,
  X,
  Trash2,
  Filter,
  Search,
  RefreshCw,
  MoreVertical,
  AlertTriangle,
  Info,
  Star,
  Shield,
  Users,
  Package,
  DollarSign,
  Settings,
  Clock,
  Archive,
  Download,
  Send,
  Eye,
  EyeOff
} from 'lucide-react';

const AdminNotifications = ({ apiCall, showError, showSuccess }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [filters, setFilters] = useState({
    unread: false,
    type: 'all',
    priority: 'all',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalNotifications: 0,
    limit: 20
  });
  const [summary, setSummary] = useState({
    total: 0,
    unread: 0,
    read: 0
  });
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    userType: 'all',
    title: '',
    message: '',
    priority: 'medium',
    type: 'system_announcement'
  });

  // Fetch notifications
  const fetchNotifications = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.unread && { unread: 'true' }),
        ...(filters.search && { search: filters.search })
      });

      const response = await apiCall(`/notifications?${params}`);
      
      if (response.status === 'success') {
        setNotifications(response.data.notifications);
        setPagination(response.data.pagination);
        setSummary(response.data.summary);
      }
    } catch (error) {
      showError('Failed to fetch notifications');
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notification summary
  const fetchNotificationSummary = async () => {
    try {
      const response = await apiCall('/notifications/summary');
      if (response.status === 'success') {
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Fetch summary error:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchNotificationSummary();
  }, [filters.unread, filters.search]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}/read`, { method: 'PUT' });
      
      // Update local state
      setNotifications(prev => prev.map(notif => 
        notif._id === notificationId 
          ? { ...notif, isRead: true, readAt: new Date() }
          : notif
      ));
      
      setSummary(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1
      }));
      
    } catch (error) {
      showError('Failed to mark notification as read');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await apiCall('/notifications/read-all', { method: 'PUT' });
      if (response.status === 'success') {
        showSuccess(response.message);
        setNotifications(prev => prev.map(notif => ({ 
          ...notif, 
          isRead: true, 
          readAt: new Date() 
        })));
        setSummary(prev => ({
          ...prev,
          unread: 0,
          read: prev.total
        }));
      }
    } catch (error) {
      showError('Failed to mark all notifications as read');
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}`, { method: 'DELETE' });
      
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      setSummary(prev => ({
        ...prev,
        total: prev.total - 1
      }));
      
      showSuccess('Notification deleted');
    } catch (error) {
      showError('Failed to delete notification');
    }
  };

  // Bulk operations
  const handleBulkAction = async (action) => {
    if (selectedNotifications.length === 0) {
      showError('Please select notifications first');
      return;
    }

    try {
      if (action === 'read') {
        await apiCall('/notifications/bulk-read', {
          method: 'PUT',
          body: JSON.stringify({ notificationIds: selectedNotifications })
        });
        showSuccess(`${selectedNotifications.length} notifications marked as read`);
        
        setNotifications(prev => prev.map(notif => 
          selectedNotifications.includes(notif._id) 
            ? { ...notif, isRead: true, readAt: new Date() }
            : notif
        ));
      } else if (action === 'delete') {
        await apiCall('/notifications/bulk-delete', {
          method: 'DELETE',
          body: JSON.stringify({ notificationIds: selectedNotifications })
        });
        showSuccess(`${selectedNotifications.length} notifications deleted`);
        
        setNotifications(prev => 
          prev.filter(notif => !selectedNotifications.includes(notif._id))
        );
      }
      
      setSelectedNotifications([]);
      fetchNotificationSummary();
    } catch (error) {
      showError(`Failed to ${action} notifications`);
    }
  };

  // Send broadcast notification
  const sendBroadcastNotification = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await apiCall('/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(broadcastForm)
      });
      
      if (response.status === 'success') {
        showSuccess(response.message);
        setShowBroadcastModal(false);
        setBroadcastForm({
          userType: 'all',
          title: '',
          message: '',
          priority: 'medium',
          type: 'system_announcement'
        });
      }
    } catch (error) {
      showError('Failed to send broadcast notification');
    } finally {
      setLoading(false);
    }
  };

  // Get notification icon
  const getNotificationIcon = (type, icon) => {
    const iconMap = {
      'new_bid': Users,
      'bid_accepted': CheckCircle,
      'bid_rejected': X,
      'load_assigned': Package,
      'trip_started': Package,
      'delivery_completed': CheckCircle,
      'payment_required': DollarSign,
      'verification_approved': Shield,
      'verification_rejected': AlertTriangle,
      'system_maintenance': Settings,
      'security_alert': AlertTriangle,
      'rating_request': Star,
      'profile_update': Users,
      'load_cancelled': X
    };

    const IconComponent = iconMap[type] || Bell;
    return <IconComponent className="w-5 h-5" />;
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200'
    };
    return colors[priority] || colors.medium;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
              {summary.total} Total
            </span>
            {summary.unread > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                {summary.unread} Unread
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBroadcastModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send Broadcast
          </button>
          
          <button
            onClick={() => fetchNotifications(pagination.currentPage)}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilters(prev => ({ ...prev, unread: !prev.unread }))}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                filters.unread
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filters.unread ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {filters.unread ? 'Show All' : 'Unread Only'}
            </button>

            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.length > 0 && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-blue-700">
              {selectedNotifications.length} notification(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('read')}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark Read
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
              <button
                onClick={() => setSelectedNotifications([])}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={markAllAsRead}
          disabled={summary.unread === 0}
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">Mark All Read</div>
            <div className="text-sm">{summary.unread} unread</div>
          </div>
        </button>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-lg flex items-center gap-3">
          <Bell className="w-5 h-5" />
          <div>
            <div className="font-medium">Total Notifications</div>
            <div className="text-sm">{summary.total} items</div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 text-orange-700 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <div className="font-medium">High Priority</div>
            <div className="text-sm">
              {notifications.filter(n => n.priority === 'high').length} items
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 text-purple-700 p-4 rounded-lg flex items-center gap-3">
          <Clock className="w-5 h-5" />
          <div>
            <div className="font-medium">Recent</div>
            <div className="text-sm">
              {notifications.filter(n => {
                const age = Date.now() - new Date(n.createdAt).getTime();
                return age < 24 * 60 * 60 * 1000; // Last 24 hours
              }).length} today
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No notifications found</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedNotifications.length === notifications.length && notifications.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedNotifications(notifications.map(n => n._id));
                  } else {
                    setSelectedNotifications([]);
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 font-medium">
                {selectedNotifications.length > 0 
                  ? `${selectedNotifications.length} selected`
                  : 'Select all'
                }
              </span>
            </div>

            {/* Notifications */}
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedNotifications(prev => [...prev, notification._id]);
                        } else {
                          setSelectedNotifications(prev => 
                            prev.filter(id => id !== notification._id)
                          );
                        }
                      }}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className={`p-2 rounded-full ${
                      !notification.isRead ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {getNotificationIcon(notification.type, notification.icon)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`font-medium ${
                          !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h3>
                        
                        <span className={`px-2 py-1 text-xs rounded-full border ${
                          getPriorityColor(notification.priority)
                        }`}>
                          {notification.priority}
                        </span>

                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3">{notification.message}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(notification.createdAt)}
                          </span>
                          
                          {notification.readAt && (
                            <span className="text-green-600">
                              Read {formatTimestamp(notification.readAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <button
                              onClick={() => markAsRead(notification._id)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteNotification(notification._id)}
                            className="text-red-600 hover:text-red-800 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-3 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>
              Showing {((pagination.currentPage - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalNotifications)} of{' '}
              {pagination.totalNotifications} notifications
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage || loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded">
              {pagination.currentPage} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => fetchNotifications(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage || loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Broadcast Notification Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Send Broadcast Notification</h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={sendBroadcastNotification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Send To
                </label>
                <select
                  value={broadcastForm.userType}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, userType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="all">All Users</option>
                  <option value="driver">All Drivers</option>
                  <option value="cargo_owner">All Cargo Owners</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notification title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Notification message"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={broadcastForm.priority}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Notification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;