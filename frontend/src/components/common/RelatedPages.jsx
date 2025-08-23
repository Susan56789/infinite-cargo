// src/components/common/RelatedPages.js
import React from 'react';
import { Link } from 'react-router-dom';

// Related pages component to add internal links
export const RelatedPages = ({ currentPage, className = '' }) => {
  const pageLinks = {
    home: [
      { url: '/services', text: 'Our Services', description: 'Explore our transport solutions' },
      { url: '/how-it-works', text: 'How It Works', description: 'Learn how to get started' },
      { url: '/register', text: 'Join Now', description: 'Register as driver or cargo owner' }
    ],
    about: [
      { url: '/services', text: 'Our Services', description: 'What we offer' },
      { url: '/contact', text: 'Contact Us', description: 'Get in touch' },
      { url: '/how-it-works', text: 'How It Works', description: 'Learn our process' }
    ],
    services: [
      { url: '/how-it-works', text: 'How It Works', description: 'Step by step process' },
      { url: '/pricing', text: 'Pricing', description: 'View our rates' },
      { url: '/register', text: 'Get Started', description: 'Sign up today' }
    ],
    'how-it-works': [
      { url: '/register', text: 'Register Now', description: 'Create your account' },
      { url: '/services', text: 'Our Services', description: 'Full service list' },
      { url: '/requirements', text: 'Requirements', description: 'What you need' }
    ],
    pricing: [
      { url: '/services', text: 'Services', description: 'Service details' },
      { url: '/contact', text: 'Contact Sales', description: 'Custom pricing' },
      { url: '/register', text: 'Get Started', description: 'Start using our platform' }
    ],
    faq: [
      { url: '/support', text: 'Support Center', description: 'Get help' },
      { url: '/contact', text: 'Contact Us', description: 'Still have questions?' },
      { url: '/requirements', text: 'Requirements', description: 'Driver & cargo requirements' }
    ],
    contact: [
      { url: '/support', text: 'Support Center', description: 'Self-service help' },
      { url: '/faq', text: 'FAQ', description: 'Common questions' },
      { url: '/about', text: 'About Us', description: 'Learn more about us' }
    ],
    support: [
      { url: '/faq', text: 'FAQ', description: 'Frequently asked questions' },
      { url: '/contact', text: 'Contact Support', description: 'Direct support' },
      { url: '/requirements', text: 'Requirements Guide', description: 'Platform requirements' }
    ],
    requirements: [
      { url: '/register', text: 'Register', description: 'Start your application' },
      { url: '/support', text: 'Get Help', description: 'Support with requirements' },
      { url: '/faq', text: 'FAQ', description: 'Common questions' }
    ],
    login: [
      { url: '/register', text: 'Create Account', description: "Don't have an account?" },
      { url: '/forgot-password', text: 'Forgot Password', description: 'Reset your password' },
      { url: '/support', text: 'Login Help', description: 'Having trouble?' }
    ],
    register: [
      { url: '/login', text: 'Login', description: 'Already have an account?' },
      { url: '/requirements', text: 'Requirements', description: 'What you need to know' },
      { url: '/how-it-works', text: 'How It Works', description: 'Learn the process' }
    ]
  };

  const links = pageLinks[currentPage] || [];

  if (links.length === 0) return null;

  return (
    <div className={`bg-gray-50 border-t border-gray-200 py-8 ${className}`}>
      <div className="container mx-auto px-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          Related Pages
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {links.map((link, index) => (
            <Link
              key={index}
              to={link.url}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
            >
              <h4 className="font-medium text-blue-600 hover:text-blue-800 mb-1">
                {link.text}
              </h4>
              <p className="text-sm text-gray-600">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RelatedPages;