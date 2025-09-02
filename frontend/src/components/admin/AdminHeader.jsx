import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Bell, BellRing, X, Check, Clock } from 'lucide-react';

const AdminHeader = ({ name, role, onLogout, apiCall, onNotificationClick, isAuthenticated = false }) => {
  const [notificationCount, setNotificationCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const dropdownRef = useRef(null);
  const fetchTimeoutRef = useRef(null);

  // Fetch notification count and recent notifications
  const fetchNotifications = async (retryCount = 0) => {
   
    if (!isAuthenticated || !apiCall || loading || !authReady) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await apiCall('/admin/notifications/summary');
      if (response && response.status === 'success') {
        setNotificationCount(response.data?.summary?.unread || 0);
        setRecentNotifications(response.data?.recentNotifications || []);
      }
    } catch (error) {
      // Handle different types of errors
      if (error.message && (
        error.message.includes('Session expired') || 
        error.message.includes('Authentication required') ||
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      )) {
       
        // Clear notification state on auth errors
        setNotificationCount(0);
        setRecentNotifications([]);
        setAuthReady(false);
        setHasInitialized(false);
        return;
      }
      
      // For other errors, retry once after a delay
      if (retryCount < 1) {
       
        setTimeout(() => {
          if (isAuthenticated && apiCall) {
            fetchNotifications(retryCount + 1);
          }
        }, 2000);
        return;
      }
      
      console.error('Failed to fetch notifications after retry:', error);
      // Reset on persistent errors
      setNotificationCount(0);
      setRecentNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!isAuthenticated || !apiCall || !authReady) {
      return;
    }
    
    try {
      await apiCall(`/admin/notifications/${notificationId}/read`, { method: 'PUT' });
      // Update local state
      setRecentNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Don't show user errors for individual notification actions
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle authentication state changes
  useEffect(() => {
    if (!isAuthenticated || !apiCall) {
      // Clear everything when not authenticated
      setNotificationCount(0);
      setRecentNotifications([]);
      setHasInitialized(false);
      setAuthReady(false);
      setShowDropdown(false);
      
      // Clear any pending fetch timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      return;
    }

    // When authentication becomes available, set up delayed initialization
    if (!authReady) {
      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Delay to allow auth to fully establish
      fetchTimeoutRef.current = setTimeout(() => {
        setAuthReady(true);
        setHasInitialized(true);
      }, 2000); // 2 second delay for auth to stabilize
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, apiCall]);

  // Fetch notifications when auth is ready
  useEffect(() => {
    if (authReady && hasInitialized && isAuthenticated && apiCall) {
      fetchNotifications();
    }
  }, [authReady, hasInitialized, isAuthenticated, apiCall]);

  // Set up polling for real-time updates only after successful initialization
  useEffect(() => {
    if (!authReady || !hasInitialized || !isAuthenticated || !apiCall || notificationCount === null) {
      return;
    }

    // Set up polling for real-time updates (every 60 seconds to reduce load)
    const interval = setInterval(() => {
      if (isAuthenticated && apiCall && authReady) {
        fetchNotifications();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [authReady, hasInitialized, isAuthenticated, apiCall, notificationCount]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'security_alert':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case 'system_maintenance':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
    }
  };

  // Handle manual refresh with better error handling
  const handleManualRefresh = async () => {
    if (!isAuthenticated || !apiCall || !authReady) {
      
      return;
    }

    
    await fetchNotifications();
  };

  // Handle dropdown toggle with refresh
  const handleDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    // Only refresh if opening dropdown and auth is ready
    if (!showDropdown && isAuthenticated && apiCall && authReady && !loading) {
      handleManualRefresh();
    }
  };

  // Mark all as read handler
  const handleMarkAllAsRead = async () => {
    if (!isAuthenticated || !apiCall || !authReady) {
      return;
    }
    
    try {
      await apiCall('/admin/notifications/read-all', { method: 'PUT' });
      setNotificationCount(0);
      setRecentNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  return (
    <div className="bg-white shadow-sm border-b px-6 py-3 flex justify-between items-center mb-6">
      <div>
        <h2 className="text-lg font-semibold">Welcome, {name}</h2>
        <p className="text-sm text-gray-500 capitalize">{role}</p>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleDropdownToggle}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isAuthenticated || !authReady}
            title={!isAuthenticated ? 'Authentication required' : !authReady ? 'Loading...' : 'Notifications'}
          >
            {notificationCount > 0 ? (
              <BellRing className="w-6 h-6" />
            ) : (
              <Bell className="w-6 h-6" />
            )}
            
            {/* Notification Count Badge */}
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
            
            {/* Loading indicator */}
            {loading && (
              <div className="absolute -top-1 -right-1 w-3 h-3">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              </div>
            )}
          </button>

          {/* Notification Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notifications
                  {notificationCount > 0 && (
                    <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      {notificationCount} new
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualRefresh}
                    disabled={loading || !isAuthenticated || !authReady}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Refresh notifications"
                  >
                    <Bell className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-64 overflow-y-auto">
                {!isAuthenticated ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Authentication required</p>
                  </div>
                ) : !authReady ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-sm">Setting up notifications...</p>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-sm text-gray-500">Loading...</span>
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No recent notifications</p>
                    <button
                      onClick={handleManualRefresh}
                      className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  recentNotifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification._id || notification.id}
                      className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.isRead) {
                          markAsRead(notification._id || notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium truncate ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title || 'Notification'}
                            </p>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {notification.message || 'No message'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(notification.createdAt || notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {recentNotifications.length > 0 && isAuthenticated && authReady && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mark all as read
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        if (onNotificationClick) {
                          onNotificationClick();
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="inline-flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminHeader;