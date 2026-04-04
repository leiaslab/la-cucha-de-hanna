"use client";

export function escapeReportHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function openPrintWindow(title: string, bodyHtml: string, fallback?: () => void) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");

  if (!printWindow) {
    fallback?.();
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeReportHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
          h1 { margin: 0 0 6px; font-size: 28px; }
          h2 { margin: 0 0 12px; font-size: 18px; }
          p { margin: 0; }
          .muted { color: #64748b; }
          .cards { display: grid; gap: 12px; margin: 24px 0 18px; }
          .cards-2 { grid-template-columns: repeat(2, 1fr); }
          .cards-3 { grid-template-columns: repeat(3, 1fr); }
          .cards-4 { grid-template-columns: repeat(4, 1fr); }
          .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 14px; }
          .label { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
          .value { margin-top: 8px; font-size: 28px; font-weight: 800; }
          .sections { display: grid; gap: 14px; margin-top: 18px; }
          .sections-2 { grid-template-columns: repeat(2, 1fr); }
          .sections-3 { grid-template-columns: repeat(3, 1fr); }
          .section { border: 1px solid #cbd5e1; border-radius: 18px; padding: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; }
          .right { text-align: right; }
          .center { text-align: center; }
          @media print {
            @page { margin: 10mm; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
