import React, { useState, useEffect } from 'react';
import { X, CreditCard, Clock, CheckCircle2, Info } from 'lucide-react';

const SubscriptionModal = ({ 
  showSubscriptionModal, 
  subscription, 
  subscriptionPlans, 
  paymentMethods, 
  loading, 
  formatCurrency, 
  onSubscribe, 
  onClose 
}) => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentDetails, setPaymentDetails] = useState({});
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (showSubscriptionModal) {
      setSelectedPlan('');
      setSelectedPaymentMethod('');
      setBillingCycle('monthly');
      setPaymentDetails({});
      setShowPaymentForm(false);
      setValidationErrors({});
    }
  }, [showSubscriptionModal]);

  // Auto-select M-Pesa if it's the only payment method
  useEffect(() => {
    if (paymentMethods && paymentMethods.length === 1) {
      setSelectedPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethods]);

  if (!showSubscriptionModal) return null;

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setValidationErrors({});
  };

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
    setPaymentDetails({});
    setShowPaymentForm(false);
    setValidationErrors({});
  };

  const validateMPesaCode = (code) => {
    if (!code) return 'M-Pesa transaction code is required';
    if (!/^[A-Z0-9]{8,12}$/i.test(code.trim())) {
      return 'Invalid M-Pesa code format. Should be 8-12 alphanumeric characters (e.g., QA12B34567)';
    }
    return null;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return 'Phone number is required';
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^(\+?254|0)?[17][0-9]{8}$/.test(cleanPhone)) {
      return 'Invalid phone number. Use format: 254712345678 or 0712345678';
    }
    return null;
  };

  const handlePaymentDetailsChange = (field, value) => {
    setPaymentDetails(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validatePaymentForm = () => {
    const errors = {};
    
    if (!selectedPlan) {
      errors.plan = 'Please select a subscription plan';
    }
    
    if (!selectedPaymentMethod) {
      errors.paymentMethod = 'Please select a payment method';
    }

    const selectedMethod = paymentMethods?.find(m => m.id === selectedPaymentMethod);
    
    if (selectedMethod?.id === 'mpesa') {
      const codeError = validateMPesaCode(paymentDetails.paymentCode);
      if (codeError) errors.paymentCode = codeError;
      
      const phoneError = validatePhoneNumber(paymentDetails.phoneNumber);
      if (phoneError) errors.phoneNumber = phoneError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToPayment = () => {
    if (!selectedPlan || !selectedPaymentMethod) {
      setValidationErrors({
        plan: !selectedPlan ? 'Please select a plan' : null,
        paymentMethod: !selectedPaymentMethod ? 'Please select a payment method' : null
      });
      return;
    }

    const selectedMethod = paymentMethods?.find(m => m.id === selectedPaymentMethod);
    if (selectedMethod?.requiresVerification || selectedMethod?.id === 'mpesa') {
      setShowPaymentForm(true);
    } else {
      // Direct subscription for methods that don't need verification
      handleSubscribe();
    }
  };

  const handleSubscribe = () => {
    if (!validatePaymentForm()) {
      return;
    }

    const finalPaymentDetails = {
      ...paymentDetails,
      billingCycle,
      timestamp: new Date().toISOString()
    };

    onSubscribe(selectedPlan, selectedPaymentMethod, finalPaymentDetails);
  };

  const calculatePrice = (planPrice) => {
    if (!planPrice) return 0;
    
    switch (billingCycle) {
      case 'quarterly':
        return planPrice * 3 * 0.95; // 5% discount
      case 'yearly':
        return planPrice * 12 * 0.85; // 15% discount
      default:
        return planPrice;
    }
  };

  const selectedPlanData = subscriptionPlans?.[selectedPlan];
  const selectedPaymentMethodData = paymentMethods?.find(m => m.id === selectedPaymentMethod);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Current Subscription Status */}
          {subscription && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Current Plan</span>
              </div>
              <p className="text-blue-800">
                {subscription.planName || 'Basic Plan'} - {subscription.status}
                {subscription.hasPendingUpgrade && (
                  <span className="ml-2 text-orange-600">
                    (Pending upgrade to {subscription.pendingSubscription?.planName})
                  </span>
                )}
              </p>
            </div>
          )}

          {!showPaymentForm ? (
            <>
              {/* Billing Cycle Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Billing Cycle</h3>
                <div className="flex gap-3">
                  {[
                    { id: 'monthly', label: 'Monthly', discount: null },
                    { id: 'quarterly', label: 'Quarterly', discount: '5% off' },
                    { id: 'yearly', label: 'Yearly', discount: '15% off' }
                  ].map(cycle => (
                    <button
                      key={cycle.id}
                      onClick={() => setBillingCycle(cycle.id)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        billingCycle === cycle.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {cycle.label}
                      {cycle.discount && (
                        <span className="block text-sm text-green-600 font-medium">
                          {cycle.discount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Select Plan</h3>
                {validationErrors.plan && (
                  <p className="text-red-600 text-sm mb-2">{validationErrors.plan}</p>
                )}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(subscriptionPlans || {}).map(([planId, plan]) => {
                    if (planId === 'basic') return null;
                    
                    const calculatedPrice = calculatePrice(plan.price);
                    
                    return (
                      <div
                        key={planId}
                        onClick={() => handlePlanSelect(planId)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedPlan === planId
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        } ${plan.recommended ? 'ring-2 ring-purple-200' : ''}`}
                      >
                        {plan.recommended && (
                          <div className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full inline-block mb-2">
                            Recommended
                          </div>
                        )}
                        <h4 className="font-bold text-lg mb-2">{plan.name}</h4>
                        <div className="text-2xl font-bold mb-2">
                          {formatCurrency ? formatCurrency(calculatedPrice) : `KES ${calculatedPrice}`}
                          <span className="text-sm text-gray-600 font-normal">
                            /{billingCycle === 'yearly' ? 'year' : billingCycle === 'quarterly' ? 'quarter' : 'month'}
                          </span>
                        </div>
                        {calculatedPrice !== plan.price && (
                          <div className="text-sm text-gray-500 mb-2">
                            Regular: {formatCurrency ? formatCurrency(plan.price) : `KES ${plan.price}`}/month
                          </div>
                        )}
                        <ul className="text-sm space-y-1">
                          {plan.features?.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Payment Method</h3>
                {validationErrors.paymentMethod && (
                  <p className="text-red-600 text-sm mb-2">{validationErrors.paymentMethod}</p>
                )}
                <div className="grid gap-3">
                  {paymentMethods?.map(method => (
                    <div
                      key={method.id}
                      onClick={() => handlePaymentMethodSelect(method.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPaymentMethod === method.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-6 w-6" />
                          <div>
                            <h4 className="font-medium">{method.name}</h4>
                            <p className="text-sm text-gray-600">{method.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {method.processingFee > 0 && (
                            <p className="text-sm text-gray-600">
                              Fee: {formatCurrency ? formatCurrency(method.processingFee) : `KES ${method.processingFee}`}
                            </p>
                          )}
                          {method.availableNow ? (
                            <span className="text-green-600 text-sm">Available</span>
                          ) : (
                            <span className="text-red-600 text-sm">Unavailable</span>
                          )}
                        </div>
                      </div>
                      
                      {method.instructions && (
                        <p className="text-sm text-gray-700 mt-2 pl-9">{method.instructions}</p>
                      )}
                      
                      {method.processingTimeMinutes > 0 && (
                        <div className="flex items-center gap-1 mt-2 pl-9 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          Processing time: {Math.ceil(method.processingTimeMinutes / 60)} hours
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedToPayment}
                  disabled={!selectedPlan || !selectedPaymentMethod || loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {selectedPaymentMethodData?.requiresVerification || selectedPaymentMethodData?.id === 'mpesa'
                    ? 'Proceed to Payment'
                    : 'Subscribe Now'
                  }
                </button>
              </div>
            </>
          ) : (
            /* Payment Form */
            <div>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Order Summary</h3>
                <div className="flex justify-between">
                  <span>{selectedPlanData?.name} ({billingCycle})</span>
                  <span>{formatCurrency ? formatCurrency(calculatePrice(selectedPlanData?.price)) : `KES ${calculatePrice(selectedPlanData?.price)}`}</span>
                </div>
                {selectedPaymentMethodData?.processingFee > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Processing Fee</span>
                    <span>{formatCurrency ? formatCurrency(selectedPaymentMethodData.processingFee) : `KES ${selectedPaymentMethodData.processingFee}`}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency ? formatCurrency(calculatePrice(selectedPlanData?.price) + (selectedPaymentMethodData?.processingFee || 0)) : `KES ${calculatePrice(selectedPlanData?.price) + (selectedPaymentMethodData?.processingFee || 0)}`}</span>
                </div>
              </div>

              {selectedPaymentMethodData?.id === 'mpesa' && (
                <div className="space-y-4">
                  {/* M-Pesa Instructions */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">M-Pesa Payment Instructions</h4>
                    <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                      <li>Go to M-Pesa menu on your phone</li>
                      <li>Select "Lipa na M-Pesa"</li>
                      <li>Select "Pay Bill"</li>
                      <li>Enter Business Number: <strong>{selectedPaymentMethodData?.details?.businessNumber || '174379'}</strong></li>
                      <li>Account Number: <strong>your phone number</strong></li>
                      <li>Amount: <strong>{formatCurrency ? formatCurrency(calculatePrice(selectedPlanData?.price)) : `KES ${calculatePrice(selectedPlanData?.price)}`}</strong></li>
                      <li>Enter your M-Pesa PIN</li>
                      <li>Copy the transaction code from the confirmation SMS and enter it below</li>
                    </ol>
                  </div>

                  {/* M-Pesa Transaction Code Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      M-Pesa Transaction Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., QA12B34567"
                      value={paymentDetails.paymentCode || ''}
                      onChange={(e) => handlePaymentDetailsChange('paymentCode', e.target.value.toUpperCase())}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
                        validationErrors.paymentCode ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={12}
                    />
                    {validationErrors.paymentCode && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.paymentCode}</p>
                    )}
                  </div>

                  {/* Phone Number Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number Used for Payment *
                    </label>
                    <input
                      type="tel"
                      placeholder="254712345678"
                      value={paymentDetails.phoneNumber || ''}
                      onChange={(e) => handlePaymentDetailsChange('phoneNumber', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
                        validationErrors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {validationErrors.phoneNumber && (
                      <p className="text-red-600 text-sm mt-1">{validationErrors.phoneNumber}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    'Complete Subscription'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;