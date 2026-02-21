import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import TripForm    from './components/TripForm';
import RouteMap    from './components/RouteMap';
import TripSummary from './components/TripSummary';
import ELDLogs     from './components/ELDLogs';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function App() {
  const [loading,  setLoading]  = useState(false);
  const [loadMsg,  setLoadMsg]  = useState('');
  const [error,    setError]    = useState('');
  const [tripData, setTripData] = useState(null);

  const handlePlanTrip = async (formValues) => {
    setError('');
    setTripData(null);
    setLoading(true);
    setLoadMsg('Geocoding locations…');

    try {
      setLoadMsg('Calculating route & applying FMCSA HOS rules…');
      const resp = await axios.post(`${API_BASE}/plan-trip/`, formValues, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = resp.data;
      if (!data.success) throw new Error(data.error || 'Unknown error');
      setTripData(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Request failed.';
      setError(msg);
    } finally {
      setLoading(false);
      setLoadMsg('');
    }
  };

  const handleReset = () => {
    setTripData(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="logo">
          TRUCK<span>LOG</span> PRO
        </div>
        <div className="header-right">
          <span className="header-subtitle">FMCSA HOS 49 CFR §395</span>
          <span className="eld-badge">ELD COMPLIANT</span>
        </div>
      </header>

      <main className="app-main">

        {/* ── TRIP FORM ── */}
        <section className="trip-form-section">
          <TripForm onSubmit={handlePlanTrip} onReset={handleReset} loading={loading} />
        </section>

        {/* ── ERROR ── */}
        {error && (
          <div className="error-banner">
            ⚠ {error}
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div className="loading-card">
            <div className="spinner" />
            <p>{loadMsg || 'Processing…'}</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tripData && !loading && (
          <>
            {/* Map + Summary */}
            <div className="results-grid">
              <section className="map-section">
                <RouteMap tripData={tripData} />
              </section>
              <section className="summary-section">
                <TripSummary tripData={tripData} />
              </section>
            </div>

            {/* ELD Logs */}
            <section className="eld-section">
              <ELDLogs
                days={tripData.schedule.days}
                fuelStops={tripData.schedule.fuel_stops}
                restStops={tripData.schedule.rest_stops}
                meta={{
                  driverName:  tripData.meta.driver_name,
                  carrierName: tripData.meta.carrier_name,
                  from:        tripData.locations.start.name,
                  to:          tripData.locations.dropoff.name,
                  totalMiles:  tripData.route.distance_mi,
                }}
              />
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>TruckLog Pro &copy; {new Date().getFullYear()}</span>
        <span>FMCSA HOS Property Carrier — 70hr/8day Rule</span>
        <span>Built with Django + React</span>
      </footer>
    </div>
  );
}
