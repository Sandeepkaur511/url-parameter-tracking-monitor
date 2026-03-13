# Alert Calculation Logic

## Overview

Tracking parameter coverage is monitored using a statistical anomaly detection model.

The model compares the latest KPI value with historical patterns from the same weekday.

---

## Baseline Calculation

Baseline = Median(last 5 same weekday values)

---

## Spread Calculation

MAD = Median(|value − baseline|)

Spread = MAD × 1.4826

---

## Expected Range

Upper Limit = Baseline + 2.5 × Spread
Lower Limit = Baseline − 2.5 × Spread

If the observed value falls outside this range, the parameter is flagged as an anomaly.

---

## Alert Severity

| Level    | Deviation |
| -------- | --------- |
| Critical | ≥ 35%     |
| Major    | ≥ 25%     |
| Minor    | ≥ 15%     |
| No Alert | < 15%     |

---

## Result

Detected anomalies are automatically included in the alert email sent to stakeholders.
