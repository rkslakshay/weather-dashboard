# Weather Dashboard 🌤️

A feature-packed, responsive weather dashboard built with vanilla JavaScript, HTML5, and CSS3. Powered by the OpenWeatherMap REST API with interactive Leaflet maps, Chart.js analytics, and PDF reporting.

---

## 📋 Project Checklist & Feature Status

- [x] **Default City on Load**: Delhi, India loads automatically on first visit without manual search.
- [x] **Smart City Autocomplete**: Intelligent relevance ranking (exact match $\rightarrow$ prefix $\rightarrow$ fuzzy/substring $\rightarrow$ region) returning top 5 prominent cities with cross-platform country flags and keyboard navigation (`↑`, `↓`, `Enter`, `Esc`).
- [x] **Real-Time Meteorological Metrics**: Live temperature, feels-like, humidity, wind speed, barometric pressure, and visibility.
- [x] **Detailed Atmospheric Breakdown**: Real-time UV index, dew point calculation, rotating wind compass direction, and pressure trend tracker.
- [x] **5-Day & Hourly Forecasts**: 3-hour interval breakdown for the next 12 hours and daily midday 5-day forecast cards.
- [x] **Interactive Temperature Curve**: Responsive Chart.js graph displaying forecast trends with dynamic gradients and tooltips.
- [x] **Interactive Radar & Map**: Integrated Leaflet.js map with toggleable precipitation, temperature, cloud cover, and wind layers.
- [x] **Pollen & Allergy Health Forecast**: Seasonal tree, grass, and weed pollen risk levels with actionable health recommendations.
- [x] **Air Quality Index (AQI)**: EPA-standard PM2.5-based AQI calculations with animated progress indicators and category badges.
- [x] **Sun Arc Timeline & Local Clock**: Visual solar arc showing sunrise/sunset progression alongside a live timezone-shifted local clock.
- [x] **Contextual Weather Alerts**: Automatic detection and warnings for thunderstorms, extreme heat, freeze/frost, high winds, and dense fog.
- [x] **Side-by-Side City Comparison**: Compare live weather conditions across two cities simultaneously.
- [x] **Professional PDF Weather Report**: Client-side single-click export of an executive weather summary using `html2pdf.js`.
- [x] **Geolocation**: One-click device GPS coordinate detection for immediate local weather.
- [x] **Persistent Favorites & History**: Save favorite cities and quick-access recent search history stored in `localStorage`.
- [x] **Unit Conversion (°C / °F)**: Instant global unit switching across all cards, charts, hourly stats, and comparison panels.
- [x] **Dark / Light Theme**: Dynamic theme switching with persistent user preference.
- [x] **Dynamic Weather Atmospheres**: Adaptive background gradients and atmospheric effects reflecting current weather conditions.
- [x] **Cross-Platform Country Flags**: High-resolution SVG/PNG country flags via FlagCDN.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Modern Glassmorphism, CSS Grid, Flexbox)
- **Logic**: Vanilla JavaScript (ES6+, Async/Await, Fetch API, DOM APIs)
- **Data & APIs**: OpenWeatherMap API (Current Weather, 5-Day Forecast, Air Pollution, Geo Direct)
- **Mapping & Charts**: Leaflet.js, CartoDB Dark Matter tiles, Chart.js
- **Exporting**: html2pdf.js / html2canvas

---

## 🚀 How to Run Locally

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
   *(Note: `config.js` is excluded from version control via `.gitignore`)*
4. Open `index.html` with VS Code Live Server or directly in your browser.