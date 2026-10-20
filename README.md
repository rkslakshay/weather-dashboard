# Weather Dashboard 🌤️

A feature-packed, responsive weather dashboard built with vanilla JavaScript, HTML5, and CSS3. Powered by the OpenWeatherMap REST API with interactive Leaflet maps, Chart.js analytics, PDF reporting, PWA offline support, and a secure serverless API proxy.

[![Checklist Status](https://img.shields.io/badge/Checklist-100%25%20Completed-brightgreen)](#-project-checklist--feature-status)
[![PWA Ready](https://img.shields.io/badge/PWA-Enabled-blue)](manifest.json)
[![CI Pipeline](https://img.shields.io/badge/CI-Automated-success)](.github/workflows/ci-deploy.yml)

*See full development roadmap in [CHECKLIST.md](CHECKLIST.md).*

---

## 📋 Highlights & Key Features

- 🏙️ **Remembers your city**: Reopens the last place you viewed (Delhi on first visit).
- 🔍 **City search with autocomplete**: Ranked suggestions with country flags, full keyboard support (`/` to focus, `↑`, `↓`, `Enter`, `Esc`) and screen-reader combobox semantics. Picking a suggestion loads by coordinates, so "Paris, Texas" never becomes Paris, France.
- 🌡️ **Full unit system**: °C / °F switches every value: temperature, wind (km/h ↔ mph), visibility (km ↔ mi) and pressure (hPa ↔ inHg).
- 📅 **Accurate 5-day forecast**: Days are grouped in the city's own time zone, with daily highs/lows, rain chance and temperature-range bars.
- ⏱️ **Next 24 hours**: 3-hour steps with icons, temperatures and rain chance.
- 🧭 **Highlights**: Wind compass with gusts, humidity and dew point, UV index, air quality (US AQI with PM2.5 / PM10 / O₃ / NO₂), feels-like, visibility, pressure, precipitation and a live sunrise–sunset arc.
- 📈 **Chart & map**: Temperature line with rain-chance bars, and a Leaflet map with rain, cloud, temperature and wind layers (tiles proxied so the API key stays private).
- 🎨 **Adaptive design**: Light and dark themes (following your system by default) and a sky background that changes with the weather and time of day.
- ⭐ **Favorites, recent places & city comparison**, plus a **PDF report** of current conditions and the 5-day forecast.
- 📱 **PWA**: Installable, works offline with the last loaded data, and always fetches fresh code after a deploy.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Semantic HTML5, Glassmorphism CSS3 (CSS Grid & Flexbox, CSS Variables, Theme Transitions)
- **Logic**: Vanilla ES6+ JavaScript (Async/Await, Cache Storage, Service Worker API, Geolocation API, Canvas)
- **Security & Proxy**: Serverless Node.js API Proxy (`api/weather.js`) with security headers in `vercel.json`
- **Data & APIs**: OpenWeatherMap API (Current Weather, 5-Day Forecast, Air Pollution, Geo Direct)
- **Mapping & Charts**: Leaflet.js, OpenStreetMap tiles, Chart.js
- **Exporting**: html2pdf.js / html2canvas
- **CI/CD**: GitHub Actions automated syntax check; deployed on Vercel

---

## 🚀 Deployment Guide

### Option 1: Deploy to Vercel (Recommended — Full API Key Protection)
1. Fork or push this repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Under **Project Settings $\rightarrow$ Environment Variables**, add:
   - `OPENWEATHER_API_KEY`: Your OpenWeatherMap API key.
4. Click **Deploy**. Vercel will automatically serve the static assets and the secure serverless proxy at `/api/weather`.

### Option 2: Deploy to Netlify
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
4. Start the local dev server. It serves the site and runs the `/api/weather` proxy just like Vercel. It reads the key from `OPENWEATHER_API_KEY`, a `.env` file, or your `config.js`:
   ```bash
   node dev-server.js
   ```
   Then open http://localhost:3000. Opening `index.html` through any other static server also works: without the proxy, the app calls OpenWeatherMap directly with the `config.js` key.