// middleware/rawBody.js
const express = require('express');

// Express json middleware with rawBody capture verification for payment webhook signatures
const rawBodyMiddleware = express.json({
  verify: (req, res, buf) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString('utf8');
    }
  }
});

module.exports = {
  rawBodyMiddleware
};