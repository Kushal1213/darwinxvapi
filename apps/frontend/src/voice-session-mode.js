// Autonomous delivery is the expected Voice Studio experience. Approval mode
// is intentionally opt-in because it queues a suggestion instead of producing
// an immediate agent turn.
export const DEFAULT_GUIDED_MODE = false;

export function requiresReplyApproval(value = DEFAULT_GUIDED_MODE) {
  return value === true;
}
