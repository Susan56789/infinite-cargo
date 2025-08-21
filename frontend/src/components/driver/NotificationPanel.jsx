import React from 'react';
import { X, CheckCheck, Trash2, Bell, Loader } from 'lucide-react';
import NotificationItem from './NotificationItem';

const NotificationPanel = ({ 
  isOpen, 
  onClose, 
  notifications = [], 
  onMarkAsRead, 
  onDelete, 
  onMarkAllAsRead, 
  onClearAll,
  loading,
  formatDate 
}) => {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Notifications ({unreadCount} unread)
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
      </div>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <div className="p-3 border-b border-gray-200 flex justify-between">
          <button
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 flex items-center space-x-1"
          >
            <CheckCheck size={14} />
            <span>Mark all read</span>
          </button>
          
          <button
            onClick={onClearAll}
            className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
          >
            <Trash2 size={14} />
            <span>Clear all</span>
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="mx-auto h-6 w-6 text-gray-400 animate-spin" />
            <p className="mt-2 text-gray-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-gray-500">No notifications yet</p>
            <p className="text-sm text-gray-400">You'll see updates about your jobs here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDelete}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {notifications.length > 5 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;