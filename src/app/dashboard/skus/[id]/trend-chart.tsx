'use client'

import { useMemo, useRef, useState } from 'react'

export type TrendSeries = {
  id: string
  name: string
  color: string
  values: (number | null)[]
}

const W = 800
const H = 260
const PAD = { top: 12, right: 16, bottom: 28, left: 40 }

export function TrendChart({ days, series }: { days: string[]; series: TrendSeries[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const maxY = useMemo(() => {
    let m = 0
    for (const s of series) for (const v of s.values) if (v != null && v > m) m = v
    return Math.max(5, Math.ceil(m / 5) * 5)
  }, [series])

  const x = (i: number) =>
    PAD.left + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (W - PAD.left - PAD.right))
  const y = (v: number) => PAD.top + (1 - v / maxY) * (H - PAD.top - PAD.bottom)

  const yTicks = useMemo(() => {
    const step = maxY <= 10 ? 2 : maxY <= 25 ? 5 : 10
    const ticks = []
    for (let v = 0; v <= maxY; v += step) ticks.push(v)
    return ticks
  }, [maxY])

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = ''
        let pen = false
        s.values.forEach((v, i) => {
          if (v == null) {
            pen = false
            return
          }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
          pen = true
        })
        return d
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, days.length, maxY],
  )

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((e.clientX - rect.left) / rect.width) * W
    const span = (W - PAD.left - PAD.right) / Math.max(1, days.length - 1)
    const idx = Math.round((px - PAD.left) / span)
    setHoverIdx(idx >= 0 && idx < days.length ? idx : null)
  }

  const fmtDay = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  return (
    <div>
      {/* legend — identity never by color alone; names sit in ink next to markers */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Stock level per store over the last 28 days"
      >
        {/* hairline grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#898781">
              {v}
            </text>
          </g>
        ))}
        {/* x labels: first, middle, last */}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1]
          .filter((v, i, a) => days.length > 0 && a.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#898781">
              {fmtDay(days[i])}
            </text>
          ))}
        {/* baseline */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#c3c2b7" strokeWidth="1" />

        {/* series lines, 2px */}
        {series.map((s, si) => (
          <path key={s.id} d={paths[si]} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
        ))}

        {/* hover crosshair + markers */}
        {hoverIdx != null && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#c3c2b7" strokeWidth="1" />
            {series.map((s) => {
              const v = s.values[hoverIdx]
              return v == null ? null : (
                <circle key={s.id} cx={x(hoverIdx)} cy={y(v)} r="4" fill={s.color} stroke="#fcfcfb" strokeWidth="2" />
              )
            })}
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hoverIdx != null && (
        <div className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
          <p className="mb-1 font-medium">{fmtDay(days[hoverIdx])}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}: <strong className="tabular-nums">{s.values[hoverIdx] ?? '—'}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* table view — accessibility fallback */}
      <details className="mt-3 text-xs text-zinc-600">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="pr-3">Date</th>
                {series.map((s) => (
                  <th key={s.id} className="pr-3">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d}>
                  <td className="pr-3">{d}</td>
                  {series.map((s) => (
                    <td key={s.id} className="pr-3 tabular-nums">
                      {s.values[i] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
