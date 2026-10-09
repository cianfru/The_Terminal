// SPX City's own site (open to everyone since 2026-10-09). One constant so the announcement card and
// every menu link point at the same place.
export const CITY_SITE = "https://spxcity.com";
export const CITY_SITE_LABEL = "spxcity.com ↗";
export const openCitySite = () => { try { window.open(CITY_SITE, "_blank", "noopener,noreferrer"); } catch { /* popup blocked */ } };
