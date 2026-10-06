import { Router } from 'express';

import { createDisclosureChecklistStore } from '../services/disclosure-checklists.js';
import { getDatabase } from '../services/database.js';

const router = Router();
const store = () => createDisclosureChecklistStore();

router.get('/', (req, res) => {
  const user = getDatabase().prepare('SELECT role FROM users WHERE id=?').get(req.session.userId);
  return res.json({ checklists: store().list({ includeDrafts: user?.role === 'admin' }) });
});

router.post('/', (req, res) => {
  const checklist = store().create(req.session.userId, req.body);
  return res.status(201).json({ checklist });
});

router.post('/:id/approve', (req, res) => {
  const checklist = store().approve(req.params.id, req.session.userId);
  return res.json({ checklist });
});

router.post('/:id/retire', (req, res) => {
  const checklist = store().retire(req.params.id, req.session.userId, req.body?.note);
  return res.json({ checklist });
});

export default router;
