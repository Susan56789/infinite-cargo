# Infinite Cargo

A modern web application connecting cargo owners and drivers for efficient freight transport across Kenya.

## About

Infinite Cargo is a comprehensive web platform that revolutionizes Kenya's transport industry by connecting cargo owners with verified truck drivers. Built with modern web technologies, our platform streamlines freight booking, driver management, and secure payment processing.

## Features

### For Cargo Owners

- Post cargo loads with pickup and delivery details
- Browse and connect with verified drivers
- Real-time shipment tracking
- Secure payment processing
- Driver rating and feedback system

### For Drivers  

- Search and browse available loads
- Submit competitive bids for transport jobs
- Manage vehicle fleet and documentation
- Track earnings and payment history
- Build reputation through customer ratings

### Platform Features

- Responsive web design for all devices
- Real-time notifications and updates
- Admin dashboard for platform management
- SEO optimized for search engines
- Secure user authentication and authorization

## Technology Stack

**Frontend**

- React.js - User interface library
- React Router - Client-side routing
- React Helmet - SEO and meta management
- CSS3 - Responsive styling

**Backend**

- Express.js - Web application framework
- Node.js - JavaScript runtime environment
- MongoDB - NoSQL database
- Mongoose - MongoDB object modeling

**Additional Tools**

- JWT - Authentication tokens
- Helmet.js - Security middleware
- CORS - Cross-origin resource sharing
- Compression - Response optimization

## Prerequisites

- Node.js (v18.0.0 or higher)
- npm (v8.0.0 or higher)
- MongoDB (v6.0 or higher)

## Installation

1. Clone the repository

```bash
git clone https://github.com/your-username/infinite-cargo.git
cd infinite-cargo
```

2. Install dependencies

```bash
npm install
```

3. Create environment file

```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/infinite-cargo
JWT_SECRET=your-jwt-secret-key
PORT=5000
NODE_ENV=development
```

5. Start MongoDB service

```bash
# Linux/Mac
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 mongo:latest
```

6. Start the application

```bash
# Development mode
npm run dev

# Production mode  
npm run build
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
infinite-cargo/
├── src/
│   ├── components/
│   │   ├── admin/          # Admin components
│   │   ├── cargoowner/     # Cargo owner components  
│   │   ├── common/         # Shared components
│   │   └── driver/         # Driver components
│   ├── pages/              # Page components
│   └── App.js              # Main application
├── routes/                 # API routes
├── models/                 # MongoDB models
├── middleware/             # Express middleware
├── scripts/                # Utility scripts
├── public/                 # Static files
└── server.js               # Server entry point
```

## API Routes

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Loads

- `GET /api/loads` - Get available loads
- `POST /api/loads` - Create new load
- `GET /api/loads/:id` - Get load details
- `PUT /api/loads/:id` - Update load

### Drivers

- `GET /api/drivers` - Get drivers
- `GET /api/drivers/:id` - Get driver profile
- `PUT /api/drivers/:id` - Update profile

### Bids

- `POST /api/bids` - Submit bid
- `GET /api/bids/driver/:id` - Driver bids
- `GET /api/bids/load/:id` - Load bids

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
npm run generate-sitemap  # Generate SEO sitemap
```

### Usage

**For Cargo Owners:**

1. Register and create account
2. Post load details with pickup/delivery locations
3. Review and accept driver bids
4. Track shipment progress
5. Complete payment and rate driver

**For Drivers:**

1. Register with vehicle details
2. Browse available loads
3. Submit competitive bids
4. Accept jobs and update delivery status
5. Receive payments and build reputation

## Deployment

### Production Setup

1. Set environment variables:

```env
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-secure-jwt-secret
```

2. Build and start:

```bash
npm run build
npm start
```

3. Use process manager (PM2):

```bash
npm install -g pm2
pm2 start server.js --name "infinite-cargo"
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)  
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For support, contact: <support@infinitecargo.co.ke>

## Website

Visit: <https://infinitecargo.co.ke>
