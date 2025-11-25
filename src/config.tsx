// Configuration: Base URLs for GeoJSON forecast files
// Files are named as: YYYYMMDD_forecast.geojson (e.g., 20251124_forecast.geojson)
// Each directory contains daily forecast files for different data sources

// DoS Missions forecast data directory
export const GEOJSON_DEF =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/output_DoS_geoJSON/";
// AERONET forecast data directory
export const GEOJSON_ARNT =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/output_AERONET_geoJSON/";
// OpenAQ forecast data directory
export const GEOJSON_AQ =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/output_OpenAQ_geoJSON/";
// African AQE forecast data directory
export const GEOJSON_AAQE =
  "https://aeronet.gsfc.nasa.gov/data_push/AQI/output_AAQE_geoJSON/";
