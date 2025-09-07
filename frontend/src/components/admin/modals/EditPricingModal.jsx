import React, { useState, useEffect } from 'react';
import { X, Save, Package, DollarSign, Calendar, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const EditPricingModal = ({ plan, isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    duration: 30,
    description: '',
    features: {
      maxLoads: 0,
      prioritySupport: false,
      advancedAnalytics: false,
      bulkOperations: false,
      apiAccess: false,
      dedicatedManager: false
    }
  });
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (plan && isOpen) {
      setFormData({
        name: plan.name || '',
        price: plan.price || 0,
        duration: plan.duration || 30,
        description: plan.description || '',
        features: {
          maxLoads: plan.features?.maxLoads || 0,
          prioritySupport: plan.features?.prioritySupport || false,
          advancedAnalytics: plan.features?.advancedAnalytics || false,
          bulkOperations: plan.features?.bulkOperations || false,
          apiAccess: plan.features?.apiAccess || false,
          dedicatedManager: plan.features?.dedicatedManager || false
        }
      });
      setErrors({});
      setIsDirty(false);
    }
  }, [plan, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Plan name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Plan name must be at least 2 characters';
    }

    if (formData.price < 0) {
      newErrors.price = 'Price cannot be negative';
    } else if (formData.price > 100000) {
      newErrors.price = 'Price cannot exceed KES 100,000';
    }

    if (formData.duration < 1) {
      newErrors.duration = 'Duration must be at least 1 day';
    } else if (formData.duration > 365) {
      newErrors.duration = 'Duration cannot exceed 365 days';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (formData.features.maxLoads < -1) {
      newErrors.maxLoads = 'Max loads cannot be less than -1 (use -1 for unlimited)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFeatureChange = (feature, value) => {
    setFormData(prev => ({
      ...prev,
      features: { ...prev.features, [feature]: value }
    }));
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(plan.id, formData);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Pricing Plan</h2>
              <p className="text-sm text-gray-500">Update subscription plan details and features</p>
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
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Pro Plan"
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (KES)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.price ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                  min="0"
                  max="100000"
                  step="1"
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Preview: {formatCurrency(formData.price)}
              </p>
              {errors.price && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.price}
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (Days)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 30)}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.duration ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                  }`}
                  placeholder="30"
                  min="1"
                  max="365"
                  disabled={loading}
                />
              </div>
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.duration}
                </p>
              )}
            </div>

            {/* Max Loads */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Loads
              </label>
              <input
                type="number"
                value={formData.features.maxLoads}
                onChange={(e) => handleFeatureChange('maxLoads', parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  errors.maxLoads ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="0"
                min="-1"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Use -1 for unlimited loads
              </p>
              {errors.maxLoads && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.maxLoads}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${
                  errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe what this plan offers..."
                rows={3}
                disabled={loading}
              />
            </div>
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Features */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries({
                prioritySupport: 'Priority Support',
                advancedAnalytics: 'Advanced Analytics',
                bulkOperations: 'Bulk Operations',
                apiAccess: 'API Access',
                dedicatedManager: 'Dedicated Manager'
              }).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.features[key]}
                    onChange={(e) => handleFeatureChange(key, e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    disabled={loading}
                  />
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
            <div className="text-sm text-gray-600">
              <p><strong>{formData.name || 'Plan Name'}</strong></p>
              <p>{formatCurrency(formData.price)}/{formData.duration} days</p>
              <p>{formData.description || 'Description'}</p>
              <p>Max Loads: {formData.features.maxLoads === -1 ? 'Unlimited' : formData.features.maxLoads}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isDirty}
              className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPricingModal;