import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const NotificationAlerts = ({ error, success, setError, setSuccess }) => {
  return (
    <>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          {success}
          <button 
            onClick={() => setSuccess('')} 
            className="ml-auto text-green-500 hover:text-green-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

export default NotificationAlerts;