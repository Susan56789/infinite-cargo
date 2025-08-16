// middleware/corsHandler.js
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://infinitecargo.co.ke',
  'https://www.infinitecargo.co.ke'
];

module.exports = function corsHandler(req, res, next) {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin,X-Requested-With,Content-Type,Accept,Authorization,x-auth-token'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};
