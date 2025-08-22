import React, { useState } from 'react';
import { 
  Truck, 
  Package, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  CreditCard,
  Phone,
  MapPin,
  Clock,
  Weight,
  Ruler,
  Download,
  ExternalLink,
  User,
  Award,
  Target
} from 'lucide-react';

const Requirements = () => {
  const [activeTab, setActiveTab] = useState('driver');

  // Driver Requirements Data
  const driverRequirements = {
    personal: [
      {
        icon: <User size={24} />,
        title: "Personal Requirements",
        items: [
          "Must be 21+ years old",
          "Valid Kenyan National ID",
          "Clean criminal background check",
          "Professional attitude and appearance",
          "Basic English and Swahili proficiency"
        ]
      },
      {
        icon: <FileText size={24} />,
        title: "Documentation",
        items: [
          "Valid driving license (Class C or above)",
          "PSV license (for commercial transport)",
          "Certificate of Good Conduct",
          "Tax Compliance Certificate (TCC)",
          "Business permit (if applicable)"
        ]
      }
    ],
    vehicle: [
      {
        icon: <Truck size={24} />,
        title: "Vehicle Requirements",
        items: [
          "Vehicle manufactured within last 15 years",
          "Valid vehicle registration (logbook)",
          "Current vehicle inspection certificate",
          "Road-worthy condition with no major defects",
          "Adequate cargo space and tie-down points"
        ]
      },
      {
        icon: <Shield size={24} />,
        title: "Insurance & Safety",
        items: [
          "Comprehensive vehicle insurance",
          "Third-party liability coverage minimum KES 1M",
          "Cargo insurance coverage",
          "First aid kit and fire extinguisher",
          "Reflective triangles and safety vest"
        ]
      }
    ],
    technology: [
      {
        icon: <Phone size={24} />,
        title: "Technology Requirements",
        items: [
          "Smartphone with Android 8.0+ or iOS 12+",
          "Reliable internet connection",
          "GPS functionality enabled",
          "Camera for documentation",
          "Mobile money account (M-Pesa/Airtel)"
        ]
      },
      {
        icon: <CreditCard size={24} />,
        title: "Financial Requirements",
        items: [
          "Valid bank account",
          "Mobile money account",
          "KRA PIN certificate",
          "Minimum deposit for platform activation",
          "Credit check may be required"
        ]
      }
    ]
  };

  // Shipping Guide Data
  const shippingGuide = {
    preparation: [
      {
        icon: <Package size={24} />,
        title: "Cargo Preparation",
        steps: [
          "Measure and weigh your cargo accurately",
          "Take clear photos from multiple angles",
          "Create detailed inventory list",
          "Package fragile items with extra protection",
          "Label packages clearly with contents"
        ]
      },
      {
        icon: <FileText size={24} />,
        title: "Documentation Required",
        steps: [
          "Commercial invoice or receipt",
          "Detailed packing list",
          "Insurance documentation if applicable",
          "Special permits for restricted items",
          "Delivery instructions and contact details"
        ]
      }
    ],
    restrictions: [
      {
        icon: <AlertTriangle size={24} />,
        title: "Prohibited Items",
        items: [
          "Hazardous materials and chemicals",
          "Illegal drugs and substances",
          "Weapons and ammunition",
          "Live animals (without permits)",
          "Perishable food without proper packaging",
          "Valuable items above KES 500,000",
          "Items exceeding vehicle capacity"
        ]
      },
      {
        icon: <Shield size={24} />,
        title: "Restricted Items",
        items: [
          "Electronics require special handling",
          "Fragile items need extra packaging",
          "Liquids must be properly sealed",
          "Heavy machinery requires permits",
          "Documents need waterproof packaging"
        ]
      }
    ],
    bestPractices: [
      {
        icon: <CheckCircle size={24} />,
        title: "Best Practices",
        tips: [
          "Book transport 24-48 hours in advance",
          "Communicate clearly with selected driver",
          "Be present during pickup and delivery",
          "Keep receipts and documentation",
          "Provide accurate pickup/delivery addresses",
          "Have backup contact numbers available"
        ]
      }
    ]
  };

  const vehicleTypes = [
    {
      type: "Pickup Truck",
      capacity: "Up to 1.5 tons",
      dimensions: "2.5m x 1.8m x 1.5m",
      suitable: "Small cargo, furniture, appliances"
    },
    {
      type: "Small Lorry",
      capacity: "3-5 tons",
      dimensions: "4m x 2m x 2m",
      suitable: "Medium cargo, construction materials"
    },
    {
      type: "Medium Truck",
      capacity: "7-10 tons",
      dimensions: "6m x 2.4m x 2.5m",
      suitable: "Large cargo, wholesale goods"
    },
    {
      type: "Large Truck",
      capacity: "15+ tons",
      dimensions: "12m x 2.4m x 3m",
      suitable: "Heavy machinery, bulk goods"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-sky-800/30"></div>
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-sky-300 via-sky-200 to-white bg-clip-text text-transparent">
              Requirements & Guidelines
            </h1>
            <p className="text-xl sm:text-2xl text-sky-100 max-w-3xl mx-auto leading-relaxed">
              Everything you need to know about joining as a driver or shipping your cargo safely
            </p>
            
            {/* Tab Navigation */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 max-w-2xl mx-auto">
              <button
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'driver'
                    ? 'bg-white text-blue-800 shadow-lg'
                    : 'bg-white/10 backdrop-blur-sm text-white border border-white/30 hover:bg-white/20'
                }`}
                onClick={() => setActiveTab('driver')}
              >
                <Truck size={24} />
                Driver Requirements
              </button>
              <button
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                  activeTab === 'shipping'
                    ? 'bg-white text-blue-800 shadow-lg'
                    : 'bg-white/10 backdrop-blur-sm text-white border border-white/30 hover:bg-white/20'
                }`}
                onClick={() => setActiveTab('shipping')}
              >
                <Package size={24} />
                Shipping Guide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Driver Requirements Tab */}
      {activeTab === 'driver' && (
        <>
          {/* Requirements Overview */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="group bg-gradient-to-br from-sky-50 to-sky-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-sky-200">
                  <div className="w-16 h-16 bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Award className="text-white" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Professional Standards</h3>
                  <p className="text-gray-600 leading-relaxed">We maintain high standards to ensure quality service and customer satisfaction</p>
                </div>
                <div className="group bg-gradient-to-br from-emerald-50 to-emerald-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-emerald-200">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Shield className="text-white" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Safety First</h3>
                  <p className="text-gray-600 leading-relaxed">Comprehensive insurance and safety requirements protect everyone involved</p>
                </div>
                <div className="group bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-purple-200">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Target className="text-white" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Growth Opportunities</h3>
                  <p className="text-gray-600 leading-relaxed">Access to steady income and business growth opportunities across Kenya</p>
                </div>
              </div>
            </div>
          </section>

          {/* Detailed Requirements */}
          <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Driver Requirements Checklist</h2>
              
              {/* Personal & Documentation */}
              <div className="mb-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Personal & Documentation Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {driverRequirements.personal.map((category, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                            {category.icon}
                          </div>
                          <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                        </div>
                      </div>
                      <div className="p-6">
                        <ul className="space-y-3">
                          {category.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-3">
                              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-1" />
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle & Insurance */}
              <div className="mb-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Vehicle & Insurance Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {driverRequirements.vehicle.map((category, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                            {category.icon}
                          </div>
                          <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                        </div>
                      </div>
                      <div className="p-6">
                        <ul className="space-y-3">
                          {category.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-3">
                              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-1" />
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technology & Financial */}
              <div className="mb-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Technology & Financial Requirements</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {driverRequirements.technology.map((category, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            {category.icon}
                          </div>
                          <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                        </div>
                      </div>
                      <div className="p-6">
                        <ul className="space-y-3">
                          {category.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-3">
                              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-1" />
                              <span className="text-gray-700">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Vehicle Types */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Accepted Vehicle Types</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {vehicleTypes.map((vehicle, index) => (
                  <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl flex items-center justify-center mb-6">
                      <Truck size={32} className="text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">{vehicle.type}</h4>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Weight size={16} className="text-sky-500" />
                        <span className="text-sm">Capacity: {vehicle.capacity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Ruler size={16} className="text-sky-500" />
                        <span className="text-sm">Size: {vehicle.dimensions}</span>
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm"><span className="font-semibold">Suitable for:</span> {vehicle.suitable}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Application Process */}
          <section className="py-20 bg-gradient-to-br from-sky-50 to-blue-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">How to Apply</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  {
                    number: 1,
                    title: "Complete Registration",
                    desc: "Fill out the driver registration form with all required information"
                  },
                  {
                    number: 2,
                    title: "Submit Documents", 
                    desc: "Upload clear photos of all required documents and vehicle photos"
                  },
                  {
                    number: 3,
                    title: "Verification Process",
                    desc: "Our team reviews your application and conducts background checks"
                  },
                  {
                    number: 4,
                    title: "Account Activation",
                    desc: "Once approved, your account is activated and you can start bidding on loads"
                  }
                ].map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-sky-500 to-sky-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                      {step.number}
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">{step.title}</h4>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Shipping Guide Tab */}
      {activeTab === 'shipping' && (
        <>
          {/* Shipping Overview */}
          <section className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">Complete Shipping Guide</h2>
              <p className="text-xl text-gray-600 leading-relaxed">Everything you need to know about shipping your cargo safely and efficiently</p>
            </div>
          </section>

          {/* Preparation Guidelines */}
          <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Prepare Your Cargo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {shippingGuide.preparation.map((category, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                    <div className="p-6 border-b border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                          {category.icon}
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                      </div>
                    </div>
                    <div className="p-6">
                      <ol className="space-y-3">
                        {category.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {stepIndex + 1}
                            </span>
                            <span className="text-gray-700">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Shipping Restrictions */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Shipping Restrictions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {shippingGuide.restrictions.map((category, index) => (
                  <div key={index} className={`rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all duration-300 ${
                    category.title.includes('Prohibited') 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className={`p-6 border-b ${
                      category.title.includes('Prohibited') 
                        ? 'border-red-100' 
                        : 'border-yellow-100'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          category.title.includes('Prohibited')
                            ? 'bg-red-100 text-red-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {category.icon}
                        </div>
                        <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                      </div>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-3">
                        {category.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                              category.title.includes('Prohibited') 
                                ? 'bg-red-400' 
                                : 'bg-yellow-400'
                            }`}></div>
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Best Practices */}
          <section className="py-20 bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Best Practices for Shipping</h2>
              {shippingGuide.bestPractices.map((category, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        {category.icon}
                      </div>
                      <h4 className="text-xl font-bold text-gray-900">{category.title}</h4>
                    </div>
                  </div>
                  <div className="p-6">
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.tips.map((tip, tipIndex) => (
                        <li key={tipIndex} className="flex items-start gap-3">
                          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-1" />
                          <span className="text-gray-700">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Shipping Process */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">How Shipping Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  {
                    number: 1,
                    title: "Create Shipment",
                    desc: "Post your cargo details including pickup and delivery locations"
                  },
                  {
                    number: 2,
                    title: "Receive Bids",
                    desc: "Qualified drivers submit competitive bids for your shipment"
                  },
                  {
                    number: 3,
                    title: "Select Driver",
                    desc: "Review driver profiles, ratings, and bids to make your selection"
                  },
                  {
                    number: 4,
                    title: "Track & Deliver",
                    desc: "Track your cargo in real-time until safe delivery at destination"
                  }
                ].map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                      {step.number}
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">{step.title}</h4>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Information */}
          <section className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-16">Pricing Guidelines</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <MapPin size={32} />,
                    title: "Distance-Based",
                    desc: "Pricing calculated based on pickup and delivery locations",
                    features: ["Per kilometer rates", "City vs highway pricing", "Return trip considerations"]
                  },
                  {
                    icon: <Weight size={32} />,
                    title: "Weight & Size", 
                    desc: "Additional charges for heavy or oversized cargo",
                    features: ["Weight-based tiers", "Dimensional pricing", "Special handling fees"]
                  },
                  {
                    icon: <Clock size={32} />,
                    title: "Time Factors",
                    desc: "Rush deliveries and timing preferences affect pricing",
                    features: ["Express delivery rates", "Weekend premiums", "Off-peak discounts"]
                  }
                ].map((pricing, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 text-white">
                      {pricing.icon}
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">{pricing.title}</h4>
                    <p className="text-gray-600 mb-6 leading-relaxed">{pricing.desc}</p>
                    <ul className="space-y-2">
                      {pricing.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-2 text-gray-700">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Call to Action */}
      <section className="py-20 bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-600/90 to-blue-700/90"></div>
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          {activeTab === 'driver' ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Join Our Driver Network?</h2>
              <p className="text-xl text-sky-100 mb-12 leading-relaxed">Start earning with reliable transport jobs across Kenya</p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <a href='/register' className="group bg-white text-sky-600 hover:bg-gray-50 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-xl">
                  <User size={20} className="mr-3" />
                 Sign Up
                </a>
                <a href='/login' className="group bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                  <Download size={20} className="mr-3" />
                  Login 
                </a>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Ship Your Cargo?</h2>
              <p className="text-xl text-sky-100 mb-12 leading-relaxed">Get competitive bids from verified drivers in minutes</p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <a href='/register' className="group bg-white text-sky-600 hover:bg-gray-50 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-xl">
                  <Package size={20} className="mr-3" />
                  Post Shipment
                </a>
                <a href='/search-loads' className="group bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                  <ExternalLink size={20} className="mr-3" />
                 View Loads
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Requirements;