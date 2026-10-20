'use strict';

/* ==========================================================================
   Config & state
   ========================================================================== */
const API_KEY = typeof CONFIG !== 'undefined' && CONFIG.API_KEY ? CONFIG.API_KEY : '';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_HISTORY = 6;
const MAX_FAVORITES = 8;
const DEFAULT_PLACE = { query: 'Delhi' };
const ICON_BASE = 'https://cdn.jsdelivr.net/npm/@bybas/weather-icons@2.0.0/production/fill/all/';

const state = {
  units: 'metric',
  place: null,        // what the user asked for: { query } or { lat, lon, name, country }
  current: null,      // /weather response
  forecast: null,     // /forecast response
  air: null,          // /air_pollution response
  uvi: null,          // number or null
  compare: null,      // /weather response for the comparison city
  loadedAt: 0
};

let isProxyAvailable = location.protocol.startsWith('http');
let loadSeq = 0;
let clockTimer = null;
let tempChart = null;
let radarMap = null;
let radarBase = null;
let radarOverlay = null;
let radarMarker = null;
let radarLayer = 'precipitation';

const $ = (id) => document.getElementById(id);
const el = {
  dashboard: $('dashboard'),
  progress: $('progress'),
  searchForm: $('search-form'),
  cityInput: $('city-input'),
  acList: $('autocomplete-list'),
  geoBtn: $('geo-btn'),
  themeToggle: $('theme-toggle'),
  places: $('places'),
  favChips: $('favorites-chips'),
  historyGroup: $('history-group'),
  historyChips: $('history-chips'),
  clearHistory: $('clear-history'),
  errorBanner: $('error-banner'),
  errorText: $('error-text'),
  errorRetry: $('error-retry'),
  errorClose: $('error-close'),
  offlineBanner: $('offline-banner'),
  cityName: $('city-name'),
  localTime: $('local-time'),
  favBtn: $('favorite-btn'),
  pdfBtn: $('export-pdf-btn'),
  temperature: $('temperature'),
  condition: $('weather-condition'),
  tempHigh: $('temp-high'),
  tempLow: $('temp-low'),
  feelsLike: $('feels-like'),
  heroIcon: $('weather-icon'),
  summary: $('summary'),
  advisory: $('advisory'),
  advisoryTitle: $('advisory-title'),
  advisoryText: $('advisory-text'),
  dailyList: $('daily-list'),
  hourlyList: $('hourly-list'),
  windSpeed: $('wind-speed'),
  windUnit: $('wind-unit'),
  windGust: $('wind-gust'),
  windDir: $('wind-dir'),
  windNeedle: $('wind-needle'),
  humidity: $('humidity'),
  humidityBar: $('humidity-bar'),
  dewPoint: $('dew-point'),
  uvIndex: $('uv-index'),
  uvCategory: $('uv-category'),
  uvMarker: $('uv-marker'),
  uvAdvice: $('uv-advice'),
  aqiValue: $('aqi-value'),
  aqiCategory: $('aqi-category'),
  aqiMarker: $('aqi-marker'),
  aqiPollutants: $('aqi-pollutants'),
  feelsTile: $('feels-like-tile'),
  feelsNote: $('feels-note'),
  visibility: $('visibility'),
  visibilityUnit: $('visibility-unit'),
  visibilityNote: $('visibility-note'),
  pressure: $('pressure'),
  pressureUnit: $('pressure-unit'),
  pressureNote: $('pressure-note'),
  precipChance: $('precip-chance'),
  precipNote: $('precip-note'),
  sunProgress: $('sun-progress'),
  sunMarker: $('sun-marker'),
  sunrise: $('sunrise-time'),
  sunset: $('sunset-time'),
  daylight: $('daylight'),
  chartCanvas: $('temp-chart'),
  radarMap: $('radar-map'),
  compareForm: $('compare-form'),
  compareInput: $('compare-input'),
  compareBtn: $('compare-btn'),
  compareResult: $('compare-result'),
  toasts: $('toasts')
};

/* ==========================================================================
   Small utilities
   ========================================================================== */
// Safe localStorage wrapper (private mode and blocked storage throw)
function store() {}
store.get = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  } catch (e) { return fallback; }
};
store.set = (key, value) => {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) { /* ignore */ }
};
store.remove = (key) => {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
};

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch (e) {
    return code;
  }
}

function flagImg(code, cls = 'flag') {
  if (!code || !/^[a-z]{2}$/i.test(code)) return '';
  return `<img class="${cls}" src="https://flagcdn.com/w40/${code.toLowerCase()}.png" alt="" width="20" height="15" loading="lazy" />`;
}

/* ---------- Units ---------- */
const units = {
  temp: (c) => (isNum(c) ? Math.round(state.units === 'metric' ? c : c * 9 / 5 + 32) : '--'),
  deg: (c) => `${units.temp(c)}°`,
  wind: (ms) => (isNum(ms) ? Math.round(state.units === 'metric' ? ms * 3.6 : ms * 2.237) : '--'),
  windUnit: () => (state.units === 'metric' ? 'km/h' : 'mph'),
  distance: (m) => {
    if (!isNum(m)) return '--';
    const v = state.units === 'metric' ? m / 1000 : m / 1609.34;
    if (m >= 10000) return state.units === 'metric' ? '10+' : '6+';
    return v < 10 ? v.toFixed(1) : Math.round(v);
  },
  distanceUnit: () => (state.units === 'metric' ? 'km' : 'mi'),
  pressure: (hpa) => (isNum(hpa) ? (state.units === 'metric' ? Math.round(hpa) : (hpa * 0.02953).toFixed(2)) : '--'),
  pressureUnit: () => (state.units === 'metric' ? 'hPa' : 'inHg'),
  rain: (mm) => (state.units === 'metric' ? `${mm.toFixed(1)} mm` : `${(mm / 25.4).toFixed(2)} in`)
};

/* ---------- City-local time ---------- */
// OpenWeatherMap gives UTC timestamps plus the city's UTC offset in seconds.
// Shift the timestamp by the offset and format it as UTC to get city wall-clock time.
function cityDate(unix, tz) {
  return new Date((unix + (tz || 0)) * 1000);
}
function fmtTime(unix, tz, opts = { hour: 'numeric', minute: '2-digit' }) {
  return cityDate(unix, tz).toLocaleTimeString(undefined, { ...opts, timeZone: 'UTC' });
}
function fmtHour(unix, tz) {
  return cityDate(unix, tz).toLocaleTimeString(undefined, { hour: 'numeric', timeZone: 'UTC' });
}
function fmtDay(unix, tz, opts = { weekday: 'short' }) {
  return cityDate(unix, tz).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}
function dayKey(unix, tz) {
  return cityDate(unix, tz).toISOString().slice(0, 10);
}

/* ---------- Weather icons & sky ---------- */
const ICON_MAP = {
  '01d': 'clear-day', '01n': 'clear-night',
  '02d': 'partly-cloudy-day', '02n': 'partly-cloudy-night',
  '03d': 'cloudy', '03n': 'cloudy',
  '04d': 'overcast-day', '04n': 'overcast-night',
  '09d': 'drizzle', '09n': 'drizzle',
  '10d': 'rain', '10n': 'rain',
  '11d': 'thunderstorms-day', '11n': 'thunderstorms-night',
  '13d': 'snow', '13n': 'snow',
  '50d': 'fog-day', '50n': 'fog-night'
};
const ATMOSPHERE_ICONS = { Mist: 'mist', Smoke: 'smoke', Dust: 'dust-day', Sand: 'dust-day', Ash: 'smoke' };

function iconUrl(weather) {
  if (!weather) return `${ICON_BASE}cloudy.svg`;
  const night = (weather.icon || '').endsWith('n');
  let name = ICON_MAP[weather.icon] || 'cloudy';
  if (weather.icon && weather.icon.startsWith('50')) {
    if (weather.main === 'Haze') name = night ? 'haze-night' : 'haze-day';
    else if (ATMOSPHERE_ICONS[weather.main]) name = ATMOSPHERE_ICONS[weather.main];
  }
  return `${ICON_BASE}${name}.svg`;
}

function iconImg(weather, cls) {
  const alt = weather ? capitalize(weather.description) : '';
  return `<img class="wx-icon ${cls}" src="${iconUrl(weather)}" alt="${esc(alt)}" loading="lazy" decoding="async" />`;
}

function skyFor(weather) {
  const code = (weather && weather.icon) || '01d';
  const night = code.endsWith('n');
  switch (code.slice(0, 2)) {
    case '01': return night ? 'clear-night' : 'clear-day';
    case '02': case '03': case '04': return night ? 'clouds-night' : 'clouds-day';
    case '09': case '10': return 'rain';
    case '11': return 'storm';
    case '13': return 'snow';
    case '50': return 'fog';
    default: return 'clear-day';
  }
}

// Fade weather icons in once they load
document.addEventListener('load', (e) => {
  if (e.target.classList && e.target.classList.contains('wx-icon')) e.target.classList.add('loaded');
}, true);
document.addEventListener('error', (e) => {
  if (e.target.classList && e.target.classList.contains('wx-icon')) e.target.style.visibility = 'hidden';
}, true);

/* ==========================================================================
   API layer
   ========================================================================== */
class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http' } = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

function cacheGet(key, ttl) {
  const entry = store.get(`weather_cache_${key}`);
  if (entry && entry.timestamp && Date.now() - entry.timestamp < ttl) return entry.data;
  return null;
}
function cacheSet(key, data) {
  store.set(`weather_cache_${key}`, { timestamp: Date.now(), data });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('Request timed out', { kind: 'timeout' });
    throw new ApiError('Network error', { kind: 'network' });
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res) {
  const body = await res.json().catch(() => ({}));
  return new ApiError(body.message || body.error || `Request failed (${res.status})`, { status: res.status });
}

const DIRECT_URLS = {
  weather: 'https://api.openweathermap.org/data/2.5/weather',
  forecast: 'https://api.openweathermap.org/data/2.5/forecast',
  air_pollution: 'https://api.openweathermap.org/data/2.5/air_pollution',
  uvi: 'https://api.openweathermap.org/data/2.5/uvi',
  'geo/1.0/direct': 'https://api.openweathermap.org/geo/1.0/direct'
};

/**
 * Calls the /api/weather proxy (which holds the API key server-side).
 * Falls back to calling OpenWeatherMap directly only when there is no proxy
 * and a local config.js key exists (local development).
 */
async function fetchWeatherApi(endpoint, params = {}, { ttl = CACHE_TTL_MS, cache = true } = {}) {
  const query = new URLSearchParams(params).toString();
  const cacheKey = `${endpoint}_${query}`;
  if (cache) {
    const hit = cacheGet(cacheKey, ttl);
    if (hit) return hit;
  }

  if (isProxyAvailable) {
    let res = null;
    try {
      res = await fetchWithTimeout(`/api/weather?endpoint=${encodeURIComponent(endpoint)}&${query}`);
    } catch (err) {
      if (!API_KEY) throw err;
    }
    if (res) {
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      if (res.ok && isJson) {
        const data = await res.json();
        if (cache) cacheSet(cacheKey, data);
        return data;
      }
      if (isJson || !API_KEY) throw await readError(res);
      isProxyAvailable = false; // static host with no API route; use direct mode
    }
  }

  if (!API_KEY) throw new ApiError('No API key configured for direct requests', { status: 401 });
  const res = await fetchWithTimeout(`${DIRECT_URLS[endpoint]}?${query}&appid=${API_KEY}`);
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  if (cache) cacheSet(cacheKey, data);
  return data;
}

function describeError(err, place) {
  const label = place && (place.name || place.query);
  if (err.kind === 'timeout') return 'The weather service took too long to respond.';
  if (err.kind === 'network') return navigator.onLine ? "Can't reach the weather service right now." : "You're offline. Check your connection and try again.";
  if (err.status === 404) return label ? `We couldn't find "${label}". Check the spelling or pick a suggestion.` : "We couldn't find that place.";
  if (err.status === 401) return 'The weather service rejected the API key.';
  if (err.status === 429) return 'Too many requests. Please wait a minute and try again.';
  if (err.status >= 500) return 'The weather service is having trouble. Please try again shortly.';
  return err.message || 'Something went wrong while loading the weather.';
}

/* ==========================================================================
   Loading a place
   ========================================================================== */
function placeParams(place) {
  return isNum(place.lat) && isNum(place.lon) ? { lat: place.lat, lon: place.lon } : { q: place.query };
}

async function loadPlace(place, { silent = false } = {}) {
  const seq = ++loadSeq;
  const firstLoad = !state.current;
  hideError();
  if (!silent) startProgress();
  if (!firstLoad && !silent) el.dashboard.classList.add('is-refreshing');

  try {
    const params = { ...placeParams(place), units: 'metric' };
    const [current, forecast] = await Promise.all([
      fetchWeatherApi('weather', params),
      fetchWeatherApi('forecast', params)
    ]);
    if (seq !== loadSeq) return; // a newer search started meanwhile

    state.place = place;
    state.current = current;
    state.forecast = forecast;
    state.air = null;
    state.uvi = null;
    state.loadedAt = Date.now();

    const remembered = {
      name: place.name || current.name,
      country: place.country || current.sys.country,
      lat: current.coord.lat,
      lon: current.coord.lon
    };
    store.set('lastPlace', remembered);
    addToHistory(remembered);

    el.dashboard.hidden = false;
    el.dashboard.classList.remove('is-loading');
    el.dashboard.setAttribute('aria-busy', 'false');
    renderAll();
    if (!silent) el.cityInput.value = '';

    // Secondary data loads in the background and fills its tiles when ready
    const { lat, lon } = current.coord;
    fetchWeatherApi('air_pollution', { lat, lon }, { ttl: 15 * 60 * 1000 })
      .then((air) => { if (seq === loadSeq) { state.air = air; renderAir(); } })
      .catch(() => { if (seq === loadSeq) renderAir(); });
    fetchWeatherApi('uvi', { lat, lon }, { ttl: 15 * 60 * 1000 })
      .then((d) => { if (seq === loadSeq) { state.uvi = isNum(d && d.value) ? d.value : null; renderUv(); } })
      .catch(() => { if (seq === loadSeq) renderUv(); });
  } catch (err) {
    if (seq !== loadSeq) return;
    const retryable = err.kind !== 'http' || err.status === 429 || err.status >= 500;
    showError(describeError(err, place), retryable ? () => loadPlace(place) : null);
    if (firstLoad) el.dashboard.hidden = true;
  } finally {
    if (seq === loadSeq) {
      stopProgress();
      el.dashboard.classList.remove('is-refreshing');
    }
  }
}

function startProgress() {
  el.progress.classList.remove('done');
  void el.progress.offsetWidth;
  el.progress.classList.add('active');
}
function stopProgress() {
  el.progress.classList.remove('active');
  el.progress.classList.add('done');
}

/* ==========================================================================
   Derived data
   ========================================================================== */
// Group the 3-hourly forecast into city-local days
function buildDaily() {
  const { forecast, current } = state;
  const tz = forecast.city.timezone;
  const days = new Map();

  const add = (dt, temp, pop, weather) => {
    const key = dayKey(dt, tz);
    let day = days.get(key);
    if (!day) {
      day = { key, dt, min: Infinity, max: -Infinity, pop: 0, weather: null, score: Infinity };
      days.set(key, day);
    }
    day.min = Math.min(day.min, temp);
    day.max = Math.max(day.max, temp);
    day.pop = Math.max(day.pop, pop || 0);
    // Represent each day by the reading closest to early afternoon
    const score = Math.abs(cityDate(dt, tz).getUTCHours() - 14);
    if (weather && score < day.score) {
      day.score = score;
      day.weather = weather;
    }
  };

  add(current.dt, current.main.temp, 0, current.weather[0]);
  for (const item of forecast.list) add(item.dt, item.main.temp, item.pop, item.weather[0]);

  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 5);
}

function dewPointC(tempC, rh) {
  if (!isNum(tempC) || !isNum(rh) || rh <= 0) return null;
  const a = 17.62, b = 243.12;
  const g = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return (b * g) / (a - g);
}

function cardinal(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function buildAdvisory(cur) {
  const main = cur.weather[0].main;
  const t = cur.main.temp;
  const feels = cur.main.feels_like;
  const wind = Math.max(cur.wind.speed || 0, cur.wind.gust || 0);
  if (['Thunderstorm', 'Tornado', 'Squall'].includes(main)) {
    return { title: `${main} nearby`, text: 'Lightning and sudden gusts are possible. Stay indoors and away from open ground.' };
  }
  if (feels >= 40 || t >= 38) {
    return { title: 'Extreme heat', text: `It feels like ${units.deg(feels)}. Drink water, avoid midday sun and check on vulnerable people.` };
  }
  if (t <= 0) {
    return { title: 'Freezing temperatures', text: 'Watch for ice on roads and paths, and dress in warm layers.' };
  }
  if (wind >= 14) {
    return { title: 'Strong wind', text: `Gusts up to ${units.wind(wind)} ${units.windUnit()}. Secure loose objects and take care on bikes.` };
  }
  if (isNum(cur.visibility) && cur.visibility <= 1000) {
    return { title: 'Low visibility', text: `Visibility is ${units.distance(cur.visibility)} ${units.distanceUnit()}. Drive slowly with low-beam lights.` };
  }
  return null;
}

function buildSummary(today) {
  const cur = state.current;
  const desc = capitalize(cur.weather[0].description);
  const parts = [`${desc} right now.`, `High ${units.deg(today.max)}, low ${units.deg(today.min)}.`];
  const isSnow = state.forecast.list.slice(0, 8).some((i) => i.weather[0].main === 'Snow');
  const next24 = Math.max(0, ...state.forecast.list.slice(0, 8).map((i) => i.pop || 0));
  if (next24 >= 0.6) parts.push(`${isSnow ? 'Snow' : 'Rain'} is likely in the next 24 hours (${Math.round(next24 * 100)}%).`);
  else if (next24 >= 0.25) parts.push(`Some chance of ${isSnow ? 'snow' : 'rain'} in the next 24 hours (${Math.round(next24 * 100)}%).`);
  else parts.push('No rain expected in the next 24 hours.');
  return parts.join(' ');
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function renderAll() {
  if (!state.current || !state.forecast) return;
  const daily = buildDaily();
  renderHero(daily[0]);
  renderDaily(daily);
  renderHourly();
  renderHighlights(daily[0]);
  renderSun();
  renderUv();
  renderAir();
  renderChart();
  renderRadar();
  renderCompare();
  renderPlaces();
  document.body.dataset.sky = skyFor(state.current.weather[0]);
}

function renderHero(today) {
  const cur = state.current;
  const name = (state.place && state.place.name) || cur.name;
  const country = cur.sys.country;
  el.cityName.innerHTML = `<span>${esc(name)}</span>${flagImg(country)}`;
  document.title = `${name} ${units.deg(cur.main.temp)} — SkyPulse`;

  startClock(cur.timezone, countryName(country));

  el.temperature.textContent = units.temp(cur.main.temp);
  el.condition.textContent = cur.weather[0].description;
  el.tempHigh.textContent = units.deg(today.max);
  el.tempLow.textContent = units.deg(today.min);
  el.feelsLike.textContent = units.deg(cur.main.feels_like);
  const heroSrc = iconUrl(cur.weather[0]);
  if (el.heroIcon.getAttribute('src') !== heroSrc) {
    el.heroIcon.classList.add('wx-icon');
    el.heroIcon.classList.remove('loaded');
    el.heroIcon.src = heroSrc;
  }
  el.heroIcon.alt = capitalize(cur.weather[0].description);
  el.summary.textContent = buildSummary(today);

  const advisory = buildAdvisory(cur);
  el.advisory.hidden = !advisory;
  if (advisory) {
    el.advisoryTitle.textContent = advisory.title;
    el.advisoryText.textContent = advisory.text;
  }
  updateFavoriteButton();
}

function startClock(tz, country) {
  clearInterval(clockTimer);
  const tick = () => {
    const now = Math.floor(Date.now() / 1000);
    const date = fmtDay(now, tz, { weekday: 'long', month: 'short', day: 'numeric' });
    el.localTime.textContent = [country, date, fmtTime(now, tz)].filter(Boolean).join(' · ');
  };
  tick();
  clockTimer = setInterval(tick, 15000);
}

function renderDaily(daily) {
  const tz = state.forecast.city.timezone;
  const lo = Math.min(...daily.map((d) => d.min));
  const hi = Math.max(...daily.map((d) => d.max));
  const span = Math.max(hi - lo, 1);
  const nowTemp = state.current.main.temp;

  el.dailyList.innerHTML = daily.map((d, i) => {
    const left = ((d.min - lo) / span) * 100;
    const width = Math.max(((d.max - d.min) / span) * 100, 4);
    const label = i === 0 ? 'Today' : fmtDay(d.dt, tz);
    const pop = d.pop >= 0.1 ? `${Math.round(d.pop * 10) * 10}%` : '';
    const now = i === 0 ? `<span class="range-now" style="left:${clamp(((nowTemp - lo) / span) * 100, 0, 100)}%"></span>` : '';
    return `
      <li class="daily-row">
        <span class="daily-day">${esc(label)}</span>
        ${iconImg(d.weather, 'daily-icon')}
        <span class="daily-pop">${pop ? `<span class="visually-hidden">Rain chance </span>${pop}` : ''}</span>
        <span class="daily-range">
          <span class="daily-lo"><span class="visually-hidden">Low </span>${units.deg(d.min)}</span>
          <span class="range-track" aria-hidden="true">
            <span class="range-fill" style="left:${left}%;width:${width}%;--scale-w:${(100 / width) * 100}%;--scale-x:${(left / (100 - width || 1)) * 100}%"></span>
            ${now}
          </span>
          <span class="daily-hi"><span class="visually-hidden">High </span>${units.deg(d.max)}</span>
        </span>
      </li>`;
  }).join('');
}

function renderHourly() {
  const { current, forecast } = state;
  const tz = forecast.city.timezone;
  const items = [
    { label: 'Now', temp: current.main.temp, weather: current.weather[0], pop: forecast.list[0] ? forecast.list[0].pop : 0, now: true },
    ...forecast.list.slice(0, 8).map((i) => ({ label: fmtHour(i.dt, tz), temp: i.main.temp, weather: i.weather[0], pop: i.pop }))
  ];
  el.hourlyList.innerHTML = items.map((h) => `
    <li class="hourly-item${h.now ? ' is-now' : ''}">
      <span class="hourly-time">${esc(h.label)}</span>
      ${iconImg(h.weather, 'hourly-icon')}
      <span class="hourly-temp">${units.deg(h.temp)}</span>
      <span class="hourly-pop">${h.pop >= 0.1 ? `${Math.round(h.pop * 100)}%` : ''}</span>
    </li>`).join('');
}

function renderHighlights() {
  const cur = state.current;

  // Wind
  el.windSpeed.textContent = units.wind(cur.wind.speed);
  el.windUnit.textContent = units.windUnit();
  el.windGust.textContent = isNum(cur.wind.gust) ? `${units.wind(cur.wind.gust)} ${units.windUnit()}` : 'not reported';
  if (isNum(cur.wind.deg)) {
    el.windDir.textContent = `From the ${cardinal(cur.wind.deg)} (${cur.wind.deg}°)`;
    el.windNeedle.style.transform = `rotate(${cur.wind.deg + 180}deg)`;
  } else {
    el.windDir.textContent = 'Direction not reported';
  }

  // Humidity & dew point
  el.humidity.textContent = cur.main.humidity;
  el.humidityBar.style.width = `${clamp(cur.main.humidity, 0, 100)}%`;
  const dp = dewPointC(cur.main.temp, cur.main.humidity);
  el.dewPoint.textContent = dp === null ? '--' : units.deg(dp);

  // Feels like
  el.feelsTile.textContent = units.deg(cur.main.feels_like);
  const diff = cur.main.feels_like - cur.main.temp;
  el.feelsNote.textContent = diff >= 2 ? 'Humidity makes it feel warmer.'
    : diff <= -2 ? 'Wind makes it feel cooler.'
    : 'Close to the actual temperature.';

  // Visibility
  el.visibility.textContent = units.distance(cur.visibility);
  el.visibilityUnit.textContent = units.distanceUnit();
  el.visibilityNote.textContent = !isNum(cur.visibility) ? 'Not reported'
    : cur.visibility >= 10000 ? 'Perfectly clear.'
    : cur.visibility >= 5000 ? 'Good visibility.'
    : cur.visibility >= 1000 ? 'Hazy conditions.'
    : 'Poor. Take care on the road.';

  // Pressure
  const p = cur.main.pressure;
  el.pressure.textContent = units.pressure(p);
  el.pressureUnit.textContent = units.pressureUnit();
  el.pressureNote.textContent = !isNum(p) ? '' : p < 1000 ? 'Low. Unsettled weather likely.'
    : p > 1022 ? 'High. Settled, calm weather.'
    : 'Normal range.';

  // Precipitation
  const next = state.forecast.list[0];
  const next24 = Math.max(0, ...state.forecast.list.slice(0, 8).map((i) => i.pop || 0));
  el.precipChance.textContent = next ? Math.round((next.pop || 0) * 100) : '--';
  const lastHour = cur.rain && (cur.rain['1h'] || cur.rain['3h']);
  const snow = cur.snow && (cur.snow['1h'] || cur.snow['3h']);
  el.precipNote.textContent = lastHour ? `${units.rain(lastHour)} of rain in the last hour.`
    : snow ? `${units.rain(snow)} of snow in the last hour.`
    : next24 < 0.1 ? 'Chance in the next 3 hours. Dry for the next 24 hours.'
    : `Chance in the next 3 hours. Up to ${Math.round(next24 * 100)}% within 24 hours.`;
}

function renderSun() {
  const { sunrise, sunset } = state.current.sys;
  const tz = state.current.timezone;
  if (!sunrise || !sunset) {
    el.sunrise.textContent = el.sunset.textContent = '--';
    el.daylight.textContent = 'Polar day/night';
    return;
  }
  el.sunrise.textContent = fmtTime(sunrise, tz);
  el.sunset.textContent = fmtTime(sunset, tz);
  const secs = sunset - sunrise;
  el.daylight.textContent = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;

  const now = Date.now() / 1000;
  const isDay = now >= sunrise && now <= sunset;
  const progress = clamp((now - sunrise) / secs, 0, 1);
  const length = el.sunProgress.getTotalLength();
  const point = el.sunProgress.getPointAtLength(length * progress);
  el.sunMarker.setAttribute('cx', point.x.toFixed(1));
  el.sunMarker.setAttribute('cy', point.y.toFixed(1));
  el.sunMarker.classList.toggle('is-night', !isDay);
  el.sunProgress.setAttribute('stroke-dasharray', `${(isDay ? progress : 0) * 100} 100`);
  el.sunProgress.style.opacity = isDay ? 1 : 0;
}

const UV_LEVELS = [
  { max: 2, label: 'Low', advice: 'No protection needed.' },
  { max: 5, label: 'Moderate', advice: 'Wear sunscreen if outside for long.' },
  { max: 7, label: 'High', advice: 'Sunscreen, hat and sunglasses.' },
  { max: 10, label: 'Very high', advice: 'Seek shade around midday.' },
  { max: Infinity, label: 'Extreme', advice: 'Avoid the sun around midday.' }
];

function renderUv() {
  const uv = state.uvi;
  if (!isNum(uv)) {
    el.uvIndex.textContent = '--';
    el.uvCategory.textContent = '';
    el.uvAdvice.textContent = state.current ? 'UV data unavailable.' : '';
    el.uvMarker.hidden = true;
    return;
  }
  const level = UV_LEVELS.find((l) => uv <= l.max + 0.49);
  el.uvIndex.textContent = Math.round(uv);
  el.uvCategory.textContent = level.label;
  el.uvAdvice.textContent = `Today's peak. ${level.advice}`;
  el.uvMarker.hidden = false;
  el.uvMarker.style.left = `${clamp(uv / 11, 0, 1) * 100}%`;
}

// US EPA AQI from PM2.5 (2024 breakpoints)
const PM25_BREAKPOINTS = [
  [0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]
];
const AQI_LEVELS = [
  { max: 50, label: 'Good' },
  { max: 100, label: 'Moderate' },
  { max: 150, label: 'Unhealthy for sensitive groups' },
  { max: 200, label: 'Unhealthy' },
  { max: 300, label: 'Very unhealthy' },
  { max: Infinity, label: 'Hazardous' }
];

function usAqi(pm25) {
  if (!isNum(pm25)) return null;
  const c = Math.floor(pm25 * 10) / 10;
  for (const [cLo, cHi, iLo, iHi] of PM25_BREAKPOINTS) {
    if (c <= cHi) return Math.round(((iHi - iLo) / (cHi - cLo)) * (Math.max(c, cLo) - cLo) + iLo);
  }
  return 500;
}

function renderAir() {
  const entry = state.air && state.air.list && state.air.list[0];
  if (!entry) {
    el.aqiValue.textContent = '--';
    el.aqiCategory.textContent = '';
    el.aqiMarker.hidden = true;
    el.aqiPollutants.innerHTML = state.current ? '<div><dt>Status</dt><dd>Unavailable</dd></div>' : '';
    return;
  }
  const c = entry.components;
  const aqi = usAqi(c.pm2_5);
  el.aqiValue.textContent = aqi ?? '--';
  el.aqiCategory.textContent = aqi === null ? '' : AQI_LEVELS.find((l) => aqi <= l.max).label;
  el.aqiMarker.hidden = aqi === null;
  if (aqi !== null) el.aqiMarker.style.left = `${clamp(aqi / 300, 0, 1) * 100}%`;
  const items = [['PM2.5', c.pm2_5], ['PM10', c.pm10], ['O₃', c.o3], ['NO₂', c.no2]];
  el.aqiPollutants.innerHTML = items.map(([label, v]) => `
    <div><dt>${label}</dt><dd>${isNum(v) ? Math.round(v) : '--'} <small>µg/m³</small></dd></div>`).join('');
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(124, 196, 255, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderChart() {
  if (typeof Chart === 'undefined' || !state.forecast) return;
  const tz = state.forecast.city.timezone;
  const list = state.forecast.list;
  const labels = list.map((i) => `${fmtDay(i.dt, tz)} ${fmtHour(i.dt, tz)}`);
  const temps = list.map((i) => units.temp(i.main.temp));
  const pops = list.map((i) => Math.round((i.pop || 0) * 100));
  // Label each day once, on its midday reading (every day has exactly one 3-hour slot between 11:00 and 13:59)
  const isMidday = list.map((i) => { const h = cityDate(i.dt, tz).getUTCHours(); return h >= 11 && h <= 13; });

  const line = cssVar('--chart-line');
  const text = cssVar('--chart-text');
  const grid = cssVar('--chart-grid');
  const ctx = el.chartCanvas.getContext('2d');
  const fill = ctx.createLinearGradient(0, 0, 0, 240);
  fill.addColorStop(0, hexToRgba(line, 0.28));
  fill.addColorStop(1, hexToRgba(line, 0));

  if (tempChart) tempChart.destroy();
  tempChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Temperature',
          data: temps,
          yAxisID: 'y',
          borderColor: line,
          backgroundColor: fill,
          fill: true,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: line,
          order: 1
        },
        {
          type: 'bar',
          label: 'Rain chance',
          data: pops,
          yAxisID: 'y1',
          backgroundColor: cssVar('--chart-bar'),
          borderRadius: 3,
          barPercentage: 0.9,
          categoryPercentage: 1,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, .94)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,.12)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: (c) => (c.dataset.yAxisID === 'y' ? `Temperature ${c.parsed.y}°` : `Rain chance ${c.parsed.y}%`)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: text,
            font: { family: 'Inter', size: 12, weight: '500' },
            autoSkip: false,
            maxRotation: 0,
            callback: (v, idx) => (isMidday[idx] ? fmtDay(list[idx].dt, tz) : '')
          }
        },
        y: {
          grid: { color: grid },
          border: { display: false },
          grace: '10%',
          ticks: { color: text, font: { family: 'Inter', size: 12 }, maxTicksLimit: 5, callback: (v) => `${v}°` }
        },
        y1: {
          position: 'right',
          min: 0,
          max: 100,
          display: false,
          grid: { display: false }
        }
      }
    }
  });
}

/* ---------- Radar map ---------- */
const BASEMAP_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; OpenWeatherMap';
const OWM_LAYERS = { precipitation: 'precipitation_new', clouds: 'clouds_new', temp: 'temp_new', wind: 'wind_new' };
let radarVisible = false;

function renderRadar() {
  if (!state.current || typeof L === 'undefined' || !radarVisible) return;
  const { lat, lon } = state.current.coord;

  if (!radarMap) {
    radarMap = L.map(el.radarMap, { zoomControl: true, scrollWheelZoom: false, attributionControl: true })
      .setView([lat, lon], 7);
    setBasemap();
  } else {
    radarMap.setView([lat, lon], radarMap.getZoom() || 7);
  }

  const name = (state.place && state.place.name) || state.current.name;
  if (!radarMarker) {
    radarMarker = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#3b9eff', fillOpacity: 1 }).addTo(radarMap);
  } else {
    radarMarker.setLatLng([lat, lon]);
  }
  radarMarker.bindTooltip(esc(name));
  setRadarLayer(radarLayer);
  setTimeout(() => radarMap && radarMap.invalidateSize(), 200);
}

// The base map is darkened with a CSS filter in dark mode (see .map-base in style.css)
function setBasemap() {
  if (!radarMap || radarBase) return;
  radarBase = L.tileLayer(BASEMAP_URL, { maxZoom: 18, attribution: MAP_ATTRIBUTION, className: 'map-base' }).addTo(radarMap);
}

function setRadarLayer(layer) {
  radarLayer = OWM_LAYERS[layer] ? layer : 'precipitation';
  document.querySelectorAll('[data-layer]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === radarLayer)));
  if (!radarMap) return;
  if (radarOverlay) radarMap.removeLayer(radarOverlay);
  const owm = OWM_LAYERS[radarLayer];
  const url = isProxyAvailable
    ? `/api/weather?endpoint=tile&layer=${owm}&z={z}&x={x}&y={y}`
    : `https://tile.openweathermap.org/map/${owm}/{z}/{x}/{y}.png?appid=${API_KEY}`;
  radarOverlay = L.tileLayer(url, { opacity: 0.75, maxZoom: 18 }).addTo(radarMap);
}

/* ---------- Comparison ---------- */
function renderCompare() {
  const a = state.current;
  const b = state.compare;
  if (!a || !b) {
    el.compareResult.hidden = true;
    return;
  }
  const card = (d, other) => {
    const diff = Math.round(units.temp(d.main.temp) - units.temp(other.main.temp));
    const diffHtml = other !== d && diff !== 0
      ? `<span class="compare-diff ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${Math.abs(diff)}°</span>` : '';
    const name = d === a && state.place && state.place.name ? state.place.name : d.name;
    return `
      <article class="compare-card">
        <h3 class="compare-city">${esc(name)} ${flagImg(d.sys.country)}</h3>
        <div class="compare-top">
          ${iconImg(d.weather[0], '')}
          <div>
            <div class="compare-temp">${units.deg(d.main.temp)}${diffHtml}</div>
            <div class="compare-desc">${esc(d.weather[0].description)}</div>
          </div>
        </div>
        <dl class="compare-rows">
          <div><dt>Feels like</dt><dd>${units.deg(d.main.feels_like)}</dd></div>
          <div><dt>Humidity</dt><dd>${d.main.humidity}%</dd></div>
          <div><dt>Wind</dt><dd>${units.wind(d.wind.speed)} ${units.windUnit()}</dd></div>
          <div><dt>Pressure</dt><dd>${units.pressure(d.main.pressure)} ${units.pressureUnit()}</dd></div>
          <div><dt>Local time</dt><dd>${esc(fmtTime(Math.floor(Date.now() / 1000), d.timezone))}</dd></div>
        </dl>
      </article>`;
  };
  el.compareResult.innerHTML = card(a, a) + card(b, a);
  el.compareResult.hidden = false;
}

async function runCompare(query) {
  el.compareBtn.disabled = true;
  el.compareBtn.textContent = 'Loading…';
  try {
    state.compare = await fetchWeatherApi('weather', { q: query, units: 'metric' });
    renderCompare();
  } catch (err) {
    toast(err.status === 404 ? `Couldn't find "${query}".` : describeError(err));
  } finally {
    el.compareBtn.disabled = false;
    el.compareBtn.textContent = 'Compare';
  }
}

/* ==========================================================================
   Favorites & history
   ========================================================================== */
// Older versions stored plain city-name strings; normalise them
function normalisePlaces(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => (typeof p === 'string' ? { name: p, query: p } : p))
    .filter((p) => p && p.name);
}
const getHistory = () => normalisePlaces(store.get('searchHistory', []));
const getFavorites = () => normalisePlaces(store.get('favoriteCities', []));
const samePlace = (a, b) => a.name.toLowerCase() === b.name.toLowerCase() && (a.country || '') === (b.country || '');

function addToHistory(place) {
  const list = getHistory().filter((p) => !samePlace(p, place));
  list.unshift(place);
  store.set('searchHistory', list.slice(0, MAX_HISTORY));
}

function currentPlaceRecord() {
  if (!state.current) return null;
  return {
    name: (state.place && state.place.name) || state.current.name,
    country: state.current.sys.country,
    lat: state.current.coord.lat,
    lon: state.current.coord.lon
  };
}

function toggleFavorite() {
  const place = currentPlaceRecord();
  if (!place) return;
  let favs = getFavorites();
  if (favs.some((p) => samePlace(p, place))) {
    favs = favs.filter((p) => !samePlace(p, place));
    toast(`Removed ${place.name} from favorites`);
  } else {
    if (favs.length >= MAX_FAVORITES) {
      toast(`You can save up to ${MAX_FAVORITES} favorites. Remove one first.`);
      return;
    }
    favs.push(place);
    toast(`Saved ${place.name} to favorites`);
  }
  store.set('favoriteCities', favs);
  updateFavoriteButton();
  renderPlaces();
}

function updateFavoriteButton() {
  const place = currentPlaceRecord();
  const isFav = !!place && getFavorites().some((p) => samePlace(p, place));
  el.favBtn.setAttribute('aria-pressed', String(isFav));
  el.favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Save to favorites');
  el.favBtn.title = isFav ? 'Remove from favorites' : 'Save to favorites';
}

function placeFromRecord(p) {
  return isNum(p.lat) && isNum(p.lon)
    ? { lat: p.lat, lon: p.lon, name: p.name, country: p.country }
    : { query: p.query || p.name };
}

function renderPlaces() {
  const favs = getFavorites();
  const current = currentPlaceRecord();
  const history = getHistory().filter((h) => !favs.some((f) => samePlace(f, h)));

  el.favChips.innerHTML = favs.map((p, i) => `
    <span class="chip chip-fav${current && samePlace(p, current) ? ' is-current' : ''}">
      <svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>
      <button type="button" class="chip-open" data-fav="${i}">${esc(p.name)}</button>
      <button type="button" class="chip-remove" data-unfav="${i}" aria-label="Remove ${esc(p.name)} from favorites">
        <svg class="icon" aria-hidden="true"><use href="#i-x"/></svg>
      </button>
    </span>`).join('');

  el.historyChips.innerHTML = history.map((p, i) => `
    <button type="button" class="chip${current && samePlace(p, current) ? ' is-current' : ''}" data-history="${i}" title="${esc([p.name, countryName(p.country)].filter(Boolean).join(', '))}">${esc(p.name)}</button>`).join('');

  el.historyGroup.hidden = history.length === 0;
  el.favChips.hidden = favs.length === 0;
  el.places.hidden = favs.length === 0 && history.length === 0;
  el.places.dataset.history = JSON.stringify(history);
}

el.places.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.fav !== undefined) loadPlace(placeFromRecord(getFavorites()[+t.dataset.fav]));
  else if (t.dataset.unfav !== undefined) {
    const favs = getFavorites();
    const [removed] = favs.splice(+t.dataset.unfav, 1);
    store.set('favoriteCities', favs);
    toast(`Removed ${removed.name} from favorites`);
    updateFavoriteButton();
    renderPlaces();
  } else if (t.dataset.history !== undefined) {
    const history = JSON.parse(el.places.dataset.history || '[]');
    loadPlace(placeFromRecord(history[+t.dataset.history]));
  }
});

el.clearHistory.addEventListener('click', () => {
  store.remove('searchHistory');
  renderPlaces();
});

/* ==========================================================================
   Search & autocomplete
   ========================================================================== */
const ac = { items: [], active: -1, seq: 0, timer: null };

function setAcOpen(open) {
  el.acList.hidden = !open;
  el.cityInput.setAttribute('aria-expanded', String(open));
  if (!open) {
    ac.active = -1;
    el.cityInput.removeAttribute('aria-activedescendant');
  }
}

function renderAc() {
  if (!ac.items.length) {
    el.acList.innerHTML = '<li class="ac-empty" role="option" aria-disabled="true">No matching places</li>';
    setAcOpen(true);
    return;
  }
  el.acList.innerHTML = ac.items.map((p, i) => {
    const region = [p.state, countryName(p.country)].filter(Boolean).join(', ');
    return `
      <li id="ac-${i}" role="option" aria-selected="${i === ac.active}" data-index="${i}">
        ${flagImg(p.country)}
        <span class="ac-name">${esc(p.name)}</span>
        <span class="ac-region">${esc(region)}</span>
      </li>`;
  }).join('');
  setAcOpen(true);
  if (ac.active >= 0) el.cityInput.setAttribute('aria-activedescendant', `ac-${ac.active}`);
}

function rankPlaces(items, q) {
  const query = q.toLowerCase();
  const score = (p) => {
    const name = (p.name || '').toLowerCase();
    if (name === query) return 3;
    if (name.startsWith(query)) return 2;
    if (name.includes(query)) return 1;
    return 0;
  };
  const seen = new Set();
  return items
    .filter((p) => {
      const key = `${p.name}|${p.state || ''}|${p.country}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
    .slice(0, 6);
}

function choosePlace(p) {
  setAcOpen(false);
  el.cityInput.value = '';
  el.cityInput.blur();
  loadPlace({ lat: p.lat, lon: p.lon, name: p.name, country: p.country });
}

el.cityInput.addEventListener('input', () => {
  const q = el.cityInput.value.trim();
  clearTimeout(ac.timer);
  if (q.length < 2) {
    ac.items = [];
    setAcOpen(false);
    return;
  }
  ac.timer = setTimeout(async () => {
    const seq = ++ac.seq;
    try {
      const results = await fetchWeatherApi('geo/1.0/direct', { q, limit: 8 }, { ttl: 60 * 60 * 1000 });
      if (seq !== ac.seq || el.cityInput.value.trim() !== q) return;
      ac.items = rankPlaces(Array.isArray(results) ? results : [], q);
      ac.active = -1;
      renderAc();
    } catch (e) {
      if (seq === ac.seq) setAcOpen(false);
    }
  }, 220);
});

el.cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.acList.hidden) setAcOpen(false);
    else el.cityInput.blur();
    return;
  }
  if (el.acList.hidden || !ac.items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = ac.items.length;
    ac.active = e.key === 'ArrowDown' ? (ac.active + 1) % n : (ac.active - 1 + n) % n;
    renderAc();
    const active = document.getElementById(`ac-${ac.active}`);
    if (active) active.scrollIntoView({ block: 'nearest' });
  }
});

el.acList.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input
el.acList.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-index]');
  if (li) choosePlace(ac.items[+li.dataset.index]);
});

el.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = el.cityInput.value.trim();
  if (!q) return;
  // Prefer the highlighted (or best) suggestion: coordinates are more precise than a name
  const visible = !el.acList.hidden && ac.items.length;
  if (visible) {
    choosePlace(ac.items[Math.max(ac.active, 0)]);
    return;
  }
  setAcOpen(false);
  el.cityInput.blur();
  loadPlace({ query: q });
});

document.addEventListener('click', (e) => {
  if (!el.searchForm.contains(e.target)) setAcOpen(false);
});

// "/" focuses search from anywhere
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  e.preventDefault();
  el.cityInput.focus();
});

/* ---------- Geolocation ---------- */
el.geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showError('Your browser does not support location access.');
    return;
  }
  el.geoBtn.disabled = true;
  startProgress();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      el.geoBtn.disabled = false;
      loadPlace({ lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) });
    },
    (err) => {
      el.geoBtn.disabled = false;
      stopProgress();
      showError(err.code === err.PERMISSION_DENIED
        ? 'Location access is blocked. Allow it in your browser settings or search for a city.'
        : "We couldn't determine your location. Try again or search for a city.");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
  );
});

/* ==========================================================================
   Units, theme, banners, toasts
   ========================================================================== */
function setUnits(next) {
  state.units = next;
  store.set('units', next);
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === next)));
  renderAll();
}
document.querySelectorAll('[data-units]').forEach((b) => b.addEventListener('click', () => setUnits(b.dataset.units)));
document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => setRadarLayer(b.dataset.layer)));

function applyThemeLabel() {
  const light = document.documentElement.dataset.theme === 'light';
  el.themeToggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#e8eef6' : '#0b1120');
}
el.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  applyThemeLabel();
  renderChart();
});

let retryAction = null;
function showError(message, retry = null) {
  el.errorText.textContent = message;
  retryAction = retry;
  el.errorRetry.hidden = !retry;
  el.errorBanner.hidden = false;
}
function hideError() {
  el.errorBanner.hidden = true;
  retryAction = null;
}
el.errorRetry.addEventListener('click', () => { if (retryAction) retryAction(); });
el.errorClose.addEventListener('click', hideError);

function toast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  el.toasts.appendChild(t);
  setTimeout(() => {
    t.classList.add('leaving');
    t.addEventListener('animationend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 400);
  }, 2800);
}

function updateOnline() {
  el.offlineBanner.hidden = navigator.onLine;
}
window.addEventListener('online', () => {
  updateOnline();
  if (state.place) loadPlace(state.place, { silent: true });
});
window.addEventListener('offline', updateOnline);

// Refresh stale data when the tab comes back into view
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.place && Date.now() - state.loadedAt > CACHE_TTL_MS) {
    loadPlace(state.place, { silent: true });
  }
});

/* ==========================================================================
   PDF report
   ========================================================================== */
el.pdfBtn.addEventListener('click', async () => {
  if (!state.current) return;
  if (typeof html2pdf === 'undefined') {
    toast('The PDF tool is still loading. Try again in a moment.');
    return;
  }
  const cur = state.current;
  const tz = cur.timezone;
  const name = (state.place && state.place.name) || cur.name;
  const daily = buildDaily();
  const now = Math.floor(Date.now() / 1000);
  const aqiEntry = state.air && state.air.list && state.air.list[0];
  const aqi = aqiEntry ? usAqi(aqiEntry.components.pm2_5) : null;

  const rows = [
    ['Feels like', units.deg(cur.main.feels_like)],
    ['Humidity', `${cur.main.humidity}%`],
    ['Wind', `${units.wind(cur.wind.speed)} ${units.windUnit()}${isNum(cur.wind.deg) ? ` from ${cardinal(cur.wind.deg)}` : ''}`],
    ['Pressure', `${units.pressure(cur.main.pressure)} ${units.pressureUnit()}`],
    ['Visibility', `${units.distance(cur.visibility)} ${units.distanceUnit()}`],
    ['UV index', isNum(state.uvi) ? Math.round(state.uvi) : 'Unavailable'],
    ['Air quality (US AQI)', aqi ?? 'Unavailable'],
    ['Sunrise / sunset', `${fmtTime(cur.sys.sunrise, tz)} / ${fmtTime(cur.sys.sunset, tz)}`]
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-10000px;top:0';
  wrap.innerHTML = `
    <div class="pdf-report">
      <header>
        <div>
          <h1>${esc(name)}, ${esc(countryName(cur.sys.country))}</h1>
          <div class="pdf-muted">${esc(fmtDay(now, tz, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))} · ${esc(fmtTime(now, tz))} local time</div>
        </div>
        <div class="pdf-muted">SkyPulse weather report</div>
      </header>
      <div class="pdf-now">
        <div>
          <div class="pdf-temp">${units.deg(cur.main.temp)}</div>
          <div style="text-transform:capitalize;font-weight:600">${esc(cur.weather[0].description)}</div>
        </div>
        <div class="pdf-muted" style="max-width:340px;text-align:right">${esc(buildSummary(daily[0]))}</div>
      </div>
      <h2>Current conditions</h2>
      <table><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      <h2>5-day forecast</h2>
      <table>
        <thead><tr><th>Day</th><th>Conditions</th><th>Low</th><th>High</th><th>Rain chance</th></tr></thead>
        <tbody>${daily.map((d, i) => `
          <tr>
            <td>${esc(i === 0 ? 'Today' : fmtDay(d.dt, tz, { weekday: 'long' }))}</td>
            <td style="text-transform:capitalize">${esc(d.weather ? d.weather.description : '')}</td>
            <td>${units.deg(d.min)}</td>
            <td>${units.deg(d.max)}</td>
            <td>${Math.round(d.pop * 100)}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <footer>Data: OpenWeatherMap. Generated ${esc(new Date().toLocaleString())}.</footer>
    </div>`;
  document.body.appendChild(wrap);
  el.pdfBtn.disabled = true;
  try {
    await html2pdf().set({
      margin: 8,
      filename: `SkyPulse_${name.replace(/[^\w-]+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(wrap.firstElementChild).save();
    toast('Report downloaded');
  } catch (e) {
    toast("Couldn't create the PDF. Please try again.");
  } finally {
    wrap.remove();
    el.pdfBtn.disabled = false;
  }
});

/* ==========================================================================
   Init
   ========================================================================== */
el.favBtn.addEventListener('click', toggleFavorite);

el.compareForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = el.compareInput.value.trim();
  if (!q) return;
  if (!state.current) {
    toast('Load a city first.');
    return;
  }
  runCompare(q);
});

// Only create the map once it scrolls near the viewport
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) {
      radarVisible = true;
      renderRadar();
      obs.disconnect();
    }
  }, { rootMargin: '200px' }).observe(el.radarMap);
} else {
  radarVisible = true;
}

// Keep the sun position fresh
setInterval(() => { if (state.current) renderSun(); }, 60000);

function registerServiceWorker() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !secure) return;
  navigator.serviceWorker.register('./service-worker.js').catch(() => { /* optional */ });
}

function init() {
  state.units = store.get('units') === 'imperial' ? 'imperial' : 'metric';
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === state.units)));
  applyThemeLabel();
  updateOnline();
  renderPlaces();
  const last = store.get('lastPlace');
  loadPlace(last && last.name ? placeFromRecord(last) : DEFAULT_PLACE);
  registerServiceWorker();
}

init();
