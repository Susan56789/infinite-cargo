import React, { useState, useEffect } from 'react';
import { Truck, Package, Route, DollarSign, Shield, MapPin, Headphones, Network, ArrowRight, Rocket } from 'lucide-react';

const Home = () => {
  const [isVisible, setIsVisible] = useState({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({
              ...prev,
              [entry.target.id]: true
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    const sections = document.querySelectorAll('[data-animate]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const handleNavigation = (path) => {
    const urlMappings = {
      '/register': '/register',
      '/login': '/login',
      '/driver-register': 'register',
      '/cargo-register': 'register'
    };
    
    const targetUrl = urlMappings[path] || path;
    window.location.href = targetUrl;
  };

  const benefits = [
    { icon: Route, title: 'Reduce Empty Miles', desc: 'Help drivers find return loads and reduce transportation costs by up to 40%.' },
    { icon: DollarSign, title: 'Save Money', desc: 'Competitive bidding ensures best rates for cargo transportation.' },
    { icon: Shield, title: 'Secure & Safe', desc: 'Verified users and secure payment system for complete peace of mind.' },
    { icon: MapPin, title: 'Real-time Tracking', desc: 'Monitor your cargo throughout the journey with live GPS tracking.' },
    { icon: Headphones, title: '24/7 Support', desc: 'Our dedicated support team is available round the clock to assist you.' },
    { icon: Network, title: 'Wide Network', desc: 'Access to thousands of verified drivers and cargo owners nationwide.' }
  ];

  const testimonials = [
    { 
      quote: "Infinite Cargo has transformed my business. I no longer return empty and my income has increased by 60%!", 
      name: "John Kamau", 
      title: "Truck Driver, Nairobi", 
      avatar: "JK" 
    },
    { 
      quote: "Fast, reliable, and cost-effective. I've found trustworthy drivers for all my cargo shipments.", 
      name: "Mary Wanjiku", 
      title: "Cargo Owner, Mombasa", 
      avatar: "MW" 
    },
    { 
      quote: "The platform is easy to use and the support team is incredibly helpful. Highly recommended!", 
      name: "David Ochieng", 
      title: "Fleet Manager, Kisumu", 
      avatar: "DO" 
    }
  ];

  const processSteps = {
    driver: [
      'Register your truck details',
      'Enter your current location',
      'Search for available loads',
      'Bid on suitable loads',
      'Get paid securely'
    ],
    cargo: [
      'Post your cargo details',
      'Receive competitive bids',
      'Review driver profiles',
      'Choose your driver',
      'Track your shipment'
    ]
  };

  const ProcessCard = ({ type, icon: Icon, title, highlight, steps, buttonText, buttonClass }) => (
    <div className={`bg-white rounded-2xl shadow-2xl p-8 hover:shadow-3xl transition-all duration-500 transform hover:-translate-y-3 border border-gray-100 ${isVisible['how-it-works'] ? (type === 'driver' ? 'animate-slide-left' : 'animate-slide-right') : 'opacity-0'}`}>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${type === 'cargo' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
        <Icon size={32} />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-6">{title}</h3>
        <div className={`p-6 rounded-xl mb-8 ${type === 'cargo' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200' : 'bg-gradient-to-br from-sky-50 to-sky-100 border border-sky-200'}`}>
          <h4 className={`text-lg font-semibold mb-3 ${type === 'cargo' ? 'text-emerald-800' : 'text-sky-800'}`}>
            {highlight.title}
          </h4>
          <p className={`${type === 'cargo' ? 'text-emerald-700' : 'text-sky-700'}`}>
            {highlight.desc}
          </p>
        </div>
        
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Simple Process:</h4>
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start space-x-4">
                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md ${type === 'cargo' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-sky-500 to-sky-600'}`}>
                  {index + 1}
                </span>
                <span className="text-gray-700 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        
        <button 
          onClick={() => handleNavigation('/register')}
          className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${buttonClass === 'btn-success' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white' : 'bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white'}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 overflow-hidden" id="hero" data-animate>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-sky-800/50"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/20 to-blue-900/40"></div>
          {/* Animated background elements */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className={`${isVisible.hero ? 'animate-fade-up' : 'opacity-0'}`}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-sky-300 via-sky-200 to-white bg-clip-text text-transparent">
                Infinite Cargo
              </span>
            </h1>
            <p className="text-xl sm:text-2xl lg:text-3xl mb-6 text-sky-100 font-medium">
              Connect truck drivers with cargo owners across Kenya
            </p>
            <p className="text-lg sm:text-xl mb-12 text-blue-200 max-w-3xl mx-auto leading-relaxed">
              The smartest way to find loads, reduce empty miles, and grow your logistics business
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <button 
                onClick={() => handleNavigation('/register')}
                className="group bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-10 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-xl hover:shadow-2xl"
              >
                <span>Get Started Free</span>
                <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              <button 
                onClick={() => handleNavigation('/login')}
                className="bg-white/10 backdrop-blur-sm border-2 border-white/30 hover:bg-white/20 hover:border-white/50 text-white px-10 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105"
              >
                Login
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { number: '5,000+', label: 'Active Drivers' },
              { number: '1,200+', label: 'Cargo Owners' },
              { number: '15,000+', label: 'Loads Delivered' }
            ].map((stat, index) => (
              <div key={index} className={`text-center p-6 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 ${isVisible.hero ? 'animate-zoom-in' : 'opacity-0'}`} style={{ animationDelay: `${index * 0.2}s` }}>
                <div className="text-3xl sm:text-4xl font-bold text-sky-300 mb-2">{stat.number}</div>
                <div className="text-blue-200 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50" id="how-it-works" data-animate>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-20 ${isVisible['how-it-works'] ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-800 to-sky-600 bg-clip-text text-transparent mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Simple steps to connect and transform your logistics business</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <ProcessCard
              type="driver"
              icon={Truck}
              title="For Truck Drivers"
              highlight={{
                title: "Find Loads Easily",
                desc: "Never return empty again. Find cargo loads on your route back home."
              }}
              steps={processSteps.driver}
              buttonText="Register as Driver"
              buttonClass="btn-primary"
            />

            <ProcessCard
              type="cargo"
              icon={Package}
              title="For Cargo Owners"
              highlight={{
                title: "Ship Your Cargo",
                desc: "Find reliable truck drivers to transport your goods safely and affordably."
              }}
              steps={processSteps.cargo}
              buttonText="Register as Cargo Owner"
              buttonClass="btn-success"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white" id="benefits" data-animate>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-20 ${isVisible.benefits ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-800 to-sky-600 bg-clip-text text-transparent mb-6">
              Why Choose Infinite Cargo?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Trusted by thousands across Kenya for reliable cargo transportation</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <div 
                  key={index}
                  className={`group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-gray-100 hover:border-sky-200 ${isVisible.benefits ? 'animate-fade-up' : 'opacity-0'}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-sky-100 to-sky-200 rounded-2xl flex items-center justify-center mb-6 text-sky-600 group-hover:scale-110 transition-transform duration-300">
                    <IconComponent size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-sky-700 transition-colors duration-300">{benefit.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{benefit.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50" id="testimonials" data-animate>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-20 ${isVisible.testimonials ? 'animate-fade-up' : 'opacity-0'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-800 to-sky-600 bg-clip-text text-transparent mb-6">
              What Our Users Say
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Real stories from real users who transformed their businesses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className={`bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 ${isVisible.testimonials ? 'animate-slide-up' : 'opacity-0'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-6">
                  <div className="flex mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-700 text-lg leading-relaxed italic">"{testimonial.quote}"</p>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-sky-500 to-sky-600 rounded-full flex items-center justify-center text-white font-bold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sky-600 text-sm font-medium">{testimonial.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 overflow-hidden" id="cta" data-animate>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-600/90 to-blue-700/90"></div>
          {/* Animated background elements */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className={`${isVisible.cta ? 'animate-zoom-in' : 'opacity-0'}`}>
            <h2 className="text-4xl sm:text-5xl font-bold mb-8 leading-tight">Ready to Get Started?</h2>
            <p className="text-xl mb-12 text-sky-100 max-w-2xl mx-auto leading-relaxed">
              Join thousands of drivers and cargo owners already using Infinite Cargo to grow their businesses
            </p>
            <div className="mb-8">
              <button 
                onClick={() => handleNavigation('/register')}
                className="group bg-white text-sky-600 hover:bg-gray-50 px-12 py-5 rounded-xl text-xl font-bold transition-all duration-300 transform hover:scale-105 flex items-center justify-center mx-auto shadow-2xl hover:shadow-3xl"
              >
                <span>Sign Up Now - It's Free!</span>
                <Rocket size={24} className="ml-3 group-hover:rotate-12 transition-transform duration-300" />
              </button>
            </div>
            <p className="text-sky-200 text-lg">No credit card required • Get started in 2 minutes</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;