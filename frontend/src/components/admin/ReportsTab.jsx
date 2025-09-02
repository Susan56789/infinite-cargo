import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, LineChart, Download, Calendar, AlertCircle } from 'lucide-react';
import { 
  RevenueChart, 
  SubscriptionDistributionChart, 
  UserActivityChart, 
  LoadStatusChart 
} from './DashboardCharts';

// Enhanced Reports/Analytics Tab Component with Real Charts
const ReportsTab = ({ apiCall, showError, showSuccess }) => {
  const [timeRange, setTimeRange] = useState('6months');
  const [exportLoading, setExportLoading] = useState(false);

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
    if (!apiCall) {
      showError?.('Export function not available');
      return;
    }

    try {
      setExportLoading(true);
      const response = await apiCall(`/admin/analytics/charts?timeRange=${timeRange}&export=true`);
      
      if (response.status === 'success') {
        const timestamp = new Date().toISOString().split('T')[0];
        let filename, content, mimeType;

        if (format === 'json') {
          filename = `analytics-report-${timestamp}.json`;
          content = JSON.stringify(response.data, null, 2);
          mimeType = 'application/json';
        } else if (format === 'csv') {
          // Convert revenue data to CSV
          const revenueData = response.data?.revenueData || [];
          const csvContent = [
            'Month,Revenue (KES),Subscriptions,Year',
            ...revenueData.map(item => `${item.month},${item.revenue},${item.subscriptions},${item.year || new Date().getFullYear()}`)
          ].join('\n');
          
          filename = `revenue-report-${timestamp}.csv`;
          content = csvContent;
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
      } else {
        throw new Error('Failed to export analytics data');
      }
    } catch (error) {
      console.error('Export error:', error);
      showError?.(`Failed to export analytics: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <BarChart3 className="w-6 h-6" />
              Analytics & Reports
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
                onClick={() => exportAnalyticsData('json')}
                disabled={exportLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                {exportLoading ? 'Exporting...' : 'Export JSON'}
              </button>
              
              <button
                onClick={() => exportAnalyticsData('csv')}
                disabled={exportLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Revenue Growth"
          icon={LineChart}
          color="green"
          apiCall={apiCall}
          endpoint="/admin/analytics/kpi/revenue"
        />
        <KPICard
          title="User Acquisition"
          icon={BarChart3}
          color="blue"
          apiCall={apiCall}
          endpoint="/admin/analytics/kpi/users"
        />
        <KPICard
          title="Subscription Rate"
          icon={PieChart}
          color="purple"
          apiCall={apiCall}
          endpoint="/admin/analytics/kpi/subscriptions"
        />
        <KPICard
          title="Load Completion"
          icon={BarChart3}
          color="orange"
          apiCall={apiCall}
          endpoint="/admin/analytics/kpi/loads"
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Revenue Chart - Full Width */}
        <RevenueChart 
          apiCall={apiCall} 
          showError={showError}
          timeRange={timeRange}
        />
        
        {/* Two Column Layout for Other Charts */}
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
        <UserActivityChart 
          apiCall={apiCall} 
          showError={showError}
        />
      </div>

      {/* Additional Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Routes */}
        <TopRoutesCard apiCall={apiCall} showError={showError} />
        
        {/* Recent Activity Summary */}
        <ActivitySummaryCard apiCall={apiCall} showError={showError} />
      </div>
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, icon: Icon, color, apiCall, endpoint }) => {
  const [data, setData] = useState({ value: 0, change: 0, trend: 'neutral' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      if (!apiCall) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiCall(endpoint);
        if (response.status === 'success') {
          setData(response.data || { value: 0, change: 0, trend: 'neutral' });
        }
      } catch (error) {
        console.error(`KPI fetch error for ${title}:`, error);
        // Set default data on error
        setData({ value: 0, change: 0, trend: 'neutral' });
      } finally {
        setLoading(false);
      }
    };

    fetchKPI();
  }, [apiCall, endpoint, title]);

  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const getTrendColor = (trend) => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500 font-medium">{title}</span>
      </div>
      
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-2xl font-bold text-gray-900">
            {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
          </div>
          <div className={`text-sm ${getTrendColor(data.trend)}`}>
            {data.change > 0 ? '+' : ''}{data.change}% from last period
          </div>
        </div>
      )}
    </div>
  );
};

// Top Routes Card Component
const TopRoutesCard = ({ apiCall, showError }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopRoutes = async () => {
      if (!apiCall) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiCall('/admin/analytics/top-routes');
        if (response.status === 'success') {
          setRoutes(response.data || []);
        }
      } catch (error) {
        console.error('Top routes fetch error:', error);
        showError?.('Failed to load top routes data');
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopRoutes();
  }, [apiCall, showError]);

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

// Activity Summary Card Component
const ActivitySummaryCard = ({ apiCall, showError }) => {
  const [summary, setSummary] = useState({
    todayLogins: 0,
    newRegistrations: 0,
    activeSubscriptions: 0,
    systemHealth: 'good'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!apiCall) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiCall('/admin/analytics/activity-summary');
        if (response.status === 'success') {
          setSummary(response.data || summary);
        }
      } catch (error) {
        console.error('Activity summary fetch error:', error);
        showError?.('Failed to load activity summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [apiCall, showError, summary]);

  const getHealthColor = (health) => {
    if (health === 'good') return 'text-green-600 bg-green-100';
    if (health === 'warning') return 'text-yellow-600 bg-yellow-100';
    if (health === 'critical') return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4">Activity Summary</h3>
      
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Today's Logins</span>
            <span className="font-semibold">{summary.todayLogins.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-700">New Registrations</span>
            <span className="font-semibold">{summary.newRegistrations.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Active Subscriptions</span>
            <span className="font-semibold">{summary.activeSubscriptions.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-gray-700">System Health</span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getHealthColor(summary.systemHealth)}`}>
              {summary.systemHealth.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsTab;