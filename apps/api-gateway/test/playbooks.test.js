import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePlaybook, listPlaybookDefinitions } from '../src/services/playbooks.js';

function session(overrides = {}) {
  return {
    market: 'india-loan',
    state: { intent: null, income: null, loan_amount: null },
    turns: [],
    escalations: [],
    ...overrides,
  };
}

test('playbook definitions expose a stable version without executable rules', () => {
  const [definition] = listPlaybookDefinitions();
  assert.equal(definition.id, 'india-loan-information');
  assert.equal(definition.version, '2026-10-06.1');
  assert.ok(definition.step_ids.includes('explain_documents'));
  assert.equal('steps' in definition, false);
});

test('loan playbook derives progress and cited evidence from persisted conversation state', () => {
  const result = evaluatePlaybook(session({
    state: { intent: 'loan_inquiry', income: '₹60,000', loan_amount: '₹500,000' },
    turns: [
      { role: 'user', content: 'I need a loan amount of ₹500,000 and my salary is ₹60,000.' },
      { role: 'assistant', content: 'The approved income requirement is described here.', sources: [{ source: 'loan-policy' }] },
    ],
  }));
  assert.equal(result.detected_intent, 'loan_inquiry');
  assert.equal(result.steps.find((step) => step.id === 'capture_amount').state, 'observed');
  assert.equal(result.steps.find((step) => step.id === 'capture_income').state, 'observed');
  assert.equal(result.steps.find((step) => step.id === 'explain_requirements').evidence.source_count, 1);
  assert.equal(result.next_step.id, 'explain_documents');
});

test('uncited assistant wording does not complete knowledge delivery steps', () => {
  const result = evaluatePlaybook(session({
    turns: [{ role: 'assistant', content: 'The fee and interest rate are low.', sources: [] }],
  }));
  assert.equal(result.steps.find((step) => step.id === 'explain_pricing').state, 'open');
});

test('handoff completes the next-step branch and unsupported markets have no playbook', () => {
  const result = evaluatePlaybook(session({ escalations: [{ escalation_id: 'one' }] }));
  assert.equal(result.paused_for_handoff, true);
  assert.equal(result.steps.find((step) => step.id === 'confirm_next_step').state, 'observed');
  assert.equal(evaluatePlaybook(session({ market: 'india-insurance' })), null);
});
