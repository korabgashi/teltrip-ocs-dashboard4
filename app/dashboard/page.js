"use client";

import { useEffect, useState } from "react";

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
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

export default function Dashboard() {
  const [accountId, setAccountId] = useState(3771);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const subs = await postJSON("/api/ocs/list-subscribers", { accountId });
      const list = subs?.listSubscriber?.subscriberList || [];

      const enriched = await Promise.all(list.map(async (sub) => {
        const subscriberId = sub.subscriberId;
        const iccid = getICCID(sub);

        const [single, pkg] = await Promise.all([
          postJSON("/api/ocs/report", { getSingleSubscriber: { subscriberId } }),
          postJSON("/api/ocs/report", { listSubscriberPrepaidPackages: { subscriberId } })
        ]);

        const d = a(pkg?.listSubscriberPrepaidPackages);
        const latest = d[d.length - 1] || {};

        const usedDataByte = n(single?.getSingleSubscriber?.usedDataByte);
        const pckDataByte = n(single?.getSingleSubscriber?.pckDataByte);
        const lastUsageDate = s(single?.getSingleSubscriber?.lastUsageDate);

        const subscriberCost = n(latest?.subscriberCost);
        const resellerCost = n(latest?.resellerCost);
        const profit = subscriberCost - resellerCost;
        const margin = subscriberCost > 0 ? (profit / subscriberCost) * 100 : 0;

        return {
          subscriberId,
          iccid,
          templateName: s(latest?.templateName),
          activationDate: s(latest?.activationDate),
          expiryDate: s(latest?.expiryDate),
          lastUsageDate,
          subscriberCost,
          resellerCost,
          usedDataByte,
          pckDataByte,
          profit,
          margin
        };
      }));

      setRows(enriched);
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
          gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr',
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
          <div>Profit €</div>
          <div>Margin %</div>
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr 1.5fr',
            gap: '12px',
            borderBottom: '1px solid #2a3356',
            padding: '12px 0',
            fontSize: 14
          }}>
            <div>{r.subscriberId}</div>
            <div style={{ fontFamily: 'monospace' }}>{r.iccid}</div>
            <div>{r.templateName}</div>
            <div>{r.activationDate}</div>
            <div>{r.expiryDate}</div>
            <div>{r.lastUsageDate}</div>
            <div>{gb(r.usedDataByte)}</div>
            <div>{gb(r.pckDataByte)}</div>
            <div>{euro(r.subscriberCost)}</div>
            <div>{euro(r.resellerCost)}</div>
            <div>{euro(r.profit)}</div>
            <div>{r.margin.toFixed(1)}%</div>
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
