'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ApiError, request } from '@/lib/api';
import { useNotifications } from '@/components/Notifications';
import RecordForm from '@/components/RecordForm';

const types = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'CAA'];
const examples: Record<string, unknown[]> = { A: ['192.0.2.1'], AAAA: ['2001:db8::1'], CNAME: ['target.example.com'], TXT: ['v=spf1 -all'], MX: [{ priority: 10, host: 'mail.example.com' }], NS: ['ns1.example.com'], PTR: ['host.example.com'], SRV: [{ priority: 10, weight: 5, port: 443, target: 'svc.example.com' }], CAA: [{ flag: 0, tag: 'issue', value: 'letsencrypt.org' }] };

type RecordItem = { id: number; name: string; type: string; ttl: number; values: unknown[]; routing_policy: string; is_default: boolean };

export default function Records() {
  const { id } = useParams<{ id: string }>(), params = useSearchParams(), router = useRouter();
  const { notify } = useNotifications();
  const q = params.get('q') || '', filterType = params.get('type') || '', page = Number(params.get('page') || 1), limit = Number(params.get('limit') || 20), sort = params.get('sort') || 'name';
  const [zone, setZone] = useState<{ name: string; type: string } | null>(null), [data, setData] = useState<{ items: RecordItem[]; total: number } | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [panel, setPanel] = useState(false), [editing, setEditing] = useState<RecordItem | null>(null), [form, setForm] = useState({ name: '', type: 'A', ttl: 300, values: JSON.stringify(examples.A, null, 2), routing_policy: 'Simple' }), [dirty, setDirty] = useState(false), [deleting, setDeleting] = useState<RecordItem | null>(null);
  
  const updateUrl = (values: Record<string, string | number | undefined>) => { const next = new URLSearchParams(params); Object.entries(values).forEach(([key, value]) => value === undefined || value === '' ? next.delete(key) : next.set(key, String(value))); router.push(`/hosted-zones/${id}?${next}`); };
  const load = () => { setError(''); setData(null); request(`/api/hosted-zones/${id}`).then(setZone).catch((e: ApiError) => setError(e.message)); request(`/api/hosted-zones/${id}/records?q=${encodeURIComponent(q)}&type=${filterType}&page=${page}&limit=${limit}&sort=${sort}`).then(setData).catch((e: ApiError) => setError(e.message)); };
  useEffect(load, [id, q, filterType, page, limit, sort]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && (panel || deleting)) { if (panel) closePanel(); else setDeleting(null); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [panel, deleting, dirty]);
  
  const closePanel = () => { if (dirty && !window.confirm('Discard unsaved changes?')) return; setPanel(false); setEditing(null); setDirty(false); };
  const openCreate = () => { setEditing(null); setForm({ name: '', type: 'A', ttl: 300, values: JSON.stringify(examples.A, null, 2), routing_policy: 'Simple' }); setDirty(false); setPanel(true); };
  const openEdit = (record: RecordItem) => { setEditing(record); setForm({ name: record.name, type: record.type, ttl: record.ttl, values: JSON.stringify(record.values, null, 2), routing_policy: record.routing_policy }); setDirty(false); setPanel(true); };
  
  async function saveValue(value: { name: string; type: string; ttl: number; routing_policy: string; values: unknown[] }) { setError(''); try { await request(editing ? `/api/hosted-zones/${id}/records/${editing.id}` : `/api/hosted-zones/${id}/records`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(editing ? { ...value, type: undefined } : value) }); setNotice(editing ? 'Record updated.' : 'Record created.'); notify('success', editing ? 'Record updated.' : 'Record created.'); closePanel(); load(); } catch (e) { const message = e instanceof ApiError ? e.message : 'Unable to save record.'; setError(message); notify('error', message); throw e; } }
  async function remove(record: RecordItem) { try { await request(`/api/hosted-zones/${id}/records/${record.id}`, { method: 'DELETE' }); setNotice('Record deleted.'); notify('success', 'Record deleted.'); setDeleting(null); load(); } catch (e) { const message = e instanceof ApiError ? e.message : 'Unable to delete record.'; setError(message); notify('error', message); } }
  
  const total = data?.total || 0, start = total ? (page - 1) * limit + 1 : 0, end = Math.min(page * limit, total);
  
  return <>
    <div className="zone-details-header">
      <div className="title-row">
        <span className="badge public-badge">Public</span>
        <h1>{zone?.name ? `${zone.name}` : 'Loading...'}</h1>
        <a href="#info" className="info-link">Info</a>
      </div>
      <div className="zone-actions">
        <button className="btn outline rounded">Delete zone</button>
        <button className="btn outline rounded">Test record</button>
        <button className="btn outline rounded">Configure query logging</button>
      </div>
    </div>
    
    <div className="hosted-zone-details-collapsible">
      <details>
        <summary>
          <div className="summary-content">
            <span className="triangle-icon">▶</span>
            <h2>Hosted zone details</h2>
          </div>
          <span className="grow" />
          <button className="btn outline rounded">Edit hosted zone</button>
        </summary>
        <div className="details-content">
          <p>Zone ID: {id}</p>
        </div>
      </details>
    </div>

    <div className="zone-tabs">
      <button className="tab active">Records ({total})</button>
      <button className="tab">Accelerated recovery</button>
      <button className="tab">DNSSEC signing</button>
      <button className="tab">Hosted zone tags (0)</button>
    </div>

    {notice && <div className="notice" role="status">{notice}</div>}
    {error && !panel && !deleting && <div className="error" role="alert">{error}</div>}

    <section className="card records-card">
      <div className="records-card-header">
        <div className="left">
          <h2>Records ({total}) <a href="#info" className="info-link">Info</a></h2>
          <p>Automatic mode is the current search behavior optimized for best filter results. <a href="#settings">To change modes go to settings.</a></p>
        </div>
        <div className="right actions">
          <button className="icon-btn refresh-icon" onClick={load} aria-label="Refresh">↻</button>
          <button className="btn outline rounded" disabled>Delete record</button>
          <button className="btn outline rounded">Import zone file</button>
          <button className="btn primary rounded" onClick={openCreate}>Create record</button>
        </div>
      </div>

      <div className="records-toolbar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input id="record-search" placeholder="Filter records by property or value" value={q} onChange={e => updateUrl({ q: e.target.value, page: 1 })} />
        </div>
        <div className="filters-group">
          <select className="filter-dropdown" aria-label="Type" value={filterType} onChange={e => updateUrl({ type: e.target.value, page: 1 })}>
            <option value="">Type</option>
            {types.concat(['SOA']).map(type => <option key={type}>{type}</option>)}
          </select>
          <select className="filter-dropdown" aria-label="Routing policy"><option>Routing p...</option></select>
          <select className="filter-dropdown" aria-label="Alias"><option>Alias</option></select>
        </div>
        
        <span className="grow" />
        <div className="pagination-compact">
          <button disabled={page <= 1} onClick={() => updateUrl({ page: page - 1 })}>&lt;</button>
          <span>{page}</span>
          <button disabled={end >= total} onClick={() => updateUrl({ page: page + 1 })}>&gt;</button>
        </div>
        <button className="icon-btn settings-btn">⚙️</button>
      </div>

      {!data && !error && <div className="loading skeleton" aria-label="Loading records"><span /><span /><span /></div>}
      {data && data.items.length === 0 && <div className="empty"><h2>No records found</h2><p>Default NS and SOA records appear when a zone is created.</p><button className="btn" onClick={openCreate}>Create record</button></div>}
      
      {data && data.items.length > 0 && <div className="tablewrap records-table-wrap">
        <table className="records-table">
          <thead>
            <tr>
              <th className="select-col"><input type="checkbox" /></th>
              <th>Record name <span className="filter-icon">▽</span></th>
              <th>Type <span className="filter-icon">▽</span></th>
              <th>Routing policy <span className="filter-icon">▽</span></th>
              <th>Differentiator <span className="filter-icon">▽</span></th>
              <th>Alias <span className="filter-icon">▽</span></th>
              <th>Value/Route traffic to <span className="filter-icon">▽</span></th>
              <th>TTL (seconds) <span className="filter-icon">▽</span></th>
              <th>Health check <span className="filter-icon">▽</span></th>
              <th>Evaluate target health <span className="filter-icon">▽</span></th>
              <th>Record ID <span className="filter-icon">▽</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(record => (
              <tr key={record.id}>
                <td className="select-col"><input type="checkbox" onChange={() => openEdit(record)} /></td>
                <td><a href="#" onClick={(e) => {e.preventDefault(); openEdit(record)}} className="record-link">{record.name}.</a></td>
                <td>{record.type}</td>
                <td>{record.routing_policy}</td>
                <td>-</td>
                <td>No</td>
                <td className="value-col">
                  {record.values.map((val, i) => (
                    <div key={i}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                  ))}
                </td>
                <td>{record.ttl.toLocaleString('en-IN')}</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </section>

    {panel && <div className="panel" role="dialog" aria-modal="true" aria-labelledby="record-panel-title"><div className="panel-inner"><div className="head"><h2 id="record-panel-title">{editing ? 'Edit record' : 'Create record'}</h2><button className="text-button" onClick={closePanel}>Close</button></div><RecordForm initial={{ name: editing?.name || '', type: editing?.type || 'A', ttl: editing?.ttl || 300, routing_policy: editing?.routing_policy || 'Simple', values: editing?.values || examples.A }} editing={!!editing} onSubmit={value => { setDirty(false); return saveValue(value); }} onCancel={closePanel} /></div></div>}
    {deleting && <div className="modal" role="dialog" aria-modal="true"><div className="modal-inner"><h2>Delete record</h2><p>Delete {deleting.name} {deleting.type}?</p>{error && <div className="error" role="alert">{error}</div>}<div className="actions"><button className="btn secondary" onClick={() => setDeleting(null)}>Cancel</button><button className="btn danger" onClick={() => remove(deleting)}>Delete</button></div></div></div>}
  </>;
}
