import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { errorText, pct } from "../api.js";

const BAND_COLOR = { low: "#16a34a", medium: "#d97706", high: "#dc2626" };
const DECISION_COLOR = { eligible: "#16a34a", eligible_with_conditions: "#d97706", manual_verification: "#2563eb", not_eligible: "#dc2626" };

function Card({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function BarBox({ title, data }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      {data.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count">{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/portfolio/summary").then((r) => setS(r.data)).catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <div className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div>;
  if (!s) return <p>Loading...</p>;

  const bands = ["low", "medium", "high"].map((b) => ({ name: b, count: s.risk_bands[b] || 0, color: BAND_COLOR[b] }));
  const decisions = Object.entries(s.application_decisions).map(([k, v]) => ({ name: k.replaceAll("_", " "), count: v, color: DECISION_COLOR[k] || "#64748b" }));
  const uw = s.model_metrics.underwriting;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Portfolio overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Loans being monitored" value={s.total_loans} />
        <Card label="Latest month scored" value={s.latest_month_scored ?? "none yet"} />
        <Card label="Open alerts" value={s.open_alerts} />
        <Card label="Applications processed" value={Object.values(s.application_decisions).reduce((a, b) => a + b, 0)} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <BarBox title={`Borrowers by risk band (month ${s.latest_month_scored ?? "-"})`} data={s.risk_bands && s.latest_month_scored ? bands : []} />
        <BarBox title="Application decisions" data={decisions} />
      </div>
      {uw && (
        <div className="bg-white rounded-xl shadow p-4 text-sm">
          <h3 className="font-semibold mb-2">Does the risk score work? (held-out later loans, {uw.model_type})</h3>
          <p className="mb-2 text-slate-600">Model AUC on unseen loans: <b>{uw.auc_test}</b>. Share of borrowers who really defaulted, by the risk band we gave them:</p>
          <div className="grid grid-cols-3 gap-3">
            {["low", "medium", "high"].map((b) => (
              <div key={b} className="bg-slate-50 rounded p-3">
                <div className="font-semibold capitalize" style={{ color: BAND_COLOR[b] }}>{b} risk</div>
                <div>{pct(uw.bands_on_test[b].actual_rate)} defaulted</div>
                <div className="text-xs text-slate-500">{pct(uw.bands_on_test[b].share)} of borrowers</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
