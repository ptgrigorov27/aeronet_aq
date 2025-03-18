import React from "react";
import { MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Container } from "react-bootstrap";
import styles from "./Map.module.css";
import { useMapContext } from "./MapContext";
//import * as d3 from "d3";
import ColorLegend from './colorScale';
import CustomControls from "./CustomControls";

interface MapComponentProps {
  center: [number, number];
  zoom: number;
}


const CustomMapLayer: React.FC = () => {
  const map = useMap();
  const { setMap } = useMapContext();

  React.useEffect(() => {
    if (!map) return;

    // Function to remove all controls from the map
    const removeAllControls = () => {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.Control) {
          map.removeControl(layer);
        }
      });
    };

    const basemapUrl =
      //"https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png";
    const basemapLayer = L.tileLayer.wms(basemapUrl, {
      layers: "BlueMarble_NextGeneration",
      format: "image/png",
      crs: L.CRS.EPSG4326,
      opacity: 1.0,
      backgroundColor: "transparent",
      noWrap: true,
      tileSize: 256,
      errorTileUrl: "",
      errorTileTimeout: 5000,
      maxZoom: 20,
      // attribution: "© OpenStreetMap",
    });

    const references = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      {
        noWrap: true,
        minZoom: 3,
        maxZoom: 19,
        subdomains: "abcd",
      },
    );


    const wmsLayer = L.tileLayer.wms("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi", {
            layers:["VIIRS_NOAA20_CorrectedReflectance_TrueColor","Coastlines"],
            format: 'image/png',
            crs: L.CRS.EPSG4326,
            opacity: 1.0,
            tileSize: 256,
            transparent: true,
            attribution: "",
            noWrap:false,
            errorTileTimeout: 5000,
    });
    
    const reg = L.layerGroup([basemapLayer, references]);
    const gibs = L.layerGroup([wmsLayer, references]);
    var baseMaps = {    
      "Open Street Map": reg,
      "SNPP VIIRS True Color Image" : gibs,
    };
    
    //L.control.layers(baseMaps).addTo(map)


    map.addLayer(reg);
    //map.addLayer(references);
    //createColorLegend().addTo(map);

    map.options.preferCanvas = true;
    map.setMinZoom(3);
    map.setMaxZoom(19);
    map.setMaxBounds([
      [-90, -180], 
      [90, 180]    
    ]);
    map.setMaxBounds(map.getBounds().pad(Math.sqrt(2)/2))

    setMap(map);

    return () => {
      map.removeLayer(basemapLayer);
       map.removeLayer(references);
      removeAllControls();
    };
  }, [map, setMap]);

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ center, zoom, type }) => {
  return (
    <Container fluid style={{ padding: "0" }} className={styles.mapContainer}>
      <MapContainer
        // @ts-expect-error center returns error
        center={center}
        zoom={zoom}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >

        <CustomControls /> 
        <CustomMapLayer />
        <ColorLegend type={type}/>
      </MapContainer>
    </Container>
  );
};
export default MapComponent;

