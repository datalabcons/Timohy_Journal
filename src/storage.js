// File-system storage for articles.
// Each article lives in its own JSON file: articles/<id>.json

const fs = require('fs/promises');
const path = require('path');

const ARTICLES_DIR = process.env.ARTICLES_DIR || path.join(__dirname, '..', 'articles');

// Only allow plain numeric ids, so a request like /article/../../etc/passwd
// can never escape the articles folder.
function isValidId(id) {
  return /^\d+$/.test(String(id));
}

function fileFor(id) {
  return path.join(ARTICLES_DIR, `${id}.json`);
}

async function ensureDir() {
  await fs.mkdir(ARTICLES_DIR, { recursive: true });
}

async function getAll() {
  await ensureDir();
  const files = await fs.readdir(ARTICLES_DIR);
  const articles = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf8');
      articles.push(JSON.parse(raw));
    } catch (err) {
      console.warn(`Skipping unreadable article file ${file}: ${err.message}`);
    }
  }

  // Newest first; ties broken by id so the order is stable.
  return articles.sort(
    (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id)
  );
}

async function getById(id) {
  if (!isValidId(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function nextId() {
  const all = await getAll();
  const max = all.reduce((m, a) => Math.max(m, Number(a.id)), 0);
  return String(max + 1);
}

async function create({ title, date, content }) {
  await ensureDir();
  const id = await nextId();
  const article = { id, title, date, content };
  await fs.writeFile(fileFor(id), JSON.stringify(article, null, 2));
  return article;
}

async function update(id, { title, date, content }) {
  const existing = await getById(id);
  if (!existing) return null;
  const article = { ...existing, title, date, content };
  await fs.writeFile(fileFor(id), JSON.stringify(article, null, 2));
  return article;
}

async function remove(id) {
  if (!isValidId(id)) return false;
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

module.exports = { getAll, getById, create, update, remove, isValidId };
