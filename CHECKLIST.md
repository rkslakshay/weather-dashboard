# SkyPulse — Feature Checklist

Status of **SkyPulse — An Intelligent Weather Dashboard with Personalized Insights**. An item is only checked if it was verified. "Tested" means the automated tests in `test/`; "browser" means checked in a browser on a local server, running the same code against live forecast data.

**Hosted deployments:** weather loading, search, all four activities, timeline sync, PDF generation and console and network errors were also checked on production, at merge commit `14fbcd5`. Unit switching, saved places, comparison and map tiles were checked on the Vercel preview of the same code.

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
- [x] No-data, all-poor and first-load error states, and forecast freshness (browser)
- [ ] Loading skeletons while requests are in flight: seen on the failed-load screen; not timed on a slow connection
- [x] Selecting a window moves the existing timeline and highlights the period (browser)
- [x] Air quality in scoring, using the API's 1-5 index with activity-specific limits and warnings (tested, browser)
- [x] Missing air quality is not treated as good, and rules out Optimal (tested)
- [x] Hard limits for storms, extreme heat and cold, very strong wind and heavy rain (tested, browser with simulated conditions)
- [ ] A real thunderstorm in live data: scoring and the sky are tested with simulated conditions only
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
- [x] Fixed: export froze if the page wasn't painting, as in a background tab (browser)
- [x] Saved PDF bytes from the real export button parsed and rendered with pdf.js, not just the HTML (browser)
- [x] A real production export saved to disk is a valid 3-page PDF (`%PDF` header, `%%EOF` trailer, page count)
- [x] The confirmation no longer claims the file was saved, since the browser controls that step (tested)
- [ ] Opened in a desktop PDF viewer such as Acrobat: not checked
- [ ] Download timing in a normal Chrome window on production: awaiting a manual check
- [ ] Selectable text: not available, because html2pdf embeds each page as an image

## PWA & Offline
- [x] New files precached; app shell loads with the server stopped (browser)
- [x] Saved forecast is used when the network fails, labelled with its age (browser, simulated by stopping the server and removing the local key)
- [x] API responses stay network-first; map tiles are not cached (code review)
- [ ] Installed-app behavior on a real phone: not checked

## Existing Features
- [x] Live conditions, forecast, SVG timeline and sky scene (browser)
- [x] Search, autocomplete, favorites and city comparison (browser)
- [x] Weather map renders; all four layers return image tiles through the proxy (browser)
- [x] Polar day and night: no invented sunrise, and the sky follows the API's day/night flag (browser)
- [x] °C/°F, and light and dark themes including the chart redraw (browser)
- [x] The sky scene contains its overflow, so the hero can't be scrolled sideways (tested, browser)
- [x] API key kept server-side through `api/weather.js`; can't be overridden and isn't returned (tested, code review)
- [x] No horizontal overflow at 375px and 768px; layout checked at 1280px (browser)
- [x] Location button: denial, timeout and success handling, using a simulated browser location (browser)
- [ ] Location button with a real browser permission prompt: not checked
- [ ] Touch swiping on a real phone: not checked

## Removed Earlier
These were in older versions of this checklist and are no longer in the app: the pollen card (invented data), "official" weather advisories (replaced by plainly labelled guidance), and the pressure trend (it compared different cities).
