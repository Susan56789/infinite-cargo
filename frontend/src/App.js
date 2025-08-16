import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './index.css';

// Common Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';

// Main Pages
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';

// Authentication Pages (Consolidated)
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// Admin Pages
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminSettings from './components/admin/AdminSettings';
import AdminSubscriptionDashboard from './components/admin/AdminSubscriptionDashboard';

// Dashboard Pages (User-type specific dashboards)
import DriverDashboard from './components/driver/DriverDashboard';
import CargoOwnerDashboard from './components/cargoowner/CargoOwnerDashboard';
import MyBookings from './components/driver/MyBookings';
import MyProfile from './components/cargoowner/MyProfile';
import DriverProfile from './components/driver/DriverProfile';

// Core Functionality Pages
import LoadSearch from './components/driver/LoadSearch';
import FindDrivers from './components/cargoowner/FindDrivers';

// Support & Info Pages (Consolidated)
import Support from './pages/Support'; 
import Requirements from './pages/Requirements'; 

// Legal Pages
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

// Error Pages
import NotFound from './pages/NotFound';

// SEO Component for dynamic meta tags
const SEOHelmet = ({ title, description, keywords, canonicalUrl }) => {
  const defaultTitle = "Infinite Cargo - Kenya's Leading Transport Network";
  const defaultDescription = "Connect cargo owners and drivers across Kenya. Post loads, find drivers, and transport goods efficiently with Infinite Cargo's trusted platform.";
  const defaultKeywords = "cargo transport Kenya, truck drivers Kenya, freight transport, logistics Kenya, cargo delivery, transport services";
  
  return (
    <Helmet>
      <title>{title ? `${title} | Infinite Cargo` : defaultTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Infinite Cargo" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title ? `${title} | Infinite Cargo` : defaultTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl || "https://infinitecargo.co.ke"} />
      <meta property="og:image" content="https://infinitecargo.co.ke/4.jpg" />
      <meta property="og:site_name" content="Infinite Cargo" />
      <meta property="og:locale" content="en_KE" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title ? `${title} | Infinite Cargo` : defaultTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content="https://infinitecargo.co.ke/1.jpg" />
      <meta name="twitter:site" content="@infinitecargo254" />
      
      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Additional SEO Tags */}
      <meta name="theme-color" content="#1976d2" />
      <meta name="msapplication-TileColor" content="#1976d2" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      
      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Infinite Cargo",
          "url": "https://infinitecargo.co.ke",
          "logo": "https://infinitecargo.co.ke/logo.png",
          "description": defaultDescription,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Nairobi",
            "addressCountry": "Kenya"
          },
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+254722483468",
            "contactType": "customer service",
            "email": "info@infinitecargo.co.ke"
          },
          "sameAs": [
            "https://www.facebook.com/infinitecargo254",
            "https://twitter.com/infinitecargo254",
            "https://www.linkedin.com/company/infinitecargo254"
          ]
        })}
      </script>
    </Helmet>
  );
};

function App() {
  return (
    <HelmetProvider>
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              {/* Main Pages */}
              <Route 
                path="/" 
                element={
                  <>
                    <SEOHelmet 
                      title="Home"
                      description="Kenya's leading platform connecting cargo owners and drivers. Post loads, find reliable drivers, and transport goods efficiently across Kenya."
                      keywords="cargo transport Kenya, freight services, truck drivers Kenya, logistics platform"
                      canonicalUrl="https://infinitecargo.co.ke"
                    />
                    <Home />
                  </>
                } 
              />
              
              <Route 
                path="/about" 
                element={
                  <>
                    <SEOHelmet 
                      title="About Us"
                      description="Learn about Infinite Cargo's mission to revolutionize Kenya's transport industry by connecting cargo owners with reliable drivers nationwide."
                      keywords="about infinite cargo, transport company Kenya, logistics solutions"
                      canonicalUrl="https://infinitecargo.co.ke/about"
                    />
                    <About />
                  </>
                } 
              />
              
              <Route 
                path="/services" 
                element={
                  <>
                    <SEOHelmet 
                      title="Our Services"
                      description="Discover our comprehensive transport services: load posting, driver matching, cargo tracking, and secure payment solutions across Kenya."
                      keywords="transport services Kenya, cargo services, freight solutions, logistics services"
                      canonicalUrl="https://infinitecargo.co.ke/services"
                    />
                    <Services />
                  </>
                } 
              />
              
              <Route 
                path="/how-it-works" 
                element={
                  <>
                    <SEOHelmet 
                      title="How It Works"
                      description="Simple steps to connect with drivers or find cargo loads. Learn how Infinite Cargo makes transport booking easy and efficient."
                      keywords="how to book transport Kenya, cargo booking process, driver registration process"
                      canonicalUrl="https://infinitecargo.co.ke/how-it-works"
                    />
                    <HowItWorks />
                  </>
                } 
              />
              
              <Route 
                path="/pricing" 
                element={
                  <>
                    <SEOHelmet 
                      title="Pricing"
                      description="Transparent pricing for cargo transport services. Compare rates and choose the best transport solution for your needs in Kenya."
                      keywords="transport rates Kenya, cargo pricing, freight costs, logistics pricing"
                      canonicalUrl="https://infinitecargo.co.ke/pricing"
                    />
                    <Pricing />
                  </>
                } 
              />

              {/* Authentication Pages - Consolidated */}
              <Route 
                path="/login" 
                element={
                  <>
                    <SEOHelmet 
                      title="Login"
                      description="Access your Infinite Cargo account. Login to manage your loads, track shipments, and connect with drivers or cargo owners."
                      keywords="login infinite cargo, user account, driver login, cargo owner login"
                      canonicalUrl="https://infinitecargo.co.ke/login"
                    />
                    <Login />
                  </>
                } 
              />
              
              <Route 
                path="/register" 
                element={
                  <>
                    <SEOHelmet 
                      title="Register"
                      description="Join Infinite Cargo today. Register as a driver to find loads or as a cargo owner to connect with reliable transport providers."
                      keywords="register infinite cargo, join as driver, cargo owner registration, transport registration"
                      canonicalUrl="https://infinitecargo.co.ke/register"
                    />
                    <Register />
                  </>
                } 
              />
<Route 
path="/forgot-password"
element={
  <>
  <SEOHelmet 
                      title="Forgot Password"
                      description="Reset your Infinite Cargo account password. Enter your email to receive instructions for resetting your password securely."
                      keywords="forgot password, reset password, account recovery, infinite cargo"
                      canonicalUrl="https://infinitecargo.co.ke/forot-password"
                    />
                    <ForgotPassword/>
  </>
}
/>
              {/* Admin Routes */}
              <Route 
                path="/admin/login" 
                element={
                  <>
                    <SEOHelmet 
                      title="Admin Login"
                      description="Administrator access to Infinite Cargo management system. Secure login for authorized personnel only."
                      keywords="admin login, administrative access, management portal"
                      canonicalUrl="https://infinitecargo.co.ke/admin/login"
                    />
                    <AdminLogin />
                  </>
                } 
              />
              
              <Route 
                path="/admin/dashboard" 
                element={
                  <>
                    <SEOHelmet 
                      title="Admin Dashboard"
                      description="Administrative dashboard for managing users, drivers, cargo, and system settings. Access to analytics and reports."
                      keywords="admin dashboard, system management, user management, analytics"
                      canonicalUrl="https://infinitecargo.co.ke/admin/dashboard"
                    />
                    <AdminDashboard />
                  </>
                } 
              />
              < Route
              path="/admin/subscriptions"
              element={
                <>
                  <SEOHelmet 
                    title="Admin - Subscription Management"
                    description="Manage user subscriptions, view active plans, and handle subscription requests. Admin access required  for subscription management."
                    keywords="subscription management, admin panel, user subscriptions, cargo owner plans"
                    canonicalUrl="https://infinitecargo.co.ke/admin/subscriptions"        
              />
                  <AdminSubscriptionDashboard />
                </>
              }
            />  
              
             
              
              <Route 
                path="/admin/settings" 
                element={
                  <>
                    <SEOHelmet 
                      title="Admin - System Settings"
                      description="Configure system settings, manage admin accounts, and adjust platform parameters for optimal performance."
                      keywords="system settings, admin configuration, platform management"
                      canonicalUrl="https://infinitecargo.co.ke/admin/settings"
                    />
                    <AdminSettings />
                  </>
                } 
              />
              
              

              {/* Dashboard Pages - User-specific */}
              <Route 
                path="/driver-dashboard" 
                element={
                  <>
                    <SEOHelmet 
                      title="Driver Dashboard"
                      description="Manage your driver profile, view available loads, track earnings, and communicate with cargo owners from your dashboard."
                      keywords="driver dashboard, manage loads, driver earnings, transport management"
                      canonicalUrl="https://infinitecargo.co.ke/driver-dashboard"
                    />
                    <DriverDashboard />
                  </>
                } 
              />
              <Route
          path='/driver/profile'
          element={
            <>
              <SEOHelmet 
                title="Driver Profile"
                description="View and manage your driver profile, update vehicle details, and track your transport history."
                keywords="driver profile, vehicle details, transport history, driver management"
                canonicalUrl="https://infinitecargo.co.ke/driver/profile"   
              />
              <DriverProfile />
            </>
          }
        />
              <Route
                path='/cargoowner/profile'
                element={
                  <>        
                    <SEOHelmet 
                      title="Cargo Owner Profile"
                      description="View and manage your cargo owner profile, update shipping preferences, and track your cargo history."
                      keywords="cargo owner profile, shipping preferences, cargo history, transport management"
                      canonicalUrl="https://infinitecargo.co.ke/cargoowner/profile"  
                    />
                    <MyProfile />
                  </>
                }
              />

              < Route
path='/my-bookings'
element={
<>
<SEOHelmet 
title="My Bookings"
description="View and manage your bookings, track cargo shipments, and communicate with drivers from your personal bookings page."
keywords="my bookings, cargo shipments, driver communication, transport management"
canonicalUrl="https://infinitecargo.co.ke/my-bookings"  
              />
                    <MyBookings />
                  </>
                }
              />
              
              <Route 
                path="/cargo-dashboard" 
                element={
                  <>
                    <SEOHelmet 
                      title="Cargo Owner Dashboard"
                      description="Manage your cargo shipments, track loads, communicate with drivers, and handle payments from your cargo owner dashboard."
                      keywords="cargo dashboard, manage shipments, track cargo, cargo owner panel"
                      canonicalUrl="https://infinitecargo.co.ke/cargo-dashboard"
                    />
                    <CargoOwnerDashboard />
                  </>
                } 
              />

              {/* Core Functionality Pages */}
              <Route 
                path="/search-loads" 
                element={
                  <>
                    <SEOHelmet 
                      title="Find Loads"
                      description="Browse available cargo loads across Kenya. Filter by location, weight, and transport type to find the perfect job for your vehicle."
                      keywords="find cargo loads Kenya, available loads, truck loads, freight jobs Kenya"
                      canonicalUrl="https://infinitecargo.co.ke/search-loads"
                    />
                    <LoadSearch />
                  </>
                } 
              />
              
              <Route 
                path="/find-drivers" 
                element={
                  <>
                    <SEOHelmet 
                      title="Find Drivers"
                      description="Browse and connect with verified drivers in Kenya. View ratings, vehicle types, and availability to choose the best driver for your cargo."
                      keywords="find drivers Kenya, hire truck drivers, verified transport drivers, professional drivers"
                      canonicalUrl="https://infinitecargo.co.ke/find-drivers"
                    />
                    <FindDrivers />
                  </>
                } 
              />

              {/* Support & Info Pages - Consolidated */}
              <Route 
                path="/support" 
                element={
                  <>
                    <SEOHelmet 
                      title="Support & Help"
                      description="Get help and support for drivers and cargo owners. Access resources, contact support, and find answers to common questions."
                      keywords="support Kenya, transport help, cargo assistance, driver support"
                      canonicalUrl="https://infinitecargo.co.ke/support"
                    />
                    <Support />
                  </>
                } 
              />
              
              <Route 
                path="/requirements" 
                element={
                  <>
                    <SEOHelmet 
                      title="Requirements & Guide"
                      description="Learn about driver requirements, shipping guidelines, documentation needed, and best practices for safe transport in Kenya."
                      keywords="driver requirements Kenya, shipping guide, transport documentation, vehicle requirements"
                      canonicalUrl="https://infinitecargo.co.ke/requirements"
                    />
                    <Requirements />
                  </>
                } 
              />

              {/* Legacy URL Redirects - Optional: Keep important old URLs working */}
              <Route path="/driver-register" element={<Register />} />
              <Route path="/cargo-register" element={<Register />} />
              <Route path="/driver-support" element={<Support />} />
              <Route path="/cargo-support" element={<Support />} />
              <Route path="/driver-requirements" element={<Requirements />} />
              <Route path="/shipping-guide" element={<Requirements />} />

              {/* Legal Pages */}
              <Route 
                path="/privacy-policy" 
                element={
                  <>
                    <SEOHelmet 
                      title="Privacy Policy"
                      description="Read our privacy policy to understand how Infinite Cargo collects, uses, and protects your personal information and data."
                      keywords="privacy policy, data protection, user privacy, information security"
                      canonicalUrl="https://infinitecargo.co.ke/privacy-policy"
                    />
                    <PrivacyPolicy />
                  </>
                } 
              />
              
              <Route 
                path="/terms-of-service" 
                element={
                  <>
                    <SEOHelmet 
                      title="Terms of Service"
                      description="Read our terms of service outlining the rules and guidelines for using the Infinite Cargo platform and services."
                      keywords="terms of service, user agreement, platform rules, service terms"
                      canonicalUrl="https://infinitecargo.co.ke/terms-of-service"
                    />
                    <TermsOfService />
                  </>
                } 
              />

              {/* 404 Error Page */}
              <Route 
                path="*" 
                element={
                  <>
                    <SEOHelmet 
                      title="Page Not Found"
                      description="The page you're looking for doesn't exist. Return to Infinite Cargo's homepage to find transport solutions across Kenya."
                      keywords="page not found, 404 error, infinite cargo"
                    />
                    <NotFound />
                  </>
                } 
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </HelmetProvider>
  );
}

export default App;