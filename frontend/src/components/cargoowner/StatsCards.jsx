import React from 'react';
import { Package, Activity, CheckCircle, TrendingUp } from 'lucide-react';

const StatsCards = ({ stats, loads }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Loads</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalLoads || loads.length}</p>
          </div>
          <Package className="h-8 w-8 text-blue-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Loads</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.activeLoads || loads.filter(load => ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'].includes(load.status)).length}
            </p>
          </div>
          <Activity className="h-8 w-8 text-yellow-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.completedLoads || loads.filter(load => load.status === 'delivered').length}
            </p>
          </div>
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Bids</p>
            <p className="text-2xl font-bold text-gray-900">
              {loads.reduce((acc, load) => acc + (load.bidCount || 0), 0)}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-purple-600" />
        </div>
      </div>
    </div>
  );
};

export default StatsCards;