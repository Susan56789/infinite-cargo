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
  const lastUserIdRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  // Enhanced user state update with better comparison
  const updateUser = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const isAuth = isAuthenticated();
      const userData = isAuth ? getUser() : null;
      
      // Better comparison logic
      const currentUserId = userData?._id || userData?.id;
      const lastUserId = lastUserIdRef.current;
      
      if (!isAuth) {
        if (user !== null) {
          
          setUser(null);
          lastUserIdRef.current = null;
        }
        return;
      }
      
      if (userData && currentUserId) {
        if (currentUserId !== lastUserId || !user) {
          setUser(userData);
          lastUserIdRef.current = currentUserId;
        }
      }
    } catch (error) {
      console.error('[Header] Error updating user state:', error);
    }
  }, [user]);

  // Enhanced force sync function
  const forceSync = useCallback(() => {
    if (!mountedRef.current) return;
    

    
    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Force sync with the auth manager
    authManager._forceSyncFromStorage(false); // Regular user
    
    // Update user state after sync
    syncTimeoutRef.current = setTimeout(() => {
      updateUser();
    }, 50);
  }, [updateUser]);

  // Initialize auth listener and state
  useEffect(() => {
    mountedRef.current = true;
    
   

    // Ensure auth manager is initialized
    if (!authManager.isInitialized) {
      authManager.initialize();
    }

    // Listen to AuthManager state changes with enhanced callback
    unsubscribeRef.current = authManager.addAuthListener((authData) => {
      if (!mountedRef.current) return;
      
      const userAuthState = authData.user || authData; // Handle both formats
     
      
      setUser(userAuthState?.isAuthenticated ? userAuthState.user : null);
    });

    // Initial auth check with delay to ensure initialization
    setTimeout(() => {
      updateUser();
    }, 100);

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [updateUser]);

  // Enhanced cross-tab sync via storage events
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!mountedRef.current) return;
      
      const authKeys = [
        'infiniteCargoUser', 
        'infiniteCargoToken', 
        'infiniteCargoTokenTimestamp',
        'infiniteCargoTabSync'
      ];
      
      if (authKeys.includes(e.key)) {
       
        
        // Throttled sync to prevent excessive updates
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        
        syncTimeoutRef.current = setTimeout(() => {
          forceSync();
        }, 100);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [forceSync]);

  // Enhanced tab focus/visibility handling
  useEffect(() => {
    const handleTabActive = () => {
      if (!mountedRef.current) return;
      
     
      
      // Always force sync when tab becomes active
      setTimeout(() => {
        forceSync();
      }, 50);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current) {
        handleTabActive();
      }
    };

    // Focus events
    window.addEventListener('focus', handleTabActive);
    
    // Visibility change events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Page show events (for back/forward navigation)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && mountedRef.current) {
        
        handleTabActive();
      }
    });

    return () => {
      window.removeEventListener('focus', handleTabActive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleTabActive);
    };
  }, [forceSync]);

  // Enhanced custom auth event handlers
  useEffect(() => {
    const handleUserLoggedIn = (e) => {
      
      
      // Force immediate sync and update
      setTimeout(() => {
        forceSync();
        
        // Also set user directly if provided in event
        if (e.detail?.user && mountedRef.current) {
          setUser(e.detail.user);
          lastUserIdRef.current = e.detail.user._id || e.detail.user.id;
        }
      }, 50);
    };

    const handleUserLoggedOut = (e) => {
     
      
      if (mountedRef.current) {
        setUser(null);
        lastUserIdRef.current = null;
      }
    };

    const handleAuthStateChanged = () => {
      
      
      setTimeout(() => {
        forceSync();
      }, 25);
    };

    // Listen for auth events
    window.addEventListener('userLoggedIn', handleUserLoggedIn);
    window.addEventListener('userLoggedOut', handleUserLoggedOut);
    window.addEventListener('authStateChanged', handleAuthStateChanged);

    return () => {
      window.removeEventListener('userLoggedIn', handleUserLoggedIn);
      window.removeEventListener('userLoggedOut', handleUserLoggedOut);
      window.removeEventListener('authStateChanged', handleAuthStateChanged);
    };
  }, [forceSync]);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setDropdowns({ services: false, drivers: false, cargo: false });
  }, [location.pathname]);

  // Enhanced logout handler
  const handleLogout = async () => {
    try {
     
      
      // Clear local state immediately
      setUser(null);
      lastUserIdRef.current = null;
      setIsMenuOpen(false);
      setDropdowns({ services: false, drivers: false, cargo: false });
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('userLoggedOut', {
        detail: { source: 'header', timestamp: Date.now() }
      }));
      
      // Call auth manager logout
      await authManager.logout();
      
    } catch (error) {
      console.error('[Header] Logout failed:', error);
      
      // Fallback: force clear and redirect
      authManager.clearAuth();
      navigate('/');
    }
  };

  const toggleDropdown = (dropdownName) => (e) => {
    e.preventDefault();
    setDropdowns(prev => ({
      services: false,
      drivers: false,
      cargo: false,
      [dropdownName]: !prev[dropdownName]
    }));
  };

  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setDropdowns({ services: false, drivers: false, cargo: false });
  };

  const isActiveLink = (path) => location.pathname === path;

  // Enhanced user data extraction
  const getUserType = () => {
    if (!user) return null;
    return user.userType || user.user_type || user.type || user.role;
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.name || user.username || user.firstName || user.email?.split('@')[0] || 'User';
  };

  const getUserTypeDisplay = () => {
    const userType = getUserType();
    const types = {
      driver: 'Driver',
      cargo_owner: 'Cargo Owner',
      cargo_shipper: 'Cargo Owner',
      admin: 'Admin'
    };
    return types[userType] || 'User';
  };

  // Navigation data
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
    cargo_shipper: [
      { to: '/cargo-dashboard', text: 'Dashboard' },
      { to: '/find-drivers', text: 'Find Drivers' },
      { to: '/support', text: 'Support' }
    ],
    admin: [
      { to: '/admin/dashboard', text: 'Admin Dashboard' },
      { to: '/support', text: 'Support' }
    ]
  };

  const getUserNavigation = () => {
    const userType = getUserType();
    return userNavigation[userType] || userNavigation.driver;
  };

  // Dropdown component
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

  return (
    <header className="bg-white shadow-md border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group" onClick={closeAllMenus}>
            <img 
              src="/logo.webp" 
              alt="Infinite Cargo" 
              className="w-10 h-10 rounded-full object-cover border-2 border-primary-500 shadow-sm transition-transform duration-300 group-hover:scale-110"
            />
            <span className="text-xl font-bold text-secondary-800 hidden sm:inline-block group-hover:text-primary-600 transition-colors duration-300">
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

            <DropdownMenu name="services" items={navigationSections.services} isOpen={dropdowns.services} />

            {!user ? (
              <>
                <DropdownMenu name="drivers" items={navigationSections.drivers} isOpen={dropdowns.drivers} />
                <DropdownMenu name="cargo" items={navigationSections.cargo} isOpen={dropdowns.cargo} />

                <div className="flex items-center space-x-3 ml-6">
                  <Link 
                    to="/login" 
                    className={`px-4 py-2 text-sm font-medium border border-primary-500 text-primary-600 rounded-md hover:bg-primary-50 transition-all duration-300 ${
                      isActiveLink('/login') ? 'bg-primary-50' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className={`px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-all duration-300 hover:shadow-md ${
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
            className="lg:hidden relative w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors duration-300"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
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
        <nav className={`lg:hidden overflow-hidden transition-all duration-300 ${
          isMenuOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}>
          <div className="pt-4 space-y-2 border-t border-gray-200 mt-2 bg-white">
            
            {/* Mobile Basic Links */}
            <Link to="/" className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActiveLink('/') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
            }`} onClick={closeAllMenus}>
              Home
            </Link>

            <Link to="/about" className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActiveLink('/about') ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
            }`} onClick={closeAllMenus}>
              About
            </Link>

            {/* Mobile Services Dropdown */}
            <div className="space-y-1">
              <button 
                className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium ${
                  dropdowns.services ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={toggleDropdown('services')}
              >
                Services
                <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.services ? 'rotate-180' : ''}`}></div>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${dropdowns.services ? 'max-h-96' : 'max-h-0'}`}>
                <div className="pl-4 space-y-1">
                  {navigationSections.services.map((item, index) => (
                    <Link 
                      key={index}
                      to={item.to} 
                      className={`block px-3 py-2 rounded-md text-sm ${
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
                {/* Mobile Drivers Dropdown */}
                <div className="space-y-1">
                  <button 
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium ${
                      dropdowns.drivers ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={toggleDropdown('drivers')}
                  >
                    For Drivers
                    <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.drivers ? 'rotate-180' : ''}`}></div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${dropdowns.drivers ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="pl-4 space-y-1">
                      {navigationSections.drivers.map((item, index) => (
                        <Link 
                          key={index}
                          to={item.to} 
                          className={`block px-3 py-2 rounded-md text-sm ${
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

                {/* Mobile Cargo Dropdown */}
                <div className="space-y-1">
                  <button 
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-md text-base font-medium ${
                      dropdowns.cargo ? 'bg-gray-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={toggleDropdown('cargo')}
                  >
                    For Cargo Owners
                    <div className={`w-0 h-0 border-l-2 border-r-2 border-l-transparent border-r-transparent border-t-4 border-t-current transition-transform duration-200 ${dropdowns.cargo ? 'rotate-180' : ''}`}></div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${dropdowns.cargo ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="pl-4 space-y-1">
                      {navigationSections.cargo.map((item, index) => (
                        <Link 
                          key={index}
                          to={item.to} 
                          className={`block px-3 py-2 rounded-md text-sm ${
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

                {/* Mobile Auth Buttons */}
                <div className="pt-4 space-y-2 border-t border-gray-200 mt-4">
                  <Link 
                    to="/login" 
                    className={`block px-3 py-2 text-center border border-primary-500 text-primary-600 rounded-md hover:bg-primary-50 ${
                      isActiveLink('/login') ? 'bg-primary-50' : ''
                    }`}
                    onClick={closeAllMenus}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className={`block px-3 py-2 text-center bg-primary-500 text-white rounded-md hover:bg-primary-600 ${
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
                {/* Mobile User Navigation */}
                {getUserNavigation().map((item, index) => (
                  <Link 
                    key={index}
                    to={item.to} 
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                      isActiveLink(item.to) ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={closeAllMenus}
                  >
                    {item.text}
                  </Link>
                ))}
                
                {/* Mobile User Info & Logout */}
                <div className="pt-2 border-t border-gray-200 mt-4">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    <div className="font-medium text-primary-600">{getUserDisplayName()}</div>
                    <div className="text-xs text-gray-500">{getUserTypeDisplay()}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-md text-base font-medium bg-red-500 text-white hover:bg-red-600"
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