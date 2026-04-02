"use client";

import type { PdfGenerationResult } from "./pos-types";

export function downloadPdfResult(pdf: PdfGenerationResult) {
  const binary = window.atob(pdf.base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: pdf.record.mimeType || "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = pdf.record.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
