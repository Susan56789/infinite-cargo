import React from 'react';
import { Shield, Database, Users, Lock, UserCheck, RefreshCw, Calendar, Eye, Share, CheckCircle } from 'lucide-react';

const PrivacyPolicy = () => {
  const sections = [
    {
      id: 1,
      icon: Database,
      title: "Information We Collect",
      content: "We may collect personal identification information such as your name, email address, phone number, and business details. Non-personal information such as browser type, IP address, and referring pages may also be collected automatically.",
      gradient: "from-blue-400 to-blue-600"
    },
    {
      id: 2,
      icon: Eye,
      title: "How We Use Your Information",
      content: "The information we collect may be used to:",
      list: [
        "Facilitate cargo bookings and communication",
        "Improve customer service and user experience", 
        "Send promotional or transactional emails",
        "Analyze usage for product improvement"
      ],
      gradient: "from-green-400 to-emerald-600"
    },
    {
      id: 3,
      icon: Share,
      title: "Sharing of Information",
      content: "We do not sell, trade, or rent users' personal identification information to others. We may share data with trusted service providers who assist in operating our website or servicing you, as long as they agree to keep it confidential.",
      gradient: "from-purple-400 to-purple-600"
    },
    {
      id: 4,
      icon: Lock,
      title: "Data Protection",
      content: "We adopt appropriate security measures to protect your data from unauthorized access, alteration, or disclosure. However, no method of transmission over the Internet is 100% secure.",
      gradient: "from-red-400 to-red-600"
    },
    {
      id: 5,
      icon: UserCheck,
      title: "Your Rights",
      content: "You have the right to access, correct, or request deletion of your personal data at any time. You may also opt out of receiving marketing emails from us.",
      gradient: "from-orange-400 to-orange-600"
    },
    {
      id: 6,
      icon: RefreshCw,
      title: "Updates to This Policy",
      content: "Infinite Cargo reserves the right to update this privacy policy at any time. Updates will be posted on this page with a revised date.",
      gradient: "from-teal-400 to-teal-600"
    }
  ];

  const keyPrinciples = [
    {
      icon: Shield,
      title: "Privacy First",
      description: "Your data privacy is our top priority"
    },
    {
      icon: Lock,
      title: "Secure Storage", 
      description: "Bank-level encryption protects your information"
    },
    {
      icon: UserCheck,
      title: "Your Control",
      description: "Full control over your personal data"
    },
    {
      icon: CheckCircle,
      title: "Transparency",
      description: "Clear and honest data practices"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-8">
            <Shield size={40} />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Privacy Policy</h1>
          <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto leading-relaxed mb-8">
            At Infinite Cargo Kenya, your privacy is of utmost importance. This policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
          </p>
          <div className="flex items-center justify-center gap-2 text-primary-200">
            <Calendar size={20} />
            <span className="text-lg">Effective Date: August 1, 2025</span>
          </div>
        </div>
      </section>

      {/* Key Principles */}
      <section className="py-20 -mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">Our Privacy Principles</h2>
            <p className="text-xl text-slate-600">Core values that guide how we handle your data</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {keyPrinciples.map((principle, index) => (
              <div key={index} className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl mb-6 text-primary-600 group-hover:scale-110 transition-transform duration-300">
                  <principle.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{principle.title}</h3>
                <p className="text-slate-600 leading-relaxed">{principle.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="space-y-8">
            {sections.map((section, index) => (
              <div 
                key={section.id}
                className="group bg-gradient-to-r from-slate-50 to-white rounded-3xl p-8 md:p-10 shadow-lg hover:shadow-xl transition-all duration-500 border border-slate-100 hover:border-primary-200"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.gradient} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                      <section.icon size={28} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-2xl font-bold text-primary-600">{section.id}.</span>
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{section.title}</h2>
                    </div>
                    <p className="text-lg text-slate-700 leading-relaxed mb-4">
                      {section.content}
                    </p>
                    {section.list && (
                      <div className="space-y-3">
                        {section.list.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-1">
                              <CheckCircle size={14} className="text-green-600" />
                            </div>
                            <span className="text-slate-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Rights Section */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">Your Data Rights</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              You have full control over your personal information. Here's what you can do:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Access Your Data", desc: "Request a copy of all personal data we hold about you", icon: Eye },
              { title: "Correct Information", desc: "Update or correct any inaccurate personal information", icon: RefreshCw },
              { title: "Delete Your Data", desc: "Request deletion of your personal data from our systems", icon: UserCheck },
              { title: "Data Portability", desc: "Export your data in a machine-readable format", icon: Database },
              { title: "Opt-out Marketing", desc: "Unsubscribe from marketing communications anytime", icon: Shield },
              { title: "Withdraw Consent", desc: "Withdraw consent for data processing at any time", icon: Lock }
            ].map((right, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl flex items-center justify-center text-primary-600 flex-shrink-0">
                    <right.icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{right.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{right.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl p-10 md:p-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-8 text-white">
              <Users size={32} />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">Questions About Your Privacy?</h2>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
              Our privacy team is here to help. Contact us for any questions about how we handle your personal data.
            </p>
            
            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              <a 
                href="mailto:privacy@infinitecargo.co.ke"
                className="group flex items-center gap-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Shield size={24} />
                privacy@infinitecargo.co.ke
              </a>
              
              <button className="group flex items-center gap-4 bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                <Database size={24} />
                Request My Data
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Last Updated Notice */}
      <section className="py-8 bg-gradient-to-r from-slate-100 to-slate-200 border-t border-slate-300">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <Calendar size={20} />
            <span className="text-lg">Last updated: August 1, 2025</span>
          </div>
          <p className="text-slate-500 mt-2">
            We'll notify you of any material changes to this privacy policy
          </p>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;