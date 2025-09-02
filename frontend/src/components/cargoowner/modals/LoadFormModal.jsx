import React from 'react';
import { Loader2 } from 'lucide-react';
import { getUser } from '../../../utils/auth'; 

const LoadFormModal = ({
  showLoadForm,
  editingLoad,
  loadForm,
  setLoadForm,
  loading,
  onSubmit,
  onClose,
  resetForm,
  user 
}) => {
  if (!showLoadForm) return null;

  

  // Enhanced form submission handler
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Get cargo owner name from multiple sources
    const getCargoOwnerName = () => {
      const sources = [
        user?.cargoOwnerProfile?.companyName,
        user?.companyName,
        user?.profile?.companyName,
        user?.businessProfile?.companyName,
        user?.name,
        user?.fullName,
        user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null,
        user?.email?.split('@')[0]
      ];

      for (const name of sources) {
        if (name && typeof name === 'string' && name.trim().length > 0) {
          return name.trim();
        }
      }
      
      return 'Anonymous Cargo Owner';
    };

    const cargoOwnerName = getCargoOwnerName();
    
    // Create form data with explicit cargo owner information
    const formDataWithOwner = {
      ...loadForm,
      cargoOwnerName: cargoOwnerName,
      postedByName: cargoOwnerName,
      contactPerson: {
        name: user?.name || cargoOwnerName,
        phone: user?.phone || '',
        email: user?.email || ''
      }
    };

    // Call the parent submit handler with enhanced data
    onSubmit(e, formDataWithOwner);
  };

  const displayName = getUser() ? getUser().name || 'Cargo Owner' : 'Guest User';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingLoad ? 'Edit Load' : 'Post New Load'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Display cargo owner info with improved logic */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Posting as:</span> {displayName}
            </p>
            {user?.email && (
              <p className="text-xs text-blue-600 mt-1">
                Contact: {user.email}
                {user?.phone && ` • ${user.phone}`}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Load Title *</label>
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={100}
                  value={loadForm.title}
                  onChange={(e) => setLoadForm({ ...loadForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Electronics shipment from Nairobi to Mombasa"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 5 characters, maximum 100 characters</p>
              </div>

              {/* Pickup + Delivery */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location *</label>
                <input
                  type="text"
                  required
                  value={loadForm.pickupLocation}
                  onChange={(e) => setLoadForm({ ...loadForm, pickupLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Nairobi CBD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location *</label>
                <input
                  type="text"
                  required
                  value={loadForm.deliveryLocation}
                  onChange={(e) => setLoadForm({ ...loadForm, deliveryLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mombasa Port"
                />
              </div>

              {/* Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Address</label>
                <input
                  type="text"
                  value={loadForm.pickupAddress}
                  onChange={(e) => setLoadForm({ ...loadForm, pickupAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Specific pickup address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                <input
                  type="text"
                  value={loadForm.deliveryAddress}
                  onChange={(e) => setLoadForm({ ...loadForm, deliveryAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Specific delivery address"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg) *</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={loadForm.weight}
                  onChange={(e) => setLoadForm({ ...loadForm, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.0"
                />
              </div>

              {/* Cargo Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cargo Type *</label>
                <select
                  required
                  value={loadForm.cargoType}
                  onChange={(e) => setLoadForm({ ...loadForm, cargoType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="electronics">Electronics</option>
                  <option value="furniture">Furniture</option>
                  <option value="construction_materials">Construction Materials</option>
                  <option value="food_beverages">Food & Beverages</option>
                  <option value="automotive_parts">Automotive Parts</option>
                  <option value="textiles">Textiles</option>
                  <option value="chemicals">Chemicals</option>
                  <option value="machinery">Machinery</option>
                  <option value="medical_supplies">Medical Supplies</option>
                  <option value="agricultural_products">Agricultural Products</option>
                  <option value="fragile_items">Fragile Items</option>
                  <option value="hazardous_materials">Hazardous Materials</option>
                  <option value="livestock">Livestock</option>
                  <option value="containers">Containers</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type *</label>
                <select
                  required
                  value={loadForm.vehicleType}
                  onChange={(e) => setLoadForm({ ...loadForm, vehicleType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="pickup">Pickup</option>
                  <option value="van">Van</option>
                  <option value="small_truck">Small Truck</option>
                  <option value="medium_truck">Medium Truck</option>
                  <option value="large_truck">Large Truck</option>
                  <option value="heavy_truck">Heavy Truck</option>
                  <option value="trailer">Trailer</option>
                  <option value="refrigerated_truck">Refrigerated Truck</option>
                  <option value="flatbed">Flatbed</option>
                  <option value="container_truck">Container Truck</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Capacity Required (tons) *</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={loadForm.vehicleCapacityRequired}
                  onChange={(e) => setLoadForm({ ...loadForm, vehicleCapacityRequired: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.0"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget (KES) *</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={loadForm.budget}
                  onChange={(e) => setLoadForm({ ...loadForm, budget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10000"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum KES 100</p>
              </div>

              {/* Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Date *</label>
                <input
                  type="datetime-local"
                  required
                  value={loadForm.pickupDate}
                  onChange={(e) => setLoadForm({ ...loadForm, pickupDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().slice(0, 16)} // Prevent past dates
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date *</label>
                <input
                  type="datetime-local"
                  required
                  value={loadForm.deliveryDate}
                  onChange={(e) => setLoadForm({ ...loadForm, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={loadForm.pickupDate || new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  rows="4"
                  required
                  minLength={10}
                  maxLength={1000}
                  value={loadForm.description}
                  onChange={(e) => setLoadForm({ ...loadForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Provide detailed information about the cargo, packaging, handling requirements, and any special considerations. Minimum 10 characters."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {loadForm.description.length}/1000 characters (minimum 10 required)
                </p>
              </div>

              {/* Special Instructions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
                <textarea
                  rows="3"
                  maxLength={1000}
                  value={loadForm.specialInstructions}
                  onChange={(e) => setLoadForm({ ...loadForm, specialInstructions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any special handling requirements, delivery instructions, or additional notes for drivers"
                />
              </div>

              {/* Urgent */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={loadForm.isUrgent}
                    onChange={(e) => setLoadForm({ ...loadForm, isUrgent: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Mark as Urgent</span>
                  <span className="text-xs text-gray-500 ml-2">(Higher visibility in search results)</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingLoad ? 'Update Load' : 'Post Load'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoadFormModal;