import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { errorText, inr, pct } from "../api.js";

const SEV = { high: "bg-red-100 text-red-800", medium: "bg-amber-100 text-amber-800" };

export default function Alerts() {
  const [month, setMonth] = useState(3);
  const [alerts, setAlerts] = useState([]);
  const [run, setRun] = useState(null);
  const [hist, setHist] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/alerts").then((r) => setAlerts(r.data)).catch((e) => setError(errorText(e)));
  useEffect(() => { load(); }, []);

  const runMonitoring = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/monitoring/run?month=${month}`);
      setRun(data);
      await load();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const showHistory = async (loanId) => {
    try { setHist((await api.get(`/loans/${loanId}/risk-history`)).data); } catch (e) { setError(errorText(e)); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/alerts/${id}`, { status }); await load(); } catch (e) { setError(errorText(e)); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Continuous monitoring and early-warning alerts</h1>
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">Month since disbursement:
          <select className="ml-2 border rounded px-2 py-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button onClick={runMonitoring} disabled={busy} className="bg-slate-900 text-white rounded px-4 py-1.5 disabled:opacity-50">
          {busy ? "Scoring..." : "Run monitoring"}
        </button>
        <span className="text-xs text-slate-500">Tip: run month 1, then 2, then 3... so the system can spot risk that is rising.</span>
        {run && (
          <div className="w-full text-sm bg-slate-50 rounded p-3">
            Scored <b>{run.loans_scored}</b> loans and raised <b>{run.alerts_raised}</b> alerts.
            {run.backtest && (
              <span> Back-test on what really happened next: alerted borrowers missed a payment{" "}
                <b>{pct(run.backtest.alerted_miss_rate)}</b> of the time, vs <b>{pct(run.backtest.not_alerted_miss_rate)}</b> for the rest
                (overall {pct(run.backtest.overall_miss_rate)}).</span>
            )}
          </div>
        )}
      </div>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr>{["Loan", "Risk", "Severity", "Type", "Recommended action", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <button className="underline" onClick={() => showHistory(a.loan_id)}>{a.loan_id}</button>
                    <div className="text-xs text-slate-500">{a.occupation}, tier {a.tier}, {a.district}</div>
                    <div className="text-xs text-slate-500">{inr(a.loan_amount)} - month {a.months_on_book}</div>
                  </td>
                  <td className="px-3 py-2 font-semibold">{pct(a.risk_score)}</td>
                  <td className="px-3 py-2"><span className={"px-2 py-0.5 rounded-full text-xs " + (SEV[a.severity] || "")}>{a.severity}</span></td>
                  <td className="px-3 py-2">{a.alert_type.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 max-w-sm"><div className="text-xs text-slate-500 mb-1">{a.message}</div>{a.recommended_action}</td>
                  <td className="px-3 py-2 space-y-1 whitespace-nowrap">
                    <button className="block border rounded px-2 py-0.5 text-xs" onClick={() => setStatus(a.id, "acknowledged")}>Acknowledge</button>
                    <button className="block border rounded px-2 py-0.5 text-xs" onClick={() => setStatus(a.id, "resolved")}>Resolve</button>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && <tr><td className="px-3 py-6 text-slate-500" colSpan="6">No open alerts. Click "Run monitoring".</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-sm mb-2">Risk trend</h3>
          {!hist ? <p className="text-sm text-slate-500">Click a loan id to see how its risk changed month by month.</p> : (
            <>
              <p className="text-xs text-slate-500 mb-2">{hist.loan.loan_id}: {hist.loan.occupation}, tier {hist.loan.tier}</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hist.history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="months_on_book" />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => Math.round(v * 100) + "%"} />
                  <Tooltip formatter={(v) => pct(v)} />
                  <Line type="monotone" dataKey="risk_score" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <ul className="text-xs mt-2 space-y-1">
                {hist.history.map((h) => (
                  <li key={h.months_on_book}>Month {h.months_on_book}: {h.top_reasons.map((r) => r.label).join(", ") || "-"}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
