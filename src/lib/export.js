/**
 * CSV / Excel / PDF exports.
 * xlsx and jspdf are dynamically imported so they never weigh down app startup.
 */
import { fmtTime, toDateInput, entryMs, breaksMs } from './time.js';
import { t } from './i18n.svelte.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** entries -> plain rows, sorted chronologically */
export function buildRows(entriesList, projectsList) {
  const byId = new Map(projectsList.map((p) => [p.id, p]));
  return [...entriesList]
    .sort((a, b) => a.start - b.start)
    .map((e) => {
      const p = byId.get(e.projectId);
      return {
        date: toDateInput(e.start),
        project: p ? p.title : t('unassigned'),
        client: p ? p.client : '',
        start: fmtTime(e.start),
        end: fmtTime(e.end),
        breakHours: +(breaksMs(e) / 3600000).toFixed(2),
        hours: +(entryMs(e) / 3600000).toFixed(2),
        note: e.note || ''
      };
    });
}

export function exportCSV(rows, filename = 'timetrack.csv') {
  const head = ['Date', 'Project', 'Client', 'Start', 'End', 'Break', 'Hours', 'Comment'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(';'), ...rows.map((r) => [r.date, r.project, r.client, r.start, r.end, r.breakHours, r.hours, r.note].map(esc).join(';'))];
  download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function exportXLSX(rows, filename = 'timetrack.xlsx') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(
    rows.map((r) => ({ Date: r.date, Project: r.project, Client: r.client, Start: r.start, End: r.end, Break: r.breakHours, Hours: r.hours, Comment: r.note }))
  );
  ws['!cols'] = [{ wch: 11 }, { wch: 24 }, { wch: 18 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timetrack');
  XLSX.writeFile(wb, filename);
}

export async function exportPDF(rows, { title = 'Timetrack Report', subtitle = '' } = {}, filename = 'timetrack.pdf') {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(23, 25, 27);
  doc.text(title, 14, 20);
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 28);
  }

  const total = rows.reduce((s, r) => s + r.hours, 0);
  autoTable(doc, {
    startY: subtitle ? 34 : 28,
    head: [['Date', 'Project', 'Start', 'End', 'Break', 'Hours', 'Comment']],
    body: rows.map((r) => [r.date, r.project, r.start, r.end, r.breakHours ? r.breakHours.toFixed(2) : '', r.hours.toFixed(2), r.note]),
    foot: [['', '', '', '', 'Total', total.toFixed(2), '']],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [23, 25, 27], textColor: [57, 255, 20] },
    footStyles: { fillColor: [241, 241, 238], textColor: [23, 25, 27], fontStyle: 'bold' }
  });

  doc.save(filename);
}
