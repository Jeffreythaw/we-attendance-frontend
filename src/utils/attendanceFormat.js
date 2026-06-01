export function asMinutes(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function formatDurationMinutes(mins) {
  const m = asMinutes(mins);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

export function hasReportMetrics(row) {
  return !!row && (
    row?.reportWorkedMinutes != null ||
    row?.ReportWorkedMinutes != null ||
    row?.reportOtMinutes != null ||
    row?.ReportOtMinutes != null ||
    row?.reportMonFriOtMinutes != null ||
    row?.ReportMonFriOtMinutes != null ||
    row?.reportSatOtMinutes != null ||
    row?.ReportSatOtMinutes != null ||
    row?.reportSunPhOtMinutes != null ||
    row?.ReportSunPhOtMinutes != null ||
    row?.reportOvernightOtMinutes != null ||
    row?.ReportOvernightOtMinutes != null
  );
}

export function pickReportOtMinutes(row) {
  if (!row) return 0;

  const reportOt = Number(row?.reportOtMinutes ?? row?.ReportOtMinutes);
  if (Number.isFinite(reportOt)) return asMinutes(reportOt);

  const split = Number(row?.reportMonFriOtMinutes ?? row?.ReportMonFriOtMinutes ?? 0)
    + Number(row?.reportSatOtMinutes ?? row?.ReportSatOtMinutes ?? 0)
    + Number(row?.reportSunPhOtMinutes ?? row?.ReportSunPhOtMinutes ?? 0)
    + Number(row?.reportOvernightOtMinutes ?? row?.ReportOvernightOtMinutes ?? 0);
  if (Number.isFinite(split) && split > 0) return asMinutes(split);

  return asMinutes(row?.otMinutes ?? row?.OtMinutes ?? row?.otMins ?? row?.overtimeMinutes ?? row?.overtimeMins ?? row?.totalOtMinutes ?? row?.ot);
}

export function pickReportWorkedMinutes(row) {
  if (!row) return 0;
  const reportWorked = Number(row?.reportWorkedMinutes ?? row?.ReportWorkedMinutes);
  if (Number.isFinite(reportWorked)) return asMinutes(reportWorked);
  return asMinutes(row?.regularMinutes ?? row?.RegularMinutes) + pickReportOtMinutes(row);
}

export function pickReportMonFriOtMinutes(row) {
  return asMinutes(row?.reportMonFriOtMinutes ?? row?.ReportMonFriOtMinutes);
}

export function pickReportSatOtMinutes(row) {
  return asMinutes(row?.reportSatOtMinutes ?? row?.ReportSatOtMinutes);
}

export function pickReportSunPhOtMinutes(row) {
  return asMinutes(row?.reportSunPhOtMinutes ?? row?.ReportSunPhOtMinutes);
}

export function pickReportOvernightOtMinutes(row) {
  return asMinutes(row?.reportOvernightOtMinutes ?? row?.ReportOvernightOtMinutes);
}
