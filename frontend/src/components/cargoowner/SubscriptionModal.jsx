import React from 'react';
import { 
  Crown, CheckCircle2, XCircle, CreditCard, Shield, 
  RefreshCw, Loader2 
} from 'lucide-react';

const SubscriptionModal = ({
  showSubscriptionModal,
  subscription,
  subscriptionPlans,
  loading,
  formatCurrency,
  onSubscribe,
  onClose
}) => {
  if (!showSubscriptionModal) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Upgrade Your Plan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(subscriptionPlans).map(([planId, plan]) => (
              <div key={planId} className={`border-2 rounded-lg p-6 ${
                planId === 'business' ? 'border-purple-500 bg-purple-50' :
                planId === 'pro' ? 'border-blue-500 bg-blue-50' :
                'border-gray-200'
              }`}>
                <div className="text-center mb-4">
                  {planId === 'business' && (
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium mb-2">
                      <Crown className="h-3 w-3" />
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm">
                      {plan.features.maxLoads === -1 ? 'Unlimited loads' : `${plan.features.maxLoads} loads per month`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.features.prioritySupport ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm">Priority Support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.features.advancedAnalytics ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm">Advanced Analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.features.bulkOperations ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm">Bulk Operations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.features.apiAccess ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm">API Access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.features.dedicatedManager ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm">Dedicated Account Manager</span>
                  </li>
                </ul>

                {subscription?.planId !== planId && planId !== 'basic' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => onSubscribe(planId, 'mpesa')}
                      disabled={loading}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        planId === 'business' 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </button>
                    <p className="text-xs text-gray-500 text-center">
                      Payment via M-Pesa • Instant activation after verification
                    </p>
                  </div>
                )}

                {subscription?.planId === planId && (
                  <button
                    disabled
                    className="w-full py-3 px-4 bg-green-100 text-green-800 rounded-lg font-medium"
                  >
                    <Shield className="h-4 w-4 inline mr-1" />
                    Current Plan
                  </button>
                )}

                {planId === 'basic' && subscription?.planId !== planId && (
                  <button
                    onClick={() => onSubscribe(planId, 'mpesa')}
                    className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Downgrade to Basic
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gray-50 rounded-lg p-4">
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
      </div>
    </div>
  );
};

export default SubscriptionModal;