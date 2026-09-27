# Weather Dashboard

A responsive weather dashboard built with vanilla JavaScript, HTML5, and CSS3. Consumes the OpenWeatherMap REST API to display real-time weather metrics and a 5-day forecast.

## Features
- **Real-Time Data**: Live temperature, feels-like, humidity, wind speed, pressure, and visibility.
- **5-Day Forecast**: Filtered midday forecasts for upcoming days.
- **Concurrent API Requests**: Uses `Promise.all` to fetch current conditions and forecast data in parallel.
- **Resilient Error Handling**: Handles 404 (city not found), 401 (unauthorized API key), and general connection drops with dynamic UI error states.
- **Clean UI**: Modern dark theme with CSS Grid and Flexbox.

## Tech Stack
- HTML5 & CSS3 (Custom styles, responsive design)
- Vanilla JavaScript (ES6+, Fetch API, Async/Await)
- OpenWeatherMap API

## Architecture & Learnings
- **Asynchronous Flow**: Migrated mental model from Java/C++ synchronous execution to JS event loops and Promises.
- **DOM Manipulation**: Updating UI nodes directly without external rendering libraries.
- **Environment Safety**: Storing sensitive keys in ignored configuration files (`config.js`).

## How to Run Locally
1. Clone this repository.
2. Obtain a free API key from [OpenWeatherMap](https://openweathermap.org/).
3. Create a `config.js` file in the root directory:
```javascript
   const CONFIG = {
     API_KEY: "YOUR_API_KEY_HERE"
   };
```
4. Open `index.html` using Live Server or open it directly in any browser.