import React, { useEffect, useState, useCallback, useRef } from "react";
import { useMapContext } from "../MapContext";
import L from "leaflet";
import "leaflet-svg-shape-markers";
import { GEOJSON_ARNT, GEOJSON_AQ, GEOJSON_DEF, GEOJSON_AAQE } from "../../config";
import axios from "axios";
import { setTextColor, setColor } from "../Utils";

// Props expected by SiteManager
interface SiteManagerProps {
  exInit: (d: Date) => void;
  apiDate: string;
  type: string;
  setShowChart: React.Dispatch<React.SetStateAction<boolean>>;
  setChartData: React.Dispatch<React.SetStateAction<any[]>>;
  time: string;
  setClickedSite: React.Dispatch<React.SetStateAction<string>>;
  enabledMarkers: {
    "DoS Missions": boolean;
    "AERONET": boolean;
    "Open AQ": boolean;
    "African AQE": boolean;
    "OpenAQ-Measurement": boolean;
  };
  zoom: number;
  setResponse: React.Dispatch<React.SetStateAction<string>>;
  fromInit: number;
  setFromInit: React.Dispatch<React.SetStateAction<number>>;
  setSelectArr: React.Dispatch<React.SetStateAction<string[]>>;
  markerSize: number;
  refreshMarkers: boolean;
  setRefreshMarkers: React.Dispatch<React.SetStateAction<boolean>>;
  //zoomChange: boolean;
}

type ReadingRecord = { [key: string]: any };
type CoordRecord = {
  [key: string]: {
    Latitude: number;
    Longitude: number;
  };
};

const SiteManager: React.FC<SiteManagerProps> = ({
  exInit,
  apiDate,
  type,
  setShowChart,
  setChartData,
  time,
  setClickedSite,
  enabledMarkers,
  zoom,
  setResponse,
  fromInit,
  setFromInit,
  setSelectArr,
  markerSize,
  refreshMarkers,
  setRefreshMarkers,
  //zoomChange,
}) => {
  const { map } = useMapContext();
  
  // State: Store forecast readings for each site (grouped by site name + forecast source)
  // Format: { "sitename_source": [Day1Data, Day2Data, Day3Data] }
  const [readings, setReadingsDEF] = useState<{ [key: string]: ReadingRecord[] }>({});
  
  // State: Store coordinates (lat/lon) for each site
  // Format: { "sitename_source": { Latitude: number, Longitude: number } }
  const [coordArr, setCoordArr] = useState<CoordRecord>({});
  
  // State: Model initialization date (the date when forecast was generated)
  const [initDate, setInitDate] = useState<Date | null>(null);

  // Map forecast source names to their GeoJSON directory URLs
  // Used to construct file paths like: {url}YYYYMMDD_forecast.geojson
  const file_urls: { [key: string]: string } = {
    "DoS Missions": GEOJSON_DEF,
    "AERONET": GEOJSON_ARNT,
    "Open AQ": GEOJSON_AQ,
    "African AQE": GEOJSON_AAQE,
  };

  // --- Helper to resize markers on zoom ---
  const updateMarkerSize = useCallback((size: number) => {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setStyle({ radius: size });
        }
      });
    }
  }, [map]);

  // --- Listen for map zoom changes to resize markers dynamically ---
  useEffect(() => {
    if (!map) return;

    const handleZoom = () => {
      const currentZoom = map.getZoom();
      const newSize = (currentZoom + 2) * (Math.E - 1);
      updateMarkerSize(newSize);
    };

    map.on("zoom", handleZoom);
    return () => {
      map.off("zoom", handleZoom);
    };
  }, [map, updateMarkerSize]);

  // --- Clear all old markers ---
  const clearMarkers = useCallback(() => {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker || layer instanceof L.FeatureGroup) {
          map.removeLayer(layer);
        }
      });
    }
  }, [map]);


  // --- Generate forecast date options for dropdown ---
  // Returns [Day 1 (model init date), Day 2 (init + 1), Day 3 (init + 2)]
  function setSelection(d: Date) {
    const d1 = new Date(d); // Day 1: Model Initialization Date
    const d2 = new Date(d); // Day 2: Model Init + 1 day
    d2.setUTCDate(d.getUTCDate() + 1);
    const d3 = new Date(d); // Day 3: Model Init + 2 days
    d3.setUTCDate(d.getUTCDate() + 2);
    return [d1, d2, d3].map(
      (date) =>
        `${(date.getUTCMonth() + 1).toString().padStart(2, "0")}/${date
          .getUTCDate()
          .toString()
          .padStart(2, "0")}/${date.getUTCFullYear()}`
    );
  }

  // --- Fetch OpenAQ measurement data (actual measurements, not forecasts) ---
  // Fetches hourly PM2.5 measurements from OpenAQ API for a specific date
  // Formats data to match forecast data structure for consistent display
  const fetchOpenAQMeasurements = useCallback(async (
    sAPI: string | undefined,
    readingResult: { [key: string]: ReadingRecord[] },
    coordResult: CoordRecord
  ): Promise<boolean> => {
    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log('[SiteManager] fetchOpenAQMeasurements called', { sAPI });
    }
    try {
      // Determine date to fetch (use provided date or today)
      let d = new Date();
      if (sAPI) {
        const candidate = new Date(sAPI);
        if (!isNaN(candidate.getTime())) {
          d = candidate;
        }
      }

      const dateString = d.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      // Check if date is in the future (OpenAQ only has historical data)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (d > today) {
        setResponse(`Selected date ${dateString} is in the future. OpenAQ only has historical measurement data. Please select a past date.`);
        setCoordArr({});
        setReadingsDEF({});
        setSelectArr([]);
        return false;
      }
      
      // Show initial loading message
      setResponse(`Loading OpenAQ measurement data for ${dateString}...`);

      // Fetch ALL locations using pagination (per team lead requirement)
      const API_KEY = import.meta.env.VITE_OPENAQ_API_KEY;
      //const isDevelopment = import.meta.env.DEV;
      //const OPENAQ_API_BASE = isDevelopment 
      //  ? '/api/openaq'
      //  : 'https://api.openaq.org/v3';

      const OPENAQ_API_BASE = "/api/openaq";

      const headers: { [key: string]: string } = {};
      if (API_KEY) {
        headers['X-API-Key'] = API_KEY;
      }

      // Fetch all locations using pagination
      // OpenAQ API returns pagination info, so we'll fetch all pages
      setResponse(`Fetching all OpenAQ locations...`);
      const allLocations: any[] = [];
      let currentPage = 1;
      const pageSize = 100; // Max locations per page (OpenAQ API limit)
      let hasMorePages = true;
      let totalLocationsInDatabase = 0;
      let firstPageFetched = false;

      while (hasMorePages) {
        try {
          const locationsResponse = await axios.get(`${OPENAQ_API_BASE}/locations`, {
            params: { limit: pageSize, page: currentPage },
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            timeout: 30000,
          });

          const pageResults = locationsResponse.data?.results || [];
          const meta = locationsResponse.data?.meta || {};
          
          // Get total from first page (most accurate)
          if (!firstPageFetched && meta.found) {
            totalLocationsInDatabase = meta.found;
            firstPageFetched = true;
          }
          
          allLocations.push(...pageResults);
          
          // Update total if we got it from meta
          if (meta.found && meta.found > totalLocationsInDatabase) {
            totalLocationsInDatabase = meta.found;
          }
          
          // Check if there are more pages to fetch
          // Continue if: (1) this page had full results, AND (2) we haven't fetched all locations yet
          hasMorePages = pageResults.length === pageSize && allLocations.length < totalLocationsInDatabase;
          
          if (hasMorePages) {
            currentPage++;
            // Update progress message with actual totals
            const progressMsg = totalLocationsInDatabase > 0
              ? `Fetching all OpenAQ locations... (${allLocations.length} of ${totalLocationsInDatabase} total in database)`
              : `Fetching all OpenAQ locations... (${allLocations.length} fetched so far)`;
            setResponse(progressMsg);
            // Small delay between pages to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            // Last page reached
            if (totalLocationsInDatabase > 0 && allLocations.length < totalLocationsInDatabase) {
              console.warn(`[SiteManager] Only fetched ${allLocations.length} out of ${totalLocationsInDatabase} total locations. API may have stopped returning pages.`);
            }
          }
        } catch (error: any) {
          console.warn(`Error fetching locations page ${currentPage}:`, error.message);
          // If we have some locations, continue with what we have
          if (allLocations.length > 0) {
            hasMorePages = false;
            console.warn(`[SiteManager] Stopping pagination. Using ${allLocations.length} locations fetched so far.`);
          } else {
            throw error;
          }
        }
      }

      const locations = allLocations;

      if (locations.length === 0) {
        setResponse(`No OpenAQ locations found for ${dateString}.`);
        setCoordArr({});
        setReadingsDEF({});
        setSelectArr([]);
        return false;
      }

      // Update message to show totals and that we're starting to load measurements
      const locationsMsg = totalLocationsInDatabase > 0
        ? `Found ${locations.length} locations (out of ${totalLocationsInDatabase} total in database). Starting to load measurements...`
        : `Found ${locations.length} locations. Starting to load measurements...`;
      setResponse(locationsMsg);

      // Process locations progressively - update state as we fetch batches
      const dateFrom = `${dateString}T00:00:00Z`;
      const dateTo = `${dateString}T23:59:59Z`;
      let loadedCount = 0;
      let hasData = false;

      // Process in batches - show markers as soon as first batch is ready
      const batchSize = 5; // Process 5 locations at a time
      const totalLocationsCount = locations.length;
      let processedCount = 0; // Count of locations processed (regardless of data availability)
      
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (location: any) => {
            // Find PM2.5 sensors
            const pm25Sensors = location.sensors?.filter(
              (s: any) => s.parameter.name === 'pm25'
            ) || [];

            if (pm25Sensors.length === 0) return null;

            // Fetch measurements for first PM2.5 sensor only (faster)
            const sensor = pm25Sensors[0];
            try {
              const response = await axios.get(`${OPENAQ_API_BASE}/sensors/${sensor.id}/measurements`, {
                params: { date_from: dateFrom, date_to: dateTo, limit: 100, page: 1 },
                headers: Object.keys(headers).length > 0 ? headers : undefined,
                timeout: 10000,
              });

              const measurements = response.data?.results || [];
              if (measurements.length === 0) return null;

              // Group by hour and calculate averages
              const hourlyGroups = new Map<string, number[]>();
              measurements.forEach((m: any) => {
                const dateObj = new Date(m.period?.datetimeFrom?.utc || dateFrom);
                const hourKey = `${String(dateObj.getUTCHours()).padStart(2, '0')}:00`;
                if (!hourlyGroups.has(hourKey)) {
                  hourlyGroups.set(hourKey, []);
                }
                hourlyGroups.get(hourKey)!.push(m.value);
              });

              const hourlyAverages = new Map<string, number>();
              for (const [hour, values] of hourlyGroups.entries()) {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                hourlyAverages.set(hour, avg);
              }

              if (hourlyAverages.size === 0) return null;

              // Format data
              const siteName = location.name.toLowerCase().trim().replace(/\s+/g, '_');
              const forecastSource = "OpenAQ-Measurement";
              const siteKey = `${siteName}_${forecastSource.toLowerCase().replace(/\s+/g, '_')}`;

              const reading: ReadingRecord = {};
              for (const [hour, avgValue] of hourlyAverages.entries()) {
                const hourNum = parseInt(hour.split(':')[0]);
                reading[`PM_${String(hourNum).padStart(2, '0')}00`] = avgValue.toFixed(2);
                reading[`AQI_${String(hourNum).padStart(2, '0')}00`] = Math.round(avgValue);
              }

              const allValues = Array.from(hourlyAverages.values());
              const dailyAvg = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
              reading['DAILY_AQI'] = Math.round(dailyAvg);
              reading['PM_DAILY'] = dailyAvg.toFixed(2);
              reading['Site_Name'] = location.name;
              reading['Country'] = location.country;
              reading['UTC_DATE'] = dateString;

              return {
                siteKey,
                coord: {
                  Latitude: location.coordinates.latitude,
                  Longitude: location.coordinates.longitude,
                },
                reading: [reading],
              };
            } catch (error: any) {
              if (error.response?.status !== 429) {
                console.warn(`Failed to fetch for location ${location.id}:`, error.message);
              }
              return null;
            }
          })
        );

        // Update state progressively - add batch results immediately
        for (const result of batchResults) {
          processedCount++; // Count all processed locations (including those without data)
          if (result) {
            coordResult[result.siteKey] = result.coord;
            readingResult[result.siteKey] = result.reading;
            loadedCount++; // Count only locations with valid data (markers displayed)
            hasData = true;
          }
        }

        // Update state immediately with current progress (triggers marker render)
        setCoordArr({ ...coordResult });
        setReadingsDEF({ ...readingResult });

        // Update progress message with detailed counts
        if (processedCount > 0) {
          const progressMsg = processedCount < totalLocationsCount
            ? `Processing locations: ${processedCount}/${totalLocationsCount} processed | ${loadedCount} markers displayed`
            : `Complete: ${processedCount} locations processed | ${loadedCount} markers displayed`;
          setResponse(progressMsg);
        }

        // Small delay between batches (reduced for speed)
        if (i + batchSize < locations.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (!hasData) {
        setResponse(`No OpenAQ measurement data available for ${dateString}. Try selecting a different date.`);
        setCoordArr({});
        setReadingsDEF({});
        setSelectArr([]);
        return false;
      }

      // Final state update
      setCoordArr(coordResult);
      setReadingsDEF(readingResult);
      
      // Show final summary - message persists until user selects different date or closes browser
      if (hasData) {
        setResponse(`✅ Complete: ${processedCount} locations processed | ${loadedCount} markers displayed`);
        // Message will remain until:
        // 1. User selects a different date (triggers new fetch with new message)
        // 2. User closes browser/component unmounts
      } else {
        setResponse(""); // Clear immediately if no data
      }

      // Update model initialization date to the selected date
      const newInitTime = d.getTime();
      if (!initDate || initDate.getTime() !== newInitTime) {
        setInitDate(d);
        exInit(d);
      }

      // For measurements, no forecast date dropdown needed
      setSelectArr([]);

      return true;
    } catch (error: any) {
      console.error("Error fetching OpenAQ measurements:", error);
      // Provide more helpful error messages
      let errorMsg = error.message || 'Failed to fetch OpenAQ measurements';
      if (error.message?.includes('API key')) {
        errorMsg = error.message;
      } else if (error.message?.includes('Rate limit')) {
        errorMsg = 'OpenAQ API rate limit exceeded. Please wait a moment and try again.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Invalid OpenAQ API key. Please check your VITE_OPENAQ_API_KEY in .env file.';
      } else if (error.response?.status === 429) {
        errorMsg = 'Too many requests. Please wait before trying again.';
      }
      setResponse(`Error: ${errorMsg}`);
      setCoordArr({});
      setReadingsDEF({});
      setSelectArr([]);
      return false;
    }
  }, [setResponse, setCoordArr, setReadingsDEF, setSelectArr, setInitDate, exInit, initDate]);

  // --- Main function: Fetch forecast data from GeoJSON files OR OpenAQ measurements ---
  // This function matches the old CSV/API pattern:
  // 1. Calls nearestDate once to find valid date (stops if failed > 2)
  // 2. Allows date override with sAPI parameter
  // 3. Fetches GeoJSON files for all enabled forecast sources
  // 4. OR fetches OpenAQ measurement data if OpenAQ-Measurement is enabled
  // 5. Parses GeoJSON features and groups them by site name
  // 6. Sorts data by UTC_DATE to ensure Day 1, Day 2, Day 3 order
  // 7. Updates state with readings and coordinates
  const fetchReadings = useCallback(async (
    sAPI?: string
  ): Promise<boolean> => {
    // Temporary storage for readings and coordinates before updating state
    const readingResult: { [key: string]: ReadingRecord[] } = {};
    let d = new Date(); // Start with today's date
    const coordResult: CoordRecord = {};

    // Debug logging only in development
    if (import.meta.env.DEV) {
      console.log('[SiteManager] fetchReadings called', { sAPI, enabledMarkers });
    }
    
    try {
      // Check if OpenAQ-Measurement is enabled (requires different handling)
      if (enabledMarkers["OpenAQ-Measurement"] === true) {
        return await fetchOpenAQMeasurements(sAPI, readingResult, coordResult);
      }

      // Step 1: Find the latest available file on the server
      // Use the first enabled source to find the latest file (all sources use same date)
      let file_selected = GEOJSON_DEF; // Default to DoS Missions
      
      // Find first enabled source to use for date finding (skip OpenAQ-Measurement)
      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey] && key !== "OpenAQ-Measurement" && file_urls[key]) {
          file_selected = file_urls[key];
          break;
        }
      }

      // Allow overriding date if user selected a specific date
          if (sAPI) {
            const candidate = new Date(sAPI);
            if (!isNaN(candidate.getTime())) {
              d = candidate;
            }
          }

      // Find the latest available file (searches backwards until found)
      setResponse("Finding latest forecast file...");
      try {
        const [latestDate] = await nearestDate(d, file_selected, 0);
        d = latestDate;
      } catch (err: any) {
        console.warn("Could not find latest file, using today's date:", err);
        setResponse("Warning: Could not find latest forecast file. Using today's date.");
      }

      // Step 2: Loop through enabled forecast sources and fetch data
      // Skip OpenAQ-Measurement (handled separately above)
      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey] && key !== "OpenAQ-Measurement") {
          const api_selected = file_urls[key];
          if (!api_selected) continue; // Skip if no URL mapping
          setResponse(`Fetching ${key} forecast data...`);

          // Construct the file path using date (matches old pattern: year, month, date)
          const [year, month, date] = [
            d.getUTCFullYear(),
            d.getUTCMonth() + 1,
            d.getUTCDate(),
          ];
          const dateString = `${year}${String(month).padStart(2, "0")}${String(date).padStart(2, "0")}`;

          // Fetch GeoJSON file (matches old pattern: axios.get with URL)
          const filePath = `${api_selected}${dateString}_forecast.geojson`;
          let response: any = null;
          
          try {
            response = await axios.get(filePath);
          } catch (error: any) {
            // If file not found for this source, try to find latest file for this source
            if (error.response?.status === 404) {
              console.warn(`File not found for ${key} at ${dateString}, searching for latest file...`);
              try {
                const [latestDateForSource] = await nearestDate(new Date(), api_selected, 0);
                const latestYear = latestDateForSource.getUTCFullYear();
                const latestMonth = String(latestDateForSource.getUTCMonth() + 1).padStart(2, "0");
                const latestDate = String(latestDateForSource.getUTCDate()).padStart(2, "0");
                const latestDateString = `${latestYear}${latestMonth}${latestDate}`;
                const latestFilePath = `${api_selected}${latestDateString}_forecast.geojson`;
                response = await axios.get(latestFilePath);
                d = latestDateForSource; // Update d to latest found date
              } catch (latestError: any) {
                console.error(`Could not find file for ${key}:`, latestError);
                setResponse(`No forecast files found for ${key}.`);
                continue;
              }
            } else {
              console.error(`Error fetching ${key}:`, error);
              setResponse(`Error fetching ${key}: ${error.message || 'Unknown error'}`);
              continue;
            }
          }

          // Validate that we received valid GeoJSON data
          if (!response || !response.data || !response.data.features) {
            setResponse("GeoJSON file is empty or invalid.");
            continue;
          }

          // Extract features from GeoJSON (each feature represents one site at one forecast day)
          const geojsonData = response.data;
          const features = geojsonData.features || [];

          // Step 3: Parse GeoJSON features and group by site name
          // Each GeoJSON file contains multiple features (sites) with forecast data
          // We need to group features by site name, then sort by date to get Day 1, 2, 3
          const siteGroups: { [siteKey: string]: any[] } = {};

          features.forEach((feature: any) => {
            // Skip invalid features
            if (!feature.geometry || !feature.properties) return;

            // GeoJSON coordinates are [longitude, latitude]
            const coordinates = feature.geometry.coordinates;
            const properties = feature.properties;
            const siteName = properties.Site_Name?.toLowerCase().trim();
            
            // Skip if missing required data
            if (!siteName || !coordinates || coordinates.length < 2) return;

            // Create unique key: sitename_forecastsource (e.g., "abidjan_dos missions")
            const forecastSource = key;
            const siteKey = `${siteName}_${forecastSource.toLowerCase()}`;
            const coordKey = siteKey;

            // Store site coordinates (convert from [lon, lat] to {Latitude, Longitude})
            // Coordinates are the same for all forecast days, so store only once
            if (!coordResult[coordKey]) {
              coordResult[coordKey] = {
                Latitude: parseFloat(coordinates[1]),  // GeoJSON lat is at index 1
                Longitude: parseFloat(coordinates[0]), // GeoJSON lon is at index 0
              };
            }

            // Group features by site name
            // Each site will have multiple features (one for each forecast day)
            if (!siteGroups[siteKey]) {
              siteGroups[siteKey] = [];
            }
            siteGroups[siteKey].push(properties);
          });

          // Step 4: Sort each site's features by UTC_DATE to ensure correct order
          // This ensures Day 1, Day 2, Day 3 are in the correct sequence
          for (const siteKey in siteGroups) {
            const siteFeatures = siteGroups[siteKey];
            // Sort by UTC_DATE (ascending: Day 1 -> Day 2 -> Day 3)
            siteFeatures.sort((a, b) => {
              const dateA = new Date(a.UTC_DATE || "").getTime();
              const dateB = new Date(b.UTC_DATE || "").getTime();
              return dateA - dateB;
            });
            // Store sorted features in readingResult
            readingResult[siteKey] = siteFeatures;
          }

          // Forecast dates are Day 1, Day 2, Day 3 from model initialization date
          // (This will be set once after all sources are processed)
        }
      }

      // Step 3: Update model initialization date
      // Update only if it changed to prevent unnecessary re-renders
      const newInitTime = d.getTime();
      if (!initDate || initDate.getTime() !== newInitTime) {
        setInitDate(d);
        // Only call exInit - it will update fromInit in SidePanel
        exInit(d);
      }

      // Step 4: Update application state with fetched data
      if (Object.keys(readingResult).length > 0) {
        setResponse(""); // Clear loading message on success
      } else {
        setResponse("No forecast data loaded. Check console for details.");
      }
      
      // Update forecast date dropdown options
      // Forecast dates are calculated as: Day 1 (init date), Day 2 (init + 1), Day 3 (init + 2)
          const selection = setSelection(d);
          if (selection && selection.length > 0) {
            setSelectArr(selection);
          } else {
        // Fallback if date calculation fails
            setSelectArr([
          "Day 1 (No data)",
          "Day 2 (No data)",
          "Day 3 (No data)",
        ]);
      }
      
      // Update state with coordinates and readings
      setCoordArr(coordResult);
      setReadingsDEF(readingResult);
    } catch (e: any) {
      console.error("fetchReadings error:", e);
      if (e.message?.includes('CORS')) {
        setResponse("CORS Error: Server blocking cross-origin requests. Contact server administrator.");
      } else {
        setResponse(`GeoJSON files not available: ${e.message || 'Unknown error'}`);
      }
      setSelectArr([
        "Day 1 (Fallback)",
        "Day 2 (Fallback)",
        "Day 3 (Fallback)",
      ]);
      return false;
    }
    return true;
  }, [enabledMarkers, file_urls, setResponse, setCoordArr, setReadingsDEF, setFromInit, setSelectArr, exInit, setInitDate, fetchOpenAQMeasurements]);

  // --- Prepare chart data for 3-day forecast visualization ---
  // Converts reading data into format expected by chart.js
  // Creates an array of 3 objects, one for each forecast day
  const createChartData = useCallback((reading: any[]) => {
    const chartData: any[] = [{}, {}, {}];
    if (!initDate) return chartData;
    
    // Start from model initialization date
    const d = new Date(initDate);
    for (let day = 0; day < 3; day++) {
      d.setUTCSeconds(0);
      // Store DAILY_AQI value with ISO date string as key
      chartData[day][d.toISOString()] = reading[day]["DAILY_AQI"];
      // Move to next day
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return chartData;
  }, [initDate]);

  // --- Helper: Find the latest available GeoJSON file date ---
  // Recursively searches backwards from the given date until it finds a valid file
  // Keeps searching until found or reaches 30 days back (prevents infinite loops)
  // Returns the date of the latest available file
  async function nearestDate(
    d: Date,
    file_selected: string,
    failed = 0
  ): Promise<[Date, number]> {
    // Limit recursion to prevent infinite loops - check max 30 days back
    if (failed > 30) {
      throw new Error("No recent forecast data found within 30 days.");
    }
    
    // Format date as YYYYMMDD
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const date = String(d.getUTCDate()).padStart(2, "0");
    const dateString = `${year}${month}${date}`;
    
    try {
      // Try to fetch the GeoJSON file for this date (with timeout)
      const filePath = `${file_selected}${dateString}_forecast.geojson`;
      const response = await axios.get(filePath, { 
        validateStatus: (status: number) => status < 500, // Accept 404, reject 500+
        timeout: 5000 // 5 second timeout
      });
      
      // Check if file exists and has valid data
      if (response.status === 200 && response.data && response.data.features) {
        // File found! Return the date
        return [d, 0];
      }
      
      // File doesn't exist or is empty, try previous day
      d.setUTCDate(d.getUTCDate() - 1);
      return nearestDate(d, file_selected, failed + 1);
    } catch (err: any) {
      // Handle 404 errors - file doesn't exist, try previous day
      if (err.response?.status === 404) {
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // Handle CORS/network errors - try previous day
      // Note: CORS errors are expected in dev (localhost -> aeronet.gsfc.nasa.gov)
      // In production (same domain), CORS won't apply
      if (err.code === 'ERR_NETWORK' || err.message?.includes('CORS') || err.message?.includes('Failed to fetch')) {
        // Only log once to reduce console noise
        if (failed === 0) {
          console.debug('CORS warning in dev (expected - will work in production on same domain)');
        }
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // Handle timeout errors - try previous day
      if (err.code === 'ECONNABORTED') {
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // Other errors - rethrow to be handled by caller
      throw err;
    }
  }

  // --- Plot markers on the map for each site ---
  // Creates colored circle markers on the map based on forecast data
  // Marker color represents AQI/PM value, size is based on zoom level
  // Only shows markers for enabled forecast sources
  const fetchMarkers = useCallback((type: string, time: string) => {
  let rKey: string | undefined;
  
  // Map internal forecast source keys to display names
  const forecastDisplayNames: { [key: string]: string } = {
    "dos missions": "DoS Missions",
    "aeronet": "AERONET",
    "open aq": "Open AQ",
    "african aqe": "African AQE",
    "openaq-measurement": "OpenAQ-Measurement",
  };
  
  if (readings) {
    try {
      // Loop through all sites that have both coordinates and readings
      for (const key in coordArr) {
        if (Object.keys(readings).includes(key)) {
          // Parse site key: format is "sitename_forecastsource"
          // Split to extract site name and forecast source
          const lastUnderscore = key.lastIndexOf("_");
          const rawName = key.slice(0, lastUnderscore);
          const rawForecast = key.slice(lastUnderscore + 1).toLowerCase();

          // Convert to display format (e.g., "dos missions" -> "DoS Missions")
          const forecastSource = forecastDisplayNames[rawForecast] || rawForecast
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          
          // Check if this forecast source is enabled - skip if not enabled
          if (!enabledMarkers[forecastSource as keyof typeof enabledMarkers]) {
            continue;
          }
          
          // Convert site name to display format (e.g., "abidjan" -> "Abidjan")
          const siteName =
            rawName
              .split("_")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

          // Get the reading for the selected forecast day (fromInit: 0=Day1, 1=Day2, 2=Day3)
          // For measurements, always use index 0 (only one day available)
          // For forecasts, use fromInit to select Day 1, 2, or 3
          const isMeasurement = forecastSource === "OpenAQ-Measurement";
          const dayIndex = isMeasurement ? 0 : (fromInit >= 0 && fromInit < readings[key].length ? fromInit : 0);
          const dayReading = readings[key][dayIndex];
          
          if (!dayReading) continue; // Skip if no data for this day

          // Find the correct data column based on type (AQI, PM, DAILY_AQI) and time
          // For measurements, always use daily average (no time selection)
          // For forecasts, match type and time (e.g., "AQI_130")
          // For DAILY_AQI, only match type (no time component)
          if (isMeasurement) {
            // For measurements, use daily average or PM_DAILY
            if (type === "DAILY_AQI") {
              rKey = "DAILY_AQI";
            } else if (type === "PM") {
              rKey = "PM_DAILY";
            } else if (type === "AQI") {
              rKey = "DAILY_AQI"; // Use daily AQI as approximation
            }
          } else if (type !== "DAILY_AQI") {
            // For forecasts, match type and time
            rKey = Object.keys(dayReading).find(
              (x) => x.includes(type) && x.includes(time)
            );
          } else {
            rKey = Object.keys(dayReading).find((x) =>
              x.includes(type)
            );
          }
          if (!rKey || !dayReading[rKey]) continue; // Skip if no matching data column found

          // Extract the value (AQI or PM2.5)
          // AQI values are integers, PM values are floats
          const value = type.includes("AQI")
            ? parseInt(dayReading[rKey])
            : parseFloat(dayReading[rKey]);
          
          // Get color based on value (green=good, yellow=moderate, red=unhealthy, etc.)
          const markerColor = setColor(value, "outter")?.toString() || "grey";

          // Display labels for different forecast types
          const markerType: { [key: string]: string } = {
            PM: "PM 2.5",
            DAILY_AQI: "DAILY AQI",
            AQI: "AQI",
          };

          // Get PM2.5 value for display in tooltip
          // For measurements, use PM_DAILY; for forecasts, find time-specific PM value
          let pm = "0";
          if (isMeasurement) {
            pm = dayReading["PM_DAILY"] || dayReading[rKey] || "0";
          } else {
            const pmKey = Object.keys(dayReading).find(
            (x) => x.includes("PM") && x.includes(time)
          );
            pm = pmKey ? dayReading[pmKey] : "0";
          }

          // --- Create colored circle marker on the map ---
          // Position: [latitude, longitude] (Leaflet format)
          // Style: colored fill, white border, size based on zoom level
          const marker = L.circleMarker(
            [coordArr[key].Latitude, coordArr[key].Longitude],
            {
              fillColor: markerColor,
              color: "white",
              radius: markerSize,
              fillOpacity: 1,
              opacity: 1,
              weight: 2,
              stroke: true,
            } as any
          ).addTo(map!);

            // --- Show tooltip popup on marker hover ---
          // Displays site name, forecast source, AQI/PM value, and PM2.5
          marker.on("mouseover", () => {
            marker
              .bindPopup(
                `<div style="
                  background-color: ${markerColor};
                  color: ${setTextColor(value)};
                  border-radius: 10px;
                  padding: 10px 14px;
                  width: 260px;
                  font-size: 13px;
                  font-weight: 500;
                  line-height: 1.4;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                ">
                  <div style="margin-bottom: 6px;">
                    <b>Site Name:</b> ${siteName}<br>
                    <b>Source:</b> ${forecastSource}
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 16px;">
                      <b>${markerType[type]}:</b> ${value}
                    </span>
                    <span style="font-size: 16px;">
                      <b>PM2.5:</b> ${parseInt(pm)} µgm<sup>-3</sup>
                    </span>
                  </div>
                </div>`
              )
              .openPopup();
          });


          // --- Show chart when marker is clicked ---
          marker.on("click", () => {
            if (isMeasurement) {
              // For measurements, show hourly data (not forecast)
              setClickedSite(`${siteName} (${forecastSource}) | Hourly Measurements`);
              // Create simple chart data from hourly measurements
              const hourlyData: any[] = [];
              const dayReading = readings[key][0]; // Measurements only have one "day"
              if (dayReading) {
                // Extract hourly PM2.5 values
                for (let hour = 0; hour < 24; hour++) {
                  const hourStr = String(hour).padStart(2, '0');
                  const pmKey = `PM_${hourStr}00`;
                  if (dayReading[pmKey]) {
                    hourlyData.push({
                      hour: `${hourStr}:00`,
                      value: parseFloat(dayReading[pmKey]),
                    });
                  }
                }
              }
              // For now, just set empty array - chart can be enhanced later
              setChartData(hourlyData.length > 0 ? hourlyData : []);
            } else {
              // For forecasts, show 3-day forecast chart
            setClickedSite(`${siteName} (${forecastSource}) | 3-Day Forecast`);
              // Prepare chart data (Day 1, Day 2, Day 3 AQI values)
            const chartData = createChartData(readings[key]);
            setChartData(chartData);
            }
            // Show chart modal after short delay
            setTimeout(() => setShowChart(true), 500);
          });
        }
      }
    } catch (e) {
      console.error("fetchMarkers() error:", e);
      setResponse("API returned: No data available.");
    }
  }
  }, [readings, coordArr, type, time, markerSize, map, setClickedSite, setChartData, setShowChart, setResponse, createChartData, enabledMarkers, fromInit]);

  // --- React hooks: Update markers when dependencies change ---
  
  // Update marker size when zoom level changes
  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);
    }
  }, [zoom, markerSize, updateMarkerSize]);

  // Refresh markers when user clicks refresh button
  // Clears old markers, fetches new data, and plots new markers
  useEffect(() => {
    if (refreshMarkers) {
      clearMarkers();
      fetchReadings(apiDate);
      fetchMarkers(type, time);
    }
    setRefreshMarkers(false);
  }, [refreshMarkers, clearMarkers, fetchReadings, fetchMarkers, apiDate, type, time]);

  // Update markers when readings, type, time, or forecast date changes
  // This re-renders markers with new data or different visualization type
  useEffect(() => {
    clearMarkers();
    fetchMarkers(type, time);
  }, [readings, type, time, fromInit, clearMarkers, fetchMarkers]);

  // Fetch new forecast data when date or enabled sources change
  // Use a ref to prevent multiple simultaneous calls
  const isFetchingRef = useRef(false);
  useEffect(() => {
    // Prevent multiple simultaneous fetch calls
    if (isFetchingRef.current) {
      // Debug logging only in development
      if (import.meta.env.DEV) {
        console.log("fetchReadings already in progress, skipping...");
      }
      return;
    }
    
    isFetchingRef.current = true;
    fetchReadings(apiDate)
      .finally(() => {
        // Reset flag after fetch completes (success or error)
        setTimeout(() => {
          isFetchingRef.current = false;
        }, 1000); // Small delay to prevent rapid re-triggering
      });
  }, [apiDate, enabledMarkers, fetchReadings]);

  return null;
};

export default SiteManager;
