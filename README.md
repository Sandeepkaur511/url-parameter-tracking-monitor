# URL Tracking Observability System

## Overview

This project demonstrates an automated observability system for monitoring URL parameter tracking in large-scale web analytics data.

The system parses raw URLs, extracts parameter keys, measures tracking coverage, and detects anomalies in parameter behavior using statistical monitoring.

Alerts are automatically triggered when tracking patterns deviate from expected baselines.

---

## Problem

Modern analytics systems depend heavily on URL parameters for:

• campaign attribution
• search tracking
• product discovery
• marketing analytics

However, tracking can break due to:

• missing parameters
• frontend implementation changes
• release-related bugs
• inconsistent tagging practices

Without monitoring, these issues may remain undetected and lead to inaccurate reporting.

---

## Solution

The system continuously monitors URL parameters extracted from raw web logs.

Pipeline steps:

1. Parse URLs into parameter key-value pairs
2. Classify parameters as tags or query parameters
3. Calculate parameter coverage metrics
4. Detect anomalies using statistical thresholds
5. Automatically notify stakeholders

---

## Architecture

Data Warehouse (Raw URLs)
↓
Power BI Power Query (URL Parsing Engine)
↓
Parameter Coverage Metrics
↓
Power BI Service Scheduled Refresh
↓
Power Automate Monitoring Flow
↓
Excel Alert Engine
↓
Automated Email Alerts

---

## Parameter Parsing Logic

URLs are decomposed into parameter keys.

Example URL:

/search?q=laptop&source=google&tags=cat:electronics|brand:hp

Extracted parameters:

| Key    | Type  |
| ------ | ----- |
| q      | param |
| source | param |
| cat    | tag   |
| brand  | tag   |

---

## Monitoring Metrics

The system tracks:

• parameter frequency
• URL coverage percentage
• desktop vs mobile parameter usage
• undocumented parameter appearance

Example monitoring table:

| Key | Key Type | Desktop Count | Mobile Count | Coverage % |
| --- | -------- | ------------- | ------------ | ---------- |

---

## Anomaly Detection

Parameter coverage is monitored using a rolling baseline model.

Baseline = Median(last 5 same weekday values)

Spread = MAD × 1.4826

Upper Limit = Baseline + 2.5 × Spread
Lower Limit = Baseline − 2.5 × Spread

If coverage falls outside this range → anomaly detected.

---

## Alert Severity

Critical ≥ 35%
Major ≥ 25%
Minor ≥ 15%

Alerts are automatically emailed to stakeholders with affected parameters.

---

## Tech Stack

SQL
Power BI
Power Query (M)
Power Automate
Excel Online
Email Automation

---

## Impact

• Detects broken tracking implementations early
• Prevents inaccurate analytics reporting
• Identifies tracking regressions after product releases
• Enables proactive analytics monitoring

---

## Future Improvements

• automated root cause detection
• tracking health dashboard
• LLM-based anomaly explanation
