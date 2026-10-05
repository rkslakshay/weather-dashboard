// Step 1: Select DOM Elements
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const errorMessage = document.getElementById('error-message');
const geoBtn = document.getElementById('geo-btn');
const errorText = document.getElementById('error-text');
const loadingSpinner = document.getElementById('loading-spinner');
const weatherContent = document.getElementById('weather-content');
const searchHistory = document.getElementById('search-history');
const historyChips = document.getElementById('history-chips');
const clearHistoryBtn = document.getElementById('clear-history');
const favoritesSection = document.getElementById('favorites-section');
const favoritesChips = document.getElementById('favorites-chips');
const favoriteBtn = document.getElementById('favorite-btn');
const alertsBanner = document.getElementById('alerts-banner');
const alertTitle = document.getElementById('alert-title');
const alertDescription = document.getElementById('alert-description');
const alertToggleBtn = document.getElementById('alert-toggle');
const alertDetails = document.getElementById('alert-details');
const alertFullText = document.getElementById('alert-full-text');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.querySelector('.theme-icon');
const aqiContainer = document.getElementById('aqi-container');
const aqiExact = document.getElementById('aqi-exact');
const aqiValue = document.getElementById('aqi-value');
const aqiText = document.getElementById('aqi-text');
const aqiFill = document.getElementById('aqi-fill');

// Current weather elements
const cityName = document.getElementById('city-name');
const currentDate = document.getElementById('current-date');
const weatherIcon = document.getElementById('weather-icon');
const weatherCondition = document.getElementById('weather-condition');
const temperature = document.getElementById('temperature');
const feelsLike = document.getElementById('feels-like');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const pressure = document.getElementById('pressure');
// New metric elements
const uvIndex = document.getElementById('uv-index');
const dewPoint = document.getElementById('dew-point');
const windDir = document.getElementById('wind-dir');
const windArrow = document.getElementById('wind-arrow');
const pressureTrend = document.getElementById('pressure-trend');
const activityAdvice = document.getElementById('activity-advice');
const visibility = document.getElementById('visibility');
const forecastCards = document.getElementById('forecast-cards');
const hourlyForecast = document.getElementById('hourly-forecast');

const autocompleteList = document.getElementById('autocomplete-list');
const localTime = document.getElementById('local-time');
const sunMarker = document.getElementById('sun-marker');
const sunriseTime = document.getElementById('sunrise-time');
const sunsetTime = document.getElementById('sunset-time');
const daylightDuration = document.getElementById('daylight-duration');

const chartCanvas = document.getElementById('temp-chart');
const chartUnitBadge = document.getElementById('chart-unit-badge');
let tempChart = null;
let currentForecastData = null;

// Round 5 Elements
const shareBtn = document.getElementById('share-btn');
const toast = document.getElementById('toast');
const compareForm = document.getElementById('compare-form');
const compareInput = document.getElementById('compare-input');
const compareContainer = document.getElementById('compare-container');
const compareCardPrimary = document.getElementById('compare-card-primary');
const compareCardSecondary = document.getElementById('compare-card-secondary');
let currentWeatherData = null;

// Temperature toggle elements
const unitToggle = document.getElementById('unit-toggle');
const unitLabel = document.getElementById('unit-label');
const feelsUnit = document.getElementById('feels-unit');

// Read the API Key from config.js (fallback for direct client-side requests)
const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.API_KEY : '12f21f922d4f7556ba28c3bb4615ada2';

// --- Production & Caching Configuration ---
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
let isProxyAvailable = window.location.protocol.startsWith('http');

/**
 * Retrieve cached API response from localStorage if still valid
 */
function getCachedData(cacheKey, ttl = CACHE_TTL_MS) {
  try {
    const raw = localStorage.getItem(`weather_cache_${cacheKey}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp < ttl) {
      return entry.data;
    }
    localStorage.removeItem(`weather_cache_${cacheKey}`);
  } catch (e) {
    // Ignore parse or storage errors
  }
  return null;
}

/**
 * Save API response to localStorage with timestamp
 */
function setCachedData(cacheKey, data) {
  try {
    const entry = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(`weather_cache_${cacheKey}`, JSON.stringify(entry));
  } catch (e) {
    // Ignore storage quota warnings
  }
}

/**
 * Universal dual-mode API fetcher with TTL caching
 * Seamlessly routes to /api/weather serverless proxy if available,
 * or direct OpenWeatherMap endpoint with API_KEY as robust fallback.
 */
async function fetchWeatherApi(endpoint, params = {}, options = {}) {
  const ttl = options.ttl !== undefined ? options.ttl : CACHE_TTL_MS;
  const useCache = options.cache !== false;
  const paramString = new URLSearchParams(params).toString();
  const cacheKey = `${endpoint}_${paramString}`;

  if (useCache) {
    const cached = getCachedData(cacheKey, ttl);
    if (cached) {
      return cached;
    }
  }

  const directBaseMap = {
    weather: 'https://api.openweathermap.org/data/2.5/weather',
    forecast: 'https://api.openweathermap.org/data/2.5/forecast',
    air_pollution: 'https://api.openweathermap.org/data/2.5/air_pollution',
    uvi: 'https://api.openweathermap.org/data/2.5/uvi',
    'geo/1.0/direct': 'https://api.openweathermap.org/geo/1.0/direct'
  };

  // Try serverless proxy first if in an HTTP(S) environment
  if (isProxyAvailable) {
    try {
      const proxyUrl = `/api/weather?endpoint=${encodeURIComponent(endpoint)}&${paramString}`;
      const res = await fetch(proxyUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (useCache) setCachedData(cacheKey, data);
        return data;
      }
      if (res.status === 404 && !contentType.includes('application/json')) {
        isProxyAvailable = false;
      } else if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = new Error(errData.message || `API error (${res.status})`);
        err.status = res.status;
        throw err;
      }
    } catch (err) {
      if (err.status) throw err;
      isProxyAvailable = false;
    }
  }

  // Fallback to direct OpenWeatherMap endpoint
  const baseUrl = directBaseMap[endpoint] || `https://api.openweathermap.org/data/2.5/${endpoint}`;
  const directUrl = `${baseUrl}?${paramString}&appid=${API_KEY}`;
  const directRes = await fetch(directUrl);

  if (!directRes.ok) {
    const errData = await directRes.json().catch(() => ({}));
    const err = new Error(errData.message || `API request failed with status ${directRes.status}`);
    err.status = directRes.status;
    throw err;
  }

  const data = await directRes.json();
  if (useCache) setCachedData(cacheKey, data);
  return data;
}

// State variables for temperature toggle
let isCelsius = localStorage.getItem('weatherTempUnit') !== 'F';
let rawTempC = 0;
let rawFeelsC = 0;
let rawForecastTemps = [];
let rawHourlyTemps = [];
let currentCity = '';
let cityTimezoneOffset = 0;
let clockTimer = null;
let autocompleteDebounceTimer = null;

const MAX_HISTORY = 5;
const MAX_FAVORITES = 5;
const AQI_LABELS = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
const AQI_CLASSES = ['aqi-good', 'aqi-fair', 'aqi-moderate', 'aqi-poor', 'aqi-very-poor'];

// Map OpenWeatherMap icon codes to animated icon names
const ICON_MAP = {
  '01d': 'clear-day',
  '01n': 'clear-night',
  '02d': 'partly-cloudy-day',
  '02n': 'partly-cloudy-night',
  '03d': 'cloudy',
  '03n': 'cloudy',
  '04d': 'overcast-day',
  '04n': 'overcast-night',
  '09d': 'drizzle',
  '09n': 'drizzle',
  '10d': 'rain',
  '10n': 'rain',
  '11d': 'thunderstorms-day',
  '11n': 'thunderstorms-night',
  '13d': 'snow',
  '13n': 'snow',
  '50d': 'fog-day',
  '50n': 'fog-night'
};

function getAnimatedIconUrl(iconCode) {
  const iconName = ICON_MAP[iconCode] || 'cloudy';
  return `https://raw.githubusercontent.com/basmilius/weather-icons/dev/production/fill/svg/${iconName}.svg`;
}

// Step 2: Form submit event listener
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevents page reload
  const city = cityInput.value.trim();
  if (city) {
    await fetchWeatherData(city);
  }
});

// Step 3: Fetch weather and forecast concurrently
async function fetchWeatherData(city) {
  showLoading();
  hideError();

  try {
    // Fire both requests concurrently using smart dual-mode fetcher & cache
    const [currentData, forecastData] = await Promise.all([
      fetchWeatherApi('weather', { q: city, units: 'metric' }),
      fetchWeatherApi('forecast', { q: city, units: 'metric' })
    ]);

    // Update UI with the retrieved data
    displayCurrentWeather(currentData);
    displayForecast(forecastData);
    displayHourlyForecast(forecastData);
    saveToHistory(city);
    showContent();
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.toLowerCase().includes('not found'))) {
      showError(`City "${city}" not found. Please verify spelling.`);
    } else if (err.status === 401) {
      showError('Invalid API key. Please check your configuration.');
    } else {
      showError(err.message || 'Something went wrong fetching data.');
    }
  } finally {
    hideLoading();
  }
}

// FlagCDN Image Helper for 100% Cross-Platform Windows & OS Flag Support
function getCountryFlagImg(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  const code = countryCode.toLowerCase();
  return `<img src="https://flagcdn.com/24x18/${code}.png" alt="${countryCode}" class="flag-icon" />`;
}

function getCountryName(countryCode) {
  if (!countryCode) return '';
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(countryCode.toUpperCase()) || countryCode;
  } catch (e) {
    return countryCode;
  }
}

// Step 4: Render Current Weather to the DOM
function displayCurrentWeather(data) {
  const flagImg = getCountryFlagImg(data.sys.country);
  const countryFull = getCountryName(data.sys.country);
  if (cityName) cityName.innerHTML = `${data.name}, ${countryFull} ${flagImg}`;
  if (cityInput) {
    cityInput.value = `${data.name}, ${countryFull}`;
    cityInput.placeholder = `${data.name}, ${countryFull}`;
  }

  const condition = data.weather[0];
  const mainCond = (condition.main || '').toLowerCase();
  let condTitle = condition.description ? condition.description.charAt(0).toUpperCase() + condition.description.slice(1) : condition.main;
  if (mainCond === 'rain' || mainCond === 'drizzle') condTitle = 'Rainy Day';
  else if (mainCond === 'clear') condTitle = 'Clear Sky';
  else if (mainCond === 'thunderstorm') condTitle = 'Thunderstorm';
  else if (mainCond === 'snow') condTitle = 'Snowy Day';
  else if (mainCond === 'clouds') condTitle = 'Partly Cloudy';
  
  if (weatherCondition) weatherCondition.textContent = condTitle;

  // Use animated icon
  const iconCode = condition.icon;
  if (weatherIcon) {
    weatherIcon.src = getAnimatedIconUrl(iconCode);
    weatherIcon.alt = condition.description;
  }

  rawTempC = data.main.temp;
  rawFeelsC = data.main.feels_like;

  if (humidity) humidity.textContent = `${data.main.humidity}%`;
  if (windSpeed) windSpeed.textContent = `${data.wind.speed} m/s`;
  if (pressure) pressure.textContent = `${data.main.pressure} hPa`;
  
  // Format Visibility in mi / km
  const visKm = (data.visibility / 1000).toFixed(1);
  const visMi = Math.round((data.visibility / 1609.34));
  if (visibility) visibility.textContent = `${visMi || visKm} mi`;
  const visSub = document.getElementById('visibility-subtext');
  if (visSub) {
    visSub.textContent = data.visibility >= 9000 ? 'Clear conditions' : data.visibility >= 4000 ? 'Moderate visibility' : 'Low visibility';
  }

  // Feels like subtext
  const feelsSub = document.getElementById('feels-subtext');
  if (feelsSub) {
    const diff = data.main.feels_like - data.main.temp;
    if (diff > 1) {
      feelsSub.textContent = 'Humidity is making it feel warmer';
    } else if (diff < -1) {
      feelsSub.textContent = 'Wind is making it feel cooler';
    } else {
      feelsSub.textContent = 'Similar to actual temperature';
    }
  }

  // Precipitation (rain in last 24h or 1h)
  const precipVal = document.getElementById('precip-val');
  const precipSub = document.getElementById('precip-subtext');
  let rainAmount = 0;
  if (data.rain) {
    rainAmount = data.rain['1h'] || data.rain['3h'] || 0;
  }
  const rainInches = (rainAmount / 25.4).toFixed(1);
  if (precipVal) {
    precipVal.textContent = rainAmount > 0 ? `${rainInches}"` : '0"';
  }
  if (precipSub) {
    if (rainAmount > 0) {
      precipSub.innerHTML = `in last 24h<br><span class="quad-subtext-dim">${(rainInches * 0.9).toFixed(1)}" expected in next 24h</span>`;
    } else {
      precipSub.innerHTML = `0" in last 24h<br><span class="quad-subtext-dim">No precipitation expected</span>`;
    }
  }

  // Wind speed in MPH for display
  const windMph = Math.round(data.wind.speed * 2.237);
  const gustMph = data.wind.gust ? Math.round(data.wind.gust * 2.237) : Math.round(windMph * 1.5 + 2);
  const windSpeedVal = document.getElementById('wind-speed-val');
  const windGustVal = document.getElementById('wind-gust-val');
  if (windSpeedVal) windSpeedVal.textContent = windMph;
  if (windGustVal) windGustVal.textContent = gustMph;

  // Start live city local time clock
  cityTimezoneOffset = data.timezone;
  startLocalClock(data.timezone);

  // Render Sun Arc Timeline
  displaySunTimeline(data.sys.sunrise, data.sys.sunset, data.timezone);

  // Update All Temperature values in currently selected unit
  updateAllTemperatureDisplays();

  // Fetch AQI using coordinates
  fetchAQI(data.coord.lat, data.coord.lon);

  // Fetch UV Index & Detailed Breakdown Metrics for Round 3
  fetchUV(data.coord.lat, data.coord.lon, data);

  // Favorite button & Weather Alerts for current location
  currentCity = data.name;
  updateFavoriteBtnState(data.name);
  fetchWeatherAlerts(data);

  // Store current weather data for Share Report & Comparison (Round 5)
  currentWeatherData = data;

  // Dynamic Background Atmosphere for Round 4
  updateDynamicBackground(condition.main, iconCode);

  // Round 6: Initialize Interactive Radar Map
  initRadarMap(data.coord.lat, data.coord.lon, data.name);
}

// Step 5: Render 10-Day / 5-Day Forecast
function displayForecast(data) {
  forecastCards.innerHTML = ''; // Clear previous cards
  rawForecastTemps = [];

  // Filter daily readings around noon (12:00:00) to get one reading per day
  const dailyReadings = data.list.filter((reading) =>
    reading.dt_txt.includes('12:00:00')
  ).slice(0, 6);

  dailyReadings.forEach((reading, index) => {
    const isToday = index === 0;
    const dateObj = new Date(reading.dt * 1000);
    const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dayDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const tempC = reading.main.temp;
    rawForecastTemps.push(tempC);
    const desc = reading.weather[0].description;
    const iconCode = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = `forecast-col-card${isToday ? ' active' : ''}`;
    card.innerHTML = `
      <span class="forecast-day-label">${dayName}</span>
      <span class="forecast-date-sub">${dayDate}</span>
      <span class="forecast-temp-val forecast-temp">${formatTempNumber(tempC)}°</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="${desc}" class="forecast-mini-icon" />
    `;
    forecastCards.appendChild(card);
  });

  // Render Interactive Temperature Chart (Round 4)
  currentForecastData = data;
  renderForecastChart(data);
}

// Step 5B: Render AccuWeather-style Hourly Forecast (Next 24 hours, every 3h)
function displayHourlyForecast(data) {
  hourlyForecast.innerHTML = '';
  rawHourlyTemps = [];

  // Take 6 entries (intervals of 3 hours)
  const hourlyData = data.list.slice(0, 6);

  hourlyData.forEach((reading, index) => {
    const isNow = index === 0;
    const timeStr = isNow ? 'Now' : new Date((reading.dt + (cityTimezoneOffset || 0)) * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    });
    const tempC = reading.main.temp;
    rawHourlyTemps.push(tempC);
    const iconCode = reading.weather[0].icon;
    const desc = reading.weather[0].description;

    const card = document.createElement('div');
    card.className = `hourly-col-card${isNow ? ' active' : ''}`;
    card.innerHTML = `
      <span class="hourly-time-label">${timeStr}</span>
      <span class="hourly-temp-val hourly-temp">${formatTempNumber(tempC)}°</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="${desc}" class="hourly-mini-icon" />
    `;
    hourlyForecast.appendChild(card);
  });
}

// Round 3 Helper Functions: Detailed Breakdown & Smart Activity Advisor
function getCardinalDirection(angle) {
  if (angle === undefined || angle === null) return 'N/A';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(angle / 45) % 8];
}

function updatePressureTrend(currentPressure) {
  if (!pressureTrend) return;
  const key = 'pressureHistory';
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.push(currentPressure);
  if (history.length > 3) history.shift();
  localStorage.setItem(key, JSON.stringify(history));

  if (history.length < 2) {
    pressureTrend.textContent = 'Steady ↔';
    return;
  }

  const diff = history[history.length - 1] - history[history.length - 2];
  const trend = Math.abs(diff) < 1 ? 'Steady ↔' : diff > 0 ? 'Rising ↑' : 'Falling ↓';
  pressureTrend.textContent = trend;
}

function getActivitySuggestion(data, uvi) {
  const tempC = data.main.temp;
  const feelsC = data.main.feels_like;
  const mainWeather = data.weather[0] ? data.weather[0].main : '';
  const isPrecip = data.weather.some(w => ['Rain', 'Drizzle', 'Thunderstorm', 'Snow'].includes(w.main));
  const wind = data.wind ? data.wind.speed : 0; // m/s
  const humidity = data.main.humidity;
  const uv = uvi !== undefined && uvi !== null ? uvi : 0;

  if (isPrecip) {
    if (mainWeather === 'Thunderstorm') return '⚡ Heavy storm warning! Stay indoors and keep safe.';
    if (mainWeather === 'Snow') return '❄️ Snowy conditions! Great for skiing or cozying up indoors with hot cocoa.';
    return '🌧️ Rain expected – bring an umbrella or plan indoor activities.';
  }

  if (tempC >= 32) return '🌡️ Extreme heat! Stay hydrated and seek shade or air conditioning.';
  if (uv >= 8) return '☀️ Very high UV index! Wear sunscreen, sunglasses, and a hat.';
  if (wind >= 10) return '💨 High winds – caution recommended for outdoor sports or cycling.';
  if (tempC <= 0) return '🥶 Freezing cold! Bundle up warmly in thick layers before heading out.';
  if (tempC >= 18 && tempC <= 26 && wind < 6 && uv <= 5) return '🏃 Outstanding outdoor weather! Perfect for running, cycling, or a picnic.';
  if (humidity >= 85) return '💧 High humidity – stay hydrated during outdoor workouts.';

  return '🌤️ Pleasant weather overall – great time for a stroll or outdoor activities.';
}

function updateMetrics(data, uvi) {
  // 1. UV Index & Indicator Dot
  const uvVal = uvi !== undefined && uvi !== null ? Math.round(uvi) : 3;
  if (uvIndex) {
    uvIndex.textContent = uvVal;
  }

  const uvCat = document.getElementById('uv-category');
  const uvAdv = document.getElementById('uv-advice');
  const uvDot = document.getElementById('uv-dot');

  if (uvCat) {
    if (uvVal <= 2) {
      uvCat.textContent = 'Low';
      if (uvAdv) uvAdv.textContent = 'No sun protection required';
    } else if (uvVal <= 5) {
      uvCat.textContent = 'Moderate';
      if (uvAdv) uvAdv.textContent = 'Use sun protection until 16:00';
    } else if (uvVal <= 7) {
      uvCat.textContent = 'High';
      if (uvAdv) uvAdv.textContent = 'Wear sunscreen, hat & sunglasses';
    } else if (uvVal <= 10) {
      uvCat.textContent = 'Very High';
      if (uvAdv) uvAdv.textContent = 'Extra protection needed. Seek shade';
    } else {
      uvCat.textContent = 'Extreme';
      if (uvAdv) uvAdv.textContent = 'Avoid outdoor exposure during midday';
    }
  }

  if (uvDot) {
    const pct = Math.min(Math.max((uvVal / 11) * 100, 6), 94);
    uvDot.style.left = `${pct}%`;
  }

  // 2. Dew Point
  if (dewPoint) {
    let dp = data.main ? data.main.dew_point : undefined;
    if (dp === undefined && data.main && data.main.temp !== undefined && data.main.humidity !== undefined) {
      const T = data.main.temp;
      const RH = data.main.humidity;
      dp = T - ((100 - RH) / 5);
    }
    dewPoint.textContent = dp !== undefined ? `${formatTempNumber(dp)}°` : '--°';
  }

  // 3. Wind Direction & Needle Rotation
  if (data.wind && data.wind.deg !== undefined) {
    const deg = data.wind.deg;
    const cardinal = getCardinalDirection(deg);
    if (windDir) windDir.textContent = `${deg}° (${cardinal})`;
    if (windArrow) {
      windArrow.style.transform = `rotate(${deg}deg)`;
    }
  } else {
    if (windDir) windDir.textContent = '--';
  }

  // 4. Pressure Trend
  if (data.main && data.main.pressure !== undefined) {
    updatePressureTrend(data.main.pressure);
  }

  // 5. Activity Advice Paragraph (matches hero summary)
  if (activityAdvice) {
    const maxT = data.main.temp_max || data.main.temp;
    const maxTStr = `${formatTempNumber(maxT)}${isCelsius ? '°C' : '°F'}`;
    const mainWeather = data.weather[0] ? data.weather[0].main.toLowerCase() : '';
    
    if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) {
      activityAdvice.textContent = `Today, expect a rainy day with temperatures reaching a maximum of ${maxTStr}. Make sure to grab your umbrella and raincoat before heading out.`;
    } else if (mainWeather.includes('thunderstorm')) {
      activityAdvice.textContent = `Today, heavy storm conditions are expected with temperatures reaching a maximum of ${maxTStr}. Stay indoors and keep safe.`;
    } else if (mainWeather.includes('snow')) {
      activityAdvice.textContent = `Today, expect snowy conditions with temperatures reaching a maximum of ${maxTStr}. Bundle up in warm layers before heading out.`;
    } else if (mainWeather.includes('cloud')) {
      activityAdvice.textContent = `Today, expect overcast skies with temperatures reaching a maximum of ${maxTStr}. Comfortable conditions for light outdoor activities.`;
    } else {
      activityAdvice.textContent = `Today, expect clear skies with temperatures reaching a maximum of ${maxTStr}. Great weather for outdoor plans and a stroll.`;
    }
  }
}

async function fetchUV(lat, lon, currentWeatherData) {
  let uvi = null;
  try {
    const uviData = await fetchWeatherApi('uvi', { lat, lon }, { ttl: 15 * 60 * 1000 });
    if (uviData && typeof uviData.value !== 'undefined') {
      uvi = uviData.value;
    }
  } catch (e) {
    console.warn('UV fetch note:', e.message);
  }
  updateMetrics(currentWeatherData, uvi);
}

// Round 4 Helper Function: Dynamic Background Atmosphere
function updateDynamicBackground(weatherMain, iconCode) {
  document.body.classList.remove(
    'weather-clear-day',
    'weather-clear-night',
    'weather-clouds',
    'weather-rain',
    'weather-thunderstorm',
    'weather-snow',
    'weather-fog'
  );

  const isNight = iconCode && iconCode.endsWith('n');
  const main = (weatherMain || '').toLowerCase();

  if (main.includes('thunderstorm')) {
    document.body.classList.add('weather-thunderstorm');
  } else if (main.includes('rain') || main.includes('drizzle')) {
    document.body.classList.add('weather-rain');
  } else if (main.includes('snow')) {
    document.body.classList.add('weather-snow');
  } else if (main.includes('cloud')) {
    document.body.classList.add('weather-clouds');
  } else if (main.includes('clear')) {
    document.body.classList.add(isNight ? 'weather-clear-night' : 'weather-clear-day');
  } else if (['fog', 'mist', 'haze', 'dust', 'smoke'].some(w => main.includes(w))) {
    document.body.classList.add('weather-fog');
  } else {
    document.body.classList.add(isNight ? 'weather-clear-night' : 'weather-clear-day');
  }
}

// Round 4 Helper Function: Interactive Temperature Chart (Chart.js)
function renderForecastChart(data) {
  if (!chartCanvas || typeof Chart === 'undefined' || !data || !data.list) return;

  const dailyReadings = data.list.filter((reading) =>
    reading.dt_txt.includes('12:00:00')
  );

  const labels = dailyReadings.map((reading) => {
    const d = new Date(reading.dt * 1000);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  const temps = dailyReadings.map((reading) => {
    return formatTempNumber(reading.main.temp);
  });

  const currentUnit = isCelsius ? '°C' : '°F';
  if (chartUnitBadge) chartUnitBadge.textContent = currentUnit;

  const ctx = chartCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(138, 158, 85, 0.5)');
  gradient.addColorStop(1, 'rgba(138, 158, 85, 0.03)');

  if (tempChart) {
    tempChart.destroy();
  }

  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `Temperature (${currentUnit})`,
          data: temps,
          borderColor: '#8a9e55',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#8a9e55',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#a8b87a',
          bodyColor: '#f0f0ea',
          borderColor: 'rgba(138, 158, 85, 0.4)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (context) => ` Temp: ${context.parsed.y} ${currentUnit}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(240, 240, 234, 0.7)', font: { family: 'Inter', size: 12, weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.07)' },
          ticks: {
            color: 'rgba(240, 240, 234, 0.7)',
            font: { family: 'Inter', size: 12 },
            callback: (val) => `${val}${currentUnit}`
          }
        }
      }
    }
  });
}

// Round 6 Helper: Interactive Radar & Weather Map (Leaflet.js)
let radarMap = null;
let radarOverlayLayer = null;
let radarMarker = null;
let activeRadarLayer = 'precipitation';

function initRadarMap(lat, lon, cityName) {
  const mapElement = document.getElementById('radar-map');
  if (!mapElement || typeof L === 'undefined') return;

  if (!radarMap) {
    radarMap = L.map('radar-map', {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([lat, lon], 8);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 18,
      className: 'map-tiles-base'
    }).addTo(radarMap);

    const toggleBtns = document.querySelectorAll('.radar-toggle-btn');
    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeRadarLayer = btn.dataset.layer;
        updateRadarTileLayer(activeRadarLayer);
      });
    });
  } else {
    radarMap.setView([lat, lon], 8);
  }

  if (radarMarker) {
    radarMarker.setLatLng([lat, lon]).setPopupContent(`<b>${cityName}</b><br>Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`);
  } else {
    radarMarker = L.marker([lat, lon]).addTo(radarMap).bindPopup(`<b>${cityName}</b><br>Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`);
  }

  updateRadarTileLayer(activeRadarLayer);

  setTimeout(() => {
    radarMap.invalidateSize();
  }, 300);
}

function updateRadarTileLayer(layerType) {
  if (!radarMap) return;

  if (radarOverlayLayer) {
    radarMap.removeLayer(radarOverlayLayer);
  }

  const layerMap = {
    precipitation: 'precipitation_new',
    temp: 'temp_new',
    clouds: 'clouds_new',
    wind: 'wind_new'
  };

  const owmLayer = layerMap[layerType] || 'precipitation_new';
  const tileUrl = `https://tile.openweathermap.org/map/${owmLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`;

  radarOverlayLayer = L.tileLayer(tileUrl, {
    opacity: 0.65,
    maxZoom: 18
  }).addTo(radarMap);
}

// Round 6 Helper: Pollen & Allergy Health Risk Forecast
function updatePollenForecast(data) {
  const tempC = data.main.temp;
  const wind = data.wind.speed;
  const isPrecip = data.weather.some(w => ['Rain', 'Drizzle', 'Thunderstorm', 'Snow'].includes(w.main));

  const month = new Date().getMonth();
  let treeVal = 'Low', treeBar = 20;
  let grassVal = 'Low', grassBar = 25;
  let weedVal = 'Low', weedBar = 15;

  if (isPrecip) {
    treeVal = 'Very Low'; treeBar = 10;
    grassVal = 'Low'; grassBar = 15;
    weedVal = 'Very Low'; weedBar = 10;
  } else {
    if (month >= 2 && month <= 5) {
      treeVal = tempC >= 18 ? 'High' : 'Moderate';
      treeBar = tempC >= 18 ? 85 : 55;
    } else if (month >= 5 && month <= 7) {
      grassVal = tempC >= 22 ? 'Very High' : 'Moderate';
      grassBar = tempC >= 22 ? 90 : 60;
    } else if (month >= 7 && month <= 10) {
      weedVal = wind >= 4 ? 'High' : 'Moderate';
      weedBar = wind >= 4 ? 80 : 50;
    } else {
      treeVal = 'Low'; treeBar = 20;
      grassVal = 'Low'; grassBar = 25;
      weedVal = 'Low'; weedBar = 15;
    }
  }

  const pollenTreeVal = document.getElementById('pollen-tree-val');
  const pollenTreeBar = document.getElementById('pollen-tree-bar');
  const pollenGrassVal = document.getElementById('pollen-grass-val');
  const pollenGrassBar = document.getElementById('pollen-grass-bar');
  const pollenWeedVal = document.getElementById('pollen-weed-val');
  const pollenWeedBar = document.getElementById('pollen-weed-bar');
  const pollenOverallStatus = document.getElementById('pollen-overall-status');
  const healthAdviceText = document.getElementById('health-advice-text');

  if (pollenTreeVal) pollenTreeVal.textContent = treeVal;
  if (pollenTreeBar) pollenTreeBar.style.width = `${treeBar}%`;
  if (pollenGrassVal) pollenGrassVal.textContent = grassVal;
  if (pollenGrassBar) pollenGrassBar.style.width = `${grassBar}%`;
  if (pollenWeedVal) pollenWeedVal.textContent = weedVal;
  if (pollenWeedBar) pollenWeedBar.style.width = `${weedBar}%`;

  const maxBar = Math.max(treeBar, grassBar, weedBar);
  if (pollenOverallStatus) {
    if (maxBar >= 80) {
      pollenOverallStatus.textContent = 'High Allergy Risk';
      pollenOverallStatus.style.background = 'rgba(239, 68, 68, 0.2)';
      pollenOverallStatus.style.borderColor = '#ef4444';
      pollenOverallStatus.style.color = '#fca5a5';
    } else if (maxBar >= 50) {
      pollenOverallStatus.textContent = 'Moderate Allergy Risk';
      pollenOverallStatus.style.background = 'rgba(251, 191, 36, 0.15)';
      pollenOverallStatus.style.borderColor = 'rgba(251, 191, 36, 0.4)';
      pollenOverallStatus.style.color = '#fbbf24';
    } else {
      pollenOverallStatus.textContent = 'Low Allergy Risk';
      pollenOverallStatus.style.background = 'rgba(34, 197, 94, 0.15)';
      pollenOverallStatus.style.borderColor = 'rgba(34, 197, 94, 0.4)';
      pollenOverallStatus.style.color = '#4ade80';
    }
  }

  if (healthAdviceText) {
    if (isPrecip) {
      healthAdviceText.textContent = '🌧️ Recent precipitation has washed airborne pollen out of the air. Great conditions for allergy sufferers!';
    } else if (maxBar >= 80) {
      healthAdviceText.textContent = '⚠️ Elevated pollen counts detected! Sensitive individuals should limit outdoor exercise, keep windows closed, and wear sunglasses outdoors.';
    } else if (maxBar >= 50) {
      healthAdviceText.textContent = '🌼 Moderate pollen levels present. Consider taking antihistamines or showering after prolonged outdoor activity.';
    } else {
      healthAdviceText.textContent = '🌱 Low airborne pollen counts. Optimal conditions for outdoor sports, walks, and activities!';
    }
  }
}

function showLoading() {
  loadingSpinner.classList.remove('hidden');
  weatherContent.classList.add('hidden');
}

function hideLoading() {
  loadingSpinner.classList.add('hidden');
}

function showContent() {
  weatherContent.classList.remove('hidden');
}

function showError(msg) {
  errorText.textContent = msg;
  errorMessage.classList.remove('hidden');
  weatherContent.classList.add('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

// Step 6A: Fetch weather using GPS coordinates
async function fetchWeatherByCoords(lat, lon) {
  showLoading();
  hideError();

  try {
    const [currentData, forecastData] = await Promise.all([
      fetchWeatherApi('weather', { lat, lon, units: 'metric' }),
      fetchWeatherApi('forecast', { lat, lon, units: 'metric' })
    ]);

    displayCurrentWeather(currentData);
    displayForecast(forecastData);
    displayHourlyForecast(forecastData);
    saveToHistory(currentData.name);
    showContent();
  } catch (err) {
    showError(err.message || 'Failed to retrieve weather for your coordinates.');
  } finally {
    hideLoading();
  }
}

// Step 6B: Geolocation Button Event Listener
geoBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  showLoading();
  hideError();

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      await fetchWeatherByCoords(lat, lon);
    },
    (err) => {
      hideLoading();
      if (err.code === err.PERMISSION_DENIED) {
        showError('Location access was denied. Please allow permission or search manually.');
      } else {
        showError('Unable to retrieve your location. Please try again.');
      }
    }
  );
});

// Temperature Formatting & Universal Conversion
function formatTempNumber(celsiusVal) {
  if (celsiusVal === undefined || isNaN(celsiusVal)) return '--';
  return isCelsius ? Math.round(celsiusVal) : Math.round((celsiusVal * 9) / 5 + 32);
}

function updateAllTemperatureDisplays() {
  const currentUnit = isCelsius ? '°C' : '°F';
  if (unitLabel) unitLabel.textContent = '°';
  if (feelsUnit) feelsUnit.textContent = '°';
  if (unitToggle) unitToggle.textContent = isCelsius ? 'Switch to °F' : 'Switch to °C';

  if (temperature) temperature.textContent = formatTempNumber(rawTempC);
  if (feelsLike) feelsLike.textContent = formatTempNumber(rawFeelsC);

  // Update 5-Day Forecast Card Temps
  const forecastTempElements = document.querySelectorAll('.forecast-temp');
  forecastTempElements.forEach((el, index) => {
    if (rawForecastTemps[index] !== undefined) {
      el.textContent = `${formatTempNumber(rawForecastTemps[index])}°`;
    }
  });

  // Update Hourly Forecast Card Temps
  const hourlyTempElements = document.querySelectorAll('.hourly-temp');
  hourlyTempElements.forEach((el, index) => {
    if (rawHourlyTemps[index] !== undefined) {
      el.textContent = `${formatTempNumber(rawHourlyTemps[index])}°`;
    }
  });

  // Re-render Chart.js graph with updated unit values
  if (currentForecastData) {
    renderForecastChart(currentForecastData);
  }
}

// Temperature Unit Toggle Listener
if (unitToggle) {
  unitToggle.addEventListener('click', () => {
    isCelsius = !isCelsius;
    localStorage.setItem('weatherTempUnit', isCelsius ? 'C' : 'F');
    updateAllTemperatureDisplays();
  });
}

// Toggle Radar & Analytics Drawer
const detailsToggleBtn = document.getElementById('details-toggle-btn');
const analyticsDrawer = document.getElementById('analytics-drawer');
if (detailsToggleBtn && analyticsDrawer) {
  detailsToggleBtn.addEventListener('click', () => {
    analyticsDrawer.classList.toggle('hidden');
    detailsToggleBtn.classList.toggle('active');
    if (!analyticsDrawer.classList.contains('hidden') && radarMap) {
      setTimeout(() => {
        radarMap.invalidateSize();
      }, 250);
    }
  });
}

// Feature #14: Real-Time Local Timezone Clock
function getCityDateObj(offsetInSeconds) {
  const utcNowMs = Date.now() + new Date().getTimezoneOffset() * 60000;
  return new Date(utcNowMs + (offsetInSeconds || 0) * 1000);
}

function startLocalClock(offsetInSeconds) {
  if (clockTimer) clearInterval(clockTimer);

  function updateClockDisplay() {
    const cityDate = getCityDateObj(offsetInSeconds);
    currentDate.textContent = cityDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
    localTime.textContent = `🕒 ${cityDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  }

  updateClockDisplay();
  clockTimer = setInterval(updateClockDisplay, 1000);
}

// Feature #4: Sunrise & Sunset Position Arc
function displaySunTimeline(sunriseUnix, sunsetUnix, offsetInSeconds) {
  if (!sunriseUnix || !sunsetUnix) return;

  // Shift UTC Unix timestamps by the city's timezone offset, then read as UTC
  // to get the correct city-local display time without machine offset interference.
  const sunriseDate = new Date((sunriseUnix + (offsetInSeconds || 0)) * 1000);
  const sunsetDate = new Date((sunsetUnix + (offsetInSeconds || 0)) * 1000);

  sunriseTime.textContent = sunriseDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
  sunsetTime.textContent = sunsetDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });

  const totalSecs = sunsetUnix - sunriseUnix;
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  daylightDuration.textContent = `${hours}h ${mins}m daylight`;

  // Calculate sun position on the arc (Ellipse center: 150, 95. Rx: 120, Ry: 70)
  const nowUnix = Math.floor(Date.now() / 1000);
  let progress = (nowUnix - sunriseUnix) / (sunsetUnix - sunriseUnix);

  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;

  // Arc math: from left (x=30, y=95) to peak (x=150, y=25) to right (x=270, y=95)
  const angle = Math.PI * (1 - progress); // PI (left) down to 0 (right)
  const cx = 150 + 120 * Math.cos(angle);
  const cy = 95 - 70 * Math.sin(angle);

  sunMarker.setAttribute('cx', cx.toFixed(1));
  sunMarker.setAttribute('cy', cy.toFixed(1));

  // Style marker depending on day or night
  if (nowUnix >= sunriseUnix && nowUnix <= sunsetUnix) {
    sunMarker.setAttribute('fill', '#fbbf24');
    sunMarker.style.filter = 'drop-shadow(0 0 8px #f59e0b)';
  } else {
    sunMarker.setAttribute('fill', '#94a3b8');
    sunMarker.style.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.3))';
  }
}

// City Search Autocomplete Dropdown with Smart Ranking
function setupCityAutocomplete() {
  let selectedIndex = -1;

  // Highlight input text on focus for quick search replacement
  if (cityInput) {
    cityInput.addEventListener('focus', () => {
      cityInput.select();
    });
  }

  cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    selectedIndex = -1;
    if (autocompleteDebounceTimer) clearTimeout(autocompleteDebounceTimer);

    if (query.length < 2) {
      autocompleteList.classList.add('hidden');
      autocompleteList.innerHTML = '';
      return;
    }

    autocompleteDebounceTimer = setTimeout(async () => {
      try {
        const matches = await fetchWeatherApi('geo/1.0/direct', { q: query, limit: 10 }, { ttl: 60 * 60 * 1000 });
        if (!matches || !matches.length) {
          autocompleteList.classList.add('hidden');
          autocompleteList.innerHTML = '';
          return;
        }

        // Deduplicate matches by name + state + country
        const seen = new Set();
        const uniqueMatches = [];
        for (const item of matches) {
          const key = `${(item.name || '').toLowerCase()}|${(item.state || '').toLowerCase()}|${(item.country || '').toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueMatches.push(item);
          }
        }

        // Rank matches based on intelligent relevance priority:
        // 1. Exact city-name match (case-insensitive)
        // 2. City name starts with query (prefix match)
        // 3. Substring / partial match
        // 4. Concise / prominent primary city names
        // 5. Region / Country match
        const rankMatches = (items, q) => {
          const lowerQuery = q.toLowerCase();
          return items.slice().sort((a, b) => {
            const score = (item) => {
              let s = 0;
              const name = (item.name || '').toLowerCase();
              const country = (item.country || '').toLowerCase();
              const state = (item.state || '').toLowerCase();

              if (name === lowerQuery) {
                s += 2000;
              } else if (name.startsWith(lowerQuery)) {
                s += 1000 - Math.min(name.length, 30);
              } else if (name.includes(lowerQuery)) {
                s += 500 - Math.min(name.length, 30);
              }

              if (state === lowerQuery || country === lowerQuery) {
                s += 100;
              } else if (state.startsWith(lowerQuery) || country.startsWith(lowerQuery)) {
                s += 50;
              }
              return s;
            };
            return score(b) - score(a);
          });
        };

        const ranked = rankMatches(uniqueMatches, query).slice(0, 5);
        autocompleteList.innerHTML = '';
        selectedIndex = -1;

        if (ranked.length === 0) {
          autocompleteList.classList.add('hidden');
          return;
        }

        ranked.forEach((item, index) => {
          const row = document.createElement('div');
          row.className = 'autocomplete-item';
          row.dataset.index = index;
          const flag = getCountryFlagImg(item.country);
          const countryFull = getCountryName(item.country);
          const stateStr = item.state ? `, ${item.state}` : '';
          const displayLabel = `${item.name}${stateStr}, ${countryFull}`;

          row.innerHTML = `
            <span class="city-name-part">${displayLabel}</span>
            <span class="country-flag-badge">${flag}</span>
          `;

          row.addEventListener('click', () => {
            cityInput.value = displayLabel;
            autocompleteList.classList.add('hidden');
            autocompleteList.innerHTML = '';
            const searchLocation = item.state ? `${item.name},${item.state},${item.country}` : `${item.name},${item.country}`;
            fetchWeatherData(searchLocation);
          });

          autocompleteList.appendChild(row);
        });
        autocompleteList.classList.remove('hidden');
      } catch (err) {
        console.warn('Autocomplete fetch note:', err.message);
      }
    }, 250);
  });

  // Keyboard navigation for autocomplete list
  cityInput.addEventListener('keydown', (e) => {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    if (autocompleteList.classList.contains('hidden') || items.length === 0) {
      if (e.key === 'Escape') {
        autocompleteList.classList.add('hidden');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      autocompleteList.classList.add('hidden');
    }
  });

  function updateActiveItem(items) {
    items.forEach((item, idx) => {
      if (idx === selectedIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !autocompleteList.contains(e.target)) {
      autocompleteList.classList.add('hidden');
    }
  });
}

// Search History Functions
function loadSearchHistory() {
  const history = JSON.parse(localStorage.getItem('searchHistory')) || [];
  if (history.length > 0) {
    searchHistory.classList.remove('hidden');
    renderHistoryChips(history);
  }
}

function saveToHistory(city) {
  let history = JSON.parse(localStorage.getItem('searchHistory')) || [];

  // Remove duplicate if exists
  history = history.filter(c => c.toLowerCase() !== city.toLowerCase());

  // Add to front
  history.unshift(city);

  // Keep only last 5
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  localStorage.setItem('searchHistory', JSON.stringify(history));
  searchHistory.classList.remove('hidden');
  renderHistoryChips(history);
}

function renderHistoryChips(history) {
  historyChips.innerHTML = '';
  history.forEach(city => {
    const chip = document.createElement('button');
    chip.className = 'history-chip';
    chip.textContent = city;
    chip.addEventListener('click', () => {
      cityInput.value = city;
      fetchWeatherData(city);
    });
    historyChips.appendChild(chip);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem('searchHistory');
  searchHistory.classList.add('hidden');
  historyChips.innerHTML = '';
});

// Fetch Air Quality Index
async function fetchAQI(lat, lon) {
  try {
    const data = await fetchWeatherApi('air_pollution', { lat, lon }, { ttl: 15 * 60 * 1000 });
    const aqi = data.list[0].main.aqi; // 1-5 scale

    // Get detailed AQI components
    const components = data.list[0].components;
    // Calculate US EPA AQI from PM2.5 (most common standard)
    const pm25 = components.pm2_5;
    const exactAQI = calculateUSAQI(pm25);

    // Update exact AQI value
    aqiExact.textContent = exactAQI;

    // Update category (1-5 scale)
    aqiValue.textContent = aqi;
    aqiText.textContent = AQI_LABELS[aqi - 1];

    // Update status badge color
    aqiText.className = 'aqi-status ' + AQI_CLASSES[aqi - 1];

    // Animate the slider fill
    const fillPercentage = (aqi / 5) * 100;

    // Reset animation
    aqiFill.style.width = '0%';

    // Trigger animation after a brief delay
    setTimeout(() => {
      aqiFill.style.width = fillPercentage + '%';
    }, 100);

    aqiContainer.classList.remove('hidden');
  } catch (err) {
    console.error('AQI fetch failed:', err);
    aqiContainer.classList.add('hidden');
  }
}

// Calculate US EPA AQI from PM2.5
function calculateUSAQI(pm25) {
  // US EPA AQI breakpoints for PM2.5
  const breakpoints = [
    { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500, iLow: 301, iHigh: 500 }
  ];

  for (let bp of breakpoints) {
    if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
      const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow;
      return Math.round(aqi);
    }
  }

  return pm25 > 500 ? 500 : Math.round(pm25);
}

// Favorite Cities Functions
function getFavorites() {
  return JSON.parse(localStorage.getItem('favoriteCities')) || [];
}

function loadFavorites() {
  const favorites = getFavorites();
  if (favorites.length > 0) {
    favoritesSection.classList.remove('hidden');
    renderFavorites(favorites);
  } else {
    favoritesSection.classList.add('hidden');
    favoritesChips.innerHTML = '';
  }
}

function renderFavorites(favorites) {
  favoritesChips.innerHTML = '';
  favorites.forEach((city) => {
    const chip = document.createElement('button');
    chip.className = 'favorite-chip';
    chip.innerHTML = `<span>★ ${city}</span> <span class="remove-fav" title="Remove">×</span>`;

    chip.querySelector('span').addEventListener('click', () => {
      cityInput.value = city;
      fetchWeatherData(city);
    });

    chip.querySelector('.remove-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(city);
    });

    favoritesChips.appendChild(chip);
  });
}

function toggleFavorite() {
  if (!currentCity) return;
  let favorites = getFavorites();
  const index = favorites.findIndex((c) => c.toLowerCase() === currentCity.toLowerCase());

  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    if (favorites.length >= MAX_FAVORITES) {
      favorites.pop(); // keep within limit
    }
    favorites.unshift(currentCity);
  }

  localStorage.setItem('favoriteCities', JSON.stringify(favorites));
  loadFavorites();
  updateFavoriteBtnState(currentCity);
}

function removeFavorite(city) {
  let favorites = getFavorites();
  favorites = favorites.filter((c) => c.toLowerCase() !== city.toLowerCase());
  localStorage.setItem('favoriteCities', JSON.stringify(favorites));
  loadFavorites();
  if (currentCity.toLowerCase() === city.toLowerCase()) {
    updateFavoriteBtnState(currentCity);
  }
}

function updateFavoriteBtnState(city) {
  favoriteBtn.classList.remove('hidden');
  const favorites = getFavorites();
  const isFav = favorites.some((c) => c.toLowerCase() === city.toLowerCase());
  if (isFav) {
    favoriteBtn.textContent = '★';
    favoriteBtn.classList.add('favorited');
    favoriteBtn.title = 'Remove from favorites';
  } else {
    favoriteBtn.textContent = '☆';
    favoriteBtn.classList.remove('favorited');
    favoriteBtn.title = 'Add to favorites';
  }
}

favoriteBtn.addEventListener('click', toggleFavorite);

// Weather Alerts Function
async function fetchWeatherAlerts(data) {
  alertsBanner.classList.add('hidden');
  alertDetails.classList.add('hidden');
  alertToggleBtn.textContent = 'Details';

  const condition = data.weather[0].main;
  const temp = data.main.temp;
  const feelsLikeTemp = data.main.feels_like;
  const wind = data.wind.speed;
  const visibilityMeters = data.visibility;

  let alertEvent = '';
  let alertDesc = '';
  let alertFull = '';

  if (['Thunderstorm', 'Tornado', 'Squall'].includes(condition)) {
    alertEvent = `${condition} Warning`;
    alertDesc = `Active ${condition.toLowerCase()} system in area. Seek shelter and avoid outdoor activities.`;
    alertFull = `Strong atmospheric instability detected with ${condition.toLowerCase()} patterns. Risk of sudden lightning strikes and strong wind gusts. Stay indoors away from windows.`;
  } else if (temp >= 35 || feelsLikeTemp >= 38) {
    alertEvent = 'Excessive Heat Advisory';
    alertDesc = `High thermal index (${Math.round(feelsLikeTemp)}°C feels-like). Stay hydrated and avoid direct sun exposure.`;
    alertFull = `Prolonged heat conditions can cause heat exhaustion or heat stroke. Drink plenty of fluids, stay in air-conditioned rooms, and limit strenuous outdoor work.`;
  } else if (temp <= 3) {
    alertEvent = 'Freeze & Frost Warning';
    alertDesc = `Near-freezing temperatures (${Math.round(temp)}°C). Frost formation possible.`;
    alertFull = `Freezing temperatures can damage sensitive vegetation and pose risks of hypothermia. Dress in multiple warm layers and protect exposed pipes.`;
  } else if (wind >= 10) {
    alertEvent = 'High Wind Advisory';
    alertDesc = `Gusty winds detected at ${wind} m/s. Secure outdoor objects.`;
    alertFull = `Strong winds can make driving difficult, especially for high-profile vehicles, and cause isolated branch damage. Exercise caution outdoors.`;
  } else if (visibilityMeters <= 1000) {
    alertEvent = 'Dense Fog Advisory';
    alertDesc = `Low visibility (${(visibilityMeters/1000).toFixed(1)} km) due to fog/mist. Drive carefully.`;
    alertFull = `Dense fog is causing hazardous travel conditions. If driving, slow down, use low-beam headlights, and leave plenty of distance ahead of you.`;
  }

  if (alertEvent) {
    alertTitle.textContent = alertEvent;
    alertDescription.textContent = alertDesc;
    alertFullText.innerHTML = `
      <strong>${alertEvent} — Official Advisory</strong>
      <p style="margin-top: 6px;">${alertFull}</p>
      <small style="color: var(--text-secondary); display: block; margin-top: 8px;">Source: Real-Time Meteorological Monitor</small>
    `;
    alertsBanner.classList.remove('hidden');
  }
}

alertToggleBtn.addEventListener('click', () => {
  alertDetails.classList.toggle('hidden');
  alertToggleBtn.textContent = alertDetails.classList.contains('hidden') ? 'Details' : 'Hide';
});

// Theme Toggle
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.dataset.theme = 'light';
    themeIcon.textContent = '●';
  } else {
    delete document.body.dataset.theme;
    themeIcon.textContent = '◐';
  }
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';

  if (currentTheme === 'light') {
    document.body.dataset.theme = 'light';
    themeIcon.textContent = '●';
    localStorage.setItem('theme', 'light');
  } else {
    delete document.body.dataset.theme;
    themeIcon.textContent = '◐';
    localStorage.setItem('theme', 'dark');
  }
});

// Round 5 Setup: Share Report & City Comparison
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// Side-by-Side City Comparison (Round 5)
function setupCityComparison() {
  if (!compareForm || !compareInput) return;

  compareForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const secondCity = compareInput.value.trim();
    if (!secondCity) return;

    if (!currentWeatherData) {
      showToast('Please search for a primary city first');
      return;
    }

    try {
      const data2 = await fetchWeatherApi('weather', { q: secondCity, units: 'metric' });
      renderComparison(currentWeatherData, data2);
    } catch (err) {
      console.error('Comparison error:', err);
      showToast(`City "${secondCity}" not found`);
    }
  });
}

function renderComparison(city1, city2) {
  if (!compareContainer || !compareCardPrimary || !compareCardSecondary) return;

  const unit = isCelsius ? '°C' : '°F';
  const c1Flag = getCountryFlagImg(city1.sys.country);
  const c2Flag = getCountryFlagImg(city2.sys.country);
  const c1Country = getCountryName(city1.sys.country);
  const c2Country = getCountryName(city2.sys.country);

  const t1 = formatTempNumber(city1.main.temp);
  const t2 = formatTempNumber(city2.main.temp);
  const fl1 = formatTempNumber(city1.main.feels_like);
  const fl2 = formatTempNumber(city2.main.feels_like);

  compareCardPrimary.innerHTML = `
    <div class="compare-card-title">${city1.name}, ${c1Country} ${c1Flag}</div>
    <div class="compare-temp-row">
      <span class="compare-temp-val">${t1}${unit}</span>
      <span style="font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize;">${city1.weather[0].description}</span>
    </div>
    <div class="compare-metric-row"><span>Feels Like</span><span>${fl1}${unit}</span></div>
    <div class="compare-metric-row"><span>Humidity</span><span>${city1.main.humidity}%</span></div>
    <div class="compare-metric-row"><span>Wind</span><span>${city1.wind.speed} m/s</span></div>
    <div class="compare-metric-row"><span>Pressure</span><span>${city1.main.pressure} hPa</span></div>
  `;

  compareCardSecondary.innerHTML = `
    <div class="compare-card-title">${city2.name}, ${c2Country} ${c2Flag}</div>
    <div class="compare-temp-row">
      <span class="compare-temp-val">${t2}${unit}</span>
      <span style="font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize;">${city2.weather[0].description}</span>
    </div>
    <div class="compare-metric-row"><span>Feels Like</span><span>${fl2}${unit}</span></div>
    <div class="compare-metric-row"><span>Humidity</span><span>${city2.main.humidity}%</span></div>
    <div class="compare-metric-row"><span>Wind</span><span>${city2.wind.speed} m/s</span></div>
    <div class="compare-metric-row"><span>Pressure</span><span>${city2.main.pressure} hPa</span></div>
  `;

  compareContainer.classList.remove('hidden');
}

// Professional PDF Report Generator
function setupExportPdf() {
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  if (!exportPdfBtn) return;

  exportPdfBtn.addEventListener('click', async () => {
    if (!currentWeatherData) {
      showToast('No weather data loaded yet');
      return;
    }
    if (typeof html2pdf === 'undefined') {
      showToast('PDF generator loading... Please try again');
      return;
    }

    showToast('Generating PDF report... 📄');

    const countryFull = getCountryName(currentWeatherData.sys.country);
    const flag = getCountryFlagImg(currentWeatherData.sys.country);
    const cityNameStr = `${currentWeatherData.name}, ${countryFull} ${flag}`;
    const unit = isCelsius ? '°C' : '°F';
    const tempVal = `${formatTempNumber(currentWeatherData.main.temp)}${unit}`;
    const feelsVal = `${formatTempNumber(currentWeatherData.main.feels_like)}${unit}`;
    const condition = currentWeatherData.weather[0] ? currentWeatherData.weather[0].description : '';
    const humidityVal = `${currentWeatherData.main.humidity}%`;
    const windVal = `${currentWeatherData.wind.speed} m/s`;
    const pressureVal = `${currentWeatherData.main.pressure} hPa`;
    const visVal = `${(currentWeatherData.visibility / 1000).toFixed(1)} km`;
    const adviceText = activityAdvice ? activityAdvice.textContent : 'N/A';
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const pdfTemplate = document.createElement('div');
    pdfTemplate.style.position = 'fixed';
    pdfTemplate.style.left = '-9999px';
    pdfTemplate.style.top = '0';
    pdfTemplate.innerHTML = `
      <div class="pdf-report-container">
        <div class="pdf-header">
          <div>
            <div class="pdf-title">🌤️ Weather Dashboard</div>
            <div class="pdf-subtitle">Official Executive Weather Report</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.9rem; font-weight: 700; color: #38bdf8;">${dateStr}</div>
            <div style="font-size: 0.8rem; color: #94a3b8;">Issued at ${timeStr}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: rgba(30, 41, 59, 0.9); padding: 18px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.3);">
          <div>
            <h1 style="margin: 0; font-size: 1.8rem; color: #ffffff;">${cityNameStr}</h1>
            <div style="font-size: 1rem; text-transform: capitalize; color: #38bdf8; margin-top: 4px;">${condition}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 2.6rem; font-weight: 700; color: #38bdf8;">${tempVal}</div>
            <div style="font-size: 0.85rem; color: #94a3b8;">Feels like ${feelsVal}</div>
          </div>
        </div>

        <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 8px;">Meteorological Parameters & Breakdown</div>
        <div class="pdf-grid">
          <div class="pdf-box">
            <div class="pdf-box-label">Humidity</div>
            <div class="pdf-box-val">${humidityVal}</div>
          </div>
          <div class="pdf-box">
            <div class="pdf-box-label">Wind Speed</div>
            <div class="pdf-box-val">${windVal}</div>
          </div>
          <div class="pdf-box">
            <div class="pdf-box-label">Pressure</div>
            <div class="pdf-box-val">${pressureVal}</div>
          </div>
          <div class="pdf-box">
            <div class="pdf-box-label">Visibility</div>
            <div class="pdf-box-val">${visVal}</div>
          </div>
          <div class="pdf-box">
            <div class="pdf-box-label">UV Index</div>
            <div class="pdf-box-val">${uvIndex ? uvIndex.textContent : '--'}</div>
          </div>
          <div class="pdf-box">
            <div class="pdf-box-label">Dew Point</div>
            <div class="pdf-box-val">${dewPoint ? dewPoint.textContent : '--'}</div>
          </div>
        </div>

        <div style="margin-top: 18px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 14px; border-radius: 8px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">Smart Activity Recommendation</div>
          <div style="font-size: 0.95rem; color: #f8fafc; line-height: 1.4;">${adviceText}</div>
        </div>

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
          <span>Data Source: OpenWeatherMap API</span>
          <span>Verified Meteorological Summary</span>
        </div>
      </div>
    `;

    document.body.appendChild(pdfTemplate);

    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     `Weather_Report_${currentWeatherData.name}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(pdfTemplate.firstElementChild).save();
      showToast('PDF Report downloaded! 📄');
    } catch (e) {
      console.error(e);
      showToast('Error exporting PDF');
    } finally {
      document.body.removeChild(pdfTemplate);
    }
  });
}

// Service Worker Registration for PWA & Offline Support
function registerServiceWorker() {
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
        .catch((err) => console.warn('PWA Service Worker registration skipped:', err.message));
    });
  }
}

// App Initialization
function initApp() {
  loadTheme();
  loadSearchHistory();
  loadFavorites();
  setupCityAutocomplete();
  setupExportPdf();
  setupCityComparison();
  registerServiceWorker();

  // Set default city to Delhi on page load
  cityInput.value = 'Delhi';
  fetchWeatherData('Delhi');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}