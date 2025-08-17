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
  Award
} from 'lucide-react';

const QuickActions = () => {
  const actions = [
    {
      title: 'Search Loads',
      icon: Search,
      link: '/search-loads',
      description: 'Find available cargo'
    },
    {
      title: 'Update Profile',
      icon: User,
      link: '/driver/profile',
      description: 'Edit your details'
    },
    {
      title: 'View Earnings',
      icon: DollarSign,
      link: '/driver/earnings',
      description: 'Track income'
    },
    {
      title: 'My Vehicles',
      icon: Truck,
      link: '/driver/vehicles',
      description: 'Manage fleet'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Settings size={18} className="mr-2" />
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link
              key={index}
              to={action.link}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <Icon className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mb-2" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 text-center">
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
  const calculateSuccessRate = () => {
    if (dashboardData.stats.totalBids === 0) return 0;
    return Math.round((dashboardData.stats.acceptedBids / dashboardData.stats.totalBids) * 100);
  };

  const performanceMetrics = [
    {
      label: 'Success Rate',
      value: `${calculateSuccessRate()}%`,
      color: calculateSuccessRate() >= 70 ? 'text-green-600' : 
             calculateSuccessRate() >= 50 ? 'text-yellow-600' : 'text-red-600'
    },
    {
      label: 'Total Bids',
      value: dashboardData.stats.totalBids,
      color: 'text-gray-900'
    },
    {
      label: 'Accepted Bids',
      value: dashboardData.stats.acceptedBids,
      color: 'text-green-600'
    },
    {
      label: 'Average Rating',
      value: (
        <div className="flex items-center">
          <Star className="h-4 w-4 text-yellow-400 mr-1" />
          <span>{dashboardData.stats.rating}</span>
        </div>
      ),
      color: 'text-gray-900'
    },
    {
      label: 'Completion Rate',
      value: `${dashboardData.stats.completionRate}%`,
      color: 'text-green-600'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <BarChart3 size={18} className="mr-2" />
        Performance
      </h3>
      <div className="space-y-4">
        {performanceMetrics.map((metric, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{metric.label}</span>
            <span className={`text-sm font-medium ${metric.color}`}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>
      
      {/* Performance Badge */}
      <div className="mt-6 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Driver Level</p>
            <p className="text-xs text-gray-600">Based on your performance</p>
          </div>
          <div className="flex items-center">
            <Award className="h-6 w-6 text-blue-600 mr-2" />
            <span className="text-lg font-bold text-blue-600">
              {dashboardData.stats.rating >= 4.5 ? 'Gold' :
               dashboardData.stats.rating >= 4.0 ? 'Silver' :
               dashboardData.stats.rating >= 3.5 ? 'Bronze' : 'Standard'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileSummary = ({ user, formatDate }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <User size={18} className="mr-2" />
        Profile Summary
      </h3>
      
      {/* Profile Picture */}
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
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
        <h4 className="font-medium text-gray-900 mt-2">{user?.name}</h4>
        <p className="text-sm text-gray-500">
          {user?.driverProfile?.vehicleType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Driver'}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <Mail className="h-4 w-4 text-gray-400 mr-3" />
          <span className="text-gray-600">{user?.email}</span>
        </div>
        <div className="flex items-center text-sm">
          <Phone className="h-4 w-4 text-gray-400 mr-3" />
          <span className="text-gray-600">{user?.phone}</span>
        </div>
        <div className="flex items-center text-sm">
          <MapPin className="h-4 w-4 text-gray-400 mr-3" />
          <span className="text-gray-600">{user?.location || 'Location not set'}</span>
        </div>
        <div className="flex items-center text-sm">
          <Calendar className="h-4 w-4 text-gray-400 mr-3" />
          <span className="text-gray-600">Joined {formatDate(user?.createdAt)}</span>
        </div>
        
        {/* Vehicle Info */}
        {user?.driverProfile && (
          <>
            <div className="flex items-center text-sm">
              <Truck className="h-4 w-4 text-gray-400 mr-3" />
              <span className="text-gray-600">
                {user.driverProfile.vehicleCapacity}T capacity
              </span>
            </div>
            {user.driverProfile.experienceYears && (
              <div className="flex items-center text-sm">
                <Award className="h-4 w-4 text-gray-400 mr-3" />
                <span className="text-gray-600">
                  {user.driverProfile.experienceYears} years experience
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Verification Status */}
      <div className="mt-4 p-3 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Verification Status</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            user?.driverProfile?.verified 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {user?.driverProfile?.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
        {!user?.driverProfile?.verified && (
          <p className="text-xs text-gray-500 mt-1">
            Complete your profile to get verified
          </p>
        )}
      </div>

      <Link
        to="/driver/profile"
        className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
      >
        <Settings size={16} className="mr-2" />
        Edit Profile
      </Link>
    </div>
  );
};

const SidebarSection = ({ user, dashboardData, formatDate }) => {
  return (
    <div className="space-y-6">
      <QuickActions />
      <PerformanceCard dashboardData={dashboardData} />
      <ProfileSummary user={user} formatDate={formatDate} />
    </div>
  );
};

export default SidebarSection;