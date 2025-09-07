export default function ResultsTable({ rows, onExport, heightClass = "max-h-[65vh]" }) {
  if (!rows?.length) return null;
  const headers = Object.keys(rows[0] || {});

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-xs text-gray-500">{rows.length} rows</p>
        </div>
        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm hover:bg-brand/90"
        >
          Export CSV
        </button>
      </div>
      <div className={`border rounded-[var(--radius-card)] bg-white ${heightClass} overflow-auto shadow-sm`}>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium border-b whitespace-nowrap text-slate-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50">
                {headers.map((h) => (
                  <td
                    key={h}
                    className="px-3 py-2 border-b align-top text-slate-800 max-w-[28rem] whitespace-pre-wrap"
                    title={typeof r[h] === 'string' ? r[h] : ''}
                  >
                    {String(r[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
