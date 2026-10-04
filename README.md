# Weather Dashboard 🌤️

A feature-packed, responsive weather dashboard built with vanilla JavaScript, HTML5, and CSS3. Powered by the OpenWeatherMap REST API with interactive Leaflet maps, Chart.js analytics, PDF reporting, PWA offline support, and a secure serverless API proxy.

[![Checklist Status](https://img.shields.io/badge/Checklist-100%25%20Completed-brightgreen)](#-project-checklist--feature-status)
[![PWA Ready](https://img.shields.io/badge/PWA-Enabled-blue)](manifest.json)
[![CI Pipeline](https://img.shields.io/badge/CI-Automated-success)](.github/workflows/ci-deploy.yml)

*See full development roadmap in [CHECKLIST.md](CHECKLIST.md).*

---

## 📋 Highlights & Key Features

- 🏙️ **Default City on Load**: Delhi, India loads automatically on initial launch without manual interaction.
- 🔍 **Smart City Autocomplete**: Intelligent ranking (Exact $\rightarrow$ Prefix $\rightarrow$ Fuzzy/Substring $\rightarrow$ Region) displaying up to 5 top cities with cross-platform country flags and keyboard navigation (`↑`, `↓`, `Enter`, `Esc`).
- ⚡ **Dual-Mode API & TTL Caching**: LocalStorage + in-memory smart caching (10-min TTL) eliminates redundant API requests and avoids rate limits. Seamlessly falls back between serverless proxy and direct client calls.
- 📱 **Progressive Web App (PWA)**: Installable on desktop and mobile with `manifest.json` and `service-worker.js` offline shell caching.
- 🌡️ **Comprehensive Meteorology**: Live temperature, feels-like, humidity, wind speed, barometric pressure, visibility, UV index, and dew point.
- 🧭 **Atmospheric Dynamics**: Rotating wind direction compass, pressure trend tracker (Rising/Falling/Steady), and dynamic weather activity advisor.
- 📈 **Visual Analytics & Radar**: Smooth Chart.js temperature curve, animated sun progression arc, local timezone clock, and an interactive Leaflet radar map with Precipitation, Temperature, Clouds, and Wind layers.
- 🌬️ **Air Quality Index (AQI)**: Real-time EPA-standard PM2.5 air quality tracking with color-coded fill bar and category badge.
- ⏱️ **AccuWeather-style Hourly Forecast**: Next 24-hour strip showing icon, temperature, feels-like, precipitation probability, and wind speed per slot.
- ⚖️ **Multi-City Comparison & PDF Export**: Compare two cities side-by-side and export executive reports in PDF with a single click.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Semantic HTML5, Glassmorphism CSS3 (CSS Grid & Flexbox, CSS Variables, Theme Transitions)
- **Logic**: Vanilla ES6+ JavaScript (Async/Await, Cache Storage, Service Worker API, Geolocation API, Canvas)
- **Security & Proxy**: Serverless Node.js API Proxy (`api/weather.js`) with security headers in `vercel.json`
- **Data & APIs**: OpenWeatherMap API (Current Weather, 5-Day Forecast, Air Pollution, Geo Direct)
- **Mapping & Charts**: Leaflet.js, OpenStreetMap tiles, Chart.js
- **Exporting**: html2pdf.js / html2canvas
- **CI/CD**: GitHub Actions automated syntax check and GitHub Pages deployment workflow

---

## 🚀 Deployment Guide

### Option 1: Deploy to Vercel (Recommended — Full API Key Protection)
1. Fork or push this repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Under **Project Settings $\rightarrow$ Environment Variables**, add:
   - `OPENWEATHER_API_KEY`: Your OpenWeatherMap API key.
4. Click **Deploy**. Vercel will automatically serve the static assets and the secure serverless proxy at `/api/weather`.

### Option 2: Deploy to GitHub Pages (Static Hosting)
1. Go to your repository **Settings $\rightarrow$ Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Push to `main` — the included `.github/workflows/ci-deploy.yml` pipeline will automatically validate the code and deploy your dashboard.
4. Create a repository secret or provide `config.js` for client-side API authentication.

### Option 3: Deploy to Netlify
1. Connect your repository to [Netlify](https://www.netlify.com).
2. Set build directory to `.` (root).
3. Add environment variable `OPENWEATHER_API_KEY` in Netlify dashboard.

---

## 💻 How to Run Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/rkslakshay/weather-dashboard.git
   cd weather-dashboard
   ```
2. Obtain a free API key from [OpenWeatherMap](https://openweathermap.org/).
3. Copy `config.example.js` to `config.js` and insert your API key:
   ```javascript
   const CONFIG = {
     API_KEY: "YOUR_API_KEY_HERE"
   };
   ```
   *(Note: `config.js` is excluded from git via `.gitignore`)*
4. Open `index.html` with VS Code Live Server or any browser:
   ```bash
   npx serve .
   # or simply double-click index.html
   ```