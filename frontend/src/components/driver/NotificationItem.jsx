import React, { useState } from 'react';
import { Check, Trash2, Loader } from 'lucide-react';
import NotificationIcon from './NotificationIcon';

const NotificationItem = ({ notification, onMarkAsRead, onDelete, formatDate }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const handleMarkAsRead = async () => {
    if (notification.isRead || isMarking) return;
    
    setIsMarking(true);
    try {
      await onMarkAsRead(notification._id);
    } finally {
      setIsMarking(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      await onDelete(notification._id);
    } finally {
      setIsDeleting(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-orange-500 bg-orange-50';
      case 'low':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-300 bg-white';
    }
  };

  return (
    <div className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${!notification.isRead ? 'bg-blue-50' : ''} hover:bg-gray-50 transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <NotificationIcon type={notification.priority} icon={notification.icon} />
            <h4 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
              {notification.title}
            </h4>
            {!notification.isRead && (
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDate(notification.createdAt)}</span>
            
            {notification.actionUrl && (
              <a 
                href={notification.actionUrl}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                View Details
              </a>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {!notification.isRead && (
            <button
              onClick={handleMarkAsRead}
              disabled={isMarking}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
              title="Mark as read"
            >
              {isMarking ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
            </button>
          )}
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            {isDeleting ? (
              <Loader size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;