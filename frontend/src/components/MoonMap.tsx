import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PresetSite, SiteRequest } from '../types';

// Custom icons with colored glowing pins
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-lunar-pin',
    html: `
      <div style="
        background: ${color};
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 0 12px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">
        ${label}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

const candidateIcon = createCustomIcon('#38bdf8', '★');
const selectedIcon = createCustomIcon('#f59e0b', '📍');

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

// Map recenter controller
const RecenterView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface MoonMapProps {
  selectedSite: SiteRequest;
  presetSites: PresetSite[];
  onSelectSite: (site: SiteRequest) => void;
}

export const MoonMap: React.FC<MoonMapProps> = ({
  selectedSite,
  presetSites,
  onSelectSite,
}) => {
  const handleMapClick = (lat: number, lon: number) => {
    onSelectSite({
      name: `Custom Location (${lat}°, ${lon}°)`,
      lat,
      lon,
    });
  };

  return (
    <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950">
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
        <span>Click map to select target coordinates on Lunar Surface</span>
      </div>

      <MapContainer
        center={[selectedSite.lat, selectedSite.lon]}
        zoom={3}
        minZoom={1}
        maxZoom={7}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', background: '#0a0d14' }}
      >
        <RecenterView center={[selectedSite.lat, selectedSite.lon]} zoom={4} />
        
        {/* NASA Moon Trek / USGS LRO Basemap */}
        <TileLayer
          attribution='&copy; <a href="https://trek.nasa.gov/">NASA Moon Trek</a> / LROC / USGS'
          url="https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0//default/default028mm/{z}/{y}/{x}.jpg"
          noWrap={false}
        />

        <MapEventsHandler onSelectCoords={handleMapClick} />

        {/* Selected Point Marker */}
        <Marker
          position={[selectedSite.lat, selectedSite.lon]}
          icon={selectedIcon}
        >
          <Popup className="lunar-popup">
            <div className="text-slate-900 text-xs p-1">
              <strong className="text-sm font-bold block mb-1">{selectedSite.name}</strong>
              <p className="font-mono">Lat: {selectedSite.lat}°</p>
              <p className="font-mono">Lon: {selectedSite.lon}°</p>
            </div>
          </Popup>
        </Marker>

        {/* Preset NASA Artemis Candidate Sites */}
        {presetSites.map((preset) => (
          <Marker
            key={preset.id}
            position={[preset.lat, preset.lon]}
            icon={candidateIcon}
            eventHandlers={{
              click: () => {
                onSelectSite({
                  name: preset.name,
                  lat: preset.lat,
                  lon: preset.lon,
                });
              },
            }}
          >
            <Popup className="lunar-popup">
              <div className="text-slate-900 text-xs p-1 max-w-[200px]">
                <strong className="text-sm text-cyan-700 font-bold block mb-0.5">{preset.name}</strong>
                <span className="inline-block bg-cyan-100 text-cyan-800 text-[10px] px-1.5 py-0.5 rounded font-semibold mb-1">
                  {preset.feature_type}
                </span>
                <p className="text-slate-600 mb-1.5">{preset.description}</p>
                <p className="font-mono text-[11px]">Lat: {preset.lat}° | Lon: {preset.lon}°</p>
                <button
                  onClick={() => onSelectSite({ name: preset.name, lat: preset.lat, lon: preset.lon })}
                  style={{
                    marginTop: '6px',
                    padding: '4px 8px',
                    background: '#0284c7',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    border: 'none'
                  }}
                >
                  Analyze This Site
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
