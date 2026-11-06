import { taskOutline } from './taskOutline.js'
import { projectArea } from './projectArea.js'
import { latestReport } from './scheduleStatus.js'

const escapeXml = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]))
const column = index => { let name = ''; for (index++; index; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name; return name }
const encoder = new TextEncoder()
// Uncompressed ZIP containers are valid OOXML and require no network dependency.
function zip(files) {
  const local = [], central = []; let offset = 0
  for (const [path, text] of files) {
    const name = encoder.encode(path), bytes = encoder.encode(text)
    let crc = 0xffffffff
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
    crc = (crc ^ 0xffffffff) >>> 0
    const header = new Uint8Array(30 + name.length); const h = new DataView(header.buffer)
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, name.length, true); header.set(name, 30)
    local.push(header, bytes)
    const directory = new Uint8Array(46 + name.length); const d = new DataView(directory.buffer)
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true); directory.set(name, 46); central.push(directory)
    offset += header.length + bytes.length
  }
  const size = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22); const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true)
  return new Blob([...local, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const doc = text => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + text
const colors = { green: 2, complete: 2, yellow: 3, red: 4, unknown: 5 }
export function buildXlsx(sheets) {
  const files = []
  sheets.forEach((sheet, index) => {
    const links = []
    const rows = sheet.rows.map((row, r) => '<row r="' + (r + 1) + '">' + row.map((entry, c) => {
      const value = entry && typeof entry === 'object' ? entry.value : entry
      const ref = `${column(c)}${r + 1}`
      const style = r === 0 ? 1 : entry?.state ? colors[entry.state] || 0 : 0
      if (entry?.url) links.push({ ref, url: entry.url })
      // Inline string cells cannot execute comments beginning with '=' as formulas.
      return typeof value === 'number' && Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    }).join('') + '</row>').join('')
    files.push([`xl/worksheets/sheet${index + 1}.xml`, doc(`<worksheet xmlns="${ns}" xmlns:r="${rel}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${sheet.widths.map((width, c) => `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${column(sheet.rows[0].length - 1)}${sheet.rows.length}"/>${links.length ? '<hyperlinks>' + links.map((link, l) => `<hyperlink ref="${link.ref}" r:id="rId${l + 1}"/>`).join('') + '</hyperlinks>' : ''}</worksheet>`)])
    if (links.length) files.push([`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, doc('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + links.map((link, l) => `<Relationship Id="rId${l + 1}" Type="${rel}/hyperlink" Target="${escapeXml(link.url)}" TargetMode="External"/>`).join('') + '</Relationships>')])
  })
  files.push(['[Content_Types].xml', doc('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>')])
  files.push(['_rels/.rels', doc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)])
  files.push(['xl/workbook.xml', doc(`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)])
  files.push(['xl/_rels/workbook.xml.rels', doc('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`)])
  const fills = ['none', 'gray125', '164D43', 'DCF2DC', 'FFF0BB', 'FFDAD6', 'E6EAED']
  files.push(['xl/styles.xml', doc(`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="7">${fills.map((color, i) => i < 2 ? `<fill><patternFill patternType="${color}"/></fill>` : `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">${[0, 2, 3, 4, 5, 6].map((fill, i) => `<xf numFmtId="0" fontId="${i === 1 ? 1 : 0}" fillId="${fill}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)])
  return zip(files)
}

export async function exportProjectXlsx({ data, statuses, project, now, photoUrl }) {
  const tasks = new Map(data.tasks.map(t => [t.id, t]))
  const resources = new Map(data.resources.map(r => [r.id, r.name]))
  const timestamp = value => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : ''
  const place = task => projectArea(task, data.tasks, project)
  const status = id => ({ value: statuses.get(id)?.label || 'Nicht bewertbar', state: statuses.get(id)?.state })
  const expanded = Object.fromEntries(data.tasks.map(t => [t.id, true]))
  const taskRows = taskOutline(data.tasks, expanded).map(({ task, depth }) => {
    const latest = latestReport(data.reports.filter(r => r.task_id === task.id))
    return [depth + 1, task.wbs, place(task), task.name, task.plan_start?.slice(0, 10), task.plan_finish?.slice(0, 10), latest?.percent_complete ?? '', status(task.id), statuses.get(task.id)?.forecastDate || '', data.links.filter(l => l.task_id === task.id).map(l => resources.get(l.resource_id)).filter(Boolean).join(', '), task.active === false ? 'Nein' : 'Ja']
  })
  const reports = [...data.reports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id)))
  const reportRows = []; let maxPhotos = 0
  for (const report of reports) {
    const task = tasks.get(report.task_id)
    const photos = data.media.filter(m => m.progress_update_id === report.id && m.media_type === 'photo')
    maxPhotos = Math.max(maxPhotos, photos.length)
    const links = []
    for (const photo of photos) links.push({ value: `Foto ${links.length + 1}`, url: await photoUrl(photo) })
    reportRows.push([timestamp(report.created_at), place(task), task?.wbs || '', task?.name || 'Vorgang nicht verfügbar', report.percent_complete, report.comment || '', resources.get(report.resource_id) || '', status(report.task_id), timestamp(now), '60 Minuten ab Export', ...links])
  }
  const blob = buildXlsx([
    { name: 'Vorgänge', widths: [10, 16, 35, 40, 16, 16, 18, 35, 20, 35, 12], rows: [['Ebene', 'Gliederung', 'Ort / Projektbereich', 'Vorgang', 'Planstart', 'Planende', 'Fortschritt (%)', 'Terminampel aktuell', 'Rechnerisches Ende', 'Ressourcen', 'Aktiv'], ...taskRows] },
    { name: 'Meldungen', widths: [24, 35, 16, 40, 18, 55, 28, 35, 24, 26, ...Array(maxPhotos).fill(18)], rows: [['Datum / Uhrzeit (Berlin)', 'Ort / Projektbereich', 'Gliederung', 'Vorgang', 'Fortschritt (%)', 'Kommentar', 'Ressource', 'Terminampel aktuell', 'Exportstand (Berlin)', 'Fotolinks gültig', ...Array.from({ length: maxPhotos }, (_, i) => `Foto ${i + 1}`)], ...reportRows] },
  ])
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${(project?.name || 'Projektfortschritt').replace(/[^\p{L}\p{N}_-]/gu, '_')}_${now.toISOString().slice(0, 10)}.xlsx`
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000)
}
