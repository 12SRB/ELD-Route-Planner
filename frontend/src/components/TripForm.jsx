import React, { useState } from 'react';
import './TripForm.css';

const DEFAULT_VALUES = {
  current_location:  'Chicago, IL',
  pickup_location:   'St. Louis, MO',
  dropoff_location:  'Dallas, TX',
  cycle_hours_used:  14,
  driver_name:       'John Doe',
  carrier_name:      'ACME Trucking Co.',
};

export default function TripForm({ onSubmit, onReset, loading }) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!values.current_location.trim())  errs.current_location  = 'Required';
    if (!values.pickup_location.trim())   errs.pickup_location   = 'Required';
    if (!values.dropoff_location.trim())  errs.dropoff_location  = 'Required';
    const c = parseFloat(values.cycle_hours_used);
    if (isNaN(c) || c < 0 || c > 70) errs.cycle_hours_used = 'Must be 0–70 hrs';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({
      current_location:  values.current_location.trim(),
      pickup_location:   values.pickup_location.trim(),
      dropoff_location:  values.dropoff_location.trim(),
      cycle_hours_used:  parseFloat(values.cycle_hours_used),
      driver_name:       values.driver_name.trim() || 'Driver',
      carrier_name:      values.carrier_name.trim() || 'Motor Carrier',
    });
  };

  const handleReset = () => {
    setValues(DEFAULT_VALUES);
    setErrors({});
    onReset();
  };

  return (
    <form className="trip-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <div className="section-title">📋 Trip Details</div>
        <p className="form-subtitle">
          Property-carrying driver &nbsp;·&nbsp; 70 hrs / 8 days cycle &nbsp;·&nbsp;
          No adverse conditions
        </p>
      </div>

      <div className="form-body">
        {/* ── Required Inputs ── */}
        <div className="form-group-label required-label">Required Inputs</div>
        <div className="form-grid required-grid">
          <Field
            label="📍 Current Location"
            id="current-location"
            placeholder="e.g. Chicago, IL"
            value={values.current_location}
            onChange={v => set('current_location', v)}
            error={errors.current_location}
          />
          <Field
            label="🟢 Pickup Location"
            id="pickup-location"
            placeholder="e.g. St. Louis, MO"
            value={values.pickup_location}
            onChange={v => set('pickup_location', v)}
            error={errors.pickup_location}
          />
          <Field
            label="🔴 Dropoff Location"
            id="dropoff-location"
            placeholder="e.g. Dallas, TX"
            value={values.dropoff_location}
            onChange={v => set('dropoff_location', v)}
            error={errors.dropoff_location}
          />
          <Field
            label="⏱ Current Cycle Used (Hrs)"
            id="cycle-hours"
            type="number"
            min={0} max={70} step={0.5}
            placeholder="0 – 70"
            value={values.cycle_hours_used}
            onChange={v => set('cycle_hours_used', v)}
            error={errors.cycle_hours_used}
            hint="Hours used in current 70-hr/8-day cycle"
          />
        </div>

        {/* ── Optional Inputs ── */}
        <div className="form-group-label optional-label">Optional Info</div>
        <div className="form-grid optional-grid">
          <Field
            label="🚛 Driver Name"
            id="driver-name"
            placeholder="Full name"
            value={values.driver_name}
            onChange={v => set('driver_name', v)}
          />
          <Field
            label="🏢 Carrier Name"
            id="carrier-name"
            placeholder="Company name"
            value={values.carrier_name}
            onChange={v => set('carrier_name', v)}
          />
        </div>
      </div>

      {/* ── Assumptions notice ── */}
      <div className="assumptions-bar">
        <strong>Assumptions:</strong>&nbsp;
        Property carrier · 70hr/8-day rule · 55 mph avg · Fuel every 1,000 mi ·
        1 hr pickup/dropoff · No adverse conditions
      </div>

      <div className="form-footer">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '⏳ Calculating…' : '⚡ GENERATE ROUTE & ELD LOGS'}
        </button>
        <button type="button" className="btn-secondary" onClick={handleReset} disabled={loading}>
          ↺ Reset
        </button>
      </div>
    </form>
  );
}

// ── Field sub-component ─────────────────────────────────────────────
function Field({ label, id, type='text', placeholder, value, onChange,
                 error, hint, min, max, step }) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label htmlFor={id} className="field-label">{label}</label>
      <input
        id={id}
        type={type}
        className="field-input"
        placeholder={placeholder}
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
