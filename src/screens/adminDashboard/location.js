export function fmtLatLng(lat, lng) {
  if (lat == null || lng == null) return "—";
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${a.toFixed(6)}, ${b.toFixed(6)}`;
}

export function mapUrl(lat, lng) {
  if (lat == null || lng == null) return "#";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}