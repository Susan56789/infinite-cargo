import React, { useState, useMemo } from 'react';
import { 
  Crown, Shield, CheckCircle, AlertCircle, Clock, TrendingUp, 
  Calendar, DollarSign, Phone, Mail, User, Smartphone, Building2,
  CreditCard, Refresh, ExternalLink, Zap, Users, BarChart, Globe,
  Banknote, Wallet
} from 'lucide-react';

const SubscriptionTab = ({
  subscription,
  subscriptionPlans,
  paymentMethods,
  loading,
  formatCurrency,
  formatDate,
  onSubscribe
}) => {
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  // Get payment method icon
  const getPaymentMethodIcon = (methodId) => {
    const iconMap = {
      mpesa: Smartphone,
      bank_transfer: Building2,
      card: CreditCard,
      paypal: Wallet,
      stripe: CreditCard,
      cash: DollarSign,
      mobile_money: Smartphone,
      bitcoin: Banknote
    };
    return iconMap[methodId] || CreditCard;
  };

  // Safely get subscription data with fallbacks
  const subscriptionData = useMemo(() => {
    if (!subscription) {
      return {
        planId: 'basic',
        planName: 'Basic Plan',
        status: 'active',
        price: 0,
        usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3, usagePercentage: 0 },
        isExpired: false,
        hasPendingUpgrade: false,
        pendingSubscription: null
      };
    }

    return {
      planId: subscription.planId || 'basic',
      planName: subscription.planName || 'Basic Plan',
      status: subscription.status || 'active',
      price: subscription.price || 0,
      currency: subscription.currency || 'KES',
      isExpired: subscription.isExpired || false,
      expiresAt: subscription.expiresAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      hasPendingUpgrade: subscription.hasPendingUpgrade || false,
      pendingSubscription: subscription.pendingSubscription,
      usage: {
        loadsThisMonth: subscription.usage?.loadsThisMonth || 0,
        maxLoads: subscription.usage?.maxLoads || subscription.maxLoads || 3,
        remainingLoads: subscription.usage?.remainingLoads ?? 
                       (subscription.usage?.maxLoads ? Math.max(0, subscription.usage.maxLoads - (subscription.usage.loadsThisMonth || 0)) : 3),
        usagePercentage: subscription.usage?.usagePercentage || 
                        (subscription.usage?.maxLoads && subscription.usage?.maxLoads > 0 ? 
                         Math.min(100, ((subscription.usage.loadsThisMonth || 0) / subscription.usage.maxLoads) * 100) : 0)
      },
      features: subscription.features || { maxLoads: 3 }
    };
  }, [subscription]);

  // Get current plan details from plans data
  const currentPlan = useMemo(() => {
    if (!subscriptionPlans || !subscriptionData.planId) return null;
    return subscriptionPlans[subscriptionData.planId];
  }, [subscriptionPlans, subscriptionData.planId]);

  // Filter and sort plans for comparison - FIXED to handle both array and object format
  const availablePlans = useMemo(() => {
    if (!subscriptionPlans) return [];
    
    // Handle both object format (from API) and array format
    let plansArray = [];
    
    if (Array.isArray(subscriptionPlans)) {
      plansArray = subscriptionPlans.map(plan => ({ ...plan, id: plan.planId || plan.id }));
    } else if (typeof subscriptionPlans === 'object') {
      plansArray = Object.entries(subscriptionPlans)
        .map(([planId, plan]) => ({ ...plan, id: planId }));
    }
    
    return plansArray.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
  }, [subscriptionPlans]);

  // Filter available payment methods - FIXED to handle array format
  const availablePaymentMethods = useMemo(() => {
    if (!paymentMethods) return [];
    
    // Handle both array format (from API) and other formats
    let methodsArray = [];
    
    if (Array.isArray(paymentMethods)) {
      methodsArray = paymentMethods;
    } else if (paymentMethods.paymentMethods && Array.isArray(paymentMethods.paymentMethods)) {
      methodsArray = paymentMethods.paymentMethods;
    } else {
      // If it's an object, convert to array
      methodsArray = Object.values(paymentMethods);
    }
    
    return methodsArray.filter(method => method && method.availableNow !== false);
  }, [paymentMethods]);

  const getStatusBadge = (status, isExpired = false, isPending = false) => {
    if (isPending) {
      return { style: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Pending Approval', icon: Clock };
    }
    if (isExpired) {
      return { style: 'bg-red-100 text-red-800 border-red-200', text: 'Expired', icon: AlertCircle };
    }
    if (status === 'active') {
      return { style: 'bg-green-100 text-green-800 border-green-200', text: 'Active', icon: CheckCircle };
    }
    return { style: 'bg-gray-100 text-gray-800 border-gray-200', text: status || 'Unknown', icon: AlertCircle };
  };

  const statusBadge = getStatusBadge(
    subscriptionData.status, 
    subscriptionData.isExpired, 
    subscriptionData.hasPendingUpgrade || subscriptionData.status === 'pending'
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading subscription information...</p>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      {/* Current Subscription Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Crown className="h-6 w-6 text-purple-600" />
          Current Subscription
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <span className="font-medium text-gray-700">Plan:</span>
            <div className="text-lg font-semibold text-gray-900">{subscriptionData.planName}</div>
          </div>
          
          <div>
            <span className="font-medium text-gray-700">Status:</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusBadge.style}`}>
                {statusBadge.text}
              </span>
            </div>
          </div>
          
          <div>
            <span className="font-medium text-gray-700">Monthly Cost:</span>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency ? formatCurrency(subscriptionData.price) : `KES ${subscriptionData.price}`}
            </div>
          </div>
          
          <div>
            <span className="font-medium text-gray-700">Usage This Month:</span>
            <div className="text-lg font-semibold text-gray-900">
              {subscriptionData.usage.loadsThisMonth} / {subscriptionData.usage.maxLoads === -1 ? '∞' : subscriptionData.usage.maxLoads} loads
            </div>
            {subscriptionData.usage.maxLoads !== -1 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, subscriptionData.usage.usagePercentage)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Available Plans</h3>
          <button 
            onClick={() => setShowPaymentMethods(!showPaymentMethods)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <CreditCard className="h-4 w-4" />
            {showPaymentMethods ? 'Hide' : 'View'} Payment Methods
          </button>
        </div>

        {/* Payment Methods Section */}
        {showPaymentMethods && (
          <div className="mb-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Available Payment Methods
            </h4>
            
            {availablePaymentMethods.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No payment methods available at the moment</p>
                <p className="text-sm text-gray-500 mt-2">Please contact support for assistance</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePaymentMethods.map((method, index) => {
                  const IconComponent = getPaymentMethodIcon(method.id || method.methodId);
                  
                  return (
                    <div key={method.id || method.methodId || index} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-blue-100 rounded-lg p-2">
                          <IconComponent className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900">{method.name || method.displayName}</h5>
                          <p className="text-xs text-gray-600">{method.description}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        {method.processingTimeMinutes && method.processingTimeMinutes > 0 && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Processing: ~{Math.ceil(method.processingTimeMinutes / 60)} hours</span>
                          </div>
                        )}
                        
                        {method.processingFee > 0 && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span>Fee: {formatCurrency ? formatCurrency(method.processingFee) : `KES ${method.processingFee}`}</span>
                          </div>
                        )}
                        
                        {method.minimumAmount && method.minimumAmount > 1 && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            <span>Min: {formatCurrency ? formatCurrency(method.minimumAmount) : `KES ${method.minimumAmount}`}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <div className={`text-xs px-2 py-1 rounded ${
                          method.availableNow !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {method.availableNow !== false ? 'Available' : 'Currently unavailable'}
                        </div>
                        
                        {method.instructions && (
                          <div className="text-xs text-blue-600">
                            Instructions available
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Plans Grid */}
        {availablePlans.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No subscription plans available at the moment</p>
            <p className="text-sm text-gray-500 mt-2">Please contact support for assistance</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availablePlans.map((plan) => {
              const isCurrentPlan = plan.id === subscriptionData.planId && subscriptionData.status === 'active';
              const isPendingForThisPlan = subscriptionData.hasPendingUpgrade && 
                subscriptionData.pendingSubscription?.planId === plan.id;
              const isRecommended = plan.recommended || plan.isPopular || plan.id === 'business';
              
              return (
                <div 
                  key={plan.id}
                  className={`relative border-2 rounded-xl p-6 transition-all ${
                    isRecommended
                      ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100' 
                      : plan.id === 'pro'
                      ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100'
                      : 'border-gray-200 bg-white'
                  } ${isCurrentPlan ? 'ring-2 ring-green-400' : ''} ${
                    isPendingForThisPlan ? 'ring-2 ring-yellow-400' : ''
                  }`}
                >
                  {/* Badges */}
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Crown size={14} />
                        {plan.isPopular ? 'Most Popular' : 'Recommended'}
                      </div>
                    </div>
                  )}

                  {(isCurrentPlan || isPendingForThisPlan) && (
                    <div className="absolute -top-3 right-4">
                      <div className={`${isPendingForThisPlan ? 'bg-yellow-500' : 'bg-green-500'} text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1`}>
                        {isPendingForThisPlan ? (
                          <>
                            <Clock size={14} />
                            Pending
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} />
                            Current
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.price === 0 ? 'Free' : (formatCurrency ? formatCurrency(plan.price) : `KES ${plan.price}`)}
                      </span>
                      {plan.price > 0 && <span className="text-gray-600">/{plan.billingCycle || plan.interval || 'month'}</span>}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {/* Generate features based on plan data */}
                    {plan.features && typeof plan.features === 'object' ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          <span>
                            {plan.features.maxLoads === -1 
                              ? 'Unlimited load postings'
                              : `Post up to ${plan.features.maxLoads} loads per month`
                            }
                          </span>
                        </div>
                        {plan.features.advancedAnalytics && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            <span>Advanced analytics & reporting</span>
                          </div>
                        )}
                        {plan.features.prioritySupport && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            <span>Priority support</span>
                          </div>
                        )}
                        {plan.features.bulkOperations && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            <span>Bulk operations</span>
                          </div>
                        )}
                        {plan.features.apiAccess && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            <span>API access</span>
                          </div>
                        )}
                        {plan.features.dedicatedManager && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            <span>Dedicated account manager</span>
                          </div>
                        )}
                      </>
                    ) : plan.features && Array.isArray(plan.features) ? (
                      plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <span>Basic features included</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="text-center">
                    {isCurrentPlan && !isPendingForThisPlan ? (
                      <div className="w-full py-3 px-4 bg-green-100 text-green-800 rounded-lg font-semibold">
                        Current Plan
                      </div>
                    ) : isPendingForThisPlan ? (
                      <div className="w-full py-3 px-4 bg-yellow-100 text-yellow-800 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <Clock size={16} />
                        Pending Approval
                      </div>
                    ) : subscriptionData.hasPendingUpgrade ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-gray-400 text-gray-600 rounded-lg font-semibold cursor-not-allowed"
                      >
                        Request Pending
                      </button>
                    ) : plan.id === 'basic' ? (
                      <button
                        onClick={() => onSubscribe && onSubscribe(plan.id)}
                        className="w-full py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                      >
                        Switch to Basic
                      </button>
                    ) : availablePaymentMethods.length === 0 ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 bg-gray-400 text-gray-600 rounded-lg font-semibold cursor-not-allowed"
                      >
                        No Payment Methods
                      </button>
                    ) : (
                      <button
                        onClick={() => onSubscribe && onSubscribe(plan.id)}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                          isRecommended
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                        }`}
                      >
                        Choose {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription History/Details */}
      {currentPlan && subscriptionData.planId !== 'basic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Subscription Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="font-medium text-gray-700">Plan:</span>
                <div className="text-gray-900">{subscriptionData.planName}</div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.style}`}>
                    {statusBadge.text}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Monthly Cost:</span>
                <div className="text-gray-900">{formatCurrency ? formatCurrency(subscriptionData.price) : `KES ${subscriptionData.price}`}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              {subscriptionData.createdAt && (
                <div>
                  <span className="font-medium text-gray-700">Started:</span>
                  <div className="text-gray-900">{formatDate ? formatDate(subscriptionData.createdAt) : new Date(subscriptionData.createdAt).toLocaleDateString()}</div>
                </div>
              )}
              
              {subscriptionData.expiresAt && (
                <div>
                  <span className="font-medium text-gray-700">Expires:</span>
                  <div className="text-gray-900">{formatDate ? formatDate(subscriptionData.expiresAt) : new Date(subscriptionData.expiresAt).toLocaleDateString()}</div>
                </div>
              )}
              
              <div>
                <span className="font-medium text-gray-700">Load Limit:</span>
                <div className="text-gray-900">
                  {subscriptionData.usage.maxLoads === -1 ? 'Unlimited' : `${subscriptionData.usage.maxLoads} per month`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help & Support */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Need Help?
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">Call: +254723 139 610</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="text-gray-700">Email: support@infinitecargo.co.ke</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" />
            <a href="#" className="text-blue-600 hover:text-blue-700">Visit Help Center</a>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            All subscriptions come with a 30-day money-back guarantee. Cancel anytime through your dashboard or contact support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionTab;