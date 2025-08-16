import React from 'react';
import { AlertCircle } from 'lucide-react';

const ConfirmationDialog = ({ confirmDialog, setConfirmDialog }) => {
  if (!confirmDialog.show) return null;

  const handleCancel = () => {
    setConfirmDialog({ show: false, message: '', onConfirm: null });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Confirm Action</h3>
          </div>
          <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;