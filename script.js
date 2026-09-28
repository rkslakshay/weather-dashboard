// Step 1: Select DOM Elements
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const errorMessage = document.getElementById('error-message');
const geoBtn = document.getElementById('geo-btn');
const errorText = document.getElementById('error-text');
const loadingSpinner = document.getElementById('loading-spinner');
const weatherContent = document.getElementById('weather-content');

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

// Read the API Key from config.js
const API_KEY = CONFIG.API_KEY;

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
  weatherIcon.src = `https://openweathermap.org/img/wn/${condition.icon}@2x.png`;
  weatherIcon.alt = condition.description;

  temperature.textContent = Math.round(data.main.temp);
  feelsLike.textContent = Math.round(data.main.feels_like);
  humidity.textContent = `${data.main.humidity}%`;
  windSpeed.textContent = `${data.wind.speed} m/s`;
  pressure.textContent = `${data.main.pressure} hPa`;
  visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;
}

// Step 5: Render 5-Day Forecast
function displayForecast(data) {
  forecastCards.innerHTML = ''; // Clear previous cards

  // OpenWeatherMap gives readings every 3 hours (40 entries total).
  // Filter for readings around noon (12:00:00) to get one card per day.
  const dailyReadings = data.list.filter((reading) =>
    reading.dt_txt.includes('12:00:00')
  );

  dailyReadings.forEach((reading) => {
    const dateObj = new Date(reading.dt * 1000);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const temp = Math.round(reading.main.temp);
    const desc = reading.weather[0].description;
    const icon = reading.weather[0].icon;

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="forecast-day">${dayName}</span>
      <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" />
      <span class="forecast-temp">${temp}°C</span>
      <span class="forecast-desc">${desc}</span>
    `;
    forecastCards.appendChild(card);
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
    showContent();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

// Step 6: Geolocation Button Event Listener
geoBtn.addEventListener('click', () => {
  // Check if browser supports Geolocation
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
      // Handle user denying permission or timeout
      if (err.code === err.PERMISSION_DENIED) {
        showError('Location access was denied. Please allow permission or search manually.');
      } else {
        showError('Unable to retrieve your location. Please try again.');
      }
    }
  );
});

// Initial fetch on page load (Default city)
fetchWeatherData('Delhi');