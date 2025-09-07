import { useState } from "react";
import Papa from "papaparse";

export default function CsvUploader({ onData }) {
  const [error, setError] = useState("");

  function handleFile(file) {
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        onData?.({ rows: results.data, fields: results.meta.fields || [] });
      },
      error: (err) => setError(err.message || String(err)),
    });
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium">Upload CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 block w-full text-sm rounded-lg border border-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
