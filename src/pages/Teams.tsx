import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, UserCheck, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ok, useQuery } from '../lib/hooks'
import { DEPTS, normTokens } from '../lib/logic'
import { Badge, Empty, ErrorBox, Field, PageHeader, Skeleton, Tabs, useTab, useToast } from '../components/ui'

interface Role { id: number; request_id: number; dept: string; specialization: string; filled_by: string | null; filled_name: string | null }
interface Team { id: number; creator_id: string; creator_name: string; creator_dept: string; title: string; description: string; team_roles: Role[] }
interface Member { name: string; email: string; role: string }
const load = async () => ok(await supabase.from('team_requests').select('*, team_roles(*)').order('id', { ascending: false }).order('id', { referencedTable: 'team_roles' })) as Team[]

export default function Teams() {
  const tab = useTab('browse'); const q = useQuery(load, [])
  return <div><PageHeader title="Team requests" sub="Find collaborators across departments." icon={<Users />} />
    <Tabs items={[['browse', 'Browse', <Search size={15} />], ['create', 'Create request', <Plus size={15} />], ['mine', 'My teams', <UserCheck size={15} />]]} />
    {q.error && <ErrorBox msg={q.error} />}{q.loading && !q.data && <Skeleton />}
    {q.data && (tab === 'browse' ? <Browse teams={q.data} reload={q.reload} /> : tab === 'create' ? <Create /> : <Mine teams={q.data} reload={q.reload} />)}</div>
}

function Browse({ teams, reload }: { teams: Team[]; reload: () => void }) {
  const { profile } = useAuth(); const toast = useToast(); const [dept, setDept] = useState(''); const [kw, setKw] = useState('')
  const cards = useMemo(() => { const kwt = new Set(normTokens(kw)); const filtered = !!(dept || kwt.size)
    return teams.filter(t => t.creator_id !== profile!.id).map(t => {
      const joined = t.team_roles.some(r => r.filled_by === profile!.id); const tt = new Set(normTokens(t.title + ' ' + t.description))
      const roles = t.team_roles.map(r => { const open = !r.filled_by; const kmatch = normTokens(r.specialization).some(x => kwt.has(x))
        return { ...r, open, kmatch, match: open && (!dept || r.dept === dept) && (!kwt.size || kmatch || [...kwt].some(x => tt.has(x))) } })
      return { t, joined, roles, show: roles.some(r => r.match) || (joined && !filtered) } }).filter(c => c.show) }, [teams, dept, kw, profile])
  const accept = async (id: number) => { const { error } = await supabase.rpc('accept_team_role', { p_role: id }); if (error) toast(error.message, 'error'); else toast('You joined! Contact details are in your Inbox and “My teams”.'); reload() }
  return <div className="space-y-4">
    <div className="card p-4 grid sm:grid-cols-[1fr_1fr] gap-3 animate-up"><select className="input" value={dept} onChange={e => setDept(e.target.value)}><option value="">Any department</option>{DEPTS.map(d => <option key={d}>{d}</option>)}</select>
      <input className="input" placeholder="Keyword e.g. ROS2, CAD, PCB" value={kw} onChange={e => setKw(e.target.value)} /></div>
    {!cards.length ? <Empty icon={<Users />} title="No open team requests match" hint="Try clearing filters, or post your own." /> :
      cards.map(({ t, joined, roles }, i) => <div key={t.id} className="card p-5 animate-up" style={{ animationDelay: `${i * 50}ms` }}>
        <div className="flex justify-between gap-3"><div><b className="text-lg">{t.title}</b><p className="text-xs text-mut">by {t.creator_name} · {t.creator_dept}</p></div>{joined && <Badge k="accepted">you joined</Badge>}</div>
        <p className="text-sm my-3">{t.description}</p>
        <div className="grid gap-2">{roles.map(r => <div key={r.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${r.match ? 'border-ok/40 bg-ok/5' : 'border-line'}`}>
          <div><p className="text-sm font-semibold">{r.specialization}{r.kmatch && <span className="chip bg-ok/15 text-ok ml-2">match</span>}</p><p className="text-xs text-mut">{r.dept}</p></div>
          {!r.open ? <Badge k="filled" /> : joined ? <span className="text-mut">–</span> : <button className="btn btn-ok btn-sm" onClick={() => accept(r.id)}>Accept role</button>}</div>)}</div></div>)}</div>
}

function Create() {
  const nav = useNavigate(); const toast = useToast(); const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [busy, setBusy] = useState(false)
  const [roles, setRoles] = useState<{ dept: string; spec: string }[]>([{ dept: DEPTS[0], spec: '' }, { dept: DEPTS[1], spec: '' }])
  const setN = (n: number) => setRoles(r => Array.from({ length: Math.max(1, Math.min(8, n || 1)) }, (_, i) => r[i] ?? { dept: DEPTS[0], spec: '' }))
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    const t = await supabase.from('team_requests').insert({ title: title.trim(), description: desc.trim() }).select('id').single()
    if (t.error) { setBusy(false); return toast(t.error.message, 'error') }
    const r = await supabase.from('team_roles').insert(roles.map(x => ({ request_id: t.data.id, dept: x.dept, specialization: x.spec.trim() })))
    if (r.error) { await supabase.from('team_requests').delete().eq('id', t.data.id); setBusy(false); return toast(r.error.message, 'error') }
    toast('Team request posted.'); nav('/app/teams?tab=mine')
  }
  return <form onSubmit={submit} className="card p-6 space-y-5 max-w-2xl animate-up">
    <Field label="Project title"><input className="input" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></Field>
    <Field label="Short description"><textarea className="input" rows={3} required maxLength={600} value={desc} onChange={e => setDesc(e.target.value)} /></Field>
    <Field label="People needed"><div className="flex items-center gap-3"><input type="range" min={1} max={8} value={roles.length} onChange={e => setN(+e.target.value)} className="flex-1 accent-[rgb(var(--brand))]" /><span className="chip text-base w-10 justify-center">{roles.length}</span></div></Field>
    <div className="space-y-3">{roles.map((r, i) => <div key={i} className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl bg-soft/50">
      <select className="input" aria-label={`Person ${i + 1} department`} value={r.dept} onChange={e => setRoles(rs => rs.map((x, j) => j === i ? { ...x, dept: e.target.value } : x))}>{DEPTS.map(d => <option key={d}>{d}</option>)}</select>
      <input className="input" required maxLength={80} aria-label={`Person ${i + 1} specialization`} placeholder={`Person ${i + 1} specialization e.g. PCB design`} value={r.spec} onChange={e => setRoles(rs => rs.map((x, j) => j === i ? { ...x, spec: e.target.value } : x))} /></div>)}</div>
    <button className="btn w-full py-3" disabled={busy}>{busy ? 'Posting…' : 'Post team request'}</button></form>
}

function Roster({ id }: { id: number }) {
  const { data } = useQuery(async () => ok(await supabase.rpc('team_roster', { p_req: id })) as Member[], [id])
  return <div className="mt-3 space-y-1.5">{data?.map((m, i) => <div key={i} className="text-sm flex flex-wrap gap-x-2"><b>{m.name}</b><a className="text-brand" href={`mailto:${m.email}`}>{m.email}</a><span className="text-mut">— {m.role}</span></div>)}</div>
}

function Mine({ teams, reload }: { teams: Team[]; reload: () => void }) {
  const { profile } = useAuth(); const toast = useToast()
  const created = teams.filter(t => t.creator_id === profile!.id); const joined = teams.filter(t => t.team_roles.some(r => r.filled_by === profile!.id))
  const del = async (id: number) => { if (!confirm('Delete this team request?')) return; const { error } = await supabase.from('team_requests').delete().eq('id', id); error ? toast(error.message, 'error') : toast('Team request deleted.'); reload() }
  return <div className="space-y-8">
    <section><h2 className="font-bold mb-3">Requests I created</h2>{!created.length ? <Empty icon={<Users />} title="You haven't posted any" to="/app/teams?tab=create" cta="Create one" /> :
      <div className="space-y-3">{created.map(t => <div key={t.id} className="card p-5 animate-up"><div className="flex justify-between"><b className="text-lg">{t.title}</b>
        <button className="btn btn-bad btn-sm" aria-label="Delete" onClick={() => del(t.id)}><Trash2 size={14} /></button></div><p className="text-sm text-mut mt-1">{t.description}</p>
        <div className="mt-3 grid gap-2">{t.team_roles.map(r => <div key={r.id} className="flex justify-between text-sm rounded-xl border border-line px-3.5 py-2"><span>{r.specialization} <span className="text-mut">· {r.dept}</span></span>
          {r.filled_by ? <Badge k="filled">{r.filled_name}</Badge> : <Badge k="open" />}</div>)}</div>
        {t.team_roles.some(r => r.filled_by) && <Roster id={t.id} />}</div>)}</div>}</section>
    <section><h2 className="font-bold mb-3">Teams I joined</h2>{!joined.length ? <p className="text-sm text-mut">You haven't joined any team yet.</p> :
      <div className="space-y-3">{joined.map(t => <div key={t.id} className="card p-5"><b>{t.title}</b><p className="text-sm text-mut">{t.description}</p><Roster id={t.id} /></div>)}</div>}</section></div>
}
