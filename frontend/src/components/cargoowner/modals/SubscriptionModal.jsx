import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, Clock, CheckCircle2, Info, Smartphone, AlertCircle } from 'lucide-react';

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
  const [validationErrors, setValidationErrors] = useState({});

  // Check if user can upgrade (not having active premium plan)
  const canUpgrade = useMemo(() => {
    if (!subscription) return true;
    return subscription.canUpgrade !== false && !subscription.hasActivePremiumPlan;
  }, [subscription]);

  // Process subscription plans from database format
  const processedPlans = useMemo(() => {
    if (!subscriptionPlans) return {};
    
    // Handle both object format (from API) and array format
    let plansData = {};
    
    if (Array.isArray(subscriptionPlans)) {
      // Convert array to object
      subscriptionPlans.forEach(plan => {
        if (plan.planId && plan.planId !== 'basic') {
          plansData[plan.planId] = {
            id: plan.planId,
            name: plan.name,
            price: plan.price,
            currency: plan.currency || 'KES',
            interval: plan.billingCycle || 'monthly',
            maxLoads: plan.features?.maxLoads || -1,
            features: generateFeaturesList(plan.features || {}),
            recommended: plan.isPopular || false,
            description: plan.description || '',
            duration: plan.duration || 30,
            billingCycle: plan.billingCycle || 'monthly'
          };
        }
      });
    } else if (typeof subscriptionPlans === 'object') {
      // Already in object format, just process
      Object.entries(subscriptionPlans).forEach(([planId, plan]) => {
        if (planId !== 'basic') {
          plansData[planId] = {
            ...plan,
            id: planId,
            features: Array.isArray(plan.features) ? plan.features : generateFeaturesList(plan.features || {}),
            duration: plan.duration || 30,
            billingCycle: plan.billingCycle || plan.interval || 'monthly'
          };
        }
      });
    }
    
    return plansData;
  }, [subscriptionPlans]);

  // Helper function to generate features list from features object
  const generateFeaturesList = (featuresObj) => {
    const features = [];
    
    if (featuresObj.maxLoads === -1) {
      features.push('Unlimited load postings');
    } else if (featuresObj.maxLoads > 0) {
      features.push(`Post up to ${featuresObj.maxLoads} loads per month`);
    }
    
    if (featuresObj.advancedAnalytics) {
      features.push('Advanced analytics & reporting');
    } else {
      features.push('Basic analytics');
    }
    
    if (featuresObj.prioritySupport) {
      features.push('Priority support');
    } else {
      features.push('Standard support');
    }
    
    if (featuresObj.bulkOperations) {
      features.push('Bulk operations');
    }
    
    if (featuresObj.apiAccess) {
      features.push('API access');
    }
    
    if (featuresObj.dedicatedManager) {
      features.push('Dedicated account manager');
    }
    
    return features;
  };

  // Process payment methods from database format
  const processedPaymentMethods = useMemo(() => {
    if (!paymentMethods) return [];
    
    let methodsArray = [];
    
    if (Array.isArray(paymentMethods)) {
      methodsArray = paymentMethods;
    } else if (paymentMethods.paymentMethods && Array.isArray(paymentMethods.paymentMethods)) {
      methodsArray = paymentMethods.paymentMethods;
    } else if (typeof paymentMethods === 'object') {
      methodsArray = Object.values(paymentMethods);
    }
    
    return methodsArray
      .filter(method => method && method.enabled !== false)
      .map(method => ({
        id: method.id || method.methodId,
        name: method.name || method.displayName,
        description: method.description,
        instructions: method.instructions,
        minimumAmount: method.minimumAmount,
        maximumAmount: method.maximumAmount,
        processingFee: method.processingFee || 0,
        processingFeeType: method.processingFeeType,
        currency: method.currency || 'KES',
        processingTimeMinutes: method.processingTimeMinutes,
        requiresVerification: method.requiresVerification,
        details: method.details,
        availableNow: method.availableNow !== false && method.enabled !== false,
        availableHours: method.availableHours,
        availableDays: method.availableDays
      }));
  }, [paymentMethods]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (showSubscriptionModal) {
      setSelectedPlan('');
      setSelectedPaymentMethod('');
      setBillingCycle('monthly');
      setPaymentDetails({});
      setValidationErrors({});
    }
  }, [showSubscriptionModal]);

  // Auto-select M-Pesa if it's the only payment method
  useEffect(() => {
    if (processedPaymentMethods && processedPaymentMethods.length === 1) {
      setSelectedPaymentMethod(processedPaymentMethods[0].id);
    }
  }, [processedPaymentMethods]);

  if (!showSubscriptionModal) return null;

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setValidationErrors({});
  };

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
    setPaymentDetails({});
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

    const selectedMethod = processedPaymentMethods?.find(m => m.id === selectedPaymentMethod);
    
    if (selectedMethod?.id === 'mpesa') {
      const codeError = validateMPesaCode(paymentDetails.mpesaCode || paymentDetails.paymentCode);
      if (codeError) errors.paymentCode = codeError;
      
      const phoneError = validatePhoneNumber(paymentDetails.phoneNumber);
      if (phoneError) errors.phoneNumber = phoneError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubscribe = () => {
    if (!validatePaymentForm()) {
      return;
    }

    const finalPaymentDetails = {
      ...paymentDetails,
      billingCycle,
      timestamp: new Date().toISOString(),
      // Ensure correct field names for M-Pesa
      ...(selectedPaymentMethodData?.id === 'mpesa' && {
        mpesaCode: paymentDetails.mpesaCode || paymentDetails.paymentCode,
        phoneNumber: paymentDetails.phoneNumber
      })
    };

    onSubscribe(selectedPlan, selectedPaymentMethod, finalPaymentDetails, billingCycle);
  };

  // Updated calculatePrice function to match backend logic
  const calculatePrice = (planPrice) => {
    if (!planPrice) return 0;
    
    switch (billingCycle) {
      case 'quarterly':
        return Math.round(planPrice * 3 * 0.95); // 5% discount
      case 'yearly':
        return Math.round(planPrice * 12 * 0.85); // 15% discount
      default:
        return planPrice;
    }
  };

  // Get discount info
  const getDiscountInfo = (cycle) => {
    switch (cycle) {
      case 'quarterly':
        return { percentage: 5, text: '5% savings' };
      case 'yearly':
        return { percentage: 15, text: '15% savings' };
      default:
        return { percentage: 0, text: null };
    }
  };

  const selectedPlanData = processedPlans[selectedPlan];
  const selectedPaymentMethodData = processedPaymentMethods?.find(m => m.id === selectedPaymentMethod);

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
                {subscription.hasActivePremiumPlan && (
                  <span className="ml-2 text-purple-600 font-medium">
                    ({subscription.billingCycle || 'monthly'} billing, {subscription.remainingDays || 0} days remaining)
                  </span>
                )}
              </p>
              {subscription.hasActivePremiumPlan && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-orange-800 text-sm font-medium">
                      You already have an active premium subscription. You can only upgrade to a new plan when your current subscription expires.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Billing Cycle Selection - Only show if can upgrade */}
          {canUpgrade && (
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
                    disabled={!canUpgrade}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      !canUpgrade
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : billingCycle === cycle.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {cycle.label}
                    {cycle.discount && (
                      <span className={`block text-sm font-medium ${
                        !canUpgrade ? 'text-gray-400' : 'text-green-600'
                      }`}>
                        {cycle.discount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {billingCycle !== 'monthly' && canUpgrade && (
                <div className="mt-2 text-sm text-green-600 font-medium">
                  {getDiscountInfo(billingCycle).text} compared to monthly billing
                </div>
              )}
            </div>
          )}

          {/* Plan Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Select Plan</h3>
            {validationErrors.plan && (
              <p className="text-red-600 text-sm mb-2">{validationErrors.plan}</p>
            )}
            
            {Object.keys(processedPlans).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No subscription plans available at the moment</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(processedPlans).map(([planId, plan]) => {
                  const calculatedPrice = calculatePrice(plan.price);
                  const discountInfo = getDiscountInfo(billingCycle);
                  
                  return (
                    <div
                      key={planId}
                      onClick={() => canUpgrade && handlePlanSelect(planId)}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        !canUpgrade
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : selectedPlan === planId
                          ? 'border-blue-600 bg-blue-50 cursor-pointer'
                          : 'border-gray-300 hover:border-gray-400 cursor-pointer'
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
                          Monthly: {formatCurrency ? formatCurrency(plan.price) : `KES ${plan.price}`}
                          {discountInfo.text && (
                            <span className="text-green-600 ml-2">({discountInfo.text})</span>
                          )}
                        </div>
                      )}
                      <ul className="text-sm space-y-1">
                        {plan.features?.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {!canUpgrade && (
                        <div className="mt-3 text-xs text-gray-500 text-center">
                          Cannot upgrade - active premium plan
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Selection - Only show if can upgrade */}
          {canUpgrade && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Payment Method</h3>
              {validationErrors.paymentMethod && (
                <p className="text-red-600 text-sm mb-2">{validationErrors.paymentMethod}</p>
              )}
              
              {processedPaymentMethods.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No payment methods available at the moment</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {processedPaymentMethods.map(method => (
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
                          {method.id === 'mpesa' ? (
                            <Smartphone className="h-6 w-6" />
                          ) : (
                            <CreditCard className="h-6 w-6" />
                          )}
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
              )}
            </div>
          )}

          {/* M-Pesa Payment Details - Show only if M-Pesa is selected */}
          {selectedPaymentMethodData?.id === 'mpesa' && canUpgrade && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-3">Complete M-Pesa Payment</h4>
              
              {/* M-Pesa Instructions */}
              <div className="mb-4">
                <h5 className="font-medium text-green-800 mb-2">Payment Instructions:</h5>
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

              {/* Payment Details Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    M-Pesa Transaction Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., QA12B34567"
                    value={paymentDetails.mpesaCode || paymentDetails.paymentCode || ''}
                    onChange={(e) => handlePaymentDetailsChange('mpesaCode', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
                      validationErrors.paymentCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                    maxLength={12}
                  />
                  {validationErrors.paymentCode && (
                    <p className="text-red-600 text-sm mt-1">{validationErrors.paymentCode}</p>
                  )}
                </div>

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
            </div>
          )}

          {/* Order Summary - Show when plan and payment method are selected */}
          {selectedPlan && selectedPaymentMethod && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{selectedPlanData?.name} ({billingCycle})</span>
                  <span>{formatCurrency ? formatCurrency(calculatePrice(selectedPlanData?.price)) : `KES ${calculatePrice(selectedPlanData?.price)}`}</span>
                </div>
                {billingCycle !== 'monthly' && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Monthly price: {formatCurrency ? formatCurrency(selectedPlanData?.price) : `KES ${selectedPlanData?.price}`}</span>
                    <span className="text-green-600">Save {getDiscountInfo(billingCycle).text}</span>
                  </div>
                )}
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
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {canUpgrade ? (
              <button
                onClick={handleSubscribe}
                disabled={!selectedPlan || !selectedPaymentMethod || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
            ) : (
              <button
                disabled
                className="flex-1 bg-gray-400 text-gray-600 px-6 py-3 rounded-lg font-medium cursor-not-allowed"
              >
                Cannot Upgrade - Active Plan Exists
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;