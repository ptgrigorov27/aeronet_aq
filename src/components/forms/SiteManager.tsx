import React, {
  useEffect,
  useState,
} from "react";
import { useMapContext } from "../MapContext";
import L from "leaflet";
import * as d3 from "d3";
import "leaflet-svg-shape-markers";
import API_BASE_URL from "../../config";
import axios from 'axios'
import styles from "./Map.module.css";

const SiteManager: React.FC<SiteManagerProps> = ({
  exInit,
  apiDate,
  type,
  setShowChart,
  setChartData,
  time,
  setClickedSite,
  zoom,
  setResponse,
  markerSize,
  refreshMarkers,
  children,
}) => {
  const { map } = useMapContext();
  const [readings, setReadings] = useState<Array<{ [key: string]: any }>>([]);
  const [coordArr, setCoordArr] = useState<Array<string>>([]);
  const [fromInit, setFromInit] = useState<number>(0) 
  const [initDate, setInitDate] = useState<string>(null) 
  useEffect(() => {
    if (zoom) {
      updateMarkerSize(markerSize);

    }
  }, [zoom, map]);

  useEffect(() => {
    if (refreshMarkers) {
      clearMarkers();
      fetchMarkers(type, time);
    }
  }, [refreshMarkers]);


  useEffect(()=>{
    clearMarkers();
    fetchMarkers(type, time);
    //console.log(type);
    
  },[readings, type, time])

  useEffect(() => {
      fetchReadings();
  }, [apiDate]);

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

  const clearMarkers = () => {
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
  };

  function csvToJSON(csv: string) {
    const lines = csv.split("\n");
    const result = [];
    const headers = lines[0].split(",");
    
    try{
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        if(lines[i] == undefined) {
          console.log(`${i} is undefined`)
          continue;
        }
        else if(lines[i].trim()==undefined || lines[i].trim() == "") {
            continue;
        }

        const words = lines[i].split(",");
        for(let j = 0; j < words.length; j++) {
            obj[headers[j].trim()] = words[j];
        }

        result.push(obj);
    }
    }catch(err)
    {
      console.log(err )
    }
  return result
}


  const setColor = (value: number) => {
    if (type.includes("PM")){    
      if(value <= 12){
          return d3.color("green")
        } else if (value <= 35){
          return d3.color("yellow")
        } else if (value <= 55){
          return d3.color("orange")
        } else if (value <= 150){
          return d3.color("red")
        } else if (value <= 250){
          return d3.color("purple")
        }else{
          return d3.color("maroon")
        }
   
    }else{
        if(value <= 50){
          return d3.color("green")
        } else if (value <= 100){
          return d3.color("yellow")
        } else if (value <= 150){
          return d3.color("orange")
        } else if (value <= 200){
          return d3.color("red")
        } else if (value <= 300){
          return d3.color("purple")
        }else{
          return d3.color("maroon")
        }
    }

  };


 const setTextColor = (value: number) => {
        
    if (type.includes("PM")){    
      if(value <= 12){
          return d3.color("white")
        } else if (value <= 35){
          return d3.color("black")
        } else if (value <= 55){
          return d3.color("black")
        } else if (value <= 150){
          return d3.color("white")
        } else if (value <= 250){
          return d3.color("white")
        }else{
          return d3.color("white")
        }
    }else{
        if(value <= 50){
          return d3.color("white")
        } else if (value <= 100){
          return d3.color("black")
        } else if (value <= 150){
          return d3.color("black")
        } else if (value <= 200){
          return d3.color("white")
        } else if (value <= 300){
          return d3.color("white")
        }else{
          return d3.color("white")
        }
    }
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

  const fetchReadings = async (sAPI = null, failed = 0) => {
    let d = null;
    setResponse("Fetch in progress...")
    if (sAPI && failed >= 3)
    {
      setResponse("No data found in range.")
      return 
    }
    else if(sAPI && failed < 3)
    {
         d = new Date(sAPI); 
        
        d.setUTCDate(d.getUTCDate() - 1)
        const [ year, month, date] = [d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()] 
        console.log(date, failed++);
        
        const response = await axios.get(`https://aeronet.gsfc.nasa.gov/cgi-bin/web_print_air_quality_index?year=${year}&month=${month}&day=${date}`);

        if(response.data.includes("Error")){
          console.error(`Error occurred on site -> ${response.data}`)
          setResponse(`Failed: No Data Found ${year}-${month}-${date}`)
          return fetchReadings(d, failed++);
        }else{
          setResponse("Loading Set...")
        }
         try{
          console.log(`https://aeronet.gsfc.nasa.gov/cgi-bin/web_print_air_quality_index?year=${year}&month=${month}&day=${date}` ) 
          const csvBase = document.createElement('html');
          csvBase.innerHTML = response.data;
          const locationData = csvBase.textContent.split("\n").slice(2).join("\n")
          const data = csvToJSON(locationData);
          

          const location_file = await fetch("/src/out.csv").then(response => response.text())
          //const location_file = await fetch("/new_web/aeronet_aq/out.csv").then(response => response.text())
          const data2 = csvToJSON(location_file);
          const coordResult = {};
          data2.forEach(obj => {
            const siteName = obj.sitename.toLowerCase();
            coordResult[siteName] = {
              Latitude: parseFloat(obj.Latitude),   
              Longitude: parseFloat(obj.Longitude) 
            };
          });


          const readingResult={};
          data.forEach(obj => {
            const siteName = obj.Site_Name.toLowerCase();
            if (!readingResult[siteName]) {
              readingResult[siteName] = [];
            }
            readingResult[siteName].push(obj);
          });

          setResponse(`Data successfully loaded.`)
          setCoordArr(coordResult);
          setReadings(readingResult)
          setFromInit(failed)
         } catch (e) {
          console.error(e)
          setResponse("Failed: Error occurred refer to console.")
        }
      


    }
    else if(apiDate)
    {
        
         d = new Date(apiDate);
        const [ year, month, date] = [d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate()] 
        
        //console.log(year, month, date)
        

        const response = await axios.get(`https://aeronet.gsfc.nasa.gov/cgi-bin/web_print_air_quality_index?year=${year}&month=${month}&day=${date}`);
        
        if(response.data.includes("Error")){
          console.error(`Error occurred on site -> ${response.data}`)
          setResponse(`Failed: No Data Found ${year}-${month}-${date}`)
          return fetchReadings(d, failed++);
        }
        else{
          setResponse("Loading Set...")
        }
        try{
          console.log(`https://aeronet.gsfc.nasa.gov/cgi-bin/web_print_air_quality_index?year=${year}&month=${month}&day=${date}` ) 
          const csvBase = document.createElement('html');
          csvBase.innerHTML = response.data;
          const locationData = csvBase.textContent.split("\n").slice(2).join("\n")
          const data = csvToJSON(locationData);
          

          //const location_file = await fetch("/src/out.csv").then(response => response.text())
          const location_file = await fetch("/new_web/aeronet_aq/out.csv").then(response => response.text())
          const data2 = csvToJSON(location_file);
          const coordResult = {};
          data2.forEach(obj => {
            const siteName = obj.sitename.toLowerCase();
            coordResult[siteName] = {
              Latitude: parseFloat(obj.Latitude),   
              Longitude: parseFloat(obj.Longitude) 
            };
          });


          const readingResult={};
          data.forEach(obj => {
            const siteName = obj.Site_Name.toLowerCase();
            if (!readingResult[siteName]) {
              readingResult[siteName] = [];
            }
            readingResult[siteName].push(obj);
          });

          setResponse(`Data successfully loaded.`)
          setCoordArr(coordResult);
          setReadings(readingResult)
          setFromInit(failed)

        } catch (e) {
          console.error(e)
          setResponse("Failed: Error occurred refer to console.")
        }

    }
    setInitDate(d)
    exInit(d)

  }
 function formatDateAndParse(num, markerReference) {
  if(!num)
  {
    num = "(130)" 
  }
  const dateStr = markerReference["UTC_DATE"]; 
  const [year, month, day] = dateStr.split('-');    
  const date = new Date(year, month - 1, day); 
  const dayOptions = { weekday: 'short' };
  const monthOptions = { month: 'short' };
  const dateOptions = { day: 'numeric' };
  const yearOptions = { year: 'numeric' };

  const formattedDay = date.toLocaleDateString('en-US', dayOptions);
  const formattedMonth = date.toLocaleDateString('en-US', monthOptions);
  const formattedDate = date.toLocaleDateString('en-US', dateOptions);
  const formattedYear = date.toLocaleDateString('en-US', yearOptions);

  const formattedDateStr = `${formattedDay} ${formattedMonth} ${formattedDate} ${formattedYear}`;

  const numString = num.replace(/[()]/g, '').toString().padStart(4, '0'); 
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
        //d.setUTCMinutes(30);
        d.setUTCSeconds(0);
        // Loop through each hour from 1 to 22
        chartData[day][d.toISOString()]=reading[day]["DAILY_AQI"]
//        for (let hour = 1; hour <= 22; hour += 3) {
//            d.setUTCHours(hour);
//
//            const rKeyPM = 
//Object.keys(reading[day]).find(x => x.includes("PM") && 
//x.includes(`(${hour}30)`));
//            const rKeyAQI = 
//Object.keys(reading[day]).find(x => x.includes("AQI") && 
//x.includes(`(${hour}30)`));
//            const rKeyDAQI = 
//Object.keys(reading[day]).find(x => x.includes("DAILY_AQI") 
//);
//
//            chartData[0][d.toISOString()] = 
//reading[day][rKeyPM];
//            chartData[1][d.toISOString()] = 
//reading[day][rKeyAQI];
//            chartData[2][d.toISOString()] = 
//reading[day][rKeyDAQI];
//
//        }
//
        d.setUTCDate(d.getUTCDate() + 1);  

    }
    //console.log(chartData)
    return chartData;
};

  const fetchMarkers = (type: string, time: string) => {
    let rKey;
    if(readings){
      for ( const site in coordArr)
      {
        if(Object.keys(readings).includes(site)){
          if(type !== "DAILY_AQI")
            {
              rKey = Object.keys(readings[site][fromInit]).find(x => (x.includes(`${type}`) && x.includes(`${time}`)));
            }else{
              rKey = Object.keys(readings[site][fromInit]).find(x => (x.includes(`${type}`)));
            }
          const value = type.includes("AQI") ? parseInt(readings[site][fromInit][rKey]) : parseFloat( readings[site][fromInit][rKey])
          const markerColor = setColor(parseFloat(readings[site][fromInit][rKey]));
          const markerReference = readings[site][fromInit];
          const markerType = { PM:"PM 2.5", DAILY_AQI:"DAILY AQI", AQI: "AQI" }
          const siteName:string = site.replace("__","_").split("_").map( words =>{ return words.charAt(0).toUpperCase()+words.slice(1)}).join(" ");
          const pmKey = Object.keys(readings[site][fromInit]).find(x => (x.includes(`PM`)));
          const pm = readings[site][fromInit][pmKey]
          const marker = L.circleMarker([coordArr[site].Latitude, coordArr[site].Longitude], {
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
          }).addTo(map);
          
          const customOpts = {
            className:'custom-popup',
            closeButton: false
          }

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
</div>`, customOpts)
              .openPopup();
          });
          
          marker.on("click", () => {
            setClickedSite(`${siteName} | 3-Day Forecast`) 
            const chartData = createChartData(readings[site]) 
            setChartData(chartData);
            setTimeout(() => {
              setShowChart(true);
            }, 500);
          });
        }
      } 
    }
  }
};
export default SiteManager;
 
