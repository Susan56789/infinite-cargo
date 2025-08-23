import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Target,
  ArrowLeft,
  Download,
  Filter,
  BarChart3,
  PieChart,
  Loader,
  AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from 'recharts';
import { getAuthHeader } from '../../utils/auth';

const DriverEarnings = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [earningsData, setEarningsData] = useState({
    summary: {
      totalEarnings: 0,
      totalJobs: 0,
      avgEarningsPerJob: 0,
      avgEarningsPerDay: 0
    },
    dailyBreakdown: []
  });

  const periods = [
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' }
  ];

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchEarningsData();
  }, [selectedPeriod, selectedYear, selectedMonth]);

  const fetchEarningsData = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        period: selectedPeriod
      });

      if (selectedPeriod === 'month' && selectedYear && selectedMonth) {
        params.append('year', selectedYear.toString());
        params.append('month', selectedMonth.toString());
      } else if (selectedPeriod === 'year' && selectedYear) {
        params.append('year', selectedYear.toString());
      }

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/drivers/earnings?${params}`, {
        headers: getAuthHeader()
      });

      if (response.ok) {
        const data = await response.json();
        setEarningsData(data.data);
      } else if (response.status === 404) {
        // No earnings data found
        setEarningsData({
          summary: {
            totalEarnings: 0,
            totalJobs: 0,
            avgEarningsPerJob: 0,
            avgEarningsPerDay: 0
          },
          dailyBreakdown: []
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch earnings data');
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
      setError('Network error fetching earnings data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'week':
        return 'Last 7 Days';
      case 'month':
        return `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
      case 'quarter':
        return `Q${Math.ceil(new Date().getMonth() / 3)} ${new Date().getFullYear()}`;
      case 'year':
        return `${selectedYear}`;
      default:
        return 'Current Period';
    }
  };

  // Chart colors
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  // Prepare data for charts
  const chartData = earningsData.dailyBreakdown.map(day => ({
    date: formatDate(day.date),
    earnings: day.earnings,
    jobs: day.jobCount
  }));

  // Calculate trends
  const calculateTrend = () => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const recent = chartData.slice(-3).reduce((sum, day) => sum + day.earnings, 0) / 3;
    const earlier = chartData.slice(0, 3).reduce((sum, day) => sum + day.earnings, 0) / 3;
    
    if (earlier === 0) return { direction: 'stable', percentage: 0 };
    
    const percentage = ((recent - earlier) / earlier) * 100;
    
    return {
      direction: percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable',
      percentage: Math.abs(percentage)
    };
  };

  const trend = calculateTrend();

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Earnings,Jobs\n"
      + earningsData.dailyBreakdown.map(day => 
          `${day.date},${day.earnings},${day.jobCount}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `earnings_${selectedPeriod}_${getPeriodLabel()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Earnings Dashboard</h1>
                <p className="text-sm text-gray-600">Track your income and performance</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={exportData}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={16} className="mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <Filter size={18} className="text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Period:</span>
            </div>
            
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>

            {selectedPeriod === 'month' && (
              <>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {months.map(month => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {years.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}

            {selectedPeriod === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}

            <div className="ml-auto text-sm text-gray-600">
              Showing data for: <span className="font-medium">{getPeriodLabel()}</span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earningsData.summary.totalEarnings)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              {trend.direction === 'up' && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+{trend.percentage.toFixed(1)}%</span>
                </>
              )}
              {trend.direction === 'down' && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">-{trend.percentage.toFixed(1)}%</span>
                </>
              )}
              {trend.direction === 'stable' && (
                <span className="text-sm text-gray-600">Stable earnings</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {earningsData.summary.totalJobs}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-gray-600">Jobs completed</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg per Job</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earningsData.summary.avgEarningsPerJob)}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-gray-600">Average per completed job</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg per Day</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(earningsData.summary.avgEarningsPerDay)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-gray-600">Daily average</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Earnings Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings Trend</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                    tickFormatter={(value) => `${value.toLocaleString()}`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      formatCurrency(value),
                      name === 'earnings' ? 'Earnings' : 'Jobs'
                    ]}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No earnings data available for this period</p>
                </div>
              </div>
            )}
          </div>

          {/* Jobs vs Earnings Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs vs Earnings</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                  />
                  <YAxis 
                    fontSize={12}
                    tick={{ fill: '#6B7280' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'earnings' ? formatCurrency(value) : value,
                      name === 'earnings' ? 'Earnings' : 'Jobs'
                    ]}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Bar dataKey="jobs" fill="#10B981" name="jobs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No job data available for this period</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily Breakdown Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h3>
          {earningsData.dailyBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jobs Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Earnings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg per Job
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {earningsData.dailyBreakdown.map((day, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(day.date).toLocaleDateString('en-KE', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.jobCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(day.earnings)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(day.avgAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No earnings recorded for this period</p>
              <p className="text-sm text-gray-400 mt-2">
                Complete some jobs to see your earnings breakdown here
              </p>
            </div>
          )}
        </div>

        {/* Performance Insights */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {earningsData.summary.totalJobs > 0 ? (earningsData.summary.totalEarnings / earningsData.summary.totalJobs).toFixed(0) : 0}
              </div>
              <div className="text-sm text-gray-600">Average Job Value</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {chartData.length > 0 ? (chartData.reduce((sum, day) => sum + day.jobs, 0) / chartData.length).toFixed(1) : 0}
              </div>
              <div className="text-sm text-gray-600">Jobs per Day</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
                {trend.percentage.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Trend Direction</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverEarnings;