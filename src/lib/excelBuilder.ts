import writeXlsxFile, {type CellObject, type Sheet, type SheetData} from 'write-excel-file/browser';
import type {BilingualResearchReport} from '../types/workforce';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function headerCell(value: string): CellObject {
  return {
    value,
    fontWeight: 'bold',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
    alignVertical: 'center',
  };
}

function bodyCell(value: string, bold = false): CellObject {
  return {
    value,
    fontWeight: bold ? 'bold' : undefined,
    wrap: true,
    alignVertical: 'top',
  };
}

function buildSheets(report: BilingualResearchReport): Sheet<File>[] {
  const comparisonData: SheetData = [
    [
      headerCell('Criterion (English)'),
      headerCell('ခေါင်းစဉ် (မြန်မာ)'),
      headerCell('Activepieces (2026)'),
      headerCell('n8n (2026)'),
      headerCell('OpenClaw (2026)'),
      headerCell('မှတ်ချက် (Burmese Notes)'),
    ],
    ...report.tableRows.map((row) => [
      bodyCell(row.criterion_en, true),
      bodyCell(row.criterion_mm),
      bodyCell(row.activepieces),
      bodyCell(row.n8n),
      bodyCell(row.openclaw),
      bodyCell(row.notes_mm),
    ]),
  ];

  const reportData: SheetData = [
    [headerCell('Section'), headerCell('English'), headerCell('မြန်မာဘာသာ (Burmese)')],
    [bodyCell('Report Title', true), bodyCell(report.reportTitleEn), bodyCell(report.reportTitleMm)],
    [
      bodyCell('Executive Summary', true),
      bodyCell(report.executiveSummaryEn),
      bodyCell(report.executiveSummaryMm),
    ],
    ...report.detailedSections.map((sec) => [
      bodyCell(`${sec.headingEn} / ${sec.headingMm}`, true),
      bodyCell(sec.bodyEn),
      bodyCell(sec.bodyMm),
    ]),
  ];

  const sourceData: SheetData = [
    [headerCell('#'), headerCell('Source Title'), headerCell('URL')],
    ...report.sources.map((src, idx) => [
      {value: idx + 1, type: Number, alignVertical: 'top' as const},
      bodyCell(src.title),
      bodyCell(src.uri),
    ]),
  ];

  return [
    {
      sheet: 'Comparison_EN_MM',
      data: comparisonData,
      columns: [
        {width: 24},
        {width: 24},
        {width: 32},
        {width: 32},
        {width: 32},
        {width: 40},
      ],
    },
    {
      sheet: 'Bilingual_Report',
      data: reportData,
      columns: [{width: 28}, {width: 55}, {width: 55}],
    },
    {
      sheet: 'Verified_Sources',
      data: sourceData,
      columns: [{width: 6}, {width: 42}, {width: 64}],
    },
  ];
}

function normalizeXlsxFilename(name?: string): string {
  const base = name || 'Activepieces_n8n_OpenClaw_2026.xlsx';
  return base.endsWith('.xlsx') ? base : `${base}.xlsx`;
}

export async function downloadResearchExcel(report: BilingualResearchReport): Promise<string> {
  const filename = normalizeXlsxFilename(report.excelFilename);
  const sheets = buildSheets(report);
  await writeXlsxFile(sheets).toFile(filename);
  return filename;
}

export async function buildResearchExcelBase64(report: BilingualResearchReport): Promise<{
  base64: string;
  filename: string;
}> {
  const filename = normalizeXlsxFilename(report.excelFilename);
  const sheets = buildSheets(report);
  const blob = await writeXlsxFile(sheets).toBlob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return {
    base64: btoa(binary),
    filename,
  };
}

export function buildBilingualEmailContent(report: BilingualResearchReport): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  const subject = `${report.reportTitleEn} | ${report.reportTitleMm}`;

  const textLines: string[] = [
    report.reportTitleEn,
    report.reportTitleMm,
    '',
    '--- EXECUTIVE SUMMARY (EN) ---',
    report.executiveSummaryEn,
    '',
    '--- အနှစ်ချုပ် (မြန်မာ) ---',
    report.executiveSummaryMm,
    '',
    '--- COMPARISON MATRIX ---',
    ...report.tableRows.map(
      (r) =>
        `• ${r.criterion_en} (${r.criterion_mm})\n  Activepieces: ${r.activepieces}\n  n8n: ${r.n8n}\n  OpenClaw: ${r.openclaw}\n  Notes (MM): ${r.notes_mm}`,
    ),
    '',
    '--- DETAILED ANALYSIS ---',
    ...report.detailedSections.flatMap((s) => [
      `${s.headingEn} / ${s.headingMm}`,
      s.bodyEn,
      s.bodyMm,
      '',
    ]),
    '--- VERIFIED 2026 SOURCES ---',
    ...report.sources.map((s, idx) => `${idx + 1}. ${s.title}: ${s.uri}`),
  ];

  const tableRowsHtml = report.tableRows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px;border:1px solid #cbd5e1;vertical-align:top;">
          <strong>${escapeHtml(r.criterion_en)}</strong><br/>
          <span style="color:#475569;font-size:12px;">${escapeHtml(r.criterion_mm)}</span>
        </td>
        <td style="padding:10px;border:1px solid #cbd5e1;vertical-align:top;">${escapeHtml(r.activepieces)}</td>
        <td style="padding:10px;border:1px solid #cbd5e1;vertical-align:top;">${escapeHtml(r.n8n)}</td>
        <td style="padding:10px;border:1px solid #cbd5e1;vertical-align:top;">${escapeHtml(r.openclaw)}</td>
        <td style="padding:10px;border:1px solid #cbd5e1;vertical-align:top;color:#334155;">${escapeHtml(r.notes_mm)}</td>
      </tr>`,
    )
    .join('');

  const sectionsHtml = report.detailedSections
    .map(
      (s) => `
      <div style="margin-top:20px;padding:14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
        <h3 style="margin:0 0 8px 0;font-size:15px;color:#0f172a;">${escapeHtml(s.headingEn)} · ${escapeHtml(s.headingMm)}</h3>
        <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#1e293b;">${escapeHtml(s.bodyEn)}</p>
        <p style="margin:0;font-size:14px;line-height:1.65;color:#334155;">${escapeHtml(s.bodyMm)}</p>
      </div>`,
    )
    .join('');

  const sourcesHtml = report.sources
    .map(
      (s) =>
        `<li style="margin-bottom:4px;"><a href="${escapeHtml(s.uri)}" style="color:#0284c7;">${escapeHtml(s.title)}</a></li>`,
    )
    .join('');

  const htmlBody = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:860px;margin:0 auto;color:#0f172a;padding:16px;">
    <h1 style="margin:0 0 4px 0;font-size:20px;color:#0f172a;">${escapeHtml(report.reportTitleEn)}</h1>
    <h2 style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#334155;">${escapeHtml(report.reportTitleMm)}</h2>

    <div style="padding:14px;border-radius:8px;background:#f1f5f9;margin-bottom:18px;">
      <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;"><strong>Executive Summary (EN):</strong> ${escapeHtml(report.executiveSummaryEn)}</p>
      <p style="margin:0;font-size:14px;line-height:1.65;"><strong>အနှစ်ချုပ် (မြန်မာ):</strong> ${escapeHtml(report.executiveSummaryMm)}</p>
    </div>

    <h3 style="margin:18px 0 8px 0;font-size:16px;">Comparison Matrix (English &amp; မြန်မာ)</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">
      <thead>
        <tr style="background:#0f172a;color:#f8fafc;">
          <th style="padding:10px;border:1px solid #334155;text-align:left;">Criterion / ခေါင်းစဉ်</th>
          <th style="padding:10px;border:1px solid #334155;text-align:left;">Activepieces</th>
          <th style="padding:10px;border:1px solid #334155;text-align:left;">n8n</th>
          <th style="padding:10px;border:1px solid #334155;text-align:left;">OpenClaw</th>
          <th style="padding:10px;border:1px solid #334155;text-align:left;">Notes (မြန်မာ)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    ${sectionsHtml}

    <h3 style="margin:22px 0 8px 0;font-size:15px;">Verified 2026 Web Sources</h3>
    <ul style="padding-left:18px;font-size:13px;">${sourcesHtml || '<li>Grounded via Gemini Search</li>'}</ul>
    <p style="margin-top:18px;font-size:12px;color:#64748b;">Attached: ${escapeHtml(normalizeXlsxFilename(report.excelFilename))} · Generated by Moe Workforce Platform</p>
  </div>`;

  return {
    subject,
    textBody: textLines.join('\n'),
    htmlBody,
  };
}
