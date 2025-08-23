import React from 'react';
import Breadcrumb from '../components/common/Breadcrumb';

const Services = () => {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 font-sans text-gray-800">
      <Breadcrumb items={[{text: 'Services'}]} />
      <h1 className="text-center text-4xl text-primary-600 font-bold mb-4 animate-fade-up">
        Our Services
      </h1>
      <p className="text-center text-lg max-w-3xl mx-auto mb-12 leading-relaxed animate-slide-up">
        Infinite Cargo offers a complete suite of logistics solutions to make cargo transport in Kenya faster, safer, and more efficient. Whether you're a business, an individual, or a professional driver, we have services tailored to your needs.
      </p>

      <div className="flex flex-wrap gap-8 justify-center">
        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Load Posting
          </h3>
          <p className="text-base leading-relaxed">
            Cargo owners can easily post their load requirements by specifying pickup points, destinations, cargo type, and delivery timelines—all from the comfort of their dashboard.
          </p>
        </div>

        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Driver Matching
          </h3>
          <p className="text-base leading-relaxed">
            Our system automatically matches cargo posts with verified drivers based on location, availability, and vehicle capacity—making logistics seamless and efficient.
          </p>
        </div>

        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Real-Time Load Search
          </h3>
          <p className="text-base leading-relaxed">
            Registered drivers can browse a constantly updating list of available cargo loads and place bids that are fair and competitive.
          </p>
        </div>

        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Cargo Tracking
          </h3>
          <p className="text-base leading-relaxed">
            Both cargo owners and drivers have visibility into shipment progress. Stay updated with real-time tracking and status updates.
          </p>
        </div>

        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Secure Communication
          </h3>
          <p className="text-base leading-relaxed">
            Use in-platform chat and call features to negotiate, confirm delivery instructions, and maintain transparent communication throughout the process.
          </p>
        </div>

        <div className="flex-1 min-w-80 bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 animate-fade-up">
          <h3 className="text-xl text-primary-600 mb-3 font-semibold">
            Support & Dispute Resolution
          </h3>
          <p className="text-base leading-relaxed">
            Our support team is always available to help resolve any issues, answer questions, and ensure smooth transport experiences for both drivers and cargo owners.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Services;