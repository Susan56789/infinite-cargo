import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, Package, Activity,
  Download, RefreshCw, AlertCircle, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';


// Utility function for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount || 0);
};

// Custom colors for charts
const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  tertiary: '#F59E0B',
  quaternary: '#EF4444',
  accent: '#8B5CF6'
};

const SUBSCRIPTION_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Loading spinner component
const ChartLoader = ({ message = "Loading chart data..." }) => (
  <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  </div>
);

// Error display component
const ChartError = ({ error, onRetry }) => (
  <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
    <div className="text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
      <p className="text-red-600 text-sm mb-3">{error}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-blue-600 hover:text-blue-800 text-sm underline"
        >
          Try Again
        </button>
      )}
    </div>
  </div>
);

// Revenue trends chart component
const RevenueChart = ({ apiCall, showError, timeRange = '6months' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTimeRange, setCurrentTimeRange] = useState(timeRange);

  const fetchRevenueData = useCallback(async () => {
    if (!apiCall) {
      setError('API function not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await apiCall(`/admin/analytics/charts?timeRange=${currentTimeRange}`);
      
      if (response.status === 'success' && response.data) {
        setData(response.data.revenueData || []);
      } else {
        throw new Error('Failed to load revenue data');
      }
    } catch (err) {
      console.error('Revenue chart error:', err);
      setError(err.message || 'Failed to load revenue data');
      showError?.('Failed to load revenue chart data');
    } finally {
      setLoading(false);
    }
  }, [apiCall, currentTimeRange, showError]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const handleTimeRangeChange = (newRange) => {
    setCurrentTimeRange(newRange);
  };

  const exportData = () => {
    if (data.length === 0) return;
    
    const csvContent = [
      'Month,Revenue (KES),Subscriptions',
      ...data.map(item => `${item.month},${item.revenue},${item.subscriptions}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-data-${currentTimeRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Revenue Trends
        </h3>
        <div className="flex items-center gap-2">
          <select 
            value={currentTimeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="30days">Last 30 Days</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          <button 
            onClick={exportData}
            disabled={loading || data.length === 0}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Export Data"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={fetchRevenueData}
            disabled={loading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {loading ? (
        <ChartLoader message="Loading revenue data..." />
      ) : error ? (
        <ChartError error={error} onRetry={fetchRevenueData} />
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No revenue data available for the selected period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                name === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                name === 'revenue' ? 'Revenue' : 'New Subscriptions'
              ]}
              labelFormatter={(label) => `Month: ${label}`}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke={CHART_COLORS.primary}
              fill={CHART_COLORS.primary}
              fillOpacity={0.3}
              name="Revenue (KES)"
            />
            <Area 
              type="monotone" 
              dataKey="subscriptions" 
              stroke={CHART_COLORS.secondary}
              fill={CHART_COLORS.secondary}
              fillOpacity={0.3}
              name="New Subscriptions"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// Subscription distribution pie chart
const SubscriptionDistributionChart = ({ apiCall, showError }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({});

  const fetchSubscriptionData = useCallback(async () => {
    if (!apiCall) {
      setError('API function not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await apiCall('/admin/analytics/charts?timeRange=6months');
      
      if (response.status === 'success' && response.data) {
        setData(response.data.subscriptionDistribution || []);
        setSummary(response.data.summary || {});
      } else {
        throw new Error('Failed to load subscription data');
      }
    } catch (err) {
      console.error('Subscription chart error:', err);
      setError(err.message || 'Failed to load subscription data');
      showError?.('Failed to load subscription distribution data');
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0.05 ? (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-blue-600" />
          Revenue Distribution
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">By Subscription Plan</span>
          <button 
            onClick={fetchSubscriptionData}
            disabled={loading}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {loading ? (
        <ChartLoader message="Loading subscription data..." />
      ) : error ? (
        <ChartError error={error} onRetry={fetchSubscriptionData} />
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No subscription data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SUBSCRIPTION_COLORS[index % SUBSCRIPTION_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name, props) => [
                  `${value} subscriptions (${props.payload.percentage}%)`,
                  'Count'
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-semibold">{formatCurrency(summary.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Subscriptions:</span>
                  <span className="font-semibold">{(summary.totalSubscriptions || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Plan Breakdown</h4>
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: SUBSCRIPTION_COLORS[index % SUBSCRIPTION_COLORS.length] }}
                  ></div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span>{item.count} ({item.value}%)</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Revenue: {formatCurrency(item.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// User activity bar chart
const UserActivityChart = ({ apiCall, showError }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchActivityData = useCallback(async () => {
    if (!apiCall) {
      setError('API function not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await apiCall('/admin/analytics/charts');
      
      if (response.status === 'success' && response.data) {
        setData(response.data.userActivityData || []);
      } else {
        throw new Error('Failed to load activity data');
      }
    } catch (err) {
      console.error('Activity chart error:', err);
      setError(err.message || 'Failed to load activity data');
      showError?.('Failed to load user activity data');
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          Daily User Activity (Last 7 Days)
        </h3>
        <button 
          onClick={fetchActivityData}
          disabled={loading}
          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {loading ? (
        <ChartLoader message="Loading activity data..." />
      ) : error ? (
        <ChartError error={error} onRetry={fetchActivityData} />
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No activity data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="drivers" fill={CHART_COLORS.primary} name="Active Drivers" />
            <Bar dataKey="cargoOwners" fill={CHART_COLORS.secondary} name="Active Cargo Owners" />
            <Bar dataKey="loads" fill={CHART_COLORS.tertiary} name="New Loads" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// Load status distribution chart
const LoadStatusChart = ({ apiCall, showError }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLoadData = useCallback(async () => {
    if (!apiCall) {
      setError('API function not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await apiCall('/admin/analytics/charts');
      
      if (response.status === 'success' && response.data) {
        setData(response.data.loadStatusData || []);
      } else {
        throw new Error('Failed to load load status data');
      }
    } catch (err) {
      console.error('Load status chart error:', err);
      setError(err.message || 'Failed to load load status data');
      showError?.('Failed to load load status data');
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  useEffect(() => {
    fetchLoadData();
  }, [fetchLoadData]);

  const getStatusColor = (status) => {
    const colors = {
      active: CHART_COLORS.primary,
      completed: CHART_COLORS.secondary,
      pending: CHART_COLORS.tertiary,
      cancelled: CHART_COLORS.quaternary,
      default: CHART_COLORS.accent
    };
    return colors[status?.toLowerCase()] || colors.default;
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-600" />
          Load Status Distribution
        </h3>
        <button 
          onClick={fetchLoadData}
          disabled={loading}
          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {loading ? (
        <ChartLoader message="Loading load status data..." />
      ) : error ? (
        <ChartError error={error} onRetry={fetchLoadData} />
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500">No load status data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                label={({ status, percentage }) => `${status}: ${percentage}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} loads`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Status Breakdown</h4>
            {data.map((item) => (
              <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: getStatusColor(item.status) }}
                  ></div>
                  <span className="font-medium capitalize">{item.status}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{item.count.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{item.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Dashboard Charts Component
const DashboardCharts = ({ apiCall, showError }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshAllCharts = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Show error message if apiCall is not provided
  if (!apiCall) {
    return (
      <div className="bg-white p-6 rounded-xl border border-red-200">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Charts Unavailable</h3>
          <p className="text-red-600">Unable to load charts. API connection not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh all button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Analytics Dashboard
        </h2>
        <button 
          onClick={refreshAllCharts}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh All Charts
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart 
            key={`revenue-${refreshKey}`}
            apiCall={apiCall} 
            showError={showError} 
          />
        </div>
        
        <SubscriptionDistributionChart 
          key={`subscription-${refreshKey}`}
          apiCall={apiCall} 
          showError={showError} 
        />
        
        <LoadStatusChart 
          key={`load-status-${refreshKey}`}
          apiCall={apiCall} 
          showError={showError} 
        />
        
        <div className="xl:col-span-2">
          <UserActivityChart 
            key={`activity-${refreshKey}`}
            apiCall={apiCall} 
            showError={showError} 
          />
        </div>
      </div>
    </div>
  );
};

// Export all components
export default DashboardCharts;
export { 
  RevenueChart, 
  SubscriptionDistributionChart, 
  UserActivityChart, 
  LoadStatusChart 
};