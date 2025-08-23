// src/components/common/CanonicalRedirect.js
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const CanonicalRedirect = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    const search = location.search;
    
    // Remove trailing slashes (except root)
    if (path !== '/' && path.endsWith('/')) {
      const canonicalPath = path.slice(0, -1);
      navigate(canonicalPath + search, { replace: true });
      return;
    }

    // Remove common duplicate parameters
    if (search) {
      const params = new URLSearchParams(search);
      
      // Remove tracking parameters that create duplicates
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
      let hasChanges = false;
      
      trackingParams.forEach(param => {
        if (params.has(param)) {
          params.delete(param);
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        const newSearch = params.toString();
        navigate(path + (newSearch ? `?${newSearch}` : ''), { replace: true });
        return;
      }
    }

    // Handle specific duplicate routes
    const redirectMap = {
      '/driver-register': '/register',
      '/cargo-register': '/register',
      '/driver-support': '/support',
      '/cargo-support': '/support',
      '/driver-requirements': '/requirements',
      '/shipping-guide': '/requirements',
      '/home': '/',
      '/index': '/',
      '/index.html': '/',
    };

    if (redirectMap[path]) {
      navigate(redirectMap[path] + search, { replace: true });
      return;
    }

    // Convert query parameters to lowercase for consistency
    if (search) {
      const params = new URLSearchParams(search);
      const normalizedParams = new URLSearchParams();
      
      params.forEach((value, key) => {
        normalizedParams.set(key.toLowerCase(), value);
      });
      
      const originalSearch = params.toString();
      const normalizedSearch = normalizedParams.toString();
      
      if (originalSearch !== normalizedSearch) {
        navigate(path + `?${normalizedSearch}`, { replace: true });
        return;
      }
    }

  }, [location, navigate]);

  return children;
};

// URL normalization utility
export const getCanonicalUrl = (pathname, baseUrl = 'https://infinitecargo.co.ke') => {
  // Remove trailing slash except for root
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  
  // Handle specific canonical mappings
  const canonicalMap = {
    '/driver-register': '/register',
    '/cargo-register': '/register',
    '/driver-support': '/support',
    '/cargo-support': '/support',
    '/driver-requirements': '/requirements',
    '/shipping-guide': '/requirements',
    '/home': '/',
    '/index': '/',
    '/index.html': '/'
  };
  
  const canonicalPath = canonicalMap[normalizedPath] || normalizedPath;
  
  return `${baseUrl}${canonicalPath}`;
};

export default CanonicalRedirect;