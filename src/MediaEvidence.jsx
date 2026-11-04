import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'

const BUCKET = 'task-media'
const MAX_FILES = 10
const MAX_SIZE = 100 * 1024 * 1024
const extensions = new Set(['jpg','jpeg','png','webp','gif','heic','heif','avif','mp4','mov','m4v','webm'])
const types = {
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  gif:'image/gif', heic:'image/heic', heif:'image/heif', avif:'image/avif',
  mp4:'video/mp4', mov:'video/quicktime', m4v:'video/x-m4v', webm:'video/webm',
}

export function checkEvidence(files) {
  if (files.length > MAX_FILES) throw new Error('Höchstens 10 Dateien pro Meldung.')
  return files.map(file => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!extensions.has(ext) || !file.size || file.size > MAX_SIZE) {
      throw new Error('Ungültige oder zu große Datei: ' + file.name + ' (maximal 100 MB).')
    }
    if (file.type && file.type !== types[ext]) {
      // Do not trust file names that contradict a declared MIME type.
      throw new Error('Dateityp und Dateiendung passen nicht zusammen: ' + file.name)
    }
    return { file, ext, contentType: types[ext], mediaType: types[ext].startsWith('image/') ? 'photo' : 'video' }
  })
}

// Caller must have inserted an authorized progress_updates row first.
// Files remain private: paths and short-lived URLs are never written to browser storage.
export async function uploadEvidence({ files, projectId, taskId, updateId, resourceId, userId }) {
  const results = { uploaded: 0, failed: [] }
  for (const { file, ext, contentType, mediaType } of checkEvidence(files)) {
    const path = `${projectId}/${taskId}/${updateId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, file, { contentType, upsert: false, cacheControl: '0' })
    if (uploadError) { results.failed.push(file.name + ': ' + uploadError.message); continue }
    const { error: metadataError } = await supabase.from('media').insert({
      progress_update_id: updateId, project_id: projectId, task_id: taskId,
      resource_id: resourceId, author_user_id: userId, storage_path: path,
      media_type: mediaType, captured_at: new Date().toISOString(),
    })
    if (metadataError) {
      // The uploaded object is private but orphaned: no DELETE policy is available.
      // Never claim it was persisted as an attached report.
      results.failed.push(file.name + ': Zuordnung fehlgeschlagen (' + metadataError.message + '). Speicherbereinigung durch Administrator erforderlich.')
    } else results.uploaded += 1
  }
  return results
}

export function EvidencePicker({ files, onChange, disabled }) {
  const change = event => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    onChange([...files, ...selected])
  }
  return <div className="server-evidence-picker">
    <label>Foto direkt aufnehmen<input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={change} /></label>
    <label>Foto oder Video aus Archiv auswählen<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,video/mp4,video/quicktime,video/x-m4v,video/webm,.heic,.heif" multiple disabled={disabled} onChange={change} /></label>
    {files.length > 0 && <><p>{files.length} Datei(en) für diese Meldung ausgewählt.</p>
      <ul>{files.map((file, index) => <li key={index}>{file.name} <button type="button" disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))}>Entfernen</button></li>)}</ul></>}
  </div>
}

export function EvidenceList({ updateId }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const objectUrls = []
    async function load() {
      const { data, error: listError } = await supabase.from('media')
        .select('id,storage_path,media_type,created_at')
        .eq('progress_update_id', updateId).order('created_at')
      if (!active) return
      if (listError) { setError(listError.message); setLoading(false); return }
      const next = []
      for (const entry of data || []) {
        // Authenticated download through RLS, no public URL or persistent signed URL.
        const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(entry.storage_path)
        if (!active) return
        if (downloadError) { next.push({ ...entry, error: 'Datei nicht abrufbar.' }); continue }
        const url = URL.createObjectURL(blob)
        objectUrls.push(url)
        next.push({ ...entry, url })
      }
      if (active) { setItems(next); setLoading(false) }
    }
    load().catch(e => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false; objectUrls.forEach(url => URL.revokeObjectURL(url)) }
  }, [updateId])
  if (loading) return <p>Belege werden geladen …</p>
  return <div className="server-evidence-list">
    {error && <p role="alert">Belege nicht abrufbar: {error}</p>}
    {items.map(entry => <figure key={entry.id}>
      {entry.url && entry.media_type === 'photo' && <img src={entry.url} loading="lazy" alt="Fortschrittsfoto" style={{maxWidth:'100%',maxHeight:240}} />}
      {entry.url && entry.media_type === 'video' && <video src={entry.url} controls playsInline preload="metadata" style={{maxWidth:'100%',maxHeight:240}} />}
      <figcaption>{new Date(entry.created_at).toLocaleString('de-DE')} · {entry.error || (entry.url && <a href={entry.url} download={entry.storage_path.split('/').pop()}>Datei speichern</a>)}</figcaption>
    </figure>)}
  </div>
}
