const path = require('path');
const express = require('express');
const session = require('express-session');

const storage = require('./storage');
const { checkCredentials, requireAdmin } = require('./auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', 1); // needed for secure cookies behind Render/Railway proxies

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Make login state and a flash message available in every template.
app.use((req, res, next) => {
  res.locals.isAdmin = Boolean(req.session.isAdmin);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Helpers available in templates
app.locals.formatDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};
app.locals.paragraphs = (text) =>
  String(text || '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function validateArticle(body) {
  const title = String(body.title || '').trim();
  const date = String(body.date || '').trim();
  const content = String(body.content || '').trim();
  const errors = [];

  if (!title) errors.push('Title is required.');
  if (title.length > 200) errors.push('Title must be 200 characters or fewer.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('Publishing date must be a valid date.');
  }
  if (!content) errors.push('Content is required.');

  return { article: { title, date, content }, errors };
}

const today = () => new Date().toISOString().slice(0, 10);

// Wrap async route handlers so errors reach the error handler.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ---------------- Guest section ---------------- */

app.get('/', (req, res) => res.redirect('/home'));

app.get(
  '/home',
  wrap(async (req, res) => {
    const articles = await storage.getAll();
    res.render('home', { title: 'Personal Blog', articles });
  })
);

app.get(
  '/article/:id',
  wrap(async (req, res, next) => {
    const article = await storage.getById(req.params.id);
    if (!article) return next(); // falls through to 404
    res.render('article', { title: article.title, article });
  })
);

/* ---------------- Authentication ---------------- */

app.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { title: 'Admin Login', error: null, username: '' });
});

app.post('/login', (req, res, next) => {
  const { username = '', password = '' } = req.body;

  if (!checkCredentials(username, password)) {
    return res
      .status(401)
      .render('login', { title: 'Admin Login', error: 'Invalid username or password.', username });
  }

  const returnTo = req.session.returnTo || '/admin';
  // New session id on login prevents session-fixation attacks.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.isAdmin = true;
    res.redirect(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/admin');
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/home'));
});

/* ---------------- Admin section ---------------- */

app.get(
  '/admin',
  requireAdmin,
  wrap(async (req, res) => {
    const articles = await storage.getAll();
    res.render('admin/dashboard', { title: 'Dashboard', articles });
  })
);

app.get('/new', requireAdmin, (req, res) => {
  res.render('admin/form', {
    title: 'New Article',
    heading: 'New Article',
    action: '/new',
    submitLabel: 'Publish',
    article: { title: '', date: today(), content: '' },
    errors: [],
  });
});

app.post(
  '/new',
  requireAdmin,
  wrap(async (req, res) => {
    const { article, errors } = validateArticle(req.body);
    if (errors.length) {
      return res.status(400).render('admin/form', {
        title: 'New Article',
        heading: 'New Article',
        action: '/new',
        submitLabel: 'Publish',
        article,
        errors,
      });
    }
    const created = await storage.create(article);
    req.session.flash = `Published “${created.title}”.`;
    res.redirect('/admin');
  })
);

app.get(
  '/edit/:id',
  requireAdmin,
  wrap(async (req, res, next) => {
    const article = await storage.getById(req.params.id);
    if (!article) return next();
    res.render('admin/form', {
      title: 'Update Article',
      heading: 'Update Article',
      action: `/edit/${article.id}`,
      submitLabel: 'Update',
      article,
      errors: [],
    });
  })
);

app.post(
  '/edit/:id',
  requireAdmin,
  wrap(async (req, res, next) => {
    const { id } = req.params;
    const { article, errors } = validateArticle(req.body);
    if (errors.length) {
      return res.status(400).render('admin/form', {
        title: 'Update Article',
        heading: 'Update Article',
        action: `/edit/${id}`,
        submitLabel: 'Update',
        article: { ...article, id },
        errors,
      });
    }
    const updated = await storage.update(id, article);
    if (!updated) return next();
    req.session.flash = `Updated “${updated.title}”.`;
    res.redirect('/admin');
  })
);

app.post(
  '/delete/:id',
  requireAdmin,
  wrap(async (req, res, next) => {
    const article = await storage.getById(req.params.id);
    if (!article) return next();
    await storage.remove(article.id);
    req.session.flash = `Deleted “${article.title}”.`;
    res.redirect('/admin');
  })
);

/* ---------------- Errors ---------------- */

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found',
    message: "Sorry, that page or article doesn't exist.",
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  });
});

module.exports = app;
