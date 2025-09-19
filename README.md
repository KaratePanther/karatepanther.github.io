# GitHub Pages Starter

A minimal static website you can host for free with GitHub Pages.

## Quick start

1. Create a new GitHub repo (public).
2. Upload these files or push via Git.
3. In **Settings → Pages**, set:
   - **Source**: Deploy from branch
   - **Branch**: `main` (root)
4. Wait for the green check, then visit:
   - `https://YOUR-USERNAME.github.io/REPO-NAME`

### Custom domain (optional)
- In **Settings → Pages**, add your domain in **Custom domain** (this creates a `CNAME` file).
- In your domain DNS:
  - For `www.example.com` → CNAME to `YOUR-USERNAME.github.io`
  - For `example.com` → A records to: 185.199.108.153 / 109.153 / 110.153 / 111.153
- Back in GitHub, enable **Enforce HTTPS**.

> Tip: Add a `.nojekyll` file if you use folders starting with `_` that Jekyll might ignore.

Test update
