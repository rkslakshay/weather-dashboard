/**
 * Serverless API Proxy for OpenWeatherMap
 * Keeps API keys secure on the server side and provides caching headers.
 * Compatible with Vercel, Netlify, and standard Node.js serverless runtimes.
 */

const ALLOWED_ENDPOINTS = {
  weather: 'https://api.openweathermap.org/data/2.5/weather',
  forecast: 'https://api.openweathermap.org/data/2.5/forecast',
  air_pollution: 'https://api.openweathermap.org/data/2.5/air_pollution',
  air_pollution_forecast: 'https://api.openweathermap.org/data/2.5/air_pollution/forecast',
  uvi: 'https://api.openweathermap.org/data/2.5/uvi',
  geo: 'https://api.openweathermap.org/geo/1.0/direct',
  'geo/1.0/direct': 'https://api.openweathermap.org/geo/1.0/direct'
};

const ALLOWED_TILE_LAYERS = ['precipitation_new', 'temp_new', 'clouds_new', 'wind_new'];

const ALLOWED_ORIGIN = 'https://weather-dashboard-five-pearl.vercel.app';

// Each endpoint needs at least one of these parameter groups
const REQUIRED_PARAMS = {
  weather: [['q'], ['lat', 'lon'], ['id'], ['zip']],
  forecast: [['q'], ['lat', 'lon'], ['id'], ['zip']],
  air_pollution: [['lat', 'lon']],
  air_pollution_forecast: [['lat', 'lon']],
  uvi: [['lat', 'lon']],
  geo: [['q']],
  'geo/1.0/direct': [['q']]
};

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
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

    if (!targetBaseUrl && endpointKey !== 'tile') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: `Invalid endpoint "${endpointKey}". Allowed: ${[...Object.keys(ALLOWED_ENDPOINTS), 'tile'].join(', ')}` 
      }));
      return;
    }

    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Server is missing the OPENWEATHER_API_KEY environment variable.' }));
      return;
    }

    // Map tiles are proxied as images so the key never reaches the browser
    if (endpointKey === 'tile') {
      const layer = url.searchParams.get('layer');
      const [z, x, y] = ['z', 'x', 'y'].map(k => url.searchParams.get(k));
      if (!ALLOWED_TILE_LAYERS.includes(layer) || ![z, x, y].every(v => /^\d+$/.test(v || ''))) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid tile request.' }));
        return;
      }
      const tileRes = await fetch(`https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`);
      res.statusCode = tileRes.status;
      res.setHeader('Content-Type', tileRes.headers.get('content-type') || 'image/png');
      res.setHeader('Cache-Control', tileRes.ok ? 's-maxage=600, stale-while-revalidate=1200, public' : 'no-store');
      res.end(Buffer.from(await tileRes.arrayBuffer()));
      return;
    }

    const hasRequired = REQUIRED_PARAMS[endpointKey].some(group => group.every(k => url.searchParams.get(k)));
    if (!hasRequired) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: `Missing parameters for "${endpointKey}". Provide one of: ${REQUIRED_PARAMS[endpointKey].map(g => g.join(' + ')).join(', ')}`
      }));
      return;
    }

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
