// Configuration: Base URLs for GeoJSON forecast files
// Files are named as: YYYYMMDD_forecast.geojson (e.g., 20251124_forecast.geojson)
// Each directory contains daily forecast files for different data sources

// DoS Missions forecast data directory
export const GEOJSON_DEF =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/aws_output/DoS/";
// AERONET forecast data directory
export const GEOJSON_ARNT =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/aws_output/AERONET/";
// OpenAQ forecast data directory
export const GEOJSON_AQ =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/aws_output/OpenAQ/";
// African AQE forecast data directory
export const GEOJSON_AAQE =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/aws_output/AAQE/";

// OpenAQ API base URL for measurement data
export const OPENAQ_API_BASE = "/aqi/openaq";
