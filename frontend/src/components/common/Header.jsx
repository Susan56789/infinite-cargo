import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authManager, getUser, isAuthenticated } from '../../utils/auth';

const Header = () => {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dropdowns, setDropdowns] = useState({
    services: false,
    drivers: false,
    cargo: false
  });
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const unsubscribeRef = useRef(null);

  // Memoized auth check function to prevent unnecessary re-renders
  const updateAuthState = useCallback(() => {
    if (!mountedRef.current) return;
    
    try {
      const isAuth = isAuthenticated();
      const userData = isAuth ? getUser() : null;
      
      setUser(prevUser => {
        // Only update if the user data has actually changed
        if (!isAuth && !prevUser) return null;
        if (!isAuth && prevUser) {
          
          return null;
        }
        if (isAuth && userData && (!prevUser || prevUser._id !== userData._id || prevUser.email !== userData.email)) {
        
          return userData;
        }
        return prevUser;
      });
    } catch (error) {
      console.error('Error updating auth state in header:', error);
      if (mountedRef.current) {
        setUser(null);
      }
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    mountedRef.current = true;
    
    // Subscribe to auth state changes
    unsubscribeRef.current = authManager.addAuthListener((authState) => {
      if (!mountedRef.current) return;
      
      
      
      if (authState.isAuthenticated && authState.user) {
        setUser(prevUser => {
          if (!prevUser || prevUser._id !== authState.user._id) {
            return authState.user;
          }
          return prevUser;
        });
      } else {
        setUser(null);
      }
    });

    // Initial auth check
    updateAuthState();

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [updateAuthState]);

  // Listen for route changes to dashboard pages only
  useEffect(() => {
    const protectedRoutes = ['/driver-dashboard', '/cargo-dashboard', '/admin'];
    const shouldRecheck = protectedRoutes.some(route => location.pathname.startsWith(route));

    if (shouldRecheck) {
      // Minimal delay to ensure navigation is complete
      const timeoutId = setTimeout(() => {
        updateAuthState();
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, updateAuthState]);

// Force refresh on tab focus
useEffect(() => {
  const handleFocus = () => {
    setTimeout(() => updateAuthState(), 100);
  };
  
  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handleFocus();
  });
  
  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
  };
}, [updateAuthState]);

// Enhanced initial auth check
useEffect(() => {
  // Multiple auth checks with delays to catch timing issues
  const timeouts = [0, 100, 300, 1000].map(delay => 
    setTimeout(() => {
      if (mountedRef.current) {
        updateAuthState();
      }
    }, delay)
  );

  return () => timeouts.forEach(clearTimeout);
}, []);

  // Handle storage events (for cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only react to token and user changes
      const authKeys = ['infiniteCargoUser', 'infiniteCargoToken'];
      
      if (authKeys.includes(e.key)) {
        
        setTimeout(() => {
          updateAuthState();
        }, 100);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateAuthState]);

  // Handle custom auth events (for compatibility with existing code)
  useEffect(() => {
    const handleAuthEvents = (e) => {
      
      setTimeout(() => {
        updateAuthState();
      }, 50);
    };

    const handleLogin = (e) => {
      
      if (e.detail?.user && mountedRef.current) {
        setUser(e.detail.user);
      }
    };

    const handleLogout = () => {
      
      if (mountedRef.current) {
        setUser(null);
      }
    };

    window.addEventListener('authStateChanged', handleAuthEvents);
    window.addEventListener('userLoggedIn', handleLogin);
    window.addEventListener('userLoggedOut', handleLogout);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthEvents);
      window.removeEventListener('userLoggedIn', handleLogin);
      window.removeEventListener('userLoggedOut', handleLogout);
    };
  }, [updateAuthState]);

  // Close menus on route change
  useEffect(() => {
    closeAllMenus();
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      
      
      // Clear user state immediately for responsive UI
      setUser(null);
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
      
      // Perform logout
      await authManager.logout();
      
      
    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback: clear auth and navigate manually
      authManager.clearAuth();
      setUser(null);
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
      navigate('/');
    }
    closeAllMenus();
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeAllMenus = useCallback(() => {
    setIsMenuOpen(false);
    setDropdowns({ services: false, drivers: false, cargo: false });
  }, []);

  const toggleDropdown = (dropdownName) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropdowns(prev => ({
      services: false,
      drivers: false,
      cargo: false,
      [dropdownName]: !prev[dropdownName]
    }));
  };

  const isActiveLink = (path) => {
    return location.pathname === path;
  };

  const navigationSections = {
    services: [
      { to: '/services', text: 'All Services' },
      { to: '/how-it-works', text: 'How It Works' },
      { to: '/pricing', text: 'Pricing' },
      { to: '/requirements', text: 'Requirements & Guide' }
    ],
    drivers: [
      { to: '/register', text: 'Join as Driver' },
      { to: '/search-loads', text: 'Browse Loads' },
      { to: '/requirements', text: 'Requirements' },
      { to: '/support', text: 'Support' }
    ],
    cargo: [
      { to: '/register', text: 'Post Your Load' },
      { to: '/find-drivers', text: 'Find Drivers' },
      { to: '/requirements', text: 'Shipping Guide' },
      { to: '/support', text: 'Support' }
    ]
  };

  const userNavigation = {
    driver: [
      { to: '/driver-dashboard', text: 'Dashboard' },
      { to: '/search-loads', text: 'Find Loads' },
      { to: '/support', text: 'Support' }
    ],
    cargo_owner: [
      { to: '/cargo-dashboard', text: 'Dashboard' },
      { to: '/find-drivers', text: 'Find Drivers' },
      { to: '/support', text: 'Support' }
    ],
    admin: [
      { to: '/admin/dashboard', text: 'Admin Dashboard' },
      { to: '/support', text: 'Support' }
    ]
  };

  const DropdownMenu = ({ name, items, isOpen }) => (
    <div className="relative group">
      <button 
        className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-gray-50 hover:text-primary-600 ${
          isOpen ? 'bg-gray-50 text-primary-600' : 'text-gray-700'
        }`}
        onClick={toggleDropdown(name)}
        aria-expanded={isOpen}
      >
        <span>
          {name === 'services' ? 'Services' : 
           name === 'drivers' ? 'For Drivers' : 'For Cargo Owners'}
        </span>
        <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}></div>
      </button>
      
      <div className={`absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 transform transition-all duration-300 origin-top ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}>
        {items.map((item, index) => (
          <Link 
            key={index}
            to={item.to} 
            className={`block px-4 py-3 text-sm transition-colors duration-200 hover:bg-primary-50 hover:text-primary-600 ${
              isActiveLink(item.to) ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-500' : 'text-gray-700'
            }`}
            onClick={closeAllMenus}
          >
            {item.text}
          </Link>
        ))}
      </div>
    </div>
  );

  const getUserType = () => {
    if (!user) return null;
    return user.userType || user.user_type || user.type;
  };

  const getUserNavigation = () => {
    const userType = getUserType();
    return userNavigation[userType] || userNavigation.driver;
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    return user.name || user.username || user.fullName || user.email?.split('@')[0] || 'User';
  };

  const getUserTypeDisplay = () => {
    const userType = getUserType();
    switch (userType) {
      case 'driver':
        return 'Driver';
      case 'cargo_owner':
        return 'Cargo Owner';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  };

  

  return (
    <header className="bg-white shadow-md border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center space-x-3 group animate-slide-right"
            onClick={closeAllMenus}
          >
            <img 
              src="/logo.png" 
              alt="Infinite Cargo" 
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-500 shadow-sm transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline';
              }}
            />
            <span 
              className="text-xl font-bold text-secondary-800 hidden sm:inline-block group-hover:text-primary-600 transition-colors duration-300"
              style={{display: 'none'}}
            >
              Infinite Cargo
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-gray-50 hover:text-primary-600 ${
                isActiveLink('/') ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
              }`}
              onClick={closeAllMenus}
            >
              Home
            </Link>

            <Link 
              to="/about" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-gray-50 hover:text-primary-600 ${
                isActiveLink('/about') ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
              }`}
              onClick={closeAllMenus}
            >
              About
            </Link>

            <DropdownMenu 
              name="services" 
              items={navigationSections.services} 
              isOpen={dropdowns.services} 
            />

            {!user ? (
              <>
                <DropdownMenu 
                  name="drivers" 
                  items={navigationSections.drivers} 
                  isOpen={dropdowns.drivers} 
                />

                <DropdownMenu 
                  name="cargo" 
                  items={navigationSections.cargo} 
                  isOpen={dropdowns.cargo} 
                />

                <div className="flex items-center space-x-3 ml-6">
                  <Link 
                    to="/login" 
                    className={`px-4 py-2 text-sm font-medium border border-primary-500 text-primary-600 rounded-md hover:bg-primary-50 transition-all duration-300 hover:shadow-sm ${
                      isActiveLink('/login') ? 'bg-primary-50' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className={`px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-all duration-300 hover:shadow-md hover:scale-105 ${
                      isActiveLink('/register') ? 'bg-primary-600' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Register
                  </Link>
                </div>
              </>
            ) : (
              <>
                {getUserNavigation().map((item, index) => (
                  <Link 
                    key={index}
                    to={item.to} 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-gray-50 hover:text-primary-600 ${
                      isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-700'
                    }`}
                    onClick={closeAllMenus}
                  >
                    {item.text}
                  </Link>
                ))}
                
                <div className="flex items-center space-x-4 ml-6">
                  <div className="hidden xl:flex flex-col items-end">
                    <span className="text-sm font-medium text-primary-600">
                      {getUserDisplayName()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getUserTypeDisplay()}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-all duration-300 hover:shadow-md"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden relative w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors duration-300 z-50"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <div className="relative w-6 h-6">
              <span className={`absolute block w-6 h-0.5 bg-gray-600 transform transition-all duration-300 ${
                isMenuOpen ? 'rotate-45 top-2.5' : 'top-1'
              }`}></span>
              <span className={`absolute block w-6 h-0.5 bg-gray-600 transition-all duration-300 ${
                isMenuOpen ? 'opacity-0' : 'top-2.5'
              }`}></span>
              <span className={`absolute block w-6 h-0.5 bg-gray-600 transform transition-all duration-300 ${
                isMenuOpen ? '-rotate-45 top-2.5' : 'top-4'
              }`}></span>
            </div>
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className={`lg:hidden overflow-hidden transition-all duration-300 relative z-50 ${
          isMenuOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}>
          <div className="pt-4 space-y-2 border-t border-gray-200 mt-2 bg-white">
            <Link 
              to="/" 
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 ${
                isActiveLink('/') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={closeAllMenus}
            >
              Home
            </Link>

            <Link 
              to="/about" 
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 ${
                isActiveLink('/about') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={closeAllMenus}
            >
              About
            </Link>

            {/* Mobile Services */}
            <div className="space-y-1">
              <button 
                type="button"
                className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 touch-manipulation ${
                  dropdowns.services ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={toggleDropdown('services')}
                aria-expanded={dropdowns.services}
              >
                Services
                <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.services ? 'rotate-180' : ''}`}></div>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${dropdowns.services ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="pl-4 space-y-1">
                  {navigationSections.services.map((item, index) => (
                    <Link 
                      key={index}
                      to={item.to} 
                      className={`block px-3 py-2 rounded-md text-sm transition-colors duration-300 ${
                        isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                      onClick={closeAllMenus}
                    >
                      {item.text}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {!user ? (
              <>
                {/* Mobile Drivers */}
                <div className="space-y-1">
                  <button 
                    type="button"
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 touch-manipulation ${
                      dropdowns.drivers ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={toggleDropdown('drivers')}
                    aria-expanded={dropdowns.drivers}
                  >
                    For Drivers
                    <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.drivers ? 'rotate-180' : ''}`}></div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${dropdowns.drivers ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-4 space-y-1">
                      {navigationSections.drivers.map((item, index) => (
                        <Link 
                          key={index}
                          to={item.to} 
                          className={`block px-3 py-2 rounded-md text-sm transition-colors duration-300 ${
                            isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          onClick={closeAllMenus}
                        >
                          {item.text}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mobile Cargo */}
                <div className="space-y-1">
                  <button 
                    type="button"
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 touch-manipulation ${
                      dropdowns.cargo ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={toggleDropdown('cargo')}
                    aria-expanded={dropdowns.cargo}
                  >
                    For Cargo Owners
                    <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.cargo ? 'rotate-180' : ''}`}></div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${dropdowns.cargo ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-4 space-y-1">
                      {navigationSections.cargo.map((item, index) => (
                        <Link 
                          key={index}
                          to={item.to} 
                          className={`block px-3 py-2 rounded-md text-sm transition-colors duration-300 ${
                            isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          onClick={closeAllMenus}
                        >
                          {item.text}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2 border-t border-gray-200 mt-4">
                  <Link 
                    to="/login" 
                    className={`block px-3 py-2 text-center border border-primary-500 text-primary-600 rounded-md hover:bg-primary-50 transition-colors duration-300 ${
                      isActiveLink('/login') ? 'bg-primary-50' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className={`block px-3 py-2 text-center bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors duration-300 ${
                      isActiveLink('/register') ? 'bg-primary-600' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Register
                  </Link>
                </div>
              </>
            ) : (
              <>
                {getUserNavigation().map((item, index) => (
                  <Link 
                    key={index}
                    to={item.to} 
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-300 ${
                      isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={closeAllMenus}
                  >
                    {item.text}
                  </Link>
                ))}
                
                <div className="pt-2 border-t border-gray-200 mt-4">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    <div className="font-medium text-primary-600">{getUserDisplayName()}</div>
                    <div className="text-xs text-gray-500">{getUserTypeDisplay()}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors duration-300"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;