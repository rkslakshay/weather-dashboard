# SkyPulse — An Intelligent Weather Dashboard with Personalized Insights

SkyPulse turns a raw forecast into decisions: when to go out, what to wear and what to watch for. It is built with vanilla JavaScript, HTML and CSS, and uses a serverless proxy so the OpenWeatherMap API key never reaches the browser.

[![PWA Ready](https://img.shields.io/badge/PWA-Enabled-blue)](manifest.json)
[![CI Pipeline](https://img.shields.io/badge/CI-Automated-success)](.github/workflows/ci-deploy.yml)

*Feature status is tracked in [CHECKLIST.md](CHECKLIST.md).*

---

## 🎯 Weather Window Finder

Pick an activity and SkyPulse ranks the best non-overlapping 3-hour periods up to 48 hours ahead. Each result shows the date, time range, score out of 100, category, temperature, rain chance, wind and the reasons behind the ranking. Selecting a result moves the forecast timeline to that time and highlights the period.

| Activity | Preferred temperature | Wind below | Rain chance below | Also considers |
|---|---|---|---|---|
| Walking | 15–24°C | 25 km/h | 20% | Humidity 30–70% |
| Running | 10–18°C | 20 km/h | 15% | Humidity and heat, penalized sooner |
| Cycling | 14–22°C | 15 km/h | 10% | Extra penalty for gusts above 30 km/h |
| Outdoor dining | 20–26°C | 12 km/h | 5% | Lunch 12–2 PM and dinner 7–10 PM |

These are configurable preferences in `ACTIVITIES` (`insights.js`), not safety thresholds.

**How scoring works.** The calculation is deterministic and involves no AI model:

1. **Hourly samples.** OpenWeatherMap's free forecast is 3-hourly, so hourly values are interpolated between real readings. Nothing is extrapolated beyond coverage, and a window can never span a gap in the data.
2. **Metric scores.** Temperature, rain chance, wind, humidity and gusts each score 0–100 against the activity's preferences (100 inside the range, falling linearly outside it).
3. **Weighted average.** Each activity has its own weights.
4. **Deductions.** Storms, snow, rain, high heat, sub-zero feels-like temperatures, strong gusts when cycling, low visibility and late-night hours subtract points.
5. **Categories.** 85–100 Optimal, 70–84 Good, 50–69 Fair, below 50 Poor.

**Missing data is never treated as zero or ideal.** A window missing temperature, rain chance or wind is not scored at all. Missing humidity or gusts drop out of the average, and the card says so. If coverage only allows one or two windows, only those are shown.

## 💡 Personal Weather Briefing

A rule-based summary of current conditions and the next 24 hours, with the most important items first:

- **Outfit & Comfort**: based on the feels-like temperature, explaining wind chill or humidity when they matter.
- **Rain & Umbrella**: the highest-risk period, expected amount, and whether an umbrella or waterproofs may help. It speaks in chances, not promises.
- **Sun Protection**: follows the reported UV index. The API gives one daily value, so no peak hour is claimed.
- **Air Quality**: US AQI derived from PM2.5, using the same value as the air quality tile.
- **Wind & Outdoor Activities**: current wind and the strongest gusts ahead, with cycling and outdoor guidance.

Sections with no data are left out and named as unavailable. The briefing updates when the city, data or units change.

## 📊 More Features

- **Scrollable forecast timeline**: a custom SVG curve (Catmull-Rom). The hero, tiles, air quality and sky follow the selected moment. Works by scroll, drag, click and keyboard.
- **Forecast analytics**: a supplementary Chart.js 4.4.1 chart with temperature, precipitation chance and optional wind on separate axes, in 24-hour and full-forecast views. Clicking it moves the timeline.
- **Living sky**: sun, moon, stars, clouds, rain, snow, fog and lightning driven by real conditions.
- **Environmental data**: US AQI and pollutants, UV, dew point, wind compass, visibility, pressure, and a sunrise-sunset arc.
- **Weather map**: Leaflet with rain, cloud, temperature and wind layers (tiles proxied to protect the key).
- **Places**: autocomplete search, geolocation, favorites, recent places and city comparison.
- **PDF report**: current conditions, briefing, top windows for the selected activity, forecast table and chart, in the selected units.
- **PWA**: installable, with offline support. Saved data is labelled with its age ("Saved forecast from 3 hr ago"), so it is never mistaken for live data.
- **Units and themes**: °C/°F across every value, plus light and dark themes.

---

## 🛠️ Architecture & Tech Stack

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page structure and design system |
| `script.js` | UI, API layer, timeline, map, chart and PDF |
| `insights.js` | Pure scoring and briefing engines (`scoreWeatherWindow`, `findWeatherWindows`, `generatePersonalBriefing`) |
| `api/weather.js` | Serverless proxy that holds the API key and allow-lists endpoints |
| `service-worker.js` | Offline shell and network-first data caching |
| `vendor/chart.umd.js` | Chart.js 4.4.1, bundled locally so the chart works offline |
| `dev-server.js` | Zero-dependency local server, including the API route |
| `test/insights.test.js` | Engine tests |

There is no build step and no npm dependencies. Other libraries: Leaflet and html2pdf.js (pinned CDN versions). Data: OpenWeatherMap current weather, 5-day/3-hour forecast, air pollution and forecast, UV, geocoding and map tiles.

**Configuration:** set `OPENWEATHER_API_KEY` as a server-side environment variable. Never put a key in committed code.

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

---

## 🧪 Testing

```bash
node --test test/insights.test.js
```

The tests run in CI, alongside syntax checks, on every push.

---

## 📸 Screenshots

No screenshots are committed yet. To add them, save images to `assets/screenshots/` and link them here, for example `![Weather Window Finder](assets/screenshots/finder.png)`.
