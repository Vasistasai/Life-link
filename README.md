# LifeLink

LifeLink is a responsive frontend demonstration of **NE LogiShield**, an emergency response, incident-reporting, location-intelligence, and logistics concept for Northeast India.

The UI includes Dashboard, Intelligence, Emergency, Report, and Community sections. It uses browser geolocation, an interactive OpenStreetMap street map, an Esri satellite imagery layer, and current weather from the public Open-Meteo API. Reports and optional resized photos are stored in browser localStorage and remain on that device.

The map uses priority-coloured incident pins with type-specific symbols and a matching legend. Intelligence also has a clearly marked AI-insights roadmap preview; it is not connected to an AI model and does not generate guidance.

## Demo and emergency-service limitations

Incident and response-resource markers are illustrative sample data. Community reports are local to the browser and are not shared with other users or authorities. The five-second SOS hold opens a demo confirmation screen only; it does **not** send an alert or location. Use the direct India emergency call link to call 112 in a real emergency. Emergency phone-number availability can vary by state and network.

## Sign-in and active visitors

The app opens with a sign-in screen. When Firebase is configured, Google sign-in and temporary Firebase guest accounts can work across devices. Without Firebase, guest access is local to that browser and Google sign-in is intentionally unavailable. Reports are still stored locally; signing in does not make reports a shared service.

To enable real authentication and visitor presence:

1. Create a Firebase project, enable **Authentication → Google** and **Anonymous** sign-in, and create a Realtime Database.
2. Add `https://vasistasai.github.io` to Firebase Authentication's authorized domains and to the Google OAuth web client's authorized JavaScript origins. Add any local development origin you use as well.
3. In the GitHub repository, add these **Actions variables** (they are browser configuration, not server credentials): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_DATABASE_URL`, `VITE_GOOGLE_CLIENT_ID`, and `VITE_ADMIN_EMAIL`. The Realtime Database URL must be the URL shown in the Firebase console.
4. Add the GitHub Actions secrets `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT`. The service-account JSON is private; never put it in a `VITE_` variable or commit it.
5. Run **Actions → Deploy Firebase database rules → Run workflow**. The rules deny public access and let each signed-in user write only their own heartbeat. To grant the owner presence access, sign in once, find that account's UID under Firebase Authentication, then manually add `/admins/<that-uid>: true` in the Realtime Database console. The app only displays the visitor panel to the configured admin email; the database rules independently enforce admin read access by UID.
6. Run the Pages deploy workflow again so the configured browser variables are included in the build. Google sign-in and cross-device guest accounts become available after this deploy.

Online visitors are approximated by 30-second heartbeats and expire from the display after 75 seconds without an update. When the admin dashboard is connected it removes stale session rows; this is best-effort browser presence, not an audit log. Keep the database rules deployed and never grant public reads.

## Run locally

Install Node.js 22, then run:

```sh
npm ci
npm run dev
```

Vite listens on `0.0.0.0:5175` so it can be opened from another device on the same LAN. Build with `npm run build`.
For locally configured sign-in, create an untracked `.env.local` with the same four `VITE_` variables; do not commit it.

## GitHub Pages

The GitHub Actions workflow builds and deploys the site from `main`. In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The project site is published at `https://vasistasai.github.io/Life-link/` after a successful workflow.
