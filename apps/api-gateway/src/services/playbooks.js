const definitions = [
  {
    id: 'india-loan-information',
    version: '2026-10-06.1',
    market: 'india-loan',
    intent: 'loan_inquiry',
    title: 'India loan information guide',
    description: 'A deterministic conversation guide for approved loan-information support.',
    disclaimer: 'Demo workflow guide only. It is not a lending decision or compliance checklist.',
    steps: [
      {
        id: 'understand_need',
        label: 'Understand the loan question',
        roles: ['user'],
        pattern: /\b(loan|borrow|emi|repay|prepay|eligib|interest|fee|document)\w*\b/i,
        action: { kind: 'ask_customer', label: 'Suggested customer question', text: 'Which loan product or question would you like help with today?' },
      },
      {
        id: 'capture_amount',
        label: 'Capture the requested amount',
        stateField: 'loan_amount',
        roles: ['user'],
        pattern: /\b(?:amount|borrow|loan)\D{0,20}(?:₹|inr|rs\.?|rupees?)?\s*[\d,.]+\b/i,
        action: { kind: 'ask_customer', label: 'Suggested customer question', text: 'What loan amount are you considering?' },
      },
      {
        id: 'capture_income',
        label: 'Clarify income or employment context',
        stateField: 'income',
        roles: ['user'],
        pattern: /\b(self-employed|salaried|employed|employment)\b/i,
        action: { kind: 'ask_customer', label: 'Suggested customer question', text: 'Could you share your employment type and approximate monthly income?' },
      },
      {
        id: 'explain_requirements',
        label: 'Explain approved requirements',
        roles: ['assistant'],
        requireSources: true,
        pattern: /\b(eligib|requirement|income|salary|cibil|credit score|age)\w*\b/i,
        action: { kind: 'search_knowledge', label: 'Find approved requirements', text: 'What approved eligibility and income requirements should I explain for this loan?' },
      },
      {
        id: 'explain_documents',
        label: 'Explain required documents',
        roles: ['assistant'],
        requireSources: true,
        pattern: /\b(document|proof|statement|payslip|salary slip|identification|identity|kyc)\w*\b/i,
        action: { kind: 'search_knowledge', label: 'Find approved documents', text: 'What approved documents are required for this loan application?' },
      },
      {
        id: 'explain_pricing',
        label: 'Explain rates, fees, or repayment terms',
        roles: ['assistant'],
        requireSources: true,
        pattern: /\b(interest|rate|fee|charge|apr|emi|repay|prepay|tenure)\w*\b/i,
        action: { kind: 'search_knowledge', label: 'Find approved pricing guidance', text: 'What approved interest, fee, repayment, and prepayment information should I explain?' },
      },
      {
        id: 'confirm_next_step',
        label: 'Confirm the next step or human assistance',
        roles: ['user', 'assistant'],
        pattern: /\b(apply|proceed|next step|follow[- ]?up|call back|human|manager|supervisor)\w*\b/i,
        escalationCompletes: true,
        action: { kind: 'ask_customer', label: 'Suggested customer question', text: 'Would you like to continue with the next step or speak with a team member?' },
      },
    ],
  },
];

function evidenceFor(session, step) {
  if (step.stateField && session.state?.[step.stateField]) {
    const matchingTurn = [...(session.turns || [])].reverse().find((turn) =>
      step.roles.includes(turn.role) && step.pattern.test(String(turn.content || ''))
    );
    return matchingTurn
      ? turnEvidence(session, matchingTurn)
      : { kind: 'session_state', field: step.stateField, value: session.state[step.stateField] };
  }
  if (step.escalationCompletes && session.escalations?.some((item) => !item.resolved_at)) {
    return { kind: 'handoff', value: 'Human assistance requested' };
  }
  const turn = (session.turns || []).find((candidate) =>
    step.roles.includes(candidate.role) &&
    (!step.requireSources || candidate.sources?.length > 0) &&
    step.pattern.test(String(candidate.content || ''))
  );
  return turn ? turnEvidence(session, turn) : null;
}

function turnEvidence(session, turn) {
  const index = session.turns.indexOf(turn);
  const content = String(turn.content || '');
  return {
    kind: 'transcript_turn',
    turn_index: index,
    role: turn.role,
    excerpt: content.length > 180 ? `${content.slice(0, 177)}...` : content,
    source_count: turn.sources?.length || 0,
  };
}

export function evaluatePlaybook(session) {
  const definition = definitions.find((item) => item.market === session?.market);
  if (!definition) return null;
  const steps = definition.steps.map((step) => {
    const evidence = evidenceFor(session, step);
    return {
      id: step.id,
      label: step.label,
      state: evidence ? 'observed' : 'open',
      evidence,
      action: step.action,
    };
  });
  const observed = steps.filter((step) => step.state === 'observed').length;
  const nextStep = steps.find((step) => step.state === 'open') || null;
  return {
    id: definition.id,
    version: definition.version,
    title: definition.title,
    description: definition.description,
    disclaimer: definition.disclaimer,
    market: definition.market,
    intended_intent: definition.intent,
    detected_intent: session.state?.intent || null,
    status: nextStep ? (observed ? 'active' : 'listening') : 'complete',
    observed_steps: observed,
    total_steps: steps.length,
    progress_percent: Math.round((observed / steps.length) * 100),
    paused_for_handoff: Boolean(session.escalations?.some((item) => !item.resolved_at)),
    steps,
    next_step: nextStep,
  };
}

export function listPlaybookDefinitions() {
  return definitions.map(({ steps, ...definition }) => ({
    ...definition,
    step_ids: steps.map((step) => step.id),
  }));
}
