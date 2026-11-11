// End-to-end tests using Node's built-in test runner (no extra dependencies).
// Run with: npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Use a throwaway articles folder so tests never touch real content.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-test-'));
process.env.ARTICLES_DIR = tmpDir;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'secret';

const app = require('../src/app');

let server;
let base;

before(async () => {
  fs.writeFileSync(
    path.join(tmpDir, '1.json'),
    JSON.stringify({ id: '1', title: 'First post', date: '2026-01-01', content: 'Hello' })
  );
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const form = (data) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(data).toString(),
  redirect: 'manual',
});

async function login() {
  const res = await fetch(`${base}/login`, form({ username: 'admin', password: 'secret' }));
  assert.strictEqual(res.status, 302);
  return res.headers.get('set-cookie').split(';')[0];
}

test('home page lists articles', async () => {
  const res = await fetch(`${base}/home`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /First post/);
});

test('article page shows content', async () => {
  const res = await fetch(`${base}/article/1`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Hello/);
});

test('missing or malicious article ids return 404', async () => {
  assert.strictEqual((await fetch(`${base}/article/999`)).status, 404);
  assert.strictEqual((await fetch(`${base}/article/..%2Fpackage`)).status, 404);
});

test('admin pages redirect to login when logged out', async () => {
  for (const url of ['/admin', '/new', '/edit/1']) {
    const res = await fetch(base + url, { redirect: 'manual' });
    assert.strictEqual(res.status, 302, url);
    assert.strictEqual(res.headers.get('location'), '/login', url);
  }
  const del = await fetch(`${base}/delete/1`, form({}));
  assert.strictEqual(del.headers.get('location'), '/login');
  assert.ok(fs.existsSync(path.join(tmpDir, '1.json')));
});

test('wrong password is rejected', async () => {
  const res = await fetch(`${base}/login`, form({ username: 'admin', password: 'nope' }));
  assert.strictEqual(res.status, 401);
});

test('admin can create, edit and delete an article', async () => {
  const cookie = await login();
  const auth = (opts) => ({ ...opts, headers: { ...opts.headers, Cookie: cookie } });

  // Create
  let res = await fetch(
    `${base}/new`,
    auth(form({ title: 'New <b>one</b>', date: '2026-02-02', content: 'Para one\n\nPara two' }))
  );
  assert.strictEqual(res.status, 302);
  const created = JSON.parse(fs.readFileSync(path.join(tmpDir, '2.json'), 'utf8'));
  assert.strictEqual(created.title, 'New <b>one</b>');

  // HTML in titles is escaped, not rendered
  const page = await (await fetch(`${base}/article/2`)).text();
  assert.match(page, /New &lt;b&gt;one&lt;\/b&gt;/);
  assert.match(page, /<p>Para two<\/p>/);

  // Validation
  res = await fetch(`${base}/new`, auth(form({ title: '', date: 'bad', content: '' })));
  assert.strictEqual(res.status, 400);

  // Edit
  res = await fetch(
    `${base}/edit/2`,
    auth(form({ title: 'Edited', date: '2026-03-03', content: 'Changed' }))
  );
  assert.strictEqual(res.status, 302);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(tmpDir, '2.json'), 'utf8')).title, 'Edited');

  // Dashboard shows it
  const dash = await (await fetch(`${base}/admin`, auth({}))).text();
  assert.match(dash, /Edited/);

  // Delete
  res = await fetch(`${base}/delete/2`, auth(form({})));
  assert.strictEqual(res.status, 302);
  assert.ok(!fs.existsSync(path.join(tmpDir, '2.json')));
});
