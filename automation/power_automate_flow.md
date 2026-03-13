# Power Automate Monitoring Flow

## Overview

The Power Automate workflow is responsible for detecting tracking anomalies and notifying stakeholders automatically.

The flow runs after the Power BI dataset refresh and evaluates parameter coverage metrics for the previous day (T-1).

---

## Workflow Steps

1. **Scheduled Trigger**

   Power Automate runs on a daily schedule after the Power BI report refresh.

2. **Fetch Monitoring Table**

   The workflow retrieves the monitoring table from the Power BI dataset containing parameter coverage metrics.

3. **Store Results in Excel Online**

   Data is written to an Excel Online file for processing and alert evaluation.

4. **Run Excel Script**

   The Excel script calculates anomaly alerts using statistical thresholds.

5. **Evaluate Alerts**

   If any parameter is classified as **Minor, Major, or Critical**, the alert pipeline continues.

6. **Generate HTML Table**

   The system dynamically generates an HTML table summarizing the anomalies.

7. **Send Alert Email**

   The HTML report is sent to stakeholders via automated email.

---

## Outcome

The automation pipeline ensures that tracking issues are detected quickly and communicated to relevant teams without manual monitoring.
