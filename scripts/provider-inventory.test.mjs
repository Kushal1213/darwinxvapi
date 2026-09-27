import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInventory } from './provider-inventory.mjs';

test('provider inventory reports local SDKs, models and findings without secrets', () => {
  const inventory = buildInventory();
  assert.equal(inventory.repository, 'veyra-voice-intelligence-suite');
  assert.equal(inventory.providers.find((provider) => provider.name === 'Gemini API').configured_defaults.rag_embedding_model, 'models/gemini-embedding-001');
  assert.equal(inventory.providers.find((provider) => provider.name === 'Vapi').sdk.package, '@vapi-ai/web');
  assert.equal(inventory.dependencies.python.unpinned.length, 0);
  assert.ok(inventory.findings.some((finding) => finding.id === 'google-generativeai-review-required'));
  assert.equal(inventory.findings.some((finding) => finding.id === 'env-embedding-model-drift'), false);
  const serialized = JSON.stringify(inventory).toLowerCase();
  for (const forbidden of ['your_gemini_api_key_here', 'your_vapi_api_key_here', 'your_deepgram_api_key_here']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
