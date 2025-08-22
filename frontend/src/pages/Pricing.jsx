import React, { useState, useEffect } from 'react';
import { Check, Star, Building, Zap, Shield, Headphones, BarChart3, Settings, CreditCard, Smartphone, Building2, AlertCircle, Clock, CheckCircle2, X, User, Mail, Phone, Copy } from 'lucide-react';
import {getUser, getToken, isAuthenticated } from '../utils/auth';

const Pricing = () => {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('mpesa');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentCode, setPaymentCode] = useState('');
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [user, setUser] = useState(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const plans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: 0,
      originalPrice: 0,
      subtitle: 'Perfect for individuals',
      icon: Shield,
      popular: false,
      features: [
        'Post 1 load/month',
        'Access verified driver list',
        'Basic email support',
        'Driver ratings & reviews',
        'Basic analytics'
      ],
      limitations: [
        'Limited monthly loads',
        'Standard support response time',
        'Basic reporting only'
      ],
      buttonText: 'Get Started Free',
      color: 'from-slate-400 to-slate-600',
      recommended: false
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      price: 999,
      originalPrice: 1299,
      subtitle: 'Most popular for businesses',
      icon: Star,
      popular: true,
      features: [
        'Post 25 loads/month',
        'Priority driver matching',
        'In-app messaging system',
        'Real-time shipment tracking',
        'Priority email & phone support',
        'Advanced analytics dashboard',
        'Bulk load operations',
        'Custom notifications'
      ],
      limitations: [],
      buttonText: 'Upgrade to Pro',
      color: 'from-primary-500 to-primary-700',
      recommended: true,
      savings: '23% OFF'
    },
    {
      id: 'business',
      name: 'Business Plan',
      price: 2499,
      originalPrice: 3499,
      subtitle: 'For large-scale operations',
      icon: Building,
      popular: false,
      features: [
        'Post 100 Loads/month',
        'Dedicated account manager',
        '24/7 priority phone support',
        'Monthly performance reports',
        'API access for integrations',
        'Custom contract management',
        'White-label solutions',
        'Advanced security features'
      ],
      limitations: [],
      buttonText: 'Upgrade to Business',
      color: 'from-secondary-600 to-secondary-800',
      recommended: false,
      savings: '29% OFF'
    },
  ];

  const paymentMethods = [
    {
      id: 'mpesa',
      name: 'M-Pesa',
      icon: Smartphone,
      description: 'Pay securely with M-Pesa mobile money',
      instructions: {
        paybill: '174379',
        accountNumber: 'Your Account Number (Auto-generated)',
        amount: 'Plan Amount',
        steps: [
          'Go to M-Pesa menu on your phone',
          'Select Pay Bill',
          'Enter Business Number: 174379',
          'Enter Account Number: IC' + (user?.id?.slice(-6) || 'XXXXXX'),
          'Enter Amount: KES {amount}',
          'Enter your M-Pesa PIN',
          'Confirm payment and note the M-Pesa code'
        ]
      }
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: Building2,
      description: 'Direct bank transfer to our account',
      instructions: {
        bankName: 'KCB Bank Kenya',
        accountName: 'Infinite Cargo Limited',
        accountNumber: '1234567890',
        branch: 'Westlands Branch',
        swiftCode: 'KCBLKENX',
        reference: 'IC-' + (user?.id?.slice(-8) || 'XXXXXXXX')
      }
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCard,
      description: 'Pay with your credit or debit card',
      instructions: 'Contact our support team at +254 700 000 000 for assisted card payment processing'
    }
  ];

  const additionalFeatures = [
    {
      icon: Zap,
      title: 'Lightning Fast Matching',
      description: 'Get matched with drivers in under 2 minutes'
    },
    {
      icon: Shield,
      title: '100% Secure Payments',
      description: 'Your payments are protected with bank-level security'
    },
    {
      icon: Headphones,
      title: '24/7 Support',
      description: 'Round-the-clock customer support when you need it'
    },
    {
      icon: BarChart3,
      title: 'Detailed Analytics',
      description: 'Track performance with comprehensive reports'
    }
  ];

  useEffect(() => {
    // Get current user data if authenticated
    if (isAuthenticated()) {
      const currentUser = getUser();
      setUser(currentUser);
      
      // Only fetch subscription if user is cargo owner
      if (currentUser?.userType === 'cargo_owner') {
        fetchCurrentSubscription();
      }
    }
  }, []);

  const fetchCurrentSubscription = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/subscriptions/my-subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.data.subscription);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      setShowLoginPrompt(true);
      return;
    }

    // Check if user is cargo owner
    if (user?.userType !== 'cargo_owner') {
      alert('Only cargo owners can subscribe to premium plans. Drivers can browse and apply for loads without any subscription fees.');
      return;
    }

    if (plan.id === 'basic') {
      alert('You are already on the Basic plan. All new cargo owners are automatically enrolled in the Basic plan.');
      return;
    }

    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPayment(methodId);
    setShowPaymentInstructions(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const processSubscription = async () => {
    if (!paymentCode.trim() && selectedPayment === 'mpesa') {
      alert('Please enter your M-Pesa transaction code');
      return;
    }

    setSubscribing(true);
    try {
      const token = getToken();
      if (!token) {
        alert('Please log in to subscribe');
        return;
      }

      const subscriptionData = {
        planId: selectedPlan.id,
        paymentMethod: selectedPayment,
        billingCycle: 'monthly',
        paymentDetails: selectedPayment === 'mpesa' ? {
          mpesaCode: paymentCode.trim(),
          phoneNumber: user?.phone,
          amount: selectedPlan.price
        } : selectedPayment === 'bank_transfer' ? {
          accountNumber: paymentMethods.find(m => m.id === 'bank_transfer').instructions.accountNumber,
          reference: paymentMethods.find(m => m.id === 'bank_transfer').instructions.reference,
          amount: selectedPlan.price
        } : {
          contactedSupport: true,
          amount: selectedPlan.price
        }
      };

      const response = await fetch('https://infinite-cargo-api.onrender.com/api/subscriptions/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const data = await response.json();

      if (response.ok) {
        alert('Subscription request submitted successfully! Your upgrade will be activated once payment is confirmed by our admin team. You will receive an email notification once approved.');
        setShowPaymentModal(false);
        setShowPaymentInstructions(false);
        setPaymentCode('');
        await fetchCurrentSubscription();
      } else {
        alert(data.message || 'Subscription failed');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Subscription failed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const getSubscriptionStatus = (planId) => {
    if (!currentPlan) {
      // For Basic plan, if no subscription exists, user is on basic by default
      if (planId === 'basic' && user?.userType === 'cargo_owner') {
        return { type: 'active', text: 'Current Plan', color: 'text-green-600' };
      }
      return null;
    }
    
    if (currentPlan.planId === planId) {
      switch (currentPlan.status) {
        case 'active':
          return { type: 'active', text: 'Current Plan', color: 'text-green-600' };
        case 'pending':
          return { type: 'pending', text: 'Pending Approval', color: 'text-yellow-600' };
        case 'expired':
          return { type: 'expired', text: 'Expired', color: 'text-red-600' };
        default:
          return null;
      }
    }
    return null;
  };

  const getButtonText = (plan) => {
    if (isAuthenticated() && user?.userType === 'cargo_owner') {
      const status = getSubscriptionStatus(plan.id);
      if (status?.type === 'active') return 'Current Plan';
      if (status?.type === 'pending') return 'Pending Approval';
    }
    return plan.buttonText;
  };

  const isButtonDisabled = (plan) => {
    if (!isAuthenticated()) return false;
    if (user?.userType !== 'cargo_owner') return false;
    
    const status = getSubscriptionStatus(plan.id);
    return subscribing || (status?.type === 'active' && plan.id !== 'basic');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-8">
            <Settings size={40} />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Choose Your Plan</h1>
          <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto leading-relaxed">
            Select the perfect pricing plan for your cargo transport needs. Scale up as your business grows.
          </p>
          
          {/* User Status Display */}
          {isAuthenticated() && user && (
            <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-4">
                <User size={20} />
                <span className="font-semibold">Welcome, {user?.name}</span>
              </div>
              {user.userType === 'cargo_owner' ? (
                currentPlan ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    <span>Current Plan: {currentPlan.planName}</span>
                    {currentPlan.status === 'pending' && (
                      <span className="bg-yellow-500/20 text-yellow-200 px-3 py-1 rounded-full text-sm ml-2">
                        Pending Approval
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    <span>Current Plan: Basic Plan (Free)</span>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Shield size={20} />
                  <span>Driver Account - No subscription needed</span>
                </div>
              )}
            </div>
          )}

          {/* Public Call to Action */}
          {!isAuthenticated() && (
            <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto">
              <p className="text-primary-100 mb-4">Ready to streamline your cargo transport?</p>
              <div className="flex gap-4 justify-center">
                <a href="/register" className="bg-white text-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition-colors">
                  Get Started
                </a>
                <a href="/login" className="border border-white text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors">
                  Sign In
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 -mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => {
              const status = isAuthenticated() ? getSubscriptionStatus(plan.id) : null;
              return (
                <div 
                  key={plan.id}
                  className={`group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
                    plan.popular ? 'border-4 border-primary-400 scale-105' : 'border border-slate-200'
                  } ${status?.type === 'active' ? 'ring-2 ring-green-400' : ''} overflow-hidden`}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                        Most Popular
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  {status && (
                    <div className="absolute -top-4 right-4 z-10">
                      <div className={`bg-white shadow-lg border border-slate-200 ${status.color} px-4 py-2 rounded-full text-sm font-bold`}>
                        {status.text}
                      </div>
                    </div>
                  )}

                  <div className="p-8 md:p-10">
                    {/* Plan Icon & Info */}
                    <div className="text-center mb-8">
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${plan.color} text-white mb-4`}>
                        <plan.icon size={36} />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                      <p className="text-slate-600">{plan.subtitle}</p>
                    </div>

                    {/* Pricing */}
                    <div className="text-center mb-8">
                      {plan.savings && (
                        <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold mb-3">
                          {plan.savings}
                        </div>
                      )}
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-4xl md:text-5xl font-bold text-slate-800">
                          {plan.price === 0 ? 'Free' : `KES ${plan.price.toLocaleString()}`}
                        </span>
                        {plan.price > 0 && <span className="text-xl text-slate-600">/month</span>}
                      </div>
                      {plan.originalPrice > plan.price && (
                        <div className="text-slate-500 text-lg line-through">
                          KES {plan.originalPrice.toLocaleString()}/month
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                            <Check size={16} className="text-green-600" />
                          </div>
                          <span className="text-slate-700 leading-relaxed">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button 
                      onClick={() => handleSubscribe(plan)}
                      disabled={isButtonDisabled(plan)}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                        status?.type === 'active'
                          ? 'bg-green-500 text-white cursor-default'
                          : plan.popular 
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white'
                          : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white'
                      }`}
                    >
                      {subscribing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Processing...
                        </div>
                      ) : (
                        getButtonText(plan)
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Additional Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Why Choose Infinite Cargo?</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Our platform is designed to make cargo transport seamless, efficient, and profitable for everyone.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {additionalFeatures.map((feature, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl mb-4 group-hover:from-primary-200 group-hover:to-primary-300 transition-all duration-300">
                  <feature.icon size={32} className="text-primary-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-slate-600">Get answers to common questions about our pricing plans</p>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Can I change my plan anytime?</h3>
              <p className="text-slate-600">Yes, you can upgrade or downgrade your plan at any time. Changes will take effect at the next billing cycle.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Do drivers need to pay for subscriptions?</h3>
              <p className="text-slate-600">No, drivers can browse and apply for loads completely free. Only cargo owners need subscriptions to post loads.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">What payment methods do you accept?</h3>
              <p className="text-slate-600">We accept M-Pesa, bank transfers, and credit/debit cards for your convenience.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2">Is there a money-back guarantee?</h3>
              <p className="text-slate-600">Yes, we offer a 30-day money-back guarantee if you're not satisfied with our service.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
                <User size={32} className="text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Login Required</h3>
              <p className="text-slate-600 mb-6">
                Please log in or create an account to subscribe to a premium plan and start managing your cargo loads efficiently.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <a
                  href="/login"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold text-center hover:from-primary-700 hover:to-primary-800 transition-all"
                >
                  Login
                </a>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                Don't have an account? <a href="/register" className="text-primary-600 font-semibold hover:underline">Sign up here</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-800">Subscribe to {selectedPlan.name}</h3>
                <button 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setShowPaymentInstructions(false);
                    setPaymentCode('');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - User Info & Plan Details */}
                <div>
                  {/* User Information */}
                  <div className="bg-slate-50 rounded-xl p-6 mb-6">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <User size={20} />
                      Account Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-slate-600" />
                        <span className="font-medium">Name:</span>
                        <span>{user?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-slate-600" />
                        <span className="font-medium">Email:</span>
                        <span>{user?.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-slate-600" />
                        <span className="font-medium">Phone:</span>
                        <span>{user?.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building size={16} className="text-slate-600" />
                        <span className="font-medium">User ID:</span>
                        <span className="font-mono text-sm">IC{user?.id?.slice(-6) || 'XXXXXX'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Plan Details */}
                  <div className="bg-primary-50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <selectedPlan.icon size={24} className="text-primary-600" />
                      <div>
                        <h4 className="font-bold text-slate-800">{selectedPlan.name}</h4>
                        <p className="text-primary-600 font-semibold">KES {selectedPlan.price.toLocaleString()}/month</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600">
                      <p className="mb-2">✓ Monthly billing cycle</p>
                      <p className="mb-2">✓ Cancel anytime</p>
                      <p>✓ 30-day money back guarantee</p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Payment Methods & Instructions */}
                <div>
                  {!showPaymentInstructions ? (
                    <>
                      <h4 className="font-bold text-slate-800 mb-4">Select Payment Method</h4>
                      <div className="space-y-3 mb-6">
                        {paymentMethods.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => handlePaymentMethodSelect(method.id)}
                            className="w-full flex items-center space-x-3 p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer text-left transition-colors"
                          >
                            <method.icon size={24} className="text-slate-600" />
                            <div>
                              <div className="font-semibold text-slate-800">{method.name}</div>
                              <div className="text-sm text-slate-600">{method.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => setShowPaymentInstructions(false)}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          ← Back
                        </button>
                        <h4 className="font-bold text-slate-800">Payment Instructions</h4>
                      </div>

                      {selectedPayment === 'mpesa' && (
                        <div className="space-y-4">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <h5 className="font-bold text-green-800 mb-3">M-Pesa Payment Steps:</h5>
                            <ol className="list-decimal list-inside space-y-2 text-green-700 text-sm">
                              {paymentMethods[0].instructions.steps.map((step, idx) => (
                                <li key={idx}>{step.replace('{amount}', selectedPlan.price.toLocaleString())}</li>
                              ))}
                            </ol>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-4">
                            <h5 className="font-bold text-slate-800 mb-3">Payment Details:</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span>Business Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">174379</span>
                                  <button onClick={() => copyToClipboard('174379')} className="text-primary-600 hover:text-primary-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Account Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">IC{user?.id?.slice(-6) || 'XXXXXX'}</span>
                                  <button onClick={() => copyToClipboard(`IC${user?.id?.slice(-6) || 'XXXXXX'}`)} className="text-primary-600 hover:text-primary-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Amount:</span>
                                <span className="font-semibold">KES {selectedPlan.price.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              M-Pesa Transaction Code <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={paymentCode}
                              onChange={(e) => setPaymentCode(e.target.value)}
                              placeholder="e.g., QH12345678"
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              required
                            />
                            <p className="text-xs text-slate-600 mt-1">
                              Enter the M-Pesa confirmation code you received after payment
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedPayment === 'bank_transfer' && (
                        <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h5 className="font-bold text-blue-800 mb-3">Bank Transfer Details:</h5>
                            <div className="space-y-2 text-blue-700 text-sm">
                              <div className="flex justify-between items-center">
                                <span>Bank Name:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{paymentMethods[1].instructions.bankName}</span>
                                  <button onClick={() => copyToClipboard(paymentMethods[1].instructions.bankName)} className="text-blue-600 hover:text-blue-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Account Name:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{paymentMethods[1].instructions.accountName}</span>
                                  <button onClick={() => copyToClipboard(paymentMethods[1].instructions.accountName)} className="text-blue-600 hover:text-blue-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Account Number:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{paymentMethods[1].instructions.accountNumber}</span>
                                  <button onClick={() => copyToClipboard(paymentMethods[1].instructions.accountNumber)} className="text-blue-600 hover:text-blue-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Branch:</span>
                                <span className="font-semibold">{paymentMethods[1].instructions.branch}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>SWIFT Code:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{paymentMethods[1].instructions.swiftCode}</span>
                                  <button onClick={() => copyToClipboard(paymentMethods[1].instructions.swiftCode)} className="text-blue-600 hover:text-blue-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Reference:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{paymentMethods[1].instructions.reference}</span>
                                  <button onClick={() => copyToClipboard(paymentMethods[1].instructions.reference)} className="text-blue-600 hover:text-blue-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span>Amount:</span>
                                <span className="font-semibold">KES {selectedPlan.price.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                              <div className="text-yellow-800 text-sm">
                                <p className="font-semibold mb-1">Important Instructions:</p>
                                <ul className="list-disc list-inside space-y-1">
                                  <li>Please use the exact reference number provided</li>
                                  <li>Bank transfers may take 1-3 business days to process</li>
                                  <li>Contact support after completing the transfer</li>
                                  <li>Keep your transfer receipt for verification</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Transfer Reference/Receipt Number
                            </label>
                            <input
                              type="text"
                              value={paymentCode}
                              onChange={(e) => setPaymentCode(e.target.value)}
                              placeholder="Enter your bank transfer reference"
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <p className="text-xs text-slate-600 mt-1">
                              Optional: Provide your transfer reference for faster processing
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedPayment === 'card' && (
                        <div className="space-y-4">
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                            <h5 className="font-bold text-purple-800 mb-3">Credit/Debit Card Payment:</h5>
                            <div className="text-purple-700 text-sm space-y-2">
                              <p>{paymentMethods[2].instructions}</p>
                              <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Phone size={16} className="text-purple-600" />
                                  <span className="font-semibold">Support Number:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-lg">+254 700 000 000</span>
                                  <button onClick={() => copyToClipboard('+254 700 000 000')} className="text-purple-600 hover:text-purple-700">
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-4">
                            <h5 className="font-bold text-slate-800 mb-3">What to provide when calling:</h5>
                            <ul className="text-slate-700 text-sm space-y-1 list-disc list-inside">
                              <li>Your account ID: IC{user?.id?.slice(-6) || 'XXXXXX'}</li>
                              <li>Selected plan: {selectedPlan.name}</li>
                              <li>Amount: KES {selectedPlan.price.toLocaleString()}</li>
                              <li>Your credit/debit card details</li>
                            </ul>
                          </div>

                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                              <Shield size={16} className="text-green-600 mt-0.5" />
                              <div className="text-green-800 text-sm">
                                <p className="font-semibold mb-1">Secure Payment Processing:</p>
                                <p>Your card details are processed securely through our PCI-compliant payment gateway. We never store your card information.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-4 pt-6 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setShowPaymentModal(false);
                            setShowPaymentInstructions(false);
                            setPaymentCode('');
                          }}
                          className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={processSubscription}
                          disabled={subscribing}
                          className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {subscribing ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Processing...
                            </div>
                          ) : (
                            'Complete Subscription'
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <section className="py-16 bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-800 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of cargo owners and drivers who trust Infinite Cargo for their transport needs.
          </p>
          <div className="flex gap-4 justify-center">
            {!isAuthenticated() ? (
              <>
                <a href="/register" className="bg-white text-primary-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-50 transition-colors">
                  Start Free Trial
                </a>
                <a href="/support" className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors">
                  Contact Sales
                </a>
              </>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <p className="text-primary-100 mb-4">
                  {user?.userType === 'cargo_owner' 
                    ? "Ready to upgrade your plan?" 
                    : "Driver account detected - browse loads for free!"
                  }
                </p>
                {user?.userType === 'cargo_owner' && (
                  <button
                    onClick={() => handleSubscribe(plans[1])}
                    className="bg-white text-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;