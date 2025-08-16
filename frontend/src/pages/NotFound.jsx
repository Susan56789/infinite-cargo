// NotFound.jsx
import React from 'react';

const NotFound = () => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
  };

  const headingStyle = {
    fontSize: '6rem',
    fontWeight: '700',
    color: '#1976d2',
    margin: '0',
  };

  const subHeadingStyle = {
    fontSize: '2rem',
    marginTop: '1rem',
    color: '#555',
  };

  const paragraphStyle = {
    marginTop: '1.5rem',
    fontSize: '1rem',
    color: '#777',
  };

  const buttonStyle = {
    marginTop: '2rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    backgroundColor: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  };

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>404</h1>
      <h2 style={subHeadingStyle}>Page Not Found</h2>
      <p style={paragraphStyle}>
        Sorry, the page you're looking for doesn't exist or has been moved.
      </p>
      <button style={buttonStyle} onClick={() => window.location.href = '/'}>
        Go to Homepage
      </button>
    </div>
  );
};

export default NotFound;