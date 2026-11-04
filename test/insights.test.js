const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACTIVITIES,
  categoryFor,
  buildHourlySeries,
  scoreWeatherWindow,
  findWeatherWindows,
  generatePersonalBriefing,
  describeFreshness
} = require('../insights.js');

const HOUR = 3600;
// 2026-06-10 00:00 UTC, a whole hour
const T0 = Date.UTC(2026, 5, 10) / 1000;
const CLEAR = { main: 'Clear', description: 'clear sky', icon: '01d' };

function reading(dt, overrides = {}) {
  return { dt, temp: 18, feels: 18, humidity: 50, wind: 2, gust: 3, pop: 0, vis: 10000, rain: 0, snow: 0, weather: CLEAR, ...overrides };
}
// `count` readings 3 hours apart
function readings(count, overrides = {}, start = T0) {
  return Array.from({ length: count }, (_, i) => reading(start + i * 3 * HOUR, typeof overrides === 'function' ? overrides(i) : overrides));
}
// 4 hourly samples (a 3-hour window) at a daytime hour
function windowSamples(overrides = {}, startHour = 15) {
  return Array.from({ length: 4 }, (_, i) => reading(T0 + (startHour + i) * HOUR, { localHour: startHour + i, ...overrides }));
}
const format = {
  temp: (c) => `${Math.round(c)}°C`,
  wind: (ms) => `${Math.round(ms * 3.6)} km/h`,
  rain: (mm) => `${mm.toFixed(1)} mm`,
  time: (dt) => new Date(dt * 1000).toISOString().slice(11, 16)
};

/* ---------- Scoring ---------- */
test('categories follow the documented score bands', () => {
  assert.equal(categoryFor(100).id, 'optimal');
  assert.equal(categoryFor(85).id, 'optimal');
  assert.equal(categoryFor(84).id, 'good');
  assert.equal(categoryFor(70).id, 'good');
  assert.equal(categoryFor(69).id, 'fair');
  assert.equal(categoryFor(50).id, 'fair');
  assert.equal(categoryFor(49).id, 'poor');
});

test('ideal conditions score highly for each profile', () => {
  for (const id of ['walking', 'running', 'cycling']) {
    const [lo, hi] = ACTIVITIES[id].temp;
    const mid = (lo + hi) / 2;
    const r = scoreWeatherWindow(id, windowSamples({ temp: mid, feels: mid, wind: 1, gust: 1.5 }));
    assert.equal(r.valid, true);
    assert.ok(r.score >= 95, `${id} scored ${r.score}`);
    assert.equal(r.category.id, 'optimal');
  }
});

test('activity profiles disagree: same weather ranks differently', () => {
  const samples = windowSamples({ temp: 24, feels: 24, wind: 5, gust: 7 }); // 18 km/h wind, warm
  const walking = scoreWeatherWindow('walking', samples).score;
  const running = scoreWeatherWindow('running', samples).score;
  const cycling = scoreWeatherWindow('cycling', samples).score;
  assert.ok(walking > running, `${walking} vs ${running}`);
  assert.ok(walking > cycling, `${walking} vs ${cycling}`);
});

test('rain chance lowers the score, most for outdoor dining preferences', () => {
  const dry = scoreWeatherWindow('walking', windowSamples({ pop: 0 })).score;
  const wet = scoreWeatherWindow('walking', windowSamples({ pop: 0.7 })).score;
  assert.ok(dry - wet >= 25, `${dry} vs ${wet}`);
});

test('cycling takes an additional penalty for gusts above 30 km/h', () => {
  const calm = scoreWeatherWindow('cycling', windowSamples({ wind: 2, gust: 8 }));   // 29 km/h gust
  const gusty = scoreWeatherWindow('cycling', windowSamples({ wind: 2, gust: 12 })); // 43 km/h gust
  assert.ok(gusty.adjustments.some((a) => /Gusts above 30/.test(a.reason)));
  assert.ok(!calm.adjustments.some((a) => /Gusts above 30/.test(a.reason)));
  assert.ok(calm.score - gusty.score >= 15);
});

test('storms are heavily penalized and explained', () => {
  const storm = { main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' };
  const r = scoreWeatherWindow('walking', windowSamples({ weather: storm }));
  assert.ok(r.score < 50);
  assert.equal(r.category.id, 'poor');
  assert.ok(r.reasons.some((x) => /Storms/.test(x)));
});

test('outdoor dining prefers mealtimes over the same weather at other hours', () => {
  const warm = { temp: 23, feels: 23, wind: 1, gust: 2, pop: 0 };
  const dinner = scoreWeatherWindow('dining', windowSamples(warm, 19));
  const afternoon = scoreWeatherWindow('dining', windowSamples(warm, 15));
  const lunch = scoreWeatherWindow('dining', windowSamples(warm, 12));
  assert.ok(dinner.score > afternoon.score);
  assert.ok(lunch.score > afternoon.score);
});

test('overnight windows are penalized for walking', () => {
  const day = scoreWeatherWindow('walking', windowSamples({}, 15));
  const night = scoreWeatherWindow('walking', windowSamples({}, 1));
  assert.ok(night.score < day.score);
  assert.ok(night.reasons.some((x) => /Late-night/.test(x)));
});

test('reasons never exceed three and the score is an integer in range', () => {
  const r = scoreWeatherWindow('running', windowSamples({ temp: 38, feels: 42, pop: 0.9, wind: 15, gust: 25, humidity: 95, vis: 500 }));
  assert.ok(r.reasons.length >= 1 && r.reasons.length <= 3);
  assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100);
});

/* ---------- Missing and incomplete data ---------- */
test('missing required values invalidate a window instead of scoring as zero or ideal', () => {
  for (const key of ['temp', 'pop', 'wind']) {
    const samples = windowSamples();
    samples[2] = { ...samples[2], [key]: null };
    const r = scoreWeatherWindow('walking', samples);
    assert.equal(r.valid, false, key);
    assert.match(r.reason, new RegExp(key));
  }
});

test('missing optional values drop out of the average and are reported', () => {
  const r = scoreWeatherWindow('walking', windowSamples({ humidity: null, gust: null }));
  assert.equal(r.valid, true);
  assert.deepEqual(r.missing.sort(), ['gusts', 'humidity']);
  assert.equal(r.humidity, null);
  assert.equal(r.gust, null);
  assert.ok(!r.breakdown.some((b) => b.key === 'humidity' || b.key === 'gust'));
});

test('non-consecutive samples are rejected', () => {
  const samples = windowSamples();
  samples[3] = { ...samples[3], dt: samples[3].dt + HOUR };
  assert.equal(scoreWeatherWindow('walking', samples).valid, false);
});

test('unknown activity throws; too few samples are invalid', () => {
  assert.throws(() => scoreWeatherWindow('skydiving', windowSamples()));
  assert.equal(scoreWeatherWindow('walking', []).valid, false);
});

/* ---------- Ranking and coverage ---------- */
test('ranking is best-first and windows never overlap', () => {
  const data = readings(17, (i) => ({ temp: 10 + i, feels: 10 + i, pop: i % 4 === 0 ? 0.5 : 0 }));
  const found = findWeatherWindows('walking', data, { now: T0, tz: 0 });
  assert.equal(found.length, 3);
  for (let i = 1; i < found.length; i++) {
    assert.ok(found[i - 1].score >= found[i].score);
  }
  for (const a of found) {
    for (const b of found) {
      if (a !== b) assert.ok(a.end <= b.start || a.start >= b.end, 'windows overlap');
    }
    assert.equal(a.end - a.start, 3 * HOUR);
  }
});

test('an actually better period wins', () => {
  // Comfortable only for readings 4 to 6 (noon to 6 PM); cold elsewhere
  const data = readings(17, (i) => (i >= 4 && i <= 6 ? { temp: 20, feels: 20 } : { temp: -2, feels: -2 }));
  const [best] = findWeatherWindows('walking', data, { now: T0, tz: 0 });
  assert.ok(best.start >= T0 + 12 * HOUR && best.end <= T0 + 18 * HOUR);
});

test('no forecast data returns no windows', () => {
  assert.deepEqual(findWeatherWindows('walking', [], { now: T0 }), []);
  assert.deepEqual(findWeatherWindows('walking', undefined, { now: T0 }), []);
});

test('short coverage returns only the windows that fit, never fabricated ones', () => {
  const data = readings(3); // 6 hours of coverage fits exactly 2 non-overlapping windows
  const found = findWeatherWindows('walking', data, { now: T0, tz: 0 });
  assert.equal(found.length, 2);
  assert.deepEqual(findWeatherWindows('walking', readings(1), { now: T0, tz: 0 }), []);
});

test('windows stay inside coverage, the horizon, and never start in the past', () => {
  const data = readings(40);
  const now = T0 + 7.5 * HOUR;
  const found = findWeatherWindows('walking', data, { now, tz: 0, horizonHours: 24 });
  for (const w of found) {
    assert.ok(w.start >= now);
    assert.ok(w.end <= now + 24 * HOUR);
  }
});

test('a gap in the forecast cannot be spanned by a window', () => {
  const data = [...readings(3), ...readings(3, {}, T0 + 24 * HOUR)];
  const found = findWeatherWindows('walking', data, { now: T0, tz: 0, limit: 10 });
  for (const w of found) {
    const insideGap = w.start < T0 + 24 * HOUR && w.end > T0 + 6 * HOUR;
    assert.equal(insideGap, false);
  }
});

test('a stale forecast only yields future windows', () => {
  const data = readings(8); // ends 21 hours after T0
  assert.deepEqual(findWeatherWindows('walking', data, { now: T0 + 40 * HOUR, tz: 0 }), []);
});

/* ---------- Units and time zones ---------- */
test('results are metric: the engine has no display-unit input', () => {
  const r = scoreWeatherWindow('walking', windowSamples({ temp: 20, feels: 20, wind: 2 }));
  assert.equal(r.temp, 20);
  assert.equal(r.wind, 2);
});

test('hourly samples land on local whole hours in half-hour time zones', () => {
  const tz = 5.5 * HOUR; // India
  const series = buildHourlySeries(readings(4), { now: T0 + 10, tz });
  assert.ok(series.length > 0);
  for (const s of series) {
    const d = new Date((s.dt + tz) * 1000);
    assert.equal(d.getUTCMinutes(), 0);
    assert.equal(s.localHour, d.getUTCHours());
  }
});

test('hourly samples interpolate between readings without extrapolating', () => {
  const data = [reading(T0, { temp: 10 }), reading(T0 + 3 * HOUR, { temp: 16 })];
  const series = buildHourlySeries(data, { now: T0, tz: 0 });
  assert.deepEqual(series.map((s) => s.temp), [10, 12, 14, 16]);
  assert.equal(series[series.length - 1].dt, T0 + 3 * HOUR);
});

test('meal-time scoring uses the city clock, not UTC', () => {
  const warm = { temp: 23, feels: 23, wind: 1, gust: 2 };
  // 19:00 local in UTC+5:30 is 13:30 UTC
  const start = T0 + 13.5 * HOUR;
  const samples = Array.from({ length: 4 }, (_, i) => reading(start + i * HOUR, warm));
  const india = scoreWeatherWindow('dining', samples, { tz: 5.5 * HOUR });
  const utc = scoreWeatherWindow('dining', samples, { tz: 0 });
  assert.equal(india.breakdown.find((b) => b.key === 'timing').score, 100);
  assert.ok(utc.breakdown.find((b) => b.key === 'timing').score < 100);
});

test('windows can cross local midnight without breaking', () => {
  const samples = Array.from({ length: 4 }, (_, i) => reading(T0 + (22 + i) * HOUR));
  const r = scoreWeatherWindow('walking', samples);
  assert.equal(r.valid, true);
  assert.ok(r.reasons.some((x) => /Late-night/.test(x)));
});

/* ---------- Briefing ---------- */
const brief = (opts = {}) => generatePersonalBriefing({
  current: reading(T0, opts.current),
  forecast: opts.forecast || readings(9, {}, T0 + HOUR),
  aqi: opts.aqi === undefined ? { value: 40, label: 'Good', pm25: 5 } : opts.aqi,
  uv: opts.uv === undefined ? 2 : opts.uv,
  now: T0,
  format: opts.format || format
});
const find = (result, id) => result.insights.find((i) => i.id === id);

test('every insight has the fields the UI renders', () => {
  const result = brief();
  assert.equal(result.insights.length, 5);
  for (const i of result.insights) {
    for (const key of ['id', 'category', 'icon', 'title', 'explanation', 'action', 'severity']) assert.ok(i[key], `${i.id} ${key}`);
  }
});

test('attire follows feels-like temperature', () => {
  assert.match(find(brief({ current: { temp: 38, feels: 42 } }), 'outfit').title, /heat/);
  assert.match(find(brief({ current: { temp: 22, feels: 22 } }), 'outfit').title, /Light clothing/);
  assert.match(find(brief({ current: { temp: 15, feels: 14 } }), 'outfit').action, /jacket/);
  assert.match(find(brief({ current: { temp: 2, feels: -4 } }), 'outfit').title, /Bundle/);
});

test('attire explains wind chill', () => {
  assert.match(find(brief({ current: { temp: 8, feels: 3 } }), 'outfit').explanation, /wind/);
});

test('uv guidance follows the requested bands', () => {
  assert.match(find(brief({ uv: 1 }), 'uv').action, /Basic/);
  assert.match(find(brief({ uv: 4 }), 'uv').action, /sunscreen/i);
  assert.equal(find(brief({ uv: 7 }), 'uv').severity, 'medium');
  const high = find(brief({ uv: 9 }), 'uv');
  assert.equal(high.severity, 'high');
  assert.match(high.action, /Minimize/);
});

test('uv label agrees with the rounded number shown', () => {
  const uv = find(brief({ uv: 5.6 }), 'uv');
  assert.match(uv.explanation, /6/);
  assert.equal(uv.title, 'High UV');
});

test('elevated rain chance names the peak period and never promises rain', () => {
  const forecast = readings(9, (i) => (i === 3 ? { pop: 0.8, rain: 6 } : { pop: 0.05 }), T0 + HOUR);
  const rain = find(brief({ forecast }), 'rain');
  assert.match(rain.explanation, /80%/);
  assert.match(rain.explanation, /10:00/); // the reading at T0 + 10h
  assert.match(rain.action, /umbrella/i);
  assert.match(rain.action, /waterproof/i);
  assert.ok(!/will rain|guaranteed|definitely/i.test(`${rain.title} ${rain.explanation} ${rain.action}`));
});

test('dry forecasts say so', () => {
  const rain = find(brief({ forecast: readings(9, { pop: 0.05 }, T0 + HOUR) }), 'rain');
  assert.equal(rain.severity, 'low');
  assert.match(rain.title, /stay home/);
  assert.match(find(brief({ forecast: readings(9, { pop: 0 }, T0 + HOUR) }), 'rain').explanation, /No rain is forecast/);
});

test('rain falling now is mentioned even with a low forecast chance', () => {
  const current = { weather: { main: 'Rain', description: 'light rain', icon: '10d' } };
  const rain = find(brief({ current, forecast: readings(9, { pop: 0.1 }, T0 + HOUR) }), 'rain');
  assert.match(rain.explanation, /Light rain right now/);
});

test('high wind escalates and mentions cycling, without safety guarantees', () => {
  const forecast = readings(9, (i) => (i === 2 ? { wind: 10, gust: 14 } : {}), T0 + HOUR); // 50 km/h gust
  const wind = find(brief({ forecast }), 'wind');
  assert.equal(wind.severity, 'medium');
  assert.match(wind.action, /Cycling/);
  assert.match(wind.explanation, /50 km\/h/);
  assert.ok(!/\bsafe\b/i.test(wind.action));
  assert.equal(find(brief({ current: { wind: 15, gust: 20 } }), 'wind').severity, 'high');
});

test('air quality follows the US AQI bands and shows the real value', () => {
  const air = (value, label) => find(brief({ aqi: { value, label } }), 'air');
  assert.match(air(30, 'Good').action, /favorable/);
  assert.match(air(80, 'Moderate').action, /sensitive/);
  assert.equal(air(130, 'Unhealthy for sensitive groups').severity, 'medium');
  assert.equal(air(180, 'Unhealthy').severity, 'high');
  assert.match(air(320, 'Hazardous').action, /Avoid/);
  assert.match(air(320, 'Hazardous').explanation, /320/);
});

test('missing AQI and UV are named as unavailable, not filled in', () => {
  const result = brief({ aqi: null, uv: null });
  assert.equal(find(result, 'air'), undefined);
  assert.equal(find(result, 'uv'), undefined);
  assert.deepEqual(result.unavailable, ['Sun Protection', 'Air Quality']);
});

test('no current data yields an empty briefing', () => {
  assert.deepEqual(generatePersonalBriefing({ current: null, format }), { insights: [], unavailable: [] });
});

test('the most severe insights come first', () => {
  const result = brief({ uv: 11, current: { temp: 2, feels: -4 } });
  const order = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < result.insights.length; i++) {
    assert.ok(order[result.insights[i - 1].severity] <= order[result.insights[i].severity]);
  }
  assert.equal(result.insights[0].severity, 'high');
});

test('display units come only from the format helpers', () => {
  const imperial = {
    temp: (c) => `${Math.round((c * 9) / 5 + 32)}°F`,
    wind: (ms) => `${Math.round(ms * 2.237)} mph`,
    rain: (mm) => `${(mm / 25.4).toFixed(2)} in`,
    time: format.time
  };
  const metricResult = brief();
  const imperialResult = brief({ format: imperial });
  assert.match(find(imperialResult, 'outfit').explanation, /64°F/);
  assert.match(find(metricResult, 'outfit').explanation, /18°C/);
  assert.match(find(imperialResult, 'wind').explanation, /mph/);
  // Severity and advice do not change with the display unit
  assert.deepEqual(imperialResult.insights.map((i) => [i.id, i.severity, i.action]), metricResult.insights.map((i) => [i.id, i.severity, i.action]));
});

test('switching city produces a briefing from that city only', () => {
  const hot = brief({ current: { temp: 40, feels: 44 }, uv: 11 });
  const cold = brief({ current: { temp: -5, feels: -10 }, uv: 0 });
  assert.notEqual(find(hot, 'outfit').title, find(cold, 'outfit').title);
  assert.notEqual(find(hot, 'uv').severity, find(cold, 'uv').severity);
});

/* ---------- Freshness ---------- */
test('freshness distinguishes live from saved data', () => {
  const now = Date.UTC(2026, 5, 10, 12);
  assert.equal(describeFreshness(now - 20000, now).label, 'Forecast updated just now');
  assert.equal(describeFreshness(now - 5 * 60000, now).stale, false);
  const old = describeFreshness(now - 3 * 3600000, now);
  assert.equal(old.stale, true);
  assert.match(old.label, /Saved forecast from 3 hr ago/);
  assert.equal(describeFreshness(undefined, now).label, '');
});
