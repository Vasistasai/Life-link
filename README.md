# LifeLink

LifeLink is a responsive frontend demonstration of **NE LogiShield**, an emergency response, incident-reporting, location-intelligence, and logistics concept for Northeast India.

The UI includes Dashboard, Intelligence, Emergency, Report, and Community sections. It uses browser geolocation, an interactive OpenStreetMap street map, an Esri satellite imagery layer, and current weather from the public Open-Meteo API. Reports and optional resized photos are stored in browser localStorage and remain on that device.

## Demo and emergency-service limitations

Incident and response-resource markers are illustrative sample data. Community reports are local to the browser and are not shared with other users or authorities. The five-second SOS hold opens a demo confirmation screen only; it does **not** send an alert or location. Use the direct India emergency call link to call 112 in a real emergency. Emergency phone-number availability can vary by state and network.

## Run locally

Install Node.js 22, then run:

```sh
npm ci
npm run dev
```

Vite listens on `0.0.0.0:5175` so it can be opened from another device on the same LAN. Build with `npm run build`.

## GitHub Pages

The GitHub Actions workflow builds and deploys the site from `main`. In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The project site is published at `https://vasistasai.github.io/Life-link/` after a successful workflow.
