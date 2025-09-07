export function downloadCsvFromObjects(filename, rows) {
  if (!rows?.length) return;
  // Preserve the order of the first row's keys, then append any new keys seen later.
  const headers = [...Object.keys(rows[0])];
  for (let i = 1; i < rows.length; i++) {
    for (const k of Object.keys(rows[i])) {
      if (!headers.includes(k)) headers.push(k);
    }
  }

  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (s.includes("\n") || s.includes(",") || s.includes('"')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
