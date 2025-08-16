"use client";

import { useEffect, useState } from "react";

async function postJSON(path, body) {
  let res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (res.status === 405) {
    const query = new URLSearchParams(Object.entries(body)).toString();
    res = await fetch(`${path}?${query}`, { method: "GET" });
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(json?.error || json?.detail || text || `HTTP ${res.status}`);
  return json;
}

const a = (v) => Array.isArray(v) ? v : [];
const s = (v) => (v === null || v === undefined) ? "" : String(v);
const n = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
};
const euro = (v) => `€${n(v).toFixed(2)}`;
const gb = (v) => `${(n(v) / (1024 ** 3)).toFixed(2)} GB`;

function getICCID(sub) {
  const list = a(sub?.imsiList);
  if (!list.length) return "";
  return s(list[0]?.iccid);
}

function formatStatus(statusArray) {
  const arr = a(statusArray);
  if (!arr.length) return "";
  const current = arr.find(x => !x?.endDate)
    || arr.slice().sort((a, b) => s(b?.startDate).localeCompare(s(a?.startDate)))[0];
  const currentLabel = s(current?.status);
  const distinct = Array.from(new Set(arr.map(x => s(x?.status)).filter(Boolean)));
  return distinct.length > 1 ? `${currentLabel} (${distinct.join(" / ")})` : currentLabel;
}

function formatPackages(sub) {
  const candidates = a(sub?.packageList || sub?.packages || []);
  const names = candidates.map(p => s(p?.templateName || p?.prepaidPackageTemplateName)).filter(Boolean);
  return names.join(", ");
}

function cleanDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

async function fetchUsageForSubscriber(subscriberId) {
  try {
    const result = await postJSON("/api/ocs/usage-total", { subscriberId });
    return n(result?.totalBytes);
  } catch (e) {
    console.error("Usage error", e);
    return 0;
  }
}

export default function Dashboard() {
  const [accountId, setAccountId] = useState(3771);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const json = await postJSON("/api/ocs/list-subscribers", { accountId });
      const subscribers = json?.listSubscriber?.subscriberList || [];

      const withUsage = await Promise.all(subscribers.map(async (s) => {
        const usage = await fetchUsageForSubscriber(s.subscriberId);
        return { ...s, totalUsage: usage };
      }));

      setRows(withUsage);
    } catch (e) {
      setError(String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Teltrip Dashboard</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          type="number"
          value={accountId}
          onChange={(e) => setAccountId(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button onClick={loadList} style={{ padding: "8px 16px", background: "#22c55e", color: "#fff", border: 0, borderRadius: 6 }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#3a2030', color: '#ffd4d4', marginBottom: 16 }}>
          <strong>API error:</strong> {error}
        </div>
      )}

      <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.2fr',
          gap: '12px',
          padding: '12px 0',
          fontWeight: 'bold',
          color: '#aab4f9',
          borderBottom: '2px solid #2a3356'
        }}>
          <div>ID</div>
          <div>ICCID</div>
          <div>Package</div>
          <div>Activated</div>
          <div>Expires</div>
          <div>Last Usage</div>
          <div>Used</div>
          <div>Package Size</div>
          <div>Subscr. €</div>
          <div>Reseller €</div>
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.2fr',
            gap: '12px',
            borderBottom: '1px solid #2a3356',
            padding: '12px 0',
            fontSize: 14
          }}>
            <div>{s(r?.subscriberId)}</div>
            <div>{getICCID(r)}</div>
            <div>{formatPackages(r)}</div>
            <div>{cleanDate(r?.activationDate)}</div>
            <div>{cleanDate(r?.expirationDate)}</div>
            <div>{cleanDate(r?.tslastusedutc)}</div>
            <div>{gb(r?.totalUsage)}</div>
            <div>{gb(r?.packageSizeBytes)}</div>
            <div>{euro(r?.subscriberCost)}</div>
            <div>{euro(r?.resellerCost)}</div>
          </div>
        ))}

        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: 16, opacity: 0.8 }}>No data.</div>
        )}
        {loading && (
          <div style={{ padding: 16 }}>Loading…</div>
        )}
      </>
    </div>
  );
}
