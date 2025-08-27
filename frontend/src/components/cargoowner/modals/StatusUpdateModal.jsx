import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2 } from 'lucide-react';

const StatusUpdateModal = ({
  isOpen,
  onClose,
  onConfirm,
  statusUpdateData,
  setStatusUpdateData,
  statusConfig,
  loading
}) => {
  // Create portal container if it doesn't exist
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Ensure modal container exists
      let modalContainer = document.getElementById('modal-root');
      if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-root';
        modalContainer.style.position = 'fixed';
        modalContainer.style.top = '0';
        modalContainer.style.left = '0';
        modalContainer.style.width = '100%';
        modalContainer.style.height = '100%';
        modalContainer.style.zIndex = '99999';
        modalContainer.style.pointerEvents = 'none';
        document.body.appendChild(modalContainer);
      }
    }

    return () => {
      // Re-enable body scroll
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    return statusConfig[status]?.color || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status) => {
    return statusConfig[status]?.icon || null;
  };

  const getStatusLabel = (status) => {
    return statusConfig[status]?.label || status?.replace(/_/g, ' ').toUpperCase();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !loading) {
      onClose();
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        zIndex: 99999,
        pointerEvents: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Modal Content */}
      <div 
        className="bg-white rounded-lg w-full max-w-md mx-auto shadow-2xl transform transition-all duration-200 scale-100 relative"
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 100000 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            Update Load Status
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Status Preview */}
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Change status to:
            </p>
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(statusUpdateData.newStatus)}`}>
              {getStatusIcon(statusUpdateData.newStatus)}
              {getStatusLabel(statusUpdateData.newStatus)}
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (optional)
            </label>
            <textarea
              value={statusUpdateData.reason || ''}
              onChange={(e) => setStatusUpdateData(prev => ({ 
                ...prev, 
                reason: e.target.value 
              }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm md:text-base"
              placeholder="Enter reason for status change..."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be recorded in the load's status history.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 md:p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !statusUpdateData.newStatus}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed min-w-[140px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Update Status</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document root
  const modalContainer = document.getElementById('modal-root');
  if (!modalContainer) {
    const container = document.createElement('div');
    container.id = 'modal-root';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '99999';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
    return createPortal(modalContent, container);
  }

  return createPortal(modalContent, modalContainer);
};

export default StatusUpdateModal;