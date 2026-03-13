function main(workbook: ExcelScript.Workbook) {
    // === CONFIGURATION ===
    const sourceSheetName = "TrackingData";
    const resultSheetName = "AnomalyDetection";

    const dateColName      = "Date";
    const keyColName       = "Parameter";
    const keyTypeColName   = "Parameter Type";

    const desktopColName   = "Desktop Occurrences";
    const mobileColName    = "Mobile Occurrences";

    const baselineLookbackCount = 5;
    const SMALL_VOLUME_THRESHOLD = 1000;  // ignore anomalies when baseline is very low

    // === OUTPUT HEADER ===
    const header = [
        "Date",
        "Parameter",
        "Parameter Type",
        "Platform",
        "Latest Value",
        "Baseline (Median)",
        "MAD",
        "Spread",
        "Lower Limit",
        "Upper Limit",
        "Status",
        "Violated Limit",
        "Change %",
        "Alert Level",
        "Trigger Alert",
        "History Count (same weekday)"
    ];

    // === HELPER FUNCTIONS ===
    function parseDate(value: unknown): Date | null {
        if (value === null || value === undefined || value === "") return null;

        if (value instanceof Date) return value;

        if (typeof value === "number") {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            return new Date(excelEpoch.getTime() + value * 86400000);
        }

        if (typeof value === "string") {
            const d = new Date(value);
            if (!isNaN(d.getTime())) return d;
        }

        return null;
    }

    function getWeekdayIndex(d: Date): number {
        const jsDay = d.getDay();
        return jsDay === 0 ? 6 : jsDay - 1;
    }

    const median = (arr: number[]): number => {
        const sorted = [...arr].sort((a, b) => a - b);
        const n = sorted.length;
        const mid = Math.floor(n / 2);
        return n % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    };

    const abs = (x: number) => (x < 0 ? -x : x);

    // === READ SOURCE SHEET ===
    const sheet = workbook.getWorksheet(sourceSheetName);
    if (!sheet) throw new Error(`Sheet '${sourceSheetName}' not found`);

    const range = sheet.getUsedRange();
    if (!range) throw new Error("Sheet is empty");

    const values = range.getValues();
    if (values.length < 2) throw new Error("Not enough rows");

    const headerRow = values[0].map(v => String(v ?? "").trim());
    const dataRows = values.slice(1);

    const colIndex = (name: string): number => {
        const idx = headerRow.findIndex(
            h => h.toLowerCase() === name.toLowerCase()
        );
        if (idx === -1) throw new Error(`Column '${name}' not found`);
        return idx;
    };

    const dateIdx    = colIndex(dateColName);
    const keyIdx     = colIndex(keyColName);
    const keyTypeIdx = colIndex(keyTypeColName);
    const desktopIdx = colIndex(desktopColName);
    const mobileIdx  = colIndex(mobileColName);

    // === NORMALIZED ROW STRUCT ===
    type RowRec = {
        date: Date;
        weekdayIdx: number;
        key: string;
        keyType: string;
        platform: "Desktop" | "Mobile";
        value: number;
    };

    const rows: RowRec[] = [];

    dataRows.forEach(r => {
        const d = parseDate(r[dateIdx]);
        if (!d) return;

        const key = String(r[keyIdx]);
        const keyType = String(r[keyTypeIdx]);

        const desktopValue = Number(r[desktopIdx]);
        const mobileValue  = Number(r[mobileIdx]);

        if (!isNaN(desktopValue) && desktopValue >= 0) {
            rows.push({
                date: d,
                weekdayIdx: getWeekdayIndex(d),
                key,
                keyType,
                platform: "Desktop",
                value: desktopValue
            });
        }

        if (!isNaN(mobileValue) && mobileValue >= 0) {
            rows.push({
                date: d,
                weekdayIdx: getWeekdayIndex(d),
                key,
                keyType,
                platform: "Mobile",
                value: mobileValue
            });
        }
    });

    if (rows.length === 0) throw new Error("No valid data found");

    // === FIND LATEST DATE ===
    let latestDate = rows[0].date;
    rows.forEach(r => {
        if (r.date.getTime() > latestDate.getTime()) {
            latestDate = r.date;
        }
    });

    const latestWeekdayIdx = getWeekdayIndex(latestDate);

    // === GROUP BY KEY + TYPE + PLATFORM ===
    const groups: Record<string, RowRec[]> = {};

    rows.forEach(rec => {
        const g = `${rec.key}||${rec.keyType}||${rec.platform}`;
        if (!groups[g]) groups[g] = [];
        groups[g].push(rec);
    });

    type ResultRow = (string | number)[];

    const finalRows: ResultRow[] = [];

    // === PROCESS EACH GROUP ===
    Object.keys(groups).forEach(g => {
        const groupRows = groups[g];

        const latestRows = groupRows.filter(
            r => r.date.toDateString() === latestDate.toDateString()
        );

        if (latestRows.length === 0) return;

        const base = latestRows[0];
        const latestValue = base.value;

        // Past rows (same weekday)
        const historyRows = groupRows.filter(
            r => r.date.toDateString() !== latestDate.toDateString()
        );

        const sameWeekdayHistory = historyRows
            .filter(r => r.weekdayIdx === latestWeekdayIdx)
            .sort((a, b) => b.date.getTime() - a.date.getTime());

        const historyCount = sameWeekdayHistory.length;

        if (historyCount < baselineLookbackCount) {
            finalRows.push([
                latestDate.toISOString().split('T')[0],
                base.key,
                base.keyType,
                base.platform,
                latestValue,
                "N/A",
                "N/A",
                "N/A",
                "N/A",
                "N/A",
                "Insufficient history",
                "",
                "",
                "None",
                "No",
                historyCount
            ]);
            return;
        }

        const lastValues = sameWeekdayHistory
            .slice(0, baselineLookbackCount)
            .map(r => r.value);

        const baseline = median(lastValues);

        // === SMALL VOLUME FILTER ===
        if (baseline < SMALL_VOLUME_THRESHOLD && latestValue < SMALL_VOLUME_THRESHOLD) {
            finalRows.push([
                latestDate.toISOString().split('T')[0],
                base.key,
                base.keyType,
                base.platform,
                latestValue,
                baseline,
                "N/A",
                "N/A",
                "N/A",
                "N/A",
                "Low volume — no alert",
                "",
                "",
                "None",
                "No",
                historyCount
            ]);
            return;
        }

        // === MAD-BASED DETECTION ===
        const mad    = median(lastValues.map(v => abs(v - baseline)));
        const spread = mad * 1.4826;           // ≈ constant for normal distribution

        const lower = baseline - 2.5 * spread;
        const upper = baseline + 2.5 * spread;

        let status    = "Normal";
        let violated  = "";
        let changePct: number | "" = "";
        let alert     = "None";
        let trigger   = "No";

        if (latestValue < lower || latestValue > upper) {
            if (latestValue > upper) {
                status   = "Above expected";
                violated = "Upper";
                changePct = upper !== 0 ? ((latestValue - upper) / upper) * 100 : "";
            } else {
                status   = "Below expected";
                violated = "Lower";
                changePct = lower !== 0 ? ((latestValue - lower) / lower) * 100 : "";
            }

            if (typeof changePct === "number") {
                const absChange = Math.abs(changePct);

                if      (absChange >= 35) { alert = "Critical"; trigger = "Yes"; }
                else if (absChange >= 25) { alert = "Major";    trigger = "Yes"; }
                else if (absChange >= 15) { alert = "Minor";    trigger = "Yes"; }
            }
        }

        finalRows.push([
            latestDate.toISOString().split('T')[0],
            base.key,
            base.keyType,
            base.platform,
            latestValue,
            baseline,
            mad,
            spread,
            lower,
            upper,
            status,
            violated,
            changePct === "" ? "" : Number(changePct.toFixed(2)),
            alert,
            trigger,
            historyCount
        ]);
    });

    // === WRITE OUTPUT ===
    let outSheet = workbook.getWorksheet(resultSheetName);
    if (!outSheet) {
        outSheet = workbook.addWorksheet(resultSheetName);
        outSheet.getRangeByIndexes(0, 0, 1, header.length).setValues([header]);
    }

    const used = outSheet.getUsedRange();
    const startRow = used ? used.getRowCount() : 1;

    outSheet
        .getRangeByIndexes(startRow, 0, finalRows.length, header.length)
        .setValues(finalRows);

    outSheet.getRange("A:A").setNumberFormatLocal("yyyy-mm-dd");

    const all = outSheet.getUsedRange();
    if (all) {
        all.getFormat().autofitColumns();
        all.getFormat().autofitRows();
    }
}