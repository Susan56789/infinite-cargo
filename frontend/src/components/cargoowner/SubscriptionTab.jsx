import React from 'react';
import { 
  Crown, Package, CheckCircle2, XCircle, Clock, 
  CreditCard, Shield, RefreshCw 
} from 'lucide-react';

const SubscriptionTab = ({
  subscription,
  subscriptionPlans,
  loading,
  formatCurrency,
  formatDate,
  onSubscribe
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Subscription Management</h3>
      
      {/* Current Subscription */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-purple-600" />
            <div>
              <h4 className="text-xl font-bold text-gray-900">
                {subscription?.planName || 'Basic Plan'}
              </h4>
              <p className="text-gray-600">
                {subscription?.status === 'active' ? 'Active Subscription' :
                 subscription?.status === 'pending' ? 'Pending Approval' :
                 'Free Plan'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {subscription?.price ? formatCurrency(subscription.price) : 'Free'}
            </p>
            <p className="text-sm text-gray-600">/month</p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm">
              {subscription?.features?.maxLoads === -1 ? 'Unlimited loads' : 
               `${subscription?.features?.maxLoads || 3} loads per month`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {subscription?.features?.prioritySupport ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Priority Support</span>
          </div>
          <div className="flex items-center gap-2">
            {subscription?.features?.advancedAnalytics ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Advanced Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            {subscription?.features?.bulkOperations ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Bulk Operations</span>
          </div>
        </div>

        {/* Usage Stats */}
        {subscription?.usage && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Monthly Usage</span>
              <span className="text-sm font-medium">
                {subscription.usage.loadsThisMonth} / {subscription.features?.maxLoads === -1 ? '∞' : subscription.features?.maxLoads} loads
              </span>
            </div>
            {subscription.features?.maxLoads !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ 
                    width: `${Math.min(100, (subscription.usage.loadsThisMonth / subscription.features.maxLoads) * 100)}%` 
                  }}
                ></div>
              </div>
            )}
          </div>
        )}

        {subscription?.expiresAt && (
          <div className="text-sm text-gray-600">
            <Clock className="h-4 w-4 inline mr-1" />
            Expires on {formatDate(subscription.expiresAt)}
          </div>
        )}
      </div>

      {/* Available Plans */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(subscriptionPlans).map(([planId, plan]) => (
            <div key={planId} className={`border rounded-lg p-6 ${
              subscription?.planId === planId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}>
              <div className="text-center mb-4">
                <h5 className="text-lg font-semibold text-gray-900">{plan.name}</h5>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                </p>
                <p className="text-sm text-gray-600">/month</p>
              </div>

              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {plan.features.maxLoads === -1 ? 'Unlimited loads' : `${plan.maxLoads} loads per month`}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.prioritySupport ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  Priority Support
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.advancedAnalytics ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  Advanced Analytics
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.bulkOperations ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  Bulk Operations
                </li>
              </ul>

             <button
  onClick={() => onSubscribe(planId, 'mpesa')}
  disabled={loading || subscription?.planId === planId}
  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
    subscription?.planId === planId
      ? 'bg-green-100 text-green-800 cursor-not-allowed'
      : planId === 'basic'
        ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
        : 'bg-blue-600 hover:bg-blue-700 text-white'
  }`}
>
  {subscription?.planId === planId
    ? 'Current Plan'
    : planId === 'basic'
    ? 'Free Plan'
    : 'Upgrade'}
</button>

            </div>
          ))}
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Payment Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Secure M-Pesa payment processing</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>30-day money-back guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Cancel or change plan anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Instant activation after payment</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionTab;