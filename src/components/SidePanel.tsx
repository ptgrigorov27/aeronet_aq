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
import { setTextColor, setText, setColor } from "./Utils";
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
interface SidePanelProps {
  setExType: (t: string) => void;
}

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
  // const [fromInit, setFromInit] = useState<number>(0);
  const [initDate, setInitDate] = useState<Date | null>(null);
  const [selectArr, setSelectArr] = useState<string[]>(["", "", ""]);
  const [zoomChange, setZoomChange] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string[]>([
    "DoS Missions",
  ]);

  const timeArr = [130, 430, 730, 1030, 1330, 1630, 1930, 2230];
  const [enabledMarkers] = useState({
    "DoS Missions": true,
    AERONET: false,
    "Open AQ": false,
  });

  const chipNames = ["DoS Missions", "AERONET", "Open AQ"];

  const nonbaseMaps = [
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  ];

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

  const [scrnWidth, setScrnWidth] = useState(600);

  useEffect(() => {
    const handleResize = () => setScrnWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    Object.keys(enabledMarkers).forEach((group) => {
      const key = group as keyof typeof enabledMarkers;
      enabledMarkers[key] = selectedGroup.includes(group);
    });
    setRefreshMarkers(true);
  }, [selectedGroup]);

  useEffect(() => {
    setTimeout(() => {
      setApiDate(new Date().toISOString());
      setType("AQI");
      nearestTime(new Date().toISOString());
    }, 500);
  }, [map]);

  useEffect(() => {
    setTimeout(() => {
      if (isCloudLayerVisible) {
        deleteLayer(cloudLayer());
        writeLayer(cloudLayer());
      }
    }, 500);
  }, [apiDate, innerDate]);

  useEffect(() => {
    setMarkerSize((zoomLevel + 2) * (Math.E - 1));
    setZoomChange(true);
  }, [zoomLevel]);

  useEffect(() => {
    if (!map) return undefined; // ✅ explicitly return undefined

    const onZoom = () => setZoomLevel(map.getZoom());

    map.on("zoomend", onZoom);

    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (showChart && chartData.length > 0) {
      setTimeout(() => {
        setChartD(buildChart(chartData));
        setChartOptions(genChartOptions());
        setReady(true);
      }, 500);
    }
  }, [showChart]);

  function getMapDate(): string {
    const d = initDate ? new Date(initDate) : new Date(); // fallback to current date
    d.setUTCDate(d.getUTCDate() + innerDate);
    return `${d.getFullYear()}-${String(d.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

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

  function writeLayer(layer: L.LayerGroup): boolean {
    try {
      map?.addLayer(layer);
      return true;
    } catch (err) {
      console.error(`Error adding group; ${layer} with error ${err}`);
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

  function initUTCDate(inDate: Date | null = null): Date {
    let d: Date;
    if (!inDate) {
      d = new Date();
      nearestDate(d).catch(console.error);
    } else {
      d = new Date(inDate);
    }
    d.setUTCMinutes(0);
    return d;
  }

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
          label: setText(n1),
          data: [n1, null, null],
          borderColor: setColor(n1, "outter")?.toString() || "grey",
          backgroundColor: setColor(n1, "outter")?.toString() || "grey",
          datalabels: { color: setTextColor(n1) },
        },
        {
          label: setText(n2),
          data: [null, n2, null],
          borderColor: setColor(n2, "outter")?.toString() || "grey",
          backgroundColor: setColor(n2, "outter")?.toString() || "grey",
          datalabels: { color: setTextColor(n2) },
        },
        {
          label: setText(n3),
          data: [null, null, n3],
          borderColor: setColor(n3, "outter")?.toString() || "grey",
          backgroundColor: setColor(n3, "outter")?.toString() || "grey",
          datalabels: { color: setTextColor(n3) },
        },
      ],
    };
  }

  function genChartOptions(): object {
    return {
      responsive: true,
      plugins: {
        legend: { display: false },
        datalabels: {
          font: { size: scrnWidth > 575 ? "80%" : "50%" },
        },
      },
    };
  }

  function toggleCollapse(): void {
    setCollapsed(!collapsed);
  }

  return (
    <>
      {/* collapse toggle button */}
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

      {/* side panel card */}
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

          <div className={styles.buttonGroup}>
            {apiDate && (
              <>
                <DatePicker
                  maxDate={dayjs(initUTCDate())}
                  value={initDate ? dayjs(initDate) : null}
                  onChange={(date: Dayjs | null) => {
                    if (date) {
                      setApiDate(date.toISOString());
                      setInitDate(date.toDate());
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

        <SiteManager
          fromInit={innerDate}
          setSelectArr={setSelectArr}
          setFromInit={setInnerDate}
          apiDate={apiDate}
          // exInit={(d: Date) => setFromInit(d.getTime())}
          exInit={(d: Date) => setInitDate(d)}
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
          zoomChange={zoomChange}
          //setZoomChange={setZoomChange}
        />
      </Card>

      <Modal
        show={showChart}
        onHide={handleChartDone}
        className="modal-lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{clickedSite}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {ready && chartD && <Bar options={chartOptions} data={chartD} />}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default SidePanel;
