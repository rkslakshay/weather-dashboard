/**
 * SkyPulse insights: the Weather Window Finder and the Personal Weather Briefing.
 *
 * Pure, deterministic functions with no DOM or network access. All values are metric
 * internally (°C, m/s, mm, metres); units are only applied at display time through the
 * `format` helpers passed to the briefing, so results never depend on the selected unit.
 *
 * Input readings use the app's point shape:
 *   { dt, temp, feels, humidity, wind, gust, vis, clouds, pop, rain, snow, weather }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkyInsights = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const HOUR = 3600;
  const MS_TO_KMH = 3.6;

  /* ========================================================================
     Activity profiles: preferences, not safety thresholds
     ======================================================================== */
  const ACTIVITIES = {
    walking: {
      id: 'walking',
      label: 'Walking',
      temp: [15, 24],
      windMax: 25,
      popMax: 0.2,
      humidity: [30, 70],
      weights: { temp: 0.35, rain: 0.3, wind: 0.15, humidity: 0.15, gust: 0.05 },
      gustMax: 40,
      heatPenaltyFrom: 33
    },
    running: {
      id: 'running',
      label: 'Running',
      temp: [10, 18],
      windMax: 20,
      popMax: 0.15,
      humidity: [25, 65],
      weights: { temp: 0.4, rain: 0.2, wind: 0.15, humidity: 0.2, gust: 0.05 },
      gustMax: 35,
      heatPenaltyFrom: 27
    },
    cycling: {
      id: 'cycling',
      label: 'Cycling',
      temp: [14, 22],
      windMax: 15,
      popMax: 0.1,
      humidity: [25, 75],
      weights: { temp: 0.25, rain: 0.25, wind: 0.25, gust: 0.2, humidity: 0.05 },
      gustMax: 30,
      gustPenaltyFrom: 30,
      heatPenaltyFrom: 32
    },
    dining: {
      id: 'dining',
      label: 'Outdoor dining',
      temp: [20, 26],
      windMax: 12,
      popMax: 0.05,
      humidity: [30, 70],
      weights: { temp: 0.3, rain: 0.3, wind: 0.15, humidity: 0.05, timing: 0.2 },
      gustMax: 25,
      mealSlots: [[12, 14], [19, 22]],
      heatPenaltyFrom: 33
    }
  };

  const CATEGORIES = [
    { min: 85, id: 'optimal', label: 'Optimal' },
    { min: 70, id: 'good', label: 'Good' },
    { min: 50, id: 'fair', label: 'Fair' },
    { min: -Infinity, id: 'poor', label: 'Poor' }
  ];
  const categoryFor = (score) => CATEGORIES.find((c) => score >= c.min);

  const SEVERE_WEATHER = ['Thunderstorm', 'Tornado', 'Squall'];
  const QUIET_START = 22;
  const QUIET_END = 5;

  // 100 inside the preferred range, falling linearly to 0 at `falloff` beyond it
  const rangeScore = (v, [lo, hi], falloff) => {
    const distance = v < lo ? lo - v : v > hi ? v - hi : 0;
    return clamp(100 * (1 - distance / falloff), 0, 100);
  };
  // 100 up to the preferred maximum, falling linearly to 0 at `zeroAt`
  const ceilingScore = (v, max, zeroAt) => clamp(100 * (1 - (v - max) / (zeroAt - max)), 0, 100);

  /* ========================================================================
     Time helpers (city-local time from the UTC offset, in seconds)
     ======================================================================== */
  const localHourOf = (dt, tz) => new Date((dt + tz) * 1000).getUTCHours();
  const localDayKey = (dt, tz) => new Date((dt + tz) * 1000).toISOString().slice(0, 10);

  // Hours of [start, start + hours) that fall inside the local-hour range [from, to)
  function overlapHours(start, hours, tz, from, to) {
    let total = 0;
    for (let h = 0; h < hours; h++) {
      const local = localHourOf(start + h * HOUR, tz);
      if (local >= from && local < to) total += 1;
    }
    return total;
  }

  /* ========================================================================
     Hourly series
     ======================================================================== */
  const lerpField = (a, b, key, f) => (isNum(a[key]) && isNum(b[key]) ? a[key] + (b[key] - a[key]) * f : null);

  /**
   * Hourly samples at the top of each city-local hour, from `now` to the end of coverage.
   * The free forecast is 3-hourly, so values between two real readings are interpolated.
   * Nothing is extrapolated, and hours across a gap wider than `maxGapHours` are skipped,
   * which is what stops a window from spanning missing data.
   */
  function buildHourlySeries(readings, { now, tz = 0, horizonHours = 48, maxGapHours = 3.5 } = {}) {
    const sorted = (readings || []).filter((r) => r && isNum(r.dt)).sort((a, b) => a.dt - b.dt);
    if (!sorted.length) return [];
    const from = Math.max(isNum(now) ? now : sorted[0].dt, sorted[0].dt);
    const end = Math.min(sorted[sorted.length - 1].dt, from + horizonHours * HOUR);
    const samples = [];
    let i = 0;
    // First whole local hour at or after `from`
    let t = Math.ceil((from + tz) / HOUR) * HOUR - tz;
    for (; t <= end; t += HOUR) {
      while (i < sorted.length - 2 && sorted[i + 1].dt < t) i++;
      const a = sorted[i];
      const b = sorted[Math.min(i + 1, sorted.length - 1)];
      if (t < a.dt || t > b.dt || b.dt - a.dt > maxGapHours * HOUR) continue;
      const f = b.dt === a.dt ? 0 : (t - a.dt) / (b.dt - a.dt);
      const nearest = f < 0.5 ? a : b;
      samples.push({
        dt: t,
        localHour: localHourOf(t, tz),
        temp: lerpField(a, b, 'temp', f),
        feels: lerpField(a, b, 'feels', f),
        humidity: lerpField(a, b, 'humidity', f),
        wind: lerpField(a, b, 'wind', f),
        gust: lerpField(a, b, 'gust', f),
        pop: lerpField(a, b, 'pop', f),
        vis: lerpField(a, b, 'vis', f),
        rain: nearest.rain || 0,
        snow: nearest.snow || 0,
        weather: nearest.weather || null
      });
    }
    return samples;
  }

  /* ========================================================================
     Scoring
     ======================================================================== */
  const METRIC_LABELS = { temp: 'Temperature', rain: 'Rain chance', wind: 'Wind', gust: 'Gusts', humidity: 'Humidity', timing: 'Time of day' };

  function buildReasons(profile, sub, adjustments) {
    const good = {
      temp: `Comfortable temperature for ${profile.label.toLowerCase()}`,
      rain: 'Low chance of rain',
      wind: 'Light wind',
      gust: 'No strong gusts',
      humidity: 'Comfortable humidity',
      timing: 'Falls in a preferred mealtime'
    };
    const bad = {
      temp: `Outside the preferred temperature for ${profile.label.toLowerCase()}`,
      rain: 'Rain is a real possibility',
      wind: 'Windier than ideal',
      gust: 'Strong gusts expected',
      humidity: 'Humidity outside the comfortable range',
      timing: 'Outside the preferred mealtimes'
    };
    const entries = Object.entries(sub).map(([key, value]) => ({ key, value, weighted: value * profile.weights[key] }));
    const negatives = entries.filter((e) => e.value < 55).sort((a, b) => a.value - b.value).map((e) => bad[e.key]);
    const positives = entries.filter((e) => e.value >= 75).sort((a, b) => b.weighted - a.weighted).map((e) => good[e.key]);
    const notes = adjustments.map((a) => a.reason);
    return [...notes, ...negatives, ...positives].slice(0, 3);
  }

  /**
   * Scores one run of consecutive hourly samples for an activity.
   * Returns { valid: false, reason } when required data is missing, and never fills gaps
   * with zero or ideal values. Temperature, rain chance and wind are required; humidity
   * and gusts are optional and drop out of the weighted average when absent.
   */
  function scoreWeatherWindow(activity, hourlyForecast, { tz = 0 } = {}) {
    const profile = typeof activity === 'string' ? ACTIVITIES[activity] : activity;
    if (!profile) throw new Error(`Unknown activity: ${activity}`);
    const samples = hourlyForecast || [];
    if (samples.length < 2) return { valid: false, reason: 'Not enough forecast data' };

    for (let i = 1; i < samples.length; i++) {
      if (samples[i].dt - samples[i - 1].dt !== HOUR) return { valid: false, reason: 'Samples are not consecutive' };
    }
    const values = (key) => samples.map((s) => s[key]);
    const required = ['temp', 'pop', 'wind'];
    const missing = required.filter((key) => !values(key).every(isNum));
    if (missing.length) return { valid: false, reason: `Missing ${missing.join(', ')}` };

    const start = samples[0].dt;
    const end = samples[samples.length - 1].dt;
    const hours = (end - start) / HOUR;

    const temps = values('temp');
    const windKmh = values('wind').map((w) => w * MS_TO_KMH);
    const pops = values('pop');
    const gustKmh = values('gust').every(isNum) ? values('gust').map((g) => g * MS_TO_KMH) : null;
    const humidity = values('humidity').every(isNum) ? values('humidity') : null;
    const feels = values('feels').every(isNum) ? values('feels') : temps;
    const popMax = Math.max(...pops);

    const sub = {
      temp: mean(temps.map((t) => rangeScore(t, profile.temp, 15))),
      rain: ceilingScore(popMax, profile.popMax, profile.popMax + 0.6),
      wind: ceilingScore(mean(windKmh), profile.windMax, profile.windMax * 2.5)
    };
    if (humidity && profile.weights.humidity) sub.humidity = rangeScore(mean(humidity), profile.humidity, 30);
    if (gustKmh && profile.weights.gust) sub.gust = ceilingScore(Math.max(...gustKmh), profile.gustMax, profile.gustMax * 2);
    if (profile.mealSlots) {
      const best = Math.max(...profile.mealSlots.map(([from, to]) => overlapHours(start, hours, tz, from, to) / Math.min(hours, to - from)));
      sub.timing = clamp(best, 0, 1) * 100;
    }

    // Weighted average over the metrics that actually have data
    let weighted = 0;
    let totalWeight = 0;
    for (const [key, value] of Object.entries(sub)) {
      weighted += value * profile.weights[key];
      totalWeight += profile.weights[key];
    }
    const base = weighted / totalWeight;

    // Explicit deductions for conditions a weighted average would otherwise hide
    const adjustments = [];
    const conditions = samples.map((s) => (s.weather ? s.weather.main : ''));
    const maxGust = gustKmh ? Math.max(...gustKmh) : null;
    const maxFeels = Math.max(...feels);
    const minFeels = Math.min(...feels);
    const minVis = values('vis').every(isNum) ? Math.min(...values('vis')) : null;

    if (conditions.some((c) => SEVERE_WEATHER.includes(c))) adjustments.push({ points: -60, reason: 'Storms in the forecast for this period' });
    else if (conditions.includes('Snow')) adjustments.push({ points: -25, reason: 'Snow in the forecast for this period' });
    else if (conditions.some((c) => c === 'Rain' || c === 'Drizzle')) adjustments.push({ points: -15, reason: 'Rain in the forecast for this period' });

    if (maxFeels >= profile.heatPenaltyFrom) adjustments.push({ points: -Math.min(30, 10 + (maxFeels - profile.heatPenaltyFrom) * 2), reason: 'High heat for this activity' });
    if (minFeels <= 0) adjustments.push({ points: -15, reason: 'Feels below freezing' });
    if (profile.gustPenaltyFrom && maxGust !== null && maxGust > profile.gustPenaltyFrom) {
      adjustments.push({ points: -Math.min(25, 10 + (maxGust - profile.gustPenaltyFrom)), reason: `Gusts above ${profile.gustPenaltyFrom} km/h` });
    }
    if (minVis !== null && minVis < 1000) adjustments.push({ points: -15, reason: 'Low visibility' });

    if (!profile.mealSlots) {
      const quiet = overlapHours(start, hours, tz, QUIET_START, 24) + overlapHours(start, hours, tz, 0, QUIET_END);
      if (quiet > 0) adjustments.push({ points: -Math.round(35 * (quiet / hours)), reason: 'Late-night or very early hours' });
    }

    const penalty = adjustments.reduce((sum, a) => sum + a.points, 0);
    const score = Math.round(clamp(base + penalty, 0, 100));
    const middle = samples[Math.floor(samples.length / 2)];
    const isWarning = (a) => a.points <= -15;

    return {
      valid: true,
      activity: profile.id,
      start,
      end,
      score,
      category: categoryFor(score),
      temp: mean(temps),
      feels: mean(feels),
      pop: popMax,
      wind: mean(values('wind')),
      gust: gustKmh ? Math.max(...values('gust')) : null,
      humidity: humidity ? mean(humidity) : null,
      weather: middle.weather,
      rainMm: Math.max(...samples.map((s) => s.rain || 0)),
      snowMm: Math.max(...samples.map((s) => s.snow || 0)),
      reasons: buildReasons(profile, sub, adjustments.filter(isWarning)),
      breakdown: Object.entries(sub).map(([key, value]) => ({ key, label: METRIC_LABELS[key], score: Math.round(value), weight: profile.weights[key] })),
      adjustments,
      missing: [gustKmh ? null : 'gusts', humidity ? null : 'humidity'].filter(Boolean)
    };
  }

  /**
   * Ranks non-overlapping 3-hour windows inside forecast coverage. Returns only windows
   * that have real data, so fewer than `limit` come back when coverage is short.
   */
  function findWeatherWindows(activity, readings, { now, tz = 0, horizonHours = 48, windowHours = 3, limit = 3 } = {}) {
    const series = buildHourlySeries(readings, { now, tz, horizonHours });
    const scored = [];
    for (let i = 0; i + windowHours < series.length; i++) {
      const result = scoreWeatherWindow(activity, series.slice(i, i + windowHours + 1), { tz });
      if (result.valid) scored.push(result);
    }
    scored.sort((a, b) => b.score - a.score || a.start - b.start);
    const picked = [];
    for (const w of scored) {
      if (picked.every((p) => w.end <= p.start || w.start >= p.end)) picked.push(w);
      if (picked.length === limit) break;
    }
    return picked;
  }

  /* ========================================================================
     Personal briefing
     ======================================================================== */
  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

  function outfitInsight(current, f) {
    const feels = isNum(current.feels) ? current.feels : current.temp;
    if (!isNum(feels)) return null;
    let severity = 'low';
    let title;
    let action;
    if (feels >= 35) { severity = 'high'; title = 'Dress for serious heat'; action = 'Wear loose, light-colored, breathable clothing and carry water.'; }
    else if (feels >= 28) { severity = 'medium'; title = 'Warm and light'; action = 'Choose breathable fabrics and short sleeves.'; }
    else if (feels >= 20) { title = 'Light clothing weather'; action = 'A T-shirt or light top should be comfortable.'; }
    else if (feels >= 12) { title = 'Bring a light layer'; action = 'A light jacket or sweater should be enough.'; }
    else if (feels >= 3) { severity = 'medium'; title = 'Layer up'; action = 'Wear warm layers and a proper jacket.'; }
    else { severity = 'high'; title = 'Bundle up'; action = 'Wear a heavy coat, and cover your hands and head.'; }

    let explanation = `It feels like ${f.temp(feels)}`;
    const actual = current.temp;
    if (isNum(actual) && feels <= actual - 3) explanation += `, colder than the actual ${f.temp(actual)} because of the wind`;
    else if (isNum(actual) && feels >= actual + 3) explanation += `, warmer than the actual ${f.temp(actual)} because of the humidity`;
    else if (isNum(current.humidity) && current.humidity >= 75 && feels >= 24) explanation += ` with ${Math.round(current.humidity)}% humidity`;
    return { id: 'outfit', category: 'Outfit & Comfort', icon: 'i-thermo', title, explanation: `${explanation}.`, action, severity };
  }

  function rainInsight(current, next24, f) {
    const known = next24.filter((p) => isNum(p.pop));
    if (!known.length) return null;
    const kindOf = (p) => (p.weather && p.weather.main === 'Snow' ? 'snow' : 'rain');
    const hasSnow = known.some((p) => kindOf(p) === 'snow');
    const word = hasSnow ? 'snow' : 'rain';
    const main = current.weather ? current.weather.main : '';
    const fallingNow = ['Rain', 'Drizzle', 'Thunderstorm', 'Snow'].includes(main);
    const peak = known.reduce((best, p) => (p.pop > best.pop ? p : best), known[0]);
    const peakPct = Math.round(peak.pop * 100);
    const totalMm = known.reduce((sum, p) => sum + (p.rain || 0) + (p.snow || 0), 0);

    if (!fallingNow && peak.pop < 0.25) {
      return {
        id: 'rain',
        category: 'Rain & Umbrella',
        icon: 'i-umbrella',
        title: 'Umbrella can stay home',
        explanation: peakPct < 5 ? `No ${word} is forecast for the next 24 hours.` : `The chance of ${word} stays at or below ${peakPct}% over the next 24 hours.`,
        action: 'No rain gear looks necessary based on this forecast.',
        severity: 'low'
      };
    }

    // Longest stretch around the peak where the chance stays elevated
    const elevated = Math.max(0.25, peak.pop * 0.7);
    let i = known.indexOf(peak);
    let j = i;
    while (i > 0 && known[i - 1].pop >= elevated) i--;
    while (j < known.length - 1 && known[j + 1].pop >= elevated) j++;
    const from = known[i].dt;
    const to = known[j].dt + 3 * HOUR;
    const when = `${f.time(from)}–${f.time(to)}`;

    const needsWaterproof = totalMm >= 5 || main === 'Thunderstorm';
    const severity = fallingNow || peak.pop >= 0.6 ? (needsWaterproof ? 'high' : 'medium') : 'low';
    const lead = fallingNow ? `${current.weather.description.charAt(0).toUpperCase()}${current.weather.description.slice(1)} right now. ` : '';
    const amount = totalMm >= 0.5 ? ` About ${f.rain(totalMm)} is forecast over 24 hours.` : '';
    let action;
    if (needsWaterproof) action = 'Take an umbrella, and waterproof clothing may be useful.';
    else if (peak.pop >= 0.5 || fallingNow) action = hasSnow ? 'Waterproof shoes and a warm hat may help.' : 'An umbrella is advisable if you are heading out.';
    else action = 'Consider a compact umbrella as a precaution.';
    return {
      id: 'rain',
      category: 'Rain & Umbrella',
      icon: 'i-umbrella',
      title: peak.pop >= 0.6 || fallingNow ? `${word === 'snow' ? 'Snow' : 'Rain'} is likely` : `Some chance of ${word}`,
      explanation: `${lead}Highest chance ${peakPct}%, around ${when}.${amount}`,
      action,
      severity
    };
  }

  function uvInsight(uv) {
    if (!isNum(uv)) return null;
    const value = Math.round(uv);
    const explanation = `Today's reported UV index is ${value}.`;
    const base = { id: 'uv', category: 'Sun Protection', icon: 'i-sun', explanation };
    // Bands use the rounded value that is displayed, so the label and number always agree
    if (value < 3) return { ...base, title: 'Low UV', action: 'Basic precautions are enough for most people.', severity: 'low' };
    if (value < 6) return { ...base, title: 'Moderate UV', action: 'Use sunscreen and sunglasses for longer periods outside.', severity: 'low' };
    if (value < 8) return { ...base, title: 'High UV', action: 'Use sunscreen, a hat and sunglasses, and seek shade when you can.', severity: 'medium' };
    return { ...base, title: 'Very high UV', action: 'Minimize prolonged unprotected exposure and reapply sunscreen.', severity: 'high' };
  }

  // Expects the US AQI value and label that the air quality tile displays
  function airInsight(aqi) {
    if (!aqi || !isNum(aqi.value)) return null;
    const v = aqi.value;
    const pm = isNum(aqi.pm25) ? ` PM2.5 is ${Math.round(aqi.pm25)} µg/m³.` : '';
    const explanation = `US AQI is ${v} (${aqi.label}).${pm}`;
    const base = { id: 'air', category: 'Air Quality', icon: 'i-leaf', explanation };
    if (v <= 50) return { ...base, title: 'Clean air', action: 'Generally favorable for outdoor activity.', severity: 'low' };
    if (v <= 100) return { ...base, title: 'Moderate air quality', action: 'Unusually sensitive people may want to ease off long outdoor exertion.', severity: 'low' };
    if (v <= 150) return { ...base, title: 'Unhealthy for sensitive groups', action: 'Sensitive groups should reduce prolonged outdoor exertion.', severity: 'medium' };
    if (v <= 200) return { ...base, title: 'Unhealthy air', action: 'Reduce prolonged outdoor exertion, especially if you are in a sensitive group.', severity: 'high' };
    return { ...base, title: 'Air quality of serious concern', action: 'Avoid prolonged outdoor exertion and consider staying indoors.', severity: 'high' };
  }

  function windInsight(current, next24, f) {
    const kmh = (ms) => ms * MS_TO_KMH;
    const all = [current, ...next24].filter((p) => isNum(p.wind));
    if (!all.length) return null;
    const strength = (p) => (isNum(p.gust) ? p.gust : p.wind);
    const peak = all.reduce((best, p) => (strength(p) > strength(best) ? p : best), all[0]);
    const peakKmh = kmh(strength(peak));
    const sustained = isNum(current.wind) ? f.wind(current.wind) : null;
    const lead = sustained ? `Wind is ${sustained} now` : 'Wind is not reported right now';
    const gustText = `${lead}, with ${isNum(peak.gust) ? 'gusts' : 'wind'} up to ${f.wind(strength(peak))} ${peak === current ? 'at the moment' : `around ${f.time(peak.dt)}`}.`;
    const base = { id: 'wind', category: 'Wind & Outdoor Activities', icon: 'i-wind', explanation: gustText };
    if (peakKmh >= 60) return { ...base, title: 'Very strong wind', action: 'Secure loose items and consider postponing exposed outdoor plans.', severity: 'high' };
    if (peakKmh >= 40) return { ...base, title: 'Strong gusts', action: 'Cycling may be uncomfortable, and outdoor seating less pleasant.', severity: 'medium' };
    if (peakKmh >= 25) return { ...base, title: 'Breezy at times', action: 'Cyclists may notice it; most other plans should be fine.', severity: 'low' };
    return { ...base, title: 'Light wind', action: 'Good conditions for cycling and outdoor plans as far as wind goes.', severity: 'low' };
  }

  /**
   * Builds the briefing from real data only. Sections with no data are left out and named
   * in `unavailable` rather than filled with generic text. `format` supplies display
   * strings: { temp(c), wind(ms), rain(mm), time(dt) }.
   */
  function generatePersonalBriefing({ current, forecast = [], aqi = null, uv = null, now, format }) {
    if (!current || !format) return { insights: [], unavailable: [] };
    const start = isNum(now) ? now : current.dt;
    const next24 = forecast.filter((p) => p && isNum(p.dt) && p.dt >= start - 3 * HOUR && p.dt <= start + 24 * HOUR && !p.isCurrent);
    const candidates = [
      ['Outfit & Comfort', outfitInsight(current, format)],
      ['Rain & Umbrella', rainInsight(current, next24, format)],
      ['Sun Protection', uvInsight(uv)],
      ['Air Quality', airInsight(aqi)],
      ['Wind & Outdoor Activities', windInsight(current, next24, format)]
    ];
    const insights = candidates
      .map(([, insight]) => insight)
      .filter(Boolean)
      .map((insight, index) => ({ insight, index }))
      .sort((a, b) => SEVERITY_ORDER[a.insight.severity] - SEVERITY_ORDER[b.insight.severity] || a.index - b.index)
      .map((x) => x.insight);
    return { insights, unavailable: candidates.filter(([, insight]) => !insight).map(([name]) => name) };
  }

  /* ========================================================================
     Data freshness
     ======================================================================== */
  const STALE_AFTER_MINUTES = 60;

  function describeFreshness(fetchedAtMs, nowMs) {
    if (!isNum(fetchedAtMs)) return { stale: false, label: '' };
    const minutes = Math.max(0, Math.round((nowMs - fetchedAtMs) / 60000));
    const stale = minutes >= STALE_AFTER_MINUTES;
    let age;
    if (minutes < 1) age = 'just now';
    else if (minutes < 60) age = `${minutes} min ago`;
    else if (minutes < 48 * 60) age = `${Math.round(minutes / 60)} hr ago`;
    else age = `${Math.round(minutes / 1440)} days ago`;
    return { stale, minutes, label: stale ? `Saved forecast from ${age}` : `Forecast updated ${age}` };
  }

  return {
    ACTIVITIES,
    CATEGORIES,
    categoryFor,
    localDayKey,
    buildHourlySeries,
    scoreWeatherWindow,
    findWeatherWindows,
    generatePersonalBriefing,
    describeFreshness
  };
});
