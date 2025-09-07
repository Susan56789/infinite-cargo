import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, User, Shield, ExternalLink } from 'lucide-react';

const DeleteAdminModal = ({ admin, isOpen, onClose, onSubmit, loading }) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const requiredConfirmText = 'DELETE';
  const isConfirmed = confirmText === requiredConfirmText;

  const handleSubmit = async () => {
    if (!isConfirmed) {
      setError('Please type DELETE to confirm');
      return;
    }

    try {
      await onSubmit();
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete admin. Please try again.');
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setError('');
    onClose();
  };

  if (!isOpen || !admin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Delete Admin</h2>
              <p className="text-sm text-gray-500">Permanently remove admin account</p>
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
        <div className="p-6 space-y-4">
          {/* Admin Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{admin.name}</h3>
                <p className="text-sm text-gray-600">{admin.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-500 capitalize">
                    {admin.role?.replace('_', ' ')} • {admin.isActive ? 'Active' : 'Suspended'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-red-800">Permanent Action Warning</p>
                <p className="mt-1 text-red-700">
                  This action cannot be undone. The admin account will be permanently deleted along with:
                </p>
                <ul className="mt-2 text-red-700 space-y-1">
                  <li>• All account data and login credentials</li>
                  <li>• Admin permissions and role assignments</li>
                  <li>• Activity history and audit logs</li>
                  <li>• Any associated administrative records</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Additional Warnings */}
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Consider suspension instead:</strong> If this is temporary, consider suspending the account rather than deleting it.
              </p>
            </div>

            {admin.role === 'super_admin' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800">
                  <strong>Super Admin Notice:</strong> Ensure at least one other Super Admin exists before deleting this account.
                </p>
              </div>
            )}
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold text-red-600">{requiredConfirmText}</span> to confirm deletion
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
              }`}
              placeholder="Type DELETE here"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              This confirmation is required to prevent accidental deletions.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !isConfirmed}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {loading ? 'Deleting...' : 'Delete Admin'}
            </button>
          </div>

          {/* Additional Resources */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Need help with admin management? 
              <button className="text-blue-600 hover:text-blue-700 ml-1 inline-flex items-center gap-1">
                View Documentation
                <ExternalLink className="w-3 h-3" />
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAdminModal;