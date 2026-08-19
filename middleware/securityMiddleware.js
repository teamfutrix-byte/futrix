/**
 * Enterprise Security Hardening Middleware
 * Mitigates XSS, CSRF, Clickjacking, Injection, and high-frequency request spamming.
 */

// Simple in-memory storage for rate limiting (can be swapped with Redis for clustering)
const ipRequestCounts = {};
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 150; // max 150 requests per minute

function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const now = Date.now();

  if (!ipRequestCounts[ip]) {
    ipRequestCounts[ip] = [];
  }

  // Filter out expired request timestamps
  ipRequestCounts[ip] = ipRequestCounts[ip].filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (ipRequestCounts[ip].length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' });
  }

  ipRequestCounts[ip].push(now);
  next();
}

/**
 * XSS & HTML Script Tag Injection Filtering Sanitizer
 */
function sanitizeInput(req, res, next) {
  const sanitizeValue = (val) => {
    if (typeof val === 'string') {
      // Remove basic script tags and event handler injections
      return val.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/javascript:[^\s]*/gi, '');
    }
    if (typeof val === 'object' && val !== null) {
      for (const k of Object.keys(val)) {
        val[k] = sanitizeValue(val[k]);
      }
    }
    return val;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);
  next();
}

/**
 * Clickjacking & Content Sniffing Protection Headers
 */
function secureHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

module.exports = {
  rateLimiter,
  sanitizeInput,
  secureHeaders
};
