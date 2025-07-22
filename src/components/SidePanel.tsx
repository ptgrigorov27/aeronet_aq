import React, { useState, useEffect, useCallback, useContext } from "react";
import { Card, Button, Modal } from "react-bootstrap";
import { useMapContext } from "./MapContext";
import SiteManager from "./forms/SiteManager";
import styles from "./SidePanel.module.css";
import L from "leaflet";
import axios from "axios";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import Box from "@mui/material/Box";
import dayjs from "dayjs";
import { setTextColor, setText, setColor } from "./Utils.tsx";
import { API_ARNT, API_AQ, API_DEF } from "./../config";
import * as d3 from "d3";
import Chip from "@mui/material/Chip";
import {
  OutlinedInput,
  InputLabel,
  Stack,
  MenuItem,
  Select,
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);
import ChartDataLabels from "chartjs-plugin-datalabels";
ChartJS.register(ChartDataLabels);

const SidePanel: React.FC = (setExType) => {
  const { map } = useMapContext();
  const [isCloudLayerVisible, setIsCloudLayerVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(map?.getZoom() || 2);
  const [markerSize, setMarkerSize] = useState<number>(
    (zoomLevel + 2) * (Math.E - 1),
  );
  const [innerDate, setInnerDate] = useState<number>(0);
  const [apiDate, setApiDate] = useState<string>("");
  const [refreshMarkers, setRefreshMarkers] = useState<boolean>(false);
  const [typeChanged] = useState<boolean>(false);
  const [type, setType] = useState<string>("");
  const [zoom] = useState<number>(3);
  const [response, setResponse] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [clickedSite, setClickedSite] = useState<string>("");
  const [chartData, setChartData] = useState([]);
  const [showChart, setShowChart] = useState<boolean>(false);
  const [chartD, setChartD] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const [ready, setReady] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fromInit, setFromInit] = useState<number>(0);
  const [selectArr, setSelectArr] = useState<string[]>(["", "", ""]);
  const [zoomChange, setZoomChange] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string[]>([
    "DoS Missions",
  ]);
  const timeArr = [130, 430, 730, 1030, 1330, 1630, 1930, 2230];
  const [enabledMarkers, setEnabledMarkers] = useState({
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
    const handleResize = () => {
      setScrnWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    Object.keys(enabledMarkers).forEach((group: string) => {
      enabledMarkers[group] = selectedGroup.includes(group);
    });

    setRefreshMarkers(true);
  }, [selectedGroup]);

  // On site load
  useEffect(() => {
    setTimeout(() => {
      setApiDate(String(new Date()));
      setType("AQI");
      nearestTime(String(new Date()));
    }, 500);
  }, [map]);

  //NOTE: This updates the map on these values change
  useEffect(() => {
    setTimeout(() => {
      const res = isCloudLayerVisible
        ? deleteLayer(cloudLayer()) && writeLayer(cloudLayer())
        : console.log();
    }, 500);
  }, [apiDate, innerDate]);

  useEffect(() => {
    setMarkerSize((zoomLevel + 2) * (Math.E - 1));
    setZoomChange(true);
  }, [zoomLevel]);

  useEffect(() => {}, [fromInit]);

  useEffect(() => {
    if (map) {
      const onZoom = () => {
        setZoomLevel(map.getZoom());
      };
      map.on("zoomend", onZoom);
      return () => {
        map.off("zoomend", onZoom);
      };
    }
  }, [map, zoomLevel]);

  useEffect(() => {
    if (showChart && chartData) {
      setTimeout(() => {
        setChartD(buildChart(chartData));
        setChartOptions(genChartOptions(clickedSite));
        setReady(true);
      }, 500);
    }
  }, [showChart]);
  function getMapDate(): string {
    const d = new Date(fromInit);
    d.setUTCDate(d.getUTCDate() + innerDate);
    return `${d.getFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function baseLayer(): L.layerGroup {
    const basemapLayer = L.tileLayer.wms(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
      {
        layers: "BlueMarble_NextGeneration",
        format: "image/png",
        crs: L.CRS.EPSG4326,
        opacity: 1.0,
        noWrap: true,
        tileSize: 256,
        errorTileUrl: "",
        maxZoom: 20,
        // attribution: "© OpenStreetMap",
      },
    );

    const labelsLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      {
        noWrap: true,
        minZoom: 3,
        maxZoom: 19,
        subdomains: "abcd",
      },
    );

    return L.layerGroup([basemapLayer, labelsLayer]);
  }

  function cloudLayer(): L.layerGroup {
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
    });

    const labelsLayer = L.tileLayer(nonbaseMaps[1], {
      zIndex: 1000,
      noWrap: true,
      tileSize: 256,
      errorTileUrl: "",
    });

    return L.layerGroup([wmsLayer, labelsLayer]);
  }

  async function nearestDate(
    initDate: Date,
    api_selected = API_DEF,
  ): Promise<Date> {
    const d = new Date(initDate);
    const [year, month, date] = [
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
    ];
    const response = await axios.get(
      `${api_selected}year=${year}&month=${month}&day=${date}`,
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

  function writeLayer(layer: L.layerGroup): boolean {
    try {
      map?.addLayer(layer);
      return true;
    } catch (err) {
      console.error(`Error deleting group; ${layer} with error ${err}`);
      return false;
    }
  }

  function deleteLayer(layers: L.layerGroup): boolean {
    try {
      map?.eachLayer((layer: L.Layer) => {
        if (layer._url === nonbaseMaps[0] || layer._url === nonbaseMaps[1]) {
          map.removeLayer(layer);
        }
      });
      return true;
    } catch (err) {
      console.error(`Error deleting group; ${layers} with error ${err}`);
      return false;
    }
  }

  function toggleCloudLayer(): boolean {
    setIsCloudLayerVisible((prevState) => !prevState);
    return isCloudLayerVisible
      ? deleteLayer(cloudLayer())
      : writeLayer(cloudLayer());
  }

  function initUTCDate(inDate = null): Date {
    let d: Date;
    if (inDate === null) {
      d = new Date();
      nearestDate(d)
        .then((res) => {
          console.log("nearestDate resolved to:", res);
          d = new Date(res);
        })
        .catch((error) => {
          console.error("nearestDate error:", error);
        });
    } else {
      d = new Date(inDate);
    }
    d.setUTCMinutes(0);
    console.log("initUTCDate returning:", d.toISOString());
    return d;
  }

  function updateMap(): void {
    setRefreshMarkers(true);
    setTimeout(() => {
      setRefreshMarkers(false);
    }, 100);
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

  function handleTypeSelect(event: React.ChangeEvent<HTMLSelectElement>): void {
    setType(event.target.value);
    // external type to be passed
    setExType(event.target.value);
  }

  function genLabels(readings: string[]): string[] {
    const labels: string[] = [];
    for (const date in readings) {
      const d = new Date(Object.keys(readings[date])[0]);
      const formattedDate = d.toLocaleString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        //minute: '2-digit',
        timeZone: "UTC",
        hour12: false,
      });
      labels.push(formattedDate);
    }
    return labels;
  }

  function buildChart(cData: string[]): ChartData<"bar"> {
    const labels = genLabels(cData);
    const [ds1] = cData[0] ? Array.from(Object.values(cData[0])) : [];
    const [ds2] = cData[1] ? Array.from(Object.values(cData[1])) : [];
    const [ds3] = cData[2] ? Array.from(Object.values(cData[2])) : [];

    if (ds1.length === 0 || ds2.length === 0 || ds3.length === 0) {
      console.error("Error within datadset.");
      return {};
    }

    return {
      labels: labels,
      datasets: [
        {
          label: `${setText(ds1)}`,
          data: [ds1, null, null],
          skipNull: true,
          borderColor: setColor(ds1, "outter"),
          backgroundColor: setColor(ds1, "outter"),
          datalabels: {
            color: setTextColor(ds1),
          },
        },
        {
          label: `${setText(ds2)}`,
          data: [null, ds2, null],
          skipNull: true,
          borderColor: setColor(ds2, "outter"),
          backgroundColor: setColor(ds2, "outter"),
          datalabels: {
            color: setTextColor(ds2),
          },
        },
        {
          label: `${setText(ds3)}`,
          data: [null, null, ds3],
          skipNull: true,
          borderColor: setColor(ds3, "outter"),
          backgroundColor: setColor(ds3, "outter"),
          datalabels: {
            color: setTextColor(ds3),
          },
        },
      ],
    };
  }

  function setMaxDate(date: string): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate());
    return d;
  }

  function genChartOptions(name: string): object {
    return {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
          font: {
            size: scrnWidth > 575 ? "80%" : "50%",
          },
        },
        title: {
          display: false,
        },
      },
    };
  }
  function toggleCollapse(): void {
    setCollapsed(!collapsed);
  }

  return (
    <>
      <h5
        style={{
          zIndex: 1001,
          top: "15rem",
          right: collapsed ? "0rem" : "19.4rem",
          transformOrigin: "right top",
          // transform: "scale(1, 3)",
          whiteSpace: "nowrap",
          margin: "0",
          padding: "5px",
          borderRadius: "5px 0px 0px 5px",
          position: "fixed",
          height: "auto",
          color: "black",
          backgroundColor: collapsed ? "#198754" : "#d32f2f",
          textDecoration: "none",
        }}
      >
        <button
          style={{
            color: "inherit",
            padding: 0,
            textDecoration: "none",
          }}
          className="btn btn-link"
          onClick={toggleCollapse}
          aria-expanded={!collapsed}
          aria-controls="collapseMod"
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
              onClick={() => (map ? map.setView([0, 0], 3) : null)}
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
                  maxDate={dayjs(setMaxDate(initUTCDate()))}
                  value={dayjs(fromInit)}
                  onChange={(date) => {
                    setApiDate(date.$d);
                  }}
                  showTimeSelect
                  label="Model Initialization"
                />

                <Box className="mt-2" sx={{ minWidth: 120 }}>
                  <FormControl fullWidth>
                    <InputLabel id="">Forecast Date</InputLabel>
                    <Select
                      label="Forecast Date"
                      value={innerDate}
                      onChange={(event) => {
                        setInnerDate(Number(event.target.value));
                      }}
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
                  <>
                    <Box className="mt-2" sx={{ minWidth: 120 }}>
                      <FormControl fullWidth>
                        <InputLabel>Time</InputLabel>
                        <Select
                          label="Time"
                          value={time}
                          onChange={(event) => {
                            handleTimeSelect(event.target.value);
                          }}
                        >
                          {selectTimeArr.map((val, index) => (
                            <MenuItem key={index} value={`(${timeArr[index]})`}>
                              {val}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </>
                )}
              </>
            )}
            <FormControl fullWidth>
              <InputLabel>Enabled Forecast</InputLabel>
              <Select
                multiple
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                input={<OutlinedInput label="Enabled Forecast" />}
                renderValue={(selected) => (
                  <Stack gap={0.5} direction="row" flexWrap="wrap">
                    {selected.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Stack>
                )}
              >
                {chipNames.map((name: string) => (
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
          exInit={setFromInit}
          setChartData={setChartData}
          setClickedSite={setClickedSite}
          setShowChart={setShowChart}
          setResponse={setResponse}
          type={type}
          time={time}
          typeChanged={typeChanged}
          enabledMarkers={enabledMarkers}
          zoom={zoom}
          markerSize={markerSize}
          refreshMarkers={refreshMarkers}
          setRefreshMarkers={setRefreshMarkers}
          zoomChange={zoomChange}
          setZoomChange={setZoomChange}
        />
      </Card>
      <Modal
        show={showChart}
        onHide={() => handleChartDone()}
        className={"modal-lg"}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{clickedSite}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {ready && (
            //<Line option={chartOptions} data={chartD} />
            <Bar options={chartOptions} data={chartD} />
          )}
        </Modal.Body>
        <Modal.Footer></Modal.Footer>
      </Modal>
    </>
  );
};

export default SidePanel;
