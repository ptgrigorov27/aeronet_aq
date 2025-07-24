import React, { useEffect, useState } from "react";
import { useMapContext } from "../MapContext";
import L from "leaflet";
import * as d3 from "d3";
import "leaflet-svg-shape-markers";
import { API_ARNT, API_AQ, API_DEF } from "../../config";
import axios from "axios";
import styles from "./Map.module.css";
import { setTextColor, setText, setColor } from "../Utils";

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
  setZoomChange,
}) => {
  const { map } = useMapContext();
  const [readings, setReadingsDEF] = useState<Array<{ [key: string]: string }>>(
    [],
  );
  const [coordArr, setCoordArr] = useState<Array<string>>([]);
  const [initDate, setInitDate] = useState<string>("");
  const api_urls = {
    "DoS Missions": API_DEF,
    AERONET: API_ARNT,
    "Open AQ": API_AQ,
  };

  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);
    }
  }, [zoom, map]);

  useEffect(() => {
    clearMarkers();
    fetchMarkers(apiDate, 0);
  }, zoomChange);

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

  const updateMarkerSize = (size: number) => {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.CircleMarker) {
          layer.setStyle({
            radius: size,
          });
        }
      });
    }
  };

  function clearMarkers() {
    if (map) {
      map.eachLayer((layer: L.Layer) => {
        if (
          layer instanceof L.CircleMarker ||
          layer instanceof L.FeatureGroup
        ) {
          map.removeLayer(layer);
        }
      });
    }
  }

  function csvToJSON(csv: string) {
    const lines = csv.split("\n");
    const result = [];
    const headers = lines[0].split(",");

    try {
      for (let i = 1; i < lines.length; i++) {
        const obj = {};
        if (lines[i] == undefined) {
          console.log(`${i} is undefined`);
          continue;
        } else if (lines[i].trim() == undefined || lines[i].trim() == "") {
          continue;
        }

        const words = lines[i].split(",");
        for (let j = 0; j < words.length; j++) {
          obj[headers[j].trim()] = words[j];
        }

        result.push(obj);
      }
    } catch (err) {
      console.log(err);
    }
    return result;
  }

  function setSelection(d: Date) {
    const d2 = new Date(d);
    d2.setUTCDate(d.getUTCDate() + 1);

    const d3 = new Date(d2);
    d3.setUTCDate(d2.getUTCDate() + 1);

    const d4 = new Date(d3);
    d4.setUTCDate(d3.getUTCDate() + 1);

    const [year1, month1, date1] = [
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
    ];

    const [year2, month2, date2] = [
      d2.getUTCFullYear(),
      d2.getUTCMonth() + 1,
      d2.getUTCDate(),
    ];

    const [year3, month3, date3] = [
      d3.getUTCFullYear(),
      d3.getUTCMonth() + 1,
      d3.getUTCDate(),
    ];
    return [
      `${month1.toString().padStart(2, "0")}/${date1.toString().padStart(2, "0")}/${year1}`,
      `${month2.toString().padStart(2, "0")}/${date2.toString().padStart(2, "0")}/${year2}`,
      `${month3.toString().padStart(2, "0")}/${date3.toString().padStart(2, "0")}/${year3}`,
    ];
  }

  async function fetchReadings(
    sAPI?: string,
    failed?: number,
  ): Promise<boolean> {
    const readingResult = {};
    let d = new Date();
    const coordResult = {};
    try {
      [d, failed] = await nearestDate(d, API_DEF);

      for (const key in enabledMarkers) {
        if (enabledMarkers[key]) {
          const api_selected = api_urls[key];
          setResponse("Fetch in progress...");
          if (sAPI) {
            d = new Date(sAPI);
          }

          // INFO: Deconstruct return to check range limit and capture date returned

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
            `${api_selected}year=${year}&month=${month}&day=${date}`,
          );

          const csvBase = document.createElement("html");
          csvBase.innerHTML = response.data;
          const locationData = csvBase.textContent
            ?.split("\n")
            .slice(2)
            .join("\n");
          const data = csvToJSON(locationData);
          // const location_file = await fetch("/src/out.csv").then(
          const location_file = await fetch("/new_web/aqforecast/out.csv").then(
            (response) => response.text(),
          );

          const data2 = csvToJSON(location_file);
          data2.forEach((obj) => {
            const siteName = obj.sitename.toLowerCase();
            coordResult[siteName] = {
              Latitude: parseFloat(obj.Latitude),
              Longitude: parseFloat(obj.Longitude),
            };
          });

          setSelectArr(setSelection(d));

          data.forEach((obj) => {
            const siteName = obj.Site_Name.toLowerCase();
            if (!readingResult[siteName]) {
              readingResult[siteName] = [];
            }
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

  async function nearestDate(d, api_selected, failed = 0) {
    const [year, month, date] = [
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
    ];

    const response = await axios.get(
      `${api_selected}year=${year}&month=${month}&day=${date}`,
    );

    console.log("nearest date resolved to: ", response);

    if (response.data.includes("Error")) {
      d.setUTCDate(d.getUTCDate() - 1);
      console.log("if response data includes error: ", d.toISOString());
      return nearestDate(d, failed + 1);
    }

    console.log("initUTCDate returning: ", d.toISOString());

    return [new Date(year, month - 1, date), failed];
  }

  function formatDateAndParse(num, markerReference) {
    if (!num) {
      num = "(130)";
    }
    const dateStr = markerReference["UTC_DATE"];
    const [year, month, day] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    const dayOptions = { weekday: "short" };
    const monthOptions = { month: "short" };
    const dateOptions = { day: "numeric" };
    const yearOptions = { year: "numeric" };
    const formattedDay = date.toLocaleDateString("en-US", dayOptions);
    const formattedMonth = date.toLocaleDateString("en-US", monthOptions);
    const formattedDate = date.toLocaleDateString("en-US", dateOptions);
    const formattedYear = date.toLocaleDateString("en-US", yearOptions);
    const formattedDateStr = `${formattedDay} ${formattedMonth} ${formattedDate} ${formattedYear}`;
    const numString = num.replace(/[()]/g, "").toString().padStart(4, "0");
    const firstTwo = numString.slice(0, 2);
    const lastTwo = numString.slice(2, 4);
    const formattedNum = `${firstTwo}:${lastTwo}`;
    const finalFormattedString = `${formattedDateStr} ${formattedNum} UTC`;
    return finalFormattedString;
  }
  const createChartData = (reading) => {
    const chartData = [{}, {}, {}];
    const d = new Date(initDate);

    for (let day = 0; day < 3; day++) {
      d.setUTCSeconds(0);
      chartData[day][d.toISOString()] = reading[day]["DAILY_AQI"];
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return chartData;
  };

  const fetchMarkers = (type: string, time: string) => {
    let rKey;

    if (readings) {
      try {
        for (const site in coordArr) {
          if (Object.keys(readings).includes(site)) {
            if (type !== "DAILY_AQI") {
              rKey = Object.keys(readings[site][fromInit]).find(
                (x) => x.includes(`${type}`) && x.includes(`${time}`),
              );
            } else {
              rKey = Object.keys(readings[site][fromInit]).find((x) =>
                x.includes(`${type}`),
              );
            }
            const value = type.includes("AQI")
              ? parseInt(readings[site][fromInit][rKey])
              : parseFloat(readings[site][fromInit][rKey]);

            const markerColor = setColor(
              parseFloat(readings[site][fromInit][rKey]),
              "outter",
            );

            const markerReference = readings[site][fromInit];
            const markerType = {
              PM: "PM 2.5",
              DAILY_AQI: "DAILY AQI",
              AQI: "AQI",
            };
            const siteName: string = site
              .replace("__", "_")
              .split("_")
              .map((words) => {
                return words.charAt(0).toUpperCase() + words.slice(1);
              })
              .join(" ");
            const pmKey = Object.keys(readings[site][fromInit]).find(
              (x) => x.includes("PM") && x.includes(`${time}`),
            );
            const pm = readings[site][fromInit][pmKey];
            const marker = L.circleMarker(
              [coordArr[site].Latitude, coordArr[site].Longitude],
              {
                fillColor: markerColor,
                color: "white",
                radius: markerSize,
                fillOpacity: 1,
                opacity: 1,
                weight: 2,
                stroke: true,
                setFillOpacity: 1,
                interactive: true,
                value: value,
                site: site,
                closeButton: false,
                type: markerType[type],
                originalColor: markerColor,
                previousSize: markerSize,
              },
            ).addTo(map);

            const customOpts = {
              className: "custom-popup",
              closeButton: false,
            };

            marker.on("mouseover", () => {
              marker
                .bindPopup(
                  `<div style="background-color: ${markerColor}; width:max-content; max-width: 500px; color: ${setTextColor(value)}; border-radius: 8px; padding: 20px; margin: 0;">
                      <div>
                          <b>Site Name:</b> ${siteName}<span>&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span style="float: right;"><b>Station:</b> ${markerReference["Station"]}</span>
                      </div>
                      <div>
                          <span style="font-size: 20px;"><b>${marker.options.type}:</b> 
                              ${type.includes("AQI") ? `${marker.options.value}` : `${marker.options.value.toFixed(4)} µgm<sup>-3</sup>`}
                          </span> <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span style="float: right; font-size: 20px;"><b>PM2.5:</b> ${parseInt(pm)} µgm<sup>-3</sup></span>
                      </div>
                      <div>
                          <b>${setText(value)}</b> <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span style="float: right;">${formatDateAndParse(time, markerReference)}</span>
                      </div>
                  </div>`,
                  customOpts,
                )
                .openPopup();
            });

            marker.on("click", () => {
              setClickedSite(`${siteName} | 3-Day Forecast`);
              const chartData = createChartData(readings[site]);
              setChartData(chartData);
              setTimeout(() => {
                setShowChart(true);
              }, 500);
            });
          }
        }
      } catch (e) {
        console.error("The following error occured in fetchReadings();");
        console.log(e);
        console.log(readings);
        setResponse("API returned: No data available.");
      }
    }
  };
};
export default SiteManager;
