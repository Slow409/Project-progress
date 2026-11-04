import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import { checkEvidence, uploadEvidence, EvidencePicker, EvidenceList } from './MediaEvidence.jsx'
import { parseServerProjectXml, compareServerPlan } from './serverProjectXml.js'
import './ServerWorkspace.css'

// Separate opt-in preview. The published legacy demo is unchanged.
// All project and report data is read from Supabase; no browser persistence is used here.
export default function ServerWorkspace() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [resources, setResources] = useState([])
  const [links, setLinks] = useState([])
  const [reports, setReports] = useState([])
  const [openTask, setOpenTask] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [percent, setPercent] = useState(0)
  const [comment, setComment] = useState('')
  const [reportResource, setReportResource] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importConfirm, setImportConfirm] = useState(false)

  const userId = session?.user?.id
  const selectedProject = projects.find(p => p.id === projectId)
  const owner = selectedProject?.owner_user_id === userId

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error: e }) => {
      if (!active) return
      if (e) setError(e.message)
      setSession(data.session)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next)
    })
    return () => { active = false; subscription.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId) {
      setProjects([]); setProjectId(''); setTasks([]); setResources([]); setLinks([]); setReports([])
      return
    }
    let active = true
    supabase.from('projects').select('id,name,owner_user_id').order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (!active) return
        if (e) setError(e.message)
        else { setProjects(data || []); setProjectId(current => data?.some(p => p.id === current) ? current : (data?.[0]?.id || '')) }
      })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!userId || !projectId) { setTasks([]); setResources([]); setLinks([]); setReports([]); return }
    let active = true
    Promise.all([
      supabase.from('tasks').select('id,project_id,name,wbs,outline_level,parent_task_uid,project_task_uid,is_summary,plan_start,plan_finish,active').eq('project_id', projectId).eq('active', true).order('project_task_uid'),
      supabase.from('resources').select('id,project_id,name,email,auth_user_id,access_enabled').eq('project_id', projectId).order('name'),
      supabase.from('task_resources').select('task_id,resource_id'),
      supabase.from('progress_updates').select('id,task_id,resource_id,percent_complete,comment,created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(500),
    ]).then(results => {
      if (!active) return
      const failure = results.find(r => r.error)
      if (failure) { setError(failure.error.message); return }
      setTasks(results[0].data || [])
      setResources(results[1].data || [])
      setLinks(results[2].data || [])
      setReports(results[3].data || [])
    })
    return () => { active = false }
  }, [userId, projectId])

  async function previewImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setImportPreview(null); setImportConfirm(false); setError(''); setNotice('')
    if (!file) return
    try {
      const parsed = await parseServerProjectXml(file)
      const { data, error: e } = await supabase.from('tasks')
        .select('project_task_uid,name,wbs,outline_level,parent_task_uid,is_summary,plan_start,plan_finish,active')
        .eq('project_id', projectId).limit(10000)
      if (e) throw e
      if (data.length >= 10000) throw new Error('Zu viele Vorgänge für eine zuverlässige Vorschau.')
      setImportPreview({ ...parsed, diff:compareServerPlan(parsed.tasks,data) })
    } catch (e) { setError('Importvorschau fehlgeschlagen: ' + e.message) }
  }

  async function applyImport() {
    if (!owner || !importPreview || !importConfirm || importBusy) return
    setImportBusy(true); setError(''); setNotice('')
    const result = await supabase.rpc('apply_project_xml_plan', {
      p_project_id: projectId, p_file_name: importPreview.fileName, p_plan: importPreview.tasks,
    })
    if (result.error) setError('Plan wurde nicht übernommen: ' + result.error.message)
    else {
      setNotice('Plan serverseitig aktualisiert: ' + result.data.added + ' neu, ' +
        result.data.changed + ' geändert, ' + result.data.inactive + ' inaktiv. Historie bleibt erhalten.')
      setImportPreview(null); setImportConfirm(false)
      const { data, error: reloadError } = await supabase.from('tasks')
        .select('id,project_id,name,wbs,outline_level,parent_task_uid,project_task_uid,is_summary,plan_start,plan_finish,active')
        .eq('project_id', projectId).eq('active',true).order('project_task_uid')
      if (reloadError) setError('Plan übernommen, Neuladen fehlgeschlagen: ' + reloadError.message)
      else setTasks(data || [])
    }
    setImportBusy(false)
  }

  async function login(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (e) setError(e.message)
    setPassword(''); setBusy(false)
  }

  async function refreshReports() {
    const { data, error: e } = await supabase.from('progress_updates')
      .select('id,task_id,resource_id,percent_complete,comment,created_at')
      .eq('project_id', projectId).order('created_at', { ascending: false }).limit(500)
    if (e) throw e
    setReports(data || [])
  }

  async function submitReport(event) {
    event.preventDefault()
    const task = tasks.find(t => t.id === openTask)
    if (!task) return
    const resource = resources.find(r => r.id === reportResource)
    if (!resource || !links.some(link => link.task_id === task.id && link.resource_id === resource.id)) {
      setError('Bitte eine dem Vorgang zugewiesene Ressource auswählen.')
      return
    }
    if (!owner && (!resource.access_enabled || resource.auth_user_id !== userId)) {
      setError('Keine Schreibberechtigung für diese Ressource.')
      return
    }
    try { checkEvidence(evidenceFiles) } catch (validationError) { setError(validationError.message); return }
    setBusy(true); setError(''); setNotice('')
    const { data: saved, error: e } = await supabase.from('progress_updates').insert({
      project_id: projectId, task_id: task.id, resource_id: resource.id,
      author_user_id: userId, percent_complete: Number(percent),
      comment: comment.trim() || null, client_created_at: new Date().toISOString(),
    }).select('id').single()
    if (e) setError(e.message)
    else {
      let upload = { uploaded: 0, failed: [] }
      if (evidenceFiles.length) {
        try {
          upload = await uploadEvidence({ files: evidenceFiles, projectId, taskId: task.id,
            updateId: saved.id, resourceId: resource.id, userId })
        } catch (uploadError) { upload.failed.push(uploadError.message) }
      }
      try {
        await refreshReports()
        setNotice('Fortschritt und Kommentar auf dem Server gespeichert. ' + upload.uploaded + ' Datei(en) hochgeladen.')
        setEvidenceFiles([]); setComment(''); setOpenTask('')
        if (upload.failed.length) setError('Nicht alle Belege konnten gespeichert werden: ' + upload.failed.join(' | '))
      }
      catch (refreshError) { setError('Meldung gespeichert, aber Liste konnte nicht aktualisiert werden: ' + refreshError.message) }
    }
    setBusy(false)
  }

  async function toggleResource(resource) {
    if (!owner || !resource.auth_user_id) return
    setBusy(true); setError(''); setNotice('')
    const { error: e } = await supabase.from('resources')
      .update({ access_enabled: !resource.access_enabled }).eq('id', resource.id).eq('project_id', projectId)
    if (e) setError(e.message)
    else {
      setResources(current => current.map(r => r.id === resource.id ? { ...r, access_enabled: !r.access_enabled } : r))
      setNotice('Ressourcenzugriff auf dem Server geändert.')
    }
    setBusy(false)
  }

  const assigned = taskId => links.filter(link => link.task_id === taskId).map(link => resources.find(r => r.id === link.resource_id)).filter(Boolean)
  const canReport = task => owner || assigned(task.id).some(r => r.auth_user_id === userId && r.access_enabled)
  const displayDate = value => value ? new Date(value).toLocaleDateString('de-DE') : '–'
  const childrenByParent = new Map()
  const visibleIds = new Set(tasks.map(task => task.project_task_uid))
  for (const task of tasks) {
    const parentId = visibleIds.has(task.parent_task_uid) ? task.parent_task_uid : null
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
    childrenByParent.get(parentId).push(task)
  }
  const byWbs = (a,b) => (a.wbs || String(a.project_task_uid)).localeCompare(
    b.wbs || String(b.project_task_uid), 'de', { numeric: true })
  for (const siblings of childrenByParent.values()) siblings.sort(byWbs)
  const visibleTasks = [], visited = new Set()
  function visit(task, level = 1) {
    if (visited.has(task.id)) return
    visited.add(task.id)
    const children = childrenByParent.get(task.project_task_uid) || []
    visibleTasks.push({ ...task, displayLevel: level, hasChildren: children.length > 0 })
    // First two levels are initially visible; deeper levels appear on demand.
    const expanded = expandedGroups[task.id] ?? (level === 1)
    if (expanded) for (const child of children) visit(child, level + 1)
  }
  for (const root of childrenByParent.get(null) || []) visit(root)
  // Safeguard for malformed or incomplete parent references.
  // Collapsed descendants are deliberately excluded from the rendered list.

  return <main className="server-workspace">
    <header><h1>Projektfortschritt · Serveransicht</h1><p>Geschützte Vorschau · Projektdaten werden nur vom Server geladen und dorthin geschrieben.</p></header>
    {error && <p className="server-error" role="alert">{error}</p>}
    {notice && <p className="server-notice" role="status">{notice}</p>}
    {!session ? <form onSubmit={login} className="server-panel">
      <h2>Anmeldung</h2>
      <label>E-Mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>Passwort<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <button disabled={busy}>Anmelden</button>
      <p>Nur bereits angelegte Benutzerkonten. Aus Sicherheitsgründen keine automatische Registrierung und keine dauerhafte Sitzung auf diesem Gerät.</p>
    </form> : <>
      <div className="server-toolbar"><span>Angemeldet: {session.user.email}</span><button type="button" onClick={() => supabase.auth.signOut()}>Abmelden</button></div>
      <label>Projekt auswählen<select value={projectId} onChange={e => { setProjectId(e.target.value); setOpenTask(''); setError(''); setNotice('') }}>
        {projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
      </select></label>
      {!projects.length && <p>Für dieses Benutzerkonto ist noch kein Projekt freigegeben.</p>}
      {selectedProject && <>
        <p>Rolle: <strong>{owner ? 'Projektverantwortlicher' : 'Zugewiesene Ressource'}</strong>. Die Datenbank entscheidet über jede Lese- und Schreibberechtigung.</p>
        <section className="server-panel"><h2>Vorgänge</h2>
          {!tasks.length && <p>Keine für dieses Konto sichtbaren Vorgänge vorhanden.</p>}
          {visibleTasks.map(task => <div className="server-task" key={task.id}>
            <div className="server-task-title" style={{ paddingLeft: Math.min(4, Math.max(0, task.displayLevel - 1)) * 12 }}>
              <strong>{task.hasChildren && <button type="button"
                aria-expanded={expandedGroups[task.id] ?? (task.displayLevel === 1)}
                aria-label={task.name + ' ' + ((expandedGroups[task.id] ?? (task.displayLevel === 1)) ? 'zuklappen' : 'aufklappen')}
                onClick={() => setExpandedGroups(current => ({
                  ...current, [task.id]: !(current[task.id] ?? (task.displayLevel === 1)),
                }))}>{(expandedGroups[task.id] ?? (task.displayLevel === 1)) ? '▾' : '▸'}</button>}
                {task.wbs ? task.wbs + ' · ' : ''}{task.name}</strong>
              <small>{displayDate(task.plan_start)} – {displayDate(task.plan_finish)}</small>
            </div>
            <div className="server-task-meta">Ressourcen: {assigned(task.id).map(r => r.name).join(', ') || 'Keine'} · Meldungen: {reports.filter(r => r.task_id === task.id).length}</div>
            {canReport(task) && !task.is_summary && <button type="button" onClick={() => {
              setOpenTask(task.id === openTask ? '' : task.id)
              const candidates = assigned(task.id).filter(r => owner || (r.auth_user_id === userId && r.access_enabled))
              setReportResource(candidates[0]?.id || '')
              setPercent(Number(reports.find(r => r.task_id === task.id)?.percent_complete || 0))
              setComment(''); setEvidenceFiles([])
            }}>Fortschritt melden</button>}
            {openTask === task.id && <form className="server-report" onSubmit={submitReport}>
              <label>Ressource<select required value={reportResource} onChange={e => setReportResource(e.target.value)}>
                <option value="">Bitte auswählen</option>
                {assigned(task.id).filter(r => owner || (r.auth_user_id === userId && r.access_enabled)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></label>
              <label>Fortschritt in % <input type="number" min="0" max="100" step="1" required value={percent} onChange={e => setPercent(e.target.value)} /></label>
              <label>Kommentar<textarea value={comment} onChange={e => setComment(e.target.value)} rows="3" maxLength="10000" /></label>
              <EvidencePicker files={evidenceFiles} disabled={busy} onChange={files => { setEvidenceFiles(files); setError('') }} />
              <button disabled={busy || !reportResource}>Auf Server speichern</button>
            </form>}
            {reports.filter(r => r.task_id === task.id).slice(0, 3).map(r => <div className="server-history" key={r.id}>
              <p>{new Date(r.created_at).toLocaleString('de-DE')} · {r.percent_complete} % {r.comment ? '· ' + r.comment : ''}</p>
              <EvidenceList updateId={r.id} />
            </div>)}
          </div>)}
        </section>
        {owner && <section className="server-panel"><h2>MS-Project-Plan importieren</h2>
          <p>Neue Vorgänge werden anhand der MS-Project-UID angelegt, bekannte Vorgänge aktualisiert und entfernte Vorgänge nur inaktiv markiert. Fortschrittsberichte und Belege bleiben erhalten.</p>
          <label>MS-Project-XML auswählen<input type="file" accept=".xml,application/xml,text/xml" disabled={importBusy} onChange={previewImport}/></label>
          {importPreview && <div>
            <h3>Vorschau: {importPreview.name}</h3>
            <p>{importPreview.tasks.length} Vorgänge · {importPreview.diff.added} neu · {importPreview.diff.changed} geändert · {importPreview.diff.unchanged} unverändert · {importPreview.diff.inactive} werden inaktiv.</p>
            <p>Wichtig: Die Serverdaten werden erst beim Bestätigen aktualisiert. Historische Meldungen werden nicht gelöscht. Ressourcenzuordnungen sind nicht Bestandteil dieses Imports.</p>
            <label><input type="checkbox" checked={importConfirm} onChange={e => setImportConfirm(e.target.checked)}/> Vorschau geprüft und Aktualisierung freigegeben</label>
            <button type="button" disabled={!importConfirm || importBusy} onClick={applyImport}>Projektplan auf Server aktualisieren</button>
          </div>}
        </section>}
        {owner && <section className="server-panel"><h2>Ressourcen und Zugriffsrechte</h2>
          {resources.map(r => <div className="server-resource" key={r.id}>
            <span><strong>{r.name}</strong> · {r.email || 'Keine E-Mail'} · {r.auth_user_id ? (r.access_enabled ? 'Zugriff aktiv' : 'Zugriff gesperrt') : 'Noch keinem Benutzer zugeordnet'}</span>
            {r.auth_user_id && <button type="button" disabled={busy} onClick={() => toggleResource(r)}>{r.access_enabled ? 'Sperren' : 'Freigeben'}</button>}
          </div>)}
          <p>Eine Ressource erhält Schreibrechte nur für zugewiesene Vorgänge. Nicht zugeordnete Benutzer werden hier bewusst nicht automatisch freigeschaltet.</p>
        </section>}
      </>}
    </>}
  </main>
}
