import React, { useState, useMemo } from 'react';
import { 
  Crown, Shield, CheckCircle, AlertCircle, Clock, TrendingUp, 
  Calendar, DollarSign, Phone, Mail, Smartphone, Building2,
  CreditCard,  Globe,  Banknote, Wallet, X, Info, 
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
  const [showSubscriptionFlow, setShowSubscriptionFlow] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentDetails, setPaymentDetails] = useState({});
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

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

  // Process subscription plans for the modal
  const processedPlans = useMemo(() => {
    if (!subscriptionPlans) return {};
    
    let plansData = {};
    
    if (Array.isArray(subscriptionPlans)) {
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
            description: plan.description || ''
          };
        }
      });
    } else if (typeof subscriptionPlans === 'object') {
      Object.entries(subscriptionPlans).forEach(([planId, plan]) => {
        if (planId !== 'basic') {
          plansData[planId] = {
            ...plan,
            id: planId,
            features: Array.isArray(plan.features) ? plan.features : generateFeaturesList(plan.features || {})
          };
        }
      });
    }
    
    return plansData;
  }, [subscriptionPlans]);

  // Process payment methods for the modal
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

  // Helper function to generate features list
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

  // Subscription flow handlers
  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    setShowSubscriptionFlow(true);
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

    const selectedMethod = processedPaymentMethods?.find(m => m.id === selectedPaymentMethod);
    if (selectedMethod?.requiresVerification || selectedMethod?.id === 'mpesa') {
      setShowPaymentForm(true);
    } else {
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
    
    // Reset form
    setShowSubscriptionFlow(false);
    setSelectedPlan('');
    setSelectedPaymentMethod('');
    setPaymentDetails({});
    setShowPaymentForm(false);
    setValidationErrors({});
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

  const selectedPlanData = processedPlans[selectedPlan];
  const selectedPaymentMethodData = processedPaymentMethods?.find(m => m.id === selectedPaymentMethod);

  return (
    <div className="space-y-8">
      {/* Subscription Flow Modal */}
      {showSubscriptionFlow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Subscribe to {processedPlans[selectedPlan]?.name}</h2>
              <button
                onClick={() => {
                  setShowSubscriptionFlow(false);
                  setSelectedPlan('');
                  setSelectedPaymentMethod('');
                  setPaymentDetails({});
                  setShowPaymentForm(false);
                  setValidationErrors({});
                }}
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

                  {/* Selected Plan Summary */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">Selected Plan</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{selectedPlanData?.name}</span>
                        <p className="text-sm text-gray-600">{selectedPlanData?.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatCurrency ? formatCurrency(calculatePrice(selectedPlanData?.price)) : `KES ${calculatePrice(selectedPlanData?.price)}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          /{billingCycle === 'yearly' ? 'year' : billingCycle === 'quarterly' ? 'quarter' : 'month'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
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

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowSubscriptionFlow(false);
                        setSelectedPlan('');
                        setSelectedPaymentMethod('');
                        setPaymentDetails({});
                        setShowPaymentForm(false);
                        setValidationErrors({});
                      }}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProceedToPayment}
                      disabled={!selectedPaymentMethod || loading}
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
      )}

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
                        onClick={() => handlePlanSelect(plan.id)}
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
                        onClick={() => handlePlanSelect(plan.id)}
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
            <a href="/support" className="text-blue-600 hover:text-blue-700">Visit Help Center</a>
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