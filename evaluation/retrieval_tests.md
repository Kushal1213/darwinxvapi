# Retrieval Evaluation Benchmark Report

## How this report was produced
This file is **generated**, not hand-written. It is produced by `evaluation/run_retrieval_tests.py`, which sends each query below into `knowledge-base/local_retriever.py` (an offline TF-IDF retriever over the actual files in `knowledge-base/raw/`) and records the real top match, its real cosine similarity score, and the wall-clock retrieval latency measured for that call. Re-run the script after any change to the knowledge base to regenerate this table.

> **Note on embedding model.** Production retrieval (`services/rag-service/main.py`) is designed around Gemini `gemini-embedding-001` (3072-d dense vectors) for semantic matching. This sandbox has no network route to Google's embedding API, so the report below uses a TF-IDF/cosine fallback as a verifiable stand-in — the retrieval *contract* (chunk → source → score → citation) is identical, but absolute scores are not directly comparable to dense-embedding cosine scores and will typically be lower for paraphrased/non-lexical queries. See `README.md` → Environment Notes.

## Evaluation Queries Matrix

| ID | User Query | Category | Retrieved Source | Chunk ID | Score | Latency | Verdict |
|---|---|---|---|---|---|---|---|
| Q1 | What is the minimum monthly salary required for a personal loan? | qualification | loan_qualification_rules.txt | loan_qualification_rules__001 | 0.235 | 0.92 ms | correct |
| Q2 | What is the maximum loan-to-value ratio for a loan against property? | policy | loan_against_property_guide.txt | loan_against_property_guide__001 | 0.342 | 0.77 ms | correct |
| Q3 | What KYC documents are required to open a loan file? | policy | bajaj_finserv_loan_guide.txt | bajaj_finserv_loan_guide__001 | 0.153 | 0.69 ms | correct |
| Q4 | Customer says the interest rate is too high, how should I respond? | objection | objection_handling_playbook.txt | objection_handling_playbook__006 | 0.101 | 0.61 ms | partially correct |
| Q5 | What is a rider in a life insurance policy and what does 'benepisyaryo' mean? | faq / localization | insurance_product_faq_internal.txt | insurance_product_faq_internal__001 | 0.158 | 0.72 ms | correct |
| Q6 | What is DP and tenor for a motorcycle financing product in Indonesia? | product / localization | indonesia_finance_complete.txt | indonesia_finance_complete__001 | 0.197 | 0.68 ms | correct |
| Q7 | Is pre-existing disease covered immediately under a new health insurance policy? | faq | health_insurance_india_complete.txt | health_insurance_india_complete__002 | 0.297 | 0.60 ms | correct |
| Q8 | What happens if a customer misses an EMI / cicilan payment date? | policy | insurance_product_faq_internal.txt | insurance_product_faq_internal__001 | 0.141 | 0.65 ms | partially correct |

## Per-query detail (retrieved text + source reference)

### Q1 — What is the minimum monthly salary required for a personal loan?

- **Category under test:** qualification
- **Verdict:** correct
- **Why:** Top match score 0.235 against `loan_qualification_rules.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `loan_qualification_rules.txt` (chunk `loan_qualification_rules__001`, score 0.235, market: india, PII redacted: False) — "LOAN QUALIFICATION RULES — INTERNAL POLICY v2.3 Last Updated: January 2024 PERSONAL LOAN ELIGIBILITY: - Minimum age: 21 years | Maximum age: 58 years (at loan m..."
  2. `bajaj_finserv_loan_guide.txt` (chunk `bajaj_finserv_loan_guide__001`, score 0.230, market: india, PII redacted: False) — "BAJAJ FINSERV — PERSONAL LOAN & BUSINESS LOAN GUIDE PERSONAL LOAN: ELIGIBILITY CRITERIA: - Age: 21 to 80 years - Employment: Salaried (employed with an MNC, pub..."
  3. `tata_capital_loan_guide.txt` (chunk `tata_capital_loan_guide__001`, score 0.166, market: india, PII redacted: False) — "TATA CAPITAL FINANCIAL SERVICES — LOAN GUIDE PERSONAL LOAN: Tata Capital offers quick, collateral-free personal loans for salaried and self-employed individuals..."
### Q2 — What is the maximum loan-to-value ratio for a loan against property?

- **Category under test:** policy
- **Verdict:** correct
- **Why:** Top match score 0.342 against `loan_against_property_guide.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `loan_against_property_guide.txt` (chunk `loan_against_property_guide__001`, score 0.342, market: india, PII redacted: False) — "LOAN AGAINST PROPERTY (LAP) — COMPLETE GUIDE WHAT IS LAP? A Loan Against Property is a secured loan where you mortgage your owned property (residential or comme..."
  2. `loan_qualification_rules.txt` (chunk `loan_qualification_rules__001`, score 0.275, market: india, PII redacted: False) — "LOAN QUALIFICATION RULES — INTERNAL POLICY v2.3 Last Updated: January 2024 PERSONAL LOAN ELIGIBILITY: - Minimum age: 21 years | Maximum age: 58 years (at loan m..."
  3. `tata_capital_loan_guide.txt` (chunk `tata_capital_loan_guide__002`, score 0.203, market: india, PII redacted: False) — "under-construction properties LOAN AGAINST PROPERTY: Amount: Up to Rs. 10 crores Tenure: Up to 15 years LTV: Up to 70% of property value Interest: Starting 9% p..."
### Q3 — What KYC documents are required to open a loan file?

- **Category under test:** policy
- **Verdict:** correct
- **Why:** Top match score 0.153 against `bajaj_finserv_loan_guide.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `bajaj_finserv_loan_guide.txt` (chunk `bajaj_finserv_loan_guide__001`, score 0.153, market: india, PII redacted: False) — "BAJAJ FINSERV — PERSONAL LOAN & BUSINESS LOAN GUIDE PERSONAL LOAN: ELIGIBILITY CRITERIA: - Age: 21 to 80 years - Employment: Salaried (employed with an MNC, pub..."
  2. `kyc_and_regulatory_guide.txt` (chunk `kyc_and_regulatory_guide__001`, score 0.133, market: india, PII redacted: False) — "KYC (KNOW YOUR CUSTOMER) — COMPLETE GUIDE FOR FINANCIAL SERVICES WHAT IS KYC? Know Your Customer (KYC) is a mandatory process required by RBI and SEBI for all f..."
  3. `loan_against_property_guide.txt` (chunk `loan_against_property_guide__001`, score 0.111, market: india, PII redacted: False) — "LOAN AGAINST PROPERTY (LAP) — COMPLETE GUIDE WHAT IS LAP? A Loan Against Property is a secured loan where you mortgage your owned property (residential or comme..."
### Q4 — Customer says the interest rate is too high, how should I respond?

- **Category under test:** objection
- **Verdict:** partially correct
- **Why:** Top match score 0.101 against `objection_handling_playbook.txt` is weak — the source is topically related but may not fully answer the question.
- **Top-3 retrieved chunks:**
  1. `objection_handling_playbook.txt` (chunk `objection_handling_playbook__006`, score 0.101, market: india, PII redacted: False) — "to clarify something important: mortgaging doesn't mean giving away your property. You continue to live in it, rent it, or use it exactly as you do today. The b..."
  2. `objection_handling_playbook.txt` (chunk `objection_handling_playbook__004`, score 0.099, market: india, PII redacted: False) — "the policy terms, or which plan to choose. If I know what's on your mind, I can give you the exact information you need to make a confident decision. I can also..."
  3. `voice_agent_conversation_scenarios.txt` (chunk `voice_agent_conversation_scenarios__005`, score 0.088, market: india, PII redacted: False) — "me! I submitted all documents! AGENT: I sincerely apologize for the delay, Mr. Kumar. I completely understand how frustrating this must be. CUSTOMER: This is ri..."
### Q5 — What is a rider in a life insurance policy and what does 'benepisyaryo' mean?

- **Category under test:** faq / localization
- **Verdict:** correct
- **Why:** Top match score 0.158 against `insurance_product_faq_internal.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `insurance_product_faq_internal.txt` (chunk `insurance_product_faq_internal__001`, score 0.158, market: india, PII redacted: False) — "INSURANCE PRODUCT FAQ — AGENT REFERENCE GUIDE v1.8 Q: What is a rider? A: A rider is an optional add-on benefit that can be attached to a base insurance policy..."
  2. `sbi_life_insurance_guide.txt` (chunk `sbi_life_insurance_guide__002`, score 0.148, market: india, PII redacted: False) — "- Sum assured: 5,000 to 50,000 - Annual premium: Very affordable KEY INSURANCE TERMS EXPLAINED: PREMIUM: The amount you pay periodically to keep your insurance..."
  3. `sbi_life_insurance_guide.txt` (chunk `sbi_life_insurance_guide__001`, score 0.130, market: india, PII redacted: False) — "SBI LIFE INSURANCE — COMPREHENSIVE GUIDE ABOUT SBI LIFE: SBI Life Insurance is a joint venture between State Bank of India and BNP Paribas Cardif. Claim settlem..."
### Q6 — What is DP and tenor for a motorcycle financing product in Indonesia?

- **Category under test:** product / localization
- **Verdict:** correct
- **Why:** Top match score 0.197 against `indonesia_finance_complete.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `indonesia_finance_complete.txt` (chunk `indonesia_finance_complete__001`, score 0.197, market: indonesia, PII redacted: False) — "PANDUAN PEMBIAYAAN KONSUMEN INDONESIA (Consumer Finance Guide — Bahasa Indonesia) TENTANG INDUSTRI PEMBIAYAAN: Perusahaan pembiayaan (multifinance) di Indonesia..."
  2. `indonesia_consumer_finance_script.txt` (chunk `indonesia_consumer_finance_script__001`, score 0.140, market: indonesia, PII redacted: False) — "SKRIP AGEN — PEMBIAYAAN KONSUMEN INDONESIA Bahasa: Bahasa Indonesia (percakapan, dengan loanword Inggris yang natural) Sektor: Multifinance / Cicilan Konsumen P..."
  3. `indonesia_finance_complete.txt` (chunk `indonesia_finance_complete__002`, score 0.123, market: indonesia, PII redacted: False) — "financing/credit dari lembaga non-bank (NBFC). DENDA KETERLAMBATAN: Biaya yang dikenakan jika pembayaran dilakukan setelah jatuh tempo. Biasanya 0.5-1% per hari..."
### Q7 — Is pre-existing disease covered immediately under a new health insurance policy?

- **Category under test:** faq
- **Verdict:** correct
- **Why:** Top match score 0.297 against `health_insurance_india_complete.txt` is a strong lexical match.
- **Top-3 retrieved chunks:**
  1. `health_insurance_india_complete.txt` (chunk `health_insurance_india_complete__002`, score 0.297, market: india, PII redacted: False) — "Very cost-effective way to increase total coverage 5. GROUP HEALTH INSURANCE - Provided by employer to employees - No medical tests (usually) - Coverage stops w..."
  2. `kyc_and_regulatory_guide.txt` (chunk `kyc_and_regulatory_guide__004`, score 0.202, market: india, PII redacted: False) — "Health claims (reimbursement): Within 30 days of document submission 3. PORTABILITY: Health insurance can be ported to another insurer - Apply 45 days before re..."
  3. `health_insurance_india_complete.txt` (chunk `health_insurance_india_complete__004`, score 0.149, market: india, PII redacted: False) — "exhausted during the year. Available in most premium health plans. ROOM RENT LIMIT: Maximum daily room rent covered (often 1-2% of sum insured). Single private..."
### Q8 — What happens if a customer misses an EMI / cicilan payment date?

- **Category under test:** policy
- **Verdict:** partially correct
- **Why:** Top match score 0.141 against `insurance_product_faq_internal.txt` is weak — the source is topically related but may not fully answer the question.
- **Top-3 retrieved chunks:**
  1. `insurance_product_faq_internal.txt` (chunk `insurance_product_faq_internal__001`, score 0.141, market: india, PII redacted: False) — "INSURANCE PRODUCT FAQ — AGENT REFERENCE GUIDE v1.8 Q: What is a rider? A: A rider is an optional add-on benefit that can be attached to a base insurance policy..."
  2. `home_credit_india_complete.txt` (chunk `home_credit_india_complete__003`, score 0.059, market: india, PII redacted: False) — "Q: What if I miss an EMI? A: A late payment fee will be charged. Multiple missed EMIs can affect your CIBIL score. If you anticipate difficulty, contact us imme..."
  3. `voice_agent_conversation_scenarios.txt` (chunk `voice_agent_conversation_scenarios__001`, score 0.059, market: india, PII redacted: False) — "VOICE AGENT TEST SCENARIOS For Q1 (Voice Agent Testing) and Q4 (Signal Extraction Training) === SCENARIO 1: Cooperative Customer — Loan Qualification === AGENT:..."

## Aggregate retrieval latency (this run, offline TF-IDF path)

- Queries run: 8
- Min: 0.60 ms
- Max: 0.92 ms
- Mean: 0.70 ms

These are real measurements of this offline fallback path on this machine, not the production Gemini-embedding path. They demonstrate the retrieval, citation, and scoring *mechanism* end-to-end.