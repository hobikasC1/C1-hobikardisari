/**
 * PDF export utilities — client-side only (no 'use server').
 * Uses jsPDF + jspdf-autotable to generate results PDFs.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EventFullData } from '@/app/races/[eventId]/actions';
import type { DriverClass } from '@/types/database';
import { parseLapTime, millisToTimeStr } from '@/app/races/[eventId]/race-utils';

// ============================================================
// Types
// ============================================================

type Session = EventFullData['sessions'][number];
type Entry = EventFullData['entries'][number];

// ============================================================
// Helpers
// ============================================================

function sessionLabel(type: string, groupName: string): string {
  const typeMap: Record<string, string> = {
    quali_1: 'Q1',
    quali_2: 'Q2',
    heat: 'Eelsõit',
    final: 'Finaal',
  };
  return `${typeMap[type] ?? type} ${groupName}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('et-EE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Draw the standard page header. Returns the Y position immediately after the header.
 */
function drawPageHeader(
  doc: jsPDF,
  eventName: string,
  eventDate: string | null,
  sectionTitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CORNER 1 HOBIKARDISARI', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.text(eventName.toUpperCase(), pageWidth / 2, 23, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 23;
  if (eventDate) {
    doc.text(formatDate(eventDate), pageWidth / 2, 29, { align: 'center' });
    y = 29;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(sectionTitle, pageWidth / 2, y + 8, { align: 'center' });

  return y + 14;
}

function addPageFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Lehekülg ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  doc.setTextColor(0);
}

// ============================================================
// Core builder — one page per session group
// ============================================================

/**
 * Render sessions into `doc`. Each session group gets its own page.
 * @param startOnNewPage  pass true when appending a section after a previous one.
 */
function buildResultsPdf(
  doc: jsPDF,
  title: string,
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[],
  columns: { header: string; key: string }[],
  startOnNewPage = false
): void {
  for (let si = 0; si < sessions.length; si++) {
    if (si > 0 || startOnNewPage) {
      doc.addPage();
    }

    const headerEndY = drawPageHeader(doc, eventName, eventDate, title);
    const session = sessions[si];

    // Session group label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(sessionLabel(session.type, session.group_name), 14, headerEndY + 2);

    const tableStartY = headerEndY + 8;

    const sorted = [...session.results].sort(
      (a, b) => (a.position ?? 999) - (b.position ?? 999)
    );

    const kartMap = new Map<string, number | null>();
    for (const p of session.participants) {
      kartMap.set(p.driver_id, p.kart_number);
    }

    const getEntry = (driverId: string): Entry | undefined =>
      entries.find((e) => e.driver_id === driverId);

    const rows =
      sorted.length > 0
        ? sorted.map((r) => ({
            position: r.position ?? '–',
            kart: kartMap.get(r.driver_id) ?? '–',
            name: `${r.driver.first_name} ${r.driver.last_name}`,
            class: getEntry(r.driver_id)?.class ?? '–',
            totalTime: r.total_time ?? '–',
            fastestLap: r.fastest_lap ?? '–',
            penalty: r.penalty_note ?? '',
          }))
        : session.participants.map((p) => ({
            position: '',
            kart: p.kart_number ?? '–',
            name: `${p.driver.first_name} ${p.driver.last_name}`,
            class: getEntry(p.driver_id)?.class ?? '–',
            totalTime: '',
            fastestLap: '',
            penalty: '',
          }));

    autoTable(doc, {
      startY: tableStartY,
      head: [columns.map((c) => c.header)],
      body: rows.map((r) =>
        columns.map((c) => String((r as Record<string, unknown>)[c.key] ?? ''))
      ),
      theme: 'grid',
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 14, halign: 'center' },
      },
      didDrawPage: () => addPageFooter(doc),
    });
  }
}

// ============================================================
// Quali summary page (Kokkuvõte)
// ============================================================

function buildQualiSummaryPage(
  doc: jsPDF,
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[]
): void {
  doc.addPage();
  const headerEndY = drawPageHeader(doc, eventName, eventDate, 'Kvalifikatsioon');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kokkuvõte — Parim ring Q1 / Q2', 14, headerEndY + 2);

  // Compute best lap per driver across all quali sessions
  const bestLaps = new Map<string, { ms: number; name: string; driverClass: string }>();
  for (const session of sessions) {
    for (const r of session.results) {
      const ms = parseLapTime(r.fastest_lap);
      if (ms !== null) {
        const existing = bestLaps.get(r.driver_id);
        if (!existing || ms < existing.ms) {
          const entry = entries.find((e) => e.driver_id === r.driver_id);
          bestLaps.set(r.driver_id, {
            ms,
            name: `${r.driver.first_name} ${r.driver.last_name}`,
            driverClass: entry?.class ?? '–',
          });
        }
      }
    }
  }

  const ranked = Array.from(bestLaps.values())
    .sort((a, b) => a.ms - b.ms)
    .map((v, i) => [String(i + 1), v.name, v.driverClass, millisToTimeStr(v.ms)]);

  autoTable(doc, {
    startY: headerEndY + 8,
    head: [['Koht', 'Sõitja', 'Klass', 'Parim ring']],
    body: ranked,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
    },
    didDrawPage: () => addPageFooter(doc),
  });
}

// ============================================================
// Public export functions
// ============================================================

const QUALI_COLUMNS = [
  { header: 'Koht', key: 'position' },
  { header: 'Kart', key: 'kart' },
  { header: 'Sõitja', key: 'name' },
  { header: 'Klass', key: 'class' },
  { header: 'Parim ring', key: 'fastestLap' },
  { header: 'Karistus / märkused', key: 'penalty' },
];

const SESSION_COLUMNS = [
  { header: 'Koht', key: 'position' },
  { header: 'Kart', key: 'kart' },
  { header: 'Sõitja', key: 'name' },
  { header: 'Klass', key: 'class' },
  { header: 'Koguaeg', key: 'totalTime' },
  { header: 'Parim ring', key: 'fastestLap' },
  { header: 'Karistus / märkused', key: 'penalty' },
];

export function exportQualiResults(
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  buildResultsPdf(doc, 'Kvalifikatsioon', eventName, eventDate, sessions, entries, QUALI_COLUMNS);
  buildQualiSummaryPage(doc, eventName, eventDate, sessions, entries);
  doc.save(`${eventName.replace(/\s+/g, '_')}_kvalifikatsioon.pdf`);
}

export function exportHeatResults(
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  buildResultsPdf(doc, 'Eelsõidud', eventName, eventDate, sessions, entries, SESSION_COLUMNS);
  doc.save(`${eventName.replace(/\s+/g, '_')}_eelsoidu_tulemused.pdf`);
}

export function exportFinalResults(
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  buildResultsPdf(doc, 'Finaalid', eventName, eventDate, sessions, entries, SESSION_COLUMNS);
  doc.save(`${eventName.replace(/\s+/g, '_')}_finaali_tulemused.pdf`);
}

/**
 * Export all results (quali + heats + finals) as a single multi-page PDF.
 */
export function exportAllResults(
  eventName: string,
  eventDate: string | null,
  allSessions: Session[],
  entries: Entry[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const qualiSessions = allSessions.filter(
    (s) => s.type === 'quali_1' || s.type === 'quali_2'
  );
  const heatSessions = allSessions.filter((s) => s.type === 'heat');
  const finalSessions = allSessions.filter((s) => s.type === 'final');

  const sections: { title: string; sessions: Session[]; columns: typeof SESSION_COLUMNS }[] = [];
  if (qualiSessions.length > 0)
    sections.push({ title: 'Kvalifikatsioon', sessions: qualiSessions, columns: QUALI_COLUMNS });
  if (heatSessions.length > 0)
    sections.push({ title: 'Eelsõidud', sessions: heatSessions, columns: SESSION_COLUMNS });
  if (finalSessions.length > 0)
    sections.push({ title: 'Finaalid', sessions: finalSessions, columns: SESSION_COLUMNS });

  for (let i = 0; i < sections.length; i++) {
    buildResultsPdf(
      doc,
      sections[i].title,
      eventName,
      eventDate,
      sections[i].sessions,
      entries,
      sections[i].columns,
      i > 0 // startOnNewPage for all sections after the first
    );
    // Add Kokkuvõte page after quali section
    if (sections[i].title === 'Kvalifikatsioon') {
      buildQualiSummaryPage(doc, eventName, eventDate, qualiSessions, entries);
    }
  }

  doc.save(`${eventName.replace(/\s+/g, '_')}_kõik_tulemused.pdf`);
}
