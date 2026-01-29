export function parseCsvText(text) {
  if (!text) return { headers: [], rows: [] };

  const lines = String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(nonEmpty[0]);
  const rows = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cols = parseCsvLine(nonEmpty[i]);
    while (cols.length < headers.length) cols.push("");
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }

  return { headers, rows };
}

export function parseCsvLine(line) {
  const s = String(line);
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQ = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export function parseContentDispositionFilename(cd) {
  if (!cd) return null;

  const m1 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  if (m1?.[1]) return decodeURIComponent(m1[1].trim().replace(/(^"|"$)/g, ""));

  const m2 = /filename\s*=\s*("?)([^";]+)\1/i.exec(cd);
  if (m2?.[2]) return m2[2].trim();

  return null;
}