import { useEffect, useState } from "react";
import api, { errorText, inr, pct } from "../api.js";
import DecisionCard from "../components/DecisionCard.jsx";

const COLOR = {
  eligible: "text-green-700", eligible_with_conditions: "text-amber-700",
  manual_verification: "text-blue-700", not_eligible: "text-red-700",
};

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/applications").then((r) => setRows(r.data)).catch((e) => setError(errorText(e)));
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Applications</h1>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div>}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>{["#", "Applicant", "Occupation", "Requested", "Tier", "Risk", "Decision"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.applicant_name}</td>
                <td className="px-3 py-2">{r.occupation}</td>
                <td className="px-3 py-2">{inr(r.requested_amount)}</td>
                <td className="px-3 py-2">{r.tier}</td>
                <td className="px-3 py-2">{pct(r.risk_score)} ({r.risk_band})</td>
                <td className={"px-3 py-2 font-medium " + (COLOR[r.decision] || "")}>{r.decision.replaceAll("_", " ")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-3 py-6 text-slate-500" colSpan="7">No applications yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <DecisionCard r={rows.find((x) => x.id === open).result} />}
    </div>
  );
}
