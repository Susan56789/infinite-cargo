import React, { useState } from 'react';
import { 
  Crown, X, CreditCard, Shield, Smartphone, Building2, 
  Copy, CheckCircle, AlertCircle, Loader2, User, Phone
} from 'lucide-react';

const SubscriptionModal = ({
  showSubscriptionModal,
  subscription,
  subscriptionPlans,
  loading,
  formatCurrency,
  onSubscribe,
  onClose,
  user
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('mpesa');
  const [paymentCode, setPaymentCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!showSubscriptionModal) return null;

  const paymentMethods = [
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: Smartphone,
      description: 'Pay with M-Pesa mobile money',
      color: 'green'
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: Building2,
      description: 'Direct bank transfer',
      color: 'blue'
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCard,
      description: 'Pay with card (Contact support)',
      color: 'purple'
    }
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You might want to add a toast notification here
  };

  const handleSubmit = async (planId) => {
    if (selectedPaymentMethod === 'mpesa' && !paymentCode.trim()) {
      alert('Please enter your M-Pesa transaction code');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubscribe(planId, selectedPaymentMethod, {
        paymentCode: paymentCode.trim(),
        phoneNumber: phoneNumber.trim()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8">
          {/* User Info Banner */}
          {user && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-8 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 rounded-full p-2">
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.email} • ID: IC{user.id?.slice(-6)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Object.entries(subscriptionPlans).map(([planId, plan]) => {
              const isCurrentPlan = subscription?.planId === planId;
              const isPending = subscription?.planId === planId && subscription?.status === 'pending';
              
              return (
                <div 
                  key={planId} 
                  className={`relative border-2 rounded-xl p-6 transition-all ${
                    planId === 'business' 
                      ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100' 
                      : planId === 'pro'
                      ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100'
                      : 'border-gray-200 bg-white'
                  } ${isCurrentPlan ? 'ring-2 ring-green-400' : ''}`}
                >
                  {/* Popular Badge */}
                  {planId === 'business' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Crown size={14} />
                        Most Popular
                      </div>
                    </div>
                  )}

                  {/* Current Plan Badge */}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                        <CheckCircle size={14} />
                        {isPending ? 'Pending' : 'Current'}
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                      </span>
                      {plan.price > 0 && <span className="text-gray-600">/month</span>}
                    </div>
                  </div>

                  {/* Key Features */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle size={16} className="text-green-500" />
                      <span>{plan?.maxLoads === -1 ? 'Unlimited loads' : `${plan?.maxLoads || 0} loads/month`}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle size={16} className={plan?.features?.prioritySupport ? 'text-green-500' : 'text-gray-300'} />
                      <span className={plan?.features?.prioritySupport ? '' : 'text-gray-400'}>Priority Support</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle size={16} className={plan?.features?.advancedAnalytics ? 'text-green-500' : 'text-gray-300'} />
                      <span className={plan?.features?.advancedAnalytics ? '' : 'text-gray-400'}>Advanced Analytics</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  {!isCurrentPlan && planId !== 'basic' && (
                    <button
                      onClick={() => handleSubmit(planId)}
                      disabled={isSubmitting || loading}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                        planId === 'business'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        `Choose ${plan.name}`
                      )}
                    </button>
                  )}

                  {isCurrentPlan && (
                    <div className="w-full py-3 px-4 bg-green-100 text-green-800 rounded-lg font-semibold text-center">
                      {isPending ? 'Pending Approval' : 'Current Plan'}
                    </div>
                  )}

                  {planId === 'basic' && !isCurrentPlan && (
                    <button
                      onClick={() => handleSubmit(planId)}
                      className="w-full py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                    >
                      Switch to Basic
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Payment Section */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Payment Method</h3>
            
            {/* Payment Method Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedPaymentMethod === method.id
                      ? `border-${method.color}-500 bg-${method.color}-50`
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedPaymentMethod === method.id
                        ? `bg-${method.color}-100`
                        : 'bg-gray-100'
                    }`}>
                      <method.icon size={20} className={
                        selectedPaymentMethod === method.id
                          ? `text-${method.color}-600`
                          : 'text-gray-600'
                      } />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">{method.name}</div>
                      <div className="text-sm text-gray-600">{method.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Payment Details Form */}
            <div className="bg-gray-50 rounded-xl p-6">
              {selectedPaymentMethod === 'mpesa' && (
                <div className="space-y-6">
                  <div className="bg-green-100 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <Smartphone size={18} />
                      M-Pesa Payment Instructions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-green-700">Business Number:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-white px-2 py-1 rounded border">174379</code>
                          <button onClick={() => copyToClipboard('174379')} className="text-green-600 hover:text-green-700">
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold text-green-700">Account Number:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-white px-2 py-1 rounded border">IC{user?.id?.slice(-6) || 'XXXXXX'}</code>
                          <button onClick={() => copyToClipboard(`IC${user?.id?.slice(-6) || 'XXXXXX'}`)} className="text-green-600 hover:text-green-700">
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-green-700 text-sm">
                      1. Go to M-Pesa → Pay Bill<br/>
                      2. Enter Business Number: <strong>174379</strong><br/>
                      3. Enter Account Number: <strong>IC{user?.id?.slice(-6) || 'XXXXXX'}</strong><br/>
                      4. Enter amount and complete payment
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <div className="flex items-center gap-2">
                        <Phone size={18} className="text-gray-400" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+254 XXX XXX XXX"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        M-Pesa Transaction Code *
                      </label>
                      <input
                        type="text"
                        value={paymentCode}
                        onChange={(e) => setPaymentCode(e.target.value.toUpperCase())}
                        placeholder="QH12345678"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the confirmation code from your M-Pesa SMS</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'bank_transfer' && (
                <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Building2 size={18} />
                    Bank Transfer Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
                    <div>
                      <div className="font-semibold">Bank Name:</div>
                      <div className="flex items-center gap-2">
                        <span>KCB Bank Kenya</span>
                        <button onClick={() => copyToClipboard('KCB Bank Kenya')} className="text-blue-600">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Account Name:</div>
                      <div className="flex items-center gap-2">
                        <span>Infinite Cargo Limited</span>
                        <button onClick={() => copyToClipboard('Infinite Cargo Limited')} className="text-blue-600">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Account Number:</div>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-1 rounded">1234567890</code>
                        <button onClick={() => copyToClipboard('1234567890')} className="text-blue-600">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Reference:</div>
                      <div className="flex items-center gap-2">
                        <code className="bg-white px-1 rounded">IC-{user?.id?.slice(-8) || 'XXXXXXXX'}</code>
                        <button onClick={() => copyToClipboard(`IC-${user?.id?.slice(-8) || 'XXXXXXXX'}`)} className="text-blue-600">
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-blue-50 rounded p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                      <div className="text-blue-800 text-sm">
                        Bank transfers may take 1-3 business days to process. Contact support after completing the transfer.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedPaymentMethod === 'card' && (
                <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <CreditCard size={18} />
                    Credit/Debit Card Payment
                  </h4>
                  <div className="text-purple-700 text-sm space-y-2">
                    <p>For card payments, please contact our support team:</p>
                    <div className="bg-white rounded p-3 border border-purple-200">
                      <div className="flex items-center gap-2">
                        <Phone size={16} />
                        <span className="font-semibold">+254 700 000 000</span>
                        <button onClick={() => copyToClipboard('+254 700 000 000')} className="text-purple-600">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs">Provide your account ID: IC{user?.id?.slice(-6) || 'XXXXXX'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security & Guarantee Info */}
          <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-green-600" />
                <span className="text-green-800">Secure payment processing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-green-800">30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-green-600" />
                <span className="text-green-800">Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;