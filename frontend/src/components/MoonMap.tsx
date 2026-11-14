import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PresetSite, SiteRequest } from '../types';

// Neutral, flat instrument crosshairs. Selection differs by weight, not hue.
const createCrosshairIcon = (selected: boolean) => L.divIcon({
  className: `lunar-crosshair ${selected ? 'is-selected' : 'is-candidate'}`,
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M14 2v7m0 10v7M2 14h7m10 0h7" stroke="#17191c" stroke-width="4"/><circle cx="14" cy="14" r="6" stroke="#17191c" stroke-width="4"/><path d="M14 2v7m0 10v7M2 14h7m10 0h7" stroke="${selected ? '#f1f0eb' : '#b4b6b8'}" stroke-width="${selected ? 2 : 1}"/><circle cx="14" cy="14" r="6" stroke="${selected ? '#f1f0eb' : '#b4b6b8'}" stroke-width="${selected ? 2 : 1}"/>${selected ? '<circle cx="14" cy="14" r="2" fill="#f1f0eb"/>' : ''}</svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const candidateIcon = createCrosshairIcon(false);
const selectedIcon = createCrosshairIcon(true);

interface MapEventsHandlerProps {
  onSelectCoords: (lat: number, lon: number) => void;
}
const MapEventsHandler: React.FC<MapEventsHandlerProps> = ({ onSelectCoords }) => {
  useMapEvents({
    click(e) {
      const lat = parseFloat(e.latlng.lat.toFixed(3));
      const lon = parseFloat(e.latlng.lng.toFixed(3));
      onSelectCoords(lat, lon);
    },
  });
  return null;
};

const RecenterView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
};

interface MoonMapProps {
  selectedSite: SiteRequest;
  presetSites: PresetSite[];
  onSelectSite: (site: SiteRequest) => void;
}

export const MoonMap: React.FC<MoonMapProps> = ({ selectedSite, presetSites, onSelectSite }) => {
  const [tileError, setTileError] = useState(false);
  const handleMapClick = (lat: number, lon: number) => {
    onSelectSite({ name: `Custom Location (${lat}°, ${lon}°)`, lat, lon });
  };

  return (
    <div className="moon-map" style={{ position: 'relative', width: '100%', height: 460 }}>
      <div className="map-instruction">Select a point on the lunar surface</div>
      {tileError && <div className="map-tile-error" role="status">Some lunar map tiles could not load. Site markers and coordinate selection remain available.</div>}
      <MapContainer center={[selectedSite.lat, selectedSite.lon]} zoom={3} minZoom={1} maxZoom={7}
        scrollWheelZoom={true} style={{ width: '100%', height: '100%', background: '#17191c' }}>
        <RecenterView center={[selectedSite.lat, selectedSite.lon]} zoom={4} />
        <TileLayer
          attribution='&copy; <a href="https://trek.nasa.gov/">NASA Moon Trek</a> / LROC / USGS'
          url="https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0//default/default028mm/{z}/{y}/{x}.jpg"
          noWrap={false}
          eventHandlers={{ loading: () => setTileError(false), tileerror: () => setTileError(true) }}
        />
        <MapEventsHandler onSelectCoords={handleMapClick} />
        <Marker position={[selectedSite.lat, selectedSite.lon]} icon={selectedIcon} title={`Selected: ${selectedSite.name}`} alt={`Selected site: ${selectedSite.name}`}>
          <Popup className="lunar-popup">
            <div className="map-site-details">
              <h4>{selectedSite.name}</h4>
              <p className="numeric">Lat: {selectedSite.lat}°</p>
              <p className="numeric">Lon: {selectedSite.lon}°</p>
            </div>
          </Popup>
        </Marker>
        {presetSites.map((preset) => (
          <Marker key={preset.id} position={[preset.lat, preset.lon]} icon={candidateIcon}
            title={preset.name} alt={`Candidate site: ${preset.name}`}
            eventHandlers={{ click: () => onSelectSite({ name: preset.name, lat: preset.lat, lon: preset.lon }) }}>
            <Popup className="lunar-popup">
              <div className="map-site-details">
                <h4>{preset.name}</h4>
                <span className="map-feature-type">{preset.feature_type}</span>
                <p>{preset.description}</p>
                <p className="numeric">Lat: {preset.lat}° | Lon: {preset.lon}°</p>
                <button type="button" className="map-analyze-button"
                  onClick={() => onSelectSite({ name: preset.name, lat: preset.lat, lon: preset.lon })}>
                  Analyze this site
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
