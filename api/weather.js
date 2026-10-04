/**
 * Serverless API Proxy for OpenWeatherMap
 * Keeps API keys secure on the server side and provides caching headers.
 * Compatible with Vercel, Netlify, and standard Node.js serverless runtimes.
 */

const ALLOWED_ENDPOINTS = {
  weather: 'https://api.openweathermap.org/data/2.5/weather',
  forecast: 'https://api.openweathermap.org/data/2.5/forecast',
  air_pollution: 'https://api.openweathermap.org/data/2.5/air_pollution',
  uvi: 'https://api.openweathermap.org/data/2.5/uvi',
  geo: 'https://api.openweathermap.org/geo/1.0/direct',
  'geo/1.0/direct': 'https://api.openweathermap.org/geo/1.0/direct'
};

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed. Only GET is supported.' }));
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const endpointKey = url.searchParams.get('endpoint') || 'weather';
    const targetBaseUrl = ALLOWED_ENDPOINTS[endpointKey];

    if (!targetBaseUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: `Invalid endpoint "${endpointKey}". Allowed: ${Object.keys(ALLOWED_ENDPOINTS).join(', ')}` 
      }));
      return;
    }

    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.API_KEY || '5ff7e87116093c9b53407f7a546326c9';

    // Build target query string
    const targetUrl = new URL(targetBaseUrl);
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'endpoint') {
        targetUrl.searchParams.set(key, value);
      }
    }
    targetUrl.searchParams.set('appid', apiKey);

    // Default units to metric if not specified and not geo
    if (!endpointKey.startsWith('geo') && !targetUrl.searchParams.has('units')) {
      targetUrl.searchParams.set('units', 'metric');
    }

    const apiResponse = await fetch(targetUrl.toString());
    const data = await apiResponse.json();

    // Cache successful responses for 10 minutes, serve stale up to 20 minutes
    if (apiResponse.ok) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200, public');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    res.statusCode = apiResponse.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error while fetching weather data.' }));
  }
};
