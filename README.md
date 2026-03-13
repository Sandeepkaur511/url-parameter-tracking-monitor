# URL Parameter Tracking Monitor

## Overview

This project demonstrates an automated system for monitoring URL parameter tracking across large volumes of web traffic.

The system parses raw URLs, extracts parameter key-value pairs, analyzes their frequency, and detects anomalies in tracking coverage using statistical monitoring.

Alerts are automatically sent to stakeholders when abnormal tracking patterns are detected.

---

## Business Problem

Web analytics and marketing attribution depend heavily on URL parameters.

However, several issues can occur:

• missing tracking parameters  
• incorrect parameter implementation  
• unexpected drops in parameter usage  
• tracking breaks after product releases  

Without monitoring, these issues can remain undetected and lead to inaccurate analytics.

---

## Solution

The system continuously analyzes URL logs to monitor parameter usage patterns.

Key steps include:

1. Parsing raw URLs into key-value parameter pairs
2. Aggregating parameter occurrence metrics
3. Monitoring deviations in parameter coverage
4. Automatically triggering alerts when anomalies occur

---

## System Architecture

Raw URL Logs (SQL Warehouse)
        ↓
Power BI (URL Parsing using M Code)
        ↓
Parameter Aggregation Model
        ↓
Power BI Service Auto Refresh (T-1 Data)
        ↓
Power Automate Scheduled Flow
        ↓
Excel Online Alert Processing
        ↓
Automated Email Alerts
