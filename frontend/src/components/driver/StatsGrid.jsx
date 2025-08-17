import React from 'react';
import { Truck, DollarSign, Package, Star, TrendingUp, Clock } from 'lucide-react';

const StatsGrid = ({ dashboardData, formatCurrency }) => {
  const statsData = [
    {
      title: 'Active Jobs',
      value: dashboardData.activeBookings.length,
      icon: Truck,
      color: 'blue',
      trend: '+2 this week',
      trendUp: true
    },
    {
      title: 'This Month',
      value: formatCurrency(dashboardData.earnings.thisMonth),
      icon: DollarSign,
      color: 'green',
      trend: '+15%',
      trendUp: true
    },
    {
      title: 'Completed Jobs',
      value: dashboardData.completedBookings.length,
      icon: Package,
      color: 'purple',
      trend: 'This month',
      trendUp: null
    },
    {
      title: 'Rating',
      value: `${dashboardData.stats.rating}/5`,
      icon: Star,
      color: 'yellow',
      trend: 'Excellent',
      trendUp: true
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      yellow: 'bg-yellow-100 text-yellow-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </h3>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                </div>
              </div>
              <div className={`flex items-center text-sm ${
                stat.trendUp === true ? 'text-green-600' : 
                stat.trendUp === false ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {stat.trendUp === true && <TrendingUp size={16} className="mr-1" />}
                {stat.trendUp === false && <TrendingUp size={16} className="mr-1 transform rotate-180" />}
                {stat.trendUp === null && <Clock size={16} className="mr-1" />}
                <span>{stat.trend}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;