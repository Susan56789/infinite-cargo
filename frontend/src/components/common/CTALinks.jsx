// src/components/common/CTALinks.js
import React from 'react';
import { Link } from 'react-router-dom';

const CTALinks = ({ className = '' }) => {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-6 ${className}`}>
      <h3 className="font-semibold text-blue-900 mb-4 text-center">
        Ready to Get Started?
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/register"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-center font-medium hover:bg-blue-700 transition-colors duration-200"
        >
          Register Now
        </Link>
        <Link
          to="/search-loads"
          className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-lg text-center font-medium hover:bg-blue-50 transition-colors duration-200"
        >
          Find Loads
        </Link>
      </div>
      <div className="mt-4 text-center">
        <Link
          to="/contact"
          className="text-blue-600 hover:text-blue-800 underline text-sm transition-colors"
        >
          Have questions? Contact us
        </Link>
      </div>
    </div>
  );
};

// Driver-focused CTA
export const DriverCTA = ({ className = '' }) => {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-6 ${className}`}>
      <h3 className="font-semibold text-green-900 mb-4 text-center">
        Start Earning as a Driver
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/register"
          className="bg-green-600 text-white px-6 py-3 rounded-lg text-center font-medium hover:bg-green-700 transition-colors duration-200"
        >
          Join as Driver
        </Link>
        <Link
          to="/search-loads"
          className="bg-white text-green-600 border border-green-600 px-6 py-3 rounded-lg text-center font-medium hover:bg-green-50 transition-colors duration-200"
        >
          Browse Jobs
        </Link>
      </div>
      <div className="mt-4 text-center">
        <Link
          to="/requirements"
          className="text-green-600 hover:text-green-800 underline text-sm transition-colors"
        >
          View driver requirements
        </Link>
      </div>
    </div>
  );
};

// Cargo owner focused CTA
export const CargoOwnerCTA = ({ className = '' }) => {
  return (
    <div className={`bg-orange-50 border border-orange-200 rounded-lg p-6 ${className}`}>
      <h3 className="font-semibold text-orange-900 mb-4 text-center">
        Ship Your Cargo Today
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/register"
          className="bg-orange-600 text-white px-6 py-3 rounded-lg text-center font-medium hover:bg-orange-700 transition-colors duration-200"
        >
          Post a Load
        </Link>
        <Link
          to="/find-drivers"
          className="bg-white text-orange-600 border border-orange-600 px-6 py-3 rounded-lg text-center font-medium hover:bg-orange-50 transition-colors duration-200"
        >
          Find Drivers
        </Link>
      </div>
      <div className="mt-4 text-center">
        <Link
          to="/pricing"
          className="text-orange-600 hover:text-orange-800 underline text-sm transition-colors"
        >
          Check shipping rates
        </Link>
      </div>
    </div>
  );
};

export default CTALinks;