/**
 * PDF export utilities — client-side only (no 'use server').
 * Uses jsPDF + jspdf-autotable to generate results PDFs.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EventFullData } from '@/app/races/[eventId]/actions';
import type { DriverClass } from '@/types/database';

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

// ============================================================
// Core builder — one section per session group
// ============================================================

function buildResultsPdf(
  doc: jsPDF,
  title: string,
  eventName: string,
  eventDate: string | null,
  sessions: Session[],
  entries: Entry[],
  columns: { header: string; key: string }[]
): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  // ----- Title block -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CORNER 1 HOBIKARDISARI', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.text(eventName.toUpperCase(), pageWidth / 2, 23, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (eventDate) {
    doc.text(formatDate(eventDate), pageWidth / 2, 29, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, 37, { align: 'center' });

  let startY = 43;

  // ----- One table per session group -----
  for (const session of sessions) {
    const sorted = [...session.results].sort(
      (a, b) => (a.position ?? 999) - (b.position ?? 999)
    );

    // Find kart number for each driver from participants
    const kartMap = new Map<string, number | null>();
    for (const p of session.participants) {
      kartMap.set(p.driver_id, p.kart_number);
    }

    const entry = (driverId: string): Entry | undefined =>
      entries.find((e) => e.driver_id === driverId);

    const rows = sorted.map((r) => {
      const e = entry(r.driver_id);
      const driverFullName = `${r.driver.first_name} ${r.driver.last_name}`;
      return {
        position: r.position ?? '–',
        kart: kartMap.get(r.driver_id) ?? '–',
        name: driverFullName,
        class: e?.class ?? '–',
        totalTime: r.total_time ?? '–',
        fastestLap: r.fastest_lap ?? '–',
        penalty: r.penalty_note ?? '',
      };
    });

    // If no results yet, still show participant list
    if (sorted.length === 0) {
      const participantRows = session.participants.map((p, i) => ({
        position: '',
        kart: p.kart_number ?? '–',
        name: `${p.driver.first_name} ${p.driver.last_name}`,
        class: entry(p.driver_id)?.class ?? '–',
        totalTime: '',
        fastestLap: '',
        penalty: '',
      }));
      rows.push(...participantRows);
    }

    autoTable(doc, {
      startY,
      head: [[
        ...columns.map((c) => c.header),
      ]],
      body: rows.map((r) => columns.map((c) => String((r as Record<string, unknown>)[c.key] ?? ''))),
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
        0: { cellWidth: 12, halign: 'center' }, // Koht
        1: { cellWidth: 14, halign: 'center' }, // Kart
      },
      didDrawPage: (_data) => {
        // Page footer
        const pageCount = doc.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(
          `Lehekülg ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' }
        );
        doc.setTextColor(0);
      },
    });

    // Group heading BEFORE the table (redrawn over the gap)
    const tableStartY = startY;

    // Draw group label as a sub-header just above the table
    const labelY = tableStartY - 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(sessionLabel(session.type, session.group_name), 14, labelY);

    // Move cursor past this table
    const lastTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
    startY = (lastTable?.finalY ?? startY) + 10;

    // New page if too close to bottom
    if (startY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      startY = 20;
    }
  }
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
    if (i > 0) doc.addPage();
    buildResultsPdf(
      doc,
      sections[i].title,
      eventName,
      eventDate,
      sections[i].sessions,
      entries,
      sections[i].columns
    );
  }

  doc.save(`${eventName.replace(/\s+/g, '_')}_kõik_tulemused.pdf`);
}
