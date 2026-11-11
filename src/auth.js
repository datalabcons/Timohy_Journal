// Very simple admin authentication: one username/password pair from env vars,
// remembered with a session cookie after login.

const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

// Compare strings in constant time so response timing doesn't leak how
// many characters of a guess were correct.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkCredentials(username, password) {
  // Evaluate both so timing doesn't reveal which one was wrong.
  const userOk = safeEqual(username, ADMIN_USERNAME);
  const passOk = safeEqual(password, ADMIN_PASSWORD);
  return userOk && passOk;
}

// Middleware: let the request through only if the admin is logged in.
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

module.exports = { checkCredentials, requireAdmin };
