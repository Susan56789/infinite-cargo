import React from 'react';
import { 
  Crown, Package, CheckCircle2, XCircle, Clock, 
  CreditCard, Shield, RefreshCw, AlertCircle 
} from 'lucide-react';

const SubscriptionTab = ({
  subscription,
  subscriptionPlans,
  loading,
  formatCurrency,
  formatDate,
  onSubscribe
}) => {
  
  // Safe helper function to get usage data with extensive null checks
  const getUsageData = () => {
    if (!subscription?.usage) {
      return { 
        loadsThisMonth: 0, 
        maxLoads: 3, 
        remainingLoads: 3, 
        usagePercentage: 0 
      };
    }
    
    const usage = subscription.usage;
    const loadsThisMonth = usage.loadsThisMonth || 0;
    const maxLoads = usage.maxLoads || 3;
    const remainingLoads = usage.remainingLoads !== undefined ? usage.remainingLoads : Math.max(0, maxLoads - loadsThisMonth);
    const usagePercentage = usage.usagePercentage || (maxLoads === -1 ? 0 : Math.min(100, (loadsThisMonth / maxLoads) * 100));
    
    return {
      loadsThisMonth,
      maxLoads,
      remainingLoads,
      usagePercentage
    };
  };

  // Safe helper function to get current subscription features
  const getCurrentSubscriptionFeatures = () => {
    if (!subscription) {
      return {
        maxLoads: 3,
        prioritySupport: false,
        advancedAnalytics: false,
        bulkOperations: false
      };
    }

    // Try multiple possible data structures
    const planId = subscription.planId || 'basic';
    const currentPlan = subscriptionPlans?.[planId];
    
    // If we have the plan from subscriptionPlans, use it
    if (currentPlan) {
      return {
        maxLoads: currentPlan.maxLoads || currentPlan.features?.maxLoads || 3,
        prioritySupport: currentPlan.features?.prioritySupport || 
                        (Array.isArray(currentPlan.features) && currentPlan.features.includes('Priority support')) ||
                        false,
        advancedAnalytics: currentPlan.features?.advancedAnalytics || 
                          (Array.isArray(currentPlan.features) && currentPlan.features.includes('Advanced analytics')) ||
                          false,
        bulkOperations: currentPlan.features?.bulkOperations || 
                       (Array.isArray(currentPlan.features) && currentPlan.features.includes('Bulk operations')) ||
                       false
      };
    }

    // Fallback to subscription data itself
    const subscriptionFeatures = subscription.features || [];
    return {
      maxLoads: subscription.maxLoads || (Array.isArray(subscriptionFeatures) ? 3 : subscriptionFeatures.maxLoads) || 3,
      prioritySupport: Array.isArray(subscriptionFeatures) ? 
                      subscriptionFeatures.includes('Priority support') : 
                      (subscriptionFeatures.prioritySupport || false),
      advancedAnalytics: Array.isArray(subscriptionFeatures) ? 
                        subscriptionFeatures.includes('Advanced analytics') : 
                        (subscriptionFeatures.advancedAnalytics || false),
      bulkOperations: Array.isArray(subscriptionFeatures) ? 
                     subscriptionFeatures.includes('Bulk operations') : 
                     (subscriptionFeatures.bulkOperations || false)
    };
  };

  // Safe helper function to get plan features for available plans
  const getPlanFeatures = (plan) => {
    if (!plan) {
      return {
        maxLoads: 3,
        prioritySupport: false,
        advancedAnalytics: false,
        bulkOperations: false
      };
    }

    // Handle different possible structures
    const features = plan.features || [];
    
    return {
      maxLoads: plan.maxLoads || features.maxLoads || 3,
      prioritySupport: features.prioritySupport || 
                      (Array.isArray(features) && features.includes('Priority support')) ||
                      false,
      advancedAnalytics: features.advancedAnalytics || 
                        (Array.isArray(features) && features.includes('Advanced analytics')) ||
                        false,
      bulkOperations: features.bulkOperations || 
                     (Array.isArray(features) && features.includes('Bulk operations')) ||
                     false
    };
  };

  const usage = getUsageData();
  const currentFeatures = getCurrentSubscriptionFeatures();
  const isUnlimited = usage.maxLoads === -1 || currentFeatures.maxLoads === -1;

  // Safe plans object with fallback
  const safeSubscriptionPlans = subscriptionPlans || {
    basic: { id: 'basic', name: 'Basic Plan', price: 0, maxLoads: 3, features: [] },
    pro: { id: 'pro', name: 'Pro Plan', price: 999, maxLoads: 25, features: [] },
    business: { id: 'business', name: 'Business Plan', price: 2499, maxLoads: 100, features: [] }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Subscription Management</h3>
      
      {/* Current Subscription Status */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-purple-600" />
            <div>
              <h4 className="text-xl font-bold text-gray-900">
                {subscription?.planName || 'Basic Plan'}
              </h4>
              <div className="flex items-center gap-2">
                <p className="text-gray-600">
                  {subscription?.status === 'active' && subscription?.planId !== 'basic' ? 'Active Subscription' :
                   subscription?.status === 'pending' ? 'Pending Approval' :
                   subscription?.isExpired ? 'Expired - Downgraded to Basic' :
                   'Free Plan'}
                </p>
                {subscription?.status === 'pending' && (
                  <Clock className="h-4 w-4 text-yellow-500" />
                )}
                {subscription?.isExpired && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {subscription?.price ? (formatCurrency ? formatCurrency(subscription.price) : `KES ${subscription.price}`) : 'Free'}
            </p>
            <p className="text-sm text-gray-600">/month</p>
          </div>
        </div>

        {/* Status Message for Pending */}
        {subscription?.status === 'pending' && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Subscription Pending Approval</span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">
              Your upgrade request is being reviewed. You'll be notified once it's processed (24-48 hours).
            </p>
          </div>
        )}

        {/* Current Plan Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm">
              {isUnlimited ? 'Unlimited loads' : `${currentFeatures.maxLoads} loads per month`}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {currentFeatures.prioritySupport ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Priority Support</span>
          </div>
          
          <div className="flex items-center gap-2">
            {currentFeatures.advancedAnalytics ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">Advanced Analytics</span>
          </div>
          
          <div className="flex items-center gap-2">
            {currentFeatures.bulkOperations ? (
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
                {usage.loadsThisMonth} / {isUnlimited ? '∞' : usage.maxLoads} loads
              </span>
            </div>
            {!isUnlimited && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ 
                    width: `${Math.min(100, usage.usagePercentage)}%` 
                  }}
                ></div>
              </div>
            )}
            
            {/* Usage warning */}
            {usage.usagePercentage > 80 && !isUnlimited && (
              <div className="mt-2 text-xs text-yellow-600">
                {usage.remainingLoads === 0 ? 'Monthly limit reached!' : `Only ${usage.remainingLoads} loads remaining this month`}
              </div>
            )}
          </div>
        )}

        {subscription?.expiresAt && subscription?.planId !== 'basic' && (
          <div className="text-sm text-gray-600">
            <Clock className="h-4 w-4 inline mr-1" />
            {subscription.isExpired ? 'Expired on' : 'Expires on'} {
              formatDate ? formatDate(subscription.expiresAt) : new Date(subscription.expiresAt).toLocaleDateString()
            }
          </div>
        )}
      </div>

      {/* Available Plans */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Available Plans</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(safeSubscriptionPlans).map(([planId, plan]) => {
            const features = getPlanFeatures(plan);
            const isCurrentPlan = subscription?.planId === planId;
            const hasPendingUpgrade = subscription?.hasPendingUpgrade || subscription?.pendingSubscription;
            
            return (
              <div key={planId} className={`border rounded-lg p-6 ${
                isCurrentPlan ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              } ${plan.recommended ? 'ring-2 ring-purple-200' : ''}`}>
                
                {plan.recommended && (
                  <div className="text-center mb-2">
                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="text-center mb-4">
                  <h5 className="text-lg font-semibold text-gray-900">{plan.name || `${planId} Plan`}</h5>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {(plan.price === 0 || plan.price === undefined) ? 'Free' : (
                      formatCurrency ? formatCurrency(plan.price) : `KES ${plan.price}`
                    )}
                  </p>
                  <p className="text-sm text-gray-600">/month</p>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {features.maxLoads === -1 ? 'Unlimited loads' : `${features.maxLoads} loads per month`}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {features.prioritySupport ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    Priority Support
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {features.advancedAnalytics ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    Advanced Analytics
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {features.bulkOperations ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    Bulk Operations
                  </li>
                </ul>

                <button
                  onClick={() => onSubscribe && onSubscribe(planId, 'mpesa')}
                  disabled={loading || isCurrentPlan || (planId === 'basic') || hasPendingUpgrade}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-green-100 text-green-800 cursor-not-allowed'
                      : planId === 'basic'
                        ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                        : hasPendingUpgrade
                          ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isCurrentPlan
                    ? 'Current Plan'
                    : planId === 'basic'
                    ? 'Free Plan'
                    : hasPendingUpgrade
                    ? 'Upgrade Pending'
                    : loading
                    ? 'Processing...'
                    : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Subscription Notice */}
      {subscription?.hasPendingUpgrade && subscription?.pendingSubscription && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700 mb-2">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Pending Subscription Request</span>
          </div>
          <p className="text-sm text-yellow-600 mb-2">
            You have a pending {subscription.pendingSubscription.planName || 'premium'} subscription request. 
            It will be reviewed within 24-48 hours.
          </p>
          {subscription.pendingSubscription.createdAt && (
            <div className="text-xs text-yellow-500">
              Requested: {formatDate ? formatDate(subscription.pendingSubscription.createdAt) : 'Recently'}
            </div>
          )}
        </div>
      )}

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
            <span>Manual approval for security</span>
          </div>
        </div>
      </div>
    </div>
  );
};






export default SubscriptionTab;