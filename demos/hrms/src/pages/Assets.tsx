import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Badge, Empty, ErrorText, Field, Loading, Modal, dateNow, useAction } from '../components/ui';

// Page pattern: List + dialogs. HR's register of company assets: add, hand out, take back, retire, and see the history.

const CATEGORIES = [
  { value: 'LAPTOP', label: 'Laptop' }, { value: 'PHONE', label: 'Phone' }, { value: 'MONITOR', label: 'Monitor' },
  { value: 'ACCESS_CARD', label: 'Access card' }, { value: 'FURNITURE', label: 'Furniture' }, { value: 'OTHER', label: 'Other' },
];
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

interface Asset {
  id: string; tag: string; name: string; category: string; serialNumber: string | null; purchasedOn: string | null; notes: string | null; status: 'AVAILABLE' | 'ASSIGNED' | 'RETIRED';
  retireReason: string | null; holder: { id: string; employeeCode: string; name: string; since: string } | null;
}
interface Listing { counts: Record<string, number>; items: Asset[] }
interface Person { id: string; employeeCode: string; firstName: string; lastName: string; status: string }
interface Detail extends Omit<Asset, 'holder'> { history: { id: string; assignedOn: string; returnedOn: string | null; note: string | null; returnNote: string | null; employee: { id: string; employeeCode: string; name: string } }[] }

const STATUS_BADGE: Record<string, string> = { AVAILABLE: 'ACTIVE', ASSIGNED: 'PENDING', RETIRED: 'REJECTED' };
const STATUS_LABEL: Record<string, string> = { AVAILABLE: 'In stock', ASSIGNED: 'Assigned', RETIRED: 'Retired' };
const refresh = (qc: ReturnType<typeof useQueryClient>) => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['asset'] }); qc.invalidateQueries({ queryKey: ['employee-assets'] }); qc.invalidateQueries({ queryKey: ['settlement'] }); };

function AssetForm({ initial, onClose }: { initial?: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [f, setF] = useState({ tag: initial?.tag ?? '', name: initial?.name ?? '', category: initial?.category ?? 'LAPTOP', serialNumber: initial?.serialNumber ?? '', purchasedOn: initial?.purchasedOn ?? '', notes: initial?.notes ?? '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { tag: f.tag, name: f.name, category: f.category, serialNumber: f.serialNumber || undefined, purchasedOn: f.purchasedOn || undefined, notes: f.notes || undefined };
    act.run(() => (initial ? api.patch(`/assets/${initial.id}`, body) : api.post('/assets', body)), () => { refresh(qc); onClose(); });
  };
  return (
    <Modal title={initial ? `Edit ${initial.tag}` : 'Add an asset'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Asset tag" hint="Your own label, e.g. LT-014. Letters, digits and . _ - /"><input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} required maxLength={40} /></Field>
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={120} /></Field>
          <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field label="Serial number"><input value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} maxLength={80} /></Field>
          <Field label="Purchased on"><input type="date" value={f.purchasedOn} max={dateNow()} onChange={(e) => setF({ ...f, purchasedOn: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>{initial ? 'Save' : 'Add asset'}</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function AssignDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const people = useQuery({ queryKey: ['employees', 'for-assets'], queryFn: () => api.get<{ items: Person[] }>('/employees?pageSize=100') });
  const [f, setF] = useState({ employeeId: '', assignedOn: dateNow(), note: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/assets/${asset.id}/assign`, { employeeId: f.employeeId || people.data?.items.find((p) => p.status !== 'TERMINATED')?.id, assignedOn: f.assignedOn, note: f.note || undefined }), () => { refresh(qc); onClose(); });
  };
  return (
    <Modal title={`Hand out ${asset.tag}`} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{asset.name}</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Give to"><select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>{people.data?.items.filter((p) => p.status !== 'TERMINATED').map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeCode})</option>)}</select></Field>
          <Field label="Handed over on"><input type="date" value={f.assignedOn} max={dateNow()} onChange={(e) => setF({ ...f, assignedOn: e.target.value })} required /></Field>
        </div>
        <Field label="Note (optional)" hint="What came with it: charger, bag, accessories"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Hand out</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function ReturnDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [f, setF] = useState({ returnedOn: dateNow(), returnNote: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/assets/${asset.id}/return`, { returnedOn: f.returnedOn, returnNote: f.returnNote || undefined }), () => { refresh(qc); onClose(); });
  };
  return (
    <Modal title={`Take back ${asset.tag}`} onClose={onClose}>
      <p style={{ marginTop: 0 }}>{asset.name}, with {asset.holder?.name}</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Returned on"><input type="date" value={f.returnedOn} max={dateNow()} onChange={(e) => setF({ ...f, returnedOn: e.target.value })} required /></Field>
          <Field label="Condition (optional)"><input value={f.returnNote} onChange={(e) => setF({ ...f, returnNote: e.target.value })} maxLength={300} /></Field>
        </div>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Take back</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function RetireDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [reason, setReason] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/assets/${asset.id}/retire`, { reason }), () => { refresh(qc); onClose(); });
  };
  return (
    <Modal title={`Retire ${asset.tag}?`} onClose={onClose}>
      <p style={{ marginTop: 0 }}>A retired asset (lost, broken, sold) stays in the register with its history but is never handed out again.</p>
      <form onSubmit={submit}>
        <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} autoFocus /></Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn danger" disabled={act.pending}>Retire asset</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function History({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['asset', id], queryFn: () => api.get<Detail>(`/assets/${id}`) });
  const d = q.data;
  return (
    <Modal title={d ? `${d.tag}: ${d.name}` : 'Asset'} onClose={onClose}>
      {q.isLoading && <Loading />}
      {d && (
        <>
          <dl className="facts">
            <div><dt>Category</dt><dd>{categoryLabel(d.category)}</dd></div>
            {d.serialNumber && <div><dt>Serial number</dt><dd>{d.serialNumber}</dd></div>}
            {d.purchasedOn && <div><dt>Purchased</dt><dd>{d.purchasedOn}</dd></div>}
            {d.notes && <div><dt>Notes</dt><dd>{d.notes}</dd></div>}
            {d.retireReason && <div><dt>Retired because</dt><dd>{d.retireReason}</dd></div>}
          </dl>
          <h3>History</h3>
          {d.history.length === 0 ? <p className="muted">It has never been handed out.</p> : (
            <ul className="history">
              {d.history.map((h) => (
                <li key={h.id}>
                  <b><Link to={`/employees/${h.employee.id}`}>{h.employee.name}</Link></b> <span className="muted">{h.assignedOn} to {h.returnedOn ?? 'now'}</span>
                  {h.note && <div className="muted">Given: {h.note}</div>}
                  {h.returnNote && <div className="muted">Returned: {h.returnNote}</div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

export function Assets() {
  const [f, setF] = useState({ status: '', category: '', q: '' });
  const [dialog, setDialog] = useState<{ kind: 'add' | 'edit' | 'assign' | 'return' | 'retire' | 'history'; asset?: Asset } | null>(null);
  const q = useQuery({
    queryKey: ['assets', f],
    queryFn: () => {
      const p = new URLSearchParams();
      if (f.status) p.set('status', f.status);
      if (f.category) p.set('category', f.category);
      if (f.q.trim()) p.set('q', f.q.trim());
      return api.get<Listing>(`/assets?${p}`);
    },
  });
  const close = () => setDialog(null);
  return (
    <>
      <div className="row between">
        <h1>Assets</h1>
        <button className="btn primary" onClick={() => setDialog({ kind: 'add' })}>Add an asset</button>
      </div>
      {q.data && (
        <div className="stats" style={{ marginBottom: 12 }}>
          <div className="stat"><b>{q.data.counts.AVAILABLE}</b><span>in stock</span></div>
          <div className="stat"><b>{q.data.counts.ASSIGNED}</b><span>assigned</span></div>
          <div className="stat"><b>{q.data.counts.RETIRED}</b><span>retired</span></div>
        </div>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <Field label="Search"><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Tag, name or serial" /></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option><option value="AVAILABLE">In stock</option><option value="ASSIGNED">Assigned</option><option value="RETIRED">Retired</option></select></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">All</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
      </div>
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>No assets {f.q || f.status || f.category ? 'match these filters' : 'yet. Add the first one'}.</Empty> : (
          <table>
            <thead><tr><th>Tag</th><th>Asset</th><th>Category</th><th>With</th><th>Status</th><th className="actions" /></tr></thead>
            <tbody>
              {q.data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.tag}</td>
                  <td>{a.name}{a.serialNumber && <span className="muted"> · {a.serialNumber}</span>}</td>
                  <td>{categoryLabel(a.category)}</td>
                  <td>{a.holder ? <><Link to={`/employees/${a.holder.id}`}>{a.holder.name}</Link> <span className="muted">since {a.holder.since}</span></> : <span className="muted">no one</span>}</td>
                  <td><Badge value={STATUS_BADGE[a.status]} /> <span className="muted">{STATUS_LABEL[a.status]}</span></td>
                  <td className="actions">
                    <div className="row">
                      {a.status === 'AVAILABLE' && <button className="btn small primary" onClick={() => setDialog({ kind: 'assign', asset: a })} aria-label={`Hand out ${a.tag}`}>Hand out</button>}
                      {a.status === 'ASSIGNED' && <button className="btn small" onClick={() => setDialog({ kind: 'return', asset: a })} aria-label={`Take back ${a.tag}`}>Take back</button>}
                      {a.status !== 'RETIRED' && <button className="btn small" onClick={() => setDialog({ kind: 'edit', asset: a })} aria-label={`Edit ${a.tag}`}>Edit</button>}
                      {a.status === 'AVAILABLE' && <button className="btn small danger" onClick={() => setDialog({ kind: 'retire', asset: a })} aria-label={`Retire ${a.tag}`}>Retire</button>}
                      <button className="btn small" onClick={() => setDialog({ kind: 'history', asset: a })} aria-label={`History of ${a.tag}`}>History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {dialog?.kind === 'add' && <AssetForm onClose={close} />}
      {dialog?.kind === 'edit' && <AssetForm initial={dialog.asset} onClose={close} />}
      {dialog?.kind === 'assign' && <AssignDialog asset={dialog.asset!} onClose={close} />}
      {dialog?.kind === 'return' && <ReturnDialog asset={dialog.asset!} onClose={close} />}
      {dialog?.kind === 'retire' && <RetireDialog asset={dialog.asset!} onClose={close} />}
      {dialog?.kind === 'history' && <History id={dialog.asset!.id} onClose={close} />}
    </>
  );
}

interface Loan { id: string; assignedOn: string; returnedOn: string | null; note: string | null; returnNote: string | null; asset: { id: string; tag: string; name: string; category: string; serialNumber: string | null } }

/** What one employee holds (and held), on their profile. Shown to them, their manager and HR; nothing when there is nothing to show. */
export function AssetsCard({ employeeId }: { employeeId: string }) {
  const q = useQuery({ queryKey: ['employee-assets', employeeId], queryFn: () => api.get<{ holding: Loan[]; history: Loan[] }>(`/assets/employee/${employeeId}`) });
  if (!q.data || (!q.data.holding.length && !q.data.history.length)) return null;
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Company assets</h2>
      {q.data.holding.length === 0 ? <p className="muted" style={{ marginTop: 0 }}>Nothing is currently assigned.</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {q.data.holding.map((l) => (
            <li key={l.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <b>{l.asset.name}</b> <span className="muted">{l.asset.tag}{l.asset.serialNumber ? ` · ${l.asset.serialNumber}` : ''} · since {l.assignedOn}</span>
              {l.note && <div className="muted">{l.note}</div>}
            </li>
          ))}
        </ul>
      )}
      {q.data.history.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="muted">Returned ({q.data.history.length})</summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {q.data.history.map((l) => <li key={l.id} className="muted" style={{ padding: '4px 0' }}>{l.asset.name} ({l.asset.tag}): {l.assignedOn} to {l.returnedOn}{l.returnNote ? `, ${l.returnNote}` : ''}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
