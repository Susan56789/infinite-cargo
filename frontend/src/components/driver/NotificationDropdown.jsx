import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import NotificationPanel from './NotificationPanel';

const NotificationDropdown = ({ getAuthHeaders, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  // Format date utility
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
    });
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications?limit=20', {
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        setError('Authentication failed');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data?.notifications || []);
      } else if (response.status === 404) {
        setNotifications([]);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification._id === notificationId
              ? { ...notification, isRead: true, readAt: new Date() }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/read-all', {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            isRead: true,
            readAt: new Date()
          }))
        );
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/clear-all', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications when opened
  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user]);

  // Auto-refresh notifications every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      if (!isOpen) {
        fetchNotifications();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, isOpen]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onDelete={deleteNotification}
        onMarkAllAsRead={markAllAsRead}
        onClearAll={clearAll}
        loading={loading}
        formatDate={formatDate}
      />

      {error && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 z-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;