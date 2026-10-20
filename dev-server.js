/**
 * Zero-dependency local dev server.
 * Serves the static site and runs api/weather.js at /api/weather, like Vercel does.
 *
 *   OPENWEATHER_API_KEY=your_key node dev-server.js
 *
 * The key can also come from a git-ignored .env file (OPENWEATHER_API_KEY=...)
 * or, failing that, from the git-ignored config.js.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

try {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* no .env file */ }

// Fall back to the git-ignored config.js key used for local client-side testing
if (!process.env.OPENWEATHER_API_KEY) {
  try {
    const m = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8').match(/API_KEY:\s*["']([^"']+)["']/);
    if (m && m[1] !== 'YOUR_API_KEY_HERE') process.env.OPENWEATHER_API_KEY = m[1];
  } catch (e) { /* no config.js */ }
}

const handler = require('./api/weather.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};

http.createServer((req, res) => {
  if (req.url.startsWith('/api/weather')) return handler(req, res);

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(ROOT) || filePath.includes(`${path.sep}.`)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, body) => {
    if (err) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(filePath)] || 'application/octet-stream');
    res.end(body);
  });
}).listen(PORT, () => {
  console.log(`SkyPulse dev server on http://localhost:${PORT}`);
  if (!process.env.OPENWEATHER_API_KEY) console.warn('Warning: OPENWEATHER_API_KEY is not set; /api/weather will return 500.');
});
