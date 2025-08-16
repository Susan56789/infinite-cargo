import React from 'react';
import { 
  UserPlus, 
  Package, 
  Users, 
  MapPin, 
  Truck, 
  Search, 
  DollarSign, 
  Award,
  ArrowRight,
  CheckCircle,
  Star,
  Shield,
  Clock
} from 'lucide-react';

const HowItWorks = () => {
  const cargoOwnerSteps = [
    {
      step: 1,
      title: "Register or Log In",
      description: "Create your cargo owner account to access the dashboard and post your shipment requirements.",
      icon: UserPlus,
      color: "bg-blue-500",
      lightColor: "bg-blue-50",
      textColor: "text-blue-600"
    },
    {
      step: 2,
      title: "Post Your Load",
      description: "Submit cargo details—pickup location, destination, weight, type, and expected delivery time.",
      icon: Package,
      color: "bg-green-500",
      lightColor: "bg-green-50",
      textColor: "text-green-600"
    },
    {
      step: 3,
      title: "Receive Driver Bids",
      description: "View quotes from verified drivers and compare rates, ratings, and availability in real-time.",
      icon: Users,
      color: "bg-purple-500",
      lightColor: "bg-purple-50",
      textColor: "text-purple-600"
    },
    {
      step: 4,
      title: "Book & Track",
      description: "Select the best driver, confirm the booking, and track your shipment status from your dashboard.",
      icon: MapPin,
      color: "bg-orange-500",
      lightColor: "bg-orange-50",
      textColor: "text-orange-600"
    }
  ];

  const driverSteps = [
    {
      step: 1,
      title: "Register as a Driver",
      description: "Create your driver account and upload the necessary documents (license, insurance, vehicle details).",
      icon: UserPlus,
      color: "bg-indigo-500",
      lightColor: "bg-indigo-50",
      textColor: "text-indigo-600"
    },
    {
      step: 2,
      title: "Search Available Loads",
      description: "Filter and browse cargo loads that match your route, vehicle capacity, and schedule.",
      icon: Search,
      color: "bg-cyan-500",
      lightColor: "bg-cyan-50",
      textColor: "text-cyan-600"
    },
    {
      step: 3,
      title: "Bid & Get Hired",
      description: "Submit competitive bids to cargo owners and negotiate terms directly through the platform.",
      icon: DollarSign,
      color: "bg-emerald-500",
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600"
    },
    {
      step: 4,
      title: "Deliver & Earn",
      description: "Complete your delivery, get rated, and grow your reputation. Earnings are tracked in your dashboard.",
      icon: Award,
      color: "bg-amber-500",
      lightColor: "bg-amber-50",
      textColor: "text-amber-600"
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: "Verified Users",
      description: "All drivers are verified with proper documentation"
    },
    {
      icon: Clock,
      title: "Real-time Tracking",
      description: "Monitor your shipments from pickup to delivery"
    },
    {
      icon: Star,
      title: "Rating System",
      description: "Build trust through our comprehensive rating system"
    }
  ];

  const StepCard = ({ step, isDriver = false }) => {
    const Icon = step.icon;
    const isLast = step.step === 4;
    
    return (
      <div className="relative group">
        {/* Connection Line */}
        {!isLast && (
          <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-300 transform translate-x-1/2 z-0">
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        )}
        
        {/* Card */}
        <div className="relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 group-hover:-translate-y-2 z-10">
          {/* Step Number */}
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${step.color} text-white font-bold text-lg mb-4 shadow-lg`}>
            {step.step}
          </div>
          
          {/* Icon */}
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl ${step.lightColor} mb-4 ml-2`}>
            <Icon className={`w-8 h-8 ${step.textColor}`} />
          </div>
          
          {/* Content */}
          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
            {step.title}
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {step.description}
          </p>
          
          {/* Hover Effect Badge */}
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>
    );
  };

  const BenefitCard = ({ benefit }) => {
    const Icon = benefit.icon;
    
    return (
      <div className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">{benefit.title}</h4>
          <p className="text-gray-600 text-sm">{benefit.description}</p>
        </div>
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-16">
        {/* Header Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg">
            <Truck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            How It Works
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Whether you're a cargo owner or a verified driver, Infinite Cargo makes transport 
            <span className="font-semibold text-blue-600"> easy, fast, and reliable</span>. 
            Here's your step-by-step guide to Kenya's most trusted logistics network.
          </p>
        </div>

        {/* Benefits Overview */}
        <div className="mb-20">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Why Choose Infinite Cargo?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <BenefitCard key={index} benefit={benefit} />
              ))}
            </div>
          </div>
        </div>

        {/* Cargo Owner Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-xl mb-4">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              For Cargo Owners
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ship your goods with confidence. Post your load and let verified drivers compete for your business.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {cargoOwnerSteps.map((step) => (
              <StepCard key={step.step} step={step} />
            ))}
          </div>
        </div>

        {/* Driver Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-xl mb-4">
              <Truck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              For Drivers
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Turn your vehicle into a profitable business. Find loads that match your route and schedule.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {driverSteps.map((step) => (
              <StepCard key={step.step} step={step} isDriver={true} />
            ))}
          </div>
        </div>

        {/* Statistics Section */}
        <div className="mb-20">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold mb-2">Join Thousands of Users</h3>
              <p className="text-blue-100">Making logistics simple across Kenya</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold mb-2">10,000+</div>
                <div className="text-blue-100">Successful Deliveries</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">2,500+</div>
                <div className="text-blue-100">Verified Drivers</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">1,200+</div>
                <div className="text-blue-100">Happy Cargo Owners</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-white rounded-2xl shadow-xl p-12 border border-gray-100">
            <div className="mb-8">
              <h3 className="text-4xl font-bold text-gray-900 mb-4">
                Start Moving Smarter Today
              </h3>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Join Kenya's most trusted logistics network. Whether you need a truck or are ready to drive one, 
                <span className="font-semibold text-blue-600"> Infinite Cargo connects you with opportunity</span>.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6 mb-8">
              <a
                href="/register"
                className="group bg-blue-600 text-white px-8 py-4 rounded-xl hover:bg-blue-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="flex items-center justify-center">
                  Register as Cargo Owner
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
              <a
                href="/register"
                className="group bg-gray-800 text-white px-8 py-4 rounded-xl hover:bg-gray-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <span className="flex items-center justify-center">
                  Register as Driver
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
            </div>
            
            <p className="text-gray-500">
              Already have an account? 
              <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                Sign in here
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;