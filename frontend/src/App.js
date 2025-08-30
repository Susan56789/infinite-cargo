import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';


// Common Components 
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import LoadingSpinner from './components/common/LoadingSpinner'; 
import SEOHelmet from './components/common/SEOHelmet';
import CanonicalRedirect from './components/common/CanonicalRedirect';

// Main Pages 
import Home from './pages/Home';

// Lazy load  pages to improve initial bundle size
const About = lazy(() => import('./pages/About'));
const Services = lazy(() => import('./pages/Services'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Pricing = lazy(() => import('./pages/Pricing'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Contact = lazy(() => import('./pages/Contact'));

// Authentication Pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Admin Pages
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

// Dashboard Pages
const DriverDashboard = lazy(() => import('./components/driver/DriverDashboard'));
const CargoOwnerDashboard = lazy(() => import('./components/cargoowner/CargoOwnerDashboard'));
const DriverProfile = lazy(() => import('./components/driver/DriverProfile'));
const DriverJobDetails = lazy(() => import('./components/driver/DriverJobDetails'));
const DriverEarnings = lazy(() => import('./components/driver/DriverEarnings'));
const DriverVehiclesPage = lazy(() => import('./components/driver/DriverVehiclesPage'));
const DriverBidsPage = lazy(() => import('./components/driver/DriverBidsPage'));
const BidDetails = lazy(() => import('./components/driver/BidDetails'));
const LoadTracking = lazy (()=> import('./components/cargoowner/LoadTracking'));
const LoadBidsPage = lazy(() => import('./components/cargoowner/LoadBidsPage'));

// Core Functionality Pages
const LoadSearch = lazy(() => import('./components/driver/LoadSearch'));
const FindDrivers = lazy(() => import('./components/cargoowner/FindDrivers'));
const LoadDetail = lazy(() => import('./pages/LoadDetail'));

// Support & Info Pages
const Support = lazy(() => import('./pages/Support'));
const Requirements = lazy(() => import('./pages/Requirements'));

// Legal Pages
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

// Error Pages
const NotFound = lazy(() => import('./pages/NotFound'));





function App() {
  return (
    <HelmetProvider>
      <Router>
        <CanonicalRedirect>
        <div className="App">
          <Header />
          <main className="main-content">
            <Suspense fallback={<LoadingSpinner />}>
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

                {/* Authentication Pages */}
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
                        canonicalUrl="https://infinitecargo.co.ke/forgot-password"
                      />
                      <ForgotPassword />
                    </>
                  }
                />
                
                <Route 
                  path="/reset-password"
                  element={
                    <>
                      <SEOHelmet 
                        title="Reset Password"
                        description="Create a new password for your Infinite Cargo account. Enter your new password to regain access to your account."
                        keywords="reset password, new password, account recovery, infinite cargo"
                        canonicalUrl="https://infinitecargo.co.ke/reset-password"
                      />
                      <ResetPassword />
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

                {/* Dashboard Pages */}
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
                  path="/driver/profile"
                  element={
                    <>
                      <SEOHelmet 
                        title="Driver Profile"
                        description="Manage your driver profile, update personal details, vehicle information, and contact preferences. Ensure your profile is complete for better job opportunities."
                        keywords="driver profile, update details, vehicle information, contact preferences"
                        canonicalUrl="https://infinitecargo.co.ke/driver/profile"
                      />
                      <DriverProfile />
                    </>
                  }
                />
                 <Route 
                  path="/driver/bids"
                  element={
                    <>
                      <SEOHelmet 
                        title="My Bids"
                        description="Manage your driver profile, update personal details, vehicle information, and contact preferences. Ensure your profile is complete for better job opportunities."
                        keywords="driver profile, update details, vehicle information, contact preferences"
                        canonicalUrl="https://infinitecargo.co.ke/driver/bids"
                      />
                      <DriverBidsPage />
                    </>
                  }
                />
                 <Route 
                  path="/bids/:id"
                  element={
                    <>
                      <SEOHelmet 
                        title="My Bids"
                        description="Manage your driver profile, update personal details, vehicle information, and contact preferences. Ensure your profile is complete for better job opportunities."
                        keywords="driver profile, update details, vehicle information, contact preferences"
                        canonicalUrl="https://infinitecargo.co.ke/bids/:id"
                      />
                      <BidDetails />
                    </>
                  }
                />
<Route
path="/loads/:id/bids"
element={
  <>
    <SEOHelmet 
      title="Load Bids"
      description="View and manage bids placed on your cargo load. Compare offers from drivers, communicate, and select the best bid for your transport needs."
      keywords="load bids, manage bids, cargo offers, driver bids"
      canonicalUrl="https://infinitecargo.co.ke/loads/:id/bids"
    />
    <LoadBidsPage />
  </>
} 
/> 

                 <Route 
                  path="/driver/earnings"
                  element={
                    <>
                      <SEOHelmet 
                        title="My Earnings"
                        description="Manage your driver profile, update personal details, vehicle information, and contact preferences. Ensure your profile is complete for better job opportunities."
                        keywords="driver profile, update details, vehicle information, contact preferences"
                        canonicalUrl="https://infinitecargo.co.ke/driver/earnings"
                      />
                      <DriverEarnings />
                    </>
                  }
                />
                <Route 
                  path="/driver/vehicles"
                  element={
                    <>
                      <SEOHelmet 
                        title="My Earnings"
                        description="Manage your driver profile, update personal details, vehicle information, and contact preferences. Ensure your profile is complete for better job opportunities."
                        keywords="driver profile, update details, vehicle information, contact preferences"
                        canonicalUrl="https://infinitecargo.co.ke/driver/vehicles"
                      />
                      <DriverVehiclesPage />
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

                <Route
                path="/loads/:id/tracking" 
                element={
                  <>
                  <SEOHelmet 
                    title="Load Tracking"
                    description="Track your cargo load in real-time. Get updates on pickup, transit, and delivery status directly from your dashboard."
                    keywords="load tracking, cargo status, real-time tracking, shipment updates"
                    canonicalUrl="https://infinitecargo.co.ke/loads/:id/tracking"
                  />
                  <LoadTracking />
                  </>
                }
                />

                <Route
                  path="/driver/jobs/:id/details"
                  element={
                    <>
                      <SEOHelmet 
                        title="Job Details"
                        description="View detailed information about your assigned cargo job including pickup location, delivery details, and payment information."
                        keywords="job details, cargo job, delivery information, driver assignment"
                        canonicalUrl="https://infinitecargo.co.ke/driver/job"
                      />
                      <DriverJobDetails />
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
                  path="/loads/:id" 
                  element={
                    <>
                      <SEOHelmet 
                        title="Load Details"
                        description="View detailed information about this cargo load including pickup and delivery locations, weight, and transport requirements."
                        keywords="load details, cargo information, freight details, shipping requirements Kenya"
                        canonicalUrl="https://infinitecargo.co.ke/loads"
                      />
                      <LoadDetail />
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

                {/* Support & Info Pages */}
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
                  path="/contact" 
                  element={
                    <>
                      <SEOHelmet 
                        title="Contact Us"
                        description="Get in touch with Infinite Cargo. Send us a message, call our support team, or visit our office in Nairobi, Kenya."
                        keywords="contact infinite cargo, customer service, support Kenya, get in touch"
                        canonicalUrl="https://infinitecargo.co.ke/contact"
                      />
                      <Contact />
                    </>
                  } 
                />

                <Route 
                  path="/faq" 
                  element={
                    <>
                      <SEOHelmet 
                        title="Frequently Asked Questions"
                        description="Find answers to frequently asked questions about Infinite Cargo services, driver requirements, cargo shipping, and platform usage."
                        keywords="FAQ, frequently asked questions, help Kenya, transport questions, cargo FAQ"
                        canonicalUrl="https://infinitecargo.co.ke/faq"
                      />
                      <FAQ />
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

                {/* Legacy URL Redirects */}
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
            </Suspense>
          </main>
          <Footer />
        </div>
      </CanonicalRedirect>
      </Router>
    </HelmetProvider>
  );
}

export default App;