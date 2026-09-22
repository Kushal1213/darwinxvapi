"""
test_calls.py — the four required Q4 test scenarios, expressed as ordered
chunks (speaker, text, call_seconds). call_seconds marks when that chunk
would have arrived from a live ASR stream; call_runner.py sleeps against
real deltas between these to genuinely replay the call at (compressed)
real-time pace rather than just iterating a list instantly.
"""
from nudge_engine import Chunk

# --- Scenario 1: cooperative call with a MISSED CROSS-SELL opportunity -----
CALL_MISSED_CROSS_SELL = [
    Chunk("agent", "Good afternoon, this is Aria from the loans desk, am I speaking with Mr. Rao?", 0.0),
    Chunk("customer", "Yes speaking, I called about my personal loan application.", 3.5),
    Chunk("agent", "Great, I can see your application for a personal loan of five lakhs. Let me pull up the details.", 7.0),
    Chunk("customer", "Sure. Actually while I have you, my wife also needs a loan for her car, is that something you handle too?", 12.0),
    Chunk("agent", "Let's finish your loan first — your income and CIBIL score both meet eligibility.", 19.0),
    Chunk("customer", "Okay sounds good, what's the next step?", 24.0),
    Chunk("agent", "I'll send the document checklist by email. Anything else?", 28.0),
    Chunk("customer", "No that's all, thank you.", 32.0),
]

# --- Scenario 2: agent SKIPS a required disclosure before quoting a rate ---
CALL_COMPLIANCE_GAP = [
    Chunk("agent", "Hi, this is Aria calling about your loan against property enquiry.", 0.0),
    Chunk("customer", "Yes, I wanted to know the interest rate.", 3.0),
    Chunk("agent", "Sure — the interest rate for loan against property is 10.5% per annum for your profile.", 6.5),
    Chunk("customer", "That sounds reasonable. And the processing fee?", 12.0),
    Chunk("agent", "Processing fee is 2% of the loan amount plus GST.", 15.0),
    Chunk("customer", "Got it, can you confirm this rate is locked in?", 19.0),
    Chunk("agent", "Rates quoted over the call must be confirmed via email or SMS within 24 hours — I'll send that now.", 23.0),
    Chunk("customer", "Perfect, thank you.", 28.0),
]

# --- Scenario 3: RISING FRUSTRATION over the course of a call --------------
CALL_RISING_FRUSTRATION = [
    Chunk("agent", "Hi, this is Aria, calling regarding your loan repayment reminder.", 0.0),
    Chunk("customer", "Yes I know, I've already told you people I'm paying this week.", 3.0),
    Chunk("agent", "I understand, I just wanted to confirm the date so we can update our records.", 7.0),
    Chunk("customer", "This is the third call this month, it's honestly getting annoying.", 11.0),
    Chunk("agent", "I apologize for the repeated calls, let me check why that's happening.", 15.5),
    Chunk("customer", "It's ridiculous, I told the last agent the exact same thing, this is a waste of time.", 19.0),
    Chunk("agent", "I completely understand your frustration, let me escalate this so it doesn't happen again.", 24.0),
    Chunk("customer", "Fine, but I want to speak to a manager about this.", 28.0),
]

# --- Scenario 4: NOISY / ambiguous call — should NOT fire nudges ----------
CALL_NOISY_AMBIGUOUS = [
    Chunk("agent", "Hello — sorry, could you repeat that, the line is a bit unclear?", 0.0),
    Chunk("customer", "[unintelligible] ...loan... [unintelligible] ...maybe...", 3.0),
    Chunk("agent", "I'm having trouble hearing you, could you say that again?", 6.0),
    Chunk("customer", "sorry [static] can you hear me now [static]", 9.5),
    Chunk("agent", "A little better — you mentioned a loan, is that regarding an existing account?", 13.0),
    Chunk("customer", "yeah something like that, not sure, maybe not a big deal", 17.0),
    Chunk("agent", "No problem, would it be alright if I called back on a better line?", 21.0),
    Chunk("customer", "sure ok", 24.5),
]

ALL_SCENARIOS = {
    "missed_cross_sell": CALL_MISSED_CROSS_SELL,
    "compliance_gap": CALL_COMPLIANCE_GAP,
    "rising_frustration": CALL_RISING_FRUSTRATION,
    "noisy_ambiguous": CALL_NOISY_AMBIGUOUS,
}
