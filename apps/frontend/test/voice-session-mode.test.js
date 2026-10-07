import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GUIDED_MODE,
  requiresReplyApproval,
} from '../src/voice-session-mode.js';

test('voice sessions deliver agent replies automatically by default', () => {
  assert.equal(DEFAULT_GUIDED_MODE, false);
  assert.equal(requiresReplyApproval(), false);
});

test('reply approval remains available as an explicit opt-in', () => {
  assert.equal(requiresReplyApproval(true), true);
  assert.equal(requiresReplyApproval(false), false);
});
