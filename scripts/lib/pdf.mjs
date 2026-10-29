// Text lines from a PDF, for importers whose source publishes tables only as
// PDFs (Sentencing Commission, EOIR, FBI NICS). Each page's text items are
// grouped into lines by baseline and ordered left to right; cells further
// apart than a space are separated by a tab, so table rows split cleanly on
// /\t+/.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** @returns {Promise<string[][]>} lines per page */
export async function pdfPages(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const it of items) {
      if (!it.str.trim()) continue;
      const [x, y] = [it.transform[4], it.transform[5]];
      // Items within 2 units vertically share a line.
      let row = rows.find((r) => Math.abs(r.y - y) < 2);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x, end: x + it.width, str: it.str, size: Math.abs(it.transform[0]) || 8 });
    }
    rows.sort((a, b) => b.y - a.y);
    pages.push(
      rows.map(({ items: cells }) => {
        cells.sort((a, b) => a.x - b.x);
        let line = "";
        let prev = null;
        for (const c of cells) {
          if (prev) line += c.x - prev.end > c.size * 0.9 ? "\t" : c.x - prev.end > 0.5 ? " " : "";
          line += c.str.trim();
          prev = c;
        }
        return line;
      }),
    );
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}

/** All lines of the document, pages concatenated. */
export async function pdfLines(buffer) {
  return (await pdfPages(buffer)).flat();
}
