import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { getAuthHeader } from '../../utils/auth';

// Helper function to get auth headers
const getAuthHeaders = () => {
  return {
    ...getAuthHeader(),
    'Content-Type': 'application/json'
  };
};

// Toast Notification Component
export const Toast = ({ message, type = 'success', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full border rounded-lg p-4 shadow-lg transition-all transform translate-x-0 ${getToastStyle()}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={onClose}
            className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Toast Container for managing multiple toasts
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    setToasts(prev => [...prev, toast]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Expose addToast function globally
  useEffect(() => {
    window.showToast = addToast;
    return () => {
      delete window.showToast;
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Real-time notification utilities
export const notificationUtils = {
  // Create notification for new bid
  createBidNotification: async (loadData, bidData) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/send', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: loadData.postedBy,
          userType: 'cargo_owner',
          type: 'new_bid',
          title: 'New Bid Received',
          message: `${bidData.driverName} has placed a bid of KES ${bidData.bidAmount} on your load "${loadData.title}"`,
          priority: 'medium',
          data: {
            bidId: bidData._id,
            loadId: loadData._id,
            driverId: bidData.driverId,
            bidAmount: bidData.bidAmount
          },
          actionUrl: `/loads/${loadData._id}/bids`,
          icon: 'users'
        })
      });

      if (response.ok) {
        console.log('Bid notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send bid notification:', error);
    }
  },

  // Create notification for payment reminders
  createPaymentNotification: async (loadData) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/send', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: loadData.postedBy,
          userType: 'cargo_owner',
          type: 'payment_required',
          title: 'Payment Required',
          message: `Payment is required for completed load "${loadData.title}"`,
          priority: 'high',
          data: {
            loadId: loadData._id,
            amount: loadData.budget
          },
          actionUrl: `/loads/${loadData._id}/payment`,
          icon: 'credit-card'
        })
      });

      if (response.ok) {
        console.log('Payment notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send payment notification:', error);
    }
  },

  // Create notification for rating requests
  createRatingNotification: async (loadData, driverData) => {
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications/send', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          userId: loadData.postedBy,
          userType: 'cargo_owner',
          type: 'rating_request',
          title: 'Rate Your Experience',
          message: `Please rate your experience with ${driverData.name} for load "${loadData.title}"`,
          priority: 'low',
          data: {
            loadId: loadData._id,
            driverId: driverData._id,
            driverName: driverData.name
          },
          actionUrl: `/loads/${loadData._id}/rate`,
          icon: 'star'
        })
      });

      if (response.ok) {
        console.log('Rating notification sent successfully');
      }
    } catch (error) {
      console.error('Failed to send rating notification:', error);
    }
  }
};

// WebSocket connection for real-time notifications
export class NotificationSocket {
  constructor(userId, userType, onNotification) {
    this.userId = userId;
    this.userType = userType;
    this.onNotification = onNotification;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    try {
      // Replace with your WebSocket URL
      this.ws = new WebSocket(`wss://infinite-cargo-api.onrender.com/ws/notifications?userId=${this.userId}&userType=${this.userType}`);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          this.onNotification(notification);
        } catch (error) {
          console.error('Failed to parse notification:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Notification WebSocket disconnected');
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to notification WebSocket:', error);
      this.handleReconnect();
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// Hook for using notifications in components
export const useNotifications = (user) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications?limit=50`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data?.notifications || []);
        setUnreadCount(data.data?.summary?.unread || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Add new notification (from WebSocket or manual)
  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
    
    // Show toast notification
    if (window.showToast) {
      window.showToast(notification.message, 'info');
    }
  };

  // Mark as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif._id === notificationId 
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const deletedNotification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (user?.id) {
      const notificationSocket = new NotificationSocket(
        user.id,
        user.userType || 'cargo_owner',
        addNotification
      );
      
      // Note: Uncomment this when WebSocket is implemented on backend
      // notificationSocket.connect();
      setSocket(notificationSocket);

      return () => {
        notificationSocket.disconnect();
      };
    }
  }, [user]);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up polling as fallback
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};