import React, { useState } from 'react';
import { 
  HelpCircle, 
  Truck, 
  Package, 
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import Breadcrumb from '../components/common/Breadcrumb';

const FAQ = () => {
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
      },
      {
        id: 6,
        question: "What makes Infinite Cargo different from other platforms?",
        answer: "We focus exclusively on the Kenyan market with local expertise, offer comprehensive driver verification, provide 24/7 customer support, and maintain transparent pricing with no hidden fees. Our platform is designed specifically for Kenya's transport needs."
      },
      {
        id: 7,
        question: "How secure is the platform?",
        answer: "We prioritize security with encrypted data transmission, secure payment processing, verified user profiles, and comprehensive insurance requirements for all drivers. Our platform undergoes regular security audits and updates."
      }
    ],
    drivers: [
      {
        id: 8,
        question: "What are the requirements to become a driver?",
        answer: "To join as a driver, you need: Valid driving license (Class C or above), vehicle registration documents, comprehensive insurance, clean driving record, smartphone with internet access, and basic smartphone skills. Full details are available in our Requirements section."
      },
      {
        id: 9,
        question: "How do I find loads to transport?",
        answer: "After registration, browse available loads in the 'Find Loads' section. Use filters to find loads matching your vehicle type, route preferences, and availability. You can submit bids on multiple loads and cargo owners will review and select drivers."
      },
      {
        id: 10,
        question: "How do I get paid?",
        answer: "Payment is arranged directly between you and the cargo owner. Once you complete a delivery and the cargo owner confirms receipt, they will pay you according to your agreed terms - whether cash, mobile money, or bank transfer."
      },
      {
        id: 11,
        question: "What if there's damage to cargo during transport?",
        answer: "All registered drivers must have comprehensive insurance. In case of damage, immediately report the incident through the app, document with photos, and contact our support team. We'll guide you through the insurance claim process."
      },
      {
        id: 12,
        question: "Can I reject a load after accepting it?",
        answer: "While we encourage commitment to accepted loads, emergencies happen. Contact the cargo owner immediately and our support team. Frequent cancellations may affect your driver rating and future opportunities."
      },
      {
        id: 13,
        question: "How do I improve my driver rating?",
        answer: "Maintain excellent service by being punctual, communicating clearly, handling cargo carefully, providing regular updates, and being professional. Positive reviews from cargo owners will boost your rating and increase job opportunities."
      },
      {
        id: 14,
        question: "What types of vehicles are accepted?",
        answer: "We accept various vehicle types including pickup trucks, lorries, trailers, and specialized transport vehicles. Your vehicle must be roadworthy, insured, and match the specifications you list in your profile."
      },
      {
        id: 15,
        question: "How do I handle difficult cargo owners?",
        answer: "Maintain professionalism at all times. Document all interactions, follow agreed terms, and contact our support team if issues arise. We're here to mediate and ensure fair treatment for both parties."
      }
    ],
    cargo: [
      {
        id: 16,
        question: "How do I post a load?",
        answer: "Click 'Post Load' from your dashboard, fill in details including pickup/delivery locations, cargo description, weight, dimensions, preferred pickup date, and budget. Add photos if helpful. Your load will be visible to relevant drivers immediately."
      },
      {
        id: 17,
        question: "How do I choose the right driver?",
        answer: "Review driver profiles including ratings, reviews, vehicle details, and experience. Check their bid amount, estimated delivery time, and insurance coverage. You can message drivers directly to discuss specific requirements before making your selection."
      },
      {
        id: 18,
        question: "How do I pay the driver?",
        answer: "You pay the driver directly according to your agreement. Payment methods can include cash, M-Pesa, Airtel Money, or bank transfer - whatever you and the driver agree upon. Infinite Cargo does not handle payments between cargo owners and drivers."
      },
      {
        id: 19,
        question: "What items cannot be transported?",
        answer: "Prohibited items include hazardous materials, illegal substances, live animals (without proper permits), perishables without proper packaging, and items exceeding vehicle capacity. Contact support if unsure about specific items."
      },
      {
        id: 20,
        question: "What if my cargo is damaged or lost?",
        answer: "Immediately report any issues through the app. All drivers carry comprehensive insurance. Document damage with photos and contact our support team within 24 hours. We'll facilitate the insurance claim process and work toward resolution."
      },
      {
        id: 21,
        question: "How far in advance should I post my load?",
        answer: "We recommend posting loads at least 24-48 hours before your preferred pickup date. This gives drivers time to review and submit competitive bids. For urgent shipments, same-day posting is possible but may limit driver options."
      },
      {
        id: 22,
        question: "Can I modify my load details after posting?",
        answer: "You can edit load details before accepting any bids. Once you've accepted a driver's bid, changes require mutual agreement. Significant changes may affect the agreed price and delivery timeline."
      },
      {
        id: 23,
        question: "How do I handle fragile or valuable items?",
        answer: "Clearly mark fragile items in your load description, consider additional packaging, choose drivers with high ratings and relevant experience, and discuss special handling requirements before confirming the booking."
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
       <Breadcrumb items={[{text: 'FAQ'}]} />
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">Frequently Asked Questions</h1>
          <p className="text-xl md:text-2xl mb-10 text-blue-100 max-w-3xl mx-auto">Find answers to common questions about our transport services</p>
          
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

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6">Browse by Category</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">Select a category below to find relevant answers</p>
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
                      ? 'bg-white text-blue-600 shadow-lg scale-105' 
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
                <div key={faq.id} className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-200 transition-all duration-300">
                  <button
                    className="w-full flex items-center justify-between p-8 text-left hover:bg-slate-100 transition-colors duration-200"
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <span className="text-xl font-semibold text-slate-800 pr-8">{faq.question}</span>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
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

            {/* No Results Message */}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="text-slate-400" size={28} />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No results found</h3>
                <p className="text-slate-600 mb-6">Try adjusting your search terms or browse different categories</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors duration-200"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>

          {/* Still Need Help Section */}
          <div className="mt-20 bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl p-12 text-center">
            <h3 className="text-3xl font-bold text-slate-800 mb-4">Still Need Help?</h3>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              Can't find the answer you're looking for? Our support team is here to help you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors duration-200"
              >
                Contact Support
              </a>
              <a
                href="tel:+254723139610"
                className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-600 hover:text-white transition-colors duration-200"
              >
                Call Us Now
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;