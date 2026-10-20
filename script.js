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
  if (err.status === 429) return 'Too many requests. Wait a minute and try again.';
  if (err.status >= 500) return 'The weather service is having trouble. Try again shortly.';
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

    Object.assign(state, { place, current, forecast, air: null, airForecast: null, uvi: null, loadedAt: Date.now() });
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
      .then((d) => { if (seq === loadSeq) { state.air = d; renderMoment(); } }).catch(() => {});
    fetchWeatherApi('air_pollution_forecast', { lat, lon }, ttl)
      .then((d) => { if (seq === loadSeq) { state.airForecast = d; renderMoment(); } }).catch(() => {});
    fetchWeatherApi('uvi', { lat, lon }, ttl)
      .then((d) => { if (seq === loadSeq) { state.uvi = isNum(d && d.value) ? d.value : null; renderMoment(); } }).catch(() => {});
  } catch (err) {
    if (seq !== loadSeq) return;
    const retryable = err.kind !== 'http' || err.status === 429 || err.status >= 500;
    showError(describeError(err, place), retryable ? () => loadPlace(place) : null);
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
function sunState(t) {
  const { sunrise, sunset } = state.current.sys;
  if (!sunrise || !sunset) return { e: 0.5, p: 0.5, day: true };
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
  const { e, p: progress, day } = sunState(t);
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
const TL = { height: 206, curveTop: 92, curveBottom: 142, barBase: 178, barMax: 24 };
let tlGeom = null;   // { t0, t1, width, x(t), y(temp) }
let tlFrame = 0;

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

  const parts = [];

  // Night bands from (approximate) sunset to sunrise for each day
  const { sunrise, sunset } = state.current.sys;
  if (sunrise && sunset) {
    for (let k = -1; k <= 6; k++) {
      const a = clamp(x(sunset + k * 86400), 0, width);
      const b = clamp(x(sunrise + (k + 1) * 86400), 0, width);
      if (b > a) parts.push(`<rect class="tl-night" x="${a.toFixed(1)}" y="0" width="${(b - a).toFixed(1)}" height="${TL.height}" rx="0"/>`);
    }
  }

  // Day boundaries at local midnight
  const localSecs = (t0 + tzOffset()) % 86400;
  parts.push(`<text class="tl-day" x="0" y="16">Today</text>`);
  for (let m = t0 - localSecs + 86400; m < t1; m += 86400) {
    const mx = x(m).toFixed(1);
    parts.push(`<line class="tl-daysep" x1="${mx}" y1="0" x2="${mx}" y2="${TL.height}"/>`);
    parts.push(`<text class="tl-day" x="${(+mx + 8).toFixed(1)}" y="16">${esc(fmtDay(m))} <tspan class="tl-date">${esc(fmtDay(m, { day: 'numeric' }))}</tspan></text>`);
  }

  // Curve and filled area
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

  // Per-reading details; skip labels that would collide with the previous one
  let lastLabelX = -Infinity;
  pts.forEach((p, i) => {
    const px = xs[i];
    const h = Math.round((p.pop || 0) * TL.barMax);
    if (h > 0) parts.push(`<rect class="tl-bar" x="${(px - 9).toFixed(1)}" y="${TL.barBase - h}" width="18" height="${h}" rx="3"/>`);
    if (px - lastLabelX < 46) return;
    lastLabelX = px;
    parts.push(`<image href="${iconUrl(p.weather)}" x="${(px - 14).toFixed(1)}" y="26" width="28" height="28"/>`);
    parts.push(`<text class="tl-temp" x="${px.toFixed(1)}" y="${(ys[i] - 10).toFixed(1)}">${units.deg(p.temp)}</text>`);
    parts.push(`<circle class="tl-point" cx="${px.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3"/>`);
    if (p.pop >= 0.2) parts.push(`<text class="tl-pop" x="${px.toFixed(1)}" y="${TL.barBase - h - 4}">${Math.round(p.pop * 100)}%</text>`);
    parts.push(`<text class="tl-hour" x="${px.toFixed(1)}" y="${TL.height - 6}">${i === 0 ? 'Now' : esc(fmtHour(p.dt))}</text>`);
  });
  parts.push('<circle id="tl-dot" class="tl-dot" r="7" cx="0" cy="0"/>');

  el.tlTrack.innerHTML = `
    <div class="tl-spacer"></div>
    <svg width="${width}" height="${TL.height}" viewBox="0 0 ${width} ${TL.height}" aria-hidden="true">${parts.join('')}</svg>
    <div class="tl-spacer"></div>`;
  el.tlScroller.setAttribute('aria-valuemax', String(Math.round((t1 - t0) / 3600)));
  sizeTimeline();
}

// The cursor sits mid-way on wide screens and further left on phones, so more of the future fits
let cursorFrac = 0.5;
function sizeTimeline() {
  const w = el.tlScroller.clientWidth;
  cursorFrac = w < 600 ? 0.3 : 0.5;
  const [before, after] = el.tlTrack.querySelectorAll('.tl-spacer');
  before.style.width = `${Math.round(w * cursorFrac)}px`;
  after.style.width = `${Math.round(w * (1 - cursorFrac))}px`;
  el.tlScroller.parentElement.style.setProperty('--tl-cursor', `${cursorFrac * 100}%`);
}

const momentToScroll = (t) => (tlGeom ? tlGeom.x(t) : 0);
const momentFromScroll = () => clamp(tlGeom.t0 + (el.tlScroller.scrollLeft / PX_PER_HOUR) * 3600, tlGeom.t0, tlGeom.t1);

// Where a smooth scroll is heading, so repeated key presses build on it instead of the old position
let pendingMoment = null;
const baseMoment = () => (pendingMoment ?? state.moment);

function goToMoment(t, smooth = true) {
  if (!tlGeom) return;
  const target = clamp(t, tlGeom.t0, tlGeom.t1);
  pendingMoment = smooth && !reducedMotion() ? target : null;
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
    if (pendingMoment !== null && Math.abs(state.moment - pendingMoment) < 60) pendingMoment = null;
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
  const t = resetMoment || !keep ? state.points[0].dt : clamp(keep, tlGeom.t0, tlGeom.t1);
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

// Everything that follows the timeline
function renderMoment() {
  if (!state.current || !state.points.length) return;
  const t = state.moment || state.points[0].dt;
  const isNow = t <= state.points[0].dt + NOW_WINDOW;
  const p = pointAt(t);
  const day = dayFor(t);
  const shortWhen = isNow ? 'Now' : `${fmtDay(t)} ${fmtTime(t)}`;

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
  if (!isNow) el.momentLabel.textContent = `${fmtDay(t, { weekday: 'long' })}, ${fmtTime(t)}`;

  const advisory = buildAdvisory(p);
  el.advisory.hidden = !advisory;
  if (advisory) {
    el.advisoryTitle.textContent = advisory.title;
    el.advisoryText.textContent = advisory.text;
  }
  renderSky(t, p);
  if (isNow) {
    const name = (state.place && state.place.name) || state.current.name;
    document.title = `${name} ${units.deg(state.current.main.temp)} — SkyPulse`;
  }

  // Timeline cursor
  el.tlCursorLabel.textContent = shortWhen;
  el.tlNow.setAttribute('aria-pressed', String(isNow));
  const hours = Math.round((t - state.points[0].dt) / 3600);
  el.tlScroller.setAttribute('aria-valuenow', String(hours));
  el.tlScroller.setAttribute('aria-valuetext', `${isNow ? 'Now' : `${fmtDay(t, { weekday: 'long' })} ${fmtTime(t)}`}, ${units.deg(p.temp)}, ${p.weather.description}`);
  const dot = document.getElementById('tl-dot');
  if (dot && tlGeom) {
    dot.setAttribute('cx', tlGeom.x(t).toFixed(1));
    dot.setAttribute('cy', tlGeom.y(p.temp).toFixed(1));
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
    const loading = isNow ? !state.air : !state.airForecast;
    el.aqiPollutants.innerHTML = `<div><dt>Status</dt><dd>${loading ? 'Loading' : isNow ? 'Unavailable' : 'Not forecast this far ahead'}</dd></div>`;
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
el.pdfBtn.addEventListener('click', async () => {
  if (!state.current) return;
  if (typeof html2pdf === 'undefined') {
    toast('The PDF tool is still loading. Try again in a moment.');
    return;
  }
  const cur = state.current;
  const name = (state.place && state.place.name) || cur.name;
  const now = nowSec();
  const aqiEntry = state.air && state.air.list && state.air.list[0];
  const aqi = aqiEntry ? usAqi(aqiEntry.components.pm2_5) : null;
  const p0 = state.points[0];

  const rows = [
    ['Feels like', units.deg(cur.main.feels_like)],
    ['Humidity', `${cur.main.humidity}%`],
    ['Wind', `${units.wind(cur.wind.speed)} ${units.windUnit()}${isNum(cur.wind.deg) ? ` from ${cardinal(cur.wind.deg)}` : ''}`],
    ['Pressure', `${units.pressure(cur.main.pressure)} ${units.pressureUnit()}`],
    ['Visibility', units.distance(cur.visibility)],
    ['UV index', isNum(state.uvi) ? Math.round(state.uvi) : 'Unavailable'],
    ['Air quality (US AQI)', aqi ?? 'Unavailable'],
    ['Sunrise / sunset', `${fmtTime(cur.sys.sunrise)} / ${fmtTime(cur.sys.sunset)}`]
  ];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-10000px;top:0';
  wrap.innerHTML = `
    <div class="pdf-report">
      <header>
        <div>
          <h1>${esc(name)}, ${esc(countryName(cur.sys.country))}</h1>
          <div class="pdf-muted">${esc(fmtDay(now, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))} · ${esc(fmtTime(now))} local time</div>
        </div>
        <div class="pdf-muted">SkyPulse weather report</div>
      </header>
      <div class="pdf-now">
        <div>
          <div class="pdf-temp">${units.deg(cur.main.temp)}</div>
          <div style="text-transform:capitalize;font-weight:600">${esc(cur.weather[0].description)}</div>
        </div>
        <div class="pdf-muted" style="max-width:340px;text-align:right">${esc(buildSummary(p0.dt, p0, true))}</div>
      </div>
      <h2>Current conditions</h2>
      <table><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      <h2>5-day forecast</h2>
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
  if (state.moment <= state.points[0].dt + NOW_WINDOW) renderMoment();
}, 60000);

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
  updateTopbar();
  renderPlaces();
  const last = store.get('lastPlace');
  loadPlace(last && last.name ? placeFromRecord(last) : DEFAULT_PLACE);
  registerServiceWorker();
}

init();
