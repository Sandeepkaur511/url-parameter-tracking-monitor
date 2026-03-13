function main(workbook: ExcelScript.Workbook) {

  // ================================
  // CONFIG
  // ================================
  const ANOMALY_SHEET = "AnomalyResults";
  const KEYS_SHEET = "TrackingData";
  const DESC_SHEET = "ParameterDescriptions";
  const BASELINE_COUNT = 5;

  // ================================
  // TYPES
  // ================================
  interface AlertRow {
    key: string;
    type: string;
    platform: "Desktop" | "Mobile";
    value: number;
    lower: number;
    upper: number;
    change: number;
    alert: string;
    description: string;
    history: Record<string, number | "">;
  }

  // ================================
  // DATE HELPERS
  // ================================
  function normalizeDate(val: unknown): string {
    if (!val) return "";

    if (val instanceof Date) {
      return val.toISOString().substring(0, 10);
    }

    if (typeof val === "number") {
      const base = new Date(Date.UTC(1899, 11, 30));
      return new Date(base.getTime() + val * 86400000)
        .toISOString()
        .substring(0, 10);
    }

    const d = new Date(String(val));
    return isNaN(d.getTime()) ? "" : d.toISOString().substring(0, 10);
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).replace(/ /g, "-");
  }

  function getBaselineDates(latestISO: string): string[] {
    const out: string[] = [];
    const d = new Date(latestISO);

    for (let i = 1; i <= BASELINE_COUNT; i++) {
      const x = new Date(d);
      x.setDate(x.getDate() - i * 7);
      out.push(x.toISOString().substring(0, 10));
    }
    return out;
  }

  // ================================
  // READ DESCRIPTION LOOKUP
  // ================================
  const descMap: Record<string, string> = {};
  const descSheet = workbook.getWorksheet(DESC_SHEET);

  if (descSheet) {
    const r = descSheet.getUsedRange();
    if (r) {
      const v = r.getValues();
      const h = v[0].map(x => String(x).toLowerCase());
      const k = h.indexOf("key");
      const d = h.indexOf("description");

      v.slice(1).forEach(r => {
        if (r[k]) descMap[String(r[k])] = String(r[d] ?? "");
      });
    }
  }

  // ================================
  // READ KEYS HISTORY
  // ================================
  const historyMap: Record<string, { desktop?: number; mobile?: number }> = {};
  const keysSheet = workbook.getWorksheet(KEYS_SHEET);
  if (!keysSheet) return { sendEmail: "No", subject: "", htmlBody: "" };

  const kv = keysSheet.getUsedRange()?.getValues() ?? [];
  const kh = kv[0].map(x => String(x).toLowerCase());

  const kd = kh.indexOf("date");
  const kk = kh.indexOf("key");
  const kt = kh.indexOf("key type");
  const dd = kh.indexOf("desktop occurrences");
  const md = kh.indexOf("mobile occurrences");

  kv.slice(1).forEach(r => {
    const dateISO = normalizeDate(r[kd]);
    const key = String(r[kk]);
    const type = String(r[kt]);

    if (!dateISO || !key) return;

    const mapKey = `${key}|${type}|${dateISO}`;
    if (!historyMap[mapKey]) historyMap[mapKey] = {};

    if (!isNaN(Number(r[dd]))) {
      historyMap[mapKey].desktop = Number(r[dd]);
    }

    if (!isNaN(Number(r[md]))) {
      historyMap[mapKey].mobile = Number(r[md]);
    }
  });

  // ================================
  // READ ANOMALY RESULTS
  // ================================
  const anomalySheet = workbook.getWorksheet(ANOMALY_SHEET);
  if (!anomalySheet) return { sendEmail: "No", subject: "", htmlBody: "" };

  const av = anomalySheet.getUsedRange()?.getValues() ?? [];
  if (av.length < 2) return { sendEmail: "No", subject: "", htmlBody: "" };

  const ah = av[0].map(x => String(x).toLowerCase());
  const col = (n: string) => ah.indexOf(n.toLowerCase());

  const dIdx = col("date");
  const kIdx = col("key");
  const tIdx = col("key type");
  const pIdx = col("platform");
  const vIdx = col("latest value");
  const lIdx = col("lower limit");
  const uIdx = col("upper limit");
  const chIdx = col("change %");
  const aIdx = col("alert level");
  const trIdx = col("trigger alert");

  const latestISO = normalizeDate(
    av.slice(1).map(r => r[dIdx]).sort().pop()
  );

  const baselineDates = getBaselineDates(latestISO);

  const desktop: AlertRow[] = [];
  const mobile: AlertRow[] = [];

  av.slice(1).forEach(r => {
    if (normalizeDate(r[dIdx]) !== latestISO) return;
    if (String(r[trIdx]).toLowerCase() !== "yes") return;

    const key = String(r[kIdx]);
    const type = String(r[tIdx]);
    const platform = String(r[pIdx]) as "Desktop" | "Mobile";

    const history: Record<string, number | ""> = {};
    baselineDates.forEach(d => {
      const m = historyMap[`${key}|${type}|${d}`];
      history[d] =
        platform === "Desktop" ? m?.desktop ?? "" : m?.mobile ?? "";
    });

    const rec: AlertRow = {
      key,
      type,
      platform,
      value: Number(r[vIdx]),
      lower: Number(r[lIdx]),
      upper: Number(r[uIdx]),
      change: Number(r[chIdx]),
      alert: String(r[aIdx]),
      description: descMap[key] ?? "",
      history
    };

    platform === "Desktop" ? desktop.push(rec) : mobile.push(rec);
  });

  if (!desktop.length && !mobile.length) {
    return { sendEmail: "No", subject: "", htmlBody: "" };
  }

  // ================================
  // HTML HELPERS
  // ================================
  const th = `style="background:#DCEFFF;font-weight:700;padding:6px;border:1px solid #000;text-align:center;"`;
  const td = `style="padding:6px;border:1px solid #000;text-align:center;"`;

  const fmtExpected = (l: number, u: number) =>
    `${Math.round(l)} → ${Math.round(u)}`;

  const fmtChange = (v: number) =>
    v > 0
      ? `<span style="color:green;">▲ +${v.toFixed(2)}%</span>`
      : v < 0
        ? `<span style="color:red;">▼ -${Math.abs(v).toFixed(2)}%</span>`
        : "0%";

  // ================================
  // BUILD TABLE
  // ================================
  function buildTable(title: string, arr: AlertRow[]): string {
    if (!arr.length) return "";

    let html = `
      <h3 style="margin-top:24px;">${title}</h3>
      <table style="border-collapse:collapse;">
        <tr>
          <th ${th}>Parameter</th>
          <th ${th}>Type</th>
          <th ${th}>${fmtDate(latestISO)}</th>
    `;

    baselineDates.forEach(d => {
      html += `<th ${th}>${fmtDate(d)}</th>`;
    });

    html += `
          <th ${th}>Expected Range</th>
          <th ${th}>Change</th>
          <th ${th}>Alert Level</th>
          <th ${th}>Description</th>
        </tr>
    `;

    arr.forEach(r => {
      html += `
        <tr>
          <td ${td}>${r.key}</td>
          <td ${td}>${r.type}</td>
          <td ${td}>${r.value}</td>
      `;

      baselineDates.forEach(d => {
        html += `<td ${td}>${r.history[d]}</td>`;
      });

      html += `
          <td ${td}>${fmtExpected(r.lower, r.upper)}</td>
          <td ${td}>${fmtChange(r.change)}</td>
          <td ${td}>${r.alert}</td>
          <td ${td} style="text-align:left;">${r.description}</td>
        </tr>
      `;
    });

    return html + "</table>";
  }

  // ================================
  // FINAL EMAIL
  // ================================
  const htmlBody = `
    <p>Hi Team,</p>

    <p>Below is the alert summary for parameter usage anomalies detected on <b>${fmtDate(latestISO)}</b>.</p>

    ${buildTable("Desktop Alerts", desktop)}
    ${buildTable("Mobile Alerts", mobile)}

    <p style="font-size:12px; color:#555;">
      <b>Note:</b> Historical date columns represent same-weekday values
      used to compute the baseline (Median + MAD).
    </p>
  `;

  return {
    sendEmail: "Yes",
    subject: `URL Parameter Anomaly Alert – Desktop: ${desktop.length} | Mobile: ${mobile.length} – ${fmtDate(latestISO)}`,
    htmlBody
  };
}