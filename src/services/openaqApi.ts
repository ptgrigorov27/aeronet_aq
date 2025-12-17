/**
 * OpenAQ API Service
 * 
 * Fetches hourly PM2.5 measurement data from OpenAQ Platform API
 * API Documentation: https://explore.openaq.org/developers
 */

import axios from 'axios';

// ============================================================================
// PRODUCTION DEPLOYMENT NOTE:
// - Development: Uses Vite proxy (/api/openaq) to avoid CORS
// - Production: Uses direct API URL (https://api.openaq.org/v3)
// This switches automatically based on import.meta.env.DEV
// ============================================================================

// OpenAQ API base URL
// In development, use proxy to avoid CORS issues
// In production, use direct API URL (CORS won't be an issue on same domain)
// const isDevelopment = import.meta.env.DEV;
// IMPORTANT: The proxy rewrites /api/openaq -> /v3, so we should NOT include /v3 in the path
// Request: /api/openaq/sensors/123 -> Proxy rewrites to: /v3/sensors/123 -> Forwarded to: https://api.openaq.org/v3/sensors/123
// const OPENAQ_API_BASE = isDevelopment 
//   ? '/api/openaq'  // Use Vite proxy in development (proxy adds /v3 prefix)
//   : 'https://api.openaq.org/v3';  // Direct API in production (includes /v3)

const OPENAQ_API_BASE = "/api/openaq";

// Log base URL only in development
//if (import.meta.env.DEV) {
//  console.log('[OpenAQ API] Base URL:', OPENAQ_API_BASE, 'isDevelopment:', isDevelopment);
//}

// Get API key from environment variable
const API_KEY = import.meta.env.VITE_OPENAQ_API_KEY;

export interface OpenAQMeasurement {
  locationId: number;
  location: string;
  parameter: string;
  value: number;
  unit: string;
  date: {
    utc: string;
    local: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  country: string;
  city?: string;
}

export interface OpenAQLocation {
  id: number;
  name: string;
  locality?: string;
  timezone: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  sensors?: OpenAQSensor[];
}

export interface OpenAQSensor {
  id: number;
  name: string;
  parameter: {
    id: number;
    name: string;
    units: string;
    displayName?: string;
  };
}

/**
 * Fetch hourly PM2.5 measurements for a specific date
 * OpenAQ API v3 structure requires: locations -> sensors -> measurements
 * @param date - Date to fetch measurements for (YYYY-MM-DD format)
 * @param limit - Maximum number of locations to process (default: 1000)
 * @returns Array of PM2.5 measurements grouped by location
 */
export async function fetchHourlyPM25(
  date: string,
  limit: number = 1000
): Promise<OpenAQMeasurement[]> {
  if (!API_KEY) {
    throw new Error('OpenAQ API key not found. Please set VITE_OPENAQ_API_KEY in your .env file.');
  }

  try {
    // Format date for API (date_from and date_to for the specific day)
    const dateFrom = `${date}T00:00:00Z`;
    const dateTo = `${date}T23:59:59Z`;

    const headers: { [key: string]: string } = {};
    if (API_KEY) {
      headers['X-API-Key'] = API_KEY;
    }

    // Step 1: Fetch locations (which includes sensors info)
    // Start with fewer locations for instant display, then load more in background
    const maxLocations = Math.min(limit, 25); // Reduced to 25 for faster initial load
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log(`[OpenAQ API] Fetching locations (limited to ${maxLocations})...`);
    }
    
    const locationsResponse = await axios.get(`${OPENAQ_API_BASE}/locations`, {
      params: {
        limit: maxLocations,
        page: 1,
      },
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      timeout: 30000,
    });

    const locations = locationsResponse.data?.results || [];
    
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log(`[OpenAQ API] Found ${locations.length} locations`);
    }

    // Step 2: For each location, find PM2.5 sensors and fetch measurements
    const allMeasurements: OpenAQMeasurement[] = [];

    // Process locations in batches - smaller batches for faster initial display
    const batchSize = 5; // Process 5 at a time for better parallelization
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize);
      const batchPromises = batch.map(async (location: OpenAQLocation) => {
        // Find PM2.5 sensors for this location
        const pm25Sensors = location.sensors?.filter(
          (sensor: OpenAQSensor) => sensor.parameter.name === 'pm25'
        ) || [];

        if (pm25Sensors.length === 0) return [];

        // Fetch measurements for each PM2.5 sensor
        const sensorMeasurements = await Promise.all(
          pm25Sensors.map(async (sensor: OpenAQSensor, sensorIndex: number) => {
            // Reduced delay for faster loading - process sensors in parallel within location
            // Only add small delay between sensors if multiple sensors per location
            if (sensorIndex > 0 && pm25Sensors.length > 1) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Reduced to 100ms for faster loading
            }
            try {
              const measurementsUrl = `${OPENAQ_API_BASE}/sensors/${sensor.id}/measurements`;
              const response = await axios.get(measurementsUrl, {
                params: {
                  date_from: dateFrom,
                  date_to: dateTo,
                  limit: 100, // Limit per sensor
                  page: 1,
                },
                headers: Object.keys(headers).length > 0 ? headers : undefined,
                timeout: 15000,
              });

              const measurements = response.data?.results || [];
              // Format measurements to include location info
              return measurements.map((m: any) => ({
                locationId: location.id,
                location: location.name,
                parameter: 'pm25',
                value: m.value,
                unit: sensor.parameter.units,
                date: m.period?.datetimeFrom || { utc: dateFrom, local: dateFrom },
                coordinates: location.coordinates,
                country: location.country,
                city: location.locality,
              }));
            } catch (error: any) {
              // Handle rate limiting (429) gracefully
              if (error.response?.status === 429) {
                console.warn(`Rate limited for sensor ${sensor.id}, skipping...`);
                // Wait longer before continuing
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                console.warn(`Failed to fetch measurements for sensor ${sensor.id}:`, error.message);
              }
              return [];
            }
          })
        );

        return sensorMeasurements.flat();
      });

      const batchResults = await Promise.all(batchPromises);
      allMeasurements.push(...batchResults.flat());

      // Smaller delay between batches for faster loading
      // Still respect rate limits but prioritize speed
      if (i + batchSize < locations.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced to 200ms for faster loading
      }
    }

    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log(`[OpenAQ API] Fetched ${allMeasurements.length} total measurements for ${date}`);
    }
    return allMeasurements;
  } catch (error: any) {
    console.error('Error fetching OpenAQ measurements:', error);
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your VITE_OPENAQ_API_KEY in .env file.');
    }
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    throw new Error(`Failed to fetch OpenAQ data: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Fetch available locations that have PM2.5 data
 * @param limit - Maximum number of locations to return (default: 10000)
 * @returns Array of locations
 */
export async function fetchLocations(limit: number = 10000): Promise<OpenAQLocation[]> {
  if (!API_KEY) {
    throw new Error('OpenAQ API key not found. Please set VITE_OPENAQ_API_KEY in your .env file.');
  }

  try {
      const headers: { [key: string]: string } = {};
      // Always send API key header (proxy will forward it in dev)
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }

      const response = await axios.get(`${OPENAQ_API_BASE}/locations`, {
        params: {
          limit: limit,
          page: 1,
        },
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        timeout: 30000,
      });

    if (response.data && response.data.results) {
      return response.data.results;
    }

    return [];
  } catch (error: any) {
    console.error('Error fetching OpenAQ locations:', error);
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your VITE_OPENAQ_API_KEY in .env file.');
    }
    throw new Error(`Failed to fetch OpenAQ locations: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get available dates for measurements (checks last N days for data availability)
 * @param daysBack - Number of days to check backwards from today (default: 30)
 * @returns Array of dates (YYYY-MM-DD format) that have data
 */
export async function getAvailableDates(daysBack: number = 30): Promise<string[]> {
  if (!API_KEY) {
    throw new Error('OpenAQ API key not found. Please set VITE_OPENAQ_API_KEY in your .env file.');
  }

  const availableDates: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Check each day going backwards
  for (let i = 0; i < daysBack; i++) {
    const checkDate = new Date(today);
    checkDate.setUTCDate(checkDate.getUTCDate() - i);
    const dateString = checkDate.toISOString().split('T')[0];

    try {
      const headers: { [key: string]: string } = {};
      // Always send API key header (proxy will forward it in dev)
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }

      // Use locations endpoint to check if any location has PM2.5 sensors
      // This is a simpler check than fetching all measurements
      const response = await axios.get(`${OPENAQ_API_BASE}/locations`, {
        params: {
          limit: 10, // Just check first few locations
          page: 1,
        },
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        timeout: 10000,
      });

      // Check if any location has PM2.5 sensors (basic check)
      // Note: This is a simplified check - full implementation would verify measurements exist
      if (response.data && response.data.results && response.data.results.length > 0) {
        // For now, just check if locations exist (full verification would check sensors/measurements)
        availableDates.push(dateString);
      }
    } catch (error) {
      // Skip dates that fail or have no data
      continue;
    }
  }

  return availableDates.sort((a, b) => b.localeCompare(a)); // Sort newest first
}

/**
 * Calculate hourly average PM2.5 for each location on a given date
 * Groups measurements by location and calculates average for each hour
 * @param date - Date to process (YYYY-MM-DD format)
 * @returns Map of location ID to hourly averages
 */
export async function getHourlyAveragesByLocation(
  date: string
): Promise<Map<number, { location: OpenAQLocation; hourlyAverages: Map<string, number> }>> {
  const measurements = await fetchHourlyPM25(date);

  // Group measurements by location
  const locationMap = new Map<number, {
    location: OpenAQLocation | null;
    measurements: OpenAQMeasurement[];
  }>();

  measurements.forEach((measurement) => {
    const locId = measurement.locationId;
    if (!locationMap.has(locId)) {
      locationMap.set(locId, {
        location: null,
        measurements: [],
      });
    }
    locationMap.get(locId)!.measurements.push(measurement);
  });

  // Calculate hourly averages for each location
  const result = new Map<number, { location: OpenAQLocation; hourlyAverages: Map<string, number> }>();

  for (const [locId, data] of locationMap.entries()) {
    // Group by hour
    const hourlyGroups = new Map<string, number[]>();

    data.measurements.forEach((measurement) => {
      const dateObj = new Date(measurement.date.utc);
      const hourKey = `${String(dateObj.getUTCHours()).padStart(2, '0')}:00`;

      if (!hourlyGroups.has(hourKey)) {
        hourlyGroups.set(hourKey, []);
      }
      hourlyGroups.get(hourKey)!.push(measurement.value);
    });

    // Calculate averages
    const hourlyAverages = new Map<string, number>();
    for (const [hour, values] of hourlyGroups.entries()) {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      hourlyAverages.set(hour, avg);
    }

    // Try to get location details (if we have coordinates from first measurement)
    const firstMeasurement = data.measurements[0];
    const location: OpenAQLocation = {
      id: locId,
      name: firstMeasurement.location,
      coordinates: firstMeasurement.coordinates,
      country: firstMeasurement.country,
      timezone: 'UTC',
      locality: firstMeasurement.city,
    };

    result.set(locId, { location, hourlyAverages });
  }

  return result;
}

