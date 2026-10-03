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

// Read the API Key from config.js
const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.API_KEY : '5ff7e87116093c9b53407f7a546326c9';

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
    // Current Weather URL
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&units=metric&appid=${API_KEY}`;

    // 5-Day Forecast URL
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
      city
    )}&units=metric&appid=${API_KEY}`;

    // Fire both network requests in parallel
    const [weatherRes, forecastRes] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl)
    ]);

    // Handle 404 or bad requests
    if (!weatherRes.ok || !forecastRes.ok) {
      if (weatherRes.status === 404 || forecastRes.status === 404) {
        throw new Error(`City "${city}" not found. Please verify spelling.`);
      } else if (weatherRes.status === 401) {
        throw new Error('Invalid API key. Please check your config.js.');
      } else {
        throw new Error('Something went wrong fetching data.');
      }
    }

    const currentData = await weatherRes.json();
    const forecastData = await forecastRes.json();

    // Log the data in DevTools console (Question 3 & 4 exploration)
    console.log('Current Weather Data:', currentData);
    console.log('Forecast Data:', forecastData);

    // Update UI with the retrieved data
    displayCurrentWeather(currentData);
    displayForecast(forecastData);
    displayHourlyForecast(forecastData);
    saveToHistory(city);
    showContent();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Step 4: Render Current Weather to the DOM
function displayCurrentWeather(data) {
  cityName.textContent = `${data.name}, ${data.sys.country}`;

  const condition = data.weather[0];
  weatherCondition.textContent = condition.description;

  // Use animated icon
  const iconCode = condition.icon;
  weatherIcon.src = getAnimatedIconUrl(iconCode);
  weatherIcon.alt = condition.description;

  rawTempC = data.main.temp;
  rawFeelsC = data.main.feels_like;

  humidity.textContent = `${data.main.humidity}%`;
  windSpeed.textContent = `${data.wind.speed} m/s`;
  pressure.textContent = `${data.main.pressure} hPa`;
  visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;

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

  // Dynamic Background Atmosphere for Round 4
  updateDynamicBackground(condition.main, iconCode);
}

// Step 5: Render 5-Day Forecast
function displayForecast(data) {
  forecastCards.innerHTML = ''; // Clear previous cards
  rawForecastTemps = [];

  // OpenWeatherMap gives readings every 3 hours (40 entries total).
  // Filter for readings around noon (12:00:00) to get one card per day.
  const dailyReadings = data.list.filter((reading) =>
    reading.dt_txt.includes('12:00:00')
  );

  dailyReadings.forEach((reading) => {
    const dateObj = new Date(reading.dt * 1000);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const tempC = reading.main.temp;
    rawForecastTemps.push(tempC);
    const desc = reading.weather[0].description;
    const iconCode = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="forecast-day">${dayName}</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="${desc}" />
      <span class="forecast-temp">${formatTempNumber(tempC)}${isCelsius ? '°C' : '°F'}</span>
      <span class="forecast-desc">${desc}</span>
    `;
    forecastCards.appendChild(card);
  });

  // Render Interactive Temperature Chart (Round 4)
  currentForecastData = data;
  renderForecastChart(data);
}

// Step 5B: Render Hourly Forecast (Next 12 hours)
function displayHourlyForecast(data) {
  hourlyForecast.innerHTML = '';
  rawHourlyTemps = [];

  // Take first 4 entries (each is 3 hours apart = 12 hours total)
  const hourlyData = data.list.slice(0, 4);

  hourlyData.forEach((reading) => {
    // reading.dt is UTC Unix seconds. Adding the city's timezone offset (seconds)
    // shifts it to city-local time. We then format with timeZone:'UTC' so the
    // Date object's already-shifted value is read as-is — no machine offset applied.
    const time = new Date((reading.dt + (cityTimezoneOffset || 0)) * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC'
    });
    const tempC = reading.main.temp;
    rawHourlyTemps.push(tempC);
    const iconCode = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = 'hourly-card';
    card.innerHTML = `
      <span class="hourly-time">${time}</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="weather" />
      <span class="hourly-temp">${formatTempNumber(tempC)}${isCelsius ? '°C' : '°F'}</span>
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
  // 1. UV Index
  if (uvIndex) {
    uvIndex.textContent = uvi !== undefined && uvi !== null ? uvi.toFixed(1) : '--';
  }

  // 2. Dew Point (Use data.main.dew_point if provided, else approximate using Magnus formula)
  if (dewPoint) {
    let dp = data.main ? data.main.dew_point : undefined;
    if (dp === undefined && data.main && data.main.temp !== undefined && data.main.humidity !== undefined) {
      const T = data.main.temp;
      const RH = data.main.humidity;
      dp = T - ((100 - RH) / 5);
    }
    dewPoint.textContent = dp !== undefined ? `${formatTempNumber(dp)}${isCelsius ? '°C' : '°F'}` : '--';
  }

  // 3. Wind Direction & Arrow Rotation
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

  // 5. Activity Advice
  if (activityAdvice) {
    activityAdvice.textContent = getActivitySuggestion(data, uvi);
  }
}

async function fetchUV(lat, lon, currentWeatherData) {
  let uvi = null;
  try {
    const uviUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const res = await fetch(uviUrl);
    if (res.ok) {
      const uviData = await res.json();
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
  gradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  gradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

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
          borderColor: '#38bdf8',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.38,
          pointBackgroundColor: '#38bdf8',
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
          titleColor: '#38bdf8',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(255, 255, 255, 0.15)',
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
          ticks: { color: 'rgba(248, 250, 252, 0.7)', font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: {
            color: 'rgba(248, 250, 252, 0.7)',
            font: { family: 'Plus Jakarta Sans', size: 12 },
            callback: (val) => `${val}${currentUnit}`
          }
        }
      }
    }
  });
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
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

    const [weatherRes, forecastRes] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl)
    ]);

    if (!weatherRes.ok || !forecastRes.ok) {
      throw new Error('Failed to retrieve weather for your coordinates.');
    }

    const currentData = await weatherRes.json();
    const forecastData = await forecastRes.json();

    displayCurrentWeather(currentData);
    displayForecast(forecastData);
    displayHourlyForecast(forecastData);
    saveToHistory(currentData.name);
    showContent();
  } catch (err) {
    showError(err.message);
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
  unitLabel.textContent = currentUnit;
  feelsUnit.textContent = currentUnit;
  unitToggle.textContent = isCelsius ? 'Switch to °F' : 'Switch to °C';

  temperature.textContent = formatTempNumber(rawTempC);
  feelsLike.textContent = formatTempNumber(rawFeelsC);

  // Update 5-Day Forecast Card Temps
  const forecastTempElements = document.querySelectorAll('.forecast-temp');
  forecastTempElements.forEach((el, index) => {
    if (rawForecastTemps[index] !== undefined) {
      el.textContent = `${formatTempNumber(rawForecastTemps[index])}${currentUnit}`;
    }
  });

  // Update Hourly Forecast Card Temps
  const hourlyTempElements = document.querySelectorAll('.hourly-temp');
  hourlyTempElements.forEach((el, index) => {
    if (rawHourlyTemps[index] !== undefined) {
      el.textContent = `${formatTempNumber(rawHourlyTemps[index])}${currentUnit}`;
    }
  });

  // Re-render Chart.js graph with updated unit values
  if (currentForecastData) {
    renderForecastChart(currentForecastData);
  }
}

// Temperature Unit Toggle Listener
unitToggle.addEventListener('click', () => {
  isCelsius = !isCelsius;
  localStorage.setItem('weatherTempUnit', isCelsius ? 'C' : 'F');
  updateAllTemperatureDisplays();
});

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

// City Search Autocomplete Dropdown
function setupCityAutocomplete() {
  cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    if (autocompleteDebounceTimer) clearTimeout(autocompleteDebounceTimer);

    if (query.length < 2) {
      autocompleteList.classList.add('hidden');
      autocompleteList.innerHTML = '';
      return;
    }

    autocompleteDebounceTimer = setTimeout(async () => {
      try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;
        const res = await fetch(geoUrl);
        if (!res.ok) return;
        const matches = await res.json();

        if (matches && matches.length > 0) {
          autocompleteList.innerHTML = '';
          matches.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'autocomplete-item';
            const stateStr = item.state ? `, ${item.state}` : '';
            row.innerHTML = `
              <span class="city-name-part">${item.name}${stateStr}</span>
              <span class="country-badge">${item.country}</span>
            `;
            row.addEventListener('click', () => {
              cityInput.value = `${item.name}, ${item.country}`;
              autocompleteList.classList.add('hidden');
              fetchWeatherData(cityInput.value);
            });
            autocompleteList.appendChild(row);
          });
          autocompleteList.classList.remove('hidden');
        } else {
          autocompleteList.classList.add('hidden');
        }
      } catch (err) {
        console.warn('Autocomplete fetch note:', err.message);
      }
    }, 250);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !autocompleteList.contains(e.target)) {
      autocompleteList.classList.add('hidden');
    }
  });

  // Close on Escape key
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
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
    const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const response = await fetch(aqiUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch AQI');
    }

    const data = await response.json();
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

loadTheme();

// Load history and favorites on page load
loadSearchHistory();
loadFavorites();
setupCityAutocomplete();

// Round 5 Setup: Share Report & City Comparison
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

function setupShareReport() {
  if (!shareBtn) return;
  shareBtn.addEventListener('click', async () => {
    if (!currentWeatherData) return;
    const name = `${currentWeatherData.name}, ${currentWeatherData.sys.country}`;
    const temp = `${formatTempNumber(currentWeatherData.main.temp)}${isCelsius ? '°C' : '°F'}`;
    const feels = `${formatTempNumber(currentWeatherData.main.feels_like)}${isCelsius ? '°C' : '°F'}`;
    const condition = currentWeatherData.weather[0] ? currentWeatherData.weather[0].description : '';
    const hum = `${currentWeatherData.main.humidity}%`;
    const wind = `${currentWeatherData.wind.speed} m/s`;
    const press = `${currentWeatherData.main.pressure} hPa`;
    const advice = activityAdvice ? activityAdvice.textContent : '';

    const summary = `🌤️ Weather Report for ${name}:\n• Temperature: ${temp} (Feels like ${feels})\n• Condition: ${condition}\n• Humidity: ${hum} | Wind: ${wind} | Pressure: ${press}\n• Smart Advice: ${advice}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Weather in ${name}`,
          text: summary
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).then(() => {
        showToast('Weather report copied to clipboard! 📋');
      }).catch(() => {
        showToast('Unable to copy report');
      });
    }
  });
}

function setupCityComparison() {
  if (!compareForm) return;

  function renderCompareCard(container, data) {
    const unit = isCelsius ? '°C' : '°F';
    const tempVal = formatTempNumber(data.main.temp);
    const feelsVal = formatTempNumber(data.main.feels_like);
    const iconCode = data.weather[0] ? data.weather[0].icon : '01d';
    const desc = data.weather[0] ? data.weather[0].description : '';

    container.innerHTML = `
      <div class="compare-card-title">${data.name}, ${data.sys.country}</div>
      <div class="compare-temp-row">
        <img src="${getAnimatedIconUrl(iconCode)}" alt="${desc}" style="width: 48px; height: 48px;" />
        <div>
          <span class="compare-temp-val">${tempVal}${unit}</span>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">Feels like ${feelsVal}${unit}</div>
        </div>
      </div>
      <div style="font-size: 0.85rem; text-transform: capitalize; color: var(--accent-color); font-weight: 600;">${desc}</div>
      <div class="compare-metric-row">
        <span>Humidity</span>
        <strong>${data.main.humidity}%</strong>
      </div>
      <div class="compare-metric-row">
        <span>Wind Speed</span>
        <strong>${data.wind.speed} m/s</strong>
      </div>
      <div class="compare-metric-row">
        <span>Pressure</span>
        <strong>${data.main.pressure} hPa</strong>
      </div>
    `;
  }

  compareForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const secondCity = compareInput.value.trim();
    if (!secondCity) return;
    if (!currentWeatherData) {
      showToast('Search for a city first!');
      return;
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(secondCity)}&units=metric&appid=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) {
        showToast(`City "${secondCity}" not found`);
        return;
      }
      const secondaryData = await res.json();

      renderCompareCard(compareCardPrimary, currentWeatherData);
      renderCompareCard(compareCardSecondary, secondaryData);
      compareContainer.classList.remove('hidden');
    } catch (err) {
      showToast('Error comparing cities');
    }
  });
}

setupShareReport();
setupCityComparison();

// Initial fetch on page load (Default city)
fetchWeatherData('Delhi');