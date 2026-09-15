// Configuration: Base URLs for GeoJSON forecast files
// Files are named as: YYYYMMDD_forecast.geojson (e.g., 20251124_forecast.geojson)
// Each directory contains daily forecast files for different data sources

// DoS Missions forecast data directory
export const GEOJSON_DEF =
  "https://aeronet.gsfc.nasa.gov/aws_aq_forecast/DoS/";
// AERONET forecast data directory
export const GEOJSON_ARNT =
  "https://aeronet.gsfc.nasa.gov/aws_aq_forecast/AERONET/";
// OpenAQ forecast data directory
export const GEOJSON_AQ =
  "https://aeronet.gsfc.nasa.gov/aws_aq_forecast/OpenAQ/";
// African AQE forecast data directory
export const GEOJSON_AAQE =
  "https://aeronet.gsfc.nasa.gov/aws_aq_forecast/AAQE/";

// OpenAQ API base URL for measurement data
export const OPENAQ_API_BASE = "/aqi/openaq";
