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

  // Allow only if matching allowed list
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // Enable credentials if needed
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Methods allowed
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
  );

  // Important: allow any header your client might send
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Auth-Token, x-auth-token, Accept, Origin'
  );

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};

module.exports = corsHandler;
