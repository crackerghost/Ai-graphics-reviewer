import './App.css'
import { useMemo, useRef, useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import ResultsTable from './components/ResultsTable.jsx'
import { pdfFirstPageToDataUrl } from './lib/pdf.js'
import { scoreImageWithOpenAI } from './lib/openai.js'
import { downloadCsvFromObjects } from './utils/csv.js'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [csv, setCsv] = useState({ rows: [], fields: [] })
  const [columnMap, setColumnMap] = useState({ image: '', brief: '' })
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [limitMode, setLimitMode] = useState('all') // 'all' | 'count'
  const [limitCount, setLimitCount] = useState(10)
  const abortRef = useRef(null)

  const hasData = csv.rows?.length > 0
  const fieldOptions = useMemo(() => csv.fields || [], [csv.fields])

  async function toImageDataUrlIfPdf(url) {
    const lower = (url || '').toLowerCase()
    if (lower.endsWith('.pdf')) {
      try {
        return await pdfFirstPageToDataUrl(url)
      } catch (e) {
        console.error('PDF render failed', e)
        throw new Error('Failed to render PDF to image')
      }
    }
    return url
  }

  async function handleProcess() {
    setError('')
    setResults([])
    const imageCol = columnMap.image || 'image_url'
    const briefCol = columnMap.brief || 'brief'

    if (!apiKey) {
      setError('Please enter your OpenAI API key.')
      return
    }
    if (!hasData) {
      setError('Please upload a CSV first.')
      return
    }
    if (!imageCol || !csv.fields.includes(imageCol)) {
      setError(`Select a valid image column (current: ${imageCol || 'none'})`)
      return
    }

    const totalToProcess = limitMode === 'count' ? Math.min(Number(limitCount) || 0, csv.rows.length) : csv.rows.length
    if (totalToProcess <= 0) {
      setError('Please set a valid review count.')
      return
    }

    setProcessing(true)
    setProgress({ done: 0, total: totalToProcess })
    const out = []
    const ac = new AbortController()
    abortRef.current = ac

    for (let i = 0; i < totalToProcess; i++) {
      const row = csv.rows[i]
      const imageUrlRaw = (row[imageCol] || '').trim()
      const brief = (row[briefCol] || '').trim()
      if (!imageUrlRaw) {
        out.push({ ...row, error: 'Missing image URL' })
        setProgress({ done: i + 1, total: csv.rows.length })
        continue
      }
      try {
        const imageUrl = await toImageDataUrlIfPdf(imageUrlRaw)
        const scores = await scoreImageWithOpenAI({ apiKey, imageUrl, brief, abortSignal: ac.signal })
        const { flat, review } = flattenScores(scores)
        // Append Review immediately after original CSV columns, then the detailed columns
        out.push({ ...row, Review: review, ...flat })
      } catch (e) {
        console.error(e)
        out.push({ ...row, Review: '', error: e.message || String(e) })
      }
      setProgress({ done: i + 1, total: totalToProcess })
      if (ac.signal.aborted) break
    }

    setResults(out)
    setProcessing(false)
  }

  function flattenScores(scores) {
    const map = {
      compositionLayout: 'Composition & Layout',
      colourUsage: 'Colour Usage',
      typography: 'Typography',
      visualHierarchy: 'Visual Hierarchy',
      creativity: 'Creativity',
      technicalExecution: 'Technical Execution',
      briefAlignment: 'Brief Alignment',
      accessibility: 'Accessibility',
      overallClarity: 'Overall Clarity',
    }
    const flat = {}
    let total = 0
    let count = 0
    const noteSnippets = []
    for (const key in map) {
      const label = map[key]
      const s = scores?.[key]?.score
      const n = scores?.[key]?.notes
      flat[`${label} Score`] = typeof s === 'number' ? s : ''
      flat[`${label} Notes`] = n || ''
      if (n) noteSnippets.push(`${label}: ${n}`)
      if (typeof s === 'number') { total += s; count += 1 }
    }
    if (count) flat['Total Score'] = total
    if (count) flat['Average Score'] = (total / count).toFixed(2)
    const review = noteSnippets.join(' | ')
    return { flat, review }
  }

  function handleExport() {
    downloadCsvFromObjects('graphics-review-results.csv', results)
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">AI Graphics Reviewer</h1>
          {processing && (
            <div className="w-64">
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-1 text-right">{progress.done}/{progress.total}</p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="p-4 rounded-[var(--radius-card)] border bg-white shadow-sm space-y-3">
              <label className="block">
                <span className="text-sm font-medium">OpenAI API Key</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </label>

              <CsvUploader onData={setCsv} />

              {hasData && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Image URL column</label>
                    <select
                      className="mt-1 w-full"
                      value={columnMap.image || ''}
                      onChange={(e) => setColumnMap((m) => ({ ...m, image: e.target.value }))}
                    >
                      <option value="">Select column...</option>
                      {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Brief/Context column (optional)</label>
                    <select
                      className="mt-1 w-full"
                      value={columnMap.brief || ''}
                      onChange={(e) => setColumnMap((m) => ({ ...m, brief: e.target.value }))}
                    >
                      <option value="">None</option>
                      {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">How many to review</label>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="limitMode"
                          className="accent-brand"
                          checked={limitMode === 'all'}
                          onChange={() => setLimitMode('all')}
                        />
                        <span>All</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="limitMode"
                          className="accent-brand"
                          checked={limitMode === 'count'}
                          onChange={() => setLimitMode('count')}
                        />
                        <span>First</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="w-24"
                          value={limitCount}
                          onChange={(e) => setLimitCount(e.target.value)}
                          disabled={limitMode !== 'count'}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleProcess}
                      disabled={processing}
                      className="px-4 py-2 rounded-lg bg-brand text-white text-sm disabled:opacity-50 hover:bg-brand/90"
                    >
                      {processing ? 'Processing…' : 'Start Review'}
                    </button>
                    {processing && (
                      <button
                        onClick={() => { abortRef.current?.abort(); setProcessing(false); }}
                        className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    )}
                    {!!results.length && (
                      <button
                        onClick={() => setResults([])}
                        className="ml-auto px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
                      >
                        Clear Results
                      </button>
                    )}
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              )}
            </div>

            <div className="p-4 rounded-[var(--radius-card)] border bg-white shadow-sm">
              <h3 className="font-medium">CSV expectations</h3>
              <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
                <li>Include an image link column (JPG/PNG or PDF).</li>
                <li>Optional: a brief/context column to guide scoring.</li>
                <li>We append 9 category scores, notes, a Review, and totals.</li>
              </ul>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-8">
          <div className="p-4 rounded-[var(--radius-card)] border bg-white shadow-sm">
            <h2 className="text-base font-semibold mb-3 text-slate-900">Review Results</h2>
            <ResultsTable rows={results} onExport={handleExport} heightClass="max-h-[72vh]" />
            {!results.length && (
              <p className="text-sm text-gray-600">Results will appear here after processing.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
