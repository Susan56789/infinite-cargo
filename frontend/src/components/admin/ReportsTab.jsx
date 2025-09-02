import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, AlertCircle, Activity } from 'lucide-react';
import { 
  RevenueChart, 
  SubscriptionDistributionChart, 
  UserActivityChart, 
  LoadStatusChart 
} from './DashboardCharts';

// Streamlined Reports/Analytics Tab Component focused on charts
const ReportsTab = ({ apiCall, showError, showSuccess }) => {
  const [timeRange, setTimeRange] = useState('6months');
  const [exportLoading, setExportLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [topRoutes, setTopRoutes] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch dashboard statistics for export data
  const fetchDashboardStats = async () => {
    if (!apiCall) return;
    
    try {
      setLoading(true);
      const response = await apiCall('/admin/dashboard-stats');
      if (response.status === 'success') {
        setDashboardStats(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Dashboard stats fetch error:', error);
      setError(error.message);
      showError?.(`Failed to load dashboard statistics: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch top routes for additional context
  const fetchTopRoutes = async () => {
    if (!apiCall) return;
    
    try {
      const response = await apiCall('/admin/analytics/top-routes');
      if (response.status === 'success') {
        setTopRoutes(response.data || []);
      }
    } catch (error) {
      console.error('Top routes fetch error:', error);
      setTopRoutes([]);
    }
  };

  // Fetch recent audit logs
  const fetchAuditLogs = async () => {
    if (!apiCall) return;
    
    try {
      const response = await apiCall('/admin/audit-logs?limit=5');
      if (response.status === 'success') {
        setAuditLogs(response.data || []);
      }
    } catch (error) {
      console.error('Audit logs fetch error:', error);
      setAuditLogs([]);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (apiCall) {
      fetchDashboardStats();
      fetchTopRoutes();
      fetchAuditLogs();
    }
  }, [apiCall]);

  // Show error message if apiCall is not provided
  if (!apiCall) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-red-200">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Reports Unavailable</h3>
            <p className="text-red-600">Unable to load reports. API connection not available.</p>
          </div>
        </div>
      </div>
    );
  }

  // Export analytics data
  const exportAnalyticsData = async (format = 'json') => {
    try {
      setExportLoading(true);
      
      if (!dashboardStats) {
        throw new Error('No data available to export');
      }

      const timestamp = new Date().toISOString().split('T')[0];
      let filename, content, mimeType;

      const exportData = {
        exportedAt: new Date().toISOString(),
        timeRange: timeRange,
        dashboardStats: dashboardStats,
        topRoutes: topRoutes,
        auditLogs: auditLogs
      };

      if (format === 'json') {
        filename = `analytics-report-${timestamp}.json`;
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
      } else if (format === 'csv') {
        filename = `analytics-report-${timestamp}.csv`;
        content = 'Metric,Value\n';
        content += `Export Date,${timestamp}\n`;
        content += `Time Range,${timeRange}\n`;
        content += `Total Users,${dashboardStats.users?.total || 0}\n`;
        content += `Active Users,${dashboardStats.users?.active || 0}\n`;
        content += `Total Drivers,${dashboardStats.users?.drivers?.total || 0}\n`;
        content += `Total Cargo Owners,${dashboardStats.users?.cargoOwners?.total || 0}\n`;
        content += `Total Loads,${dashboardStats.loads?.total || 0}\n`;
        content += `Active Loads,${dashboardStats.loads?.active || 0}\n`;
        content += `Completed Loads,${dashboardStats.loads?.completed || 0}\n`;
        content += `Total Subscriptions,${dashboardStats.subscriptions?.total || 0}\n`;
        content += `Active Subscriptions,${dashboardStats.subscriptions?.active || 0}\n`;
        content += `Monthly Revenue,${dashboardStats.revenue?.monthly || 0}\n`;
        content += `Total Revenue,${dashboardStats.revenue?.total || 0}\n`;
        mimeType = 'text/csv';
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showSuccess?.(`Analytics report exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      showError?.(`Failed to export analytics: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchTopRoutes(),
      fetchAuditLogs()
    ]);
    setLoading(false);
    showSuccess?.('Analytics data refreshed successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <BarChart3 className="w-6 h-6" />
              Analytics Dashboard
            </h2>
            <p className="text-gray-600">Comprehensive insights into your platform performance</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="30days">Last 30 Days</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="1year">Last Year</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={loading}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
              >
                <Activity className="w-4 h-4" />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <button
                onClick={() => exportAnalyticsData('json')}
                disabled={exportLoading || !dashboardStats}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                {exportLoading ? 'Exporting...' : 'Export JSON'}
              </button>
              
              <button
                onClick={() => exportAnalyticsData('csv')}
                disabled={exportLoading || !dashboardStats}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">Error loading analytics data: {error}</span>
          </div>
        </div>
      )}

      {/* Main Charts Grid - Primary Focus */}
      <div className="grid grid-cols-1 gap-6">
        {/* Revenue Chart - Full Width */}
        <div className="xl:col-span-2">
          <RevenueChart 
            apiCall={apiCall} 
            showError={showError}
            timeRange={timeRange}
          />
        </div>
        
        {/* Distribution Charts - Side by Side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SubscriptionDistributionChart 
            apiCall={apiCall} 
            showError={showError}
          />
          
          <LoadStatusChart 
            apiCall={apiCall} 
            showError={showError}
          />
        </div>
        
        {/* User Activity Chart - Full Width */}
        <div className="xl:col-span-2">
          <UserActivityChart 
            apiCall={apiCall} 
            showError={showError}
          />
        </div>
      </div>

      {/* Additional Context Information - Minimal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Routes */}
        <TopRoutesCard routes={topRoutes} loading={loading} />
        
        {/* Recent System Activity */}
        <SystemActivityCard auditLogs={auditLogs} loading={loading} />
      </div>
    </div>
  );
};

// Top Routes Card Component - Simplified
const TopRoutesCard = ({ routes, loading }) => {
  return (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">Top Performing Routes</h3>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : routes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No route data available</p>
      ) : (
        <div className="space-y-4">
          {routes.slice(0, 5).map((route, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-sm">
                  {route.origin} → {route.destination}
                </div>
                <div className="text-xs text-gray-500">
                  {route.loads} loads • Avg: KES {route.averagePrice?.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-green-600">
                  KES {route.totalRevenue?.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Total Revenue</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// System Activity Card Component - Simplified
const SystemActivityCard = ({ auditLogs, loading }) => {
  if (loading) {
    return (
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Recent System Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Recent System Activity</h3>
        <p className="text-gray-500 text-center py-8">No recent activity logs</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">Recent System Activity</h3>
      <div className="space-y-3">
        {auditLogs.map((log, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-sm">{log.action}</div>
              <div className="text-xs text-gray-500">
                {log.adminName || 'System'} - {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {log.entityType}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsTab;