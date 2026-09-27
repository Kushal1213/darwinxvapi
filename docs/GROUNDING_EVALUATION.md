# Grounding evaluation

Veyra includes a provider-free grounding evaluation starter suite under
`evaluation/`. It is designed as a repeatable release gate for retrieval scope
behavior, not as a production accuracy claim.

Run from the repository root:

```powershell
$env:PYTHONPATH = 'services'
python services/grounding_eval.py --output evaluation/grounding_report.json
```

The runner reads:

- `evaluation/grounding_manifest.json`: reviewed cases with question, permitted
  market/product, expected action, expected or forbidden sources, risk category,
  and reviewer.
- `evaluation/grounding_corpus.json`: a small synthetic approved/draft corpus.

The report records denominators, pass/fail status, fixture lexical retrieval mode,
returned sources, and abstention reasons. Current fixture cases cover answerable
India loan and insurance questions, wrong product, wrong market, unpublished draft
content, and unsupported stock-price questions.

Passing this fixture suite only shows that the local retrieval contract and
abstention path work for the checked-in synthetic cases. A customer pilot still
requires a frozen customer-reviewed corpus, held-out cases, provider/live smoke
tests where authorized, and reviewer signoff on answer support.
