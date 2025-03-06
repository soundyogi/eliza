// proxy-server.js
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

const app = express();

// IMPORTANT: Add CORS headers before any other middleware
app.use(cors({
  origin: '*', // Allow all origins for testing - you can restrict this later
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Handle OPTIONS preflight requests separately
app.options('*', (req, res) => {
  res.status(200).end();
});

// Create the proxy with specific CORS configuration
const apiProxy = createProxyMiddleware({
  target: 'https://fluffy-barnacle-q9wqvpx7vrc9xq9-3000.app.github.dev',
  changeOrigin: true,
  onProxyRes: function(proxyRes, req, res) {
    // Force CORS headers on the proxied response
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
  }
});

// Use the proxy middleware for all routes
app.use('*', apiProxy);

// Start the proxy server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`CORS Proxy Server running on http://localhost:${PORT}`);
});