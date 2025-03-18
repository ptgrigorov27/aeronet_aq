import React, { useState, useEffect } from "react";
import { Card, Button, Modal } from "react-bootstrap";
import { useMapContext } from "./MapContext";
import SiteManager from "./forms/SiteManager";
import styles from "./SidePanel.module.css";
import L from "leaflet";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
//import { Bar } from 'react-chartjs-2';
//import {
//  Chart as ChartJS,
//  CategoryScale,
//  LinearScale,
//  BarElement,
//  Title,
//  Tooltip,
//  Legend,
//} from 'chart.js';
//
//ChartJS.register(
//  CategoryScale,
//  LinearScale,
//  Title,
//  Tooltip,
//  Legend
//);
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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
  const [ready, setReady] = useState<boolean>(false)
  // On site load
  useEffect( () => {
    setTimeout(() => {
      setApiDate(initUTCDate(new Date()));
      setType("AQI")
    }, 500);
  }, []);

  //NOTE: This updates the map on these values change
  useEffect(() => {
    setTimeout(() => {
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
  

  const cloudLayer = L.tileLayer('https://{s}.tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
    maxZoom: 19,
  });

  const toggleCloudLayer = () => {
    if (isCloudLayerVisible) {
      cloudLayer.remove();
    } else {
      cloudLayer.addTo(map);
    }
    setIsCloudLayerVisible(!isCloudLayerVisible);
  };

  
  function initUTCDate(inDate = null){
  let d;

  if(inDate === null)
    {
      d = new Date();
    }else{
      d = new Date(inDate);
    }
  return d.setUTCDate(d.getUTCDate())

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
    console.log(event.target.value)
    setTime(event.target.value);
  };
  const handleTypeSelect = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    console.log(event.target.value)
    setType(event.target.value);
    setExType(event.target.value);
  };

   const genLabels = (readings) => {
    const labels = [];
    for (const rDate of Object.keys(readings[0])) { 
        const d = new Date(rDate);
        const formattedDate = d.toLocaleString('en-US', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: 'UTC', 
        hour12: false
    });
        labels.push(formattedDate)
    }
   return labels 
}

const buildChart = (cData) => {
    const labels = genLabels(cData);
    const pm25Data = cData[0] ? Array.from(Object.values(cData[0])) : [];
    const aqiData = cData[1] ? Array.from(Object.values(cData[1])) : [];
    const dailyAqiData = cData[2] ? Array.from(Object.values(cData[2])) : [];

    if (pm25Data.length === 0 || aqiData.length === 0 || dailyAqiData.length === 0) {
        console.error('Error within datadset.');
        return {};  
    }

    return {
        labels: labels,
        datasets: [
            //{
            //    label: "PM 2.5",
            //    data: pm25Data ,
            //    borderColor: 'setColor',
            //    backgroundColor: 'rgba(255, 99, 132, 0.5)'
            //},
            {
                label: "AQI",
                data: aqiData ,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)'
            },
            //{
            //    label: "DAILY AQI",
            //    data: dailyAqiData,
            //    borderColor: 'rgb(53, 162, 235)',
            //    backgroundColor: 'rgba(53, 162, 235, 0.5)'
            //}
        ]
    };


    //const d1 = cData[0] ? Array.from(Object.values(cData[0])) : [];
    //const d2 = cData[1] ? Array.from(Object.values(cData[1])) : [];
    //const d3 = cData[2] ? Array.from(Object.values(cData[2])) : [];
    //
    //if (d1.length === 0 || d2.length === 0 || d3.length === 0) {
    //    console.error('Error within datadset.');
    //    return {};  
    //}
    //
    //return {
    //    labels: labels,
    //    datasets: [
    //        {
    //            label: "PM 2.5",
    //            data: d1 ,
    //            borderColor: 'setColor',
    //            backgroundColor: 'rgba(255, 99, 132, 0.5)'
    //        },
    //        {
    //            label: "AQI",
    //            data: d2 ,
    //            borderColor: 'rgb(75, 192, 192)',
    //            backgroundColor: 'rgba(75, 192, 192, 0.5)'
    //        },
    //        {
    //            label: "PM 2.5",
    //            data: d3,
    //            borderColor: 'rgb(75, 192, 192)',
    //            //borderColor: setColor(d1[0]),
    //            backgroundColor: 'rgba(53, 162, 235, 0.5)'
    //        }
    //    ]
    //};
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
              disabled
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
                    maxDate={dayjs(new Date())}
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
          //<Bar option={chartOptions} data={chartD} />
          <Line option={chartOptions} data={chartD} />
        } 
        </Modal.Body>
        <Modal.Footer>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SidePanel;

