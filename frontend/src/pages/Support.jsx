import React, { useState } from 'react';
import { 
  Phone, 
  Mail, 
  HelpCircle, 
  Truck, 
  Package, 
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const Support = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqData = {
    general: [
      {
        id: 1,
        question: "What is Infinite Cargo?",
        answer: "Infinite Cargo is Kenya's leading digital platform that connects cargo owners with professional drivers. We facilitate safe, efficient, and affordable transportation of goods across the country through our user-friendly app and web platform."
      },
      {
        id: 2,
        question: "How does Infinite Cargo work?",
        answer: "Our platform works in three simple steps: 1) Cargo owners post their transport needs with details like pickup/delivery locations, cargo type, and preferred dates. 2) Verified drivers browse available loads and submit competitive bids. 3) Cargo owners review bids, select their preferred driver, and complete the booking with secure payment processing."
      },
      {
        id: 3,
        question: "Is Infinite Cargo available throughout Kenya?",
        answer: "Yes! We operate across all 47 counties in Kenya. Whether you're shipping from Nairobi to Mombasa, Kisumu to Eldoret, or any route in between, our network of drivers covers the entire country."
      },
      {
        id: 4,
        question: "How much does it cost to use Infinite Cargo?",
        answer: "Registration is completely free for drivers. Cargo owners pay a monthly subscription fee to post loads and access our driver network. There are no transaction fees - cargo owners pay drivers directly upon agreement."
      },
      {
        id: 5,
        question: "How do I track my shipment?",
        answer: "Once your cargo is picked up, you'll receive real-time tracking updates through SMS and in-app notifications. You can track your shipment's progress, view driver location, and get delivery confirmations directly from your dashboard."
      }
    ],
    drivers: [
      {
        id: 6,
        question: "What are the requirements to become a driver?",
        answer: "To join as a driver, you need: Valid driving license (Class C or above), vehicle registration documents, comprehensive insurance, clean driving record, smartphone with internet access, and basic smartphone skills. Full details are available in our Requirements section."
      },
      {
        id: 7,
        question: "How do I find loads to transport?",
        answer: "After registration, browse available loads in the 'Find Loads' section. Use filters to find loads matching your vehicle type, route preferences, and availability. You can submit bids on multiple loads and cargo owners will review and select drivers."
      },
      {
        id: 8,
        question: "How do I get paid?",
        answer: "Payment is arranged directly between you and the cargo owner. Once you complete a delivery and the cargo owner confirms receipt, they will pay you according to your agreed terms - whether cash, mobile money, or bank transfer."
      },
      {
        id: 9,
        question: "What if there's damage to cargo during transport?",
        answer: "All registered drivers must have comprehensive insurance. In case of damage, immediately report the incident through the app, document with photos, and contact our support team. We'll guide you through the insurance claim process."
      },
      {
        id: 10,
        question: "Can I reject a load after accepting it?",
        answer: "While we encourage commitment to accepted loads, emergencies happen. Contact the cargo owner immediately and our support team. Frequent cancellations may affect your driver rating and future opportunities."
      }
    ],
    cargo: [
      {
        id: 11,
        question: "How do I post a load?",
        answer: "Click 'Post Load' from your dashboard, fill in details including pickup/delivery locations, cargo description, weight, dimensions, preferred pickup date, and budget. Add photos if helpful. Your load will be visible to relevant drivers immediately."
      },
      {
        id: 12,
        question: "How do I choose the right driver?",
        answer: "Review driver profiles including ratings, reviews, vehicle details, and experience. Check their bid amount, estimated delivery time, and insurance coverage. You can message drivers directly to discuss specific requirements before making your selection."
      },
      {
        id: 13,
        question: "How do I pay the driver?",
        answer: "You pay the driver directly according to your agreement. Payment methods can include cash, M-Pesa, Airtel Money, or bank transfer - whatever you and the driver agree upon. Infinite Cargo does not handle payments between cargo owners and drivers."
      },
      {
        id: 14,
        question: "What items cannot be transported?",
        answer: "Prohibited items include hazardous materials, illegal substances, live animals (without proper permits), perishables without proper packaging, and items exceeding vehicle capacity. Contact support if unsure about specific items."
      },
      {
        id: 15,
        question: "What if my cargo is damaged or lost?",
        answer: "Immediately report any issues through the app. All drivers carry comprehensive insurance. Document damage with photos and contact our support team within 24 hours. We'll facilitate the insurance claim process and work toward resolution."
      }
    ]
  };

  const filteredFaqs = faqData[activeTab].filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFaq = (faqId) => {
    setExpandedFaq(expandedFaq === faqId ? null : faqId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">How Can We Help You?</h1>
          <p className="text-xl md:text-2xl mb-10 text-primary-100 max-w-3xl mx-auto">Find answers to your questions or get in touch with our support team</p>
          
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400" size={24} />
            <input
              type="text"
              placeholder="Search for help articles, FAQs, guides..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-6 py-5 text-lg bg-white/95 backdrop-blur-sm border-0 rounded-2xl text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-20 -mt-16 relative z-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Phone className="text-slate-600" size={32} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Call Us</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">Speak directly with our support team</p>
              <a href="tel:+254723139610" className="block text-center py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 bg-blue-500 hover:bg-blue-600">
                +254723 139 610
              </a>
            </div>

            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Mail className="text-slate-600" size={32} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Email Support</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">Send us a detailed message</p>
              <a href="mailto:support@infinitecargo.co.ke" className="block text-center py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 bg-purple-500 hover:bg-purple-600">
                Email Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6">Frequently Asked Questions</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">Browse by category to find answers to common questions</p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center mb-12">
            <div className="bg-slate-100 rounded-2xl p-2 inline-flex gap-2">
              {[
                { key: 'general', label: 'General Help', icon: HelpCircle },
                { key: 'drivers', label: 'For Drivers', icon: Truck },
                { key: 'cargo', label: 'For Cargo Owners', icon: Package }
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all duration-300 ${
                    activeTab === tab.key 
                      ? 'bg-white text-primary-600 shadow-lg scale-105' 
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon size={20} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ List */}
          <div className="max-w-4xl mx-auto">
            <div className="mb-8 text-center">
              <span className="text-slate-500 text-lg">{filteredFaqs.length} {filteredFaqs.length === 1 ? 'result' : 'results'} found</span>
            </div>
            
            <div className="space-y-6">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 hover:border-primary-200 transition-all duration-300">
                  <button
                    className="w-full flex items-center justify-between p-8 text-left hover:bg-slate-100 transition-colors duration-200"
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <span className="text-xl font-semibold text-slate-800 pr-8">{faq.question}</span>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                      {expandedFaq === faq.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </button>
                  
                  {expandedFaq === faq.id && (
                    <div className="px-8 pb-8 border-t border-slate-200/50">
                      <p className="text-slate-700 text-lg leading-relaxed pt-6">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Support;