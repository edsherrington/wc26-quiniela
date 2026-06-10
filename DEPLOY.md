# Deploy guide — WC26 Family Quiniela

Goal: get the site online for free, with scores updating automatically a few minutes
after each match. Plain English, in order. Budget about 15 minutes, once.

The plan: put the project on **GitHub** (public, so the auto-updater is free and fast),
connect **Netlify** to it (publishes the site and re-publishes whenever scores change),
and add your **API key** so the updater can fetch results.

> Do all of this **after** you've added the other family members and their logos and
> re-run `python3 scripts/ingest.py`, so everyone's in from day one.

---

## Step 1 — Get a free API-Football key (2 min)

1. Go to <https://www.api-football.com> and create a free account.
2. Open your **Dashboard** → copy the **API key** (a long string of letters/numbers).
3. Keep it somewhere handy for Step 4. Treat it like a password.

---

## Step 2 — Put the project on GitHub (5 min)

Easiest route is **GitHub Desktop** (no command line):

1. Install GitHub Desktop from <https://desktop.github.com> and sign in (create a free
   GitHub account if you don't have one).
2. **File → Add Local Repository…** and choose this folder:
   `outputs/personal/wc26-quiniela`
   (If it says it's not a git repository, click **"create a repository"** when prompted.)
3. Give it a name like `wc26-quiniela`, then click **Publish repository**.
4. **Untick "Keep this code private"** so it's public (this makes the auto-updater free
   and lets it run every 10 min). Click **Publish**.

> Prefer the command line? From inside the folder:
> ```
> git init && git add . && git commit -m "WC26 quiniela"
> gh repo create wc26-quiniela --public --source=. --push
> ```
> (needs the GitHub CLI `gh`, logged in.)

---

## Step 3 — Connect Netlify (3 min)

1. Go to <https://app.netlify.com> and sign up (you can "Sign up with GitHub" — easiest).
2. **Add new site → Import an existing project → Deploy with GitHub.**
3. Authorise Netlify, then pick your `wc26-quiniela` repo.
4. Leave all the build settings **blank/default** (there's no build step — it's a plain
   site). Just click **Deploy**.
5. After ~30 seconds it's live. Netlify gives you a URL like
   `https://something-random.netlify.app`. You can rename it under
   **Site configuration → Change site name** (e.g. `sherrington-wc26.netlify.app`).
6. Share that link with the family. From now on, whenever the scores file changes,
   Netlify re-publishes automatically.

---

## Step 4 — Give the auto-updater your API key (3 min)

This lets the GitHub robot fetch results. In your repo on **github.com**:

1. **Settings → Secrets and variables → Actions → New repository secret.**
   - Name: `API_FOOTBALL_KEY`
   - Secret: *(paste the key from Step 1)*
   - Click **Add secret**.
2. **Settings → Actions → General →** scroll to **Workflow permissions** → select
   **"Read and write permissions"** → **Save**. (This lets the robot save updated scores
   back to the repo.)

That's it. The updater (in `.github/workflows/fetch-results.yml`) now runs every 10
minutes on its own.

---

## Step 5 — Test it (1 min)

1. In your repo: **Actions** tab → **Fetch WC26 results** → **Run workflow** (the manual
   trigger). 
2. Watch it run green. If matches have happened, it'll commit updated scores and Netlify
   will re-publish within a minute. Before the tournament starts there's nothing to fetch,
   which is fine — it'll just find no finished games.

---

## Updating things later

- **Add or fix a result by hand:** run `node scripts/admin-server.js` locally, edit at
  `localhost:8123/admin.html`, then in GitHub Desktop click **Commit** and **Push**.
  Netlify re-publishes. Your manual fixes always win over the API.
- **Add another family member after launch:** drop their `.xlsx` in `entries/`, their logo
  in `assets/logos/`, run `python3 scripts/ingest.py`, then commit & push.

## If something looks off

- **Scores not updating:** check the **Actions** tab for a failed (red) run. Most common
  cause is a missing/mistyped API key (Step 4) or write permission not set.
- **A team isn't matching:** the run log lists "unmatched" teams. Add an alias in
  `scripts/fetch-results.js` (the `NAME_ALIASES` list), commit, push.
- **Keeping the repo private instead?** Edit `.github/workflows/fetch-results.yml` and
  change `*/10` to `*/30` to stay inside the free minutes.
