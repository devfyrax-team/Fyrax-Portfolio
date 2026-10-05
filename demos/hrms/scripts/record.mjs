// Records real GET responses from a locally running HRMS API (seeded demo data) into src/demo/fixtures.json.
// Usage: node scripts/record.mjs   (API on :4000, seeded with `SEED_RESET=1 npm run seed -w @hrms/api`)
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.API ?? 'http://localhost:4000/api';
const month = new Date().toISOString().slice(0, 7);

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ tenant: 'acme', email: 'zoe.rossi0@acme.test', password: 'Seed-Pass-2026' }),
});
const { accessToken } = await login.json();
const headers = { authorization: `Bearer ${accessToken}` };

const out = {};
async function get(path) {
  if (path in out) return out[path];
  const r = await fetch(`${BASE}${path}`, { headers });
  if (!r.ok) {
    console.log('skip', r.status, path);
    return undefined;
  }
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return undefined;
  out[path] = await r.json();
  return out[path];
}
const items = (d) => (Array.isArray(d) ? d : d?.items ?? d?.records ?? d?.rows ?? []);
const ids = (d, n = 6) => items(d).slice(0, n).map((x) => x.id).filter(Boolean);

const statics = [
  '/auth/me', '/notifications/unread-count', '/performance/pending-count', '/requests/inbox?pageSize=1',
  '/users', '/workflows', '/company/credit-notes', '/company/invoices', '/company/settings', '/company/seats',
  '/encashments/mine', '/encashments/options', '/encashments?status=APPROVED',
  '/employees', '/employees?page=1', '/employees?pageSize=100', '/employees?pageSize=100&status=ACTIVE',
  '/employees/me', '/employees/documents/expiring', '/employees/org-chart',
  '/holidays?year=' + new Date().getFullYear(), '/departments', '/designations', '/shifts', '/separations',
  '/onboarding/mine', '/onboarding/template',
  '/payroll/adjustments', '/payroll/statutory', '/payroll/components', '/payroll/payslips/me', '/payroll/runs',
  '/probation/due', '/goals/mine', '/goals/team',
  '/assets', '/assets?status=AVAILABLE', '/assets?status=ASSIGNED',
  `/attendance/me?month=${month}`, `/attendance/summary?month=${month}&page=1`,
  '/leave/balances/me', '/leave-types', '/leave/requests/me',
  '/leave/requests?status=PENDING&page=1', '/leave/requests?status=APPROVED&page=1',
  '/leave/requests?status=REJECTED&page=1', '/leave/requests?status=CANCELLED&page=1',
  '/expenses/mine', '/expenses/policy', '/expenses?status=APPROVED', '/expenses?status=PAID',
  '/notifications?page=1', '/notifications?page=1&unread=1', '/notifications/preferences',
  '/performance/cycles', '/performance/mine', '/performance/to-review',
  '/recruitment/openings', '/recruitment/openings?status=OPEN', '/recruitment/openings?status=CLOSED',
  '/requests/types', '/requests/mine?page=1', '/requests/inbox?page=1',
];
for (const p of statics) await get(p);

// Detail screens, reached from the lists above.
const emps = await get('/employees');
for (const id of ids(emps, 25)) {
  for (const sub of ['', '/profile', '/documents']) await get(`/employees/${id}${sub}`);
  await get(`/separations/employee/${id}`);
  await get(`/onboarding/employee/${id}`);
  await get(`/probation/employee/${id}`);
  await get(`/assets/employee/${id}`);
  await get(`/payroll/structures?employeeId=${id}`);
}
for (const id of ids(await get('/assets'), 20)) await get(`/assets/${id}`);
for (const id of ids(await get('/payroll/runs'), 6)) await get(`/payroll/runs/${id}`);
for (const id of ids(await get('/goals/mine'), 10)) await get(`/goals/${id}`);
for (const id of ids(await get('/goals/team'), 10)) await get(`/goals/${id}`);
for (const id of ids(await get('/performance/cycles'), 4)) await get(`/performance/cycles/${id}`);
for (const k of ['/performance/mine', '/performance/to-review'])
  for (const id of ids(await get(k), 10)) await get(`/performance/appraisals/${id}`);
for (const o of items(await get('/recruitment/openings')).slice(0, 8)) {
  const d = await get(`/recruitment/openings/${o.id}`);
  for (const c of items(d?.candidates ?? d?.pipeline ?? []).slice(0, 8)) await get(`/recruitment/candidates/${c.id}`);
  const cands = d?.candidates ?? [];
  for (const c of (Array.isArray(cands) ? cands : []).slice(0, 8)) await get(`/recruitment/candidates/${c.id}`);
  if (d?.stages) for (const st of Object.values(d.stages)) for (const c of st ?? []) if (c?.id) await get(`/recruitment/candidates/${c.id}`);
}
for (const k of ['/requests/mine?page=1', '/requests/inbox?page=1'])
  for (const r of items(await get(k)).slice(0, 10)) {
    await get(`/requests/${r.id}`);
    await get(`/expenses/request/${r.id}`);
  }

for (const sep of items(await get('/separations'))) await get(`/separations/${sep.id}/settlement`);
for (const v of Object.values(out)) { const s = v?.separation ?? (v?.id && v?.lastWorkingDay ? v : null); if (s?.id) await get(`/separations/${s.id}/settlement`); }

mkdirSync(new URL('../src/demo', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/demo/fixtures.json', import.meta.url), JSON.stringify(out));
console.log('recorded', Object.keys(out).length, 'responses');
