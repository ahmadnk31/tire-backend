const serverless = require('serverless-http');
const { app } = require('../../dist/server.js');

// Configure serverless-http to handle path correctly
const handler = serverless(app, {
  binary: false,
  basePath: '',
  stripBasePath: false
});

module.exports.handler = handler;
