import React from 'react';
import RelatedPages from '../components/common/RelatedPages';
import Breadcrumb from '../components/common/Breadcrumb';

const About = () => {
  return (
    <section className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-16">
      <Breadcrumb items={[{text: 'About Us'}]} />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-primary-600 leading-tight">
            About Us
          </h1>
          <p className="text-lg md:text-xl mb-8 text-gray-700 leading-relaxed">
            <strong className="text-primary-700">Infinite Cargo</strong> is Kenya's innovative transport logistics platform, designed to connect cargo owners with professional, verified drivers across the country. Whether you're shipping across counties or seeking consistent cargo jobs, we offer a digital bridge that simplifies, secures, and streamlines logistics for everyone.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-2 gap-8 lg:gap-12 text-left">
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-100">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-primary-600 flex items-center">
              <div className="w-2 h-8 bg-primary-500 rounded-full mr-4"></div>
              Our Vision
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              To become Kenya's most trusted digital transport network by enabling efficient, transparent, and accessible cargo delivery services—empowering both businesses and drivers through smart logistics.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-100">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-primary-600 flex items-center">
              <div className="w-2 h-8 bg-primary-500 rounded-full mr-4"></div>
              Our Mission
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              To simplify the way cargo is moved by leveraging technology to reduce idle time for drivers, minimize logistical stress for cargo owners, and create a reliable, scalable ecosystem for freight transport in Kenya.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-100">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-primary-600 flex items-center">
              <div className="w-2 h-8 bg-primary-500 rounded-full mr-4"></div>
              What We Offer
            </h2>
            <ul className="space-y-3 text-gray-700 text-lg">
              <li className="flex items-start">
                <div className="w-2 h-2 bg-primary-400 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                Verified driver registration & load matching
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-primary-400 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                Real-time cargo posting & searching
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-primary-400 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                Transparent pricing and competitive bids
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-primary-400 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                Secure communication between users
              </li>
              <li className="flex items-start">
                <div className="w-2 h-2 bg-primary-400 rounded-full mt-3 mr-4 flex-shrink-0"></div>
                Dedicated support for both cargo owners and drivers
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-8 border border-gray-100">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-primary-600 flex items-center">
              <div className="w-2 h-8 bg-primary-500 rounded-full mr-4"></div>
              Why Infinite Cargo?
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              Logistics in Kenya is often plagued by inefficiencies, mistrust, and high costs. We're here to change that. With a growing network of verified users and intuitive tools for tracking, bidding, and communication, Infinite Cargo gives you control, confidence, and clarity—every step of the way.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center bg-gradient-to-r from-primary-500 to-secondary-600 rounded-2xl p-8 md:p-12 text-white shadow-xl">
          <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
            Join us in redefining logistics in Kenya.
          </h3>
          <p className="text-lg md:text-xl opacity-90 leading-relaxed max-w-2xl mx-auto">
            Whether you're a cargo owner or a licensed driver, Infinite Cargo is built for you.
          </p>
          <div className="mt-8">
            <a href='/register' className="bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg">
              Get Started Today
            </a>
          </div>
        </div>
      </div>
      <RelatedPages currentPage="about" />
    </section>
  );
};

export default About;