import React from 'react';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  text = '', 
  fullScreen = false,
  className = '' 
}) => {
  // Size variants
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-2',
    large: 'h-12 w-12 border-2',
    xlarge: 'h-16 w-16 border-4'
  };

  // Color variants
  const colorClasses = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-600 border-t-transparent',
    success: 'border-green-600 border-t-transparent',
    warning: 'border-yellow-600 border-t-transparent',
    danger: 'border-red-600 border-t-transparent',
    white: 'border-white border-t-transparent'
  };

  // Text size classes
  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
    xlarge: 'text-lg'
  };

  const spinnerClasses = `
    inline-block
    animate-spin
    rounded-full
    ${sizeClasses[size]}
    ${colorClasses[color]}
    ${className}
  `.trim();

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <div className="flex flex-col items-center space-y-4">
          <div className={spinnerClasses}></div>
          {text && (
            <p className={`text-gray-700 font-medium ${textSizeClasses[size]}`}>
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={spinnerClasses}></div>
      {text && (
        <p className={`text-gray-700 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
    </div>
  );
};

// Specific variants for common use cases
export const PageLoader = ({ text = 'Loading page...' }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="large" color="primary" text={text} />
  </div>
);

export const ButtonSpinner = ({ className = '' }) => (
  <LoadingSpinner 
    size="small" 
    color="white" 
    className={`mr-2 ${className}`}
  />
);

export const FullScreenLoader = ({ text = 'Loading...' }) => (
  <LoadingSpinner 
    size="xlarge" 
    color="primary" 
    text={text} 
    fullScreen={true}
  />
);

export const InlineLoader = ({ text = '' }) => (
  <div className="flex items-center space-x-2 py-4">
    <LoadingSpinner size="small" color="primary" />
    {text && <span className="text-sm text-gray-600">{text}</span>}
  </div>
);

// Skeleton loader for content placeholders
export const SkeletonLoader = ({ lines = 3, className = '' }) => (
  <div className={`animate-pulse space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        className={`h-4 bg-gray-200 rounded ${
          index === lines - 1 ? 'w-3/4' : 'w-full'
        }`}
      />
    ))}
  </div>
);

// Card skeleton for loading cards/items
export const CardSkeleton = ({ showImage = true, className = '' }) => (
  <div className={`animate-pulse ${className}`}>
    {showImage && (
      <div className="bg-gray-200 h-48 w-full rounded-t-lg mb-4"></div>
    )}
    <div className="space-y-3 p-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  </div>
);

// Infinite Cargo branded loader
export const InfiniteCargoLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-4">
      {/* Custom truck icon spinner */}
      <div className="relative">
        <div className="h-16 w-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            className="h-6 w-6 text-blue-600" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Infinite Cargo
        </h3>
        <p className="text-sm text-gray-600">Loading your transport solutions...</p>
      </div>
    </div>
  </div>
);

// Loading states for data tables
export const TableLoader = ({ columns = 4, rows = 5 }) => (
  <div className="animate-pulse">
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {/* Header */}
      {Array.from({ length: columns }).map((_, colIndex) => (
        <div key={`header-${colIndex}`} className="h-6 bg-gray-200 rounded"></div>
      ))}
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: columns }).map((_, colIndex) => (
          <div 
            key={`row-${rowIndex}-col-${colIndex}`} 
            className="h-8 bg-gray-100 rounded"
          ></div>
        ))
      )}
    </div>
  </div>
);

export default LoadingSpinner;