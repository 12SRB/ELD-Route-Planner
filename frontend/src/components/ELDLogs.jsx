import React, { useEffect, useRef } from 'react';
import './ELDLogs.css';

// ── Colors ──────────────────────────────────────────────────────────
const STATUS_COLOR = {
  off_duty: '#444444',
  sleeper:  '#1d4ed8',
  driving:  '#d97706',
  on_duty:  '#047857',
};
const STATUS_ROW = { off_duty: 0, sleeper: 1, driving: 2, on_duty: 3 };
const ROW_LABELS = ['1. Off Duty', '2. Sleeper\nBerth', '3. Driving', '4. On Duty\n(Not Driving)'];

export default function ELDLogs({ days, fuelStops, restStops, meta }) {
  return (
    <div className="eld-logs">
      <div className="eld-header">
        <h2>📄 Driver Daily Logs (ELD)</h2>
        <p className="eld-subtitle">
          FMCSA-required format · 49 CFR §395.8 · Property Carrier
        </p>
      </div>

      {/* Status legend */}
      <div className="eld-legend">
        {[
          { color: STATUS_COLOR.off_duty, label: 'Off Duty' },
          { color: STATUS_COLOR.sleeper,  label: 'Sleeper Berth' },
          { color: STATUS_COLOR.driving,  label: 'Driving' },
          { color: STATUS_COLOR.on_duty,  label: 'On Duty (Not Driving)' },
        ].map(item => (
          <div key={item.label} className="legend-row-item">
            <div className="legend-color-bar" style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* One canvas per day */}
      {days.map(day => {
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + day.day_num - 1);
        const dateStr = baseDate.toLocaleDateString('en-US', {
          month: '2-digit', day: '2-digit', year: 'numeric'
        });
        return (
          <DayLog
            key={day.day_num}
            day={day}
            dateStr={dateStr}
            meta={meta}
          />
        );
      })}

      {/* Print / download bar */}
      <div className="print-bar">
        <button className="btn-primary" onClick={() => window.print()}>
          🖨 Print All Logs
        </button>
        <button className="btn-outline" onClick={() => downloadAllLogs(days)}>
          💾 Download PNG
        </button>
      </div>
    </div>
  );
}

// ── Single-day log component ────────────────────────────────────────
function DayLog({ day, dateStr, meta }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawELDLog(canvasRef.current, day, {
      date:        dateStr,
      driver:      meta.driverName  || 'Driver',
      carrier:     meta.carrierName || 'Motor Carrier',
      from:        meta.from        || '—',
      to:          meta.to          || '—',
      dailyMiles:  day.driven_miles || 0,
      totalMiles:  Math.round(meta.totalMiles) || 0,
      vehicleNo:   `TRK-${1000 + day.day_num}`,
    });
  }, [day, dateStr, meta]);

  const { totals } = day;
  const driven    = totals.driving.toFixed(2);
  const onDuty    = totals.on_duty.toFixed(2);
  const offDuty   = (totals.off_duty + totals.sleeper).toFixed(2);

  return (
    <div className="day-log-block">
      <div className="day-log-header">
        <div className="day-log-title">Day {day.day_num} — {dateStr}</div>
        <div className="day-log-pills">
          <span className="pill pill--amber">🚛 Drive {driven}h</span>
          <span className="pill pill--green">📋 On Duty {onDuty}h</span>
          <span className="pill pill--muted">💤 Off Duty {offDuty}h</span>
        </div>
      </div>
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ── ELD Canvas Drawing Function ─────────────────────────────────────
function drawELDLog(canvas, dayData, info) {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CW  = 900;
  const CH  = 480;

  canvas.width  = CW * DPR;
  canvas.height = CH * DPR;
  canvas.style.width  = '100%';
  canvas.style.maxWidth  = CW + 'px';
  canvas.style.height = 'auto';

  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── Layout constants ──────────────────────────────────────────────
  const M       = 8;    // margin
  const HDR_H   = 120;  // header height
  const GRID_X  = 88;   // left edge of grid
  const GRID_TOP = HDR_H + 28;
  const ROW_H   = 36;
  const ROWS    = 4;
  const GRID_H  = ROWS * ROW_H;
  const TOTAL_X = CW - 72;
  const GRID_W  = TOTAL_X - GRID_X - 4;
  const REM_TOP = GRID_TOP + GRID_H + 10;
  const REM_H   = CH - REM_TOP - M - 2;

  // ── Colors ────────────────────────────────────────────────────────
  const C = {
    bg:     '#ffffff',
    black:  '#111111',
    dark:   '#222222',
    med:    '#555555',
    light:  '#aaaaaa',
    vlight: '#dddddd',
    hdr:    '#0f1f3d',
    hdr2:   '#1a3a6e',
    amber:  '#c97f00',
    blue:   '#1d4ed8',
    green:  '#047857',
    red:    '#b91c1c',
  };

  // ── Background ────────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  // ── Outer border ─────────────────────────────────────────────────
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 2;
  ctx.strokeRect(M, M, CW - M * 2, CH - M * 2);

  // ── Title bar ─────────────────────────────────────────────────────
  const grd = ctx.createLinearGradient(M, M, CW - M, M + 24);
  grd.addColorStop(0, C.hdr);
  grd.addColorStop(1, C.hdr2);
  ctx.fillStyle = grd;
  ctx.fillRect(M, M, CW - M * 2, 24);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText("DRIVER'S DAILY LOG  (ONE CALENDAR DAY — 24 HOURS)  U.S. DEPARTMENT OF TRANSPORTATION", CW / 2, M + 16);

  ctx.font = '7.5px Arial';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#aaccff';
  ctx.fillText('Original — Submit to carrier within 13 days  |  Duplicate — Driver retains 8 days', CW - M - 6, M + 16);

  // ── Header info fields ────────────────────────────────────────────
  ctx.fillStyle = C.black;
  ctx.textAlign = 'left';
  const HL = M + 8;

  function hdrField(label, value, x, y, bold = false) {
    ctx.font = '8px Arial';
    ctx.fillStyle = C.med;
    ctx.fillText(label, x, y);
    ctx.font = bold ? 'bold 11px Arial' : '10px Arial';
    ctx.fillStyle = C.dark;
    ctx.fillText(String(value), x, y + 13);
    // underline
    ctx.beginPath();
    ctx.strokeStyle = C.light;
    ctx.lineWidth = 0.5;
    ctx.moveTo(x, y + 15);
    ctx.lineTo(x + 180, y + 15);
    ctx.stroke();
  }

  const H1 = M + 35;
  const H2 = H1 + 32;
  const H3 = H2 + 32;
  const COL2 = CW / 2 - 20;
  const COL3 = CW * 0.72;

  hdrField('DATE (Month/Day/Year)', info.date,       HL,    H1, true);
  hdrField('DRIVER NAME',           info.driver,     HL,    H2);
  hdrField('CARRIER / COMPANY',     info.carrier,    HL,    H3);

  hdrField('TOTAL MILES DRIVING TODAY', info.dailyMiles + ' mi', COL2, H1, true);
  hdrField('FROM (City/State)',     info.from,        COL2,  H2);
  hdrField('TO (City/State)',       info.to,          COL2,  H3);

  hdrField('VEHICLE NO.',           info.vehicleNo,   COL3,  H1);
  hdrField('TOTAL TRIP MILES',      info.totalMiles + ' mi', COL3, H2);

  ctx.font = 'italic 8px Arial';
  ctx.fillStyle = C.med;
  ctx.textAlign = 'right';
  ctx.fillText('I certify that these entries are true and correct', CW - M - 8, H3 + 5);
  ctx.fillText('_______________________________', CW - M - 8, H3 + 16);
  ctx.fillText('Driver Signature', CW - M - 8, H3 + 26);

  // Divider
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(M, HDR_H);
  ctx.lineTo(CW - M, HDR_H);
  ctx.stroke();

  // ── Hour labels ───────────────────────────────────────────────────
  const HOUR_LABELS = [
    'Mid-', '1','2','3','4','5','6','7','8','9','10','11',
    'Noon','1','2','3','4','5','6','7','8','9','10','11','Mid-'
  ];
  const HOUR_LABELS2 = [
    'night','','','','','','','','','','','',
    '','','','','','','','','','','','','night'
  ];

  ctx.font = '7px Arial';
  ctx.fillStyle = C.dark;
  HOUR_LABELS.forEach((lbl, i) => {
    const x = GRID_X + (i / 24) * GRID_W;
    ctx.textAlign = 'center';
    ctx.fillText(lbl,            x, GRID_TOP - 16);
    ctx.fillText(HOUR_LABELS2[i], x, GRID_TOP - 8);
  });

  ctx.fillStyle = C.dark;
  ctx.font = 'bold 7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL', TOTAL_X + 30, GRID_TOP - 16);
  ctx.fillText('HOURS', TOTAL_X + 30, GRID_TOP - 8);

  // ── Grid rows ─────────────────────────────────────────────────────
  for (let row = 0; row < ROWS; row++) {
    const RY = GRID_TOP + row * ROW_H;

    // Row label
    ctx.textAlign = 'right';
    ctx.fillStyle = C.dark;
    const llines = ROW_LABELS[row].split('\n');
    if (llines.length > 1) {
      ctx.font = 'bold 8px Arial';
      ctx.fillText(llines[0], GRID_X - 5, RY + ROW_H / 2 - 4);
      ctx.font = '7.5px Arial';
      ctx.fillText(llines[1], GRID_X - 5, RY + ROW_H / 2 + 7);
    } else {
      ctx.font = 'bold 8.5px Arial';
      ctx.fillText(llines[0], GRID_X - 5, RY + ROW_H / 2 + 4);
    }

    // Outer row rectangle
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(GRID_X, RY, GRID_W, ROW_H);

    // Hour grid lines
    for (let h = 0; h <= 24; h++) {
      const x = GRID_X + (h / 24) * GRID_W;
      ctx.strokeStyle = h === 0 || h === 24 ? C.dark : h === 12 ? '#555' : C.light;
      ctx.lineWidth   = h === 0 || h === 24 ? 1.5 : h === 12 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, RY);
      ctx.lineTo(x, RY + ROW_H);
      ctx.stroke();
    }

    // 15-minute tick marks
    for (let q = 1; q <= 96; q++) {
      if (q % 4 !== 0) {
        const x  = GRID_X + (q / 96) * GRID_W;
        const th = q % 2 === 0 ? ROW_H * 0.42 : ROW_H * 0.2;
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth   = 0.3;
        ctx.beginPath();
        ctx.moveTo(x, RY);
        ctx.lineTo(x, RY + th);
        ctx.stroke();
      }
    }

    // Total hours for this row
    const statusKey = ['off_duty', 'sleeper', 'driving', 'on_duty'][row];
    const rowHours  = (dayData.totals[statusKey] || 0).toFixed(2);
    ctx.textAlign  = 'left';
    ctx.font       = 'bold 11px Arial';
    ctx.fillStyle  = Object.values(STATUS_COLOR)[row];
    ctx.fillText(rowHours, TOTAL_X + 6, RY + ROW_H / 2 + 4);
  }

  // Total column border
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 1;
  ctx.strokeRect(TOTAL_X, GRID_TOP, CW - M - TOTAL_X, GRID_H);

  // ── Activity lines ────────────────────────────────────────────────
  const validSegs = dayData.timeline.filter(s => STATUS_ROW[s.status] !== undefined);
  let prevRow = null;
  let prevEndX = null;

  validSegs.forEach(seg => {
    const row  = STATUS_ROW[seg.status];
    const sx   = GRID_X + (seg.start / 24) * GRID_W;
    const ex   = GRID_X + (seg.end   / 24) * GRID_W;
    const cy   = GRID_TOP + row * ROW_H + ROW_H / 2;
    const col  = STATUS_COLOR[seg.status];

    ctx.strokeStyle = col;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';

    // Vertical connector from previous row
    if (prevRow !== null && prevRow !== row && prevEndX !== null) {
      const prevCY = GRID_TOP + prevRow * ROW_H + ROW_H / 2;
      ctx.beginPath();
      ctx.moveTo(prevEndX, prevCY);
      ctx.lineTo(prevEndX, cy);
      ctx.stroke();
    }

    // Horizontal activity line
    ctx.beginPath();
    ctx.moveTo(sx, cy);
    ctx.lineTo(ex, cy);
    ctx.stroke();

    prevRow  = row;
    prevEndX = ex;
  });

  // ── Remarks section ───────────────────────────────────────────────
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(M + 1, REM_TOP, CW - M * 2 - 2, REM_H);
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 1;
  ctx.strokeRect(M, REM_TOP, CW - M * 2, REM_H);

  // Remarks header bar
  ctx.fillStyle = '#e8ecf4';
  ctx.fillRect(M + 1, REM_TOP + 1, CW - M * 2 - 2, 16);
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.dark;
  ctx.fillText(
    'REMARKS — City/Town/State where change of duty status occurred (§395.8):',
    M + 6, REM_TOP + 12
  );

  // Remarks content
  ctx.font = '8px Arial';
  ctx.fillStyle = C.dark;
  let rx = M + 8;
  let ry = REM_TOP + 28;
  const noteSegs = validSegs.filter(s => s.note && s.status !== 'off_duty');
  noteSegs.forEach((seg, i) => {
    const label = `${fmtHr(seg.start)} — ${seg.note}`;
    const tw    = ctx.measureText(label).width + 22;
    if (rx + tw > CW - M - 8) { rx = M + 8; ry += 14; }
    if (ry > REM_TOP + REM_H - 6) return;
    ctx.fillStyle = STATUS_COLOR[seg.status] || C.dark;
    ctx.fillText('●', rx, ry);
    ctx.fillStyle = C.dark;
    ctx.fillText(label, rx + 10, ry);
    rx += tw;
  });

  // ── Recapitulation ────────────────────────────────────────────────
  const RECAP_X = CW - 230;
  const RECAP_Y = REM_TOP + 4;
  ctx.font = 'bold 7.5px Arial';
  ctx.fillStyle = C.dark;
  ctx.textAlign = 'left';
  ctx.fillText('RECAPITULATION:', RECAP_X, RECAP_Y + 11);

  const recapRows = [
    ['A. On Duty Today (Lines 3 & 4)',
      (dayData.totals.driving + dayData.totals.on_duty).toFixed(2) + ' hrs'],
    ['B. Driving Today (Line 3)',
      dayData.totals.driving.toFixed(2) + ' hrs'],
    ['C. Off Duty Today (Lines 1 & 2)',
      (dayData.totals.off_duty + dayData.totals.sleeper).toFixed(2) + ' hrs'],
  ];
  ctx.font = '7.5px Arial';
  recapRows.forEach(([lbl, val], i) => {
    const y = RECAP_Y + 23 + i * 13;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.med;
    ctx.fillText(lbl, RECAP_X, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.dark;
    ctx.font = 'bold 7.5px Arial';
    ctx.fillText(val, CW - M - 8, y);
    ctx.font = '7.5px Arial';
  });
}

// ── Helpers ────────────────────────────────────────────────────────
function fmtHr(hour) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h < 12 ? 'AM' : 'PM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${period}`;
}

function downloadAllLogs(days) {
  days.forEach((day, i) => {
    const canvas = document.querySelectorAll('.canvas-wrapper canvas')[i];
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `ELD_Log_Day_${day.day_num}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}
