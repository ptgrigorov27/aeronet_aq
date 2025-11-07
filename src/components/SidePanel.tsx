import React, { useState, useEffect } from "react";
import { Card, Button, Modal } from "react-bootstrap";
import { useMapContext } from "./MapContext";
import SiteManager from "./forms/SiteManager";
import styles from "./SidePanel.module.css";
import L from "leaflet";
import axios from "axios";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import Box from "@mui/material/Box";
import dayjs, { Dayjs } from "dayjs";
import { setTextColor, setColor } from "./Utils";
import { API_DEF } from "./../config";
import Chip from "@mui/material/Chip";
import type { ChartData } from "chart.js";

import {
  OutlinedInput,
  InputLabel,
  Stack,
  MenuItem,
  FormControl,
} from "@mui/material";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Props for SidePanel
interface SidePanelProps {
  setExType: (t: string) => void;
}

// Register chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);
ChartJS.register(ChartDataLabels);

const SidePanel: React.FC<SidePanelProps> = ({ setExType }) => {
  const { map } = useMapContext();

  // --- State variables for panel behavior ---
  const [isCloudLayerVisible, setIsCloudLayerVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(map?.getZoom() || 2);
  const [markerSize, setMarkerSize] = useState<number>(
    (zoomLevel + 2) * (Math.E - 1)
  );
  const [innerDate, setInnerDate] = useState<number>(0);
  const [apiDate, setApiDate] = useState<string>("");
  const [refreshMarkers, setRefreshMarkers] = useState<boolean>(false);
  const [type, setType] = useState<string>("AQI");
  const [zoom] = useState<number>(3);
  const [response, setResponse] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [clickedSite, setClickedSite] = useState<string>("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [showChart, setShowChart] = useState<boolean>(false);
  const [chartD, setChartD] = useState<ChartData<"bar"> | null>(null);
  const [chartOptions, setChartOptions] = useState({});
  const [ready, setReady] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selectArr, setSelectArr] = useState<string[]>(["", "", ""]);
  // const [zoomChange, setZoomChange] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string[]>([
    "DoS Missions",
  ]);
  const [fromInit, setFromInit] = useState<number>(0);
  //const [scrnWidth, setScrnWidth] = useState(600);

  // Time slots for forecasts
  const timeArr = [130, 430, 730, 1030, 1330, 1630, 1930, 2230];
  const [enabledMarkers, setEnabledMarkers] = useState({
    "DoS Missions": true,
    "AERONET": false,
    "Open AQ": false,
    "African AQE": false,
  });

  const chipNames = ["DoS Missions", "AERONET", "Open AQ", "African AQE"];

  // External layers (NASA imagery + labels)
  const nonbaseMaps = [
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  ];

  // Display labels for times
  const selectTimeArr = [
    "1:30 UTC",
    "4:30 UTC",
    "7:30 UTC",
    "10:30 UTC",
    "13:30 UTC",
    "16:30 UTC",
    "19:30 UTC",
    "22:30 UTC",
  ];

  // --- Chart helpers ---
  function genLabels(readings: any[]): string[] {
    const labels: string[] = [];
    for (const date in readings) {
      const d = new Date(Object.keys(readings[date])[0]);
      labels.push(
        d.toLocaleString("en-US", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
          hour12: false,
        })
      );
    }
    return labels;
  }

  function buildChart(cData: any[]): ChartData<"bar"> {
    const labels = genLabels(cData);
    const [ds1] = cData[0] ? Array.from(Object.values(cData[0])) : [];
    const [ds2] = cData[1] ? Array.from(Object.values(cData[1])) : [];
    const [ds3] = cData[2] ? Array.from(Object.values(cData[2])) : [];

    const n1 = Number(ds1);
    const n2 = Number(ds2);
    const n3 = Number(ds3);

    return {
      labels,
      datasets: [
        {
          label: "3-Day AQI Forecast",
          data: [n1, n2, n3],
          backgroundColor: [
            setColor(n1, "outter")?.toString() || "grey",
            setColor(n2, "outter")?.toString() || "grey",
            setColor(n3, "outter")?.toString() || "grey",
          ],
          borderColor: "white",
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.5, // controls bar thickness
          categoryPercentage: 0.6, // controls spacing between bars
          datalabels: {
            color: (ctx: any) => {
              const val = ctx.dataset.data[ctx.dataIndex];
              return setTextColor(val);
            },
            anchor: "center",
            align: "center",
            font: {
              size: 22,
              weight: "bold",
            },
          },
        },
      ],
    };
  }

  function genChartOptions(): object {
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 10, bottom: 10, left: 15, right: 15 },
      },
      plugins: {
        legend: { display: false },
        datalabels: {
          font: { size: 22, weight: "bold" },
          anchor: "end",
          align: "center",
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#000",
            font: { size: 14 },
          },
        },
        y: {
          grid: { color: "#ddd" },
          beginAtZero: true,
          ticks: {
            stepSize: 10,
          },
        },
      },
    };
  }

  // --- Effects ---
  // useEffect(() => {
  //   const handleResize = () => setScrnWidth(window.innerWidth);
  //   window.addEventListener("resize", handleResize);
  //   return () => window.removeEventListener("resize", handleResize);
  // }, []);

  // Update enabled markers when group changes
  useEffect(() => {
    const updatedMarkers = {
      "DoS Missions": selectedGroup.includes("DoS Missions"),
      "AERONET": selectedGroup.includes("AERONET"),
      "Open AQ": selectedGroup.includes("Open AQ"),
      "African AQE": selectedGroup.includes("African AQE"),
    };

    setEnabledMarkers(updatedMarkers);
    setRefreshMarkers(true);
  }, [selectedGroup]);

  //  NEW useEffect to ensure default forecast date is selected
  useEffect(() => {
    if (selectArr.length > 0) {
      setInnerDate(0); // Always default to the first forecast date
    }
  }, [selectArr]);

  // Initialize API date & nearest forecast time
  useEffect(() => {
    const today = new Date();
    setApiDate(today.toISOString());
    setType("AQI");
    nearestTime(today.toISOString());

    const init = async () => {
      try {
        const nearest = await nearestDate(today);
        setApiDate(nearest.toISOString());
        nearestTime(nearest.toISOString());
      } catch (err) {
        console.error("nearestDate failed:", err);
      }
    };
    init();
  }, [map]);

  // Refresh cloud layer when date changes
  useEffect(() => {
    setTimeout(() => {
      if (isCloudLayerVisible) {
        deleteLayer(cloudLayer());
        writeLayer(cloudLayer());
      }
    }, 500);
  }, [apiDate, innerDate]);

  // Update marker size state (no need to trigger zoomChange)
  useEffect(() => {
    setMarkerSize((zoomLevel + 2) * (Math.E - 1));
  }, [zoomLevel]);

  // Track zoom changes
  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoomLevel(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  // Build chart when site is clicked
  useEffect(() => {
    if (showChart && chartData.length > 0) {
      setTimeout(() => {
        setChartD(buildChart(chartData));
        setChartOptions(genChartOptions());
        setReady(true);
      }, 500);
    }
  }, [showChart, chartData]);

  // --- Helpers ---
  function getMapDate(): string {
    const d = new Date(fromInit);
    d.setUTCDate(d.getUTCDate() + innerDate);
    return `${d.getFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  // Cloud imagery layers
  function cloudLayer(): L.LayerGroup {
    const wmsLayer = L.tileLayer.wms(nonbaseMaps[0], {
      layers: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",
      crs: L.CRS.EPSG4326,
      opacity: 0.8,
      format: "image/png",
      time: getMapDate(),
      tileSize: 256,
      transparent: true,
      attribution: "",
      noWrap: true,
    } as any);

    const labelsLayer = L.tileLayer(nonbaseMaps[1], {
      zIndex: 1000,
      noWrap: true,
      tileSize: 256,
    });

    return L.layerGroup([wmsLayer, labelsLayer]);
  }

  // Find nearest valid forecast date
  async function nearestDate(
    initDate: Date,
    api_selected = API_DEF
  ): Promise<Date> {
    const d = new Date(initDate);
    const [year, month, date] = [
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
    ];
    const response = await axios.get(
      `${api_selected}year=${year}&month=${month}&day=${date}`
    );
    if (response.data.includes("Error")) {
      d.setUTCDate(d.getUTCDate() - 1);
      return nearestDate(d);
    }
    return d;
  }

  // Find nearest forecast time (slot)
  function nearestTime(dt: string): number {
    const d = new Date(dt);
    const hr = d.getUTCHours() * 100;
    const min = d.getUTCMinutes();
    const time = hr + min;

    let nearestValue = timeArr[0];
    let minDifference = Math.abs(timeArr[0] - time);
    for (let i = 1; i < timeArr.length; i++) {
      const difference = Math.abs(timeArr[i] - time);
      if (difference < minDifference) {
        minDifference = difference;
        nearestValue = i;
      }
    }
    setTime(`(${timeArr[nearestValue]})`);
    return nearestValue;
  }

  // Layer controls
  function writeLayer(layer: L.LayerGroup): boolean {
    try {
      map?.addLayer(layer);
      return true;
    } catch (err) {
      console.error(`Error adding group: ${err}`);
      return false;
    }
  }

  function deleteLayer(layers: L.LayerGroup): boolean {
    try {
      map?.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.TileLayer.WMS) {
          if (
            (layer as any)._url === nonbaseMaps[0] ||
            (layer as any)._url === nonbaseMaps[1]
          ) {
            map.removeLayer(layer);
          }
        }
      });
      return true;
    } catch (err) {
      console.error(`Error deleting group; ${layers} with error ${err}`);
      return false;
    }
  }

  function toggleCloudLayer(): boolean {
    setIsCloudLayerVisible((prev) => !prev);
    return isCloudLayerVisible
      ? deleteLayer(cloudLayer())
      : writeLayer(cloudLayer());
  }

  // --- Handlers ---
  function handleZoomChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const zoom = Number.parseInt(event.target.value, 10);
    if (map) {
      map.setZoom(zoom);
      setZoomLevel(zoom);
    }
  }

  function handleChartDone(): void {
    setReady(false);
    setShowChart(false);
  }

  function handleTimeSelect(value: string): void {
    setTime(value);
  }

  function handleTypeSelect(event: SelectChangeEvent): void {
    const newType = event.target.value;
    setType(newType);
    setExType(newType);
  }

  function toggleCollapse(): void {
    setCollapsed(!collapsed);
  }

  // --- JSX (UI rendering) ---
  return (
    <>
      {/* Collapse toggle button */}
      <h5
        style={{
          zIndex: 1001,
          top: "15rem",
          right: collapsed ? "0rem" : "19.4rem",
          whiteSpace: "nowrap",
          margin: "0",
          padding: "5px",
          borderRadius: "5px 0px 0px 5px",
          position: "fixed",
          color: "black",
          backgroundColor: collapsed ? "#198754" : "#d32f2f",
        }}
      >
        <button
          style={{ color: "inherit", padding: 0 }}
          className="btn btn-link"
          onClick={toggleCollapse}
        >
          {collapsed ? (
            <img
              src="https://cdn3.iconfinder.com/data/icons/eyes-6/32/Eye_View_Visible_Show_Preview-512.png"
              width={25}
              height={25}
            />
          ) : (
            <img
              src="https://static.thenounproject.com/png/1069529-200.png"
              width={25}
              height={25}
            />
          )}
        </button>
      </h5>

      {/* Side panel card */}
      <Card
        id="collapseMod"
        style={{
          width: "18rem",
          position: "fixed",
          right: "1.5rem",
          top: "1.5rem",
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.9) !important",
        }}
        className={`collapse ${collapsed ? "" : "show"}`}
      >
        <Card.Body>
          <Card.Title style={{ textAlign: "center" }}>
            Air Quality Forecast
          </Card.Title>

          {/* Zoom, reset, and satellite buttons */}
          <div className={styles.buttonGroup}>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min={3}
                max={19}
                step={1}
                value={zoomLevel}
                onChange={handleZoomChange}
                className={styles.slider}
              />
              <div className={styles.sliderLabel}>Zoom Level: {zoomLevel}</div>
            </div>
            <Button
              variant="warning"
              onClick={() => map && map.setView([0, 0], 3)}
            >
              Reset View
            </Button>
            <Button onClick={toggleCloudLayer}>
              {isCloudLayerVisible
                ? "Disable Satellite Layer"
                : "Enable Satellite Layer"}
            </Button>
          </div>

          <hr className={styles.separator} />

          {/* Forecast selection controls */}
          <div className={styles.buttonGroup}>
            {apiDate && (
              <>
                <DatePicker
                  maxDate={dayjs(new Date())}
                  value={apiDate ? dayjs(apiDate) : null}
                  onChange={(date: Dayjs | null) => {
                    if (date) {
                      setApiDate(date.toISOString());
                      setInnerDate(0);
                    }
                  }}
                  label="Model Initialization"
                />

                <Box className="mt-2" sx={{ minWidth: 120 }}>
                  <FormControl fullWidth>
                    <InputLabel>Forecast Date</InputLabel>
                    <Select
                      label="Forecast Date"
                      value={innerDate}
                      onChange={(event) =>
                        setInnerDate(Number(event.target.value))
                      }
                    >
                      {selectArr.map((val, index) => (
                        <MenuItem key={index} value={index}>
                          {val}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {type !== "DAILY_AQI" && (
                  <Box className="mt-2" sx={{ minWidth: 120 }}>
                    <FormControl fullWidth>
                      <InputLabel>Time</InputLabel>
                      <Select
                        label="Time"
                        value={time}
                        onChange={(event) =>
                          handleTimeSelect(event.target.value)
                        }
                      >
                        {selectTimeArr.map((val, index) => (
                          <MenuItem key={index} value={`(${timeArr[index]})`}>
                            {val}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}

                <Box className="mt-2" sx={{ minWidth: 120 }}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      label="Type"
                      value={type}
                      onChange={handleTypeSelect}
                    >
                      <MenuItem value="AQI">AQI</MenuItem>
                      <MenuItem value="PM">PM 2.5</MenuItem>
                      <MenuItem value="DAILY_AQI">Daily AQI</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}

            {/* Forecast group selection */}
            <FormControl fullWidth>
              <InputLabel>Enabled Forecast</InputLabel>
              <Select
                multiple
                value={selectedGroup}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroup(typeof val === "string" ? [val] : val);
                }}
                input={<OutlinedInput label="Enabled Forecast" />}
                renderValue={(selected) => (
                  <Stack gap={0.5} direction="row" flexWrap="wrap">
                    {selected.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Stack>
                )}
              >
                {chipNames.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {response.length > 0 && (
              <p style={{ textAlign: "center", marginBottom: "-5px" }}>
                {response}
              </p>
            )}
          </div>
        </Card.Body>

        {/* SiteManager handles API + plotting */}
        <SiteManager
          fromInit={innerDate}
          setSelectArr={setSelectArr}
          setFromInit={setInnerDate}
          apiDate={apiDate}
          exInit={(d: Date) => setFromInit(d.getTime())}
          setChartData={setChartData}
          setClickedSite={setClickedSite}
          setShowChart={setShowChart}
          setResponse={setResponse}
          type={type}
          time={time}
          enabledMarkers={enabledMarkers}
          zoom={zoom}
          markerSize={markerSize}
          refreshMarkers={refreshMarkers}
          setRefreshMarkers={setRefreshMarkers}
          //zoomChange={zoomChange}
        />
      </Card>

      {/* Chart modal */}
      <Modal
        show={showChart}
        onHide={handleChartDone}
        className="modal-lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{clickedSite}</Modal.Title>
        </Modal.Header>
        {/* <Modal.Body>
          {ready && chartD && <Bar options={chartOptions} data={chartD} />}
        </Modal.Body> */}
        <Modal.Body style={{ height: "250px" }}>
          {ready && chartD && (
            <div style={{ height: "100%", width: "100%" }}>
              <Bar options={chartOptions} data={chartD} />
            </div>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default SidePanel;
