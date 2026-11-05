import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './server.css'
import { parseProjectXml } from './planImport'
import { taskOutline } from './taskOutline'

const date = value => value ? new Date(value).toLocaleDateString('de-DE') : '–'
const checked = result => { if (result.error) throw result.error; return result.data || [] }

function PlanImport({ project, reload }) {
  const [plan, setPlan] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function preview(e) {
    const file = e.target.files?.[0]; e.target.value = ''; setPlan(null); setMessage('')
    if (!file) return
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Die XML-Datei darf höchstens 10 MB groß sein.')
      const parsed = parseProjectXml(await file.text(), file.name)
      const stack = []
      const tasks = parsed.tasks.map(task => {
        while (stack.length && stack.at(-1).level >= task.outlineLevel) stack.pop()
        const row = { uid: task.msProjectUid, name: task.text, level: task.outlineLevel, parentUid: stack.at(-1)?.uid || null, wbs: task.wbs, summary: task.isSummary, start: task.planStart ? `${task.planStart}T00:00:00` : null, finish: task.planFinish ? `${task.planFinish}T00:00:00` : null }
        if (task.isSummary) stack.push(row)
        return row
      })
      setPlan({ ...parsed, payload: tasks })
    } catch (e) { setMessage(e.message) }
  }
  async function apply() {
    setBusy(true)
    try {
      checked(await supabase.rpc('apply_project_xml_plan_with_resources', { p_project_id: project.id, p_file_name: plan.fileName, p_plan: plan.payload, p_resources: plan.resources, p_assignments: plan.assignments }))
      setPlan(null); setMessage('Projektplan auf dem Server aktualisiert. Bestehende Meldungen und Benutzerzuordnungen bleiben erhalten.'); await reload()
    } catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  return <details className="panel"><summary>MS-Project-Plan aktualisieren</summary><p>Wähle den XML-Plan für „{project.name}“. Fehlende Vorgänge werden als inaktiv markiert; Meldungen bleiben erhalten.</p><input type="file" accept=".xml" disabled={busy} onChange={preview} aria-label="MS-Project-XML auswählen" />{plan && <div><p><strong>{plan.name}</strong>: {plan.tasks.length} Vorgänge, {plan.resources.length} Ressourcen, {plan.assignments.length} Zuordnungen.</p><p>Prüfe, dass die Datei zum ausgewählten Projekt gehört.</p><ul>{plan.tasks.slice(0,12).map(t => <li key={t.msProjectUid}>{t.wbs} {t.text} · {t.planStart} – {t.planFinish}</li>)}</ul><button disabled={busy} onClick={apply}>Plan für dieses Projekt übernehmen</button> <button disabled={busy} onClick={() => setPlan(null)}>Abbrechen</button></div>}{message && <p role="status">{message}</p>}</details>
}

function ResourceEditor({ resource, project, reload }) {
  const [email, setEmail] = useState(resource.email || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(invite) {
    setBusy(true); setMessage('')
    try {
      if (invite) {
        const result = await supabase.functions.invoke('invite-resource', { body: { project_id: project.id, resource_id: resource.id, email } })
        checked(result)
        if (result.data?.error) throw new Error(result.data.error)
        setMessage('Benutzer zugeordnet. Neue Benutzer erhalten eine Einladung.')
      } else {
        const rows = checked(await supabase.from('resources').update({ access_enabled: !resource.access_enabled }).eq('id', resource.id).select('id'))
        if (!rows.length) throw new Error('Keine Änderung gespeichert. Bitte Berechtigungen prüfen.')
      }
      await reload()
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <article className="resource">
    <strong>{resource.name}</strong>
    <span>{resource.auth_user_id ? 'Benutzer verbunden' : 'Noch kein Benutzer verbunden'} · {resource.access_enabled ? 'Freigegeben' : 'Gesperrt'}</span>
    <label>E-Mail für {resource.name}<input type="email" value={email} disabled={busy || Boolean(resource.auth_user_id)} onChange={e => setEmail(e.target.value)} /></label>
    {!resource.auth_user_id && <button disabled={busy || !email.includes('@')} onClick={() => save(true)}>Benutzer verbinden / einladen</button>}
    {resource.auth_user_id && <button disabled={busy} onClick={() => save(false)}>{resource.access_enabled ? 'Zugriff sperren' : 'Zugriff freigeben'}</button>}
    {message && <p role="status">{message}</p>}
  </article>
}

function Report({ task, resources, links, user, owner, reload }) {
  const eligible = resources.filter(r => links.some(l => l.task_id === task.id && l.resource_id === r.id) && (owner || (r.auth_user_id === user.id && r.access_enabled)))
  const [percent, setPercent] = useState(0)
  const [comment, setComment] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(null)
  const input = useRef(null)
  const camera = useRef(null)
  if (task.is_summary || !eligible.length || !task.active) return null
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    let report = saved
    try {
      if (!report) {
        report = checked(await supabase.from('progress_updates').insert({ project_id: task.project_id, task_id: task.id, resource_id: resourceId || eligible[0].id, author_user_id: user.id, percent_complete: Number(percent), comment: comment.trim() || null, client_created_at: new Date().toISOString(), client_update_id: crypto.randomUUID() }).select().single())
        setSaved(report)
      }
      let pending = [...files]
      for (const file of files) {
        const id = crypto.randomUUID()
        const extension = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '').slice(0,10)
        const path = `${task.project_id}/${task.id}/${report.id}/${id}.${extension}`
        checked(await supabase.storage.from('task-media').upload(path, file, { contentType: file.type, upsert: false }))
        try {
          checked(await supabase.from('media').insert({ id, progress_update_id: report.id, project_id: task.project_id, task_id: task.id, resource_id: report.resource_id, author_user_id: user.id, storage_path: path, media_type: file.type.startsWith('video/') ? 'video' : 'photo', captured_at: new Date().toISOString() }))
        } catch (error) {
          await supabase.storage.from('task-media').remove([path])
          throw error
        }
        pending = pending.filter(f => f !== file); setFiles(pending)
      }
      setSaved(null); setComment(''); setMessage('Fortschritt und Belege auf dem Server gespeichert.')
      await reload()
    } catch (error) { setMessage(`${report ? 'Fortschrittsmeldung gespeichert; Belege noch nicht vollständig übertragen. Erneut versuchen. ' : ''}${error.message}`) }
    finally { setBusy(false) }
  }
  function pick(e) {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','video/mp4','video/quicktime','video/x-m4v','video/webm']
    if (files.length + selected.length > 10 || selected.some(f => !allowed.includes(f.type) || f.size > 50 * 1024 * 1024 || !f.size)) {
      setMessage('Maximal 10 Fotos/Videos, je 50 MB. Bitte ein unterstütztes Bild- oder Videoformat wählen.'); return
    }
    setMessage(''); setFiles([...files, ...selected])
  }
  return <form onSubmit={submit} className="report">
    <fieldset disabled={busy || Boolean(saved)}>
      {eligible.length > 1 && <label>Ressource<select value={resourceId || eligible[0].id} onChange={e => setResourceId(e.target.value)}>{eligible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}
      <label>Fortschritt: {percent} %<input type="range" min="0" max="100" value={percent} onChange={e => setPercent(e.target.value)} /></label>
      <label>Kommentar<textarea value={comment} maxLength={10000} onChange={e => setComment(e.target.value)} /></label>
      <input ref={camera} hidden type="file" accept="image/*" capture="environment" onChange={pick} />
      <input ref={input} hidden type="file" accept="image/*,video/*" multiple onChange={pick} />
      <div className="actions"><button type="button" onClick={() => camera.current.click()}>Foto aufnehmen</button><button type="button" onClick={() => input.current.click()}>Fotoarchiv / Dateien</button></div>
      {files.map((f,i) => <p key={i}>{f.name} <button type="button" onClick={() => setFiles(files.filter((_,n) => n !== i))}>Entfernen</button></p>)}
    </fieldset>
    <button disabled={busy} type="submit">{busy ? 'Wird gespeichert …' : saved ? 'Belege erneut übertragen' : 'Fortschritt melden'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}

function Attachment({ item }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  async function open() {
    try { const data = checked(await supabase.storage.from('task-media').createSignedUrl(item.storage_path, 300)); setUrl(data.signedUrl) }
    catch (e) { setError(e.message) }
  }
  return <div>{!url ? <button onClick={open}>{item.media_type === 'photo' ? 'Foto anzeigen' : 'Video anzeigen'}</button> : item.media_type === 'photo' ? <img className="evidence" src={url} alt="Fotobeleg zur Fortschrittsmeldung" /> : <video className="evidence" src={url} controls playsInline />}{error && <p role="alert">{error}</p>}</div>
}

export default function ServerApp() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState({ tasks: [], resources: [], links: [], reports: [], media: [] })
  const [expanded, setExpanded] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)
  const currentUser = useRef(null)
  const project = projects.find(p => p.id === projectId)
  const owner = Boolean(project && project.owner_user_id === session?.user.id)

  useEffect(() => {
    if (!supabase) { setReady(true); return }
    let active = true
    function updateSession(value) {
      if (!active) return
      if (currentUser.current !== (value?.user.id || null)) {
        currentUser.current = value?.user.id || null
        generation.current++; setData({ tasks: [], resources: [], links: [], reports: [], media: [] }); setProjects([]); setProjectId('')
      }
      setSession(value); setReady(true)
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => updateSession(value))
    supabase.auth.getSession().then(({ data, error }) => { if (active) { if (error) setError(error.message); updateSession(data.session) } })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true
    supabase.from('projects').select('id,name,owner_user_id').order('name').then(result => {
      if (!active) return
      try { const rows = checked(result); setProjects(rows); setProjectId(rows[0]?.id || '') } catch (e) { setError(e.message) }
    })
    return () => { active = false }
  }, [session?.user.id])

  async function reload() {
    if (!projectId) return
    const current = ++generation.current
    const results = await Promise.all([
      supabase.from('tasks').select('*').eq('project_id', projectId).order('project_task_uid'),
      supabase.from('resources').select('*').eq('project_id', projectId).order('project_resource_uid'),
      supabase.from('task_resources').select('task_id,resource_id'),
      supabase.from('progress_updates').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('media').select('*').eq('project_id', projectId).order('created_at'),
    ])
    if (current !== generation.current) return
    const [tasks, resources, links, reports, media] = results.map(checked)
    setData({ tasks, resources, links, reports, media })
  }
  useEffect(() => {
    setData({ tasks: [], resources: [], links: [], reports: [], media: [] }); setExpanded({}); setError('')
    reload().catch(e => setError(e.message))
    return () => { generation.current++ }
  }, [projectId, session?.user.id])

  async function signIn(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      checked(await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}` } }))
      setMessage('Bitte öffne den neuen Anmeldelink aus deinem E-Mail-Postfach.')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const rows = taskOutline(data.tasks, expanded)
  return <main className="server-app">
    <header><div><p className="eyebrow">Mathias Alt</p><h1>Projektfortschritt</h1></div>{session && <button onClick={async () => { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) setError(error.message) }}>Abmelden</button>}</header>
    <p className="intro">Projekte, Fortschritte und Belege werden zentral auf dem Server gespeichert.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {!supabase ? <p role="alert">Die Serververbindung ist noch nicht konfiguriert. Bitte die Projektverwaltung kontaktieren.</p> : !ready ? <p>Anmeldung wird geprüft …</p> : !session ? <form className="login" onSubmit={signIn}><h2>Persönlich anmelden</h2><label>E-Mail-Adresse<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><button disabled={busy}>Anmeldelink senden</button><p role="status">{message}</p></form> : <>
      <p>Angemeldet als <strong>{session.user.email}</strong></p>
      {!projects.length ? <p>Deinem Konto ist noch kein freigegebenes Projekt zugeordnet. Bitte kontaktiere den Projektmanager.</p> : <>
        <div className="project-bar"><label>Projekt<select value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button onClick={() => reload().catch(e => setError(e.message))}>Aktualisieren</button><span>{owner ? 'Projektmanager' : 'Ressource'}</span></div>
        {owner && <details className="panel"><summary>Benutzer und Ressourcen verwalten</summary><p>Die Zuordnung gilt nur für dieses Projekt. Ressourcenbenutzer sehen ausschließlich ihre freigegebenen Aufgaben.</p><div className="resource-grid">{data.resources.map(r => <ResourceEditor key={`${projectId}:${r.id}:${r.auth_user_id}`} resource={r} project={project} reload={reload} />)}</div></details>}
        {owner && <PlanImport key={projectId} project={project} reload={reload} />}
        <section><h2>{owner ? 'Projektaufgaben' : 'Meine Aufgaben'}</h2>
          {!data.tasks.length && <p>Keine zugewiesenen Aufgaben vorhanden.</p>}
          {rows.map(({ task, depth, hasChildren, open }) => {
            const reports = data.reports.filter(r => r.task_id === task.id)
            const latest = reports.at(-1)
            return <article className="task" key={task.id} style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}>
              <h3>{hasChildren ? <button className="outline-toggle" aria-label={`${task.name} ${open ? 'zuklappen' : 'aufklappen'}`} aria-expanded={open} onClick={() => setExpanded(previous => ({ ...previous, [task.id]: !(previous[task.id] ?? depth === 0) }))}><span aria-hidden="true">{open ? '−' : '+'}</span> {task.wbs} {task.name}</button> : <>{task.wbs} {task.name}</>} {!task.active && '(nicht mehr im Plan)'}</h3>
              <p>{date(task.plan_start)} – {date(task.plan_finish)} · {latest ? `${latest.percent_complete} % gemeldet` : 'Noch keine Fortschrittsmeldung'}</p>
              <p>{data.resources.filter(r => data.links.some(l => l.task_id === task.id && l.resource_id === r.id)).map(r => r.name).join(', ')}</p>
              <details><summary>Fortschritt und Belege</summary><Report key={task.id} task={task} resources={data.resources} links={data.links} user={session.user} owner={owner} reload={reload} />
                {reports.map(r => <div className="history" key={r.id}><strong>{r.percent_complete} %</strong> · {new Date(r.created_at).toLocaleString('de-DE')} · {data.resources.find(x => x.id === r.resource_id)?.name}<p className="comment">{r.comment}</p>{data.media.filter(m => m.progress_update_id === r.id).map(m => <Attachment key={m.id} item={m} />)}</div>)}
              </details>
            </article>
          })}
        </section>
      </>}
    </>}
  </main>
}
