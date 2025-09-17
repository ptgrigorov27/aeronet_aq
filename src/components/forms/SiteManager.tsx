import React, { useEffect, useState } from "react";
import { useMapContext } from "../MapContext";
import L from "leaflet";
import "leaflet-svg-shape-markers";
import { API_ARNT, API_AQ, API_DEF } from "../../config";
import axios from "axios";
import { setTextColor, setText, setColor } from "../Utils";

/**
 * Props expected by SiteManager
 */
interface SiteManagerProps {
  /** Callback to set the initialized date in parent */
  exInit: (d: Date) => void;
  /** API date string passed from parent */
  apiDate: string;
  /** Forecast type (e.g., AQI, PM, DAILY_AQI) */
  type: string;
  /** Show/hide chart modal */
  setShowChart: React.Dispatch<React.SetStateAction<boolean>>;
  /** Update chart data in parent */
  setChartData: React.Dispatch<React.SetStateAction<any[]>>;
  /** Selected forecast time (e.g., (130), (430)) */
  time: string;
  /** Site name for chart modal */
  setClickedSite: React.Dispatch<React.SetStateAction<string>>;
  /** Which forecast layers are enabled */
  enabledMarkers: {
    "DoS Missions": boolean;
    AERONET: boolean;
    "Open AQ": boolean;
  };
  /** Current zoom level */
  zoom: number;
  /** Status message handler */
  setResponse: React.Dispatch<React.SetStateAction<string>>;
  /** Index of initialized date */
  fromInit: number;
  /** Setter for initialized date index */
  setFromInit: React.Dispatch<React.SetStateAction<number>>;
  /** Setter for available date selections */
  setSelectArr: React.Dispatch<React.SetStateAction<string[]>>;
  /** Size of circle markers */
  markerSize: number;
  /** Flag for refreshing markers */
  refreshMarkers: boolean;
  /** Setter for refreshMarkers flag */
  setRefreshMarkers: React.Dispatch<React.SetStateAction<boolean>>;
  /** Flag for zoom change */
  zoomChange: boolean;
}

// Types for readings and coordinates
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

  // All site readings keyed by sitename
  const [readings, setReadingsDEF] = useState<{ [key: string]: ReadingRecord[] }>({});
  // Coordinate lookup by sitename
  const [coordArr, setCoordArr] = useState<CoordRecord>({});
  // Currently initialized date
  const [initDate, setInitDate] = useState<Date | null>(null);

  // API endpoints for different forecast sources
  const api_urls: { [key: string]: string } = {
    "DoS Missions": API_DEF,
    AERONET: API_ARNT,
    "Open AQ": API_AQ,
  };

  /**
   * Update marker radius when zoom changes
   */
  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);
    }
  }, [zoom, map]);

  /**
   * Refresh markers when zoom changes
   */
  useEffect(() => {
    clearMarkers();
    fetchMarkers(apiDate, "0");
  }, [zoomChange]);

  /**
   * Refresh markers when refresh flag is set
   */
  useEffect(() => {
    if (refreshMarkers) {
      clearMarkers();
      fetchReadings(apiDate, 0);
      fetchMarkers(type, time);
    }
    setRefreshMarkers(false);
  }, [refreshMarkers]);

  /**
   * Update markers whenever readings/type/time change
   */
  useEffect(() => {
    clearMarkers();
    fetchMarkers(type, time);
  }, [readings, type, time, fromInit]);

  /**
   * Fetch new readings when API date or enabled markers change
   */
  useEffect(() => {
    fetchReadings(apiDate, 0);
  }, [apiDate, enabledMarkers]);

  // ----------------- Helper Functions -----------------

  const updateMarkerSize = (size: number) => {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setStyle({ radius: size });
        }
      });
    }
  };

  function clearMarkers() {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker || layer instanceof L.FeatureGroup) {
          map.removeLayer(layer);
        }
      });
    }
  }

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
          obj[headers[j].trim()] = words[j];
        }
        result.push(obj);
      }
    } catch (err) {
      console.error(err);
    }
    return result;
  }

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
          .padStart(2, "0")}/${date.getUTCFullYear()}`,
    );
  }

  async function fetchReadings(sAPI?: string, failed: number = 0): Promise<boolean> {
    const readingResult: { [key: string]: ReadingRecord[] } = {};
    let d = new Date();
    const coordResult: CoordRecord = {};

    try {
      [d, failed] = await nearestDate(d, API_DEF, failed);

      for (const key in enabledMarkers) {
        const typedKey = key as keyof typeof enabledMarkers;
        if (enabledMarkers[typedKey]) {
          const api_selected = api_urls[key];
          setResponse("Fetch in progress...");
          // if (sAPI) d = new Date(sAPI);
          if (sAPI) {
            d = new Date(sAPI);
          } else {
            [d, failed] = await nearestDate(d, API_DEF, failed);
          }

          if (failed > 2) {
            setResponse("Date not found in API.");
            return true;
          }

          const [year, month, date] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
          const response = await axios.get(`${api_selected}year=${year}&month=${month}&day=${date}`);

          const csvBase = document.createElement("html");
          csvBase.innerHTML = response.data;
          const locationData = csvBase.textContent?.split("\n").slice(2).join("\n");
          const data = csvToJSON(locationData || "");

          const location_file = await fetch("/new_web/aqforecast/out.csv").then((res) => res.text());
          const data2 = csvToJSON(location_file);
          data2.forEach((obj: any) => {
            const siteName = obj.sitename.toLowerCase();
            coordResult[siteName] = {
              Latitude: parseFloat(obj.Latitude),
              Longitude: parseFloat(obj.Longitude),
            };
          });

          setSelectArr(setSelection(d));

          data.forEach((obj: any) => {
            const siteName = obj.Site_Name.toLowerCase();
            if (!readingResult[siteName]) readingResult[siteName] = [];
            readingResult[siteName].push(obj);
          });
        }
      }

      setResponse("");
      setCoordArr(coordResult);
      setReadingsDEF(readingResult);
      setFromInit(failed);

      exInit(d);
      setInitDate(d);
    } catch (e) {
      console.error(e);
      setResponse("API returned: No data available.");
      setSelectArr(["", "", ""]);
      return false;
    }
    return true;
  }

  // async function nearestDate(d: Date, api_selected: string, failed = 0): Promise<[Date, number]> {
  //   const [year, month, date] = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  //   const response = await axios.get(`${api_selected}year=${year}&month=${month}&day=${date}`);

  //   if (response.data.includes("Error")) {
  //     d.setUTCDate(d.getUTCDate() - 1);
  //     return nearestDate(d, api_selected, failed + 1);
  //   }
  //   return [new Date(year, month - 1, date), failed];
  // }

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
  
      // If API returns error → step back 1 day
      if (response.data.includes("Error")) {
        if (failed > 7) {
          // safety stop after a week
          throw new Error("No recent forecast data found.");
        }
        d.setUTCDate(d.getUTCDate() - 1);
        return nearestDate(d, api_selected, failed + 1);
      }
  
      return [d, failed];
    } catch (err) {
      console.error("nearestDate() failed:", err);
      return [d, failed];
    }
  }
  

  function formatDateAndParse(num: string, markerReference: any) {
    if (!num) num = "(130)";
    const dateStr = markerReference["UTC_DATE"];
    const [year, month, day] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    const formattedDateStr = date.toDateString();
    const numString = num.replace(/[()]/g, "").toString().padStart(4, "0");
    const firstTwo = numString.slice(0, 2);
    const lastTwo = numString.slice(2, 4);
    return `${formattedDateStr} ${firstTwo}:${lastTwo} UTC`;
  }

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

  const fetchMarkers = (type: string, time: string) => {
    let rKey: string | undefined;

    if (readings) {
      try {
        for (const site in coordArr) {
          if (Object.keys(readings).includes(site)) {
            if (type !== "DAILY_AQI") {
              rKey = Object.keys(readings[site][fromInit]).find((x) => x.includes(type) && x.includes(time));
            } else {
              rKey = Object.keys(readings[site][fromInit]).find((x) => x.includes(type));
            }

            if (!rKey) continue;
            const value = type.includes("AQI")
              ? parseInt(readings[site][fromInit][rKey])
              : parseFloat(readings[site][fromInit][rKey]);

            const markerColor = setColor(value, "outter")?.toString() || "grey";

            const markerReference = readings[site][fromInit];
            const markerType: { [key: string]: string } = {
              PM: "PM 2.5",
              DAILY_AQI: "DAILY AQI",
              AQI: "AQI",
            };
            const siteName: string = site
              .replace("__", "_")
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");

            const pmKey = Object.keys(readings[site][fromInit]).find((x) => x.includes("PM") && x.includes(time));
            const pm = pmKey ? readings[site][fromInit][pmKey] : "0";

            const marker = L.circleMarker([coordArr[site].Latitude, coordArr[site].Longitude], {
              fillColor: markerColor,
              color: "white",
              radius: markerSize,
              fillOpacity: 1,
              opacity: 1,
              weight: 2,
              stroke: true,
            } as any).addTo(map!);

            marker.on("mouseover", () => {
              marker
                .bindPopup(
                  `<div style="background-color: ${markerColor}; color: ${setTextColor(value)}; border-radius: 8px; padding: 20px;">
                      <div><b>Site Name:</b> ${siteName}
                        <span style="float: right;"><b>Station:</b> ${markerReference["Station"]}</span>
                      </div>
                      <div>
                        <span style="font-size: 20px;"><b>${markerType[type]}:</b> ${value}</span>
                        <span style="float: right; font-size: 20px;">
                          <b>PM2.5:</b> ${parseInt(pm)} µgm<sup>-3</sup>
                        </span>
                      </div>
                      <div>
                        <b>${setText(value)}</b>
                        <span style="float: right;">${formatDateAndParse(time, markerReference)}</span>
                      </div>
                  </div>`,
                )
                .openPopup();
            });

            marker.on("click", () => {
              setClickedSite(`${siteName} | 3-Day Forecast`);
              const chartData = createChartData(readings[site]);
              setChartData(chartData);
              setTimeout(() => setShowChart(true), 500);
            });
          }
        }
      } catch (e) {
        console.error("The following error occurred in fetchMarkers():", e);
        setResponse("API returned: No data available.");
      }
    }
  };

  return null;
};

export default SiteManager;
