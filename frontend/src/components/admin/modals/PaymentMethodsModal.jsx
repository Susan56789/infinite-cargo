import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, Smartphone, Building, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';

const PaymentMethodsModal = ({ methods, isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({});
  const [showSensitiveData, setShowSensitiveData] = useState({});
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const defaultMethods = {
    mpesa: {
      enabled: false,
      displayName: 'M-Pesa',
      description: 'Mobile money payment via M-Pesa',
      details: {
        businessNumber: '',
        accountName: '',
        paybillNumber: ''
      },
      minAmount: 1,
      maxAmount: 300000,
      processingFee: 0,
      displayOrder: 1
    },
    bank: {
      enabled: false,
      displayName: 'Bank Transfer',
      description: 'Direct bank transfer',
      details: {
        bankName: '',
        accountNumber: '',
        accountName: '',
        branchCode: ''
      },
      minAmount: 1,
      maxAmount: 1000000,
      processingFee: 0,
      displayOrder: 2
    },
    card: {
      enabled: false,
      displayName: 'Credit/Debit Card',
      description: 'Pay using your card',
      details: {
        merchantId: '',
        publicKey: '',
        processingPartner: ''
      },
      minAmount: 1,
      maxAmount: 500000,
      processingFee: 2.5,
      displayOrder: 3
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initialData = {};
      Object.keys(defaultMethods).forEach(methodId => {
        initialData[methodId] = {
          ...defaultMethods[methodId],
          ...(methods[methodId] || {})
        };
      });
      setFormData(initialData);
      setErrors({});
      setIsDirty(false);
    }
  }, [isOpen, methods]);

  const validateForm = () => {
    const newErrors = {};

    Object.entries(formData).forEach(([methodId, method]) => {
      if (method.enabled) {
        if (!method.displayName?.trim()) {
          newErrors[`${methodId}_displayName`] = 'Display name is required';
        }

        if (!method.description?.trim()) {
          newErrors[`${methodId}_description`] = 'Description is required';
        }

        if (method.minAmount >= method.maxAmount) {
          newErrors[`${methodId}_amounts`] = 'Minimum amount must be less than maximum amount';
        }

        if (method.processingFee < 0 || method.processingFee > 10) {
          newErrors[`${methodId}_fee`] = 'Processing fee must be between 0% and 10%';
        }

        // Method-specific validations
        if (methodId === 'mpesa') {
          if (!method.details?.businessNumber?.trim()) {
            newErrors[`${methodId}_businessNumber`] = 'Business number is required';
          }
          if (!method.details?.accountName?.trim()) {
            newErrors[`${methodId}_accountName`] = 'Account name is required';
          }
        }

        if (methodId === 'bank') {
          if (!method.details?.bankName?.trim()) {
            newErrors[`${methodId}_bankName`] = 'Bank name is required';
          }
          if (!method.details?.accountNumber?.trim()) {
            newErrors[`${methodId}_accountNumber`] = 'Account number is required';
          }
          if (!method.details?.accountName?.trim()) {
            newErrors[`${methodId}_accountName`] = 'Account name is required';
          }
        }

        if (methodId === 'card') {
          if (!method.details?.merchantId?.trim()) {
            newErrors[`${methodId}_merchantId`] = 'Merchant ID is required';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMethodChange = (methodId, field, value) => {
    setFormData(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        [field]: value
      }
    }));
    setIsDirty(true);
    
    // Clear related errors
    const errorKey = `${methodId}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleDetailsChange = (methodId, detailKey, value) => {
    setFormData(prev => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        details: {
          ...prev[methodId].details,
          [detailKey]: value
        }
      }
    }));
    setIsDirty(true);
    
    // Clear related errors
    const errorKey = `${methodId}_${detailKey}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const toggleSensitiveData = (methodId) => {
    setShowSensitiveData(prev => ({
      ...prev,
      [methodId]: !prev[methodId]
    }));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleClose = () => {
    if (isDirty && !loading) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const getMethodIcon = (methodId) => {
    switch (methodId) {
      case 'mpesa':
        return <Smartphone className="w-5 h-5 text-green-600" />;
      case 'bank':
        return <Building className="w-5 h-5 text-blue-600" />;
      case 'card':
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      default:
        return <CreditCard className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
              <p className="text-sm text-gray-500">Configure available payment options for subscriptions</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Information Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Payment Method Configuration</p>
                <p>Configure which payment methods are available to users when subscribing to plans. Disabled methods will not be shown to users during checkout.</p>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-6">
            {Object.entries(formData).map(([methodId, method]) => (
              <div key={methodId} className={`border rounded-xl p-6 transition-all ${
                method.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                {/* Method Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      method.enabled ? 'bg-white' : 'bg-gray-200'
                    }`}>
                      {getMethodIcon(methodId)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{method.displayName}</h3>
                      <p className="text-sm text-gray-600">{method.description}</p>
                    </div>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={method.enabled}
                      onChange={(e) => handleMethodChange(methodId, 'enabled', e.target.checked)}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      disabled={loading}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      {method.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {method.enabled && (
                  <div className="space-y-4">
                    {/* Basic Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={method.displayName}
                          onChange={(e) => handleMethodChange(methodId, 'displayName', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            errors[`${methodId}_displayName`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          disabled={loading}
                        />
                        {errors[`${methodId}_displayName`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_displayName`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Processing Fee (%)
                        </label>
                        <input
                          type="number"
                          value={method.processingFee}
                          onChange={(e) => handleMethodChange(methodId, 'processingFee', parseFloat(e.target.value) || 0)}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            errors[`${methodId}_fee`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          min="0"
                          max="10"
                          step="0.1"
                          disabled={loading}
                        />
                        {errors[`${methodId}_fee`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_fee`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Minimum Amount
                        </label>
                        <input
                          type="number"
                          value={method.minAmount}
                          onChange={(e) => handleMethodChange(methodId, 'minAmount', parseFloat(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          min="1"
                          disabled={loading}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {formatCurrency(method.minAmount)}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Maximum Amount
                        </label>
                        <input
                          type="number"
                          value={method.maxAmount}
                          onChange={(e) => handleMethodChange(methodId, 'maxAmount', parseFloat(e.target.value) || 1000000)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          min="1"
                          disabled={loading}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {formatCurrency(method.maxAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={method.description}
                        onChange={(e) => handleMethodChange(methodId, 'description', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          errors[`${methodId}_description`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Brief description shown to users"
                        disabled={loading}
                      />
                      {errors[`${methodId}_description`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_description`]}</p>
                      )}
                    </div>

                    {/* Method-Specific Details */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Payment Details</h4>
                        <button
                          type="button"
                          onClick={() => toggleSensitiveData(methodId)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showSensitiveData[methodId] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {methodId === 'mpesa' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Business Number
                              </label>
                              <input
                                type={showSensitiveData[methodId] ? 'text' : 'password'}
                                value={method.details?.businessNumber || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'businessNumber', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_businessNumber`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_businessNumber`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_businessNumber`]}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Account Name
                              </label>
                              <input
                                type="text"
                                value={method.details?.accountName || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'accountName', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_accountName`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_accountName`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_accountName`]}</p>
                              )}
                            </div>
                          </>
                        )}

                        {methodId === 'bank' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bank Name
                              </label>
                              <input
                                type="text"
                                value={method.details?.bankName || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'bankName', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_bankName`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_bankName`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_bankName`]}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Account Number
                              </label>
                              <input
                                type={showSensitiveData[methodId] ? 'text' : 'password'}
                                value={method.details?.accountNumber || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'accountNumber', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_accountNumber`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_accountNumber`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_accountNumber`]}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Account Name
                              </label>
                              <input
                                type="text"
                                value={method.details?.accountName || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'accountName', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_accountName`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_accountName`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_accountName`]}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Branch Code (Optional)
                              </label>
                              <input
                                type="text"
                                value={method.details?.branchCode || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'branchCode', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                disabled={loading}
                              />
                            </div>
                          </>
                        )}

                        {methodId === 'card' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Merchant ID
                              </label>
                              <input
                                type={showSensitiveData[methodId] ? 'text' : 'password'}
                                value={method.details?.merchantId || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'merchantId', e.target.value)}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors[`${methodId}_merchantId`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                                disabled={loading}
                              />
                              {errors[`${methodId}_merchantId`] && (
                                <p className="mt-1 text-sm text-red-600">{errors[`${methodId}_merchantId`]}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Public Key
                              </label>
                              <input
                                type={showSensitiveData[methodId] ? 'text' : 'password'}
                                value={method.details?.publicKey || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'publicKey', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                disabled={loading}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Processing Partner
                              </label>
                              <input
                                type="text"
                                value={method.details?.processingPartner || ''}
                                onChange={(e) => handleDetailsChange(methodId, 'processingPartner', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="e.g., Stripe, Flutterwave"
                                disabled={loading}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !isDirty}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : 'Save Payment Methods'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsModal;