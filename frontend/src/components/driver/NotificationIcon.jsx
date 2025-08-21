import React from 'react';
import { 
  Bell, 
  Users, 
  Check, 
  X, 
  Truck, 
  Clock, 
  CreditCard,
  Star,
  Shield,
  Settings,
  AlertCircle
} from 'lucide-react';

const NotificationIcon = ({ type, icon }) => {
  const iconMap = {
    'bell': Bell,
    'users': Users,
    'check-circle': Check,
    'x-circle': X,
    'truck': Truck,
    'play-circle': Clock,
    'credit-card': CreditCard,
    'star': Star,
    'user': Users,
    'shield-check': Shield,
    'shield-x': Shield,
    'settings': Settings,
    'alert-triangle': AlertCircle
  };

  const IconComponent = iconMap[icon] || Bell;
  
  const colorMap = {
    'high': 'text-red-500',
    'medium': 'text-orange-500',
    'low': 'text-gray-500'
  };

  return <IconComponent size={16} className={colorMap[type] || 'text-gray-500'} />;
};

export default NotificationIcon;