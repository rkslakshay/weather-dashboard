'use strict';

/* ==========================================================================
   Small utilities
   ========================================================================== */
// Safe localStorage wrapper (private mode and blocked storage throw)
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
};

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, f) => a + (b - a) * f;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const PX_PER_HOUR = 22;
const NOW_WINDOW = 20 * 60; // seconds from the start of the timeline that still count as "now"

const state = {
  units: 'metric',
  place: null,        // what the user asked for: { query } or { lat, lon, name, country }
  current: null,      // /weather response
  forecast: null,     // /forecast response
  points: [],         // current conditions + future forecast readings, in one shape
  daily: [],
  air: null,          // /air_pollution response
  airForecast: null,  // /air_pollution/forecast response
  uvi: null,
  compare: null,
  activity: 'walking',
  windows: [],
  selectedWindow: null,   // { start, end } highlighted on the timeline
  chartView: '5d',
  airStatus: 'loading',   // 'loading' | 'done' (data or failure)
  airForecastStatus: 'loading',
  uvStatus: 'loading',
  forecastFetchedAt: null,
  loadFailed: false,
  moment: 0,          // unix time shown across the page
  loadedAt: 0
};

let isProxyAvailable = location.protocol.startsWith('http');
let loadSeq = 0;
let clockTimer = null;

const $ = (id) => document.getElementById(id);
const el = {
  topbar: $('topbar'),
  hero: $('hero'),
  progress: $('progress'),
  searchForm: $('search-form'),
  cityInput: $('city-input'),
  acList: $('autocomplete-list'),
  geoBtn: $('geo-btn'),
  themeToggle: $('theme-toggle'),
  places: $('places'),
  favGroup: $('favorites-group'),
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
  momentChip: $('moment-chip'),
  momentLabel: $('moment-label'),
  backToNow: $('back-to-now'),
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
  tlScroller: $('tl-scroller'),
  tlTrack: $('tl-track'),
  tlCursorLabel: $('tl-cursor-label'),
  tlPrev: $('tl-prev'),
  tlNext: $('tl-next'),
  tlNow: $('tl-now'),
  highlightsWhen: $('highlights-when'),
  dailyList: $('daily-list'),
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
  radarMap: $('radar-map'),
  compareForm: $('compare-form'),
  compareInput: $('compare-input'),
  compareBtn: $('compare-btn'),
  compareResult: $('compare-result'),
  toasts: $('toasts')
};

/* ---------- Units ---------- */
const units = {
  temp: (c) => (isNum(c) ? Math.round(state.units === 'metric' ? c : c * 9 / 5 + 32) : '--'),
  deg: (c) => `${units.temp(c)}°`,
  wind: (ms) => (isNum(ms) ? Math.round(state.units === 'metric' ? ms * 3.6 : ms * 2.237) : '--'),
  windUnit: () => (state.units === 'metric' ? 'km/h' : 'mph'),
  // Returns [value, unit]; very short distances (dense fog) switch to metres or feet
  distanceParts: (m) => {
    const metric = state.units === 'metric';
    if (!isNum(m)) return ['--', metric ? 'km' : 'mi'];
    if (m >= 10000) return [metric ? '10+' : '6+', metric ? 'km' : 'mi'];
    if (metric && m < 1000) return [Math.round(m / 10) * 10, 'm'];
    if (!metric && m < 160) return [Math.round((m * 3.281) / 10) * 10, 'ft'];
    const v = metric ? m / 1000 : m / 1609.34;
    return [v < 10 ? v.toFixed(1) : Math.round(v), metric ? 'km' : 'mi'];
  },
  distance: (m) => units.distanceParts(m).join(' '),
  pressure: (hpa) => (isNum(hpa) ? (state.units === 'metric' ? Math.round(hpa) : (hpa * 0.02953).toFixed(2)) : '--'),
  pressureUnit: () => (state.units === 'metric' ? 'hPa' : 'inHg'),
  rain: (mm) => (state.units === 'metric' ? `${mm.toFixed(1)} mm` : `${(mm / 25.4).toFixed(2)} in`)
};

/* ---------- City-local time ---------- */
// OpenWeatherMap gives UTC timestamps plus the city's UTC offset in seconds.
// Shift the timestamp by the offset and format it as UTC to get city wall-clock time.
const tzOffset = () => (state.current ? state.current.timezone : 0);
const cityDate = (unix, tz = tzOffset()) => new Date((unix + (tz || 0)) * 1000);
const fmtTime = (unix, tz = tzOffset()) => cityDate(unix, tz).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const fmtHour = (unix, tz = tzOffset()) => cityDate(unix, tz).toLocaleTimeString(undefined, { hour: 'numeric', timeZone: 'UTC' });
const fmtDay = (unix, opts = { weekday: 'short' }, tz = tzOffset()) => cityDate(unix, tz).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
const dayKey = (unix, tz = tzOffset()) => cityDate(unix, tz).toISOString().slice(0, 10);
const localHour = (unix, tz = tzOffset()) => { const d = cityDate(unix, tz); return d.getUTCHours() + d.getUTCMinutes() / 60; };
const nowSec = () => Math.floor(Date.now() / 1000);

/* ---------- Weather icons ---------- */
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
const FOG_TYPES = ['Mist', 'Fog', 'Haze', 'Smoke', 'Dust', 'Sand', 'Ash'];

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

// When each response was actually fetched, so saved data can be labelled as saved
const fetchedAt = new WeakMap();

function cacheGet(key, ttl) {
  const entry = store.get(`weather_cache_${key}`);
  if (entry && entry.timestamp && entry.data && Date.now() - entry.timestamp < ttl) {
    fetchedAt.set(entry.data, entry.timestamp);
    return entry.data;
  }
  return null;
}
function cacheSet(key, data) {
  store.set(`weather_cache_${key}`, { timestamp: fetchedAt.get(data), data });
}

// A response replayed by the service worker keeps its original Date header
function responseTime(res) {
  const date = Date.parse(res.headers.get('date') || '');
  const age = Number(res.headers.get('age')) || 0;
  return isNum(date) ? Math.min(Date.now(), date - age * 1000) : Date.now();
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
  air_pollution_forecast: 'https://api.openweathermap.org/data/2.5/air_pollution/forecast',
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

  let res;
  try {
    res = await requestWeather(endpoint, query);
  } catch (err) {
    // Unreachable network: fall back to the last saved copy, however old; the UI labels its age
    if (cache && err.kind !== 'http') {
      const saved = cacheGet(cacheKey, Infinity);
      if (saved) return saved;
    }
    throw err;
  }
  const data = await res.json();
  fetchedAt.set(data, responseTime(res));
  if (cache) cacheSet(cacheKey, data);
  return data;
}

async function requestWeather(endpoint, query) {
  if (isProxyAvailable) {
    let res = null;
    try {
      res = await fetchWithTimeout(`/api/weather?endpoint=${encodeURIComponent(endpoint)}&${query}`);
    } catch (err) {
      if (!API_KEY) throw err;
    }
    if (res) {
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      if (res.ok && isJson) return res;
      if (isJson || !API_KEY) throw await readError(res);
      isProxyAvailable = false; // static host with no API route; use direct mode
    }
  }

  if (!API_KEY) throw new ApiError('No API key configured for direct requests', { status: 401 });
  const res = await fetchWithTimeout(`${DIRECT_URLS[endpoint]}?${query}&appid=${API_KEY}`);
  if (!res.ok) throw await readError(res);
  return res;
}

function describeError(err, place) {
  const label = place && (place.name || place.query);
  if (err.kind === 'timeout') return 'The weather service took too long to respond.';
  if (err.kind === 'network') return navigator.onLine ? "Can't reach the weather service right now." : "You're offline. Check your connection and try again.";
  if (err.status === 404) return label ? `We couldn't find "${label}". Check the spelling or pick a suggestion.` : "We couldn't find that place.";
  if (err.status === 401) return 'The weather service rejected the API key.';
  if (err.status === 429) return 'Too many requests. Wait a minute and try again.';
  if (err.status >= 500) return 'The weather service is having trouble. Try again shortly.';
  if (!(err instanceof ApiError)) {
    console.error(err); // A bug on our side: keep the detail for debugging, not for the banner
    return 'Something went wrong while loading the weather.';
  }
  return err.message || 'Something went wrong while loading the weather.';
}

/* ==========================================================================
   Loading a place
   ========================================================================== */
const placeParams = (place) => (isNum(place.lat) && isNum(place.lon) ? { lat: place.lat, lon: place.lon } : { q: place.query });

async function loadPlace(place, { silent = false } = {}) {
  const seq = ++loadSeq;
  const firstLoad = !state.current;
  hideError();
  if (!silent) startProgress();
  if (!firstLoad && !silent) document.querySelector('.page').classList.add('is-refreshing');

  try {
    const params = { ...placeParams(place), units: 'metric' };
    const [current, forecast] = await Promise.all([
      fetchWeatherApi('weather', params),
      fetchWeatherApi('forecast', params)
    ]);
    if (seq !== loadSeq) return; // a newer search started meanwhile

    const sameRequest = state.place === place;
    Object.assign(state, {
      place, current, forecast, air: null, airForecast: null, uvi: null, loadedAt: Date.now(),
      airStatus: 'loading', airForecastStatus: 'loading', uvStatus: 'loading', loadFailed: false,
      forecastFetchedAt: fetchedAt.get(forecast) ?? Date.now(),
      selectedWindow: sameRequest ? state.selectedWindow : null
    });
    state.points = buildPoints();
    state.daily = buildDaily();

    const remembered = {
      name: place.name || current.name,
      country: place.country || current.sys.country,
      lat: current.coord.lat,
      lon: current.coord.lon
    };
    store.set('lastPlace', remembered);
    addToHistory(remembered);

    el.hero.classList.remove('is-loading');
    if (!silent) el.cityInput.value = '';
    renderAll({ resetMoment: !silent });

    // Secondary data loads in the background and fills its tiles when ready
    const { lat, lon } = current.coord;
    const ttl = { ttl: 15 * 60 * 1000 };
    fetchWeatherApi('air_pollution', { lat, lon }, ttl)
      .then((d) => { if (seq === loadSeq) state.air = d; })
      .catch(() => {})
      .finally(() => { if (seq === loadSeq) { state.airStatus = 'done'; renderMoment(); renderBriefing(); renderWindows(); } });
    fetchWeatherApi('air_pollution_forecast', { lat, lon }, ttl)
      .then((d) => { if (seq === loadSeq) state.airForecast = d; })
      .catch(() => {})
      .finally(() => { if (seq === loadSeq) { state.airForecastStatus = 'done'; renderMoment(); renderWindows(); } });
    fetchWeatherApi('uvi', { lat, lon }, ttl)
      .then((d) => { if (seq === loadSeq) state.uvi = isNum(d && d.value) ? d.value : null; })
      .catch(() => {})
      .finally(() => { if (seq === loadSeq) { state.uvStatus = 'done'; renderMoment(); renderBriefing(); } });
  } catch (err) {
    if (seq !== loadSeq) return;
    const retryable = err.kind !== 'http' || err.status === 429 || err.status >= 500;
    showError(describeError(err, place), retryable ? () => loadPlace(place) : null);
    if (firstLoad) {
      state.loadFailed = true;
      renderInsightsUnavailable();
    }
  } finally {
    if (seq === loadSeq) {
      stopProgress();
      document.querySelector('.page').classList.remove('is-refreshing');
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
// Current conditions and forecast readings normalised into one shape
function toPoint(r, extra = {}) {
  return {
    dt: r.dt,
    temp: r.main.temp,
    feels: r.main.feels_like,
    humidity: r.main.humidity,
    pressure: r.main.pressure,
    wind: r.wind ? r.wind.speed : null,
    gust: r.wind && isNum(r.wind.gust) ? r.wind.gust : null,
    deg: r.wind && isNum(r.wind.deg) ? r.wind.deg : null,
    vis: isNum(r.visibility) ? r.visibility : null,
    clouds: r.clouds ? r.clouds.all : 0,
    pop: isNum(r.pop) ? r.pop : 0,
    rain: (r.rain && (r.rain['3h'] || r.rain['1h'])) || 0,
    snow: (r.snow && (r.snow['3h'] || r.snow['1h'])) || 0,
    weather: r.weather[0],
    ...extra
  };
}

function buildPoints() {
  const { current, forecast } = state;
  const first = forecast.list[0];
  const now = toPoint(current, {
    pop: first ? first.pop || 0 : 0,
    rain: (current.rain && (current.rain['1h'] || current.rain['3h'])) || 0,
    snow: (current.snow && (current.snow['1h'] || current.snow['3h'])) || 0,
    isCurrent: true
  });
  return [now, ...forecast.list.filter((r) => r.dt > current.dt + 30 * 60).map((r) => toPoint(r))];
}

// Group readings into city-local days
function buildDaily() {
  const days = new Map();
  for (const p of state.points) {
    const key = dayKey(p.dt);
    let day = days.get(key);
    if (!day) {
      day = { key, dt: p.dt, min: Infinity, max: -Infinity, pop: 0, weather: null, score: Infinity };
      days.set(key, day);
    }
    day.min = Math.min(day.min, p.temp);
    day.max = Math.max(day.max, p.temp);
    day.pop = Math.max(day.pop, p.pop || 0);
    // Represent each day by the reading closest to early afternoon
    const score = Math.abs(localHour(p.dt) - 14);
    if (score < day.score) {
      day.score = score;
      day.weather = p.weather;
    }
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 5);
}

// Catmull-Rom control values, shared by the drawn curve and the hero temperature
function splineControls(values, i) {
  const v0 = values[Math.max(i - 1, 0)];
  const v1 = values[i];
  const v2 = values[i + 1];
  const v3 = values[Math.min(i + 2, values.length - 1)];
  return [v1, v1 + (v2 - v0) / 6, v2 - (v3 - v1) / 6, v2];
}
function bezier([a, b, c, d], f) {
  const g = 1 - f;
  return g * g * g * a + 3 * g * g * f * b + 3 * g * f * f * c + f * f * f * d;
}

function lerpAngle(a, b, f) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * f + 360) % 360;
}

// Conditions at any moment, interpolated between neighbouring readings
function pointAt(t) {
  const pts = state.points;
  if (t <= pts[0].dt + NOW_WINDOW || pts.length < 2) return pts[0];
  const last = pts[pts.length - 1];
  if (t >= last.dt) return last;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].dt < t) i++;
  const a = pts[i];
  const b = pts[i + 1];
  const f = (t - a.dt) / (b.dt - a.dt);
  const mix = (k) => (isNum(a[k]) && isNum(b[k]) ? lerp(a[k], b[k], f) : (f < 0.5 ? a[k] : b[k]));
  return {
    dt: t,
    temp: bezier(splineControls(pts.map((p) => p.temp), i), f),
    feels: mix('feels'),
    humidity: mix('humidity'),
    pressure: mix('pressure'),
    wind: mix('wind'),
    gust: mix('gust'),
    deg: isNum(a.deg) && isNum(b.deg) ? lerpAngle(a.deg, b.deg, f) : a.deg,
    vis: mix('vis'),
    clouds: mix('clouds'),
    pop: mix('pop'),
    rain: f < 0.5 ? a.rain : b.rain,
    snow: f < 0.5 ? a.snow : b.snow,
    weather: f < 0.5 ? a.weather : b.weather
  };
}

function dewPointC(tempC, rh) {
  if (!isNum(tempC) || !isNum(rh) || rh <= 0) return null;
  const a = 17.62, b = 243.12;
  const g = Math.log(rh / 100) + (a * tempC) / (b + tempC);
  return (b * g) / (a - g);
}

function cardinal(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

function buildAdvisory(p) {
  const main = p.weather.main;
  const wind = Math.max(p.wind || 0, p.gust || 0);
  if (['Thunderstorm', 'Tornado', 'Squall'].includes(main)) {
    return { title: `${main === 'Thunderstorm' ? 'Thunderstorms' : main} expected`, text: 'Lightning and sudden gusts are possible. Stay indoors and away from open ground.' };
  }
  if (p.feels >= 40 || p.temp >= 38) {
    return { title: 'Extreme heat', text: `It feels like ${units.deg(p.feels)}. Drink water, avoid the midday sun and check on vulnerable people.` };
  }
  if (p.temp <= 0) return { title: 'Freezing temperatures', text: 'Watch for ice on roads and paths, and dress in warm layers.' };
  if (wind >= 14) return { title: 'Strong wind', text: `Gusts up to ${units.wind(wind)} ${units.windUnit()}. Secure loose objects and take care on bikes.` };
  if (isNum(p.vis) && p.vis <= 1000) return { title: 'Low visibility', text: `Visibility is ${units.distance(p.vis)}. Drive slowly with low-beam lights.` };
  return null;
}

function dayFor(t) {
  const key = dayKey(t);
  return state.daily.find((d) => d.key === key) || null;
}

function partOfDay(t) {
  const h = localHour(t);
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function buildSummary(t, p, isNow) {
  const desc = capitalize(p.weather.description);
  const day = dayFor(t);
  if (isNow) {
    const parts = [`${desc} right now.`];
    if (day) parts.push(`High ${units.deg(day.max)}, low ${units.deg(day.min)}.`);
    const next = state.points.slice(0, 9);
    const peak = Math.max(0, ...next.map((x) => x.pop || 0));
    const hasSnow = next.some((x) => x.weather.main === 'Snow');
    const hasRain = next.some((x) => ['Rain', 'Drizzle', 'Thunderstorm'].includes(x.weather.main));
    const kind = hasSnow && hasRain ? 'rain and snow' : hasSnow ? 'snow' : 'rain';
    const verb = hasSnow && hasRain ? 'are' : 'is';
    if (peak >= 0.6) parts.push(`${capitalize(kind)} ${verb} likely in the next 24 hours (${Math.round(peak * 100)}%).`);
    else if (peak >= 0.25) parts.push(`Some chance of ${kind} in the next 24 hours (${Math.round(peak * 100)}%).`);
    else parts.push(`No ${kind} expected in the next 24 hours.`);
    return parts.join(' ');
  }
  const when = `${fmtDay(t, { weekday: 'long' })} ${partOfDay(t)}`;
  const rain = p.pop >= 0.1 ? `${Math.round(p.pop * 100)}% chance of rain` : 'dry';
  const wind = isNum(p.wind) ? `, wind ${units.wind(p.wind)} ${units.windUnit()}${isNum(p.deg) ? ` from the ${cardinal(p.deg)}` : ''}` : '';
  return `${when}: ${p.weather.description}, ${units.deg(p.temp)}, ${rain}${wind}.`;
}

/* ==========================================================================
   Sky scene
   ========================================================================== */
const SKY_STOPS = [
  { e: -1,    c: ['#070b1d', '#0f1733', '#1c2547'] },
  { e: -0.3,  c: ['#0c1430', '#1a2550', '#2e3a6b'] },
  { e: -0.08, c: ['#1b2350', '#4a4880', '#a96a7f'] },
  { e: 0,     c: ['#2a3b78', '#b06a8c', '#f2a06b'] },
  { e: 0.12,  c: ['#2f63b0', '#7aa6d9', '#f3c99c'] },
  { e: 0.4,   c: ['#2264c4', '#4f92dc', '#a9d4f5'] },
  { e: 1,     c: ['#1b5bbd', '#4a95e6', '#9fd0f7'] }
];
const GRAY_DAY = ['#56657a', '#7b889a', '#a2acb9'];
const GRAY_NIGHT = ['#10151f', '#1a202b', '#262d39'];
const GRAY_STORM = ['#24273a', '#363a4d', '#4b5064'];

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mixHex = (a, b, f) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => lerp(v, y[i], f))); };
const mixSet = (a, b, f) => a.map((c, i) => mixHex(c, b[i], f));

// Sun elevation proxy in [-1, 1] plus progress through the current day or night
function sunState(t, weather) {
  const { sunrise, sunset } = state.current.sys;
  // Polar day or night: the API reports no sunrise, so use its day/night icon flag
  if (!sunrise || !sunset) {
    const night = weather && weather.icon && weather.icon.endsWith('n');
    return night ? { e: -0.7, p: 0.5, day: false } : { e: 0.5, p: 0.5, day: true };
  }
  const k = Math.round((t - (sunrise + sunset) / 2) / 86400);
  const sr = sunrise + k * 86400;
  const ss = sunset + k * 86400;
  if (t >= sr && t <= ss) {
    const p = (t - sr) / (ss - sr);
    return { e: Math.sin(Math.PI * p), p, day: true };
  }
  const start = t > ss ? ss : ss - 86400;
  const end = t > ss ? sr + 86400 : sr;
  const p = (t - start) / (end - start);
  return { e: -Math.sin(Math.PI * p), p, day: false };
}

function skyColors(e) {
  let i = 0;
  while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1].e < e) i++;
  const a = SKY_STOPS[i];
  const b = SKY_STOPS[i + 1];
  return mixSet(a.c, b.c, clamp((e - a.e) / (b.e - a.e), 0, 1));
}

function renderSky(t, p) {
  const { e, p: progress, day } = sunState(t, p.weather);
  const main = p.weather.main;
  const storm = main === 'Thunderstorm';
  const wet = ['Rain', 'Drizzle', 'Thunderstorm'].includes(main);
  const snowy = main === 'Snow';
  const foggy = FOG_TYPES.includes(main) || (isNum(p.vis) && p.vis < 3000);
  const cloud = clamp((p.clouds || 0) / 100, 0, 1);
  const gray = clamp(cloud * 0.72 + (wet || snowy ? 0.2 : 0) + (storm ? 0.15 : 0), 0, 0.92);

  let target = mixSet(GRAY_NIGHT, GRAY_DAY, clamp((e + 0.15) / 0.45, 0, 1));
  if (storm) target = mixSet(target, GRAY_STORM, 0.6);
  const [top, mid, bottom] = mixSet(skyColors(e), target, gray);

  const tone = storm ? [96, 100, 118] : hexRgb(mixHex('#3a4558', '#f2f5fa', clamp((e + 0.1) / 0.4, 0, 1)));
  const rainAmount = wet ? 0.35 + Math.min((p.rain || 0) / 4, 1) * 0.45 : 0;
  const snowAmount = snowy ? 0.5 + Math.min((p.snow || 0) / 3, 1) * 0.4 : 0;

  const vars = {
    '--sky-top': top,
    '--sky-mid': mid,
    '--sky-bottom': bottom,
    '--glow': `rgba(255, 170, 90, ${(Math.max(0, 1 - Math.abs(e) / 0.2) * 0.55 * (1 - gray)).toFixed(3)})`,
    '--sun-x': `${(8 + 84 * progress).toFixed(2)}%`,
    '--sun-y': `${(day ? 86 - 66 * e : 86 + 56 * e).toFixed(2)}%`,
    '--sun-o': day ? (clamp(e * 5, 0, 1) * clamp(1 - gray * 1.15, 0, 1)).toFixed(3) : 0,
    '--moon-o': day ? 0 : (clamp(-e * 5, 0, 1) * clamp(1 - gray * 1.15, 0, 1)).toFixed(3),
    '--stars-o': (clamp(-e * 3 - 0.3, 0, 1) * (1 - gray)).toFixed(3),
    '--clouds-o': clamp(cloud * 1.1, 0, 0.95).toFixed(3),
    '--cloud-tone': tone.join(', '),
    '--rain-o': rainAmount.toFixed(3),
    '--snow-o': snowAmount.toFixed(3),
    '--fog-o': foggy ? 0.5 : 0
  };
  for (const [k, v] of Object.entries(vars)) el.hero.style.setProperty(k, v);
  el.hero.classList.toggle('is-raining', rainAmount > 0);
  el.hero.classList.toggle('is-snowing', snowAmount > 0);
  el.hero.classList.toggle('is-storm', storm);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', top);
}

/* ==========================================================================
   Timeline
   ========================================================================== */
// The curve ends above y=128, where the tallest rain-chance label starts, so they can't collide
const TL = { height: 192, iconY: 28, curveTop: 82, curveBottom: 120, barBase: 162, barMax: 20 };
let tlGeom = null;   // { t0, t1, width, x(t), y(temp) }
let tlFrame = 0;

// Temperature colour scale shared by the curve stroke, its fill and the cursor dot
const TEMP_COLORS = [[-10, '#818cf8'], [0, '#60a5fa'], [12, '#34d399'], [22, '#fbbf24'], [30, '#fb923c'], [38, '#ef4444']];
function tempColor(c) {
  if (c <= TEMP_COLORS[0][0]) return TEMP_COLORS[0][1];
  for (let i = 0; i < TEMP_COLORS.length - 1; i++) {
    const [t1, c1] = TEMP_COLORS[i];
    const [t2, c2] = TEMP_COLORS[i + 1];
    if (c <= t2) return mixHex(c1, c2, (c - t1) / (t2 - t1));
  }
  return TEMP_COLORS[TEMP_COLORS.length - 1][1];
}

function renderTimeline() {
  const pts = state.points;
  const t0 = pts[0].dt;
  const t1 = pts[pts.length - 1].dt;
  const width = Math.round(((t1 - t0) / 3600) * PX_PER_HOUR);
  const temps = pts.map((p) => p.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const x = (t) => ((t - t0) / 3600) * PX_PER_HOUR;
  const y = (temp) => TL.curveBottom - ((temp - lo) / Math.max(hi - lo, 1)) * (TL.curveBottom - TL.curveTop);
  tlGeom = { t0, t1, width, x, y };

  const stops = [0, 0.5, 1].map((f) => `<stop offset="${f}" stop-color="${tempColor(hi - (hi - lo) * f)}"/>`).join('');
  const parts = [`
    <defs>
      <linearGradient id="tl-stroke" gradientUnits="userSpaceOnUse" x1="0" y1="${TL.curveTop}" x2="0" y2="${TL.curveBottom}">${stops}</linearGradient>
      <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${tempColor(hi)}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${tempColor(lo)}" stop-opacity="0"/>
      </linearGradient>
    </defs>`];

  parts.push(`<rect id="tl-window" class="tl-window" y="24" height="${TL.barBase - 24}" rx="8" display="none"/>`);

  // Night shading from (approximate) sunset to sunrise
  const { sunrise, sunset } = state.current.sys;
  if (sunrise && sunset) {
    for (let k = -1; k <= 6; k++) {
      const a = clamp(x(sunset + k * 86400), 0, width);
      const b = clamp(x(sunrise + (k + 1) * 86400), 0, width);
      if (b > a) parts.push(`<rect class="tl-night" x="${a.toFixed(1)}" y="24" width="${(b - a).toFixed(1)}" height="${TL.barBase - 24}" rx="8"/>`);
    }
  }

  // Day labels at local midnight; "Today" only when there's room before the first one
  const firstMidnight = t0 - ((t0 + tzOffset()) % 86400) + 86400;
  if (x(firstMidnight) > 70) parts.push('<text class="tl-day" x="0" y="14">Today</text>');
  for (let m = firstMidnight; m < t1; m += 86400) {
    const mx = x(m).toFixed(1);
    parts.push(`<line class="tl-daysep" x1="${mx}" y1="0" x2="${mx}" y2="${TL.barBase}"/>`);
    parts.push(`<text class="tl-day" x="${(+mx + 8).toFixed(1)}" y="14">${esc(fmtDay(m))}<tspan class="tl-date" dx="5">${esc(fmtDay(m, { day: 'numeric' }))}</tspan></text>`);
  }

  // Curve and soft fill
  const xs = pts.map((p) => x(p.dt));
  const ys = pts.map((p) => y(p.temp));
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = splineControls(xs, i);
    const cy = splineControls(ys, i);
    d += ` C${cx[1].toFixed(1)},${cy[1].toFixed(1)} ${cx[2].toFixed(1)},${cy[2].toFixed(1)} ${cx[3].toFixed(1)},${cy[3].toFixed(1)}`;
  }
  parts.push(`<path class="tl-area" d="${d} L${width},${TL.barBase} L0,${TL.barBase}Z"/>`);
  parts.push(`<path class="tl-curve" d="${d}"/>`);
  parts.push(`<line class="tl-baseline" x1="0" y1="${TL.barBase}" x2="${width}" y2="${TL.barBase}"/>`);

  // Per-reading details; skip labels that would collide with the previous one
  let lastLabelX = -Infinity;
  pts.forEach((p, i) => {
    const px = xs[i];
    const h = Math.round((p.pop || 0) * TL.barMax);
    if (h > 1) parts.push(`<rect class="tl-bar" x="${(px - 7).toFixed(1)}" y="${TL.barBase - h}" width="14" height="${h}" rx="3"/>`);
    if (px - lastLabelX < 46) return;
    lastLabelX = px;
    parts.push(`<image href="${iconUrl(p.weather)}" x="${(px - 13).toFixed(1)}" y="${TL.iconY}" width="26" height="26"/>`);
    parts.push(`<text class="tl-temp" x="${px.toFixed(1)}" y="${(ys[i] - 11).toFixed(1)}">${units.deg(p.temp)}</text>`);
    parts.push(`<circle class="tl-reading" cx="${px.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="2.5"/>`);
    if (p.pop >= 0.2) parts.push(`<text class="tl-pop" x="${px.toFixed(1)}" y="${TL.barBase - h - 4}">${Math.round(p.pop * 100)}%</text>`);
    parts.push(`<text class="tl-hour" x="${px.toFixed(1)}" y="${TL.height - 8}">${i === 0 ? 'Now' : esc(fmtHour(p.dt))}</text>`);
  });
  parts.push('<g id="tl-dot"><circle class="tl-halo" r="12"/><circle class="tl-dot" r="5.5"/></g>');

  el.tlTrack.innerHTML = `
    <div class="tl-spacer"></div>
    <svg width="${width}" height="${TL.height}" viewBox="0 0 ${width} ${TL.height}" aria-hidden="true">${parts.join('')}</svg>
    <div class="tl-spacer"></div>`;
  el.tlScroller.setAttribute('aria-valuemax', String(Math.round((t1 - t0) / 3600)));
  sizeTimeline();
  updateTimelineWindow();
}

// Marks the Weather Window chosen in the finder on the existing timeline
function updateTimelineWindow() {
  const rect = document.getElementById('tl-window');
  if (!rect || !tlGeom) return;
  const w = state.selectedWindow;
  if (!w) {
    rect.setAttribute('display', 'none');
    return;
  }
  const x1 = clamp(tlGeom.x(w.start), 0, tlGeom.width);
  const x2 = clamp(tlGeom.x(w.end), 0, tlGeom.width);
  rect.setAttribute('x', x1.toFixed(1));
  rect.setAttribute('width', Math.max(x2 - x1, 0).toFixed(1));
  rect.removeAttribute('display');
}

// The cursor sits near the left so most of the visible timeline is the future
let cursorFrac = 0.25;
function sizeTimeline() {
  const w = el.tlScroller.clientWidth;
  cursorFrac = w < 600 ? 0.22 : 0.25;
  const [before, after] = el.tlTrack.querySelectorAll('.tl-spacer');
  before.style.width = `${Math.round(w * cursorFrac)}px`;
  after.style.width = `${Math.round(w * (1 - cursorFrac))}px`;
  el.tlScroller.parentElement.style.setProperty('--tl-cursor', `${cursorFrac * 100}%`);
}

const momentToScroll = (t) => (tlGeom ? tlGeom.x(t) : 0);
const momentFromScroll = () => clamp(tlGeom.t0 + (el.tlScroller.scrollLeft / PX_PER_HOUR) * 3600, tlGeom.t0, tlGeom.t1);

// Where a programmatic scroll is heading. Repeated key presses build on it, and landing snaps to
// the exact time, because scroll positions round to whole pixels (about 2.7 minutes each).
const PENDING_TTL_MS = 1500;
let pendingMoment = null;
let pendingSetAt = 0;
const setPending = (t) => { pendingMoment = t; pendingSetAt = Date.now(); };
const activePending = () => (pendingMoment !== null && Date.now() - pendingSetAt < PENDING_TTL_MS ? pendingMoment : null);
const baseMoment = () => activePending() ?? state.moment;

function goToMoment(t, smooth = true) {
  if (!tlGeom) return;
  const target = clamp(t, tlGeom.t0, tlGeom.t1);
  setPending(target);
  el.tlScroller.scrollTo({ left: momentToScroll(target), behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  if (!smooth || reducedMotion()) {
    state.moment = target;
    renderMoment();
  }
}

el.tlScroller.addEventListener('scroll', () => {
  if (tlFrame) return;
  tlFrame = requestAnimationFrame(() => {
    tlFrame = 0;
    if (!tlGeom) return;
    state.moment = momentFromScroll();
    const pending = activePending();
    // Within one pixel of the target: use the exact time, not the rounded scroll position
    if (pending !== null && Math.abs(state.moment - pending) <= (3600 / PX_PER_HOUR) * 1.01) state.moment = pending;
    renderMoment();
  });
}, { passive: true });

el.tlScroller.addEventListener('touchstart', () => { pendingMoment = null; }, { passive: true });

el.tlScroller.addEventListener('keydown', (e) => {
  if (!tlGeom) return;
  const step = { ArrowRight: 3, ArrowLeft: -3, PageDown: 24, PageUp: -24 }[e.key];
  if (step) {
    e.preventDefault();
    goToMoment(baseMoment() + step * 3600);
  } else if (e.key === 'Home') {
    e.preventDefault();
    goToMoment(tlGeom.t0);
  } else if (e.key === 'End') {
    e.preventDefault();
    goToMoment(tlGeom.t1);
  }
});

// Mouse drag to scrub (touch and trackpads scroll natively); a click jumps to that time
(() => {
  let drag = null;
  el.tlScroller.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: el.tlScroller.scrollLeft, moved: false };
    pendingMoment = null;
    el.tlScroller.setPointerCapture(e.pointerId);
  });
  el.tlScroller.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) {
      drag.moved = true;
      el.tlScroller.classList.add('is-dragging');
    }
    el.tlScroller.scrollLeft = drag.left - dx;
  });
  const end = (e) => {
    if (!drag) return;
    if (!drag.moved && tlGeom) {
      const rect = el.tlScroller.getBoundingClientRect();
      const offset = e.clientX - (rect.left + rect.width * cursorFrac);
      goToMoment(state.moment + (offset / PX_PER_HOUR) * 3600);
    }
    drag = null;
    el.tlScroller.classList.remove('is-dragging');
  };
  el.tlScroller.addEventListener('pointerup', end);
  el.tlScroller.addEventListener('pointercancel', end);
})();

el.tlPrev.addEventListener('click', () => goToMoment(baseMoment() - 3 * 3600));
el.tlNext.addEventListener('click', () => goToMoment(baseMoment() + 3 * 3600));
el.tlNow.addEventListener('click', () => goToMoment(tlGeom ? tlGeom.t0 : 0));
el.backToNow.addEventListener('click', () => goToMoment(tlGeom ? tlGeom.t0 : 0));

window.addEventListener('resize', () => {
  if (!tlGeom) return;
  sizeTimeline();
  setPending(state.moment);
  el.tlScroller.scrollLeft = momentToScroll(state.moment);
});

/* ==========================================================================
   Rendering
   ========================================================================== */
function renderAll({ resetMoment = true } = {}) {
  if (!state.current) return;
  const keep = state.moment;
  renderPlaceHeader();
  renderTimeline();
  renderDaily();
  renderSunTile();
  renderPlaces();
  renderCompare();
  renderRadar();
  renderWindows();
  renderBriefing();
  renderAnalytics();
  renderFreshness();
  renderCoverageLabels();
  const t = resetMoment || !keep ? state.points[0].dt : clamp(keep, tlGeom.t0, tlGeom.t1);
  setPending(t);
  el.tlScroller.scrollLeft = momentToScroll(t);
  state.moment = t;
  renderMoment();
}

function renderPlaceHeader() {
  const cur = state.current;
  const name = (state.place && state.place.name) || cur.name;
  el.cityName.innerHTML = `<span>${esc(name)}</span>${flagImg(cur.sys.country)}`;
  startClock(cur.timezone, countryName(cur.sys.country));
  updateFavoriteButton();
}

function startClock(tz, country) {
  clearInterval(clockTimer);
  const tick = () => {
    const now = nowSec();
    el.localTime.textContent = [country, fmtDay(now, { weekday: 'long', month: 'short', day: 'numeric' }, tz), fmtTime(now, tz)].filter(Boolean).join(' · ');
  };
  tick();
  clockTimer = setInterval(tick, 15000);
}

// Was this moment reported by the API, or estimated between two readings?
const READING_MATCH_SECONDS = 5 * 60;
function momentSource(t) {
  if (t <= state.points[0].dt + NOW_WINDOW) return 'current';
  return state.points.some((p) => Math.abs(p.dt - t) <= READING_MATCH_SECONDS) ? 'reading' : 'estimated';
}

// Everything that follows the timeline
function renderMoment() {
  if (!state.current || !state.points.length) return;
  const t = state.moment || state.points[0].dt;
  const isNow = t <= state.points[0].dt + NOW_WINDOW;
  const p = pointAt(t);
  const day = dayFor(t);
  const source = momentSource(t);
  const estimated = source === 'estimated';
  const shortWhen = isNow ? 'Now' : `${fmtDay(t)} ${fmtTime(t)}${estimated ? ' · est.' : ''}`;

  // Hero
  el.temperature.textContent = units.temp(p.temp);
  el.condition.textContent = p.weather.description;
  el.feelsLike.textContent = units.deg(p.feels);
  el.tempHigh.textContent = day ? units.deg(day.max) : '--';
  el.tempLow.textContent = day ? units.deg(day.min) : '--';
  const src = iconUrl(p.weather);
  if (el.heroIcon.getAttribute('src') !== src) {
    el.heroIcon.classList.remove('loaded');
    el.heroIcon.src = src;
  }
  el.heroIcon.alt = capitalize(p.weather.description);
  el.summary.textContent = buildSummary(t, p, isNow);
  el.momentChip.hidden = isNow;
  if (!isNow) el.momentLabel.textContent = `${fmtDay(t, { weekday: 'long' })}, ${fmtTime(t)} · ${estimated ? 'estimated between forecast readings' : 'forecast reading'}`;

  const advisory = buildAdvisory(p);
  el.advisory.hidden = !advisory;
  if (advisory) {
    el.advisoryTitle.textContent = advisory.title;
    el.advisoryText.textContent = advisory.text;
  }
  renderSky(t, p);
  // The tab title always shows the current temperature, whichever moment is selected
  const titleName = (state.place && state.place.name) || state.current.name;
  document.title = `${titleName} ${units.deg(state.current.main.temp)} — SkyPulse`;

  // Timeline cursor
  el.tlCursorLabel.textContent = shortWhen;
  el.tlNow.setAttribute('aria-pressed', String(isNow));
  const hours = Math.round((t - state.points[0].dt) / 3600);
  el.tlScroller.setAttribute('aria-valuenow', String(hours));
  el.tlScroller.setAttribute('aria-valuetext', `${isNow ? 'Now' : `${fmtDay(t, { weekday: 'long' })} ${fmtTime(t)}${estimated ? ', estimated' : ', forecast reading'}`}, ${units.deg(p.temp)}, ${p.weather.description}`);
  const dot = document.getElementById('tl-dot');
  if (dot && tlGeom) {
    dot.setAttribute('transform', `translate(${tlGeom.x(t).toFixed(1)} ${tlGeom.y(p.temp).toFixed(1)})`);
    dot.style.setProperty('--dot', tempColor(p.temp));
  }

  // Highlights and daily list
  el.highlightsWhen.textContent = shortWhen;
  el.highlightsWhen.classList.toggle('is-forecast', !isNow);
  renderConditions(p, isNow);
  renderUv(t, isNow);
  renderAir(t, isNow);
  const key = dayKey(t);
  el.dailyList.querySelectorAll('.daily-row').forEach((b) => b.setAttribute('aria-current', String(b.dataset.day === key)));
}

function renderConditions(p, isNow) {
  el.windSpeed.textContent = units.wind(p.wind);
  el.windUnit.textContent = units.windUnit();
  el.windGust.textContent = isNum(p.gust) ? `${units.wind(p.gust)} ${units.windUnit()}` : 'not reported';
  if (isNum(p.deg)) {
    el.windDir.textContent = `From the ${cardinal(p.deg)} (${Math.round(p.deg)}°)`;
    el.windNeedle.style.transform = `rotate(${p.deg + 180}deg)`;
  } else {
    el.windDir.textContent = 'Direction not reported';
  }

  el.humidity.textContent = Math.round(p.humidity);
  el.humidityBar.style.width = `${clamp(p.humidity, 0, 100)}%`;
  const dp = dewPointC(p.temp, p.humidity);
  el.dewPoint.textContent = dp === null ? '--' : units.deg(dp);

  el.feelsTile.textContent = units.deg(p.feels);
  const diff = p.feels - p.temp;
  el.feelsNote.textContent = diff >= 2 ? 'Humidity makes it feel warmer.'
    : diff <= -2 ? 'Wind makes it feel cooler.'
    : 'Close to the actual temperature.';

  [el.visibility.textContent, el.visibilityUnit.textContent] = units.distanceParts(p.vis);
  el.visibilityNote.textContent = !isNum(p.vis) ? 'Not reported'
    : p.vis >= 10000 ? 'Perfectly clear.'
    : p.vis >= 5000 ? 'Good visibility.'
    : p.vis >= 1000 ? 'Hazy conditions.'
    : 'Poor. Take care on the road.';

  el.pressure.textContent = units.pressure(p.pressure);
  el.pressureUnit.textContent = units.pressureUnit();
  el.pressureNote.textContent = !isNum(p.pressure) ? ''
    : p.pressure < 1000 ? 'Low. Unsettled weather likely.'
    : p.pressure > 1022 ? 'High. Settled, calm weather.'
    : 'Normal range.';

  el.precipChance.textContent = Math.round((p.pop || 0) * 100);
  const amount = p.snow || p.rain;
  const kind = p.snow ? 'snow' : 'rain';
  el.precipNote.textContent = amount
    ? `${units.rain(amount)} of ${kind} ${isNow ? 'in the last hour' : 'in this 3-hour window'}.`
    : isNow ? 'Chance in the next 3 hours.' : 'Chance in this 3-hour window.';
}

const UV_LEVELS = [
  { max: 2, label: 'Low', advice: 'No protection needed.' },
  { max: 5, label: 'Moderate', advice: 'Wear sunscreen if outside for long.' },
  { max: 7, label: 'High', advice: 'Sunscreen, hat and sunglasses.' },
  { max: 10, label: 'Very high', advice: 'Seek shade around midday.' },
  { max: Infinity, label: 'Extreme', advice: 'Avoid the sun around midday.' }
];

function renderUv(t) {
  const tile = el.uvIndex.closest('.tile');
  const today = dayKey(t) === dayKey(state.points[0].dt);
  const uv = state.uvi;
  if (!today || !isNum(uv)) {
    el.uvIndex.textContent = '--';
    el.uvCategory.textContent = '';
    el.uvAdvice.textContent = today ? 'UV data unavailable.' : 'Only available for today.';
    el.uvMarker.hidden = true;
    tile.classList.toggle('is-unavailable', !today);
    return;
  }
  tile.classList.remove('is-unavailable');
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

function airAt(t, isNow) {
  if (isNow) return state.air && state.air.list && state.air.list[0];
  const list = state.airForecast && state.airForecast.list;
  if (!list || !list.length) return null;
  let best = null;
  for (const entry of list) {
    if (!best || Math.abs(entry.dt - t) < Math.abs(best.dt - t)) best = entry;
  }
  return best && Math.abs(best.dt - t) <= 2 * 3600 ? best : null;
}

function renderAir(t, isNow) {
  const tile = el.aqiValue.closest('.tile');
  const entry = airAt(t, isNow);
  tile.classList.toggle('is-unavailable', !entry && !isNow);
  if (!entry) {
    el.aqiValue.textContent = '--';
    el.aqiCategory.textContent = '';
    el.aqiMarker.hidden = true;
    $('aqi-index').textContent = '';
    const loading = isNow ? state.airStatus === 'loading' : state.airForecastStatus === 'loading';
    el.aqiPollutants.innerHTML = `<div><dt>Status</dt><dd>${loading ? 'Loading' : isNow ? 'Unavailable' : 'Not forecast this far ahead'}</dd></div>`;
    return;
  }
  const c = entry.components;
  const aqi = usAqi(c.pm2_5);
  el.aqiValue.textContent = aqi ?? '--';
  el.aqiCategory.textContent = aqi === null ? '' : AQI_LEVELS.find((l) => aqi <= l.max).label;
  el.aqiMarker.hidden = aqi === null;
  if (aqi !== null) el.aqiMarker.style.left = `${clamp(aqi / 300, 0, 1) * 100}%`;
  const apiIndex = entry.main && entry.main.aqi;
  $('aqi-index').textContent = SkyInsights.AIR_LABELS[apiIndex] ? `US AQI from PM2.5. OpenWeatherMap index: ${apiIndex} of 5 (${SkyInsights.AIR_LABELS[apiIndex]})` : 'US AQI from PM2.5.';
  const items = [['PM2.5', c.pm2_5], ['PM10', c.pm10], ['O₃', c.o3], ['NO₂', c.no2]];
  el.aqiPollutants.innerHTML = items.map(([label, v]) => `
    <div><dt>${label}</dt><dd>${isNum(v) ? Math.round(v) : '--'} <small>µg/m³</small></dd></div>`).join('');
}

function renderDaily() {
  const daily = state.daily;
  const lo = Math.min(...daily.map((d) => d.min));
  const hi = Math.max(...daily.map((d) => d.max));
  const span = Math.max(hi - lo, 1);
  el.dailyList.innerHTML = daily.map((d, i) => {
    const left = ((d.min - lo) / span) * 100;
    const width = Math.max(((d.max - d.min) / span) * 100, 4);
    const label = i === 0 ? 'Today' : fmtDay(d.dt);
    const pop = d.pop >= 0.1 ? `${Math.round(d.pop * 10) * 10}%` : '';
    return `
      <li>
        <button type="button" class="daily-row" data-day="${d.key}" aria-current="false"
                aria-label="${esc(i === 0 ? 'Today' : fmtDay(d.dt, { weekday: 'long' }))}: ${esc(d.weather ? d.weather.description : '')}, low ${units.deg(d.min)}, high ${units.deg(d.max)}${pop ? `, ${pop} chance of rain` : ''}. Show on timeline">
          <span class="daily-day">${esc(label)}</span>
          ${iconImg(d.weather, 'daily-icon')}
          <span class="daily-pop">${pop}</span>
          <span class="daily-range">
            <span class="daily-lo">${units.deg(d.min)}</span>
            <span class="range-track">
              <span class="range-fill" style="left:${left}%;width:${width}%;--scale-w:${(100 / width) * 100}%;--scale-x:${(left / (100 - width || 1)) * 100}%"></span>
            </span>
            <span class="daily-hi">${units.deg(d.max)}</span>
          </span>
        </button>
      </li>`;
  }).join('');
}

el.dailyList.addEventListener('click', (e) => {
  const row = e.target.closest('.daily-row');
  if (!row || !tlGeom) return;
  if (row.dataset.day === dayKey(tlGeom.t0)) {
    goToMoment(tlGeom.t0);
  } else {
    // Jump to 2 PM local time on that day
    const d = state.daily.find((x) => x.key === row.dataset.day);
    const midnight = d.dt - ((d.dt + tzOffset()) % 86400);
    goToMoment(midnight + 14 * 3600);
  }
  document.querySelector('.timeline').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
});

function renderSunTile() {
  const { sunrise, sunset } = state.current.sys;
  if (!sunrise || !sunset) {
    el.sunrise.textContent = el.sunset.textContent = '--';
    el.daylight.textContent = 'Polar day or night';
    return;
  }
  el.sunrise.textContent = fmtTime(sunrise);
  el.sunset.textContent = fmtTime(sunset);
  const secs = sunset - sunrise;
  el.daylight.textContent = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;

  const now = Date.now() / 1000;
  const isDay = now >= sunrise && now <= sunset;
  const progress = clamp((now - sunrise) / secs, 0, 1);
  const point = el.sunProgress.getPointAtLength(el.sunProgress.getTotalLength() * progress);
  el.sunMarker.setAttribute('cx', point.x.toFixed(1));
  el.sunMarker.setAttribute('cy', point.y.toFixed(1));
  el.sunMarker.classList.toggle('is-night', !isDay);
  el.sunProgress.setAttribute('stroke-dasharray', `${(isDay ? progress : 0) * 100} 100`);
  el.sunProgress.style.opacity = isDay ? 1 : 0;
}

/* ---------- Radar map ---------- */
const BASEMAP_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; OpenWeatherMap';
const OWM_LAYERS = { precipitation: 'precipitation_new', clouds: 'clouds_new', temp: 'temp_new', wind: 'wind_new' };
let radarMap = null;
let radarOverlay = null;
let radarMarker = null;
let radarLayer = 'precipitation';
let radarVisible = false;

function renderRadar() {
  if (!state.current || typeof L === 'undefined' || !radarVisible) return;
  const { lat, lon } = state.current.coord;
  if (!radarMap) {
    radarMap = L.map(el.radarMap, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lon], 7);
    // The base map is darkened with a CSS filter in dark mode (see .map-base in style.css)
    L.tileLayer(BASEMAP_URL, { maxZoom: 18, attribution: MAP_ATTRIBUTION, className: 'map-base' }).addTo(radarMap);
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
  const card = (d) => {
    const diff = Math.round(units.temp(d.main.temp) - units.temp(a.main.temp));
    const diffHtml = d !== a && diff !== 0
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
          <div><dt>Local time</dt><dd>${esc(fmtTime(nowSec(), d.timezone))}</dd></div>
        </dl>
      </article>`;
  };
  el.compareResult.innerHTML = card(a) + card(b);
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

/* ==========================================================================
   Weather Window Finder (scoring lives in insights.js)
   ========================================================================== */
const CATEGORY_CLASS = { optimal: 'cat-optimal', good: 'cat-good', fair: 'cat-fair', poor: 'cat-poor' };

function windowDayLabel(dt) {
  const key = dayKey(dt);
  const now = nowSec();
  if (key === dayKey(now)) return 'Today';
  if (key === dayKey(now + 86400)) return 'Tomorrow';
  return fmtDay(dt, { weekday: 'long' });
}

// Current and hourly forecast air readings, on the API's 1-5 scale
function airReadings() {
  const list = [...((state.air && state.air.list) || []), ...((state.airForecast && state.airForecast.list) || [])];
  return list.map((e) => ({ dt: e.dt, aqi: e.main ? e.main.aqi : null }));
}

function computeWindows() {
  return SkyInsights.findWeatherWindows(state.activity, state.points, { now: nowSec(), tz: tzOffset(), horizonHours: 48, air: airReadings() });
}

function windowDataNote(w) {
  const n = w.readingsInWindow;
  const readings = `${n} forecast reading${n === 1 ? '' : 's'}`;
  return w.estimatedSamples ? `Hourly values estimated from ${readings}` : `${readings}`;
}

function windowCard(w, i) {
  const selected = state.selectedWindow && state.selectedWindow.start === w.start;
  const extras = [];
  if (isNum(w.gust)) extras.push(`Gusts ${units.wind(w.gust)} ${units.windUnit()}`);
  if (isNum(w.humidity)) extras.push(`Humidity ${Math.round(w.humidity)}%`);
  if (w.rainMm >= 0.1) extras.push(`Rain about ${units.rain(w.rainMm)}`);
  if (w.snowMm >= 0.1) extras.push(`Snow about ${units.rain(w.snowMm)}`);
  const breakdown = w.breakdown.map((b) => `
    <div class="win-bar">
      <span>${esc(b.label)}</span>
      <span class="win-bar-track" aria-hidden="true"><i style="width:${b.score}%"></i></span>
      <b>${b.score}</b>
    </div>`).join('');
  const deductions = [
    ...w.adjustments.map((a) => `<li>${esc(a.reason)}: ${a.points} points</li>`),
    ...w.caps.map((c) => `<li>Score limited to ${c.max}: ${esc(c.reason)}</li>`)
  ].join('');
  const airText = w.air ? `${w.air.label} air (${w.air.index}/5)` : 'Air: no data';
  return `
    <article class="win-card ${CATEGORY_CLASS[w.category.id]}">
      <button type="button" class="win-main" data-window="${i}" aria-pressed="${!!selected}"
              aria-label="${esc(`Show ${windowDayLabel(w.start)} ${fmtTime(w.start)} to ${fmtTime(w.end)} on the timeline. Score ${w.score} out of 100, ${w.category.label}.`)}">
        <span class="win-top">
          <span class="win-when">
            <b>${esc(windowDayLabel(w.start))}</b>
            <span>${esc(fmtTime(w.start))} – ${esc(fmtTime(w.end))}</span>
          </span>
          ${iconImg(w.weather, 'win-icon')}
        </span>
        <span class="win-score"><b>${w.score}</b><small>/100</small><span class="win-badge">${esc(w.category.label)}</span></span>
        <span class="win-metrics">
          <span>${units.deg(w.temp)}</span>
          <span>${Math.round(w.pop * 100)}% rain</span>
          <span>${units.wind(w.wind)} ${units.windUnit()} wind</span>
          <span class="${w.air && w.air.index < 4 ? '' : 'win-air-alert'}">${esc(airText)}</span>
        </span>
        <span class="win-reason">${esc(w.reasons.join('. '))}.</span>
        ${w.warnings.length ? `<span class="win-warning">${esc(w.warnings[0])}</span>` : ''}
      </button>
      <details class="win-details">
        <summary>Why this score</summary>
        <p class="win-extra">${esc(windowDataNote(w))}.</p>
        ${w.warnings.slice(1).map((x) => `<p class="win-extra">${esc(x)}</p>`).join('')}
        <div class="win-breakdown">${breakdown}</div>
        ${deductions ? `<ul class="win-deductions">${deductions}</ul>` : ''}
        ${extras.length ? `<p class="win-extra">${esc(extras.join(' · '))}</p>` : ''}
        ${w.missing.length ? `<p class="win-extra">Not in this forecast, so not scored: ${esc(w.missing.join(', '))}.</p>` : ''}
      </details>
    </article>`;
}

function renderWindows() {
  const box = $('window-results');
  document.querySelectorAll('[data-activity]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.activity === state.activity)));
  if (!state.points.length) return;
  state.windows = computeWindows();
  if (state.selectedWindow && !state.windows.some((w) => w.start === state.selectedWindow.start)) {
    state.selectedWindow = null;
    updateTimelineWindow();
  }
  const note = $('window-note');
  if (!state.windows.length) {
    box.innerHTML = '<p class="empty-state">The saved forecast has no complete 3-hour period left to rank. Reconnect to load a new forecast.</p>';
    note.hidden = true;
    return;
  }
  box.innerHTML = state.windows.map(windowCard).join('');
  const allPoor = state.windows.every((w) => w.category.id === 'poor');
  const airLoading = state.airForecastStatus === 'loading';
  note.hidden = !allPoor && !airLoading;
  if (airLoading) note.textContent = 'Checking air quality. Scores may change when it loads.';
  else if (allPoor) note.textContent = `No period looks good for ${SkyInsights.ACTIVITIES[state.activity].label.toLowerCase()} in the available forecast. These are the least unfavorable.`;
}

$('activity-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-activity]');
  if (!tab || tab.dataset.activity === state.activity) return;
  state.activity = tab.dataset.activity;
  store.set('activity', state.activity);
  state.selectedWindow = null;
  updateTimelineWindow();
  renderWindows();
});

$('window-results').addEventListener('click', (e) => {
  const main = e.target.closest('[data-window]');
  if (!main) return;
  const w = state.windows[+main.dataset.window];
  if (!w) return;
  state.selectedWindow = { start: w.start, end: w.end };
  document.querySelectorAll('[data-window]').forEach((b) => b.setAttribute('aria-pressed', String(b === main)));
  updateTimelineWindow();
  goToMoment(w.start);
  document.querySelector('.timeline').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
});

/* ==========================================================================
   Personal briefing (rules live in insights.js)
   ========================================================================== */
const SEVERITY_LABEL = { high: 'Important', medium: 'Worth noting', low: 'Good to know' };

function currentAqi() {
  const entry = state.air && state.air.list && state.air.list[0];
  const value = entry ? usAqi(entry.components.pm2_5) : null;
  if (value === null) return null;
  return { value, label: AQI_LEVELS.find((l) => value <= l.max).label, pm25: entry.components.pm2_5 };
}

function buildBriefing() {
  return SkyInsights.generatePersonalBriefing({
    current: state.points[0],
    forecast: state.points,
    aqi: currentAqi(),
    uv: state.uvi,
    now: nowSec(),
    format: {
      temp: (c) => units.deg(c),
      wind: (ms) => `${units.wind(ms)} ${units.windUnit()}`,
      rain: (mm) => units.rain(mm),
      time: (dt) => fmtTime(dt)
    }
  });
}

function renderBriefing() {
  if (!state.points.length) return;
  const { insights, unavailable } = buildBriefing();
  $('briefing-list').innerHTML = insights.map((i) => `
    <article class="brief-card sev-${i.severity}">
      <header class="brief-head">
        <span class="brief-icon"><svg class="icon" aria-hidden="true"><use href="#${i.icon}"/></svg></span>
        <span class="brief-category">${esc(i.category)}</span>
        <span class="brief-sev">${SEVERITY_LABEL[i.severity]}</span>
      </header>
      <h3 class="brief-title">${esc(i.title)}</h3>
      <p class="brief-text">${esc(i.explanation)}</p>
      <p class="brief-action">${esc(i.action)}</p>
    </article>`).join('');

  const pending = [];
  const missing = [];
  for (const name of unavailable) {
    const loading = (name === 'Air Quality' && state.airStatus === 'loading') || (name === 'Sun Protection' && state.uvStatus === 'loading');
    (loading ? pending : missing).push(name);
  }
  const notes = [];
  if (pending.length) notes.push(`Loading ${pending.join(' and ')}.`);
  if (missing.length) notes.push(`${missing.join(' and ')} data isn't available right now, so it's left out.`);
  const note = $('briefing-note');
  note.textContent = notes.join(' ');
  note.hidden = !notes.length;
}

// Forecast coverage varies by location, so labels follow what was actually returned
const coverageDays = () => state.daily.length;
const coverageLabel = () => (coverageDays() === 1 ? '1 day' : `${coverageDays()} days`);

function renderCoverageLabels() {
  const setLabel = (id, text) => {
    const heading = $(id);
    heading.lastChild.textContent = text;
  };
  setLabel('daily-title', `${coverageDays()}-day forecast`);
  setLabel('timeline-title', `Next ${coverageLabel()}`);
  document.querySelector('[data-chart-view="5d"]').textContent = coverageLabel();
}

function renderInsightsUnavailable() {
  const message = '<p class="empty-state">Weather data couldn\'t be loaded, so there\'s nothing to analyze yet. Use "Try again" above, or search for a city.</p>';
  $('window-results').innerHTML = message;
  $('briefing-list').innerHTML = message;
  $('analytics-fallback').hidden = false;
  $('analytics-fallback').textContent = 'The chart will appear once weather data loads.';
}

function renderFreshness() {
  const fresh = SkyInsights.describeFreshness(state.forecastFetchedAt, Date.now());
  const place = (state.place && state.place.name) || (state.current && state.current.name) || '';
  document.querySelectorAll('[data-freshness]').forEach((node) => {
    node.textContent = fresh.label;
    node.classList.toggle('is-stale', fresh.stale);
  });
  $('briefing-place').textContent = place ? `For ${place}, based on current conditions and the next 24 hours.` : '';
  const banner = $('stale-banner');
  banner.hidden = !fresh.stale;
  if (fresh.stale) $('stale-text').textContent = `${fresh.label}. It will update when the connection returns.`;
}

/* ==========================================================================
   Forecast analytics (supplementary Chart.js view; the SVG timeline stays primary)
   ========================================================================== */
let analyticsChart = null;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function analyticsConfig(view, palette, { animate = true, showWind = false, responsive = true, onPick = null } = {}) {
  const horizon = state.points[0].dt + 24 * 3600;
  const pts = view === '24h' ? state.points.filter((p) => p.dt <= horizon) : state.points;
  const isMidday = pts.map((p) => { const h = cityDate(p.dt).getUTCHours(); return h >= 11 && h <= 13; });
  return {
    data: {
      labels: pts.map((p, i) => (i === 0 ? 'Now' : `${fmtDay(p.dt)} ${fmtHour(p.dt)}`)),
      datasets: [
        {
          type: 'line',
          label: `Temperature (°${state.units === 'metric' ? 'C' : 'F'})`,
          data: pts.map((p) => numOrNull(units.temp(p.temp))),
          yAxisID: 'yTemp',
          borderColor: palette.temp,
          backgroundColor: palette.temp,
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: view === '24h' ? 3 : 0,
          pointHoverRadius: 5,
          spanGaps: false,
          order: 1
        },
        {
          type: 'bar',
          label: 'Precipitation chance (%)',
          data: pts.map((p) => (isNum(p.pop) ? Math.round(p.pop * 100) : null)),
          yAxisID: 'yRain',
          backgroundColor: palette.rain,
          borderRadius: 3,
          order: 3
        },
        {
          type: 'line',
          label: `Wind (${units.windUnit()})`,
          data: pts.map((p) => numOrNull(units.wind(p.wind))),
          yAxisID: 'yWind',
          borderColor: palette.wind,
          backgroundColor: palette.wind,
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          spanGaps: false,
          hidden: !showWind,
          order: 2
        }
      ]
    },
    options: {
      responsive,
      maintainAspectRatio: false,
      animation: animate ? { duration: 400 } : false,
      interaction: { mode: 'index', intersect: false },
      onClick: onPick ? (evt, items) => { if (items.length) onPick(pts[items[0].index].dt); } : undefined,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: palette.text, boxWidth: 12, boxHeight: 12, font: { family: 'Inter', size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, .94)',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            title: (items) => {
              const p = pts[items[0].dataIndex];
              return `${fmtDay(p.dt, { weekday: 'long' })}, ${fmtTime(p.dt)} (${p.isCurrent ? 'current observation' : 'forecast reading'})`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: palette.text,
            font: { family: 'Inter', size: 12 },
            autoSkip: false,
            maxRotation: 0,
            callback: (v, i) => {
              if (view === '24h') return i === 0 ? 'Now' : fmtHour(pts[i].dt);
              return isMidday[i] ? fmtDay(pts[i].dt) : '';
            }
          }
        },
        yTemp: {
          position: 'left',
          grid: { color: palette.grid },
          border: { display: false },
          grace: '10%',
          title: { display: true, text: `°${state.units === 'metric' ? 'C' : 'F'}`, color: palette.text },
          ticks: { color: palette.text, maxTicksLimit: 6, font: { family: 'Inter', size: 12 } }
        },
        yRain: {
          position: 'right',
          min: 0,
          max: 100,
          grid: { display: false },
          border: { display: false },
          title: { display: true, text: 'Precip. %', color: palette.text },
          ticks: { color: palette.text, stepSize: 25, font: { family: 'Inter', size: 12 } }
        },
        yWind: {
          display: 'auto',
          position: 'right',
          min: 0,
          grid: { display: false },
          border: { display: false },
          title: { display: true, text: units.windUnit(), color: palette.text },
          ticks: { color: palette.text, maxTicksLimit: 6, font: { family: 'Inter', size: 12 } }
        }
      }
    }
  };
}

function renderAnalytics() {
  const fallback = $('analytics-fallback');
  const wrap = $('analytics-wrap');
  document.querySelectorAll('[data-chart-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chartView === state.chartView)));
  if (typeof Chart === 'undefined') {
    wrap.hidden = true;
    fallback.hidden = false;
    fallback.textContent = "The chart couldn't load. The timeline above shows the same forecast.";
    return;
  }
  if (!state.points.length) return;
  wrap.hidden = false;
  fallback.hidden = true;
  const showWind = analyticsChart ? analyticsChart.isDatasetVisible(2) : false;
  if (analyticsChart) analyticsChart.destroy();
  const palette = { temp: cssVar('--curve'), rain: cssVar('--rain-bar'), wind: cssVar('--accent'), text: cssVar('--text-3'), grid: cssVar('--border') };
  analyticsChart = new Chart($('analytics-chart'), analyticsConfig(state.chartView, palette, {
    showWind,
    onPick: (dt) => {
      goToMoment(dt);
      document.querySelector('.timeline').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  }));
  $('analytics-chart').setAttribute('aria-label', `Temperature, rain chance and wind for the ${state.chartView === '24h' ? 'next 24 hours' : `next ${coverageLabel()}`} in ${(state.place && state.place.name) || state.current.name}. Use the timeline above for the same data by keyboard.`);
}

document.querySelectorAll('[data-chart-view]').forEach((b) => b.addEventListener('click', () => {
  state.chartView = b.dataset.chartView;
  renderAnalytics();
}));

/* ==========================================================================
   Favorites & history
   ========================================================================== */
// Older versions stored plain city-name strings; normalise them
function normalisePlaces(list) {
  if (!Array.isArray(list)) return [];
  return list.map((p) => (typeof p === 'string' ? { name: p, query: p } : p)).filter((p) => p && p.name);
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

const placeFromRecord = (p) => (isNum(p.lat) && isNum(p.lon)
  ? { lat: p.lat, lon: p.lon, name: p.name, country: p.country }
  : { query: p.query || p.name });

let visibleHistory = [];
function renderPlaces() {
  const favs = getFavorites();
  const current = currentPlaceRecord();
  visibleHistory = getHistory().filter((h) => !favs.some((f) => samePlace(f, h)));
  const title = (p) => esc([p.name, countryName(p.country)].filter(Boolean).join(', '));

  el.favChips.innerHTML = favs.map((p, i) => `
    <span class="chip chip-fav${current && samePlace(p, current) ? ' is-current' : ''}">
      <button type="button" class="chip-open" data-fav="${i}" title="${title(p)}">${esc(p.name)}</button>
      <button type="button" class="chip-remove" data-unfav="${i}" aria-label="Remove ${esc(p.name)} from favorites">
        <svg class="icon" aria-hidden="true"><use href="#i-x"/></svg>
      </button>
    </span>`).join('');
  el.historyChips.innerHTML = visibleHistory.map((p, i) => `
    <button type="button" class="chip${current && samePlace(p, current) ? ' is-current' : ''}" data-history="${i}" title="${title(p)}">${esc(p.name)}</button>`).join('');

  el.favGroup.hidden = favs.length === 0;
  el.historyGroup.hidden = visibleHistory.length === 0;
  el.places.hidden = favs.length === 0 && visibleHistory.length === 0;
}

el.places.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.fav !== undefined) {
    loadPlace(placeFromRecord(getFavorites()[+t.dataset.fav]));
  } else if (t.dataset.unfav !== undefined) {
    const favs = getFavorites();
    const [removed] = favs.splice(+t.dataset.unfav, 1);
    store.set('favoriteCities', favs);
    toast(`Removed ${removed.name} from favorites`);
    updateFavoriteButton();
    renderPlaces();
  } else if (t.dataset.history !== undefined) {
    loadPlace(placeFromRecord(visibleHistory[+t.dataset.history]));
  }
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
});

el.clearHistory.addEventListener('click', (e) => {
  e.stopPropagation();
  store.remove('searchHistory');
  renderPlaces();
});

el.favBtn.addEventListener('click', toggleFavorite);

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
  if (!el.acList.hidden && ac.items.length) {
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
   Units, theme, top bar, banners, toasts
   ========================================================================== */
function setUnits(next) {
  state.units = next;
  store.set('units', next);
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === next)));
  renderAll({ resetMoment: false });
}
document.querySelectorAll('[data-units]').forEach((b) => b.addEventListener('click', () => setUnits(b.dataset.units)));
document.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => setRadarLayer(b.dataset.layer)));

function applyThemeLabel() {
  const light = document.documentElement.dataset.theme === 'light';
  el.themeToggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
}
el.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  applyThemeLabel();
  if (state.current) renderAnalytics();
});

// Transparent over the sky at the top of the page, solid as soon as content scrolls beneath it
function updateTopbar() {
  el.topbar.classList.toggle('is-solid', window.scrollY > 8);
}
window.addEventListener('scroll', updateTopbar, { passive: true });

let retryAction = null;
function showError(message, retry = null) {
  el.errorText.textContent = message;
  retryAction = retry;
  el.errorRetry.hidden = !retry;
  el.errorBanner.hidden = false;
  if (window.scrollY > el.hero.offsetHeight / 2) toast(message);
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

const updateOnline = () => { el.offlineBanner.hidden = navigator.onLine; };
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
// Light-background version of the analytics chart, drawn off-screen for the report
function reportChartImage() {
  if (typeof Chart === 'undefined' || !state.points.length) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 688;
  canvas.height = 260;
  canvas.style.cssText = 'width:688px;height:260px';
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:688px;height:260px';
  holder.appendChild(canvas);
  document.body.appendChild(holder);
  const palette = { temp: '#c2410c', rain: 'rgba(11, 111, 214, .3)', wind: '#0b6fd6', text: '#475569', grid: '#e2e8f0' };
  const config = analyticsConfig('5d', palette, { animate: false, responsive: false });
  config.options.devicePixelRatio = 2;
  const chart = new Chart(canvas, config);
  const image = canvas.toDataURL('image/png');
  chart.destroy();
  holder.remove();
  return image;
}

function buildReportHtml() {
  const cur = state.current;
  const name = (state.place && state.place.name) || cur.name;
  const now = nowSec();
  const aqi = currentAqi();
  const p0 = state.points[0];
  const activityLabel = SkyInsights.ACTIVITIES[state.activity].label;
  const fresh = SkyInsights.describeFreshness(state.forecastFetchedAt, Date.now());
  const { insights } = buildBriefing();
  const windows = computeWindows();
  const apiAirEntry = state.air && state.air.list && state.air.list[0];
  const apiAirIndex = apiAirEntry && apiAirEntry.main ? apiAirEntry.main.aqi : null;
  const chartImage = reportChartImage();

  const rows = [
    ['Feels like', units.deg(cur.main.feels_like)],
    ['Humidity', `${cur.main.humidity}%`],
    ['Wind', `${units.wind(cur.wind.speed)} ${units.windUnit()}${isNum(cur.wind.deg) ? ` from ${cardinal(cur.wind.deg)}` : ''}`],
    ['Pressure', `${units.pressure(cur.main.pressure)} ${units.pressureUnit()}`],
    ['Visibility', isNum(cur.visibility) ? units.distance(cur.visibility) : 'Not reported'],
    ['UV index', isNum(state.uvi) ? Math.round(state.uvi) : 'Unavailable'],
    ['Air quality (US AQI from PM2.5)', aqi ? `${aqi.value} (${aqi.label})` : 'Unavailable'],
    ['Air quality (OpenWeatherMap index)', SkyInsights.AIR_LABELS[apiAirIndex] ? `${apiAirIndex} of 5 (${SkyInsights.AIR_LABELS[apiAirIndex]})` : 'Unavailable'],
    ['Sunrise / sunset', cur.sys.sunrise && cur.sys.sunset ? `${fmtTime(cur.sys.sunrise)} / ${fmtTime(cur.sys.sunset)}` : 'Polar day or night']
  ];

  return `
    <div class="pdf-report">
      <header>
        <div>
          <h1>${esc(name)}, ${esc(countryName(cur.sys.country))}</h1>
          <div class="pdf-muted">${esc(fmtDay(now, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))} · ${esc(fmtTime(now))} local time</div>
        </div>
        <div class="pdf-muted">SkyPulse weather report<br>${esc(fresh.label)}</div>
      </header>
      <div class="pdf-now">
        <div>
          <div class="pdf-temp">${units.deg(cur.main.temp)}</div>
          <div style="text-transform:capitalize;font-weight:600">${esc(cur.weather[0].description)}</div>
        </div>
        <div class="pdf-muted" style="max-width:340px;text-align:right">${esc(buildSummary(p0.dt, p0, true))}</div>
      </div>
      <section class="pdf-block">
        <h2>Current conditions (observed)</h2>
        <table><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      </section>
      ${insights.length ? `
      <section class="pdf-block">
        <h2>Your personal weather briefing</h2>
        <div class="pdf-insights">${insights.map((i) => `
          <div class="pdf-insight">
            <div class="pdf-insight-cat">${esc(i.category)} · ${SEVERITY_LABEL[i.severity]}</div>
            <b>${esc(i.title)}</b>
            <p>${esc(i.explanation)} ${esc(i.action)}</p>
          </div>`).join('')}
        </div>
      </section>` : ''}
      ${windows.length ? `
      <section class="pdf-block">
        <h2>Best weather windows for ${esc(activityLabel.toLowerCase())}</h2>
        <table>
          <thead><tr><th>When</th><th>Score</th><th>Temp</th><th>Rain</th><th>Wind</th><th>Air</th><th>Why</th></tr></thead>
          <tbody>${windows.map((w) => `
            <tr>
              <td style="white-space:nowrap">${esc(windowDayLabel(w.start))}<br>${esc(fmtTime(w.start))} – ${esc(fmtTime(w.end))}</td>
              <td style="white-space:nowrap"><b>${w.score}/100</b><br>${esc(w.category.label)}</td>
              <td>${units.deg(w.temp)}</td>
              <td>${Math.round(w.pop * 100)}%</td>
              <td style="white-space:nowrap">${units.wind(w.wind)} ${units.windUnit()}</td>
              <td>${w.air ? `${esc(w.air.label)}<br>${w.air.index}/5` : 'No data'}</td>
              <td>${esc(w.reasons.join('. '))}.${w.warnings.length ? `<br><b>${esc(w.warnings[0])}</b>` : ''}<br><span class="pdf-muted">${esc(windowDataNote(w))}.</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <p class="pdf-note">Window scores use hourly values estimated between the API's 3-hour forecast readings. Air here uses OpenWeatherMap's hourly 1-5 index (worst hour in the window), which is a different scale from the US AQI above. Scores are heuristic recommendations, not official health or safety standards.</p>
      </section>` : ''}
      <section class="pdf-block">
        <h2>${coverageDays()}-day forecast (from API readings)</h2>
        <table>
          <thead><tr><th>Day</th><th>Conditions</th><th>Low</th><th>High</th><th>Rain chance</th></tr></thead>
          <tbody>${state.daily.map((d, i) => `
            <tr>
              <td>${esc(i === 0 ? 'Today' : fmtDay(d.dt, { weekday: 'long' }))}</td>
              <td style="text-transform:capitalize">${esc(d.weather ? d.weather.description : '')}</td>
              <td>${units.deg(d.min)}</td>
              <td>${units.deg(d.max)}</td>
              <td>${Math.round(d.pop * 100)}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </section>
      ${chartImage ? `
      <section class="pdf-block">
        <h2>Forecast analytics (API readings every 3 hours)</h2>
        <img class="pdf-chart" src="${chartImage}" alt="Temperature and rain chance for the next ${coverageLabel()}" />
      </section>` : ''}
      <footer>Data: OpenWeatherMap. Scores and briefing are heuristic, rule-based guidance, not official health or safety standards. Generated ${esc(new Date().toLocaleString())}.</footer>
    </div>`;
}

// html2pdf's page-break plugin measures every block before inserting spacers, which drifts on
// long reports and cut off the chart. Instead, place each section on an exact-height A4 page.
const PDF_PAGE_HEIGHT = 1062; // CSS pixels of printable A4 at the report's 733px width
const PDF_PAGE_PADDING = 40;

async function paginateReport(report) {
  // A bounded load wait, not img.decode(), which never settles while a page isn't painting
  await Promise.all([...report.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 2000);
  }))));
  const blocks = [...report.children].map((node) => {
    const style = getComputedStyle(node);
    return { node, height: node.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom) };
  });
  const pages = [];
  let page = null;
  let used = 0;
  for (const { node, height } of blocks) {
    if (!page || used + height > PDF_PAGE_HEIGHT - PDF_PAGE_PADDING) {
      page = document.createElement('div');
      page.className = 'pdf-page';
      page.style.height = `${PDF_PAGE_HEIGHT}px`;
      pages.push(page);
      used = 0;
    }
    page.appendChild(node);
    used += height;
  }
  report.classList.add('is-paginated');
  report.replaceChildren(...pages);
  return pages.length;
}

const pdfOptions = (name) => ({
  margin: 8,
  filename: `SkyPulse_${name.replace(/[^\w-]+/g, '_')}.pdf`,
  image: { type: 'jpeg', quality: 0.96 },
  html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, logging: false },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: [] }
});

el.pdfBtn.addEventListener('click', async () => {
  if (!state.current) return;
  if (typeof html2pdf === 'undefined') {
    toast('The PDF tool is still loading. Try again in a moment.');
    return;
  }
  const name = (state.place && state.place.name) || state.current.name;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-10000px;top:0';
  wrap.innerHTML = buildReportHtml();
  document.body.appendChild(wrap);
  el.pdfBtn.disabled = true;
  try {
    await paginateReport(wrap.firstElementChild);
    await html2pdf().set(pdfOptions(name)).from(wrap.firstElementChild).save();
    // The browser decides whether and when the file is saved, so don't claim it already was
    toast('PDF report created. Check your downloads.');
  } catch (e) {
    toast("Couldn't create the PDF. Try again.");
  } finally {
    wrap.remove();
    el.pdfBtn.disabled = false;
  }
});

/* ==========================================================================
   Init
   ========================================================================== */
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

// Keep "now", the sun tile and the sky fresh while the page stays open
setInterval(() => {
  if (!state.current) return;
  renderSunTile();
  renderFreshness();
  if (state.windows.some((w) => w.start < nowSec())) renderWindows();
  if (state.moment <= state.points[0].dt + NOW_WINDOW) renderMoment();
}, 60000);

function registerServiceWorker() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !secure) return;
  navigator.serviceWorker.register('./service-worker.js').catch(() => { /* optional */ });
}

function init() {
  state.units = store.get('units') === 'imperial' ? 'imperial' : 'metric';
  const savedActivity = store.get('activity');
  if (SkyInsights.isActivity(savedActivity)) state.activity = savedActivity;
  document.querySelectorAll('[data-activity]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.activity === state.activity)));
  document.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === state.units)));
  applyThemeLabel();
  updateOnline();
  updateTopbar();
  renderPlaces();
  const last = store.get('lastPlace');
  loadPlace(last && last.name ? placeFromRecord(last) : DEFAULT_PLACE);
  registerServiceWorker();
}

init();
