// src/components/common/Breadcrumb.js
import React from 'react';
import { Link } from 'react-router-dom';

const Breadcrumb = ({ items, className = '' }) => {
  return (
    <nav className={`flex items-center space-x-2 text-sm text-gray-600 mb-6 ${className}`} aria-label="Breadcrumb">
      <Link 
        to="/" 
        className="hover:text-blue-600 transition-colors"
        aria-label="Go to homepage"
      >
        <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
        </svg>
        Home
      </Link>
      
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <span className="text-gray-400" aria-hidden="true">/</span>
          {item.url && index < items.length - 1 ? (
            <Link 
              to={item.url} 
              className="hover:text-blue-600 transition-colors"
              aria-label={`Go to ${item.text}`}
            >
              {item.text}
            </Link>
          ) : (
            <span 
              className="text-gray-900 font-medium" 
              aria-current="page"
            >
              {item.text}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;