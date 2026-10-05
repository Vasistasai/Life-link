# LifeLink

LifeLink is a responsive, frontend-only demonstration dashboard for a regional emergency response network. It uses illustrative sample data; it does not connect to live emergency, weather, location, or dispatch services.

## Run locally

Install Node.js 22, then run:

```sh
npm ci
npm run dev
```

Create and verify a production build with `npm run build`.

## Publish on GitHub Pages

The included GitHub Actions workflow builds the site and deploys it to GitHub Pages whenever changes are pushed to `main`.

1. In the repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push the project files to the `main` branch and check the **Actions** tab for the deployment result.

For this repository, the published URL will be `https://vasistasai.github.io/Life-link/` once the deployment succeeds.
