"""
Darwix Knowledge Base — Complete Document Downloader
Covers ALL assignment requirements:
  Q1: Voice agent KB (loans + insurance + qualification rules)
  Q2: Production KB (mixed types, PII examples, policy docs, FAQs)
  Q3: Philippines (bancassurance) + Indonesia (consumer finance)
  Q4: Conversation scenario content for signal extraction

Usage:
    cd e:\\Darwix_Voice_Intelligence_Suite
    python knowledge-base/download_docs.py
"""

import os
import time
import json
import requests
from pathlib import Path

RAW_DIR = Path("knowledge-base/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
}

# =============================================================
# SECTION A — PDFs (direct download)
# =============================================================
PDF_DOCS = [

    # ── INDIA › LIFE INSURANCE ────────────────────────────────
    {
        "name": "lic_jeevan_anand_brochure.pdf",
        "url": "https://licindia.in/sites/default/files/2024-02/LIC-Jeevan-Anand-Plan-915-Sales-Brochure.pdf",
        "category": "insurance",
        "market": "india",
        "title": "LIC Jeevan Anand Plan 915 — Sales Brochure",
        "note": "Premium, sum assured, bonus, maturity — core Q1 insurance terms",
    },
    {
        "name": "lic_jeevan_umang_brochure.pdf",
        "url": "https://licindia.in/sites/default/files/2024-03/LIC-Jeevan-Umang-945-Brochure.pdf",
        "category": "insurance",
        "market": "india",
        "title": "LIC Jeevan Umang Plan 945 — Brochure",
        "note": "Whole life + money-back plan with survival benefits",
    },
    {
        "name": "lic_tech_term_plan.pdf",
        "url": "https://licindia.in/sites/default/files/2024-01/LIC-Tech-Term-854-Sales-Brochure.pdf",
        "category": "insurance",
        "market": "india",
        "title": "LIC Tech Term Plan — Term Insurance Brochure",
        "note": "Pure term insurance — eligibility, premium table, death benefit",
    },

    # ── INDIA › HEALTH INSURANCE ──────────────────────────────
    {
        "name": "star_health_comprehensive_policy.pdf",
        "url": "https://www.starhealth.in/sites/default/files/Star%20Comprehensive%20Insurance%20Policy%20Wordings.pdf",
        "category": "insurance",
        "market": "india",
        "title": "Star Health Comprehensive Insurance — Policy Wordings",
        "note": "Hospitalization, PED exclusions, co-pay, room rent limits",
    },
    {
        "name": "irdai_health_insurance_regulations.pdf",
        "url": "https://irdai.gov.in/documents/37343/3076251/IRDA+Health+Insurance+Regulations+2016.pdf",
        "category": "regulation",
        "market": "india",
        "title": "IRDAI Health Insurance Regulations 2016",
        "note": "Regulatory rules on waiting periods, renewal, portability",
    },

    # ── INDIA › REGULATORY ────────────────────────────────────
    {
        "name": "rbi_fair_practices_lenders.pdf",
        "url": "https://rbidocs.rbi.org.in/rdocs/Notification/PDFs/52623.pdf",
        "category": "regulation",
        "market": "india",
        "title": "RBI Fair Practices Code for Lenders",
        "note": "Loan sanction, disclosure, recovery — critical for Q1 grounding",
    },
    {
        "name": "rbi_kyc_master_direction.pdf",
        "url": "https://rbidocs.rbi.org.in/rdocs/MasterDirection/PDFs/KYCAMP1F6F2A43A1A74CDB94A40FD5B9A56E5D.PDF",
        "category": "regulation",
        "market": "india",
        "title": "RBI KYC Master Direction",
        "note": "Customer identification, document requirements — KYC for loan/insurance",
    },
    {
        "name": "irdai_policyholder_protection.pdf",
        "url": "https://irdai.gov.in/documents/37343/1543165/IRDA-PPR-Regulations-2002.pdf",
        "category": "regulation",
        "market": "india",
        "title": "IRDAI Policyholder Protection Regulations 2002",
        "note": "Customer rights, grievance, free-look period — objection handling",
    },

    # ── PHILIPPINES › INSURANCE COMMISSION ───────────────────
    {
        "name": "ph_insurance_commission_circular_2022.pdf",
        "url": "https://www.insurance.gov.ph/wp-content/uploads/2022/08/IC-Circular-Letter-No.-2022-59.pdf",
        "category": "insurance",
        "market": "philippines",
        "title": "Insurance Commission Philippines — Circular Letter 2022-59",
        "note": "Filipino insurance regulations — English, directly relevant for Q3 PH bot",
    },
    {
        "name": "ph_bsp_bancassurance_circular.pdf",
        "url": "https://www.bsp.gov.ph/Regulations/Issuances/2011/c688.pdf",
        "category": "insurance",
        "market": "philippines",
        "title": "BSP Circular 688 — Bancassurance Guidelines Philippines",
        "note": "Bank referral, agency model, bancassurance — key Q3 PH terms",
    },

    # ── INDONESIA › OJK REGULATIONS ──────────────────────────
    {
        "name": "ojk_consumer_protection_regulation.pdf",
        "url": "https://www.ojk.go.id/id/regulasi/Documents/Pages/POJK-Nomor-1-Tahun-2013/SAL%20-%20POJK%20Perlindungan%20Konsumen%20Sektor%20Jasa%20Keuangan.pdf",
        "category": "regulation",
        "market": "indonesia",
        "title": "OJK Peraturan Perlindungan Konsumen Sektor Jasa Keuangan",
        "note": "Consumer finance protection — Bahasa Indonesia — Q3 ID bot grounding",
    },
]


# =============================================================
# SECTION B — Web Pages (scraped HTML)
# =============================================================
WEB_PAGES = [

    # ── INDIA › INSURANCE FAQs ────────────────────────────────
    {
        "url": "https://www.hdfclife.com/insurance-plans/term-insurance-plans/click-2-protect-life",
        "filename": "hdfc_life_click2protect.html",
        "category": "insurance",
        "market": "india",
        "title": "HDFC Life Click2Protect — Term Insurance Plan",
        "note": "Coverage, premium, exclusions, claim process — grounding Q1 insurance agent",
    },
    {
        "url": "https://www.hdfclife.com/faq",
        "filename": "hdfc_life_faq.html",
        "category": "faq",
        "market": "india",
        "title": "HDFC Life Insurance — FAQ",
        "note": "Common policyholder questions — premium, beneficiary, claim, renewal",
    },
    {
        "url": "https://www.sbilife.co.in/en/individual-life-insurance/term-plans/eShield-Next",
        "filename": "sbi_life_eshield.html",
        "category": "insurance",
        "market": "india",
        "title": "SBI Life eShield Next — Term Plan",
        "note": "Sum assured, riders, premium payment terms",
    },
    {
        "url": "https://www.bajajallianzlife.com/life-insurance-faqs.html",
        "filename": "bajaj_life_faq.html",
        "category": "faq",
        "market": "india",
        "title": "Bajaj Allianz Life Insurance — FAQ",
        "note": "Free-look, lapse, revival, surrender — objection handling content",
    },

    # ── INDIA › LOAN / CONSUMER FINANCE FAQs ─────────────────
    {
        "url": "https://www.homecredit.co.in/en/faq",
        "filename": "home_credit_india_faq.html",
        "category": "faq",
        "market": "india",
        "title": "Home Credit India — FAQ (Darwix client!)",
        "note": "EMI, eligibility, pre-payment, late fees — realistic loan agent content",
    },
    {
        "url": "https://www.bajajfinserv.in/personal-loan-faqs",
        "filename": "bajaj_personal_loan_faq.html",
        "category": "faq",
        "market": "india",
        "title": "Bajaj Finserv — Personal Loan FAQ",
        "note": "Eligibility, income criteria, documents, EMI — Q1 loan qualification",
    },
    {
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?folderPath=/Common/Personal-Loan/&fileName=Personal-Loan-FAQs.html",
        "filename": "hdfc_personal_loan_faq.html",
        "category": "faq",
        "market": "india",
        "title": "HDFC Bank — Personal Loan FAQ",
        "note": "Min income, tenure, processing fee — grounding loan voice agent",
    },
    {
        "url": "https://www.tatacapital.com/personal-loan/faqs.html",
        "filename": "tata_capital_loan_faq.html",
        "category": "faq",
        "market": "india",
        "title": "Tata Capital — Personal Loan FAQ",
        "note": "Eligibility, documents, disbursement — another Darwix-domain client",
    },
    {
        "url": "https://www.hdfcbank.com/content/bbp/repositories/723fb80a-2dde-42a3-9793-7ae1be57c87f/?folderPath=/Common/Home-Loan/&fileName=Home-Loan-FAQs.html",
        "filename": "hdfc_home_loan_faq.html",
        "category": "faq",
        "market": "india",
        "title": "HDFC Bank — Home Loan FAQ",
        "note": "LAP, loan against property terms — Q1 business loan qualification",
    },

    # ── INDIA › OBJECTION + QUALIFICATION RULES ───────────────
    {
        "url": "https://www.policybazaar.com/life-insurance/term-insurance/articles/term-insurance-faq/",
        "filename": "policybazaar_term_faq.html",
        "category": "faq",
        "market": "india",
        "title": "PolicyBazaar — Term Insurance FAQ",
        "note": "What if I miss premium? What is rider? Objection-handling gold",
    },
    {
        "url": "https://www.insurancedekho.com/health-insurance/articles/health-insurance-faqs",
        "filename": "insurance_dekho_health_faq.html",
        "category": "faq",
        "market": "india",
        "title": "InsuranceDekho — Health Insurance FAQ",
        "note": "Cashless, PED, waiting period, co-pay — Q1 health insurance flow",
    },
    {
        "url": "https://cleartax.in/s/personal-loan-eligibility",
        "filename": "cleartax_loan_eligibility.html",
        "category": "policy",
        "market": "india",
        "title": "ClearTax — Personal Loan Eligibility Guide",
        "note": "Income criteria, CIBIL score, employment type — qualification logic",
    },

    # ── PHILIPPINES › BANCASSURANCE ───────────────────────────
    {
        "url": "https://www.sunlife.com.ph/en/insurance/life-insurance/",
        "filename": "sunlife_ph_life_insurance.html",
        "category": "insurance",
        "market": "philippines",
        "title": "Sun Life Philippines — Life Insurance Plans",
        "note": "Premium, coverage, beneficiary, rider — Q3 PH bot content in English",
    },
    {
        "url": "https://www.sunlife.com.ph/en/tools-and-resources/faqs/",
        "filename": "sunlife_ph_faq.html",
        "category": "faq",
        "market": "philippines",
        "title": "Sun Life Philippines — FAQ",
        "note": "Policy lapse, premium payment, claims — Filipino insurance FAQ",
    },
    {
        "url": "https://www.aia.com.ph/en/individual/products/life-protection.html",
        "filename": "aia_ph_life_protection.html",
        "category": "insurance",
        "market": "philippines",
        "title": "AIA Philippines — Life Protection Plans",
        "note": "Term, whole life, VUL — bancassurance product range for Q3",
    },
    {
        "url": "https://www.bdo.com.ph/personal/insurance/life-insurance",
        "filename": "bdo_bancassurance_ph.html",
        "category": "insurance",
        "market": "philippines",
        "title": "BDO — Bancassurance Life Insurance",
        "note": "Bank referral model, premium, coverage — Q3 PH bancassurance flow",
    },
    {
        "url": "https://www.pnblife.com.ph/individual-plans",
        "filename": "pnb_life_ph_plans.html",
        "category": "insurance",
        "market": "philippines",
        "title": "PNB Life Philippines — Individual Plans",
        "note": "Tagalog-context insurance product descriptions",
    },

    # ── INDONESIA › CONSUMER FINANCE ─────────────────────────
    {
        "url": "https://www.homecredit.co.id/id/faq",
        "filename": "home_credit_indonesia_faq.html",
        "category": "faq",
        "market": "indonesia",
        "title": "Home Credit Indonesia — FAQ (Bahasa Indonesia)",
        "note": "Cicilan, tenor, jatuh tempo, angsuran — key Q3 ID terms in natural Bahasa",
    },
    {
        "url": "https://www.adira.co.id/go/faq",
        "filename": "adira_finance_faq.html",
        "category": "faq",
        "market": "indonesia",
        "title": "Adira Finance — FAQ (Bahasa Indonesia)",
        "note": "DP, tenor, cicilan motor/mobil — consumer finance loanwords",
    },
    {
        "url": "https://www.ojk.go.id/id/kanal/iknb/Pages/Perusahaan-Pembiayaan.aspx",
        "filename": "ojk_multifinance_page.html",
        "category": "regulation",
        "market": "indonesia",
        "title": "OJK — Perusahaan Pembiayaan (Multifinance)",
        "note": "Official OJK multifinance page — regulatory context in Bahasa",
    },
    {
        "url": "https://www.kredivo.com/id/faq",
        "filename": "kredivo_faq_id.html",
        "category": "faq",
        "market": "indonesia",
        "title": "Kredivo — FAQ Bahasa Indonesia",
        "note": "Pinjaman, cicilan, pembiayaan digital — modern Indonesian finance terms",
    },
    {
        "url": "https://www.akulaku.com/id/help/",
        "filename": "akulaku_help_id.html",
        "category": "faq",
        "market": "indonesia",
        "title": "Akulaku — Help Center Bahasa Indonesia",
        "note": "Angsuran, denda, jatuh tempo — collections and overdue language",
    },
]


# =============================================================
# SECTION C — Inline Mock Documents (created locally)
# These simulate PII-containing / inconsistent data for Q2
# =============================================================
MOCK_DOCS = [
    {
        "filename": "loan_qualification_rules.txt",
        "category": "policy",
        "market": "india",
        "title": "Internal Loan Qualification Rules",
        "content": """LOAN QUALIFICATION RULES — INTERNAL POLICY v2.3
Last Updated: January 2024

PERSONAL LOAN ELIGIBILITY:
- Minimum age: 21 years | Maximum age: 58 years (at loan maturity)
- Minimum monthly income: INR 25,000 (salaried) | INR 40,000 (self-employed)
- Minimum CIBIL score: 700 (preferred 750+)
- Employment stability: Minimum 2 years with current employer
- Maximum loan amount: INR 50,00,000
- Loan tenure: 12 to 60 months
- Interest rate: 10.5% to 24% per annum (based on profile)
- Processing fee: 2% of loan amount + GST

DOCUMENTS REQUIRED:
- PAN card (mandatory)
- Aadhaar card OR Voter ID OR Passport
- Last 3 months salary slips
- Last 6 months bank statements
- Form 16 (last 2 years)
- Employment letter on company letterhead

LOAN AGAINST PROPERTY (LAP):
- Minimum property value: INR 20 lakhs
- Maximum LTV ratio: 70% of property value
- Tenure: Up to 15 years
- Interest rate: 9.5% to 14% per annum

DISQUALIFICATION CONDITIONS:
- Active NPA accounts
- More than 2 active loans
- Monthly obligations exceeding 50% of income
- Recent defaults in last 24 months

ESCALATION TRIGGERS:
- Customer mentions legal action → escalate immediately
- Claimed income > INR 5 lakhs/month without documentation → flag for verification
- Requests waiver on processing fee → supervisor approval required

NOTE: All interest rates subject to RBI guidelines and market conditions.
Rates quoted over call must be confirmed via email/SMS within 24 hours.
""",
    },
    {
        "filename": "insurance_product_faq_internal.txt",
        "category": "faq",
        "market": "india",
        "title": "Insurance Product FAQ — Internal Agent Reference",
        "content": """INSURANCE PRODUCT FAQ — AGENT REFERENCE GUIDE v1.8

Q: What is a rider?
A: A rider is an optional add-on benefit that can be attached to a base insurance policy for additional coverage. Common riders include: Accidental Death Benefit, Critical Illness Rider, Waiver of Premium Rider, Term Rider.

Q: What is the free-look period?
A: The free-look period is 15 days from receipt of the policy document (30 days for policies sold through distance marketing). During this period, the customer can return the policy for a full refund minus medical examination costs and stamp duty.

Q: What happens if a customer misses a premium payment?
A: A grace period of 30 days (for monthly premium) or 30 days (for annual premium) is provided. If premium is not paid within the grace period, the policy lapses. A lapsed policy can be revived within 2 years by paying all outstanding premiums with interest (typically 8% per annum).

Q: What is sum assured?
A: Sum assured is the guaranteed amount the insurance company will pay to the nominee/beneficiary upon death of the life insured, or to the policyholder upon maturity of the policy.

Q: Who is a beneficiary/nominee?
A: The nominee is the person designated by the policyholder to receive the death benefit in case of the insured's demise. The nominee should be a family member. Can be changed during the policy term.

Q: What is a lapse?
A: A policy lapses when premiums are not paid even after the grace period. A lapsed policy does not provide any death coverage. Revival is possible within 2 years.

Q: What is the claim process?
A: 1. Inform the insurance company within 30 days of the event
   2. Submit claim form along with required documents
   3. Investigation if required (typically completed within 30 days)
   4. Claim settled within 30 days of receiving all documents (IRDAI mandate)

Q: What is UIN number?
A: Unique Identification Number issued by IRDAI to every approved insurance product. Used for policy traceability and regulatory compliance.

COMMON CUSTOMER OBJECTIONS AND RESPONSES:
Objection: "I already have insurance from my employer"
Response: "Group cover from employer typically provides only basic coverage and stops when you leave the job. A personal policy gives you lifelong, portable coverage that you control."

Objection: "Insurance is just a way to make money off me"
Response: "I understand the concern. Let me walk you through exactly what you pay and what coverage you get. The peace of mind it provides for your family is real and measurable."

Objection: "I'll think about it and call back"
Response: "Of course, take your time. May I share the policy document on your registered email so you have all details handy? I can also schedule a call at your convenient time."
""",
    },
    {
        "filename": "ph_bancassurance_script_tagalog.txt",
        "category": "script",
        "market": "philippines",
        "title": "Philippines Bancassurance — Agent Script (Taglish)",
        "content": """BANCASSURANCE AGENT SCRIPT — PHILIPPINES MARKET
Language: Taglish (natural code-switching)
Sector: Life Insurance via Bank Channel

OPENING:
"Magandang araw po! Ito po si [Agent Name] mula sa [Bank Name]. Tumatawag po ako para sa inyong life insurance coverage na kasama sa inyong bank account. Mayroon po ba kayong ilang minuto para pag-usapan ito?"

QUALIFICATION QUESTIONS:
"Para malaman po namin kung anong coverage ang pinaka-akma para sa inyo, may ilang tanong lang po ako."
- "Ilang taon na po kayo?" (Age verification)
- "Nagtatrabaho po ba kayo o may sariling negosyo?" (Employment status)
- "Mayroon na po ba kayong existing na life insurance?" (Existing coverage)
- "Magkano po ang budget ninyo para sa monthly premium?" (Affordability)

KEY PRODUCT TERMS (use naturally, don't force):
- Premium = "bayad sa insurance" or "monthly premium"
- Beneficiary = "benepisyaryo" or "ang tatanggap ng pera"
- Rider = "additional coverage" or "dagdag na proteksyon"
- Coverage = "protection" or "halaga ng proteksyon"
- Lapse = "mag-expire ang policy" or "mawalan ng coverage"
- Sum assured = "guaranteed na halaga" or "death benefit"
- Bank referral = "inirekomenda ng inyong bangko"

OBJECTION HANDLING:
Objection: "Mahal naman ang premium"
Response: "Naiintindihan ko po. Pero isipin po natin — ang [amount] kada buwan ay katumbas ng proteksyon na [sum assured] para sa inyong pamilya. Mas mura po ito kaysa sa aabutin ng gastos kung walang insurance."

Objection: "Hindi ko kailangan, bata pa ako"
Response: "Tama po kayo na bata pa kayo — at iyon mismo ang dahilan kung bakit mas mababa ang inyong premium ngayon. Habang tumatanda, mas mahal na ang insurance. Ang mga nasa edad ninyo ang pinaka-ideal na mag-avail."

Objection: "Mag-iisip muna ako"
Response: "Sige po, walang problema. Para naman hindi kayo mag-aaksaya ng oras sa paghanap, puwede ko pong ipadala sa inyo ang lahat ng detalye sa inyong email. Kailan po ba kayo pwede matawagan ulit?"

COMPLIANCE REMINDERS:
- Always confirm customer's recorded consent before discussing premium amounts
- Never guarantee specific returns or investment performance
- Always mention the free-look period (15 days to cancel without penalty)
- Document all commitments made during the call

CODE-SWITCHING EXAMPLES (natural Taglish):
- "Your premium po ay due next month — nakatanggap na po ba kayo ng notice?"
- "Ang benefit ninyo ay tax-free po, so lahat ng makukuha ng inyong pamilya is fully theirs"
- "Pwede po ninyong i-update ang inyong beneficiary anytime — online or sa branch"
""",
    },
    {
        "filename": "indonesia_consumer_finance_script.txt",
        "category": "script",
        "market": "indonesia",
        "title": "Indonesia Consumer Finance — Agent Script (Bahasa)",
        "content": """SKRIP AGEN — PEMBIAYAAN KONSUMEN INDONESIA
Bahasa: Bahasa Indonesia (percakapan, dengan loanword Inggris yang natural)
Sektor: Multifinance / Cicilan Konsumen

PEMBUKAAN:
"Selamat pagi/siang/sore, Bapak/Ibu [Nama]. Saya [Nama Agen] dari [Perusahaan]. 
Saya menghubungi Bapak/Ibu mengenai fasilitas pembiayaan yang tersedia untuk Anda. 
Apakah Bapak/Ibu memiliki waktu sebentar?"

ISTILAH KEUANGAN UTAMA (gunakan secara natural):
- Cicilan = angsuran bulanan yang harus dibayarkan
- DP (Down Payment) = uang muka pembelian
- Tenor = jangka waktu pinjaman/pembiayaan (dalam bulan)
- Jatuh tempo = tanggal batas pembayaran cicilan
- Angsuran = sinonim cicilan, lebih formal
- Pembiayaan = financing, kredit dari lembaga non-bank
- Denda = penalti keterlambatan pembayaran
- Pelunasan dipercepat = early repayment / pelunasan sebelum tenor berakhir
- Survey = proses verifikasi data nasabah di lapangan

PERTANYAAN KUALIFIKASI:
- "Bapak/Ibu sedang bekerja atau memiliki usaha sendiri?"
- "Berapa kira-kira penghasilan bulanan Bapak/Ibu?"
- "Untuk pembelian apa Bapak/Ibu membutuhkan pembiayaan ini?"
- "Sudah ada gambaran berapa DP yang bisa Bapak/Ibu siapkan?"
- "Tenor berapa bulan yang paling nyaman untuk Bapak/Ibu?"

PENANGANAN KEBERATAN:
Keberatan: "Bunganya terlalu tinggi"
Respons: "Saya mengerti, Bapak/Ibu. Kami memiliki program cicilan 0% untuk pembelian di merchant tertentu. Untuk bunga reguler, kami bisa coba sesuaikan tenor agar angsuran bulanannya lebih ringan. Berapa angsuran yang comfortable untuk Bapak/Ibu?"

Keberatan: "Saya sudah punya cicilan yang banyak"
Respons: "Baik, terima kasih sudah jujur. Untuk memastikan Bapak/Ibu tidak overcommitted, kami akan cek total kewajiban bulanan. Secara umum, total cicilan sebaiknya tidak melebihi 30-40% penghasilan bulanan."

Keberatan: "Prosesnya lama dan ribet"
Respons: "Justru sebaliknya, Bapak/Ibu. Proses approval kami sekarang bisa selesai dalam 1 hari kerja. Dokumen yang diperlukan hanya KTP, slip gaji, dan rekening koran 3 bulan terakhir. Survey juga bisa dijadwalkan sesuai waktu Bapak/Ibu."

SKENARIO JATUH TEMPO:
"Bapak/Ibu [Nama], saya ingin menginformasikan bahwa angsuran Bapak/Ibu untuk bulan ini jatuh tempo pada tanggal [X]. Total angsuran yang perlu dibayarkan adalah Rp [jumlah]. Apakah ada yang perlu kami bantu untuk memastikan pembayaran lancar?"

Jika nasabah kesulitan bayar:
"Kami memahami ada situasi yang tidak terduga. Kami memiliki program restrukturisasi yang bisa membantu meringankan cicilan Bapak/Ibu. Boleh saya jelaskan opsi yang tersedia?"

CATATAN COMPLIANCE:
- Selalu konfirmasi identitas nasabah sebelum membahas detail akun
- Rekam persetujuan nasabah untuk setiap komitmen yang dibuat
- Jangan menjanjikan approval sebelum proses verifikasi selesai
- Informasikan biaya denda keterlambatan secara transparan
""",
    },
    {
        "filename": "voice_agent_conversation_scenarios.txt",
        "category": "scenarios",
        "market": "india",
        "title": "Voice Agent Test Conversation Scenarios — Q1 & Q4",
        "content": """VOICE AGENT TEST SCENARIOS
For Q1 (Voice Agent Testing) and Q4 (Signal Extraction Training)

=== SCENARIO 1: Cooperative Customer — Loan Qualification ===
AGENT: Good afternoon, this is Aria from SecureFinance. Am I speaking with Rahul Sharma?
CUSTOMER: Yes, speaking.
AGENT: Thank you Mr. Sharma. I'm calling regarding your home loan inquiry. Do you have a few minutes?
CUSTOMER: Yes, go ahead.
AGENT: Great! To check your eligibility, may I ask your current monthly income?
CUSTOMER: I earn about 85,000 rupees per month. I work at an IT company.
AGENT: Excellent. And what loan amount are you looking at?
CUSTOMER: Around 50 lakhs for a 3BHK apartment in Pune.
AGENT: That works well. With your income, your loan eligibility should be around 45-55 lakhs. Your EMI at current rates would be approximately 42,000 per month for a 20-year tenure.
CUSTOMER: That sounds manageable. What documents do I need?
AGENT: You'll need your PAN card, Aadhaar, last 3 months salary slips, 6 months bank statements, and Form 16.
[SIGNALS: intent=loan_inquiry, buying_signal=true, sentiment=positive, confidence=0.9]

=== SCENARIO 2: Customer Objection — Insurance ===
AGENT: Good morning! This is Priya from InsureLife. I'm calling about our term insurance plan that offers 1 crore coverage.
CUSTOMER: Not interested. I already have LIC.
AGENT: I understand, Mr. Gupta. May I ask what type of LIC policy you have? Many customers find that their existing coverage doesn't fully protect their family's needs.
CUSTOMER: I have a money-back policy. Why do I need more?
AGENT: Money-back policies are great for savings, but they typically offer lower sum assured. A separate term plan ensures your family receives 1 crore even if something happens to you. And the premium is quite affordable — starting at just 800 rupees per month for your age group.
CUSTOMER: Hmm, 800 rupees doesn't sound too bad actually.
[SIGNALS: intent=insurance_inquiry, objection_handled=true, buying_signal=true, sentiment=neutral_to_positive]

=== SCENARIO 3: Incomplete Details — Missing Information ===
AGENT: Hello, I'm calling about your loan pre-approval. Can I confirm your income?
CUSTOMER: I run a small business.
AGENT: Great. What's your approximate monthly income from the business?
CUSTOMER: It varies. Sometimes 30,000, sometimes 80,000.
AGENT: I understand self-employed income can vary. For loan eligibility, we typically consider the average. Do you file ITR?
CUSTOMER: Not always. Last 2 years I didn't file.
AGENT: That might be a challenge as lenders require 2 years of ITR for self-employed applicants. However, there are options — some NBFCs consider bank statement income. Would you like me to check those options?
[SIGNALS: intent=loan_inquiry, missing_information=true, qualification_status=partial, confidence=0.6]

=== SCENARIO 4: Out-of-Scope Question ===
AGENT: Hello! Aria here from QuickLoans. How can I help you today?
CUSTOMER: Hi, can you tell me the current stock price of HDFC Bank?
AGENT: I appreciate the question, but stock prices are outside what I can help with — that's a bit outside my specialty! I'm focused on loan products. Were you perhaps thinking about an HDFC Bank loan product? I'd be happy to help with that.
CUSTOMER: Oh no, I just got confused. I actually wanted to ask about a personal loan.
AGENT: Perfect, I can definitely help with that! What loan amount are you considering?
[SIGNALS: intent=out_of_scope then loan_inquiry, recovery=true]

=== SCENARIO 5: Human Escalation ===
AGENT: Good evening! This is Aria. I'm following up on your loan application.
CUSTOMER: I've been waiting 2 weeks and nobody is helping me! I submitted all documents!
AGENT: I sincerely apologize for the delay, Mr. Kumar. I completely understand how frustrating this must be.
CUSTOMER: This is ridiculous. I want to speak to a manager right now.
AGENT: Absolutely, I'll connect you with our senior specialist immediately. Before I do, let me note your concern so they're fully briefed: you submitted documents 2 weeks ago and haven't received an update. Is there anything else I should add?
CUSTOMER: Tell them I have a competing offer from another bank expiring in 2 days!
[SIGNALS: intent=escalation_request, frustration=high, compliance_risk=low, urgency=high, escalate=true]

=== SCENARIO 6: Rising Frustration — Compliance Risk ===
AGENT: Hello, calling about your overdue EMI payment.
CUSTOMER: I know I'm late. I don't have money right now.
AGENT: I understand. We do have restructuring options available—
CUSTOMER: You people keep calling me 5 times a day! That's harassment!
AGENT: I sincerely apologize if our calls have felt excessive. By regulation, we're required to—
CUSTOMER: I'll complain to RBI about this.
[SIGNALS: compliance_risk=true, frustration=0.9, callback_needed=false, escalate=true, nudge="Acknowledge concern, remind of RBI-compliant call frequency policy, offer restructuring"]
""",
    },
]


# =============================================================
# DOWNLOAD FUNCTIONS
# =============================================================

def download_pdf(doc: dict) -> bool:
    filepath = RAW_DIR / doc["name"]
    if filepath.exists() and filepath.stat().st_size > 1000:
        print(f"  ✓ Already exists: {doc['name']}")
        return True
    try:
        print(f"  ↓ {doc['name']} ...")
        r = requests.get(doc["url"], headers=HEADERS, timeout=30, stream=True)
        r.raise_for_status()
        with open(filepath, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        size_kb = filepath.stat().st_size // 1024
        print(f"  ✅ Saved ({size_kb} KB): {doc['name']}")
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {doc['name']}")
        print(f"     Error: {e}")
        print(f"     ⚠️  Manual download: {doc['url']}")
        return False


def scrape_page(page: dict) -> bool:
    filepath = RAW_DIR / page["filename"]
    if filepath.exists() and filepath.stat().st_size > 500:
        print(f"  ✓ Already exists: {page['filename']}")
        return True
    try:
        print(f"  ↓ {page['title']} ...")
        r = requests.get(page["url"], headers=HEADERS, timeout=20)
        r.raise_for_status()
        filepath.write_text(r.text, encoding="utf-8")
        size_kb = filepath.stat().st_size // 1024
        print(f"  ✅ Saved ({size_kb} KB): {page['filename']}")
        return True
    except Exception as e:
        print(f"  ❌ FAILED: {page['title']}")
        print(f"     Error: {e}")
        return False


def create_mock_docs():
    created = 0
    for doc in MOCK_DOCS:
        filepath = RAW_DIR / doc["filename"]
        if not filepath.exists():
            filepath.write_text(doc["content"], encoding="utf-8")
            print(f"  ✅ Created mock: {doc['filename']}")
            created += 1
        else:
            print(f"  ✓ Already exists: {doc['filename']}")
    return created


def save_manifest(pdf_results, web_results):
    manifest = {
        "pdfs": [
            {**{k: v for k, v in doc.items() if k != "note"}, "downloaded": ok}
            for doc, ok in zip(PDF_DOCS, pdf_results)
            if (RAW_DIR / doc["name"]).exists()
        ],
        "web_pages": [
            {**{k: v for k, v in page.items() if k != "note"}, "scraped": ok}
            for page, ok in zip(WEB_PAGES, web_results)
            if (RAW_DIR / page["filename"]).exists()
        ],
        "mock_docs": [
            {"file": doc["filename"], "category": doc["category"],
             "market": doc["market"], "title": doc["title"]}
            for doc in MOCK_DOCS
        ],
    }
    (RAW_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == "__main__":
    print("=" * 65)
    print("  Darwix KB Downloader — Full Assignment Coverage")
    print("=" * 65)

    print(f"\n📄 Downloading {len(PDF_DOCS)} PDFs...")
    pdf_results = []
    for doc in PDF_DOCS:
        ok = download_pdf(doc)
        pdf_results.append(ok)
        time.sleep(0.5)

    print(f"\n🌐 Scraping {len(WEB_PAGES)} web pages...")
    web_results = []
    for page in WEB_PAGES:
        ok = scrape_page(page)
        web_results.append(ok)
        time.sleep(0.5)

    print(f"\n📝 Creating {len(MOCK_DOCS)} mock documents...")
    create_mock_docs()

    manifest = save_manifest(pdf_results, web_results)
    total = len(manifest["pdfs"]) + len(manifest["web_pages"]) + len(manifest["mock_docs"])

    print(f"\n{'='*65}")
    print(f"✅ Done! {total} documents ready for ingestion")
    print(f"   PDFs:       {sum(pdf_results)}/{len(PDF_DOCS)}")
    print(f"   Web pages:  {sum(web_results)}/{len(WEB_PAGES)}")
    print(f"   Mock docs:  {len(MOCK_DOCS)}/{len(MOCK_DOCS)} (always created)")
    print(f"\n📋 Coverage:")
    print(f"   🇮🇳 India (insurance + loans + regulation + FAQs)")
    print(f"   🇵🇭 Philippines (bancassurance + life insurance)")
    print(f"   🇮🇩 Indonesia (consumer finance in Bahasa)")
    print(f"   📞 Test scenarios (Q1 test cases + Q4 signal training)")
    print(f"\n🚀 Next step:")
    print(f"   Start ingestion service, then run: python knowledge-base/ingest_all.py")
    print(f"{'='*65}")
