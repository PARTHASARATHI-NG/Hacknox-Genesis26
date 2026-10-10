import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, GraduationCap, Paperclip, Search, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ok, useQuery } from '../lib/hooks'
import { fetchTaken } from '../lib/data'
import { fmtDay, matchFaculty, nextAvailable, prioritise, type Faculty } from '../lib/logic'
import { Badge, Empty, ErrorBox, Field, Note, PageHeader, Prio, SlotPicker, Skeleton, Tabs, useTab, useToast } from '../components/ui'

const Ring = ({ pct }: { pct: number }) => <div className="relative size-16 shrink-0"><svg viewBox="0 0 36 36" className="-rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-line" />
  <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-brand transition-all duration-700" strokeDasharray={`${pct * .974} 100`} /></svg>
  <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">{pct}%</span></div>

export default function Mentors() {
  const tab = useTab('find'); const [sp, setSp] = useSearchParams()
  const fac = useQuery(async () => ok(await supabase.from('faculty').select('*').order('name')) as Faculty[], [])
  const fid = Number(sp.get('f')) || 0
  return <div><PageHeader title="Faculty mentors" sub="Say what you need in plain words — we find the right mentor." icon={<GraduationCap />} />
    <Tabs items={[['find', 'Find a mentor', <Search size={15} />], ['mine', 'My requests', <ClipboardList size={15} />]]} />
    {fac.error && <ErrorBox msg={fac.error} />}{fac.loading && <Skeleton />}
    {tab === 'find' && fac.data && (fid ? <RequestForm f={fac.data.find(x => x.id === fid)} q={sp.get('q') || ''} /> : <Find all={fac.data} onPick={(id, q) => setSp({ tab: 'find', f: String(id), q })} />)}
    {tab === 'mine' && <Mine />}</div>
}

function Find({ all, onPick }: { all: Faculty[]; onPick: (id: number, q: string) => void }) {
  const [q, setQ] = useState(''); const [sent, setSent] = useState('')
  const results = useMemo(() => sent ? matchFaculty(all, sent) : null, [sent, all])
  const Chips = ({ s }: { s: string }) => <div className="flex flex-wrap gap-1.5">{s.split(';').filter(Boolean).map(i => <span key={i} className="chip bg-line/60 text-mut">{i.trim()}</span>)}</div>
  return <div className="space-y-6">
    <form onSubmit={e => { e.preventDefault(); setSent(q.trim()) }} className="card p-5 flex gap-3 flex-col sm:flex-row animate-up">
      <div className="relative flex-1"><Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand" /><input className="input pl-10" value={q} onChange={e => setQ(e.target.value)} placeholder='e.g. "I need mentorship in ROS2"' autoFocus /></div>
      <button className="btn">Find mentors</button></form>
    {results?.length ? <div className="space-y-3"><h2 className="font-bold">Best matches for “{sent}”</h2>{results.map((r, i) => <div key={r.id} className="card p-5 animate-up flex gap-4 items-start" style={{ animationDelay: `${i * 80}ms` }}>
      <Ring pct={r.pct} /><div className="flex-1 min-w-0"><b className="text-lg">{r.name}</b><p className="text-sm text-mut">{r.designation} · {r.department}</p>
        <div className="flex flex-wrap gap-1.5 my-2">{r.hits.map(h => <span key={h} className="chip bg-ok/15 text-ok">✓ {h}</span>)}</div><Chips s={r.interests} /></div>
      <button className="btn btn-sm" onClick={() => onPick(r.id, sent)}>Choose</button></div>)}</div>
      : sent ? <Note kind="warn">No close match found. Try other keywords, or browse everyone below.</Note> : null}
    {!results?.length && <div className="space-y-3"><h2 className="font-bold">All faculty</h2>{all.map(r => <div key={r.id} className="card p-5 flex justify-between gap-4 items-start">
      <div className="space-y-2"><div><b>{r.name}</b><p className="text-sm text-mut">{r.designation} · {r.department}</p></div><Chips s={r.interests} /></div>
      <button className="btn btn-ghost btn-sm" onClick={() => onPick(r.id, sent)}>Choose</button></div>)}</div>}
  </div>
}

function RequestForm({ f, q }: { f?: Faculty; q: string }) {
  const nav = useNavigate(); const toast = useToast(); const { profile } = useAuth()
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(q); const [day, setDay] = useState(''); const [slot, setSlot] = useState(''); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false)
  const p = useMemo(() => prioritise(title + ' ' + desc, day || undefined), [title, desc, day])
  if (!f) return <ErrorBox msg="Faculty not found." />
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!day || !slot) return toast('Pick a date and a time slot.', 'error'); setBusy(true)
    let path: string | null = null
    if (file) { path = `${profile!.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const up = await supabase.storage.from('mentor-files').upload(path, file); if (up.error) { setBusy(false); return toast(up.error.message, 'error') } }
    const { error } = await supabase.from('mentor_requests').insert({ faculty_id: f.id, title: title.trim(), description: desc.trim(), day, slot, priority: p.priority, score: p.score, reason: p.reason, attachment_path: path })
    setBusy(false); if (error) return toast(error.message, 'error')
    toast(`Request sent to ${f.name}.`); nav('/app/mentors?tab=mine')
  }
  return <div className="max-w-2xl space-y-4"><div className="card p-4 flex justify-between items-center"><div><b>{f.name}</b><p className="text-sm text-mut">{f.designation} · {f.department}</p></div>
    <button className="btn btn-ghost btn-sm" onClick={() => nav('/app/mentors?tab=find')}>Change</button></div>
    <form onSubmit={submit} className="card p-6 space-y-5 animate-up">
      <Field label="Request title"><input className="input" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Describe your project"><textarea className="input" rows={4} required maxLength={600} value={desc} onChange={e => setDesc(e.target.value)} /></Field>
      <label className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm cursor-pointer hover:border-brand transition"><Paperclip size={18} className="text-brand" />
        <span className="flex-1 truncate">{file ? file.name : 'Attach a proposal or sketch (PDF / image / zip, optional)'}</span>
        <input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.zip" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <div><span className="label">Preferred date &amp; slot</span><SlotPicker kind="faculty" id={f.id} day={day} slot={slot} onChange={(d, s) => { setDay(d); setSlot(s) }} /></div>
      <button className="btn w-full py-3" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></form></div>
}

function Mine() {
  const { data, loading, error } = useQuery(async () => {
    const rows = ok(await supabase.from('mentor_requests').select('*, faculty(name,email)').order('id', { ascending: false })) as any[]
    return { rows, taken: rows.some(r => r.status === 'rejected') ? await fetchTaken('faculty') : [] } }, [])
  if (loading) return <Skeleton />; if (error) return <ErrorBox msg={error} />
  if (!data!.rows.length) return <Empty icon={<ClipboardList />} title="No requests yet" hint="Find a mentor and send your first request." to="/app/mentors" cta="Find a mentor" />
  return <div className="space-y-3">{data!.rows.map(m => <div key={m.id} className="card p-5 animate-up">
    <div className="flex justify-between gap-3 flex-wrap"><div><b>{m.title}</b><p className="text-sm text-mut">to {m.faculty.name} · preferred {fmtDay(m.day)} · {m.slot}</p></div><div className="flex gap-2"><Badge k={m.status} /><Prio p={m.priority} /></div></div>
    <p className="text-sm text-mut mt-2">{m.description}</p>
    {m.status === 'accepted' && <Note kind="ok"><b>Meeting confirmed: {fmtDay(m.final_day)} · {m.final_slot}</b> — contact {m.faculty.email}{m.note && <><br />Note: {m.note}</>}</Note>}
    {m.status === 'pending' && <Note kind="warn">Waiting for the faculty to respond.</Note>}
    {m.status === 'rejected' && <Note kind="bad"><b>Request declined.</b> {m.note}<div className="mt-2 flex flex-wrap gap-1.5">Next free slots:{nextAvailable(data!.taken.filter(t => t.id === m.faculty_id), m.day, 5).map(a => <span key={a.day + a.slot} className="chip">{a.label}</span>)}</div></Note>}
  </div>)}</div>
}
