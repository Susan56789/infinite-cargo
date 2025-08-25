import React from 'react';
import { X, Save, Loader2 } from 'lucide-react';

const StatusUpdateModal = ({ 
  show, 
  onClose, 
  onUpdate, 
  statusUpdateData, 
  setStatusUpdateData, 
  getStatusColor, 
  getStatusIcon, 
  getStatusLabel, 
  loading 
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Update Load Status</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Change status to:
          </p>
          <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(statusUpdateData.newStatus)}`}>
            {getStatusIcon(statusUpdateData.newStatus)}
            {getStatusLabel(statusUpdateData.newStatus)}
          </span>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason (optional)
          </label>
          <textarea
            value={statusUpdateData.reason}
            onChange={(e) => setStatusUpdateData(prev => ({ ...prev, reason: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Enter reason for status change..."
          />
        </div>

        <div className="flex items-center justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onUpdate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Update Status
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusUpdateModal;