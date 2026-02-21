"""
FMCSA Hours of Service (HOS) Calculator
Property-carrying driver — 70 hrs / 8 days rule
Ref: 49 CFR Part 395
"""

# ── HOS Constants (FMCSA 49 CFR §395) ────────────────────────────
MAX_DRIVING_HRS  = 11.0   # Max driving in a 14-hr window
DUTY_WINDOW_HRS  = 14.0   # 14-hr driving window
MIN_OFF_DUTY_HRS = 10.0   # Minimum off-duty before next shift
BREAK_AFTER_HRS  = 8.0    # Require 30-min break after 8 cumulative drive hrs
BREAK_DUR_HRS    = 0.5    # 30-minute break
MAX_CYCLE_HRS    = 70.0   # 70-hr / 8-day limit
MAX_DAYS_CYCLE   = 8      # rolling 8-day window

# ── Trip Constants ─────────────────────────────────────────────────
AVG_SPEED_MPH    = 55.0   # average speed
FUEL_INTERVAL_MI = 1000.0 # fuel every 1,000 miles
FUEL_STOP_HRS    = 0.5    # 30 min per fuel stop
PICKUP_DUR_HRS   = 1.0    # 1 hr for pickup
DROPOFF_DUR_HRS  = 1.0    # 1 hr for dropoff
PRE_TRIP_HRS     = 0.5    # pre-trip inspection
POST_TRIP_HRS    = 0.25   # post-trip inspection
DAY_START_HR     = 6.0    # driver starts at 6 AM each day


def hours_to_hhmm(hours: float) -> str:
    """Convert decimal hours to HH:MM AM/PM string."""
    h = int(hours)
    m = int(round((hours - h) * 60))
    if m == 60:
        h += 1
        m = 0
    period = "AM" if h < 12 else "PM"
    dh = 12 if h == 0 else (h - 12 if h > 12 else h)
    return f"{dh}:{m:02d} {period}"


def calculate_trip_schedule(total_miles: float, cycle_hours_used: float) -> dict:
    """
    Calculate full trip schedule applying FMCSA HOS rules.

    Returns a dict with:
      - days: list of day objects
      - fuel_stops: list of fuel stop metadata
      - rest_stops: list of mandatory break metadata
      - trip_stats: summary statistics
    """
    remaining_miles = total_miles
    cumulative_miles = 0.0
    cycle_used = float(cycle_hours_used)

    days = []
    all_fuel_stops = []
    all_rest_stops = []

    pickup_done  = False
    dropoff_done = False
    day_num = 0

    while (remaining_miles > 0.01 or not dropoff_done) and day_num < 14:
        day_num += 1
        timeline = []
        driven_today = 0.0
        on_duty_today = 0.0
        break_taken = False

        t = 0.0  # time cursor (0 = midnight)

        # ── 1. Off-duty rest: Midnight → DAY_START ──────────────────
        timeline.append({
            "status": "off_duty",
            "start":  0.0,
            "end":    DAY_START_HR,
            "note":   "Off duty / rest",
            "miles":  0
        })
        t = DAY_START_HR

        # ── 2. Pre-trip inspection ───────────────────────────────────
        timeline.append({
            "status": "on_duty",
            "start":  t,
            "end":    t + PRE_TRIP_HRS,
            "note":   "Pre-trip inspection",
            "miles":  0
        })
        t += PRE_TRIP_HRS
        on_duty_today += PRE_TRIP_HRS

        # ── 3. Pickup (day 1 only) ───────────────────────────────────
        if not pickup_done:
            timeline.append({
                "status": "on_duty",
                "start":  t,
                "end":    t + PICKUP_DUR_HRS,
                "note":   "Pickup at shipper",
                "miles":  0
            })
            t += PICKUP_DUR_HRS
            on_duty_today += PICKUP_DUR_HRS
            pickup_done = True

        # ── 4. Cycle check ───────────────────────────────────────────
        cycle_remaining = MAX_CYCLE_HRS - cycle_used
        if cycle_remaining <= 0:
            # Driver is out of cycle hours — full rest day
            timeline.append({
                "status": "off_duty",
                "start":  t,
                "end":    24.0,
                "note":   "Cycle limit reached — mandatory rest",
                "miles":  0
            })
            days.append(_build_day(day_num, timeline, driven_today, 0))
            cycle_used = 0  # 34-hr restart after full day off resets (simplified)
            continue

        # ── 5. Drive loop ────────────────────────────────────────────
        window_end = DAY_START_HR + DUTY_WINDOW_HRS  # e.g. 20:00

        while (driven_today < MAX_DRIVING_HRS and
               remaining_miles > 0.01 and
               t < window_end - 0.05):

            # 30-min break check (after 8 cumulative driving hours)
            if not break_taken and driven_today >= BREAK_AFTER_HRS:
                all_rest_stops.append({
                    "miles_in": round(cumulative_miles),
                    "day": day_num,
                    "time": t,
                    "time_str": hours_to_hhmm(t)
                })
                timeline.append({
                    "status": "off_duty",
                    "start":  t,
                    "end":    t + BREAK_DUR_HRS,
                    "note":   "30-min mandatory rest break (§395.3(a)(3)(ii))",
                    "miles":  0
                })
                t += BREAK_DUR_HRS
                break_taken = True
                if t >= window_end:
                    break

            # How far to next fuel stop?
            since_last_fuel = cumulative_miles % FUEL_INTERVAL_MI
            to_next_fuel = (FUEL_INTERVAL_MI - since_last_fuel
                            if since_last_fuel > 0 else FUEL_INTERVAL_MI)

            # Constraints on this driving segment
            window_left  = window_end - t
            drive_left   = MAX_DRIVING_HRS - driven_today
            cycle_left   = cycle_remaining - driven_today - on_duty_today
            till_break   = (BREAK_AFTER_HRS - driven_today
                            if not break_taken else drive_left)
            till_break   = max(till_break, 0)

            seg_hrs = min(
                drive_left,
                window_left - 0.01,
                to_next_fuel / AVG_SPEED_MPH,
                cycle_left if cycle_left > 0 else drive_left,
                till_break if till_break > 0 else drive_left
            )
            if seg_hrs < 0.02:
                break

            seg_miles = seg_hrs * AVG_SPEED_MPH
            if seg_miles > remaining_miles:
                seg_miles = remaining_miles
                seg_hrs   = seg_miles / AVG_SPEED_MPH

            timeline.append({
                "status": "driving",
                "start":  t,
                "end":    t + seg_hrs,
                "note":   f"Driving — {round(seg_miles)} mi",
                "miles":  round(seg_miles, 1)
            })
            t               += seg_hrs
            driven_today    += seg_hrs
            on_duty_today   += seg_hrs
            remaining_miles -= seg_miles
            cumulative_miles += seg_miles

            # Fuel stop reached?
            post_fuel_mod = cumulative_miles % FUEL_INTERVAL_MI
            if post_fuel_mod < 1.0 and remaining_miles > 0.01:
                all_fuel_stops.append({
                    "miles_in": round(cumulative_miles),
                    "day": day_num,
                    "time": t,
                    "time_str": hours_to_hhmm(t),
                    "fraction": cumulative_miles / max(total_miles, 1)
                })
                timeline.append({
                    "status": "on_duty",
                    "start":  t,
                    "end":    t + FUEL_STOP_HRS,
                    "note":   f"Fuel stop @ ~{round(cumulative_miles)} mi",
                    "miles":  0
                })
                t             += FUEL_STOP_HRS
                on_duty_today += FUEL_STOP_HRS

        # ── 6. Dropoff (when driving is complete) ───────────────────
        if remaining_miles <= 0.01 and not dropoff_done:
            if t + DROPOFF_DUR_HRS + POST_TRIP_HRS <= 24:
                timeline.append({
                    "status": "on_duty",
                    "start":  t,
                    "end":    t + DROPOFF_DUR_HRS,
                    "note":   "Dropoff at consignee",
                    "miles":  0
                })
                t             += DROPOFF_DUR_HRS
                on_duty_today += DROPOFF_DUR_HRS

                timeline.append({
                    "status": "on_duty",
                    "start":  t,
                    "end":    t + POST_TRIP_HRS,
                    "note":   "Post-trip inspection",
                    "miles":  0
                })
                t             += POST_TRIP_HRS
                on_duty_today += POST_TRIP_HRS
            dropoff_done = True

        # ── 7. Rest until midnight ───────────────────────────────────
        if t < 24.0:
            timeline.append({
                "status": "off_duty",
                "start":  t,
                "end":    24.0,
                "note":   "Off duty / rest period",
                "miles":  0
            })

        # Update rolling cycle
        cycle_used = min(cycle_used + driven_today + on_duty_today, MAX_CYCLE_HRS)

        days.append(_build_day(day_num, timeline, driven_today, cumulative_miles))

    # ── Trip stats ───────────────────────────────────────────────────
    total_driving_hrs = sum(d["totals"]["driving"] for d in days)
    trip_stats = {
        "total_miles":      round(total_miles),
        "total_driving_hrs": round(total_driving_hrs, 1),
        "trip_days":         len(days),
        "fuel_stops":        len(all_fuel_stops),
        "cycle_used_start":  round(cycle_hours_used, 1),
        "cycle_remaining":   round(max(0, MAX_CYCLE_HRS - cycle_used), 1),
        "avg_speed_mph":     AVG_SPEED_MPH,
    }

    return {
        "days":        days,
        "fuel_stops":  all_fuel_stops,
        "rest_stops":  all_rest_stops,
        "trip_stats":  trip_stats
    }


def _build_day(day_num, timeline, driven_hrs, cumulative_miles):
    """Build a day record with computed totals."""
    totals = {"off_duty": 0.0, "sleeper": 0.0, "driving": 0.0, "on_duty": 0.0}
    for seg in timeline:
        dur = seg["end"] - seg["start"]
        if seg["status"] in totals:
            totals[seg["status"]] += dur

    return {
        "day_num":          day_num,
        "timeline":         timeline,
        "totals":           {k: round(v, 2) for k, v in totals.items()},
        "driven_hrs":       round(driven_hrs, 2),
        "driven_miles":     round(driven_hrs * AVG_SPEED_MPH),
        "cumulative_miles": round(cumulative_miles),
    }
