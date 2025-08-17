const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'https://tire-frontend-sand.vercel.app',
    'https://tire-frontend.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// Import and use all routes from the main server
const { app: mainApp } = require('../../dist/server.js');

// Use the main app's middleware and routes
app.use('/', mainApp);

module.exports.handler = serverless(app);
