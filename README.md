# Borrower Intelligence Platform: step-by-step guide

An AI platform for microfinance lenders. It (1) decides whether a borrower is eligible and explains why,
(2) routes people with no proofs to a manual field-verification workflow, and (3) keeps monitoring active loans
and raises early-warning alerts **before** a payment is missed.

```
React (Vite + Tailwind)  --HTTP/JSON + JWT-->  FastAPI  -->  PostgreSQL
                                                   |
                                                   +--> ml_core.py + saved LightGBM models (ml/artifacts)
```

| Folder | What it holds |
|---|---|
| `data/` | the two training CSVs (synthetic data) |
| `ml/` | `train.py`: trains the two models |
| `backend/app/` | the API: `main.py` (routes), `decision.py` (eligibility), `monitoring.py` (alerts), `ml_core.py` (shared ML code), `models.py` (DB tables), `security.py` (login) |
| `backend/scripts/seed_db.py` | loads demo loans into PostgreSQL |
| `backend/tests/test_core.py` | tests for the decision and monitoring logic |
| `frontend/` | the React app (6 pages) |

---

## Step 0. Install the tools (once)

| Tool | Version | Check with |
|---|---|---|
| Python | 3.10 or newer | `python --version` |
| Node.js | 20 or newer | `node --version` |
| Docker Desktop (easiest for PostgreSQL) | any recent | `docker --version` |

No Docker? Install PostgreSQL 15+ yourself, then run in `psql`:
```sql
CREATE USER mf_user WITH PASSWORD 'mf_pass';
CREATE DATABASE microfinance OWNER mf_user;
```

## Step 1. Create the Python environment

From the project root (the folder containing this README):

```bash
python -m venv .venv
# Windows:   .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
```
One environment is used for both model training and the API.

## Step 2. Check the data

`data/` must contain `underwriting_dataset.csv` and `monitoring_dataset.csv`. (They are included. To use a fresh copy,
generate your own with `generate_synthetic_data.py` from the dataset package.)

* `underwriting_dataset.csv`: one row per borrower, label `target_default_12m` (90+ days late within 12 months).
* `monitoring_dataset.csv`: one row per borrower per month, label `target_delinquent_next_3m`.
* Both have a `split` column (train / valid / test) based on **loan start date**, so the test set is always *later*
  loans than the training set. This mimics real life: you train on the past and predict the future.

## Step 3. Train the two models

```bash
cd ml
python train.py --data ../data
```
This does, for each model:
1. loads the CSV and turns it into numbers with `ml_core.to_frame()` (text categories become codes, blanks stay blank
   because gradient boosting handles missing values by itself);
2. fits **LightGBM** on the `train` rows (small regularised trees, because the dataset is modest in size);
3. fits a plain **logistic regression** as a baseline, to show what the boosted model adds;
4. sets the **risk-band thresholds** (low / medium / high) from the `valid` rows, never from `test`;
5. prints AUC on the `test` rows and the *real* default rate inside each band;
6. saves `ml/artifacts/underwriting_model.joblib` and `monitoring_model.joblib`.

Expected output (numbers vary slightly): underwriting AUC about 0.77, with real default rates of roughly 4% (low band),
12% (medium) and 28% (high). Monitoring AUC about 0.74, with 4% / 12% / 28% miss rates.
**Read these honestly:** on this synthetic data the simple logistic baseline scores about the same as the boosted
model, because the synthetic world is mostly additive. On real data, gradient boosting usually pulls ahead; say so in
your presentation rather than claiming it wins here.

## Step 4. Start PostgreSQL

```bash
docker compose up -d
```
(from the project root). This creates a database called `microfinance` (user `mf_user`, password `mf_pass`).

## Step 5. Start the backend API

```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
uvicorn app.main:app --reload
```
* On first start the API creates all the tables and three demo users.
* Open **http://localhost:8000/docs**: FastAPI generates a clickable page for every endpoint. Try `GET /health`:
  both models should show `true`. If a model shows `false`, you skipped Step 3.

## Step 6. Load the demo loans

In a **second terminal** (activate the same virtual environment):
```bash
cd backend
python scripts/seed_db.py --data ../data --n 1500
```
This loads 1,500 loans and their first nine months of monitoring data. They come from the *test* split, so the monitoring
demo is a fair back-test: the model never saw these loans while training.

## Step 7. Start the frontend

In a **third terminal**:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open **http://localhost:5173**.

| Username | Password | Role | Can do |
|---|---|---|---|
| officer | officer123 | loan officer | create applications, run monitoring, handle alerts |
| verifier | verifier123 | field verifier | submit manual verification checks |
| supervisor | supervisor123 | supervisor | everything, plus approve/reject verification |

## Step 8. Demo script (5 minutes)

1. **Log in as `officer`.** On *New application* click **Solid farmer (tier A)** then *Evaluate eligibility*.
   You get a decision, a risk percentage, the reasons behind it, a recommended amount and EMI, and a repayment-capacity
   breakdown. (The amount is reduced because the household surplus cannot carry Rs 40,000.)
2. Click **Over-indebted, hides loans** and evaluate. The credit file shows more loans than the borrower declared, so
   the system flags **hidden loans** and declines.
3. Click **Daily wager, no proofs** and evaluate. This person has no PAN, no bank account and no credit history. The
   system does **not** reject them; it creates a **manual verification case**.
4. **Log out, log in as `verifier`.** Open *Manual verification*, pick the case, score the seven checks (try 7s) and submit.
5. **Log in as `supervisor`.** Open the same case and click *Approve and re-score*. The application is re-scored with the
   verification score and becomes a small **starter loan** (capped at Rs 15,000), which can grow after each on-time cycle.
6. **Monitoring.** As `officer`, open *Monitoring & alerts*. Run **month 1**, then **2**, then **3**. For each month the
   page shows how many alerts were raised and a **back-test**: alerted borrowers really missed a payment far more often
   than the rest. Click a loan id to see its risk trend and the drivers each month.
7. *Portfolio* shows the risk-band distribution and, importantly, **how real default rates differ by band** (the evidence
   that the score works).

## How it works (the ideas behind the code)

**Tiers (A to D).** `decision.build_features()` computes a *data confidence score* from the documents and data available
(PAN, Aadhaar, bank account, income proof, credit file, electricity data, own history, group membership, references).
Tier A = PAN plus credit file. Tier B = enough other data to score with alternative signals. Tiers C and D = thin file,
so field verification is required, then a small starter loan.

**Hard rules first, then the model.** `decision.evaluate()` first applies policy rules that no score may override
(age 18 to 60; no past write-off; fewer than 4 active lenders; no 90+ day delay; some repayment capacity). Only then does
the ML risk score decide the band. Edit the `POLICY` dictionary at the top of `decision.py` to change the rules.

**Repayment capacity.** Safe new EMI = the smaller of (45% of household income minus existing EMIs) and (70% of the
monthly surplus). The maximum affordable loan is the principal that this EMI can repay over the chosen tenure.

**Why a score is explained.** `ml_core.occlusion_deltas()` asks, for each feature, "how much would this borrower's risk
fall if this one value were typical?" This works with any model, needs no extra library, and produces the "Why the risk is
higher" list. Blank values are merged into one reason, "Limited verifiable data".

**Early warning.** The monitoring model reads signals that move *before* a missed payment: income below the seasonal
norm, late electricity bills, falling mobile recharge, a new loan elsewhere, missed group meetings, district drought.
`monitoring.build_alert()` raises an alert when risk is high, or rising fast, and maps the biggest driver to a concrete
action for the loan officer.

**Hidden loans.** `loan_gap` = loans on the credit file minus loans the borrower declared. A positive gap is a strong
warning sign, and the model uses it.

## What was tested, and what was not

Be clear about this before demoing:

| Part | Status |
|---|---|
| Model training pipeline, decision engine, monitoring alerts, seed-data preparation | **Run and passing**: `python backend/tests/test_core.py` (12 checks) |
| All Python files: syntax and undefined names | Checked |
| All React files: JSX syntax and undefined names | Checked |
| FastAPI server, PostgreSQL, LightGBM, `npm install` and the browser app | **Not run by the author** (no network access in the build environment). The code follows standard patterns, but expect to fix a small typo or version issue on the first run. |

LightGBM was not installed where this was built, so training used scikit-learn's equivalent model. Your run will use
LightGBM automatically. Numbers will be close but not identical.

Run the tests yourself (after Step 3):
```bash
cd backend
python tests/test_core.py
```

## Next steps

* **Automatic monthly monitoring.** Move the body of `run_monitoring` into a function and call it from APScheduler
  (`pip install apscheduler`): `scheduler.add_job(job, "cron", day=1, hour=2)`.
* **Real data feeds.** Replace the seeded `monitoring_snapshots` with rows built from your collection system, income
  logs, and (with the borrower's consent) utility and recharge data.
* **Migrations.** Use Alembic instead of `create_all` once the schema changes.
* **Photo and document upload** for verification: add `python-multipart` and a file endpoint.
* **Fairness audit.** Gender is stored but never used by the model. After training, compare approval and default rates
  by gender, region and occupation. The synthetic data deliberately contains a gender gap to practise this.
* **Retraining.** Re-run `train.py` monthly on fresh outcomes and compare to the current model before replacing it.

## Security checklist before any real use

* Change the demo passwords and set a long random `SECRET_KEY` in `backend/.env`.
* Serve over HTTPS and restrict `CORS_ORIGINS`.
* Store PAN and Aadhaar only masked or encrypted (this project stores neither).
* Get borrower consent before fetching bureau, electricity, recharge or UPI data (India's DPDP Act applies).
* CIBIL is a paid, permissioned service. The credit-file fields here are typed in by hand; production needs a bureau integration.
* Check current RBI digital-lending and microfinance rules with a legal adviser.

## Troubleshooting

| Problem | Fix |
|---|---|
| `connection refused` on port 5432 | Start the database: `docker compose up -d` (check Docker is running) |
| `/health` shows a model as `false` | Run `python train.py --data ../data` in `ml/`, then restart uvicorn |
| `No data for that month` when running monitoring | Run `scripts/seed_db.py` (Step 6) |
| Browser shows a network or CORS error | Make sure the API is running on port 8000 and `frontend/.env` has `VITE_API_URL=http://localhost:8000` |
| `ModuleNotFoundError: app` | Run commands from inside `backend/` (uvicorn, seed script, tests) |
| `pip install lightgbm` fails | Training falls back to scikit-learn automatically; install a C++ build tool or use a newer Python to get LightGBM |
| Login says "Wrong username or password" | The users are created on the **first API start**; if you changed the database, delete the `users` rows and restart |
