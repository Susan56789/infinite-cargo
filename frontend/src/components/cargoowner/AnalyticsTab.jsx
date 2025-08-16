import React from 'react';

const AnalyticsTab = ({ loads, formatCurrency }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Analytics Overview</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Load Performance</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium">
                {loads.length > 0 ? Math.round((loads.filter(load => load.status === 'delivered').length / loads.length) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg. Bids per Load:</span>
              <span className="font-medium">
                {loads.length > 0 ? Math.round(loads.reduce((acc, load) => acc + (load.bidCount || 0), 0) / loads.length) : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Cost Analysis</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Spent:</span>
              <span className="font-medium">
                {formatCurrency(loads.filter(load => load.status === 'delivered').reduce((acc, load) => acc + (load.budget || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg. Cost per Load:</span>
              <span className="font-medium">
                {loads.filter(load => load.status === 'delivered').length > 0 ? 
                  formatCurrency(loads.filter(load => load.status === 'delivered').reduce((acc, load) => acc + (load.budget || 0), 0) / loads.filter(load => load.status === 'delivered').length) : 
                  formatCurrency(0)
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Time Metrics</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Loads This Month:</span>
              <span className="font-medium">
                {loads.filter(load => {
                  const loadDate = new Date(load.createdAt);
                  const now = new Date();
                  return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
                }).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Active Loads:</span>
              <span className="font-medium">
                {loads.filter(load => ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'].includes(load.status)).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-4">Load Status Distribution</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {[
            { status: 'posted', label: 'Posted', color: 'bg-blue-500' },
            { status: 'receiving_bids', label: 'Receiving Bids', color: 'bg-yellow-500' },
            { status: 'driver_assigned', label: 'Driver Assigned', color: 'bg-green-500' },
            { status: 'in_transit', label: 'In Transit', color: 'bg-purple-500' },
            { status: 'delivered', label: 'Delivered', color: 'bg-green-600' },
            { status: 'not_available', label: 'Not Available', color: 'bg-gray-500' },
            { status: 'cancelled', label: 'Cancelled', color: 'bg-red-500' }
          ].map(({ status, label, color }) => {
            const count = loads.filter(load => load.status === status).length;
            return (
              <div key={status} className="text-center">
                <div className={`w-8 h-8 ${color} rounded-full mx-auto mb-2 flex items-center justify-center text-white text-sm font-bold`}>
                  {count}
                </div>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;