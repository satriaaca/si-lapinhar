/**
 * Robust RFC 4180 compliant CSV parser.
 * Handles multiline quoted fields, escaped quotes (""), and commas within quotes.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal);
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  // Clean headers (lowercase, trimmed, strip quotes)
  const headers = rows[0].map(h => 
    h.trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/[\r\n]+/g, '')
  );

  const data: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;
    
    const item: Record<string, string> = {};
    headers.forEach((h, colIndex) => {
      item[h] = row[colIndex] !== undefined ? row[colIndex].trim() : '';
    });

    data.push(item);
  }

  return data;
}
