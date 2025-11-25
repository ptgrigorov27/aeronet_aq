import React, { useEffect, useState, useCallback } from "react";
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

  // --- Main function: Fetch forecast data from GeoJSON files ---
  // This function:
  // 1. Finds the most recent available forecast file (model initialization date)
  // 2. Fetches GeoJSON files for all enabled forecast sources
  // 3. Parses GeoJSON features and groups them by site name
  // 4. Sorts data by UTC_DATE to ensure Day 1, Day 2, Day 3 order
  // 5. Updates state with readings and coordinates
  const fetchReadings = useCallback(async (
    sAPI?: string
  ): Promise<boolean> => {
    // Temporary storage for readings and coordinates before updating state
    const readingResult: { [key: string]: ReadingRecord[] } = {};
    let modelInitDate = new Date(); // Start with today's date
    const coordResult: CoordRecord = {};

    try {
      // If user selected a specific date, use it as starting point
      if (sAPI) {
        const candidate = new Date(sAPI);
        if (!isNaN(candidate.getTime())) {
          modelInitDate = candidate;
        }
      }

      // Step 1: Find the model initialization date
      // The model initialization date is the date when the forecast was generated
      // We check if today's file exists, otherwise find the most recent available file
      // All forecast sources use the same model initialization date
      setResponse("Finding model initialization date...");
      
      // Use the first enabled forecast source to find the model initialization date
      // All forecast sources should use the same model initialization date
      let foundInitDate: Date | null = null;
      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey]) {
          const file_selected = file_urls[key];
          try {
            // First check if today's file exists
            const today = new Date(modelInitDate);
            const todayYear = today.getUTCFullYear();
            const todayMonth = String(today.getUTCMonth() + 1).padStart(2, "0");
            const todayDate = String(today.getUTCDate()).padStart(2, "0");
            const todayString = `${todayYear}${todayMonth}${todayDate}`;
            const todayFilePath = `${file_selected}${todayString}_forecast.geojson`;
            
            try {
              // Try to fetch today's file (with timeout to fail fast if it doesn't exist)
              const todayResponse = await axios.get(todayFilePath, {
                timeout: 3000,
                validateStatus: (status: number) => status < 500
              });
              if (todayResponse.status === 200 && todayResponse.data && todayResponse.data.features) {
                // Today's file exists and has data, use it
                foundInitDate = today;
                console.log(`Today's file exists: ${todayString}`);
                break;
              }
            } catch (todayError: any) {
              // Today's file doesn't exist (404) or has issues, find the most recent file
              if (todayError.response?.status === 404 || todayError.code === 'ECONNABORTED') {
                console.log(`Today's file not found (${todayString}), searching for most recent file...`);
                try {
                  const [recentDate] = await nearestDate(today, file_selected, 0);
                  foundInitDate = recentDate;
                  console.log(`Found most recent file date: ${recentDate.toISOString().split('T')[0]}`);
                  break;
                } catch (nearestError: any) {
                  console.warn(`Could not find recent file for ${key}:`, nearestError);
                  continue;
                }
              } else if (todayError.code === 'ERR_NETWORK' || todayError.message?.includes('CORS')) {
                // CORS error in development - this is expected, try to find recent file anyway
                // In production (same domain), CORS won't be an issue
                console.log(`CORS warning in dev (expected). Today's file not accessible, searching for most recent file...`);
                try {
                  const [recentDate] = await nearestDate(today, file_selected, 0);
                  foundInitDate = recentDate;
                  console.log(`Found most recent file date: ${recentDate.toISOString().split('T')[0]}`);
                  break;
                } catch (nearestError: any) {
                  // If CORS blocks everything, log but don't break - production will work
                  console.warn(`CORS blocking file access for ${key} (dev only - will work in production):`, nearestError);
                  continue;
                }
              } else {
                // Other error - log but continue
                console.warn(`Error checking today's file for ${key}:`, todayError);
                continue;
              }
            }
          } catch (err: any) {
            console.warn(`Could not find date for ${key}, trying next source`);
            continue;
          }
        }
      }

      // If no date found, use today as fallback
      if (!foundInitDate) {
        foundInitDate = modelInitDate;
        console.warn("Could not find any forecast files, using today's date");
      }

      // Update model initialization date
      modelInitDate = foundInitDate;
      setInitDate(modelInitDate);
      setFromInit(modelInitDate.getTime());
      exInit(modelInitDate);

      // Step 2: Fetch data for all enabled forecast sources
      // Loop through each forecast source (DoS Missions, AERONET, etc.)
      // and fetch the GeoJSON file for the model initialization date
      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey]) {
          // Get the base URL for this forecast source
          const file_selected = file_urls[key];
          setResponse(`Fetching ${key} forecast data...`);

          // Construct the file path using model initialization date
          // Format: YYYYMMDD_forecast.geojson
          let dateToUse = new Date(modelInitDate);
          const year = dateToUse.getUTCFullYear();
          const month = String(dateToUse.getUTCMonth() + 1).padStart(2, "0");
          const date = String(dateToUse.getUTCDate()).padStart(2, "0");
          const dateString = `${year}${month}${date}`;

          // Full file path: base URL + date string + _forecast.geojson
          const filePath = `${file_selected}${dateString}_forecast.geojson`;
          console.log(`Attempting to fetch: ${filePath}`);
          let response: any = null;
          try {
            response = await axios.get(filePath, {
              headers: {
                'Accept': 'application/geo+json, application/json'
              }
            });
          } catch (error: any) {
            // Check if it's a 404 - file doesn't exist
            if (error.response?.status === 404) {
              setResponse(`File not found for ${key}: ${dateString}_forecast.geojson. Trying previous dates...`);
              console.warn("404 Error - File not found:", filePath);
              // Try going back a few days
              let foundFile = false;
              for (let daysBack = 1; daysBack <= 7 && !foundFile; daysBack++) {
                const backDate = new Date(dateToUse);
                backDate.setUTCDate(backDate.getUTCDate() - daysBack);
                const backYear = backDate.getUTCFullYear();
                const backMonth = String(backDate.getUTCMonth() + 1).padStart(2, "0");
                const backDay = String(backDate.getUTCDate()).padStart(2, "0");
                const backDateString = `${backYear}${backMonth}${backDay}`;
                const backFilePath = `${file_selected}${backDateString}_forecast.geojson`;
                
                try {
                  const backResponse = await axios.get(backFilePath);
                  if (backResponse.data && backResponse.data.features) {
                    response = backResponse;
                    dateToUse = backDate;
                    foundFile = true;
                    console.log(`Found file ${daysBack} days back: ${backDateString}`);
                    break;
                  }
                } catch (e) {
                  // Continue to next day
                }
              }
              if (!foundFile) {
                setResponse(`No forecast files found for ${key} in the past 7 days.`);
                console.error(`No files found for ${key}`);
                continue;
              }
            } else if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
              // CORS error in development - expected when fetching from different domain
              // In production (same domain), CORS won't be an issue
              console.warn(`CORS error in dev for ${key} (expected - will work in production on same domain):`, filePath);
              setResponse(`CORS blocking in development. Will work in production.`);
              continue;
            } else {
              setResponse(`Error fetching ${key}: ${error.message || 'Unknown error'}`);
              console.error("Fetch error for:", filePath, error);
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

      // Step 5: Update application state with fetched data
      if (Object.keys(readingResult).length > 0) {
        setResponse(""); // Clear loading message on success
      } else {
        setResponse("No forecast data loaded. Check console for details.");
      }
      
      // Update forecast date dropdown options
      // Forecast dates are calculated as: Day 1 (init date), Day 2 (init + 1), Day 3 (init + 2)
      const selection = setSelection(modelInitDate);
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
  }, [enabledMarkers, file_urls, setResponse, setCoordArr, setReadingsDEF, setFromInit, setSelectArr, exInit, setInitDate]);

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

  // --- Helper: Find the nearest valid GeoJSON file date ---
  // Recursively checks if a GeoJSON file exists for the given date
  // If not found (404), tries the previous day (up to 7 days back)
  // Returns the date and failure count
  async function nearestDate(
    d: Date,
    file_selected: string,
    failed = 0
  ): Promise<[Date, number]> {
    // Format date as YYYYMMDD
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const date = String(d.getUTCDate()).padStart(2, "0");
    const dateString = `${year}${month}${date}`;
    
    try {
      // Try to fetch the GeoJSON file for this date
      const filePath = `${file_selected}${dateString}_forecast.geojson`;
      const response = await axios.get(filePath, { 
        validateStatus: (status: number) => status < 500 // Accept 404, reject 500+
      });
      
      // Check if file exists and has valid data
      if (response.status !== 200 || !response.data || !response.data.features) {
        // File doesn't exist or is empty, try previous day
        if (failed > 7) throw new Error("No recent forecast data found.");
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // File found! Return the date
      return [d, 0]; // reset failed counter on success
    } catch (err: any) {
      // Handle CORS errors
      if (err.code === 'ERR_NETWORK' || err.message?.includes('CORS') || err.message?.includes('Failed to fetch')) {
        console.error("CORS Error in nearestDate:", err);
        if (failed > 7) {
          throw new Error("CORS policy blocking requests. Server may need to allow cross-origin access.");
        }
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // Handle 404 errors
      if (err.response?.status === 404) {
        if (failed > 7) throw new Error("No recent forecast data found.");
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
      // Other errors
      if (failed > 7) {
      console.error("nearestDate() failed:", err);
      return [d, failed];
      }
      d.setUTCDate(d.getUTCDate() - 1);
      return nearestDate(d, file_selected, failed + 1);
    }
  }

  // --- Plot markers on the map for each site ---
  // Creates colored circle markers on the map based on forecast data
  // Marker color represents AQI/PM value, size is based on zoom level
  const fetchMarkers = useCallback((type: string, time: string) => {
  let rKey: string | undefined;
  
  // Map internal forecast source keys to display names
  const forecastDisplayNames: { [key: string]: string } = {
    "dos missions": "DoS Missions",
    "aeronet": "AERONET",
    "open aq": "Open AQ",
    "african aqe": "African AQE",
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
          
          // Convert site name to display format (e.g., "abidjan" -> "Abidjan")
          const siteName =
            rawName
              .split("_")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

          // Find the correct data column based on type (AQI, PM, DAILY_AQI) and time
          // For AQI/PM, need to match both type and time (e.g., "AQI_130")
          // For DAILY_AQI, only match type (no time component)
          if (type !== "DAILY_AQI") {
            rKey = Object.keys(readings[key][0]).find(
              (x) => x.includes(type) && x.includes(time)
            );
          } else {
            rKey = Object.keys(readings[key][0]).find((x) =>
              x.includes(type)
            );
          }
          if (!rKey) continue; // Skip if no matching data column found

          // Extract the forecast value (AQI or PM2.5)
          // AQI values are integers, PM values are floats
          const value = type.includes("AQI")
            ? parseInt(readings[key][0][rKey])
            : parseFloat(readings[key][0][rKey]);
          
          // Get color based on value (green=good, yellow=moderate, red=unhealthy, etc.)
          const markerColor = setColor(value, "outter")?.toString() || "grey";

          // Display labels for different forecast types
          const markerType: { [key: string]: string } = {
            PM: "PM 2.5",
            DAILY_AQI: "DAILY AQI",
            AQI: "AQI",
          };

          // Also get PM2.5 value for display in tooltip
          const pmKey = Object.keys(readings[key][0]).find(
            (x) => x.includes("PM") && x.includes(time)
          );
          const pm = pmKey ? readings[key][0][pmKey] : "0";

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


          // --- Show 3-day forecast chart when marker is clicked ---
          marker.on("click", () => {
            // Set chart title with site name and source
            setClickedSite(`${siteName} (${forecastSource}) | 3-Day Forecast`);
            // Prepare chart data (Day 1, Day 2, Day 3 AQI values)
            const chartData = createChartData(readings[key]);
            setChartData(chartData);
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
  }, [readings, coordArr, type, time, markerSize, map, setClickedSite, setChartData, setShowChart, setResponse, createChartData]);

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
  useEffect(() => {
    fetchReadings(apiDate);
  }, [apiDate, enabledMarkers, fetchReadings]);

  return null;
};

export default SiteManager;
