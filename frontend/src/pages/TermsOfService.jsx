import React from 'react';
import { Shield, FileText, CreditCard, RefreshCw, AlertTriangle, Edit, Mail, Phone } from 'lucide-react';

const TermsOfService = () => {
  const sections = [
    {
      id: 1,
      icon: Shield,
      title: "Use of Services",
      content: "You agree to use our services only for lawful purposes. Misuse, unauthorized access, or any fraudulent activities are strictly prohibited."
    },
    {
      id: 2,
      icon: FileText,
      title: "User Responsibilities",
      content: "You are responsible for providing accurate shipping information and complying with all applicable laws regarding cargo content."
    },
    {
      id: 3,
      icon: CreditCard,
      title: "Payments",
      content: "Payments must be made through approved channels before dispatch. Pricing may vary depending on cargo type, distance, and service selected."
    },
    {
      id: 4,
      icon: RefreshCw,
      title: "Cancellations and Refunds",
      content: "Cancellations should be made within 1 hour of booking. Refunds are processed within 7 working days where applicable."
    },
    {
      id: 5,
      icon: AlertTriangle,
      title: "Limitation of Liability",
      content: "We are not liable for indirect damages, delays, or losses caused by circumstances beyond our control."
    },
    {
      id: 6,
      icon: Edit,
      title: "Changes to Terms",
      content: "We reserve the right to modify these terms at any time. Updates will be posted on our website and become effective immediately."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-600 via-primary-700 to-secondary-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-8">
            <FileText size={40} />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Terms of Service</h1>
          <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto leading-relaxed">
            These Terms of Service govern your use of the Infinite Cargo platform. By accessing our website or services, you agree to be bound by these terms.
          </p>
          <div className="mt-8 text-sm text-primary-200">
            Last updated: August 2025
          </div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="space-y-8">
            {sections.map((section, index) => (
              <div 
                key={section.id}
                className="group bg-white rounded-3xl p-8 md:p-10 shadow-xl hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-primary-200"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-600 group-hover:scale-110 transition-transform duration-300">
                      <section.icon size={28} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-2xl font-bold text-primary-600">{section.id}.</span>
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-800">{section.title}</h2>
                    </div>
                    <p className="text-lg text-slate-700 leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-gradient-to-r from-slate-100 to-slate-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-white rounded-3xl p-10 md:p-12 shadow-2xl">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-8 text-white">
              <Mail size={32} />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">Need Clarification?</h2>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto">
              For any questions or clarifications regarding these terms, don't hesitate to reach out to our support team.
            </p>
            
            <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
              <a 
                href="mailto:support@infinitecargo.co.ke"
                className="group flex items-center gap-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Mail size={24} />
                support@infinitecargo.co.ke
              </a>
              
              <a 
                href="tel:+254722483468"
                className="group flex items-center gap-4 bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <Phone size={24} />
                +254 722 483 468
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="py-12 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-start gap-6 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-amber-200">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Important Notice</h3>
              <p className="text-slate-700 leading-relaxed">
                By continuing to use Infinite Cargo services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. These terms may be updated periodically, and continued use of our services constitutes acceptance of any changes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsOfService;