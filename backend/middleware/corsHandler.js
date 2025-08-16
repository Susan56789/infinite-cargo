// middleware/corsHandler.js

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://infinitecargo.co.ke',
  'https://www.infinitecargo.co.ke',
  'https://infinite-cargo-api.onrender.com',
];

const corsHandler = (req, res, next) => {
  const origin = req.headers.origin;

  // Only set allow-origin if it matches allowed list
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Required if you want to accept cookies / auth headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Allowed methods
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );

  // Allowed headers from client
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-auth-token'
  );

  // If preflight request, respond immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};

module.exports = corsHandler;
