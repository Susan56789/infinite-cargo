import React from 'react';
import { Crown, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

const SubscriptionStatusCard = ({ subscription, formatDate }) => {
  
  // Safe helper to get subscription data with defaults
  const getSubscriptionData = () => {
    if (!subscription) {
      return {
        planId: 'basic',
        planName: 'Basic Plan',
        status: 'loading',
        price: 0,
        usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3, usagePercentage: 0 },
        isExpired: false,
        expiresAt: null
      };
    }

    return {
      planId: subscription.planId || 'basic',
      planName: subscription.planName || subscription.planId?.charAt(0).toUpperCase() + subscription.planId?.slice(1) + ' Plan' || 'Basic Plan',
      status: subscription.status || 'active',
      price: subscription.price || 0,
      isExpired: subscription.isExpired || false,
      expiresAt: subscription.expiresAt || null,
      usage: {
        loadsThisMonth: subscription.usage?.loadsThisMonth || 0,
        maxLoads: subscription.usage?.maxLoads || subscription.maxLoads || 3,
        remainingLoads: subscription.usage?.remainingLoads ?? 
                       (subscription.usage?.maxLoads ? Math.max(0, subscription.usage.maxLoads - (subscription.usage.loadsThisMonth || 0)) : 3),
        usagePercentage: subscription.usage?.usagePercentage || 
                        (subscription.usage?.maxLoads && subscription.usage?.maxLoads > 0 ? 
                         Math.min(100, ((subscription.usage.loadsThisMonth || 0) / subscription.usage.maxLoads) * 100) : 0)
      }
    };
  };

  const subData = getSubscriptionData();
  const isUnlimited = subData.usage.maxLoads === -1;
  const isNearLimit = subData.usage.usagePercentage > 80;
  const isAtLimit = subData.usage.remainingLoads === 0 && !isUnlimited;

  // Loading state
  if (subData.status === 'loading') {
    return (
      <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-gray-500 animate-pulse" />
          <p className="text-gray-600">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  // Determine card styling based on status and usage
  const getCardStyle = () => {
    if (subData.status === 'active' && subData.planId !== 'basic') {
      return 'from-green-50 to-emerald-50 border-green-200';
    } else if (subData.status === 'pending') {
      return 'from-yellow-50 to-amber-50 border-yellow-200';
    } else if (subData.status === 'expired' || subData.isExpired) {
      return 'from-red-50 to-pink-50 border-red-200';
    } else {
      return 'from-blue-50 to-purple-50 border-blue-200';
    }
  };

  const getStatusBadge = () => {
    if (subData.status === 'active' && subData.planId !== 'basic') {
      return { style: 'bg-green-100 text-green-800', text: 'Active' };
    } else if (subData.status === 'pending') {
      return { style: 'bg-yellow-100 text-yellow-800', text: 'Pending' };
    } else if (subData.status === 'expired' || subData.isExpired) {
      return { style: 'bg-red-100 text-red-800', text: 'Expired' };
    } else {
      return { style: 'bg-blue-100 text-blue-800', text: 'Free' };
    }
  };

  const getProgressBarColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-600';
  };

  const getExpiryInfo = () => {
    if (!subData.expiresAt || subData.planId === 'basic') {
      return null;
    }

    try {
      const expiryDate = new Date(subData.expiresAt);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        return { text: 'Expired', urgent: true };
      } else if (daysUntilExpiry <= 7) {
        return { text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`, urgent: true };
      } else if (daysUntilExpiry <= 30) {
        return { text: `Expires in ${daysUntilExpiry} days`, urgent: false };
      } else {
        return { 
          text: `Expires ${formatDate ? formatDate(subData.expiresAt) : expiryDate.toLocaleDateString()}`, 
          urgent: false 
        };
      }
    } catch (error) {
      console.error('Error parsing expiry date:', error);
      return { text: 'Invalid expiry date', urgent: false };
    }
  };

  const statusBadge = getStatusBadge();
  const expiryInfo = getExpiryInfo();

  return (
    <div className={`mb-8 bg-gradient-to-r ${getCardStyle()} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {subData.planName}
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.style}`}>
              {statusBadge.text}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <TrendingUp className="h-4 w-4" />
            <span>
              {subData.usage.loadsThisMonth} / {isUnlimited ? '∞' : subData.usage.maxLoads} loads used
            </span>
          </div>
          {expiryInfo && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${
              expiryInfo.urgent ? 'text-red-600' : 'text-gray-500'
            }`}>
              <Calendar className="h-3 w-3" />
              <span>{expiryInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Usage Progress Bar */}
      {!isUnlimited && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Load Usage</span>
            <span className={`font-medium ${
              isAtLimit ? 'text-red-600' : 
              isNearLimit ? 'text-yellow-600' : 
              'text-gray-900'
            }`}>
              {Math.round(subData.usage.usagePercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(100, subData.usage.usagePercentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{subData.usage.loadsThisMonth} used</span>
            <span>{subData.usage.remainingLoads} remaining</span>
          </div>
        </div>
      )}

      {/* Usage Warnings */}
      {isAtLimit && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Monthly limit reached</span>
          </div>
          <p className="text-xs text-red-600 mt-1">
            Upgrade your plan to post more loads this month.
          </p>
        </div>
      )}

      {isNearLimit && !isAtLimit && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Approaching monthly limit</span>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            You have {subData.usage.remainingLoads} load{subData.usage.remainingLoads === 1 ? '' : 's'} remaining this month.
          </p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;