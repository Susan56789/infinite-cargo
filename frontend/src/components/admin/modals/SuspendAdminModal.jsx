import React, { useState } from 'react';
import { X, AlertTriangle, Lock, Unlock } from 'lucide-react';

const SuspendAdminModal = ({ admin, isOpen, onClose, onSubmit, loading }) => {
  const [reason, setReason] = useState('');

  if (!isOpen || !admin) return null;

  const isCurrentlyActive = admin.isActive;
  const actionTitle = isCurrentlyActive ? 'Suspend Admin' : 'Activate Admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate reason for suspension
    if (isCurrentlyActive && !reason.trim()) {
      return;
    }

    try {
      await onSubmit({
        isActive: !isCurrentlyActive, // Toggle the current status
        reason: reason.trim()
      });
    } catch (error) {
      console.error('Error in suspend modal:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {isCurrentlyActive ? (
                <div className="p-2 bg-red-100 rounded-lg">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
              ) : (
                <div className="p-2 bg-green-100 rounded-lg">
                  <Unlock className="w-5 h-5 text-green-600" />
                </div>
              )}
              <h2 className="text-xl font-semibold text-gray-900">{actionTitle}</h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning */}
          <div className={`p-4 rounded-lg mb-6 ${
            isCurrentlyActive 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                isCurrentlyActive ? 'text-red-600' : 'text-green-600'
              }`} />
              <div>
                <h3 className={`font-medium ${
                  isCurrentlyActive ? 'text-red-800' : 'text-green-800'
                } mb-1`}>
                  {isCurrentlyActive 
                    ? 'Are you sure you want to suspend this admin?' 
                    : 'Are you sure you want to activate this admin?'
                  }
                </h3>
                <p className={`text-sm ${
                  isCurrentlyActive ? 'text-red-700' : 'text-green-700'
                }`}>
                  {isCurrentlyActive 
                    ? 'This admin will lose access to the system and cannot perform any administrative actions.'
                    : 'This admin will regain full access to the system and can perform administrative actions.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Admin Info */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Admin Details</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div><span className="font-medium">Name:</span> {admin.name || 'Unknown'}</div>
              <div><span className="font-medium">Email:</span> {admin.email || 'No email'}</div>
              <div><span className="font-medium">Role:</span> {admin.role || 'admin'}</div>
              <div><span className="font-medium">Current Status:</span> {
                isCurrentlyActive ? 'Active' : 'Suspended'
              }</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason field - only required for suspension */}
            {isCurrentlyActive && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Suspension *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for suspending this admin..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            {!isCurrentlyActive && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activation Note (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Optional note about the activation..."
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (isCurrentlyActive && !reason.trim())}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
                  isCurrentlyActive 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    {isCurrentlyActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    {isCurrentlyActive ? 'Suspend Admin' : 'Activate Admin'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuspendAdminModal;