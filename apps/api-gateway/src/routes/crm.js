import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ── Mock CRM Data Store ───────────────────────────────────────
const leads = new Map();
const callbacks = new Map();

/**
 * POST /api/crm/lead
 * Create a new lead from voice agent qualification
 */
router.post('/lead', (req, res) => {
  const { customer_name, phone, income, loan_amount, intent, call_id, market } = req.body;

  const lead = {
    lead_id: `LEAD-${uuidv4().slice(0, 8).toUpperCase()}`,
    customer_name: customer_name || 'Unknown',
    phone: phone || null,
    income: income || null,
    loan_amount: loan_amount || null,
    intent: intent || 'loan_inquiry',
    market: market || 'india',
    call_id: call_id || null,
    status: 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    qualification_score: calculateQualScore({ income, loan_amount }),
  };

  leads.set(lead.lead_id, lead);

  return res.status(201).json({
    success: true,
    lead_id: lead.lead_id,
    lead,
    message: `Lead ${lead.lead_id} created successfully`,
  });
});

/**
 * POST /api/crm/callback
 * Schedule a callback
 */
router.post('/callback', (req, res) => {
  const { customer_name, phone, preferred_time, reason, call_id } = req.body;

  const callback = {
    callback_id: `CB-${uuidv4().slice(0, 8).toUpperCase()}`,
    customer_name: customer_name || 'Unknown',
    phone: phone || null,
    preferred_time: preferred_time || null,
    reason: reason || 'Follow-up required',
    call_id: call_id || null,
    status: 'scheduled',
    created_at: new Date().toISOString(),
  };

  callbacks.set(callback.callback_id, callback);

  return res.status(201).json({
    success: true,
    callback_id: callback.callback_id,
    callback,
    message: `Callback ${callback.callback_id} scheduled`,
  });
});

/**
 * GET /api/crm/leads
 * List all leads
 */
router.get('/leads', (req, res) => {
  res.json({
    leads: Array.from(leads.values()),
    total: leads.size,
  });
});

/**
 * GET /api/crm/lead/:id
 */
router.get('/lead/:id', (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// ── Helpers ───────────────────────────────────────────────────

function calculateQualScore({ income, loan_amount }) {
  if (!income || !loan_amount) return 0;
  const inc = parseFloat(String(income).replace(/[^0-9.]/g, ''));
  const loan = parseFloat(String(loan_amount).replace(/[^0-9.]/g, ''));
  if (isNaN(inc) || isNaN(loan) || inc === 0) return 0;
  const ratio = loan / (inc * 12);
  if (ratio < 3) return 90;
  if (ratio < 5) return 70;
  if (ratio < 8) return 50;
  return 25;
}

export default router;
