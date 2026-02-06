import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchBlob } from "../api/client";

import "./adminDashboard/styles/base.css";
import "./adminDashboard/styles/report.css";

function formatMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function addDaysIso(isoDate, days) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
}

function clampTerm(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  return Math.max(0, Math.min(3650, Math.round(n)));
}

function computeAging(rowLike) {
  const amt = Number(rowLike?.totalBeforeGst || 0);
  const term = clampTerm(rowLike?.paymentTermDays ?? 30);
  const invoiceDate = rowLike?.invoiceDate || "";
  const dueDate = invoiceDate ? addDaysIso(invoiceDate, term) : "";
  const status = String(rowLike?.quotStatus || "Pending");
  const payStatus = String(rowLike?.paymentStatus || "Pending");
  const isRejected = status === "Rejected";
  const isReceived = payStatus === "Received";

  let current = 0;
  let od0_30 = 0;
  let od31_60 = 0;
  let od61 = 0;

  const ageDays = daysSince(invoiceDate);
  if (!isRejected && !isReceived && ageDays != null) {
    if (ageDays <= term) {
      current = amt;
    } else {
      const overdueDays = ageDays - term;
      if (overdueDays <= 30) od0_30 = amt;
      else if (overdueDays <= 60) od31_60 = amt;
      else od61 = amt;
    }
  }

  const ttlDue = current + od0_30 + od31_60 + od61;
  const overdue = od0_30 + od31_60 + od61;

  return {
    term,
    dueDate,
    current,
    od0_30,
    od31_60,
    od61,
    overdue,
    ttlDue,
    isRejected,
    isReceived,
  };
}

function applyRejectionDefaults(setters) {
  const {
    setWorkStatus,
    setInvoiceStatus,
    setPaymentStatus,
    setInvoiceDate,
    setInvoiceRef,
    setReceivedDate,
  } = setters;
  setWorkStatus("N/A");
  setInvoiceStatus("N/A");
  setPaymentStatus("N/A");
  setInvoiceDate("");
  setInvoiceRef("");
  setReceivedDate("");
}

export default function AdminQuotations({ onAuthError }) {
  const [err, setErr] = useState("");
  const [qiBusy, setQiBusy] = useState(false);
  const [quotationInvoices, setQuotationInvoices] = useState([]);

  const [qiSearch, setQiSearch] = useState("");
  const [qiFilterQuotStatus, setQiFilterQuotStatus] = useState("All");
  const [qiFilterWorkStatus, setQiFilterWorkStatus] = useState("All");
  const [qiFilterInvoiceStatus, setQiFilterInvoiceStatus] = useState("All");
  const [qiFilterPaymentStatus, setQiFilterPaymentStatus] = useState("All");
  const [qiFilterLocation, setQiFilterLocation] = useState("");
  const [qiFilterFrom, setQiFilterFrom] = useState("");
  const [qiFilterTo, setQiFilterTo] = useState("");
  const [qiReportMonth, setQiReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  });
  const [reportBusy, setReportBusy] = useState(false);

  const [qiQuotRef, setQiQuotRef] = useState("");
  const [qiLocation, setQiLocation] = useState("");
  const [qiDescription, setQiDescription] = useState("");
  const [qiQuoteDate, setQiQuoteDate] = useState("");
  const [qiTotalBeforeGst, setQiTotalBeforeGst] = useState("");
  const [qiQuotStatus, setQiQuotStatus] = useState("Pending");
  const [qiWorkStatus, setQiWorkStatus] = useState("Scheduling");
  const [qiInvoiceStatus, setQiInvoiceStatus] = useState("Pending due to Svc report");
  const [qiInvoiceDate, setQiInvoiceDate] = useState("");
  const [qiInvoiceRef, setQiInvoiceRef] = useState("");
  const [qiPaymentTermDays, setQiPaymentTermDays] = useState("30");
  const [qiPaymentStatus, setQiPaymentStatus] = useState("Pending");
  const [qiReceivedDate, setQiReceivedDate] = useState("");

  const [editId, setEditId] = useState(null);
  const [editDrafts, setEditDrafts] = useState({});

  const loadQuotationInvoices = useCallback(async () => {
    setErr("");
    setQiBusy(true);
    try {
      const data = await apiFetch("/api/QuotationInvoices", { method: "GET", auth: true });
      setQuotationInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || "Failed to load quotation/invoice records";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setQiBusy(false);
    }
  }, [onAuthError]);

  async function createQuotationInvoice(e) {
    e.preventDefault();
    setErr("");
    setQiBusy(true);
    try {
      const body = {
        quotRef: qiQuotRef || null,
        location: qiLocation || null,
        description: qiDescription || null,
        quoteDate: qiQuoteDate || null,
        totalBeforeGst: Number(qiTotalBeforeGst || 0),
        quotStatus: qiQuotStatus,
        workStatus: qiWorkStatus,
        invoiceStatus: qiInvoiceStatus,
        invoiceDate: qiInvoiceDate || null,
        invoiceRef: qiInvoiceRef || null,
        paymentTermDays: clampTerm(qiPaymentTermDays),
        paymentStatus: qiPaymentStatus,
        receivedDate: qiReceivedDate || null,
      };
      await apiFetch("/api/QuotationInvoices", { method: "POST", auth: true, body });

      setQiQuotRef("");
      setQiLocation("");
      setQiDescription("");
      setQiQuoteDate("");
      setQiTotalBeforeGst("");
      setQiInvoiceDate("");
      setQiInvoiceRef("");
      setQiPaymentTermDays("30");
      setQiReceivedDate("");

      await loadQuotationInvoices();
    } catch (e) {
      setErr(e?.message || "Failed to create record");
    } finally {
      setQiBusy(false);
    }
  }

  async function updateQuotationInvoice(id, patch) {
    if (!id) return;
    setErr("");
    setQiBusy(true);
    try {
      await apiFetch(`/api/QuotationInvoices/${id}`, { method: "PUT", auth: true, body: patch });
      await loadQuotationInvoices();
    } catch (e) {
      setErr(e?.message || "Failed to update record");
    } finally {
      setQiBusy(false);
    }
  }

  function startEdit(row) {
    if (!row?.id) return;
    setEditDrafts((prev) => ({
      ...prev,
      [row.id]: {
        quotRef: row.quotRef || "",
        location: row.location || "",
        description: row.description || "",
        quoteDate: row.quoteDate || "",
        totalBeforeGst: String(row.totalBeforeGst ?? ""),
        quotStatus: row.quotStatus || "Pending",
        workStatus: row.workStatus || "Scheduling",
        invoiceStatus: row.invoiceStatus || "Pending due to Svc report",
        invoiceDate: row.invoiceDate || "",
        invoiceRef: row.invoiceRef || "",
        paymentTermDays: String(row.paymentTermDays ?? 30),
        paymentStatus: row.paymentStatus || "Pending",
        receivedDate: row.receivedDate || "",
      },
    }));
    setEditId(row.id);
  }

  function updateDraft(id, patch) {
    setEditDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function cancelEdit(id) {
    setEditId(null);
    setEditDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(id) {
    const d = editDrafts[id];
    if (!d) return;
    await updateQuotationInvoice(id, {
      quotRef: d.quotRef || null,
      location: d.location || null,
      description: d.description || null,
      quoteDate: d.quoteDate || null,
      totalBeforeGst: Number(d.totalBeforeGst || 0),
      quotStatus: d.quotStatus,
      workStatus: d.workStatus,
      invoiceStatus: d.invoiceStatus,
      invoiceDate: d.invoiceDate || null,
      invoiceRef: d.invoiceRef || null,
      paymentTermDays: clampTerm(d.paymentTermDays),
      paymentStatus: d.paymentStatus,
      receivedDate: d.receivedDate || null,
    });
    cancelEdit(id);
  }

  async function downloadQuotationReport(format) {
    if (!qiReportMonth) {
      setErr("Please select report month.");
      return;
    }

    setErr("");
    setReportBusy(true);
    try {
      const url = `/api/QuotationInvoices/report?month=${encodeURIComponent(qiReportMonth)}&format=${encodeURIComponent(format)}`;
      const { blob, contentDisposition } = await apiFetchBlob(url, { method: "GET", auth: true });

      const isHtml = format === "html";
      const fallbackName = isHtml
        ? `quotation-invoice-${qiReportMonth}.html`
        : `quotation-invoice-${qiReportMonth}.csv`;

      const nameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition || "");
      const name = nameMatch?.[1] || fallbackName;

      const fileUrl = URL.createObjectURL(blob);
      if (isHtml) {
        const w = window.open(fileUrl, "_blank", "noopener,noreferrer");
        if (!w) {
          setErr("Popup blocked. Please allow popups and try again.");
        }
        setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
        return;
      }

      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (e) {
      const msg = e?.message || "Failed to generate report";
      setErr(msg);
      if (String(msg).includes("401") || String(msg).includes("403")) onAuthError?.();
    } finally {
      setReportBusy(false);
    }
  }

  useEffect(() => {
    loadQuotationInvoices();
  }, [loadQuotationInvoices]);

  const filteredRows = useMemo(() => {
    return quotationInvoices.filter((r) => {
      const s = qiSearch.trim().toLowerCase();
      if (s) {
        if (!String(r.quotRef || "").toLowerCase().includes(s)
          && !String(r.location || "").toLowerCase().includes(s)
          && !String(r.invoiceRef || "").toLowerCase().includes(s)) {
          return false;
        }
      }
      if (qiFilterLocation && !String(r.location || "").toLowerCase().includes(qiFilterLocation.trim().toLowerCase())) return false;
      if (qiFilterQuotStatus !== "All" && r.quotStatus !== qiFilterQuotStatus) return false;
      if (qiFilterWorkStatus !== "All" && r.workStatus !== qiFilterWorkStatus) return false;
      if (qiFilterInvoiceStatus !== "All" && r.invoiceStatus !== qiFilterInvoiceStatus) return false;
      if (qiFilterPaymentStatus !== "All" && r.paymentStatus !== qiFilterPaymentStatus) return false;
      if (qiFilterFrom && (!r.invoiceDate || r.invoiceDate < qiFilterFrom)) return false;
      if (qiFilterTo && (!r.invoiceDate || r.invoiceDate > qiFilterTo)) return false;
      return true;
    });
  }, [
    quotationInvoices,
    qiSearch,
    qiFilterLocation,
    qiFilterQuotStatus,
    qiFilterWorkStatus,
    qiFilterInvoiceStatus,
    qiFilterPaymentStatus,
    qiFilterFrom,
    qiFilterTo,
  ]);

  const summary = useMemo(() => {
    let totalAmount = 0;
    let pendingInvoices = 0;
    let receivedCount = 0;

    let currentAmount = 0;
    let od0_30 = 0;
    let od31_60 = 0;
    let od61 = 0;

    let approved = 0;
    let pending = 0;
    let revise = 0;
    let rejected = 0;

    let approvedAmount = 0;
    let pendingAmount = 0;
    let reviseAmount = 0;
    let rejectedAmount = 0;

    for (const r of filteredRows) {
      const amt = Number(r.totalBeforeGst || 0);
      const status = String(r.quotStatus || "Pending");

      if (status === "Approved") {
        approved += 1;
        approvedAmount += amt;
      } else if (status === "Revise") {
        revise += 1;
        reviseAmount += amt;
      } else if (status === "Rejected") {
        rejected += 1;
        rejectedAmount += amt;
      } else {
        pending += 1;
        pendingAmount += amt;
      }

      if (status !== "Rejected") totalAmount += amt;
      if (status !== "Rejected" && r.invoiceStatus === "Pending due to Svc report") pendingInvoices += 1;
      if (status !== "Rejected" && r.paymentStatus === "Received") receivedCount += 1;

      const aging = computeAging(r);
      currentAmount += aging.current;
      od0_30 += aging.od0_30;
      od31_60 += aging.od31_60;
      od61 += aging.od61;
    }

    const overdueAmount = od0_30 + od31_60 + od61;
    const ttlDueAmount = currentAmount + overdueAmount;

    const totalStatus = approved + pending + revise + rejected;
    const approvedRate = totalStatus > 0 ? Math.round((approved / totalStatus) * 100) : 0;
    const pendingRate = totalStatus > 0 ? Math.round((pending / totalStatus) * 100) : 0;
    const reviseRate = totalStatus > 0 ? Math.round((revise / totalStatus) * 100) : 0;
    const rejectedRate = totalStatus > 0 ? Math.round((rejected / totalStatus) * 100) : 0;

    const statusA = (approved / Math.max(1, totalStatus)) * 100;
    const statusP = (pending / Math.max(1, totalStatus)) * 100;
    const statusR = (revise / Math.max(1, totalStatus)) * 100;

    const statusStops = {
      a: statusA,
      p: statusA + statusP,
      r: statusA + statusP + statusR,
    };

    const agingTotal = currentAmount + od0_30 + od31_60 + od61;
    const agingC = (currentAmount / Math.max(1, agingTotal)) * 100;
    const aging0 = (od0_30 / Math.max(1, agingTotal)) * 100;
    const aging1 = (od31_60 / Math.max(1, agingTotal)) * 100;

    const agingStops = {
      c: agingC,
      a0: agingC + aging0,
      a1: agingC + aging0 + aging1,
    };

    const amountSpreadTotal = approvedAmount + reviseAmount + rejectedAmount;
    const amountA = (approvedAmount / Math.max(1, amountSpreadTotal)) * 100;
    const amountR = (reviseAmount / Math.max(1, amountSpreadTotal)) * 100;

    const amountStops = {
      t0: amountA,
      t1: amountA + amountR,
    };

    return {
      totalRecords: filteredRows.length,
      totalAmount,
      pendingInvoices,
      receivedCount,
      ttlDueAmount,
      overdueAmount,
      currentAmount,
      od0_30,
      od31_60,
      od61,
      approved,
      pending,
      revise,
      rejected,
      approvedAmount,
      pendingAmount,
      reviseAmount,
      rejectedAmount,
      approvedRate,
      pendingRate,
      reviseRate,
      rejectedRate,
      statusStops,
      agingStops,
      amountStops,
    };
  }, [filteredRows]);

  return (
    <div className="we-admin-root">
      <div className="we-admin-bg" aria-hidden="true">
        <div className="we-admin-blob we-admin-blob-1" />
        <div className="we-admin-blob we-admin-blob-2" />
        <div className="we-admin-blob we-admin-blob-3" />
        <div className="we-admin-noise" />
      </div>

      <div className="we-admin-wrap">
        <div className="we-admin-sticky">
          <div className="we-admin-head">
            <div>
              <div className="we-admin-kicker">Admin • finance</div>
              <div className="we-admin-title">Quotations & Invoices</div>
              <div className="we-admin-sub">Aging by customer payment term</div>
            </div>
            <button className="we-btn" onClick={loadQuotationInvoices} disabled={qiBusy}>
              {qiBusy ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {err ? <div className="we-admin-error">{err}</div> : null}

        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Create Record</div>
              <div className="we-admin-sectionMeta">Payment term is per customer / case</div>
            </div>
          </div>

          <form onSubmit={createQuotationInvoice} className="we-a-form we-a-grid2" style={{ marginTop: 12 }}>
            <label className="we-a-label">Quot Ref<div className="we-input"><span className="we-icon">#</span><input value={qiQuotRef} onChange={(e) => setQiQuotRef(e.target.value)} /></div></label>
            <label className="we-a-label">Location<div className="we-input"><span className="we-icon">L</span><input value={qiLocation} onChange={(e) => setQiLocation(e.target.value)} /></div></label>
            <label className="we-a-label">Description<div className="we-input"><span className="we-icon">D</span><input value={qiDescription} onChange={(e) => setQiDescription(e.target.value)} /></div></label>
            <label className="we-a-label">Quote Submit Date<input type="date" value={qiQuoteDate} onChange={(e) => setQiQuoteDate(e.target.value)} /></label>
            <label className="we-a-label">TTL Amount bef GST<div className="we-input"><span className="we-icon">$</span><input value={qiTotalBeforeGst} onChange={(e) => setQiTotalBeforeGst(e.target.value)} inputMode="decimal" /></div></label>
            <label className="we-a-label">Quot Status<select className="we-select" value={qiQuotStatus} onChange={(e) => {
              const v = e.target.value;
              setQiQuotStatus(v);
              if (v === "Rejected") {
                applyRejectionDefaults({
                  setWorkStatus: setQiWorkStatus,
                  setInvoiceStatus: setQiInvoiceStatus,
                  setPaymentStatus: setQiPaymentStatus,
                  setInvoiceDate: setQiInvoiceDate,
                  setInvoiceRef: setQiInvoiceRef,
                  setReceivedDate: setQiReceivedDate,
                });
              }
            }}><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Revise">Revise</option><option value="Rejected">Rejected</option></select></label>
            <label className="we-a-label">Work Status<select className="we-select" value={qiWorkStatus} onChange={(e) => setQiWorkStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Scheduling">Scheduling</option><option value="Completed">Completed</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Status<select className="we-select" value={qiInvoiceStatus} onChange={(e) => setQiInvoiceStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Pending due to Svc report">Pending due to Svc report</option><option value="Submitted">Submitted</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Date<input type="date" value={qiInvoiceDate} onChange={(e) => setQiInvoiceDate(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></label>
            <label className="we-a-label">Invoice Ref<div className="we-input"><span className="we-icon">R</span><input value={qiInvoiceRef} onChange={(e) => setQiInvoiceRef(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></div></label>
            <label className="we-a-label">Payment Term (days)<input type="number" min="0" max="3650" value={qiPaymentTermDays} onChange={(e) => setQiPaymentTermDays(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></label>
            <label className="we-a-label">Payment Status<select className="we-select" value={qiPaymentStatus} onChange={(e) => setQiPaymentStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Received Date<input type="date" value={qiReceivedDate} onChange={(e) => setQiReceivedDate(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></label>
            <button className="we-btn" type="submit" disabled={qiBusy}>{qiBusy ? "Saving..." : "Create"}</button>
          </form>
        </div>

        <div className="we-glass-card" style={{ marginTop: 14 }}>
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Filters & Reports</div>
              <div className="we-admin-sectionMeta">Monthly Excel/PDF + quick search</div>
            </div>
          </div>

          <div className="we-a-form we-a-grid2" style={{ marginTop: 12 }}>
            <label className="we-a-label">Search<div className="we-input"><span className="we-icon">S</span><input value={qiSearch} onChange={(e) => setQiSearch(e.target.value)} /></div></label>
            <label className="we-a-label">Location<div className="we-input"><span className="we-icon">L</span><input value={qiFilterLocation} onChange={(e) => setQiFilterLocation(e.target.value)} /></div></label>
            <label className="we-a-label">Quot Status<select className="we-select" value={qiFilterQuotStatus} onChange={(e) => setQiFilterQuotStatus(e.target.value)}><option value="All">All</option><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Revise">Revise</option><option value="Rejected">Rejected</option></select></label>
            <label className="we-a-label">Work Status<select className="we-select" value={qiFilterWorkStatus} onChange={(e) => setQiFilterWorkStatus(e.target.value)}><option value="All">All</option><option value="Completed">Completed</option><option value="Scheduling">Scheduling</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Status<select className="we-select" value={qiFilterInvoiceStatus} onChange={(e) => setQiFilterInvoiceStatus(e.target.value)}><option value="All">All</option><option value="Submitted">Submitted</option><option value="Pending due to Svc report">Pending due to Svc report</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Payment Status<select className="we-select" value={qiFilterPaymentStatus} onChange={(e) => setQiFilterPaymentStatus(e.target.value)}><option value="All">All</option><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice From<input type="date" value={qiFilterFrom} onChange={(e) => setQiFilterFrom(e.target.value)} /></label>
            <label className="we-a-label">Invoice To<input type="date" value={qiFilterTo} onChange={(e) => setQiFilterTo(e.target.value)} /></label>
            <label className="we-a-label">Report Month<input type="month" value={qiReportMonth} onChange={(e) => setQiReportMonth(e.target.value)} /></label>
            <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("csv")} disabled={reportBusy}>{reportBusy ? "Preparing..." : "Download Excel (CSV)"}</button>
            <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("html")} disabled={reportBusy}>{reportBusy ? "Preparing..." : "Open PDF (Print)"}</button>
          </div>
        </div>

        <div className="we-glass-card" style={{ marginTop: 14 }}>
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Summary</div>
              <div className="we-admin-sectionMeta">Aging is calculated against each quotation payment term</div>
            </div>
          </div>

          <div className="we-qi-summaryGrid">
            <div className="we-qi-panel">
              <div className="we-qi-panelHead">
                <div className="we-qi-panelTitle">Quote status</div>
                <div className="we-qi-panelSub">Approved, Pending, Revise, Rejected</div>
              </div>
              <div className="we-qi-donut multi" style={{
                "--ring": `conic-gradient(
                  #22c55e 0% ${summary.statusStops.a}%,
                  #f59e0b ${summary.statusStops.a}% ${summary.statusStops.p}%,
                  #a855f7 ${summary.statusStops.p}% ${summary.statusStops.r}%,
                  #ef4444 ${summary.statusStops.r}% 100%
                )`,
              }}>
                <div className="we-qi-donutCenter">
                  <div className="we-qi-donutPct">{summary.totalRecords}</div>
                  <div className="we-qi-donutLbl">Total quotes</div>
                </div>
              </div>
              <div className="we-qi-miniLegend">
                <div><span className="we-qi-dot green" /> Approved {summary.approved} ({summary.approvedRate}%)</div>
                <div><span className="we-qi-dot amber" /> Pending {summary.pending} ({summary.pendingRate}%)</div>
                <div><span className="we-qi-dot purple" /> Revise {summary.revise} ({summary.reviseRate}%)</div>
                <div><span className="we-qi-dot red" /> Rejected {summary.rejected} ({summary.rejectedRate}%)</div>
              </div>
            </div>

            <div className="we-qi-panel">
              <div className="we-qi-panelHead">
                <div className="we-qi-panelTitle">Aging buckets</div>
                <div className="we-qi-panelSub">Current vs overdue (term-based)</div>
              </div>
              <div className="we-qi-donut multi" style={{
                "--ring": `conic-gradient(
                  #22c55e 0% ${summary.agingStops.c}%,
                  #f59e0b ${summary.agingStops.c}% ${summary.agingStops.a0}%,
                  #fb923c ${summary.agingStops.a0}% ${summary.agingStops.a1}%,
                  #ef4444 ${summary.agingStops.a1}% 100%
                )`,
              }}>
                <div className="we-qi-donutCenter">
                  <div className="we-qi-donutPct">{formatMoney(summary.ttlDueAmount)}</div>
                  <div className="we-qi-donutLbl">Outstanding</div>
                </div>
              </div>
              <div className="we-qi-miniLegend">
                <div><span className="we-qi-dot green" /> Current: {formatMoney(summary.currentAmount)}</div>
                <div><span className="we-qi-dot amber" /> OD 0-30: {formatMoney(summary.od0_30)}</div>
                <div><span className="we-qi-dot" style={{ background: "#fb923c" }} /> OD 31-60: {formatMoney(summary.od31_60)}</div>
                <div><span className="we-qi-dot red" /> OD 61+: {formatMoney(summary.od61)}</div>
              </div>
            </div>

            <div className="we-qi-panel">
              <div className="we-qi-panelHead">
                <div className="we-qi-panelTitle">Totals</div>
                <div className="we-qi-panelSub">Amount spread by status</div>
              </div>
              <div className="we-qi-donut multi" style={{
                "--ring": `conic-gradient(
                  #22c55e 0% ${summary.amountStops.t0}%,
                  #a855f7 ${summary.amountStops.t0}% ${summary.amountStops.t1}%,
                  #ef4444 ${summary.amountStops.t1}% 100%
                )`,
              }}>
                <div className="we-qi-donutCenter">
                  <div className="we-qi-donutPct">{formatMoney(summary.approvedAmount)}</div>
                  <div className="we-qi-donutLbl">Approved amount</div>
                </div>
              </div>
              <div className="we-qi-miniLegend">
                <div><span className="we-qi-dot green" /> Approved: {formatMoney(summary.approvedAmount)}</div>
                <div><span className="we-qi-dot purple" /> Revise: {formatMoney(summary.reviseAmount)}</div>
                <div><span className="we-qi-dot red" /> Rejected: {formatMoney(summary.rejectedAmount)}</div>
                <div><span className="we-qi-dot amber" /> Pending amount: {formatMoney(summary.pendingAmount)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="we-glass-card" style={{ marginTop: 14 }}>
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Records</div>
              <div className="we-admin-sectionMeta">Term-based aging with Save/Cancel row editing</div>
            </div>
          </div>

          <div className="we-admin-tableWrap" style={{ marginTop: 12 }}>
            <table className="we-admin-table">
              <thead>
                <tr>
                  <th>Quot Ref</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Quote Date</th>
                  <th>TTL Amount bef GST</th>
                  <th>Quot Status</th>
                  <th>Work Status</th>
                  <th>Invoice Status</th>
                  <th>Invoice Date</th>
                  <th>Invoice Ref</th>
                  <th>Payment Term (days)</th>
                  <th>Due Date</th>
                  <th>Current</th>
                  <th>OD 0-30</th>
                  <th>OD 31-60</th>
                  <th>OD 61+</th>
                  <th>TTL Due Amount</th>
                  <th>Payment Status</th>
                  <th>Received Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const isEditing = editId === r.id;
                  const row = isEditing ? (editDrafts[r.id] || r) : r;
                  const aging = computeAging(row);

                  return (
                    <tr key={r.id} className={aging.isRejected ? "we-qi-rejected" : ""}>
                      <td>{row.quotRef || "-"}</td>
                      <td>{row.location || "-"}</td>
                      <td>{row.description || "-"}</td>
                      <td><input type="date" value={row.quoteDate || ""} onChange={(e) => updateDraft(r.id, { quoteDate: e.target.value })} disabled={!isEditing} /></td>
                      <td>{formatMoney(row.totalBeforeGst)}</td>
                      <td>
                        <div className="we-qi-statusCell">
                          <select className="we-select" value={row.quotStatus || "Pending"} disabled={!isEditing} onChange={(e) => {
                            const v = e.target.value;
                            const patch = { quotStatus: v };
                            if (v === "Rejected") {
                              patch.workStatus = "N/A";
                              patch.invoiceStatus = "N/A";
                              patch.paymentStatus = "N/A";
                              patch.invoiceDate = "";
                              patch.invoiceRef = "";
                              patch.receivedDate = "";
                            }
                            updateDraft(r.id, patch);
                          }}>
                            <option value="Approved">Approved</option>
                            <option value="Pending">Pending</option>
                            <option value="Revise">Revise</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                          {aging.isRejected ? <span className="we-qi-badge">Rejected</span> : null}
                        </div>
                      </td>
                      <td><select className="we-select" value={row.workStatus || "Scheduling"} onChange={(e) => updateDraft(r.id, { workStatus: e.target.value })} disabled={aging.isRejected || !isEditing}><option value="Scheduling">Scheduling</option><option value="Completed">Completed</option><option value="N/A">N/A</option></select></td>
                      <td><select className="we-select" value={row.invoiceStatus || "Pending due to Svc report"} onChange={(e) => updateDraft(r.id, { invoiceStatus: e.target.value })} disabled={aging.isRejected || !isEditing}><option value="Pending due to Svc report">Pending due to Svc report</option><option value="Submitted">Submitted</option><option value="N/A">N/A</option></select></td>
                      <td><input type="date" value={row.invoiceDate || ""} onChange={(e) => updateDraft(r.id, { invoiceDate: e.target.value })} disabled={aging.isRejected || !isEditing} /></td>
                      <td><input value={row.invoiceRef || ""} onChange={(e) => updateDraft(r.id, { invoiceRef: e.target.value })} disabled={aging.isRejected || !isEditing} /></td>
                      <td><input type="number" min="0" max="3650" value={row.paymentTermDays ?? 30} onChange={(e) => updateDraft(r.id, { paymentTermDays: e.target.value })} disabled={aging.isRejected || !isEditing} /></td>
                      <td>{aging.dueDate || "-"}</td>
                      <td>{formatMoney(aging.current)}</td>
                      <td>{formatMoney(aging.od0_30)}</td>
                      <td>{formatMoney(aging.od31_60)}</td>
                      <td>{formatMoney(aging.od61)}</td>
                      <td>{formatMoney(aging.ttlDue)}</td>
                      <td><select className="we-select" value={row.paymentStatus || "Pending"} onChange={(e) => updateDraft(r.id, { paymentStatus: e.target.value })} disabled={aging.isRejected || !isEditing}><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></td>
                      <td><input type="date" value={row.receivedDate || ""} onChange={(e) => updateDraft(r.id, { receivedDate: e.target.value })} disabled={aging.isRejected || !isEditing} /></td>
                      <td className="we-qi-actions">
                        {isEditing ? (
                          <>
                            <button className="we-qi-editBtn" type="button" onClick={() => saveEdit(r.id)}>Save</button>
                            <button className="we-qi-cancelBtn" type="button" onClick={() => cancelEdit(r.id)}>Cancel</button>
                          </>
                        ) : (
                          <button className="we-qi-editBtn" type="button" onClick={() => startEdit(r)}>Edit</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
