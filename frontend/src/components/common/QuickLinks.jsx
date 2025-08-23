// src/components/common/QuickLinks.js
import React from 'react';
import { Link } from 'react-router-dom';

const QuickLinks = ({ title = "Quick Links", links, className = '' }) => {
  const defaultLinks = [
    { url: '/services', text: 'Our Services' },
    { url: '/how-it-works', text: 'How It Works' },
    { url: '/pricing', text: 'Pricing' },
    { url: '/register', text: 'Register' },
    { url: '/login', text: 'Login' },
    { url: '/support', text: 'Support' },
    { url: '/contact', text: 'Contact' },
    { url: '/faq', text: 'FAQ' }
  ];

  const linkList = links || defaultLinks;

  return (
    <div className={className}>
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <ul className="space-y-2">
        {linkList.map((link, index) => (
          <li key={index}>
            <Link 
              to={link.url}
              className="text-gray-600 hover:text-blue-600 transition-colors duration-200 text-sm"
            >
              {link.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Specific variants for different sections
export const ServicesQuickLinks = ({ className = '' }) => {
  const serviceLinks = [
    { url: '/search-loads', text: 'Find Loads' },
    { url: '/find-drivers', text: 'Find Drivers' },
    { url: '/services', text: 'All Services' },
    { url: '/pricing', text: 'Pricing' }
  ];

  return (
    <QuickLinks 
      title="Services" 
      links={serviceLinks} 
      className={className}
    />
  );
};

export const SupportQuickLinks = ({ className = '' }) => {
  const supportLinks = [
    { url: '/faq', text: 'FAQ' },
    { url: '/support', text: 'Help Center' },
    { url: '/contact', text: 'Contact Us' },
    { url: '/requirements', text: 'Requirements' }
  ];

  return (
    <QuickLinks 
      title="Support" 
      links={supportLinks} 
      className={className}
    />
  );
};

export const AccountQuickLinks = ({ className = '' }) => {
  const accountLinks = [
    { url: '/register', text: 'Sign Up' },
    { url: '/login', text: 'Login' },
    { url: '/forgot-password', text: 'Reset Password' },
    { url: '/driver-dashboard', text: 'Driver Dashboard' },
    { url: '/cargo-dashboard', text: 'Cargo Dashboard' }
  ];

  return (
    <QuickLinks 
      title="Account" 
      links={accountLinks} 
      className={className}
    />
  );
};

export default QuickLinks;