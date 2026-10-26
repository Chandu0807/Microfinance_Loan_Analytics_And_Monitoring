import { createContext, useContext, useState } from "react";
import api, { errorText } from "../api.js";
import DecisionCard from "../components/DecisionCard.jsx";

// ---- which form fields are numbers / checkboxes / allowed to be empty (null)
const BOOLS = ["has_pan", "has_aadhaar", "has_voter_id", "has_ration_card", "bank_account_exists", "written_off_or_settled",
  "electricity_available", "shg_member", "owns_land"];
const OPTIONAL_NUMS = ["cibil_score", "credit_history_length_years", "bureau_active_loans", "bureau_total_monthly_emi",
  "bureau_overdue_amount", "max_dpd_12m", "enquiries_6m", "prev_loans_avg_delay_days", "effective_income", "monthly_expenses",
  "elec_months_on_time", "elec_months_overdue", "shg_repayment_record", "land_area_acres"];
const REQUIRED_NUMS = ["age", "family_size", "dependents", "declared_formal_loans", "declared_informal_loans",
  "informal_debt_amount_declared", "informal_emi_monthly", "years_with_lender", "declared_monthly_income", "other_income_amount",
  "other_earner_income", "references_total", "references_positive", "loan_amount", "tenure_months", "interest_rate_pct"];
const CREDIT_FILE_FIELDS = ["cibil_score", "credit_history_length_years", "bureau_active_loans", "bureau_total_monthly_emi",
  "bureau_overdue_amount", "max_dpd_12m", "enquiries_6m"];

const BLANK = {
  full_name: "", age: "35", gender: "", occupation: "farmer", family_size: "4", dependents: "2",
  has_pan: false, has_aadhaar: true, has_voter_id: false, has_ration_card: true, bank_account_exists: true,
  _hasFile: false, cibil_score: "", credit_history_length_years: "", bureau_active_loans: "", bureau_total_monthly_emi: "",
  bureau_overdue_amount: "", max_dpd_12m: "", enquiries_6m: "", written_off_or_settled: false,
  declared_formal_loans: "0", declared_informal_loans: "0", informal_debt_amount_declared: "0", informal_emi_monthly: "0",
  years_with_lender: "0", prev_loans_avg_delay_days: "",
  declared_monthly_income: "10000", effective_income: "", income_variability: "", other_income_amount: "0",
  other_earner_income: "0", monthly_expenses: "", income_proof_type: "none",
  electricity_available: false, elec_months_on_time: "", elec_months_overdue: "", recharge_regularity: "", rent_paid_regularly: "",
  shg_member: false, shg_repayment_record: "", references_total: "0", references_positive: "0",
  owns_land: false, land_area_acres: "", irrigation_type: "",
  loan_amount: "30000", tenure_months: "12", interest_rate_pct: "22", loan_purpose: "working_capital",
};

// ready-made demo applicants (click a button to fill the form)
const PRESETS = {
  "Solid farmer (tier A)": {
    full_name: "Lakshmi Devi", age: "38", gender: "F", occupation: "farmer", has_pan: true, has_voter_id: true, _hasFile: true,
    cibil_score: "720", credit_history_length_years: "4", bureau_active_loans: "1", bureau_total_monthly_emi: "1500",
    bureau_overdue_amount: "0", max_dpd_12m: "0", enquiries_6m: "1", declared_formal_loans: "1", years_with_lender: "2",
    prev_loans_avg_delay_days: "2", declared_monthly_income: "14000", effective_income: "12500", income_variability: "medium",
    monthly_expenses: "7000", income_proof_type: "bank_statement", electricity_available: true, elec_months_on_time: "11",
    elec_months_overdue: "0", recharge_regularity: "regular", shg_member: true, shg_repayment_record: "85",
    references_total: "3", references_positive: "3", owns_land: true, land_area_acres: "2", irrigation_type: "borewell",
    loan_amount: "40000", loan_purpose: "crop_inputs",
  },
  "Daily wager, no proofs": {
    full_name: "Ramesh Kumar", age: "34", gender: "M", occupation: "daily_wager", has_aadhaar: false, has_ration_card: true,
    bank_account_exists: false, declared_monthly_income: "9000", monthly_expenses: "5500", references_total: "1",
    references_positive: "1", loan_amount: "15000", loan_purpose: "small_business_start",
  },
  "Over-indebted, hides loans": {
    full_name: "Suresh Naik", age: "42", gender: "M", occupation: "vendor", has_pan: true, _hasFile: true, cibil_score: "640",
    credit_history_length_years: "6", bureau_active_loans: "4", bureau_total_monthly_emi: "6500", bureau_overdue_amount: "0",
    max_dpd_12m: "30", enquiries_6m: "4", declared_formal_loans: "2", declared_informal_loans: "1", informal_emi_monthly: "800",
    declared_monthly_income: "14000", effective_income: "12500", monthly_expenses: "7000", income_proof_type: "bank_statement",
    loan_amount: "40000",
  },
};

function toPayload(f) {
  const p = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith("_")) continue;
    if (BOOLS.includes(k)) p[k] = !!v;
    else if (OPTIONAL_NUMS.includes(k)) p[k] = v === "" ? null : Number(v);
    else if (REQUIRED_NUMS.includes(k)) p[k] = v === "" ? 0 : Number(v);
    else if (k === "rent_paid_regularly") p[k] = v === "" ? null : v === "yes";
    else p[k] = v === "" ? null : v;
  }
  if (!f._hasFile) CREDIT_FILE_FIELDS.forEach((k) => (p[k] = null));
  if (!f.electricity_available) { p.elec_months_on_time = null; p.elec_months_overdue = null; }
  return p;
}

function Section({ title, children }) {
  return (
    <fieldset className="bg-white rounded-xl shadow p-5">
      <legend className="font-semibold px-2">{title}</legend>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </fieldset>
  );
}

const FormCtx = createContext(null);

// These live OUTSIDE the page component on purpose: if they were defined inside it, React would
// re-create them on every keystroke and the input would lose focus after each character.
function Text({ name, label, type = "text", required }) {
  const { f, set } = useContext(FormCtx);
  return (
    <label className="text-sm">
      <span className="block text-slate-600 mb-1">{label}</span>
      <input className="w-full border rounded px-2 py-1.5" type={type} value={f[name]} required={required}
        onChange={(e) => set(name, e.target.value)} />
    </label>
  );
}

function Check({ name, label }) {
  const { f, set } = useContext(FormCtx);
  return (
    <label className="text-sm flex items-center gap-2">
      <input type="checkbox" checked={!!f[name]} onChange={(e) => set(name, e.target.checked)} /> {label}
    </label>
  );
}

function Select({ name, label, options }) {
  const { f, set } = useContext(FormCtx);
  return (
    <label className="text-sm">
      <span className="block text-slate-600 mb-1">{label}</span>
      <select className="w-full border rounded px-2 py-1.5" value={f[name]} onChange={(e) => set(name, e.target.value)}>
        {options.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
      </select>
    </label>
  );
}

export default function NewApplication() {
  const [f, setF] = useState(BLANK);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (name, value) => setF((old) => ({ ...old, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/applications", toPayload(f));
      setResult(data.result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold mr-4">New loan application</h1>
        <span className="text-sm text-slate-500">Fill with a demo applicant:</span>
        {Object.entries(PRESETS).map(([name, values]) => (
          <button key={name} type="button" className="text-sm border rounded px-2 py-1 bg-white hover:bg-slate-100"
            onClick={() => { setF({ ...BLANK, ...values }); setResult(null); setError(""); }}>
            {name}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded p-3 text-sm">{error}</div>}
      {result && <DecisionCard r={result} />}

      <FormCtx.Provider value={{ f, set }}>
      <form onSubmit={submit} className="space-y-4">
        <Section title="1. Applicant">
          <Text name="full_name" label="Full name" required />
          <Text name="age" label="Age" type="number" required />
          <Select name="gender" label="Gender (audit only, not used by the model)" options={[["", "-"], ["F", "Female"], ["M", "Male"], ["O", "Other"]]} />
          <Select name="occupation" label="Occupation" options={[["farmer", "Farmer"], ["daily_wager", "Daily wage worker"],
            ["vendor", "Vendor"], ["small_shopkeeper", "Small shopkeeper"], ["artisan", "Artisan"], ["domestic_worker", "Domestic worker"],
            ["driver", "Driver"], ["salaried", "Salaried"], ["dairy_livestock", "Dairy / livestock"]]} />
          <Text name="family_size" label="Family size" type="number" required />
          <Text name="dependents" label="Dependents" type="number" />
        </Section>

        <Section title="2. Documents available">
          <Check name="has_pan" label="PAN card" />
          <Check name="has_aadhaar" label="Aadhaar" />
          <Check name="has_voter_id" label="Voter ID" />
          <Check name="has_ration_card" label="Ration card" />
          <Check name="bank_account_exists" label="Bank account" />
        </Section>

        <Section title="3. Credit file (CIBIL)">
          <label className="text-sm flex items-center gap-2 col-span-full">
            <input type="checkbox" checked={f._hasFile} onChange={(e) => set("_hasFile", e.target.checked)} /> A credit file exists for this person
          </label>
          {f._hasFile && (<>
            <Text name="cibil_score" label="CIBIL score (300-900)" type="number" />
            <Text name="credit_history_length_years" label="Credit history (years)" type="number" />
            <Text name="bureau_active_loans" label="Active loans on credit file" type="number" />
            <Text name="bureau_total_monthly_emi" label="Total monthly EMI on credit file" type="number" />
            <Text name="bureau_overdue_amount" label="Overdue amount (dues)" type="number" />
            <Text name="max_dpd_12m" label="Worst days overdue, last 12 months" type="number" />
            <Text name="enquiries_6m" label="Loan enquiries, last 6 months" type="number" />
            <Check name="written_off_or_settled" label="Any account written off or settled" />
          </>)}
        </Section>

        <Section title="4. Debts the borrower declares">
          <Text name="declared_formal_loans" label="Bank / NBFC / MFI loans declared" type="number" />
          <Text name="declared_informal_loans" label="Moneylender / relative loans declared" type="number" />
          <Text name="informal_debt_amount_declared" label="Informal debt outstanding" type="number" />
          <Text name="informal_emi_monthly" label="Monthly payment on informal debt" type="number" />
          <Text name="years_with_lender" label="Years as our customer (0 = new)" type="number" />
          <Text name="prev_loans_avg_delay_days" label="Avg delay on earlier loans with us (days)" type="number" />
        </Section>

        <Section title="5. Income">
          <Text name="declared_monthly_income" label="Declared monthly income" type="number" required />
          <Text name="effective_income" label="Verified / estimated income (optional)" type="number" />
          <Select name="income_variability" label="How uneven is the income?" options={[["", "Not known"], ["low", "Steady"], ["medium", "Some ups and downs"], ["high", "Very uneven"]]} />
          <Text name="other_income_amount" label="Other income (pension, MGNREGA, remittance)" type="number" />
          <Text name="other_earner_income" label="Other earners in household" type="number" />
          <Text name="monthly_expenses" label="Monthly household expenses" type="number" />
          <Select name="income_proof_type" label="Income proof" options={[["none", "None"], ["bank_statement", "Bank statement"], ["payslip", "Payslip"]]} />
        </Section>

        <Section title="6. Alternative data (for people with no formal history)">
          <Check name="electricity_available" label="Electricity bill history available" />
          {f.electricity_available && (<>
            <Text name="elec_months_on_time" label="Bills paid on time (of last 12)" type="number" />
            <Text name="elec_months_overdue" label="Months more than 30 days late" type="number" />
          </>)}
          <Select name="recharge_regularity" label="Mobile recharge pattern" options={[["", "Not known"], ["regular", "Regular"], ["irregular", "Irregular"]]} />
          <Select name="rent_paid_regularly" label="Rent paid regularly" options={[["", "Not applicable"], ["yes", "Yes"], ["no", "No"]]} />
        </Section>

        <Section title="7. Social ties and assets">
          <Check name="shg_member" label="Member of a self-help group" />
          {f.shg_member && <Text name="shg_repayment_record" label="Group repayment record (0-100)" type="number" />}
          <Text name="references_total" label="References collected" type="number" />
          <Text name="references_positive" label="...of which positive" type="number" />
          <Check name="owns_land" label="Owns / cultivates land" />
          {f.owns_land && (<>
            <Text name="land_area_acres" label="Land (acres)" type="number" />
            <Select name="irrigation_type" label="Irrigation" options={[["", "-"], ["rainfed", "Rainfed"], ["borewell", "Borewell"], ["canal", "Canal"]]} />
          </>)}
        </Section>

        <Section title="8. The loan">
          <Text name="loan_amount" label="Amount requested" type="number" required />
          <Select name="tenure_months" label="Tenure" options={[["12", "12 months"], ["18", "18 months"], ["24", "24 months"]]} />
          <Text name="interest_rate_pct" label="Interest rate (% per year)" type="number" />
          <Select name="loan_purpose" label="Purpose" options={[["working_capital", "Working capital"], ["equipment", "Equipment"],
            ["livestock", "Livestock"], ["crop_inputs", "Crop inputs"], ["small_business_start", "Start a small business"],
            ["education", "Education"], ["housing_repair", "Housing repair"], ["sanitation", "Sanitation"]]} />
        </Section>

        <button disabled={busy} className="bg-slate-900 text-white rounded px-5 py-2 disabled:opacity-50">
          {busy ? "Evaluating..." : "Evaluate eligibility"}
        </button>
      </form>
      </FormCtx.Provider>
    </div>
  );
}
