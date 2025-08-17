const serverless = require('serverless-http');
const { app } = require('../../dist/server.js');

module.exports.handler = serverless(app);
