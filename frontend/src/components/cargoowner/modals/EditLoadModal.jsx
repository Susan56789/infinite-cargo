import React from 'react';
import { X, Save, Loader2 } from 'lucide-react';

const EditLoadModal = ({
  show,
  onClose,
  onSubmit,
  editFormData,
  onFormChange,
  editFormErrors,
  isSubmitting,
  cargoTypeOptions,
  vehicleTypeOptions
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Edit Load</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Load Title *
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => onFormChange('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter a descriptive title for your load"
                />
                {editFormErrors.title && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargo Type *
                </label>
                <select
                  value={editFormData.cargoType}
                  onChange={(e) => onFormChange('cargoType', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.cargoType ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select cargo type</option>
                  {cargoTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {editFormErrors.cargoType && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.cargoType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editFormData.weight}
                  onChange={(e) => onFormChange('weight', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.weight ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.0"
                />
                {editFormErrors.weight && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.weight}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => onFormChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Provide additional details about your cargo"
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Location Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Location *
                </label>
                <input
                  type="text"
                  value={editFormData.pickupLocation}
                  onChange={(e) => onFormChange('pickupLocation', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.pickupLocation ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter pickup address or location"
                />
                {editFormErrors.pickupLocation && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.pickupLocation}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Location *
                </label>
                <input
                  type="text"
                  value={editFormData.deliveryLocation}
                  onChange={(e) => onFormChange('deliveryLocation', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.deliveryLocation ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter delivery address or location"
                />
                {editFormErrors.deliveryLocation && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.deliveryLocation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Schedule Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.pickupDate}
                  onChange={(e) => onFormChange('pickupDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.pickupDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                  min={new Date().toISOString().slice(0, 16)}
                />
                {editFormErrors.pickupDate && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.pickupDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.deliveryDate}
                  onChange={(e) => onFormChange('deliveryDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.deliveryDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                  min={editFormData.pickupDate || new Date().toISOString().slice(0, 16)}
                />
                {editFormErrors.deliveryDate && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.deliveryDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Budget and Vehicle */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Budget & Vehicle Requirements</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget (KES) *
                </label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  value={editFormData.budget}
                  onChange={(e) => onFormChange('budget', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.budget ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {editFormErrors.budget && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.budget}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type *
                </label>
                <select
                  value={editFormData.vehicleType}
                  onChange={(e) => onFormChange('vehicleType', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    editFormErrors.vehicleType ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {editFormErrors.vehicleType && (
                  <p className="text-red-600 text-sm mt-1">{editFormErrors.vehicleType}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requirements
                </label>
                <textarea
                  value={editFormData.specialRequirements}
                  onChange={(e) => onFormChange('specialRequirements', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Any special handling requirements or instructions"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editFormData.isUrgent}
                    onChange={(e) => onFormChange('isUrgent', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Mark as urgent</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Update Load
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLoadModal;