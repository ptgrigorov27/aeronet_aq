import React, { useEffect, useState } from "react";
import { useMapContext } from "../MapContext";
import L from "leaflet";
import "leaflet-svg-shape-markers";
import { API_ARNT, API_AQ, API_DEF, API_AAQE } from "../../config";
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
    AERONET: boolean;
    "Open AQ": boolean;
    "Africa AQE": boolean;
  };
  zoom: number;
  setResponse: React.Dispatch<React.SetStateAction<string>>;
  fromInit: number;
  setFromInit: React.Dispatch<React.SetStateAction<number>>;
  setSelectArr: React.Dispatch<React.SetStateAction<string[]>>;
  markerSize: number;
  refreshMarkers: boolean;
  setRefreshMarkers: React.Dispatch<React.SetStateAction<boolean>>;
  zoomChange: boolean;
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
  zoomChange,
}) => {
  const { map } = useMapContext();
  const [readings, setReadingsDEF] = useState<{ [key: string]: ReadingRecord[] }>({});
  const [coordArr, setCoordArr] = useState<CoordRecord>({});
  const [initDate, setInitDate] = useState<Date | null>(null);

  // API endpoints for different stations
  const api_urls: { [key: string]: string } = {
    "DoS Missions": API_DEF,
    AERONET: API_ARNT,
    "Open AQ": API_AQ,
    "Africa AQE": API_AAQE,
  };

  // --- React hooks for updates ---
  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);
    }
  }, [zoom, map]);

  useEffect(() => {
    clearMarkers();
    fetchMarkers(type, time);
  }, [zoomChange]);

  useEffect(() => {
    if (refreshMarkers) {
      clearMarkers();
      fetchReadings(apiDate, 0);
      fetchMarkers(type, time);
    }
    setRefreshMarkers(false);
  }, [refreshMarkers]);

  useEffect(() => {
    clearMarkers();
    fetchMarkers(type, time);
  }, [readings, type, time, fromInit]);

  useEffect(() => {
    fetchReadings(apiDate, 0);
  }, [apiDate, enabledMarkers]);

  // --- Helper to resize markers on zoom ---
  const updateMarkerSize = (size: number) => {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setStyle({ radius: size });
        }
      });
    }
  };

  // --- Clear all old markers ---
  function clearMarkers() {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker || layer instanceof L.FeatureGroup) {
          map.removeLayer(layer);
        }
      });
    }
  }

  // --- Utility: Convert CSV to JSON ---
  function csvToJSON(csv: string) {
    const lines = csv.split("\n");
    const result: any[] = [];
    const headers = lines[0].split(",");
    try {
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i] || lines[i].trim() === "") continue;
        const obj: any = {};
        const words = lines[i].split(",");
        for (let j = 0; j < words.length; j++) {
          const header = headers[j] ? headers[j].trim() : `col_${j}`;
          const value = words[j] ? words[j].trim() : "";
          obj[header] = value;
        }
        result.push(obj);
      }
    } catch (err) {
      console.error(err);
    }
    return result;
  }

  // --- Generate forecast date options for dropdown ---
  function setSelection(d: Date) {
    const d2 = new Date(d);
    d2.setUTCDate(d.getUTCDate() + 1);
    const d3 = new Date(d2);
    d3.setUTCDate(d2.getUTCDate() + 1);
    return [d, d2, d3].map(
      (date) =>
        `${(date.getUTCMonth() + 1).toString().padStart(2, "0")}/${date
          .getUTCDate()
          .toString()
          .padStart(2, "0")}/${date.getUTCFullYear()}`
    );
  }

  // --- Fetch station readings & site coordinates ---
  async function fetchReadings(
    sAPI?: string,
    failed: number = 0
  ): Promise<boolean> {
    const readingResult: { [key: string]: ReadingRecord[] } = {};
    let d = new Date();
    const coordResult: CoordRecord = {};

    try {
      [d, failed] = await nearestDate(d, API_DEF, failed);
      // console.log("Nearest date:", d.toISOString(), "Failed count:", failed);

      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey]) {
          const api_selected = api_urls[key];
          setResponse("Fetch in progress...");

          // Allow overriding API date
          if (sAPI) {
            const candidate = new Date(sAPI);
            if (!isNaN(candidate.getTime())) {
              d = candidate;
            }
          }

          if (failed > 2) {
            setResponse("Date not found in API.");
            return true;
          }

          const [year, month, date] = [
            d.getUTCFullYear(),
            d.getUTCMonth() + 1,
            d.getUTCDate(),
          ];
          const response = await axios.get(
            `${api_selected}year=${year}&month=${month}&day=${date}`
          );
          // console.log("API request URL:", `${api_selected}year=${year}&month=${month}&day=${date}`);
          // console.log("API response data (first 500 chars):", response.data.substring(0, 500));

          // Parse CSV forecast data
          const csvBase = document.createElement("html");
          csvBase.innerHTML = response.data;
          const locationData = csvBase.textContent?.split("\n").slice(2).join("\n");
          const data = csvToJSON(locationData || "");

          // Load coordinates from out.csv
          const location_file = await fetch("/new_web/aqforecast/out.csv")
            .then((response) => response.text())
            .catch((err) => {
              console.error("Error fetching out.csv:", err);
              return "";
            });

          // console.log("out.csv content (first 500 chars):", location_file.slice(0, 500));
          
          const data2 = csvToJSON(location_file);
          data2.forEach((obj: any) => {
            if (obj.sitename && obj.Forecast) {
              const key = `${obj.sitename.toLowerCase()}_${obj.Forecast.toLowerCase()}`;
              coordResult[key] = {
                Latitude: parseFloat(obj.Latitude || "0"),
                Longitude: parseFloat(obj.Longitude || "0"),
              };
            }
          });
          

          // Fill forecast date dropdown
          const selection = setSelection(d);
          if (selection && selection.length > 0) {
            setSelectArr(selection);
          } else {
            setSelectArr([
              "Day 1 (No API data)",
              "Day 2 (No API data)",
              "Day 3 (No API data)",
            ]);
          }

          // Store readings by Sitename and Forecast 
          data.forEach((obj: any) => {
            if (obj.Site_Name) {
              const siteName = obj.Site_Name.toLowerCase();
              const forecast = obj.Forecast || "DoS Missions"; // fallback if missing
              const key = `${siteName}_${forecast.toLowerCase()}`;
            
              if (!readingResult[key]) readingResult[key] = [];
              readingResult[key].push(obj);
            }            
          });
        }
      }

      // Update state with results
      setResponse("");
      setCoordArr(coordResult);
      setReadingsDEF(readingResult);
      setFromInit(d.getTime());
      exInit(d);
      setInitDate(d);
    } catch (e) {
      console.error(e);
      setResponse("API returned: No data available.");
      setSelectArr([
        "Day 1 (Fallback)",
        "Day 2 (Fallback)",
        "Day 3 (Fallback)",
      ]);
      return false;
    }
    return true;
  }

  // --- Get nearest valid API date ---
  async function nearestDate(
    d: Date,
    api_selected: string,
    failed = 0
  ): Promise<[Date, number]> {
    const [year, month, date] = [
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
    ];
    try {
      const response = await axios.get(
        `${api_selected}year=${year}&month=${month}&day=${date}`
      );
      // console.log("API request URL:", `${api_selected}year=${year}&month=${month}&day=${date}`);
      if (response.data.includes("Error")) {
        if (failed > 7) throw new Error("No recent forecast data found.");
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, api_selected, failed + 1);
      }
      return [d, 0]; // reset failed counter on success
    } catch (err) {
      console.error("nearestDate() failed:", err);
      return [d, failed];
    }
  }

  // --- Plot markers on the map for each site ---
const fetchMarkers = (type: string, time: string) => {
  let rKey: string | undefined;
  if (readings) {
    try {
      for (const key in coordArr) {
        if (Object.keys(readings).includes(key)) {
          // 🔑 Split site key into sitename + forecast source
          const [rawName, rawForecast] = key.split("_");
          const forecastSource = rawForecast
            ? rawForecast.charAt(0).toUpperCase() + rawForecast.slice(1)
            : "Unknown";
          const siteName =
            rawName.charAt(0).toUpperCase() + rawName.slice(1);

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
};

  // --- Prepare chart data for 3-day forecast ---
  const createChartData = (reading: any[]) => {
    const chartData: any[] = [{}, {}, {}];
    if (!initDate) return chartData;
    const d = new Date(initDate);
    for (let day = 0; day < 3; day++) {
      d.setUTCSeconds(0);
      chartData[day][d.toISOString()] = reading[day]["DAILY_AQI"];
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return chartData;
  };

  return null;
};

export default SiteManager;
