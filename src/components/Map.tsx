import React from "react";
import { MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Container } from "react-bootstrap";
import styles from "./Map.module.css";
import { useMapContext } from "./MapContext";
import ColorLegend from "./colorScale";
import CustomControls from "./CustomControls";

interface MapComponentProps {
  center: [number, number];
  zoom: number;
  type: string;
}

const CustomMapLayer: React.FC = () => {
  const map = useMap();
  const { setMap } = useMapContext();

  React.useEffect(() => {
    if (!map) return;

    const removeAllControls = () => {
      map.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.Control) {
          map.removeControl(layer);
        }
      });
    };

    const basemapUrl =
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png";
    const basemapLayer = L.tileLayer.wms(basemapUrl, {
      layers: "BlueMarble_NextGeneration",
      format: "image/png",
      crs: L.CRS.EPSG4326,
      opacity: 1.0,
      transparent: true,
      noWrap: true,
      tileSize: 256,
      errorTileUrl: "",
      maxZoom: 20,
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

    const reg = L.layerGroup([basemapLayer, references]);

    map.addLayer(reg);

    map.options.preferCanvas = true;
    map.setMinZoom(3);
    map.setMaxZoom(19);

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
        center={center}
        zoom={zoom}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <CustomControls />
        <CustomMapLayer />
        <ColorLegend type={type} />
      </MapContainer>
    </Container>
  );
};
export default MapComponent;
