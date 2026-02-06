import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, apiFetchBlob } from "../api/client";

import "./adminDashboard/styles/base.css";
import "./adminDashboard/styles/report.css";

function formatMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days >= 0 ? days : null;
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
  const [qiReportMonth, setQiReportMonth] = useState("");

  const [qiQuotRef, setQiQuotRef] = useState("");
  const [qiLocation, setQiLocation] = useState("");
  const [qiDescription, setQiDescription] = useState("");
  const [qiTotalBeforeGst, setQiTotalBeforeGst] = useState("");
  const [qiQuotStatus, setQiQuotStatus] = useState("Pending");
  const [qiWorkStatus, setQiWorkStatus] = useState("Scheduling");
  const [qiInvoiceStatus, setQiInvoiceStatus] = useState("Pending due to Svc report");
  const [qiInvoiceDate, setQiInvoiceDate] = useState("");
  const [qiInvoiceRef, setQiInvoiceRef] = useState("");
  const [qiPaymentStatus, setQiPaymentStatus] = useState("Pending");
  const [qiReceivedDate, setQiReceivedDate] = useState("");

  async function loadQuotationInvoices() {
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
  }

  async function createQuotationInvoice(e) {
    e.preventDefault();
    setErr("");
    setQiBusy(true);
    try {
      const body = {
        quotRef: qiQuotRef || null,
        location: qiLocation || null,
        description: qiDescription || null,
        totalBeforeGst: Number(qiTotalBeforeGst || 0),
        quotStatus: qiQuotStatus,
        workStatus: qiWorkStatus,
        invoiceStatus: qiInvoiceStatus,
        invoiceDate: qiInvoiceDate || null,
        invoiceRef: qiInvoiceRef || null,
        paymentStatus: qiPaymentStatus,
        receivedDate: qiReceivedDate || null,
      };
      await apiFetch("/api/QuotationInvoices", { method: "POST", auth: true, body });
      setQiQuotRef("");
      setQiLocation("");
      setQiDescription("");
      setQiTotalBeforeGst("");
      setQiInvoiceDate("");
      setQiInvoiceRef("");
      setQiReceivedDate("");
      await loadQuotationInvoices();
    } catch (e) {
      const msg = e?.message || "Failed to create record";
      setErr(msg);
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
      const msg = e?.message || "Failed to update record";
      setErr(msg);
    } finally {
      setQiBusy(false);
    }
  }

  async function downloadQuotationReport(format) {
    if (!qiReportMonth) {
      setErr("Please select report month.");
      return;
    }
    const url = `/api/QuotationInvoices/report?month=${encodeURIComponent(qiReportMonth)}&format=${encodeURIComponent(format)}`;
    if (format === "html") {
      window.open(url, "_blank");
      return;
    }
    const { blob, contentDisposition } = await apiFetchBlob(url, { method: "GET", auth: true });
    const nameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition || "");
    const name = nameMatch?.[1] || `quotation-invoice-${qiReportMonth}.csv`;
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
  }

  useEffect(() => {
    loadQuotationInvoices();
  }, []);

  const filteredRows = useMemo(() => {
    return quotationInvoices.filter((r) => {
      const s = qiSearch.trim().toLowerCase();
      if (s) {
        if (!String(r.quotRef || "").toLowerCase().includes(s)
          && !String(r.location || "").toLowerCase().includes(s)
          && !String(r.invoiceRef || "").toLowerCase().includes(s)) return false;
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
    let overdueAmount = 0;
    let b0_30 = 0;
    let b31_60 = 0;
    let b61 = 0;

    for (const r of filteredRows) {
      const amt = Number(r.totalBeforeGst || 0);
      totalAmount += amt;
      if (r.invoiceStatus === "Pending due to Svc report") pendingInvoices += 1;
      if (r.paymentStatus === "Received") receivedCount += 1;

      const days = daysSince(r.invoiceDate);
      const b0 = days != null && days >= 0 && days <= 30 ? amt : 0;
      const b31 = days != null && days >= 31 && days <= 60 ? amt : 0;
      const b6 = days != null && days >= 61 ? amt : 0;
      const due = (r.paymentStatus === "Received") ? 0 : (b0 + b31 + b6);

      b0_30 += b0;
      b31_60 += b31;
      b61 += b6;
      overdueAmount += due;
    }

    const maxBucket = Math.max(1, b0_30, b31_60, b61);
    return {
      totalAmount,
      pendingInvoices,
      receivedCount,
      overdueAmount,
      b0_30,
      b31_60,
      b61,
      maxBucket,
      totalRecords: filteredRows.length,
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
              <div className="we-admin-sub">Create, track, and report</div>
            </div>

            <button className="we-btn" onClick={loadQuotationInvoices} disabled={qiBusy}>
              {qiBusy ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {err ? <div className="we-admin-error">{err}</div> : null}

        <div className="we-glass-card">
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Create Record</div>
              <div className="we-admin-sectionMeta">Quotation + Invoice tracking</div>
            </div>
          </div>

          <form onSubmit={createQuotationInvoice} className="we-a-form we-a-grid2" style={{ marginTop: 12 }}>
            <label className="we-a-label">Quot Ref<div className="we-input"><span className="we-icon">#️⃣</span><input value={qiQuotRef} onChange={(e) => setQiQuotRef(e.target.value)} /></div></label>
            <label className="we-a-label">Location<div className="we-input"><span className="we-icon">📍</span><input value={qiLocation} onChange={(e) => setQiLocation(e.target.value)} /></div></label>
            <label className="we-a-label">Description<div className="we-input"><span className="we-icon">🧾</span><input value={qiDescription} onChange={(e) => setQiDescription(e.target.value)} /></div></label>
            <label className="we-a-label">TTL Amount bef GST<div className="we-input"><span className="we-icon">💰</span><input value={qiTotalBeforeGst} onChange={(e) => setQiTotalBeforeGst(e.target.value)} inputMode="decimal" /></div></label>
            <label className="we-a-label">Quot Status<select className="we-select" value={qiQuotStatus} onChange={(e) => { const v = e.target.value; setQiQuotStatus(v); if (v === "Rejected") { applyRejectionDefaults({ setWorkStatus: setQiWorkStatus, setInvoiceStatus: setQiInvoiceStatus, setPaymentStatus: setQiPaymentStatus, setInvoiceDate: setQiInvoiceDate, setInvoiceRef: setQiInvoiceRef, setReceivedDate: setQiReceivedDate }); } }}><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select></label>
            <label className="we-a-label">Work Status<select className="we-select" value={qiWorkStatus} onChange={(e) => setQiWorkStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Scheduling">Scheduling</option><option value="Completed">Completed</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Status<select className="we-select" value={qiInvoiceStatus} onChange={(e) => setQiInvoiceStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Pending due to Svc report">Pending due to Svc report</option><option value="Submitted">Submitted</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Date<input type="date" value={qiInvoiceDate} onChange={(e) => setQiInvoiceDate(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></label>
            <label className="we-a-label">Invoice Ref<div className="we-input"><span className="we-icon">🧾</span><input value={qiInvoiceRef} onChange={(e) => setQiInvoiceRef(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></div></label>
            <label className="we-a-label">Payment Status<select className="we-select" value={qiPaymentStatus} onChange={(e) => setQiPaymentStatus(e.target.value)} disabled={qiQuotStatus === "Rejected"}><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Received Date<input type="date" value={qiReceivedDate} onChange={(e) => setQiReceivedDate(e.target.value)} disabled={qiQuotStatus === "Rejected"} /></label>
            <button className="we-btn" type="submit" disabled={qiBusy}>{qiBusy ? "Saving…" : "Create"}</button>
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
            <label className="we-a-label">Search<div className="we-input"><span className="we-icon">🔎</span><input value={qiSearch} onChange={(e) => setQiSearch(e.target.value)} /></div></label>
            <label className="we-a-label">Location<div className="we-input"><span className="we-icon">📍</span><input value={qiFilterLocation} onChange={(e) => setQiFilterLocation(e.target.value)} /></div></label>
            <label className="we-a-label">Quot Status<select className="we-select" value={qiFilterQuotStatus} onChange={(e) => setQiFilterQuotStatus(e.target.value)}><option value="All">All</option><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select></label>
            <label className="we-a-label">Work Status<select className="we-select" value={qiFilterWorkStatus} onChange={(e) => setQiFilterWorkStatus(e.target.value)}><option value="All">All</option><option value="Completed">Completed</option><option value="Scheduling">Scheduling</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice Status<select className="we-select" value={qiFilterInvoiceStatus} onChange={(e) => setQiFilterInvoiceStatus(e.target.value)}><option value="All">All</option><option value="Submitted">Submitted</option><option value="Pending due to Svc report">Pending due to Svc report</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Payment Status<select className="we-select" value={qiFilterPaymentStatus} onChange={(e) => setQiFilterPaymentStatus(e.target.value)}><option value="All">All</option><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></label>
            <label className="we-a-label">Invoice From<input type="date" value={qiFilterFrom} onChange={(e) => setQiFilterFrom(e.target.value)} /></label>
            <label className="we-a-label">Invoice To<input type="date" value={qiFilterTo} onChange={(e) => setQiFilterTo(e.target.value)} /></label>
            <label className="we-a-label">Report Month<input type="month" value={qiReportMonth} onChange={(e) => setQiReportMonth(e.target.value)} /></label>
            <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("csv")}>Download Excel (CSV)</button>
            <button className="we-btn-soft" type="button" onClick={() => downloadQuotationReport("html")}>Open PDF (Print)</button>
          </div>
        </div>


        <div className="we-glass-card" style={{ marginTop: 14 }}>
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Summary</div>
              <div className="we-admin-sectionMeta">Based on current filters</div>
            </div>
          </div>

          <div className="we-qi-summary">
            <div className="we-qi-card">
              <div className="we-qi-label">Total Records</div>
              <div className="we-qi-value">{summary.totalRecords}</div>
            </div>
            <div className="we-qi-card">
              <div className="we-qi-label">Total Amount</div>
              <div className="we-qi-value">{formatMoney(summary.totalAmount)}</div>
            </div>
            <div className="we-qi-card">
              <div className="we-qi-label">Pending Invoices</div>
              <div className="we-qi-value">{summary.pendingInvoices}</div>
            </div>
            <div className="we-qi-card">
              <div className="we-qi-label">Received</div>
              <div className="we-qi-value">{summary.receivedCount}</div>
            </div>
            <div className="we-qi-card">
              <div className="we-qi-label">Total Due</div>
              <div className="we-qi-value">{formatMoney(summary.overdueAmount)}</div>
            </div>
          </div>

          <div className="we-qi-chart">
            <div className="we-qi-barRow">
              <div className="we-qi-barLabel">0–30 days</div>
              <div className="we-qi-barTrack">
                <div className="we-qi-barFill green" style={{ width: `${Math.round((summary.b0_30 / summary.maxBucket) * 100)}%` }} />
              </div>
              <div className="we-qi-barValue">{formatMoney(summary.b0_30)}</div>
            </div>
            <div className="we-qi-barRow">
              <div className="we-qi-barLabel">31–60 days</div>
              <div className="we-qi-barTrack">
                <div className="we-qi-barFill amber" style={{ width: `${Math.round((summary.b31_60 / summary.maxBucket) * 100)}%` }} />
              </div>
              <div className="we-qi-barValue">{formatMoney(summary.b31_60)}</div>
            </div>
            <div className="we-qi-barRow">
              <div className="we-qi-barLabel">61+ days</div>
              <div className="we-qi-barTrack">
                <div className="we-qi-barFill red" style={{ width: `${Math.round((summary.b61 / summary.maxBucket) * 100)}%` }} />
              </div>
              <div className="we-qi-barValue">{formatMoney(summary.b61)}</div>
            </div>
          </div>
        </div>
        <div className="we-glass-card" style={{ marginTop: 14 }}>
          <div className="we-admin-sectionHead">
            <div>
              <div className="we-admin-sectionTitle">Records</div>
              <div className="we-admin-sectionMeta">Auto-zero due when Payment = Received</div>
            </div>
          </div>

          <div className="we-admin-tableWrap" style={{ marginTop: 12 }}>
            <table className="we-admin-table">
              <thead>
                <tr>
                  <th>Quot Ref</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>TTL Amount bef GST</th>
                  <th>Quot Status</th>
                  <th>Work Status</th>
                  <th>Invoice Status</th>
                  <th>Invoice Date</th>
                  <th>Invoice Ref</th>
                  <th>0-30 days</th>
                  <th>31-60 days</th>
                  <th>61+ days</th>
                  <th>TTL Due Amount</th>
                  <th>Payment Status</th>
                  <th>Received Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const days = daysSince(r.invoiceDate);
                  const amt = Number(r.totalBeforeGst || 0);
                  const b0_30 = days != null && days >= 0 && days <= 30 ? amt : 0;
                  const b31_60 = days != null && days >= 31 && days <= 60 ? amt : 0;
                  const b61 = days != null && days >= 61 ? amt : 0;
                  const ttlDue = (r.paymentStatus === "Received") ? 0 : (b0_30 + b31_60 + b61);
                  return (
                    <tr key={r.id}>
                      <td>{r.quotRef || "—"}</td>
                      <td>{r.location || "—"}</td>
                      <td>{r.description || "—"}</td>
                      <td>{formatMoney(r.totalBeforeGst)}</td>
                      <td><select className="we-select" value={r.quotStatus || "Pending"} onChange={(e) => { const v = e.target.value; const patch = { quotStatus: v }; if (v === "Rejected") { patch.workStatus = "N/A"; patch.invoiceStatus = "N/A"; patch.paymentStatus = "N/A"; patch.invoiceDate = null; patch.invoiceRef = null; patch.receivedDate = null; } updateQuotationInvoice(r.id, patch); }}><option value="Approved">Approved</option><option value="Pending">Pending</option><option value="Rejected">Rejected</option></select></td>
                      <td><select className="we-select" value={r.workStatus || "Scheduling"} onChange={(e) => updateQuotationInvoice(r.id, { workStatus: e.target.value })} disabled={r.quotStatus === "Rejected"}><option value="Scheduling">Scheduling</option><option value="Completed">Completed</option><option value="N/A">N/A</option></select></td>
                      <td><select className="we-select" value={r.invoiceStatus || "Pending due to Svc report"} onChange={(e) => updateQuotationInvoice(r.id, { invoiceStatus: e.target.value })} disabled={r.quotStatus === "Rejected"}><option value="Pending due to Svc report">Pending due to Svc report</option><option value="Submitted">Submitted</option><option value="N/A">N/A</option></select></td>
                      <td><input type="date" value={r.invoiceDate || ""} onChange={(e) => updateQuotationInvoice(r.id, { invoiceDate: e.target.value })} disabled={r.quotStatus === "Rejected"} /></td>
                      <td><input value={r.invoiceRef || ""} onChange={(e) => updateQuotationInvoice(r.id, { invoiceRef: e.target.value })} disabled={r.quotStatus === "Rejected"} /></td>
                      <td>{formatMoney(b0_30)}</td>
                      <td>{formatMoney(b31_60)}</td>
                      <td>{formatMoney(b61)}</td>
                      <td>{formatMoney(ttlDue)}</td>
                      <td><select className="we-select" value={r.paymentStatus || "Pending"} onChange={(e) => updateQuotationInvoice(r.id, { paymentStatus: e.target.value })} disabled={r.quotStatus === "Rejected"}><option value="Pending">Pending</option><option value="Received">Received</option><option value="N/A">N/A</option></select></td>
                      <td><input type="date" value={r.receivedDate || ""} onChange={(e) => updateQuotationInvoice(r.id, { receivedDate: e.target.value })} disabled={r.quotStatus === "Rejected"} /></td>
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
