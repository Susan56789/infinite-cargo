# Infinite Cargo

Infinite Cargo is Kenya's leading platform connecting cargo owners with reliable drivers for efficient transport solutions across the country.

## Features

### For Cargo Owners

- **Post Loads**: Create cargo listings with pickup and delivery details
- **Find Drivers**: Browse and connect with verified drivers
- **Real-time Tracking**: Monitor your shipments in real-time
- **Secure Payments**: Safe and transparent payment processing
- **Bid Management**: Review and accept driver bids

### For Drivers

- **Load Search**: Find available cargo loads across Kenya
- **Profile Management**: Maintain driver profile and vehicle information
- **Earnings Tracking**: Monitor your income and payment history
- **Bid Submission**: Place competitive bids on cargo loads
- **Job Management**: Track assigned jobs and delivery status

## Tech Stack

### Frontend

- **React.js** - Modern JavaScript library for building user interfaces
- **React Router** - Client-side routing
- **React Helmet** - SEO optimization
- **CSS3** - Modern styling and responsive design

### Backend

- **Node.js** - Server-side JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- MongoDB database

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd infinite-cargo
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory and add necessary configuration variables.

4. Start the development server

```bash
npm start
```

The application will run on `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── common/          # Shared components
│   ├── driver/          # Driver-specific components
│   ├── cargoowner/      # Cargo owner components
│   └── admin/           # Administrative components
├── pages/               # Main page components
├── routes/              # Route configurations
└── styles/              # CSS and styling files
```

## Key Pages

- **Home** - Landing page with platform overview
- **Services** - Detailed service offerings
- **How It Works** - Step-by-step platform guide
- **Pricing** - Transparent pricing information
- **Contact** - Get in touch with support
- **FAQ** - Frequently asked questions

## SEO Optimization

The application includes comprehensive SEO features:

- Dynamic meta tags for each page
- Canonical URLs
- Structured data markup
- Optimized loading with lazy loading
- Responsive design for mobile optimization

## Security Features

- Helmet.js for security headers
- CORS protection
- Input validation and sanitization
- Secure authentication system
- Protected routes and authorization

## Styling

The application uses **Tailwind CSS** for styling:

- Utility-first approach for rapid UI development
- Responsive design with mobile-first breakpoints
- Custom component classes for consistency
- Dark mode support (if implemented)
- Optimized CSS bundle with PurgeCSS

## Performance

- Code splitting with lazy loading
- Image optimization
- Compression middleware
- Efficient bundle management
- Progressive loading strategies

## Support

For support and inquiries:

- Website: <https://infinitecargo.co.ke>
- Email: Contact through website form
- Phone: Available on website

## Contributing

Please follow the established coding standards and submit pull requests for review.

## License

This project is proprietary software. All rights reserved.

---

**Infinite Cargo** - Connecting Kenya's Transport Network
