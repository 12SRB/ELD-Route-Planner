import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './RouteMap.css';

// Fix Leaflet default icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

function emojiIcon(emoji, bg = '#1e3a5f') {
  return L.divIcon({
    html: `<div class="map-emoji-marker" style="background:${bg}">${emoji}</div>`,
    className: '',
    iconSize:   [34, 34],
    iconAnchor: [17, 17],
    popupAnchor:[0, -20],
  });
}

export default function RouteMap({ tripData }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);

  useEffect(() => {
    if (!tripData) return;

    // Destroy previous instance
    if (mapInst.current) {
      mapInst.current.remove();
      mapInst.current = null;
    }

    const { locations, route, schedule } = tripData;

    // Init map
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
    mapInst.current = map;

    // Dark tile layer (CartoDB)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap contributors, © CARTO', maxZoom: 18 }
    ).addTo(map);

    // Route polyline
    const latlngs = route.geometry.map(([lon, lat]) => [lat, lon]);
    const poly = L.polyline(latlngs, {
      color:   '#f59e0b',
      weight:  5,
      opacity: 0.88,
      lineJoin: 'round',
    }).addTo(map);
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });

    // Main location markers
    L.marker([locations.start.lat,   locations.start.lon],   { icon: emojiIcon('📍', '#1d4ed8') })
      .bindPopup(`<b>Current Location</b><br>${locations.start.name}`)
      .addTo(map);

    L.marker([locations.pickup.lat,  locations.pickup.lon],  { icon: emojiIcon('🟢', '#047857') })
      .bindPopup(`<b>Pickup Location</b><br>${locations.pickup.name}`)
      .addTo(map);

    L.marker([locations.dropoff.lat, locations.dropoff.lon], { icon: emojiIcon('🔴', '#b91c1c') })
      .bindPopup(`<b>Dropoff Location</b><br>${locations.dropoff.name}`)
      .addTo(map);

    // Fuel stops
    const totalPts = latlngs.length;
    const totalMiles = route.distance_mi;

    (schedule.fuel_stops || []).forEach(fs => {
      const frac = fs.miles_in / Math.max(totalMiles, 1);
      const idx  = Math.min(Math.floor(frac * totalPts), totalPts - 1);
      const pt   = latlngs[idx];
      L.marker(pt, { icon: emojiIcon('⛽', '#92400e') })
        .bindPopup(
          `<b>Fuel Stop</b><br>Day ${fs.day} — ${fs.time_str}<br>~${fs.miles_in} miles in`
        )
        .addTo(map);
    });

    // Rest stops (mandatory 30-min breaks)
    (schedule.rest_stops || []).forEach(rs => {
      const frac = rs.miles_in / Math.max(totalMiles, 1);
      const idx  = Math.min(Math.floor(frac * totalPts), totalPts - 1);
      const pt   = latlngs[idx];
      L.marker(pt, { icon: emojiIcon('😴', '#4c1d95') })
        .bindPopup(
          `<b>30-Min Rest Break</b><br>Day ${rs.day} — ${rs.time_str}`
        )
        .addTo(map);
    });

    return () => {
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, [tripData]);

  return (
    <div className="route-map-wrapper">
      <div className="section-header">
        <span className="section-title">🗺 Route Map</span>
        <span className="map-api-badge">OpenStreetMap · OSRM</span>
      </div>

      <div ref={mapRef} className="leaflet-map" />

      {/* Legend */}
      <div className="map-legend">
        <LegendItem emoji="📍" color="#1d4ed8" label="Current Location" />
        <LegendItem emoji="🟢" color="#047857" label="Pickup" />
        <LegendItem emoji="🔴" color="#b91c1c" label="Dropoff" />
        <LegendItem emoji="⛽" color="#92400e" label="Fuel Stop" />
        <LegendItem emoji="😴" color="#4c1d95" label="Rest Break" />
      </div>
    </div>
  );
}

function LegendItem({ emoji, color, label }) {
  return (
    <div className="legend-item">
      <div className="legend-dot" style={{ background: color }}>{emoji}</div>
      <span>{label}</span>
    </div>
  );
}
