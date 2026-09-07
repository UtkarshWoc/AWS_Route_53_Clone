'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, request } from '@/lib/api';
import { useNotifications } from '@/components/Notifications';

type Tag = { key: string; value: string };

export default function CreateHostedZone() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const zone = await request('/api/hosted-zones', { method: 'POST', body: JSON.stringify({ name, comment: comment || null, type }) });
      notify('success', 'Hosted zone created.');
      router.push(`/hosted-zones/${zone.id}`);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Unable to create hosted zone.';
      setError(message);
      notify('error', message);
    } finally {
      setBusy(false);
    }
  }

  function addTag() {
    if (!tagKey.trim()) return;
    setTags(current => [...current, { key: tagKey.trim(), value: tagValue.trim() }]);
    setTagKey('');
    setTagValue('');
  }

  return <div className="zone-create-page">
    <div className="zone-breadcrumbs"><span className="hamburger" aria-hidden="true">☰</span><Link href="/hosted-zones">Route 53</Link><span>›</span><Link href="/hosted-zones">Hosted zones</Link><span>›</span><strong>Create hosted zone</strong></div>
    <form onSubmit={submit}>
      <div className="zone-create-heading"><h1>Create hosted zone</h1><a href="#configuration">Info</a></div>
      <section className="zone-card" id="configuration"><h2>Hosted zone configuration</h2><p className="zone-intro">A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains.</p>
        <div className="zone-field"><label htmlFor="create-zone-name">Domain name <a href="#create-zone-name">Info</a></label><p>This is the name of the domain that you want to route traffic for.</p><input id="create-zone-name" value={name} onChange={event => setName(event.target.value)} placeholder="example.com" required autoFocus /><small>Valid characters: a-z, 0-9, ! # $ % &apos; ( ) * + , - . / : ; &lt; = &gt; ? @ [ ] ^ _ ` &#123; | &#125; ~</small></div>
        <div className="zone-field"><label htmlFor="create-zone-comment">Description - <em>optional</em> <a href="#create-zone-comment">Info</a></label><p>This value lets you distinguish hosted zones that have the same name.</p><textarea id="create-zone-comment" maxLength={256} value={comment} onChange={event => setComment(event.target.value)} placeholder="The hosted zone is used for..." /><small>The description can have up to 256 characters. {comment.length}/256</small></div>
        <fieldset className="zone-field zone-type"><legend>Type <a href="#public-zone">Info</a></legend><p>The type indicates whether you want to route traffic on the internet or in an Amazon VPC.</p><div className="zone-type-options"><label className={type === 'public' ? 'selected' : ''}><input id="public-zone" type="radio" name="zone-type" checked={type === 'public'} onChange={() => setType('public')} /><span><strong>Public hosted zone</strong><small>A public hosted zone determines how traffic is routed on the internet.</small></span></label><label className={type === 'private' ? 'selected' : ''}><input type="radio" name="zone-type" checked={type === 'private'} onChange={() => setType('private')} /><span><strong>Private hosted zone</strong><small>A private hosted zone determines how traffic is routed within an Amazon VPC.</small></span></label></div></fieldset>
      </section>
      <section className="zone-card zone-tags"><h2>Tags <a href="#tags">Info</a></h2><p>Apply tags to hosted zones to help organize and identify them.</p>{tags.length === 0 && <p className="muted">No tags associated with the resource.</p>}{tags.map(tag => <div className="tag-row" key={`${tag.key}-${tag.value}`}><strong>{tag.key}</strong><span>{tag.value}</span></div>)}<div className="tag-editor"><input aria-label="Tag key" placeholder="Key" value={tagKey} onChange={event => setTagKey(event.target.value)} /><input aria-label="Tag value" placeholder="Value" value={tagValue} onChange={event => setTagValue(event.target.value)} /><button type="button" onClick={addTag}>Add tag</button></div><small>You can add up to 50 more tags.</small></section>
      {error && <div className="error zone-form-error" role="alert">{error}</div>}
      <div className="zone-actions"><Link href="/hosted-zones">Cancel</Link><button className="zone-submit" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create hosted zone'}</button></div>
    </form>
    <footer className="zone-footer"><span>▣ CloudShell</span><span>▣ Agent Toolkit for AWS</span><span>Feedback</span><span>▣ Console Mobile App</span><span className="zone-footer-spacer" /><span>© 2026, Amazon Web Services, Inc. or its affiliates.</span><span>Privacy</span><span>Terms</span><span>Cookie preferences</span></footer>
  </div>;
}
