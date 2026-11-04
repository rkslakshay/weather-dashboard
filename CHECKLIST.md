# SkyPulse — Feature Checklist

Status of **SkyPulse — An Intelligent Weather Dashboard with Personalized Insights**. An item is only checked if it was verified. "Tested" means the automated tests in `test/insights.test.js`; "browser" means checked in a browser against live forecast data.

---

## Weather Window Finder
- [x] Walking, running, cycling and outdoor dining profiles with their own weights (tested)
- [x] `scoreWeatherWindow`: explainable, deterministic score out of 100 with categories (tested)
- [x] Consecutive 3-hour windows from hourly samples interpolated between 3-hour readings (tested)
- [x] Missing values are never treated as zero or ideal (tested)
- [x] No windows outside forecast coverage, in the past, or across data gaps (tested)
- [x] Top 3 non-overlapping windows, and fewer when coverage is short (tested)
- [x] Metric internally, with display units applied only for presentation (tested, browser)
- [x] City-local dates, half-hour time zones and midnight boundaries (tested)
- [x] Activity tabs, ranked cards, categories, icons and expandable reasoning (browser)
- [x] No-data and all-poor states, and forecast freshness (browser)
- [ ] Loading and first-load error states: implemented, but only reviewed in code, not exercised in a browser
- [x] Selecting a window moves the existing timeline and highlights the period (browser)
- [x] Air quality in scoring, using the API's 1-5 index with activity-specific limits and warnings (tested, browser)
- [x] Missing air quality is not treated as good, and rules out Optimal (tested)
- [x] Hard limits for storms, extreme heat and cold, very strong wind and heavy rain (tested)
- [x] Hourly estimates are labelled separately from API readings in the timeline, cards, chart and PDF (tested, browser)

## Personal Weather Briefing
- [x] Outfit, rain, sun, air quality and wind guidance from `generatePersonalBriefing` (tested)
- [x] Severity ordering, and missing UV or AQI left out rather than invented (tested, browser)
- [x] Updates on city, saved-place, recent-place and unit changes, and a fast double search ends on the last city (browser)
- [ ] Peak UV hour: not possible, because the API provides one daily UV value

## Forecast Analytics (Chart.js 4.4.1, bundled locally)
- [x] Temperature, rain chance and optional wind on separate axes (browser)
- [x] 24-hour and full-forecast views, and legend (browser)
- [x] Follows units, and shows a message if the library can't load (browser)
- [x] The SVG timeline remains the primary forecast view (browser)

## PDF Report
- [x] Conditions, briefing, top windows, forecast table and chart for the selected city and units (browser, generated through html2pdf and inspected)
- [x] Fits A4 width, and each section stays whole on an explicit page, because html2pdf's page-break plugin cut off the chart on long reports (browser, verified in the saved file)
- [x] Fixed: reports came out blank when the page was scrolled (browser)
- [x] Saved PDF bytes from the real export button parsed and rendered with pdf.js, not just the HTML (browser)
- [ ] Opened in a desktop PDF viewer such as Acrobat: not checked
- [ ] Selectable text: not available, because html2pdf embeds each page as an image

## PWA & Offline
- [x] New files precached; app shell loads with the server stopped (browser)
- [x] Saved forecast is used when the network fails, labelled with its age (browser)
- [x] API responses stay network-first; map tiles are not cached (code review)
- [ ] Installed-app behavior on a real phone: not checked

## Existing Features
- [x] Live conditions, forecast, SVG timeline and sky scene (browser)
- [x] Search, autocomplete, favorites and city comparison (browser)
- [x] Weather map renders; layer toggle state updates (browser)
- [x] °C/°F, and light and dark themes including the chart redraw (browser)
- [x] API key kept server-side through `api/weather.js` (code review)
- [x] No horizontal overflow at 375px; layout checked at 1280px (browser)
- [ ] Geolocation button: needs a permission prompt, not exercised
- [ ] Touch swiping on a real phone: not checked

## Removed Earlier
These were in older versions of this checklist and are no longer in the app: the pollen card (invented data), "official" weather advisories (replaced by plainly labelled guidance), and the pressure trend (it compared different cities).
