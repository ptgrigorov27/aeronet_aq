import { useState } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css';
import MapComponent from "./components/Map";
import { MapProvider } from "./components/MapContext";
import { SiteProvider } from "./components/SiteContext";
import SidePanel from "./components/SidePanel";
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import "./App.css";

function App() {
  const [exType, setExType] = useState<string>("PM") 
  return (
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <SiteProvider>
      <MapProvider>
        <div className="App" style={{ display: "flex" }}>
          <MapComponent center={[0,0]} zoom={3} type={exType} />
          <SidePanel setExType={ (t)=> setExType(t) } />
        </div>
      </MapProvider>
    </SiteProvider>
  </LocalizationProvider>
  )
}

export default App
