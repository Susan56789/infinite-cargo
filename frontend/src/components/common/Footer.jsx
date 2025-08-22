import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faTwitter, faLinkedin, faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faPhone, faLocationDot } from '@fortawesome/free-solid-svg-icons';

const Footer = () => {
  const footerSections = [
    {
      title: 'Quick Links',
      links: [
        { href: '/', text: 'Home' },
        { href: '/about', text: 'About Us' },
        { href: '/services', text: 'Services' },
        { href: '/how-it-works', text: 'How It Works' },
        { href: '/pricing', text: 'Pricing' },
        { href: '/support', text: 'Support' }
      ]
    },
    {
      title: 'For Drivers',
      links: [
        { href: '/register', text: 'Join as Driver' },
        { href: '/search-loads', text: 'Find Loads' },
        { href: '/requirements', text: 'Requirements' },
        { href: '/support', text: 'Driver Support' }
      ]
    },
    {
      title: 'For Cargo Owners',
      links: [
        { href: '/register', text: 'Post Your Load' },
        { href: '/find-drivers', text: 'Find Drivers' },
        { href: '/requirements', text: 'Shipping Guide' },
        { href: '/support', text: 'Cargo Support' }
      ]
    }
  ];

  const contactInfo = [
    {
      icon: faEnvelope,
      href: 'mailto:info@infinitecargo.co.ke',
      text: 'info@infinitecargo.co.ke',
      isLink: true
    },
    {
      icon: faPhone,
      href: 'tel:+254723139610',
      text: '+254723 139 610',
      isLink: true
    },
    {
      icon: faLocationDot,
      text: 'Nairobi, Kenya',
      isLink: false
    }
  ];

  const socialLinks = [
    { icon: faFacebook, href: 'https://www.facebook.com/infinitecargo254', label: 'Facebook' },
    { icon: faTwitter, href: 'https://twitter.com/infinitecargo254', label: 'Twitter' },
    { icon: faLinkedin, href: 'https://www.linkedin.com/company/infinitecargo254', label: 'LinkedIn' },
    { icon: faWhatsapp, href: 'https://wa.me/254722483468', label: 'WhatsApp' }
  ];

  return (
    <footer className="bg-secondary-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Company Info Section */}
            <div className="lg:col-span-2 animate-fade-up">
              <div className="flex items-center mb-4">
                <img 
                  src="/logo.png" 
                  alt="Infinite Cargo" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary-500 shadow-md mr-3"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <h4 className="text-xl font-bold text-white hidden">
                  Infinite Cargo
                </h4>
              </div>
              <p className="text-primary-300 text-lg font-semibold mb-3">
                Connecting Kenya's Transport Network
              </p>
              <p className="text-gray-300 leading-relaxed mb-6">
                The leading platform for cargo owners and drivers to connect, 
                bid, and transport goods across Kenya efficiently.
              </p>
              
              {/* Social Links */}
              <div className="flex space-x-4">
                {socialLinks.map((social, index) => (
                  <a 
                    key={index}
                    href={social.href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    aria-label={social.label} 
                    className="w-10 h-10 bg-primary-600 hover:bg-primary-500 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg"
                  >
                    <FontAwesomeIcon icon={social.icon} className="text-white" />
                  </a>
                ))}
              </div>
            </div>

            {/* Footer Sections */}
            {footerSections.map((section, index) => (
              <div key={index} className={`animate-slide-up`} style={{ animationDelay: `${(index + 1) * 0.1}s` }}>
                <h5 className="text-lg font-semibold text-white mb-4 border-b border-primary-600 pb-2">
                  {section.title}
                </h5>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <a 
                        href={link.href}
                        className="text-gray-300 hover:text-primary-300 transition-colors duration-300 hover:translate-x-1 inline-block"
                      >
                        {link.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Contact Section */}
            <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <h5 className="text-lg font-semibold text-white mb-4 border-b border-primary-600 pb-2">
                Contact Us
              </h5>
              <div className="space-y-3">
                {contactInfo.map((contact, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <span className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0">
                      <FontAwesomeIcon icon={contact.icon} />
                    </span>
                    {contact.isLink ? (
                      <a 
                        href={contact.href}
                        className="text-gray-300 hover:text-primary-300 transition-colors duration-300"
                      >
                        {contact.text}
                      </a>
                    ) : (
                      <span className="text-gray-300">{contact.text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-gray-700 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400">
              <p>© 2025 Infinite Cargo. All rights reserved.</p>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <a 
                href="/privacy-policy"
                className="text-gray-400 hover:text-primary-300 transition-colors duration-300"
              >
                Privacy Policy
              </a>
              <span className="text-gray-600">•</span>
              <a 
                href="/terms-of-service"
                className="text-gray-400 hover:text-primary-300 transition-colors duration-300"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;