import { inr, pct } from "../api.js";

const BADGE = {
  eligible: ["Eligible", "bg-green-100 text-green-800"],
  eligible_with_conditions: ["Eligible with conditions", "bg-amber-100 text-amber-800"],
  manual_verification: ["Needs manual verification", "bg-blue-100 text-blue-800"],
  not_eligible: ["Not eligible", "bg-red-100 text-red-800"],
};
const BAND = { low: "text-green-700", medium: "text-amber-700", high: "text-red-700" };

function List({ title, items, render, tone = "" }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className={"font-semibold text-sm mb-1 " + tone}>{title}</h4>
      <ul className="list-disc ml-5 text-sm space-y-0.5">
        {items.map((x, i) => (
          <li key={i}>{render ? render(x) : x}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export default function DecisionCard({ r }) {
  const [label, cls] = BADGE[r.decision] || [r.decision, "bg-slate-100"];
  const c = r.capacity || {};
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={"px-3 py-1 rounded-full text-sm font-semibold " + cls}>{label}</span>
        <span className="text-sm">
          Default risk: <b className={BAND[r.risk_band]}>{pct(r.risk_score)}</b> ({r.risk_band})
        </span>
        <span className="text-sm">Data tier: <b>{r.tier}</b></span>
        <span className="text-sm">Data confidence: <b>{r.data_confidence_score}/100</b></span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Requested" value={inr(r.requested_amount)} />
        <Stat label="Recommended amount" value={inr(r.recommended_amount)} />
        <Stat label="Recommended EMI" value={inr(r.recommended_emi)} />
        <Stat label="Tenure" value={`${r.tenure_months} months @ ${r.interest_rate_pct}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <List title="Why the risk is higher" tone="text-red-700" items={r.reasons_increasing_risk}
          render={(x) => `${x.label}: ${x.value} (+${x.impact_pp} pts)`} />
        <List title="What lowers the risk" tone="text-green-700" items={r.reasons_reducing_risk}
          render={(x) => `${x.label}: ${x.value} (${x.impact_pp} pts)`} />
      </div>

      <List title="Rules triggered" tone="text-red-700" items={r.rules_triggered} />
      <List title="Conditions" items={r.conditions} />
      <List title="Next steps" items={r.next_steps} />
      <List title="How the borrower can improve" items={r.how_to_improve} />
      <List title="Notes" items={r.notes} />

      <div>
        <h4 className="font-semibold text-sm mb-1">Repayment capacity (per month)</h4>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <Stat label="Household income" value={inr(c.household_income)} />
          <Stat label="Expenses" value={inr(c.expenses)} />
          <Stat label="Existing EMIs" value={inr(c.existing_emi)} />
          <Stat label="Surplus" value={inr(c.surplus)} />
          <Stat label="Safe new EMI" value={inr(c.safe_emi)} />
          <Stat label="Max affordable loan" value={inr(c.max_affordable_loan)} />
        </div>
      </div>
    </div>
  );
}
