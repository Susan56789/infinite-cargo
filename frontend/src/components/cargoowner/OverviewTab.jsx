import React from 'react';
import { Plus, Users, Crown, BarChart3, ArrowRight } from 'lucide-react';

const OverviewTab = ({ 
  loads, 
  canPostLoads, 
  getStatusColor, 
  formatDate, 
  onPostLoad, 
  onSetActiveTab, 
  setError 
}) => {
  const handlePostLoadClick = () => {
    if (!canPostLoads()) {
      setError('You have reached your monthly load limit. Please upgrade your plan.');
      return;
    }
    onPostLoad();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {loads.slice(0, 5).map(load => (
              <div key={load._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    load.status === 'posted' ? 'bg-blue-500' :
                    load.status === 'driver_assigned' ? 'bg-green-500' :
                    'bg-gray-400'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">{load.title}</p>
                    <p className="text-sm text-gray-500">
                      {load.pickupLocation} → {load.deliveryLocation}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(load.status)}`}>
                  {load.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {loads.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={handlePostLoadClick}
              disabled={!canPostLoads()}
              className="w-full p-4 text-left bg-blue-50 hover:bg-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed rounded-lg border border-blue-200 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Post New Load</p>
                    <p className="text-sm text-blue-600">Create a new cargo shipment request</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => onSetActiveTab('bids')}
              className="w-full p-4 text-left bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Review Bids</p>
                    <p className="text-sm text-green-600">Check and respond to driver bids</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-green-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => onSetActiveTab('subscription')}
              className="w-full p-4 text-left bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">Manage Subscription</p>
                    <p className="text-sm text-purple-600">View and upgrade your plan</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-purple-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button
              onClick={() => onSetActiveTab('analytics')}
              className="w-full p-4 text-left bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">View Analytics</p>
                    <p className="text-sm text-orange-600">Analyze your shipping performance</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-orange-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;