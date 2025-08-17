const corsHandler = (req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://infinitecargo.co.ke',
    'https://www.infinitecargo.co.ke'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  // Allow all request headers
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};

module.exports = corsHandler;