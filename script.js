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
const visibility = document.getElementById('visibility');
const forecastCards = document.getElementById('forecast-cards');
const hourlyForecast = document.getElementById('hourly-forecast');

// Temperature toggle elements
const unitToggle = document.getElementById('unit-toggle');
const unitLabel = document.getElementById('unit-label');
const feelsUnit = document.getElementById('feels-unit');

// Read the API Key from config.js
const API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.API_KEY : '5ff7e87116093c9b53407f7a546326c9';

// State variables for temperature toggle
let isCelsius = true;
let rawTempC = 0;
let rawFeelsC = 0;
let rawForecastTemps = [];
let currentCity = '';

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
  currentDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const condition = data.weather[0];
  weatherCondition.textContent = condition.description;

  // Use animated icon
  const iconCode = condition.icon;
  weatherIcon.src = getAnimatedIconUrl(iconCode);
  weatherIcon.alt = condition.description;

  rawTempC = data.main.temp;
  rawFeelsC = data.main.feels_like;
  isCelsius = true;
  unitLabel.textContent = '°C';
  feelsUnit.textContent = '°C';
  unitToggle.textContent = 'Switch to °F';
  temperature.textContent = Math.round(rawTempC);
  feelsLike.textContent = Math.round(rawFeelsC);

  humidity.textContent = `${data.main.humidity}%`;
  windSpeed.textContent = `${data.wind.speed} m/s`;
  pressure.textContent = `${data.main.pressure} hPa`;
  visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;

  // Fetch AQI using coordinates
  fetchAQI(data.coord.lat, data.coord.lon);

  // Favorite button & Weather Alerts for current location
  currentCity = data.name;
  updateFavoriteBtnState(data.name);
  fetchWeatherAlerts(data);
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
    const temp = Math.round(reading.main.temp);
    rawForecastTemps.push(reading.main.temp);
    const desc = reading.weather[0].description;
    const iconCode = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="forecast-day">${dayName}</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="${desc}" />
      <span class="forecast-temp">${temp}°C</span>
      <span class="forecast-desc">${desc}</span>
    `;
    forecastCards.appendChild(card);
  });
}

// Step 5B: Render Hourly Forecast (Next 12 hours)
function displayHourlyForecast(data) {
  hourlyForecast.innerHTML = '';

  // Take first 4 entries (each is 3 hours apart = 12 hours total)
  const hourlyData = data.list.slice(0, 4);

  hourlyData.forEach((reading) => {
    const time = new Date(reading.dt * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
    const temp = Math.round(reading.main.temp);
    const iconCode = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = 'hourly-card';
    card.innerHTML = `
      <span class="hourly-time">${time}</span>
      <img src="${getAnimatedIconUrl(iconCode)}" alt="weather" />
      <span class="hourly-temp">${temp}°C</span>
    `;
    hourlyForecast.appendChild(card);
  });
}

// UI State Helper Functions
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

// Temperature Unit Toggle
unitToggle.addEventListener('click', () => {
  isCelsius = !isCelsius;

  if (isCelsius) {
    temperature.textContent = Math.round(rawTempC);
    feelsLike.textContent = Math.round(rawFeelsC);
    unitLabel.textContent = '°C';
    feelsUnit.textContent = '°C';
    unitToggle.textContent = 'Switch to °F';
  } else {
    temperature.textContent = Math.round((rawTempC * 9/5) + 32);
    feelsLike.textContent = Math.round((rawFeelsC * 9/5) + 32);
    unitLabel.textContent = '°F';
    feelsUnit.textContent = '°F';
    unitToggle.textContent = 'Switch to °C';
  }

  // Update forecast cards
  const forecastTempElements = document.querySelectorAll('.forecast-temp');
  forecastTempElements.forEach((el, index) => {
    if (rawForecastTemps[index] !== undefined) {
      const temp = isCelsius
        ? Math.round(rawForecastTemps[index])
        : Math.round((rawForecastTemps[index] * 9/5) + 32);
      el.textContent = `${temp}${isCelsius ? '°C' : '°F'}`;
    }
  });
});

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

// Initial fetch on page load (Default city)
fetchWeatherData('Delhi');