import React from 'react';
import './TripSummary.css';

export default function TripSummary({ tripData }) {
  const { route, schedule, locations } = tripData;
  const stats = schedule.trip_stats;

  const totalOnDuty = schedule.days.reduce(
    (sum, d) => sum + d.totals.driving + d.totals.on_duty, 0
  );
  const cycleRemaining = Math.max(0, 70 - stats.cycle_used_start - totalOnDuty).toFixed(1);

  return (
    <div className="trip-summary">
      <div className="section-header">
        <span className="section-title">📊 Trip Summary</span>
      </div>

      <div className="summary-body">
        <StatCard
          label="Total Distance"
          value={`${stats.total_miles.toLocaleString()} mi`}
          accent="amber"
          icon="🛣"
        />
        <StatCard
          label="Estimated Drive Time"
          value={formatHrs(stats.total_driving_hrs)}
          accent="blue"
          icon="⏱"
        />
        <StatCard
          label="Trip Duration"
          value={`${stats.trip_days} day${stats.trip_days !== 1 ? 's' : ''}`}
          accent="green"
          icon="📅"
        />
        <StatCard
          label="Fuel Stops"
          value={`${stats.fuel_stops} stop${stats.fuel_stops !== 1 ? 's' : ''}`}
          accent="amber"
          icon="⛽"
        />
        <StatCard
          label="Cycle Used / Remaining"
          value={`${stats.cycle_used_start}h / ~${cycleRemaining}h`}
          accent={parseFloat(cycleRemaining) < 10 ? 'red' : 'green'}
          icon="🔄"
        />
        <StatCard
          label="Avg Speed (assumed)"
          value={`${stats.avg_speed_mph} mph`}
          accent="muted"
          icon="🚛"
        />

        {/* Stops list */}
        <div className="stops-section">
          <div className="stops-title">📍 Key Stops</div>
          <div className="stops-list">
            <StopItem color="green" label={`Pickup: ${locations.pickup.name}`} />
            <StopItem color="red"   label={`Dropoff: ${locations.dropoff.name}`} />
            {(schedule.fuel_stops || []).map((fs, i) => (
              <StopItem
                key={`fuel-${i}`}
                color="amber"
                label={`⛽ Fuel stop — Day ${fs.day}, ${fs.time_str} (~${fs.miles_in} mi)`}
              />
            ))}
            {(schedule.rest_stops || []).map((rs, i) => (
              <StopItem
                key={`rest-${i}`}
                color="blue"
                label={`😴 30-min break — Day ${rs.day}, ${rs.time_str}`}
              />
            ))}
          </div>
        </div>

        {/* Per-day breakdown */}
        <div className="days-breakdown">
          <div className="stops-title">📋 Daily Breakdown</div>
          {schedule.days.map(day => (
            <div key={day.day_num} className="day-row">
              <span className="day-num">Day {day.day_num}</span>
              <span className="day-stat driving">
                Drive {day.totals.driving.toFixed(1)}h
              </span>
              <span className="day-stat on-duty">
                On Duty {day.totals.on_duty.toFixed(1)}h
              </span>
              <span className="day-miles">
                ~{day.driven_miles} mi
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, icon }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className={`stat-value stat-value--${accent}`}>{value}</div>
      </div>
    </div>
  );
}

function StopItem({ color, label }) {
  return (
    <div className="stop-item">
      <div className={`stop-dot stop-dot--${color}`} />
      <span>{label}</span>
    </div>
  );
}

function formatHrs(hrs) {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return `${h}h ${m}m`;
}
