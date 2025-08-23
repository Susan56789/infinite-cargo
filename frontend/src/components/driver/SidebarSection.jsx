import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  User, 
  DollarSign, 
  Truck, 
  Star,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Settings,
  BarChart3,
  Award,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  Target,
  Shield
} from 'lucide-react';

const QuickActions = () => {
  const actions = [
    {
      title: 'Search Loads',
      icon: Search,
      link: '/search-loads',
      description: 'Find available cargo',
      color: 'text-blue-600'
    },
    {
      title: 'Update Profile',
      icon: User,
      link: '/driver/profile',
      description: 'Edit your details',
      color: 'text-green-600'
    },
    {
      title: 'View Earnings',
      icon: DollarSign,
      link: '/driver/earnings',
      description: 'Track income',
      color: 'text-yellow-600'
    },
    {
      title: 'My Vehicles',
      icon: Truck,
      link: '/driver/vehicles',
      description: 'Manage fleet',
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Settings size={18} className="mr-2 text-gray-600" />
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link
              key={index}
              to={action.link}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
            >
              <Icon className={`h-8 w-8 ${action.color} group-hover:text-blue-600 mb-2 transition-colors`} />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 text-center transition-colors">
                {action.title}
              </span>
              <span className="text-xs text-gray-500 text-center mt-1">
                {action.description}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const PerformanceCard = ({ dashboardData }) => {
  // Extract performance data with proper fallbacks
  const stats = dashboardData?.stats || {};
  const earnings = dashboardData?.earnings || {};
  
  // Calculate success rate with proper error handling
  const calculateSuccessRate = () => {
    const totalJobs = stats.totalJobs || 0;
    const completedJobs = stats.completedJobs || 0;
    
    if (totalJobs === 0) return 0;
    return Math.round((completedJobs / totalJobs) * 100);
  };

  // Calculate bid acceptance rate
  const calculateBidAcceptanceRate = () => {
    const totalBids = stats.totalBids || 0;
    const acceptedBids = stats.acceptedBids || 0;
    
    if (totalBids === 0) return 0;
    return Math.round((acceptedBids / totalBids) * 100);
  };

  const successRate = calculateSuccessRate();
  const bidAcceptanceRate = calculateBidAcceptanceRate();
  const averageRating = stats.rating || stats.averageRating || 0;
  const completionRate = stats.completionRate || successRate;

  const performanceMetrics = [
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      color: successRate >= 80 ? 'text-green-600' : 
             successRate >= 60 ? 'text-yellow-600' : 'text-red-600',
      icon: successRate >= 80 ? CheckCircle : successRate >= 60 ? Clock : Target,
      trend: successRate >= 80 ? 'up' : successRate >= 60 ? 'stable' : 'down'
    },
    {
      label: 'Total Jobs',
      value: stats.totalJobs || 0,
      color: 'text-gray-900',
      icon: Truck,
      subtext: `${stats.activeJobs || 0} active`
    },
    {
      label: 'Completed Jobs',
      value: stats.completedJobs || 0,
      color: 'text-green-600',
      icon: CheckCircle,
      subtext: `${completionRate}% completion rate`
    },
    {
      label: 'Average Rating',
      value: (
        <div className="flex items-center">
          <Star className="h-4 w-4 text-yellow-400 mr-1 fill-current" />
          <span>{averageRating.toFixed(1)}</span>
        </div>
      ),
      color: 'text-gray-900',
      subtext: `${stats.totalRatings || 0} reviews`
    },
    {
      label: 'Bid Success',
      value: `${bidAcceptanceRate}%`,
      color: bidAcceptanceRate >= 70 ? 'text-green-600' : 
             bidAcceptanceRate >= 40 ? 'text-yellow-600' : 'text-red-600',
      icon: Target,
      subtext: `${stats.acceptedBids || 0}/${stats.totalBids || 0} bids`
    },
    {
      label: 'Monthly Earnings',
      value: `KES ${(earnings.thisMonth || 0).toLocaleString()}`,
      color: 'text-blue-600',
      icon: DollarSign,
      trend: earnings.growth > 0 ? 'up' : earnings.growth < 0 ? 'down' : 'stable',
      subtext: earnings.growth !== 0 ? `${earnings.growth > 0 ? '+' : ''}${earnings.growth}% vs last month` : undefined
    }
  ];

  // Determine driver level based on comprehensive metrics
  const getDriverLevel = () => {
    const rating = averageRating;
    const completedJobs = stats.completedJobs || 0;
    const successRateValue = successRate;
    
    if (rating >= 4.8 && completedJobs >= 100 && successRateValue >= 95) return 'Platinum';
    if (rating >= 4.5 && completedJobs >= 50 && successRateValue >= 85) return 'Gold';
    if (rating >= 4.0 && completedJobs >= 25 && successRateValue >= 75) return 'Silver';
    if (rating >= 3.5 && completedJobs >= 10 && successRateValue >= 60) return 'Bronze';
    return 'Standard';
  };

  const driverLevel = getDriverLevel();

  // Level colors and badges
  const levelConfig = {
    'Platinum': { color: 'text-purple-600', bg: 'bg-gradient-to-r from-purple-50 to-indigo-50', border: 'border-purple-200' },
    'Gold': { color: 'text-yellow-600', bg: 'bg-gradient-to-r from-yellow-50 to-orange-50', border: 'border-yellow-200' },
    'Silver': { color: 'text-gray-600', bg: 'bg-gradient-to-r from-gray-50 to-slate-50', border: 'border-gray-200' },
    'Bronze': { color: 'text-amber-600', bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', border: 'border-amber-200' },
    'Standard': { color: 'text-blue-600', bg: 'bg-gradient-to-r from-blue-50 to-cyan-50', border: 'border-blue-200' }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <BarChart3 size={18} className="mr-2 text-gray-600" />
        Performance Overview
      </h3>
      
      <div className="space-y-4">
        {performanceMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? TrendingUp : 
                          metric.trend === 'down' ? TrendingDown : null;
          
          return (
            <div key={index} className="flex justify-between items-center py-2">
              <div className="flex items-center">
                {Icon && <Icon className="h-4 w-4 text-gray-400 mr-2" />}
                <div>
                  <span className="text-sm text-gray-600">{metric.label}</span>
                  {metric.subtext && (
                    <p className="text-xs text-gray-400 mt-0.5">{metric.subtext}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <span className={`text-sm font-medium ${metric.color} mr-1`}>
                  {metric.value}
                </span>
                {TrendIcon && (
                  <TrendIcon className={`h-3 w-3 ${
                    metric.trend === 'up' ? 'text-green-500' : 'text-red-500'
                  }`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Driver Level Badge */}
      <div className={`mt-6 p-4 ${levelConfig[driverLevel].bg} rounded-lg border ${levelConfig[driverLevel].border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Driver Level</p>
            <p className="text-xs text-gray-600">Based on your performance</p>
          </div>
          <div className="flex items-center">
            <Award className={`h-6 w-6 ${levelConfig[driverLevel].color} mr-2`} />
            <span className={`text-lg font-bold ${levelConfig[driverLevel].color}`}>
              {driverLevel}
            </span>
          </div>
        </div>
        
        {/* Progress indicators for next level */}
        {driverLevel !== 'Platinum' && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Next Level Progress</span>
              <span>{Math.min(100, Math.round((completionRate + averageRating * 10) / 2))}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${
                  driverLevel === 'Gold' ? 'bg-purple-500' :
                  driverLevel === 'Silver' ? 'bg-yellow-500' :
                  driverLevel === 'Bronze' ? 'bg-gray-500' :
                  'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((completionRate + averageRating * 10) / 2))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileSummary = ({ user, formatDate, dashboardData }) => {
  // Extract additional data from dashboard
  const stats = dashboardData?.stats || {};
  const earnings = dashboardData?.earnings || {};
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <User size={18} className="mr-2 text-gray-600" />
        Profile Summary
      </h3>
      
      {/* Profile Picture */}
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mx-auto flex items-center justify-center">
          {user?.profilePicture ? (
            <img 
              src={user.profilePicture} 
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <User className="h-8 w-8 text-blue-600" />
          )}
        </div>
        <h4 className="font-medium text-gray-900 mt-2">{user?.name || 'Driver'}</h4>
        <p className="text-sm text-gray-500">
          {user?.driverProfile?.vehicleType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Professional Driver'}
        </p>
        
        {/* Quick stats pills */}
        <div className="flex justify-center space-x-2 mt-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {stats.completedJobs || 0} jobs
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Star className="h-3 w-3 mr-1 fill-current" />
            {(stats.rating || 0).toFixed(1)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <Mail className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
          <span className="text-gray-600 truncate">{user?.email || 'Email not set'}</span>
        </div>
        <div className="flex items-center text-sm">
          <Phone className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
          <span className="text-gray-600">{user?.phone || 'Phone not set'}</span>
        </div>
        <div className="flex items-center text-sm">
          <MapPin className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
          <span className="text-gray-600 truncate">{user?.location || 'Location not set'}</span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
          <span className="text-gray-600">
            Joined {formatDate ? formatDate(user?.createdAt) : 'Recently'}
          </span>
        </div>
        
        {/* Vehicle Info */}
        {user?.driverProfile && (
          <>
            <div className="flex items-center text-sm">
              <Truck className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
              <span className="text-gray-600">
                {user.driverProfile.vehicleCapacity}T capacity
              </span>
            </div>
            {user.driverProfile.experienceYears && (
              <div className="flex items-center text-sm">
                <Award className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                <span className="text-gray-600">
                  {user.driverProfile.experienceYears} years experience
                </span>
              </div>
            )}
          </>
        )}

        {/* Earnings summary */}
        {earnings.thisMonth > 0 && (
          <div className="flex items-center text-sm">
            <DollarSign className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
            <span className="text-gray-600">
              KES {earnings.thisMonth.toLocaleString()} this month
            </span>
          </div>
        )}
      </div>

      {/* Verification Status */}
      <div className="mt-4 p-3 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Verification Status</span>
          <span className={`text-xs px-2 py-1 rounded-full flex items-center ${
            user?.driverProfile?.verified 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {user?.driverProfile?.verified ? (
              <>
                <Shield className="h-3 w-3 mr-1" />
                Verified
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </>
            )}
          </span>
        </div>
        {!user?.driverProfile?.verified && (
          <p className="text-xs text-gray-500 mt-1">
            Complete your profile to get verified and unlock more opportunities
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 space-y-2">
        <Link
          to="/driver/profile"
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <Settings size={16} className="mr-2" />
          Edit Profile
        </Link>
      </div>
    </div>
  );
};

const SidebarSection = ({ user, dashboardData, formatDate }) => {
  return (
    <div className="space-y-6">
      <QuickActions />
      <PerformanceCard dashboardData={dashboardData} />
      <ProfileSummary user={user} formatDate={formatDate} dashboardData={dashboardData} />
    </div>
  );
};

export default SidebarSection;