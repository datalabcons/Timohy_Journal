# Personal Blog

A personal blog where I write and publish articles. Built for the [roadmap.sh Personal Blog project](https://roadmap.sh/projects/personal-blog) as my Week 1 fullstack project.

🔗 **Live site:** https://YOUR-APP-NAME.onrender.com  <!-- TODO: replace after deploying -->

🎬 **Demo video:** <!-- TODO: paste your video link or drag the .mp4 into this README on GitHub -->

https://github.com/YOUR-USERNAME/personal-blog/assets/VIDEO-ID

---

## Overview

The blog has two sections:

**Guest section** (anyone can view)
- **Home** (`/home`): list of all published articles with their publishing dates, newest first
- **Article** (`/article/:id`): the full article with its title, date and content

**Admin section** (login required)
- **Dashboard** (`/admin`): every article with **Edit** and **Delete** actions, plus **+ Add**
- **New Article** (`/new`): form to publish an article (title, publishing date, content)
- **Update Article** (`/edit/:id`): form to edit an existing article
- **Delete**: removes the article after a confirmation prompt

Articles are stored on the filesystem: each article is its own JSON file in the `articles/` folder. No database is used.

The admin pages are protected by a single username and password (set with environment variables). After logging in, a session cookie keeps the admin signed in.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (18+) |
| Backend | Express.js |
| Templating / Frontend | EJS (server-rendered HTML) + plain CSS |
| Auth | express-session (cookie-based sessions) |
| Storage | JSON files on the filesystem (`fs/promises`) |
| Testing | Node's built-in test runner (`node --test`) |
| Hosting | Render |

## Project Structure

```
personal-blog/
├── articles/          # one JSON file per article
├── public/style.css   # styles
├── src/
│   ├── app.js         # Express app and all routes
│   ├── auth.js        # login check + requireAdmin middleware
│   └── storage.js     # read/write/delete article files
├── test/app.test.js   # end-to-end tests
├── views/             # EJS templates (home, article, login, admin/*)
├── server.js          # starts the server
└── render.yaml        # Render deployment config
```

## Running Locally

```bash
git clone https://github.com/YOUR-USERNAME/personal-blog.git
cd personal-blog
npm install
cp .env.example .env   # then edit the values
npm run dev            # http://localhost:3000
```

Log in at `/login` with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env` (defaults are `admin` / `password` if no `.env` exists).

Run the tests:

```bash
npm test
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Port to run on (default `3000`) |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `ARTICLES_DIR` | Optional folder for article files (default `./articles`) |

## Challenges & How I Overcame Them

1. **Keeping admin pages private.** Every admin route needed the same login check. I wrote a small `requireAdmin` middleware that redirects to `/login` when there is no admin session, and added it to each admin route. After login, the session id is regenerated to prevent session fixation, and the password check uses a constant-time comparison.

2. **Using a file as a "database" safely.** Article ids come from the URL, so a request like `/article/../../package` could try to read files outside the `articles/` folder. I only accept numeric ids, and anything else returns a 404.

3. **Delete with a plain HTML form.** HTML forms only send GET and POST, so I made Delete a small POST form (with a confirmation prompt) instead of a link. That way, a crawler or a prefetching browser can't delete an article just by following a link.

4. **Showing user content safely.** Article titles and content are rendered with EJS's escaped output (`<%= %>`), so any HTML typed into an article is shown as text instead of being run in the browser. To keep paragraphs, I split the content on blank lines and wrap each part in its own `<p>`.

5. **Files disappearing on the free host.** Render's free plan resets the filesystem on every redeploy, so articles added on the live site are lost after a new deploy. For this project, the starter articles are committed to the repo. The longer-term fix is a persistent disk (set `ARTICLES_DIR` to its path) or moving to a database.

<!-- TODO: add or edit challenges with anything you personally ran into -->

## Possible Improvements

- Markdown support for article content
- Pagination on the home page
- Draft vs. published articles
- Storing articles in a database for durable hosting
