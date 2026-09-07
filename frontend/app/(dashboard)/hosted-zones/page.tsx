'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, request } from '@/lib/api';
import { useNotifications } from '@/components/Notifications';

type Zone = { id: number; name: string; type: string; record_count: number; comment: string | null };

export default function Zones() {
  const params = useSearchParams();
  const router = useRouter();
  const { notify } = useNotifications();
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 20);
  const [data, setData] = useState<{ items: Zone[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [comment, setComment] = useState('');
  const [deleting, setDeleting] = useState<Zone | null>(null);
  const [confirmation, setConfirmation] = useState('');

  const updateUrl = (values: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value === undefined || value === '' ? next.delete(key) : next.set(key, String(value)));
    router.push(`/hosted-zones?${next}`);
  };
  const load = () => {
    setError('');
    setData(null);
    request(`/api/hosted-zones?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}&sort=name`)
      .then(setData).catch((cause: ApiError) => setError(cause.message));
  };
  useEffect(load, [q, page, limit]);
  const selectedZone = data?.items.find(zone => zone.id === selected) || null;
  const mockId = (id: number) => `Z${id.toString().padStart(12, '0')}MZ1QP77XYX`;
  const total = data?.total || 0;
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);

  async function saveComment(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await request(`/api/hosted-zones/${editing.id}`, { method: 'PUT', body: JSON.stringify({ comment: comment || null }) });
      notify('success', 'Hosted zone updated.');
      setEditing(null); load();
    } catch (cause) { notify('error', cause instanceof ApiError ? cause.message : 'Unable to update hosted zone.'); }
  }

  async function remove() {
    if (!deleting || confirmation !== deleting.name) return;
    try {
      await request(`/api/hosted-zones/${deleting.id}`, { method: 'DELETE' });
      notify('success', 'Hosted zone deleted.');
      setDeleting(null); setConfirmation(''); setSelected(null); load();
    } catch (cause) { notify('error', cause instanceof ApiError ? cause.message : 'Unable to delete hosted zone.'); }
  }

  return <div className="zone-list-page">
    <div className="zone-crumbbar"><button aria-label="Open navigation" onClick={() => document.querySelector<HTMLButtonElement>('.nav-toggle')?.click()}>☰</button><Link href="/hosted-zones">Route 53</Link><span>›</span><strong>Hosted zones</strong><span className="zone-crumb-spacer" /><span>ⓘ</span></div>
    <div className="zone-list-header"><div><h1>Hosted zones <span>({total})</span></h1><p>Automatic mode is the current search behavior optimized for best filter results. <a href="#settings">To change modes go to settings.</a></p></div><div className="zone-list-actions"><button className="refresh-button" aria-label="Refresh hosted zones" onClick={load}>⟳</button><button disabled={!selectedZone} onClick={() => selectedZone && router.push(`/hosted-zones/${selectedZone.id}`)}>View details</button><button disabled={!selectedZone} onClick={() => { if (selectedZone) { setEditing(selectedZone); setComment(selectedZone.comment || ''); } }}>Edit</button><button className="delete-outline" disabled={!selectedZone} onClick={() => selectedZone && setDeleting(selectedZone)}>Delete</button><Link className="create-zone-button" href="/hosted-zones/new">Create hosted zone</Link></div></div>
    <div className="zone-table-toolbar"><label className="zone-search"><span aria-hidden="true">⌕</span><input aria-label="Filter records by property or value" placeholder="Filter records by property or value" value={q} onChange={event => updateUrl({ q: event.target.value, page: 1 })} /></label><div className="zone-pagination"><button aria-label="Previous page" disabled={page <= 1} onClick={() => updateUrl({ page: page - 1 })}>‹</button><strong>{page}</strong><button aria-label="Next page" disabled={end >= total} onClick={() => updateUrl({ page: page + 1 })}>›</button><button aria-label="Table settings">⚙</button></div></div>
    {error && <div className="error zone-list-error" role="alert">{error}</div>}
    <div className="zone-table-wrap">{!data && !error ? <div className="zone-list-loading">Loading hosted zones...</div> : <table className="zone-list-table"><thead><tr><th className="select-column" /><th>Hosted zone name <span>▾</span></th><th>Type <span>▾</span></th><th>Created by <span>▾</span></th><th>Record count <span>▾</span></th><th>Description <span>▾</span></th><th>Hosted zone ID <span>▾</span></th></tr></thead><tbody>{data?.items.map(zone => <tr key={zone.id} className={selected === zone.id ? 'selected' : ''} tabIndex={0} onClick={() => setSelected(zone.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(zone.id); } }}><td className="select-column"><input type="radio" name="selected-zone" aria-label={`Select ${zone.name}`} checked={selected === zone.id} onChange={() => setSelected(zone.id)} onClick={event => event.stopPropagation()} /></td><td><Link href={`/hosted-zones/${zone.id}`} onClick={event => event.stopPropagation()}>{zone.name}</Link></td><td>{zone.type === 'private' ? 'Private' : 'Public'}</td><td>Route 53</td><td>{zone.record_count}</td><td>{zone.comment || '-'}</td><td>{mockId(zone.id)}</td></tr>)}</tbody></table>}</div>
    {data?.items.length === 0 && <div className="zone-list-empty">No hosted zones found.</div>}
    {editing && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-zone-title"><div className="modal-inner"><h2 id="edit-zone-title">Edit hosted zone</h2><p>Name and type cannot be changed after creation.</p><form onSubmit={saveComment}><label htmlFor="zone-description">Description</label><textarea id="zone-description" value={comment} onChange={event => setComment(event.target.value)} /><div className="actions"><button className="btn secondary" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="btn" type="submit">Save changes</button></div></form></div></div>}
    {deleting && <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-zone-title"><div className="modal-inner"><h2 id="delete-zone-title">Delete hosted zone</h2><p>Type <strong>{deleting.name}</strong> to confirm deletion.</p><input aria-label="Hosted zone name confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} /><div className="actions"><button className="btn secondary" onClick={() => { setDeleting(null); setConfirmation(''); }}>Cancel</button><button className="btn danger" disabled={confirmation !== deleting.name} onClick={remove}>Delete</button></div></div></div>}
  </div>;
}
