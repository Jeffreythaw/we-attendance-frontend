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
