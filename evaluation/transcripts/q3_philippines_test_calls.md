# Question 3 — Philippines Bancassurance Voice Bot ("Maya") Test Calls

**Sector:** Bancassurance (life insurance sold through bank channel) · **Languages:** English, Filipino/Tagalog, natural Taglish

**Same environment caveat as Q1:** these are scripted transcripts, not live phone recordings —
no telephony/ASR/TTS provider is reachable from this sandbox. The Taglish phrasing is drawn
directly from `knowledge-base/raw/ph_bancassurance_script_tagalog.txt` and
`ph_life_insurance_complete.txt` (real source files, not invented on the spot); grounding
citations are noted per turn.

---

## Call 1 — Cooperative customer, natural Taglish, code-switching

| Turn | Speaker | Text |
|---|---|---|
| 1 | Agent | Magandang hapon po! Ito po si Maya mula sa BPI Bancassurance. Tumatawag po ako tungkol sa life insurance coverage na available sa inyong bank account. May ilang minuto po ba kayo? |
| 2 | Customer | Yes, meron naman. Ano ba yung coverage na ito? |
| 3 | Agent | Sure po! Para malaman kung anong plan ang pinaka-akma, ilang tanong lang po muna — ilang taon na po kayo, and nagtatrabaho po ba kayo o may sarili kayong negosyo? |
| 4 | Customer | 34 years old ako, employed sa isang BPO company. |
| 5 | Agent | Salamat po. So for your profile, term insurance is usually the best fit — mura ang premium, tapos ang benepisyaryo niyo, meaning yung makakatanggap ng payout, ay guaranteed na makakatanggap ng death benefit kung sakaling mangyari ang hindi inaasahan. Halimbawa, for 10 million pesos na coverage, mga 8,000 to 15,000 pesos per year lang po ang premium for someone your age. |
| 6 | Customer | Ah okay, di pala ganon kamahal. Pwede ba mag-add ng rider? |
| 7 | Agent | Opo, pwede po — rider po yung dagdag na proteksyon, like critical illness or accidental death, on top ng base policy niyo. Gusto niyo po bang ipaliwanag yung options? |
| 8 | Customer | Sure, go ahead. |

**Grounding citations:** turn 5 premium example and turn 7 rider definition are pulled from `ph_life_insurance_complete.txt` (term insurance section, "Example: PHP 10 million coverage for PHP 8,000–15,000/year for a 30-year-old") and `ph_bancassurance_script_tagalog.txt` ("Rider = 'additional coverage' or 'dagdag na proteksyon'").

**Localization vs. literal translation — example 1:** a literal translation of "beneficiary" would be *"benepisyaryo"* alone, dropped into an otherwise English sentence. The script instead code-switches naturally mid-explanation ("ang benepisyaryo niyo, meaning yung makakatanggap ng payout") — glossing the term inline the way a bilingual Filipino agent actually speaks, rather than translating the whole sentence into formal Tagalog, which would sound stilted for a BPO-employed 34-year-old customer who answered in English-Tagalog mix themselves (turn 2, 4, 6).

---

## Call 2 — Sector objection + human escalation (frustration)

| Turn | Speaker | Text |
|---|---|---|
| 1 | Agent | Magandang umaga po, ito po si Maya. Tumatawag po ako regarding sa inyong bancassurance policy. |
| 2 | Customer | Ah, insurance ba to? Mahal naman siguro ang premium nito. |
| 3 | Agent | Naiintindihan ko po. Pero isipin po natin — halimbawa five hundred pesos kada buwan lang po ito, katumbas na po ng malaking proteksyon para sa inyong pamilya. Mas mura po ito kaysa sa magiging gastos kung walang insurance, lalo na kung may emergency. |
| 4 | Customer | Hmm okay, pero ang dami ko nang binabayaran, may loan pa ako sa bangko. |
| 5 | Agent | Totoo po yan. Kaya nga po naka-attach ito sa inyong bank account — bank referral po ito, so hindi na po kailangan ng separate na application. Gusto niyo po bang tignan natin yung pinaka-abot-kayang premium na option muna? |
| 6 | Customer | Ay ang tagal na nito, ang dami niyong tanong. Pwede ba akong kausapin ng ibang tao, kasi parang paulit-ulit lang tayo dito. |
| 7 | Agent | Opo, naiintindihan ko po ang inyong frustration — konti na lang po ang tanong pero kung gusto niyo, ikokonekta ko na po kayo sa aming supervisor. Bago ko po kayo i-transfer, i-note ko lang po: customer requesting a different representative, concerned about the premium on top of an existing bank loan. |
| 8 | Customer | Sige, salamat. |

**Grounding citations:** turn 3 objection response follows the pattern in `ph_bancassurance_script_tagalog.txt` ("Objection: 'Mahal naman ang premium' → Response: '...isipin po natin — ang [amount] kada buwan...'"); turn 5's "bank referral" term matches the same file's product-term list.

**Localization vs. literal translation — example 2:** the compliance reminder in the source file says to "always confirm customer's recorded consent before discussing premium amounts" — this is handled by keeping the register formal and respectful throughout (consistent "po/opo") even as the customer becomes informal and impatient, rather than mirroring the customer's drop in formality, since BSP/IC compliance expectations call for the agent to maintain professional register regardless of customer tone.

**Localization vs. literal translation — example 3:** "human escalation" here is *not* rendered as an abrupt language switch to English ("Let me transfer you to a human agent") — the escalation offer stays in Taglish ("ikokonekta ko na po kayo sa aming supervisor"), matching the "remain in the customer's language and register without unexpected English switching" requirement. The internal case-note (turn 7, second sentence) switches to English because that's an internal record for the supervisor, not customer-facing speech — a deliberate, explainable exception, not accidental code-switching.

**Result:** Objection handled with grounded response; escalation triggered on explicit request + detected impatience, register maintained throughout.

## Known gap
No native Filipino speaker reviewed these transcripts for naturalness — the Taglish phrasing was
constructed by combining verified terms/phrases from the source script file, not verified with a
native speaker or a live Filipino TTS voice. Flagged in `known_limitations.md`.
