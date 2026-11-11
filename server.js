require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  const missing = ['ADMIN_PASSWORD', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`⚠️  Missing env vars in production: ${missing.join(', ')}. Using insecure defaults.`);
  }
}

app.listen(PORT, () => {
  console.log(`Personal Blog running at http://localhost:${PORT}`);
});
