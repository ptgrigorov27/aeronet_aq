import React, { useState, useEffect } from "react";
import { Card, Button, Modal } from "react-bootstrap";
import { useMapContext } from "./MapContext";
import SiteManager from "./forms/SiteManager";
import styles from "./SidePanel.module.css";
import L from "leaflet";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import * as d3 from "d3";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);
//import {
//  Chart as ChartJS,
//  CategoryScale,
//  LinearScale,
//  PointElement,
//  LineElement,
//  Title,
//  Tooltip,
//  Legend,
//} from 'chart.js';
//import { Line } from 'react-chartjs-2';
//
//ChartJS.register(
//  CategoryScale,
//  LinearScale,
//  PointElement,
//  LineElement,
//  Title,
//  Tooltip,
//  Legend
//);

const SidePanel: React.FC = ( { setExType }   ) => {
  const { map } = useMapContext();
  const [isCloudLayerVisible, setIsCloudLayerVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(map?.getZoom() || 2);
  const [markerSize, setMarkerSize] = useState<number>((zoomLevel + 2) * (Math.E - 1));
  const [apiDate, setApiDate] = useState<string>("");
  const [refreshMarkers, setRefreshMarkers] = useState<boolean>(false);
  const [typeChanged] = useState<boolean>(false);
  const [type, setType] = useState<string>("")
  const [zoom] = useState<number>(3)
  const [response, setResponse] = useState<string>("")
  const [time,setTime] = useState<string>("")
  const [clickedSite, setClickedSite] = useState<string>("")
  const [chartData, setChartData] = useState([])
  const [showChart, setShowChart] = useState<boolean>(false)
  const [chartD, setChartD] = useState({})
  const [chartOptions, setChartOptions] = useState({})
const [cloudMapLayerMem, setCloudMapLayer] = useState(null);  
  const [ready, setReady] = useState<boolean>(false)
  //const maxDate = useState<string>(initUTCDate())

  // On site load
  useEffect( () => {
    setTimeout(() => {
      setApiDate(initUTCDate());
      setType("AQI")
    }, 500);
  }, []);

  //NOTE: This updates the map on these values change
  useEffect(() => {
    setTimeout(() => {
    if(isCloudLayerVisible)
    {
    map.removeLayer(cloudMapLayerMem);
    const newCloudLayer = cloudLayer();  
    setCloudMapLayer(newCloudLayer);  
    map.addLayer(newCloudLayer);  
    }
    }, 500);
  }, [apiDate]);

  useEffect(() => {
    setMarkerSize((zoomLevel + 2) * (Math.E - 1));
    updateMap();
  }, [zoomLevel]);

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
    if(showChart && chartData)
      {
        setTimeout(() => {
          
    setChartD(buildChart(chartData));
    setChartOptions(genChartOptions(clickedSite));
        
        setReady(true);
        }, 500);

      }   
  }, [showChart])
  
  const getMapDate = () => {
    const d = new Date(apiDate)
    return  `${d.getFullYear()}-${String(d.getUTCMonth()).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` 
  }


const cloudLayer = () => {
  const wmsLayer = L.tileLayer.wms("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", {
    layers: ["VIIRS_NOAA20_CorrectedReflectance_TrueColor"],
    format: 'image/png',
    crs: L.CRS.EPSG4326,
    opacity: 1.0,
    time: getMapDate(),
    tileSize: 256,
    transparent: true,
    attribution: "",
    noWrap: true,
    errorTileTimeout: 5000,
  });

  const labelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    zIndex: 1000,
    noWrap: true,
    tileSize: 256,
    errorTileUrl: '',
    errorTileTimeout: 5000,
  });

  return L.layerGroup([wmsLayer, labelsLayer]);
};


const toggleCloudLayer = () => {
  if (cloudMapLayerMem) {
    map.removeLayer(cloudMapLayerMem);
    setCloudMapLayer(null);  
  } else {
    const newCloudLayer = cloudLayer();  
    setCloudMapLayer(newCloudLayer);  
    map.addLayer(newCloudLayer);  
  }

  setIsCloudLayerVisible(prevState => !prevState);
};

  
function initUTCDate(inDate = null) {
  let d;

  if (inDate === null) {
    d = new Date(); 
    const curT = d.getUTCHours();  
    //  given jun's api updates at 12 est.
    if (curT < 16) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
  } else {
    d = new Date(inDate);
  }
  d.setUTCMinutes(0);

  return d;
}
 
  const updateMap = () => {
    setRefreshMarkers(true);
    setTimeout(() => {
      setRefreshMarkers(false);
    }, 100);
  };
  
  const handleZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const zoom = parseInt(event.target.value, 10);
    if (map) {
      map.setZoom(zoom);
      setZoomLevel(zoom);
    }
  };
  
  const handleChartDone = () =>{
    setReady(false)
    setShowChart(false)
  }

  const handleTimeSelect = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    //console.log(event.target.value)
    setTime(event.target.value);
  };
  const handleTypeSelect = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    //console.log(event.target.value)
    setType(event.target.value);
    setExType(event.target.value);
  };

   const genLabels = (readings) => {
    const labels = [];

    ////for (const rDate of Object.keys(readings[0])) { // uncomment if reverting back to line graph with all values [3 d] array 
    for (const date in readings) {
       const d = new Date(Object.keys(readings[date])[0]);
    

        const formattedDate = d.toLocaleString('en-US', { 
        weekday:'short',
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        //minute: '2-digit', 
        timeZone: 'UTC', 
        hour12: false
        });
      labels.push(formattedDate)
    }
   return labels 
}
  const setColor = (value: number, where: string) => {
    
    let c = d3.color("grey")
    if(where === "outter"){
    if (type.includes("PM")){    
      if(value <= 12){
          c = d3.color("green")
        } else if (value <= 35){
          c =  d3.color("yellow")
        } else if (value <= 55){
          c =  d3.color("orange")
        }  if (value <= 150){
           c =  d3.color("red")
        } else if (value <= 250){
           c =  d3.color("purple")
        }else{
           c =  d3.color("maroon")
        }
   
    }else{
        if(value <= 50){
           c =  d3.color("green")
        } else if (value <= 100){
           c =  d3.color("yellow")
        } else if (value <= 150){
           c =  d3.color("orange")
        } else if (value <= 200){
          c =   d3.color("red")
        } else if (value <= 300){
          c =   d3.color("purple")
        }else{
          c =   d3.color("maroon")
        }
    }
    }
    else if(where === "inner"){
    if (type.includes("PM")){    
      if(value <= 12){
          c =   d3.color("green")
        } else if (value <= 35){
          c =   d3.color("yellow")
        } else if (value <= 55){
          c =   d3.color("orange")
        } else if (value <= 150){
          c =   d3.color("red")
        } else if (value <= 250){
          c =   d3.color("purple")
        }else{
          c =   d3.color("maroon")
        }
   
    }else{
        if(value <= 50){
          c =   d3.color("green")
          c.opacity = 0.5;
        } else if (value <= 100){
          c =   d3.color("yellow") 
          c.opacity = 0.5;
        } else if (value <= 150){
          c =   d3.color("orange") 
          c.opacity = 0.5;
        } else if (value <= 200){
          c =   d3.color("red")
          c.opacity = 0.5;
        } else if (value <= 300){
          c =   d3.color("purple")
          c.opacity = 0.5;
        }else{
          c =   d3.color("maroon")
          c.opacity = 0.5;
        }
    }
    }

    return c;

  };


   const setText = (value: number) => {
        
    if (type.includes("PM")){    
     if(value <= 12){
          return "Good" 
        } else if (value <= 35){
          return "Moderate"
        } else if (value <= 55){
          return "Unhealthy for sensitive groups"
        } else if (value <= 150){
          return "Unhealthy"
        } else if (value <= 250){
          return "Very unhealthy"
        }else{
          return "Hazardous"
        }
      }else{
if(value <= 50){
          return "Good" 
        } else if (value <= 100){
          return "Moderate"
        } else if (value <= 150){
          return "Unhealthy for sensitive groups"
        } else if (value <= 200){
          return "Unhealthy"
        } else if (value <= 300 ){
          return "Very unhealthy"
        }else{
          return "Hazardous"
        }
      }
  };
const buildChart = (cData) => {
    
    //const labels = genLabels(cData);

    //const pm25Data = cData[0] ? Array.from(Object.values(cData[0])) : [];
    //const aqiData = cData[1] ? Array.from(Object.values(cData[1])) : [];
    //const dailyAqiData = cData[2] ? Array.from(Object.values(cData[2])) : [];
    //
    //if (pm25Data.length === 0 || aqiData.length === 0 || dailyAqiData.length === 0) {
    //    console.error('Error within datadset.');
    //    return {};  
    //}
    //
    //return {
    //    labels: labels,
    //    datasets: [
    //        //{
    //        //    label: "PM 2.5",
    //        //    data: pm25Data ,
    //        //    borderColor: 'setColor',
    //        //    backgroundColor: 'rgba(255, 99, 132, 0.5)'
    //        //},
    //        {
    //            label: "AQI",
    //            data: aqiData ,
    //            borderColor: 'rgb(75, 192, 192)',
    //            backgroundColor: 'rgba(75, 192, 192, 0.5)'
    //        },
    //        {
    //            label: "DAILY AQI",
    //            data: dailyAqiData,
    //            borderColor: 'rgb(53, 162, 235)',
    //            backgroundColor: 'rgba(53, 162, 235, 0.5)'
    //        }
    //    ]
    //};
    //
    //const labels = [genLabels(cData[0]), genLabels(cData[1]), genLabels(cData[2])]
    const labels = genLabels(cData)
    const [d1] = cData[0] ? Array.from(Object.values(cData[0])) : [];
    const [d2] = cData[1] ? Array.from(Object.values(cData[1])) : [];
    const [d3] = cData[2] ? Array.from(Object.values(cData[2])) : [];
    
    if (d1.length === 0 || d2.length === 0 || d3.length === 0) {
        console.error('Error within datadset.');
        return {};  
    }

    return {
        labels: labels,
        datasets: [
            {
                label: `${setText(d1)} (${d1})`,
                data: [d1,null,null] ,
                skipNull: true,
                borderColor: setColor(d1, "outter"),
                backgroundColor: setColor(d1, "inner") 
            },
            {
                label: `${setText(d2)} (${d2})`,
                data: [null,d2,null],
                skipNull: true,
                borderColor: setColor(d2, "outter"),
                backgroundColor: setColor(d2, "inner") 
            },
            {
                label: `${setText(d3)} (${d3})`,
                data: [null,null,d3] ,
                skipNull: true, 
                borderColor: setColor(d3, "outter"),
                backgroundColor: setColor(d3, "inner") 
            }
        ]
    };
};

const genChartOptions =(name)=>{
  return {

  responsive: true,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: name ? name : "",
    },
  },
  }
};

  return (
    <>
      <Card className={styles.sidePanel}>
        <Card.Body>
          <Card.Title style={{ textAlign: 'center'}}>Air Quality Forecast</Card.Title>
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
            <Button
              //variant="normal"
              onClick={toggleCloudLayer}
              >
              {isCloudLayerVisible ? 'Disable Cloud Layer ' : 'Enable Cloud Layer'}
            </Button>
          </div>

          <hr className={styles.separator} />
          <Card.Title></Card.Title>
          <div className={styles.buttonGroup}>
            {
               apiDate && (
                <>
                  <DatePicker
                    maxDate={dayjs(initUTCDate())}
                    value={dayjs(apiDate)}
                    onChange={(date) => { setApiDate(date.$d) }}
                    showTimeSelect
                  />
                  {
                  type !== "DAILY_AQI" &&
                  <>
                    <p style={{ textAlign: 'center', marginBottom:'-5px'}}>3-Hour Average</p>
                    <select
                      className="form-select form-select"
                      onChange={(event) => { handleTimeSelect(event) }}
                    >
                      <option selected value="(130)">1:30 UTC</option>
                      <option value="(430)">4:30 UTC</option>
                      <option value="(730)">7:30 UTC</option>
                      <option value="(1030)">10:30 UTC</option>
                      <option value="(1330)">13:30 UTC</option>
                      <option value="(1630)">16:30 UTC</option>
                      <option value="(1930)">19:30 UTC</option>
                      <option value="(2230)">22:30 UTC</option>
                    </select>
                  </>
                  }
                </>
              )
            }


          <select class="form-select form-select" label="time" onChange={(event) => {handleTypeSelect(event)}}>
          {/* <option  value="PM">PM 2.5</option> */} 
            <option value="AQI">Air Quality Index</option>
           {/* <option value="DAILY_AQI">DAILY AQI</option> */}  
          </select>


          {
            response != "" &&
              <p style={{ textAlign: 'center', marginBottom:'-5px'}}>{response}</p>
          }
        </div>
        </Card.Body>
      <SiteManager apiDate={apiDate} setChartData={setChartData} setClickedSite={setClickedSite} setShowChart={setShowChart} setResponse={setResponse} type={type} time={time} typeChanged={typeChanged}  zoom={zoom} markerSize={markerSize} refreshMarkers={refreshMarkers}/> 
      </Card>
      <Modal show={showChart} onHide={() => handleChartDone()} className={"modal-lg"} centered>
        <Modal.Header closeButton>
          <Modal.Title>{clickedSite}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
        {
          ready &&
          //<Line option={chartOptions} data={chartD} />
          <Bar option={chartOptions} data={chartD} />
        } 
        </Modal.Body>
        <Modal.Footer>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SidePanel;

