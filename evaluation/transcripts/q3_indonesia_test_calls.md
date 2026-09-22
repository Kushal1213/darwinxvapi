# Question 3 — Indonesia Multifinance Voice Bot ("Budi") Test Calls

**Sector:** Multifinance / consumer finance (motorcycle installment financing) · **Languages:** formal & colloquial Bahasa Indonesia, finance English loanwords

Same environment caveat as Q1/Q3-PH: scripted transcripts, not live recordings (no telephony/ASR/TTS
reachable in this sandbox). Terminology and phrasing are drawn from
`knowledge-base/raw/indonesia_finance_complete.txt` and `indonesia_consumer_finance_script.txt`.

---

## Call 1 — Qualification, colloquial speech + finance loanwords

| Turn | Speaker | Text |
|---|---|---|
| 1 | Agent | Selamat siang, Bapak/Ibu. Saya Budi dari layanan pembiayaan motor. Saya menghubungi terkait pengajuan cicilan motor Bapak/Ibu. Apakah ada waktu sebentar? |
| 2 | Customer | Oh iya bisa, tapi buruan ya, lagi di jalan nih. |
| 3 | Agent | Baik, saya usahakan cepat. Untuk motor yang Bapak/Ibu ajukan, DP minimum yang tersedia adalah 20% dari harga motor. Sudah ada gambaran DP berapa yang bisa disiapkan? |
| 4 | Customer | Kayaknya bisa lah 2 jutaan, motornya sekitar 18 juta soalnya. |
| 5 | Agent | Oke, jadi kalau DP 2 juta dari harga 18 juta itu sekitar 11%, di bawah minimum 20% yang dibutuhkan — jadi minimal DP-nya sekitar 3,6 juta. Untuk sisa pembiayaannya, tenor yang tersedia 12, 24, 36, atau 48 bulan. Tenor berapa yang paling nyaman buat cicilan bulanannya? |
| 6 | Customer | Yang 24 bulan aja kali ya, biar cicilannya nggak kegedean. |
| 7 | Agent | Siap, saya catat 24 bulan. Nanti tim survey akan menghubungi untuk verifikasi data — biasanya cuma butuh KTP, slip gaji, sama rekening koran 3 bulan terakhir. Ada yang mau ditanyakan? |
| 8 | Customer | Gak ada, oke makasih ya. |

**Grounding citations:** turn 3 & 5's DP-minimum math is grounded in `indonesia_finance_complete.txt` ("DP minimum: 20% untuk motor... Semakin besar DP, semakin kecil cicilan bulanan"); turn 5's tenor options and turn 7's document list match `indonesia_consumer_finance_script.txt` ("Tenor berapa bulan yang paling nyaman" / "Dokumen yang diperlukan hanya KTP, slip gaji, dan rekening koran 3 bulan terakhir").

**Localization vs. literal translation — example 1:** the agent does real arithmetic in-conversation (2 juta / 18 juta ≈ 11%, below the 20% minimum) rather than a canned "your DP is too low" line — this reflects the *qualification logic* behind the localized term, not just the vocabulary. A literal-translation approach would just say "down payment insufficient" without doing the market-specific eligibility math the way a real Indonesian financing agent would on this call.

**Localization vs. literal translation — example 2:** the customer's colloquial register ("Kayaknya bisa lah 2 jutaan... soalnya", "Gak ada, oke makasih ya") is met with polite-but-not-overly-formal Bahasa ("Oke, jadi...", "Siap, saya catat...") — mirroring natural informal customer-service Indonesian, not the stiffly formal Bahasa Baku a direct translation of an English corporate script would produce.

---

## Call 2 — Overdue installment / collections call, objection, regional-accent note

| Turn | Speaker | Text |
|---|---|---|
| 1 | Agent | Selamat sore, Bapak Slamet. Saya Budi menghubungi terkait angsuran motor Bapak yang jatuh tempo tanggal 10 kemarin. |
| 2 | Customer | *(Javanese-inflected Indonesian, regional accent — represented in text as dialect-influenced phrasing)* Waduh, nggih pak, kula pun ngertos, tapi kok bunganya kok gede tenan ya, mahal je. |
| 3 | Agent | Saya mengerti keberatan Bapak soal bunga. Untuk denda keterlambatan sendiri sekitar 0,5 sampai 1% per hari dari jumlah angsuran tertunggak — jadi memang semakin cepat dibayar, semakin kecil dendanya. Apakah ada kendala yang membuat Bapak belum bisa bayar? |
| 4 | Customer | Nggih, kemarin usahanya lagi sepi, jadi belum ada uang cukup je. |
| 5 | Agent | Baik, terima kasih sudah jujur, Pak. Kami punya program restrukturisasi untuk nasabah yang mengalami kesulitan keuangan — opsinya bisa perpanjangan tenor atau pengurangan cicilan bulanan sementara. Mau saya jadwalkan tim untuk membahas opsi ini? |
| 6 | Customer | Nggih pak, monggo, tolong dibantu nggih. |
| 7 | Agent | Siap Pak, akan saya jadwalkan. Terima kasih atas kesabarannya. |
| 8 | Customer | Wah kok lama banget urusannya, mending ngomong sama atasannya langsung bisa gak? |
| 9 | Agent | Tentu bisa, Pak. Saya sambungkan Bapak dengan supervisor kami sekarang. Sebelum saya transfer, saya catat dulu: nasabah mengalami kesulitan usaha, menunggak angsuran, dan sudah diarahkan ke program restrukturisasi tapi ingin bicara langsung dengan supervisor. |
| 10 | Customer | Nggih, matur nuwun pak. |

**Grounding citations:** turn 3's late-fee figure and turn 5's restructuring options are pulled directly from `indonesia_finance_complete.txt` ("DENDA KETERLAMBATAN: ...0.5-1% per hari..." and "RESTRUKTURISASI: ...perpanjangan tenor, pengurangan cicilan, atau penundaan pembayaran sementara").

**Localization vs. literal translation — example 3:** the customer's regional (Javanese-influenced) Indonesian — particles like *"nggih," "kula," "monggo," "je"* — is not corrected or normalized by the agent into standard Jakarta Bahasa; the agent responds in standard formal Bahasa (appropriate for a financial-compliance conversation) while *comprehending* the regional register rather than requiring the customer to code-switch to standard Indonesian, which is the more natural real-world pattern (agents are trained to understand regional variants; customers are not expected to switch registers on a collections call).

**Human escalation (turn 8–9):** when the customer requests to speak directly to a supervisor, the agent stays in Bahasa Indonesia for the entire escalation sequence — including the structured handoff summary in turn 9 ("nasabah mengalami kesulitan usaha, menunggak angsuran, dan sudah diarahkan ke program restrukturisasi tapi ingin bicara langsung dengan supervisor"). No unexpected English switch occurs, satisfying the "remain in the customer's language and register" requirement even during the handoff.

## Known gap — regional accent testing
This sandbox has no ASR provider available, so the "at least one regional accent outside
standard Jakarta speech" requirement is demonstrated here only at the **text/dialect level**
(Javanese-influenced lexical markers), not as an actual audio accent test against a live ASR
model. A real evaluation needs recorded audio from a non-Jakarta speaker run through the
configured ASR (Deepgram/Google STT) to report actual word-error-rate by accent — tracked in
`known_limitations.md`.
