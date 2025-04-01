import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

export function startProxy(options = {
  port: 9999,
  targetUrl: 'http://localhost:3000',
  agentId: 'fbe67721-a5d3-0b22-b9a7-93150c77c124',
  corsOrigin: 'http://178.128.205.221:5173'
}) {
  const app = express();

  // Basic security headers
  app.use(helmet());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 2, // limit each IP to 2 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use(limiter);

  // Stricter CORS configuration
  app.use(cors({
    origin: options.corsOrigin,
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400, // 24 hours
    credentials: false
  }));

  // Add request logging middleware
  app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    console.log('Full URL:', `${options.targetUrl}${req.url}`);
    console.log('Headers:', req.headers);
    next();
  });

  // Validate request content-type
  app.use('/api/chat', (req, res, next) => {
    if (req.method === 'POST' && !req.is('multipart/form-data')) {
      return res.status(415).json({ error: 'Unsupported Media Type' });
    }
    next();
  });

  // Proxy middleware configuration
  const proxyOptions = {
    target: options.targetUrl,
    changeOrigin: true,
    pathRewrite: (path) => {
      console.log('Rewriting path:', path);
      // Remove /api/chat and replace with /{agentId}/message
      const newPath = `/${options.agentId}/message`;
      console.log('New path:', newPath);
      return newPath;
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log('Original URL:', req.url);
      console.log('Proxying to:', proxyReq.path);
      console.log('Target:', options.targetUrl + proxyReq.path);
    },
    onError: (err, req, res) => {
      console.error('Proxy Error:', err);
      res.status(500).json({ error: 'Proxy Error', details: err.message });
    }
  };

  // Apply the proxy middleware only to /api/chat endpoint
  const proxy = createProxyMiddleware(proxyOptions);
  app.post('/api/chat', proxy);  // Only handle POST requests explicitly

  // All other routes will return 404
  app.use('*', (req, res) => {
    console.log('404 for path:', req.originalUrl);
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // Only listen on localhost if behind reverse proxy
  const server = app.listen(options.port, '0.0.0.0', () => {
    console.log(`Proxy server running on port ${options.port}`);
    console.log(`Proxying /api/chat to ${options.targetUrl}/${options.agentId}/message`);
    console.log(`CORS origin set to: ${options.corsOrigin}`);
  });

  return server;
}