import React, { useState } from 'react';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  Send,
  User,
  MessageSquare,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import RelatedPages from '../components/common/RelatedPages';
import Breadcrumb from '../components/common/Breadcrumb';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    userType: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create mailto link with form data
      const subject = encodeURIComponent(`Contact Form: ${formData.subject}`);
      const body = encodeURIComponent(
        `Name: ${formData.name}\n` +
        `Email: ${formData.email}\n` +
        `Phone: ${formData.phone}\n` +
        `User Type: ${formData.userType}\n` +
        `Subject: ${formData.subject}\n\n` +
        `Message:\n${formData.message}`
      );
      
      const mailtoLink = `mailto:support@infinitecargo.co.ke?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;
      
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        userType: 'general'
      });
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
        <Breadcrumb items={[{text: 'Contact Us'}]} />
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">Get in Touch</h1>
          <p className="text-xl md:text-2xl mb-10 text-blue-100 max-w-3xl mx-auto">
            We're here to help you with any questions about our transport services
          </p>
        </div>
      </section>

      {/* Contact Information Cards */}
      <section className="py-20 -mt-16 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {/* Phone */}
            <div className="group bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Phone className="text-blue-600" size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Call Us</h3>
              <p className="text-slate-600 mb-3">Speak with our team</p>
              <a href="tel:+254723139610" className="text-blue-600 font-semibold hover:text-blue-700">
                +254723 139 610
              </a>
            </div>

            {/* Email */}
            <div className="group bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Mail className="text-purple-600" size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Email Us</h3>
              <p className="text-slate-600 mb-3">Send us a message</p>
              <a href="mailto:support@infinitecargo.co.ke" className="text-purple-600 font-semibold hover:text-purple-700">
                support@infinitecargo.co.ke
              </a>
            </div>

            {/* Location */}
            <div className="group bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <MapPin className="text-green-600" size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Visit Us</h3>
              <p className="text-slate-600 mb-3">Our office location</p>
              <p className="text-green-600 font-semibold">Nairobi, Kenya</p>
            </div>

            {/* Hours */}
            <div className="group bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Clock className="text-orange-600" size={28} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Office Hours</h3>
              <p className="text-slate-600 mb-3">Monday - Friday</p>
              <p className="text-orange-600 font-semibold">8:00 AM - 6:00 PM</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-white rounded-3xl p-8 shadow-xl">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-4">Send us a Message</h2>
                <p className="text-slate-600">Fill out the form below and we'll get back to you as soon as possible.</p>
              </div>

              {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={20} />
                  <p className="text-green-700">Your message has been sent successfully!</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="text-red-600" size={20} />
                  <p className="text-red-700">There was an error sending your message. Please try again.</p>
                </div>
              )}

              <div className="space-y-6">
                {/* User Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">I am a:</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'driver', label: 'Driver' },
                      { value: 'cargo-owner', label: 'Cargo Owner' },
                      { value: 'general', label: 'General Inquiry' }
                    ].map((type) => (
                      <label key={type.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="userType"
                          value={type.value}
                          checked={formData.userType === type.value}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <div className={`p-3 text-center rounded-xl border-2 transition-all duration-200 ${
                          formData.userType === type.value 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}>
                          <span className="text-sm font-medium">{type.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Name and Email Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone and Subject Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subject *</label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200"
                      placeholder="Brief subject of your message"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Message *</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-4 text-slate-400" size={20} />
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows={6}
                      className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200 resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.name || !formData.email || !formData.subject || !formData.message}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Map Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-slate-800 mb-4">Find Us Here</h2>
                <p className="text-slate-600">Visit our office or get directions using the map below.</p>
              </div>

              <div className="rounded-2xl overflow-hidden shadow-lg">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.7533053679585!2d36.8440526!3d-1.3238798999999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182f112f5b372fb5%3A0xcf856f27edf84e16!2sInfinite%20cargo!5e0!3m2!1sen!2ske!4v1755911819406!5m2!1sen!2ske" 
                  width="100%" 
                  height="350" 
                  style={{border:0}} 
                  allowFullScreen="" 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Infinite Cargo Location"
                ></iframe>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-semibold text-slate-800 mb-2">Office Address</h4>
                <p className="text-slate-600">Infinite Cargo<br />Nairobi, Kenya</p>
              </div>
            </div>
          </div>

          {/* Additional Contact Information */}
          <div className="mt-20 bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl p-12 text-center">
            <h3 className="text-3xl font-bold text-slate-800 mb-4">Need Immediate Assistance?</h3>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              For urgent transport needs or emergency support, don't hesitate to contact us directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <a
                href="tel:+254723139610"
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-3"
              >
                <Phone size={20} />
                Call Now: +254723 139 610
              </a>
              <a
                href="mailto:support@infinitecargo.co.ke"
                className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-600 hover:text-white transition-colors duration-200 flex items-center justify-center gap-3"
              >
                <Mail size={20} />
                Email Us
              </a>
            </div>
          </div>

          {/* Business Hours & Quick Links */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-slate-800 mb-4">Business Hours</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Monday - Friday</span>
                  <span className="font-semibold text-slate-800">8:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Saturday</span>
                  <span className="font-semibold text-slate-800">9:00 AM - 4:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Sunday</span>
                  <span className="font-semibold text-slate-800">Emergency Only</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h4 className="text-2xl font-bold text-slate-800 mb-4">Quick Links</h4>
              <div className="space-y-3">
                <a href="/faq" className="block text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Frequently Asked Questions
                </a>
                <a href="/requirements" className="block text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Driver Requirements
                </a>
                <a href="/support" className="block text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Help & Support Center
                </a>
                <a href="/pricing" className="block text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Pricing Information
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <RelatedPages currentPage="pricing" />
    </div>
  );
};

export default Contact;