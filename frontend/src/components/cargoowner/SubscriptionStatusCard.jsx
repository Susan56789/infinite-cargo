import React from 'react';
import { Crown } from 'lucide-react';

const SubscriptionStatusCard = ({ subscription, formatDate }) => {
  if (!subscription) return null;

  return (
    <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">{subscription.planName}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              subscription.status === 'active' ? 'bg-green-100 text-green-800' :
              subscription.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {subscription.status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">
            {subscription?.usage?.loadsThisMonth || 0} / {subscription?.maxLoads === -1 ? '∞' : subscription?.maxLoads || 0} loads used
          </p>
          {subscription.expiresAt && (
            <p className="text-xs text-gray-500">
              Expires: {formatDate(subscription.expiresAt)}
            </p>
          )}
        </div>
      </div>
      
      {subscription.features?.maxLoads !== -1 && subscription.usage && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ 
                width: `${Math.min(100, (subscription.usage.loadsThisMonth / subscription.maxLoads) * 100)}%` 
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;