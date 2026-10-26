import { useEffect, useState } from "react";
import api, { errorText } from "../api.js";
import DecisionCard from "../components/DecisionCard.jsx";

const CHECKS = [
  ["identity", "Identity: ration card / Aadhaar / voter ID seen, photo matches"],
  ["address", "Address visit: home found, neighbours confirm"],
  ["occupation", "Occupation visit: shop / farm / work seen, income estimated"],
  ["references", "References: 2+ people (neighbour, shopkeeper, leader) vouch"],
  ["group_attestation", "Group / SHG leader attests to the borrower"],
  ["household_assessment", "Household: earners, assets, informal debts understood"],
  ["informal_signals", "Informal signals: rent, utility and recharge regularity"],
];
const STATUS = { open: "bg-blue-100 text-blue-800", review: "bg-amber-100 text-amber-800", approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800" };

export default function Verification() {
  const role = localStorage.getItem("role");
  const [cases, setCases] = useState([]);
  const [sel, setSel] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState("");

  const loadCases = () => api.get("/verifications").then((r) => setCases(r.data)).catch((e) => setError(errorText(e)));
  useEffect(() => { loadCases(); }, []);

  const open = async (id) => {
    setError(""); setOutcome(null);
    try {
      const { data } = await api.get(`/verifications/${id}`);
      setSel(data);
      setScores(Object.fromEntries(CHECKS.map(([k]) => [k, data.checks.find((c) => c.check_type === k)?.score ?? 5])));
      setNotes(Object.fromEntries(data.checks.map((c) => [c.check_type, c.notes])));
    } catch (e) { setError(errorText(e)); }
  };

  const submit = async () => {
    try {
      await api.post(`/verifications/${sel.id}/submit`, { checks: CHECKS.map(([k]) => ({ check_type: k, score: Number(scores[k]), notes: notes[k] || "" })) });
      await loadCases(); await open(sel.id);
    } catch (e) { setError(errorText(e)); }
  };

  const decide = async (approve) => {
    try {
      const { data } = await api.post(`/verifications/${sel.id}/decision`, { approve, note: "" });
      setOutcome(data.application.result);
      await loadCases(); await open(sel.id);
    } catch (e) { setError(errorText(e)); }
  };

  const canSubmit = role === "field_verifier" || role === "supervisor";
  const closed = sel && (sel.status === "approved" || sel.status === "rejected");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manual verification (no PAN / no credit history)</h1>
      <p className="text-sm text-slate-600">Applicants with too little formal data are not rejected. A field officer verifies them in person; a supervisor then approves, and the application is re-scored automatically.</p>
      {error && <div className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div>}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-3 space-y-2 h-fit">
          <h3 className="font-semibold text-sm">Cases</h3>
          {cases.length === 0 && <p className="text-sm text-slate-500">No cases yet. Submit the "Daily wager, no proofs" demo applicant to create one.</p>}
          {cases.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} className={"w-full text-left border rounded p-2 text-sm hover:bg-slate-50 " + (sel?.id === c.id ? "border-slate-900" : "")}>
              <div className="flex justify-between"><b>#{c.id} {c.applicant_name}</b><span className={"px-2 rounded-full text-xs " + STATUS[c.status]}>{c.status}</span></div>
              <div className="text-xs text-slate-500">{c.reason}</div>
              {c.verification_score != null && <div className="text-xs">Score {c.verification_score} ({c.verdict})</div>}
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!sel ? <div className="bg-white rounded-xl shadow p-5 text-sm text-slate-500">Select a case.</div> : (
            <div className="bg-white rounded-xl shadow p-5 space-y-3">
              <div>
                <h3 className="font-semibold">Case #{sel.id}: {sel.applicant_name}</h3>
                <p className="text-sm text-slate-600">{sel.applicant.occupation}, age {sel.applicant.age}, declared income Rs {sel.applicant.declared_monthly_income}, requests Rs {sel.applicant.loan_amount}</p>
              </div>
              {CHECKS.map(([k, label]) => (
                <div key={k} className="border-t pt-2">
                  <div className="flex justify-between text-sm"><span>{label}</span><b>{scores[k]}/10</b></div>
                  <input type="range" min="0" max="10" step="0.5" className="w-full" value={scores[k] ?? 5} disabled={closed || !canSubmit}
                    onChange={(e) => setScores({ ...scores, [k]: e.target.value })} />
                  <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Notes (what you saw)" value={notes[k] || ""} disabled={closed || !canSubmit}
                    onChange={(e) => setNotes({ ...notes, [k]: e.target.value })} />
                </div>
              ))}
              {canSubmit && !closed && <button onClick={submit} className="bg-slate-900 text-white rounded px-4 py-1.5">Submit verification</button>}
              {sel.verification_score != null && (
                <div className="bg-slate-50 rounded p-3 text-sm">Verification score: <b>{sel.verification_score}/100</b> - verdict: <b>{sel.verdict}</b> - case status: <b>{sel.status}</b></div>
              )}
              {role === "supervisor" && sel.status === "review" && (
                <div className="flex gap-2">
                  <button onClick={() => decide(true)} className="bg-green-700 text-white rounded px-4 py-1.5">Approve and re-score</button>
                  <button onClick={() => decide(false)} className="bg-red-700 text-white rounded px-4 py-1.5">Reject</button>
                </div>
              )}
              {sel.status === "review" && role !== "supervisor" && <p className="text-sm text-slate-500">Waiting for supervisor approval.</p>}
            </div>
          )}
          {outcome && (<div><h3 className="font-semibold mb-2">Decision after verification</h3><DecisionCard r={outcome} /></div>)}
        </div>
      </div>
    </div>
  );
}
