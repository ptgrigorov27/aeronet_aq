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
  const [readings, setReadingsDEF] = useState<{ [key: string]: ReadingRecord[] }>({});
  const [coordArr, setCoordArr] = useState<CoordRecord>({});
  const [initDate, setInitDate] = useState<Date | null>(null);

  // GeoJSON file paths for different forecast sources
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

  // --- Fetch station readings & site coordinates from GeoJSON files ---
  const fetchReadings = useCallback(async (
    sAPI?: string
  ): Promise<boolean> => {
    const readingResult: { [key: string]: ReadingRecord[] } = {};
    let modelInitDate = new Date();
    const coordResult: CoordRecord = {};

    try {
      // Allow overriding date from user selection
      if (sAPI) {
        const candidate = new Date(sAPI);
        if (!isNaN(candidate.getTime())) {
          modelInitDate = candidate;
        }
      }

      // Step 1: Find the model initialization date
      // Check if today's file exists, if not find the most recent available file
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

      // Step 2: Fetch data for all enabled forecast sources using the model initialization date
      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey]) {
          const file_selected = file_urls[key];
          setResponse(`Fetching ${key} forecast data...`);

          // Use the model initialization date for all sources
          let dateToUse = new Date(modelInitDate);

          const year = dateToUse.getUTCFullYear();
          const month = String(dateToUse.getUTCMonth() + 1).padStart(2, "0");
          const date = String(dateToUse.getUTCDate()).padStart(2, "0");
          const dateString = `${year}${month}${date}`;

          // Fetch GeoJSON file
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

          if (!response || !response.data || !response.data.features) {
            setResponse("GeoJSON file is empty or invalid.");
            continue;
          }

          const geojsonData = response.data;
          const features = geojsonData.features || [];

          // Group features by site name first
          const siteGroups: { [siteKey: string]: any[] } = {};

          features.forEach((feature: any) => {
            if (!feature.geometry || !feature.properties) return;

            const coordinates = feature.geometry.coordinates; // [lon, lat]
            const properties = feature.properties;
            const siteName = properties.Site_Name?.toLowerCase().trim();
            
            if (!siteName || !coordinates || coordinates.length < 2) return;

            const forecastSource = key;
            const siteKey = `${siteName}_${forecastSource.toLowerCase()}`;
            const coordKey = siteKey;

            // Store coordinates (GeoJSON uses [lon, lat], Leaflet uses [lat, lon])
            // Store only once per site (coordinates should be the same for all days)
            if (!coordResult[coordKey]) {
              coordResult[coordKey] = {
                Latitude: parseFloat(coordinates[1]),
                Longitude: parseFloat(coordinates[0]),
              };
            }

            // Group by site
            if (!siteGroups[siteKey]) {
              siteGroups[siteKey] = [];
            }
            siteGroups[siteKey].push(properties);
          });

          // Sort each site's features by UTC_DATE and store in readingResult
          for (const siteKey in siteGroups) {
            const siteFeatures = siteGroups[siteKey];
            // Sort by UTC_DATE to ensure Day 1, Day 2, Day 3 order
            siteFeatures.sort((a, b) => {
              const dateA = new Date(a.UTC_DATE || "").getTime();
              const dateB = new Date(b.UTC_DATE || "").getTime();
              return dateA - dateB;
            });
            readingResult[siteKey] = siteFeatures;
          }

          // Forecast dates are Day 1, Day 2, Day 3 from model initialization date
          // (This will be set once after all sources are processed)
        }
      }

      // Update state with results
      if (Object.keys(readingResult).length > 0) {
      setResponse("");
      } else {
        setResponse("No forecast data loaded. Check console for details.");
      }
      
      // Set forecast date dropdown based on model initialization date
      // Forecast dates are Day 1, Day 2, Day 3 from model initialization date
      const selection = setSelection(modelInitDate);
      if (selection && selection.length > 0) {
        setSelectArr(selection);
      } else {
        setSelectArr([
          "Day 1 (No data)",
          "Day 2 (No data)",
          "Day 3 (No data)",
        ]);
      }
      
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

  // --- Prepare chart data for 3-day forecast ---
  const createChartData = useCallback((reading: any[]) => {
    const chartData: any[] = [{}, {}, {}];
    if (!initDate) return chartData;
    const d = new Date(initDate);
    for (let day = 0; day < 3; day++) {
      d.setUTCSeconds(0);
      chartData[day][d.toISOString()] = reading[day]["DAILY_AQI"];
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return chartData;
  }, [initDate]);

  // --- Get nearest valid GeoJSON file date ---
  async function nearestDate(
    d: Date,
    file_selected: string,
    failed = 0
  ): Promise<[Date, number]> {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const date = String(d.getUTCDate()).padStart(2, "0");
    const dateString = `${year}${month}${date}`;
    
    try {
      const filePath = `${file_selected}${dateString}_forecast.geojson`;
      const response = await axios.get(filePath, { 
        validateStatus: (status: number) => status < 500 
      });
      
      if (response.status !== 200 || !response.data || !response.data.features) {
        if (failed > 7) throw new Error("No recent forecast data found.");
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, file_selected, failed + 1);
      }
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
  const fetchMarkers = useCallback((type: string, time: string) => {
  let rKey: string | undefined;
  
  // Map lowercase forecast source back to display name
  const forecastDisplayNames: { [key: string]: string } = {
    "dos missions": "DoS Missions",
    "aeronet": "AERONET",
    "open aq": "Open AQ",
    "african aqe": "African AQE",
  };
  
  if (readings) {
    try {
      for (const key in coordArr) {
        if (Object.keys(readings).includes(key)) {
          // Split site key into sitename + forecast source
          const lastUnderscore = key.lastIndexOf("_");
          const rawName = key.slice(0, lastUnderscore);
          const rawForecast = key.slice(lastUnderscore + 1).toLowerCase();

          const forecastSource = forecastDisplayNames[rawForecast] || rawForecast
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          
          const siteName =
            rawName
              .split("_")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

          // --- Find correct reading column for AQI, PM, or DAILY AQI ---
          if (type !== "DAILY_AQI") {
            rKey = Object.keys(readings[key][0]).find(
              (x) => x.includes(type) && x.includes(time)
            );
          } else {
            rKey = Object.keys(readings[key][0]).find((x) =>
              x.includes(type)
            );
          }
          if (!rKey) continue;

          const value = type.includes("AQI")
            ? parseInt(readings[key][0][rKey])
            : parseFloat(readings[key][0][rKey]);
          const markerColor = setColor(value, "outter")?.toString() || "grey";
          // const markerReference = readings[key][0];

          const markerType: { [key: string]: string } = {
            PM: "PM 2.5",
            DAILY_AQI: "DAILY AQI",
            AQI: "AQI",
          };

          const pmKey = Object.keys(readings[key][0]).find(
            (x) => x.includes("PM") && x.includes(time)
          );
          const pm = pmKey ? readings[key][0][pmKey] : "0";

          // --- Create map marker ---
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

            // --- Tooltip on hover ---
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


          // --- Show chart on click ---
          marker.on("click", () => {
            setClickedSite(`${siteName} (${forecastSource}) | 3-Day Forecast`);
            const chartData = createChartData(readings[key]);
            setChartData(chartData);
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

  // --- React hooks for updates ---
  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);
    }
  }, [zoom, markerSize, updateMarkerSize]);

  useEffect(() => {
    if (refreshMarkers) {
      clearMarkers();
      fetchReadings(apiDate);
      fetchMarkers(type, time);
    }
    setRefreshMarkers(false);
  }, [refreshMarkers, clearMarkers, fetchReadings, fetchMarkers, apiDate, type, time]);

  useEffect(() => {
    clearMarkers();
    fetchMarkers(type, time);
  }, [readings, type, time, fromInit, clearMarkers, fetchMarkers]);

  useEffect(() => {
    fetchReadings(apiDate);
  }, [apiDate, enabledMarkers, fetchReadings]);

  return null;
};

export default SiteManager;
