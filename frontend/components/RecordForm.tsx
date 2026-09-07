'use client';

import { useState } from 'react';

const types = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'CAA'];
type FormValue = { name: string; type: string; ttl: number; routing_policy: string; values: unknown[] };
type Props = { initial: FormValue; editing: boolean; onSubmit: (value: FormValue) => Promise<void>; onCancel: () => void };

function initialValue(type: string, values: unknown[]) {
  if (['MX', 'SRV', 'CAA'].includes(type)) return values.length ? JSON.stringify(values[0]) : '';
  return values.join('\n');
}

export default function RecordForm({ initial, editing, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({ ...initial, valueText: initialValue(initial.type, initial.values) });
  const [error, setError] = useState('');
  const set = (key: string, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const parseValues = (): unknown[] => {
    if (['MX', 'SRV', 'CAA'].includes(form.type)) return [JSON.parse(form.valueText)];
    return form.valueText.split('\n').map(value => value.trim()).filter(Boolean);
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try {
      const values = parseValues();
      if (!form.name.trim()) throw new Error('Record name is required.');
      if (!values.length) throw new Error('At least one value is required.');
      await onSubmit({ name: form.name, type: form.type, ttl: Number(form.ttl), routing_policy: form.routing_policy, values });
    } catch (cause) { setError(cause instanceof SyntaxError ? 'Enter valid JSON for this record type.' : cause instanceof Error ? cause.message : 'Invalid record.'); }
  }
  const objectHint = form.type === 'MX' ? '{"priority":10,"host":"mail.example.com"}' : form.type === 'SRV' ? '{"priority":10,"weight":5,"port":443,"target":"svc.example.com"}' : '{"flag":0,"tag":"issue","value":"letsencrypt.org"}';
  return <form onSubmit={submit}><div className="field"><label htmlFor="record-name">Record name</label><input id="record-name" required value={form.name} onChange={event => set('name', event.target.value)} /></div><div className="field"><label htmlFor="record-type">Type</label><select id="record-type" disabled={editing} value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value, valueText: initialValue(event.target.value, []), ttl: 300 }))}>{types.map(type => <option key={type}>{type}</option>)}</select>{editing && <small>To change type, delete this record and create a new one.</small>}</div><div className="field"><label htmlFor="record-ttl">TTL</label><input id="record-ttl" type="number" min="1" value={form.ttl} onChange={event => set('ttl', Number(event.target.value))} /></div><div className="field"><label htmlFor="record-values">{['MX', 'SRV', 'CAA'].includes(form.type) ? `${form.type} value object` : `${form.type} values`}</label><textarea id="record-values" required rows={6} value={form.valueText} onChange={event => set('valueText', event.target.value)} placeholder={objectHint} />{['MX', 'SRV', 'CAA'].includes(form.type) ? <small>Enter one JSON object: {objectHint}</small> : <small>Enter one value per line.</small>}</div>{error && <div className="error" role="alert">{error}</div>}<div className="actions"><button className="btn secondary" type="button" onClick={onCancel}>Cancel</button><button className="btn" type="submit">{editing ? 'Save changes' : 'Create record'}</button></div></form>;
}
