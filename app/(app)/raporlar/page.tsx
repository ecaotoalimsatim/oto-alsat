'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Car {
  id: string
  model: string
  buy_price: number
  cost: number
  sell_price: number
  status: string
  created_at: string
}

interface MonthlyData {
  label: string
  kar: number
  adet: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₺'
}
function pct(n: number) {
  return Math.round(n) + '%'
}

const AY_LABELS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

export default function RaporlarPage() {
  const supabase  = createClient()
  const chartRef  = useRef<HTMLCanvasElement>(null)
  const chartInst = useRef<any>(null)
  const [cars, setCars]       = useState<Car[]>([])
  const [filter, setFilter]   = useState<'hepsi' | 'satildi'>('hepsi')
  const [sortBy, setSortBy]   = useState<'kar' | 'marj' | 'model'>('kar')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const loadCars = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setCars(data ?? [])
  }, [supabase])

  useEffect(() => { loadCars() }, [loadCars])

  // ── Hesaplamalar ──
  const visibleCars = filter === 'satildi'
    ? cars.filter(c => c.status === 'sold')
    : cars

  const withMetrics = visibleCars.map(c => {
    const totalCost = c.buy_price + c.cost
    const kar       = c.sell_price - totalCost
    const marj      = c.sell_price > 0 ? (kar / c.sell_price) * 100 : 0
    return { ...c, totalCost, kar, marj }
  })

  const sorted = [...withMetrics].sort((a, b) => {
    const mul = sortDir === 'desc' ? -1 : 1
    if (sortBy === 'kar')   return (a.kar   - b.kar)   * mul
    if (sortBy === 'marj')  return (a.marj  - b.marj)  * mul
    return a.model.localeCompare(b.model) * mul
  })

  // Aylık kâr — son 6 ay
  const now = new Date()
  const monthlyData: MonthlyData[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const yr = d.getFullYear(), mo = d.getMonth()
    const inMonth = cars.filter(c => {
      const cd = new Date(c.created_at)
      return cd.getFullYear() === yr && cd.getMonth() === mo
    })
    return {
      label: AY_LABELS[mo],
      kar:   inMonth.reduce((s, c) => s + (c.sell_price - c.buy_price - c.cost), 0),
      adet:  inMonth.length,
    }
  })

  const toplamKar   = withMetrics.reduce((s, c) => s + c.kar, 0)
  const toplamSatis = withMetrics.reduce((s, c) => s + c.sell_price, 0)
  const ortMarj     = toplamSatis > 0 ? (toplamKar / toplamSatis) * 100 : 0
  const enYuksek    = withMetrics.length > 0 ? Math.max(...withMetrics.map(c => c.kar)) : 0
  const enDusuk     = withMetrics.length > 0 ? Math.min(...withMetrics.map(c => c.kar)) : 0

  // ── Grafik ──
  useEffect(() => {
    if (!chartRef.current) return
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const maxVal = Math.max(...monthlyData.map(m => Math.abs(m.kar)), 1)

    const barColors = monthlyData.map(m =>
      m.kar >= 0
        ? (isDark ? '#5DCAA5' : '#1D9E75')
        : (isDark ? '#F09595' : '#E24B4A')
    )

    const cfg = {
      type: 'bar' as const,
      data: {
        labels: monthlyData.map(m => m.label),
        datasets: [{
          data: monthlyData.map(m => m.kar),
          backgroundColor: barColors,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const v = ctx.raw as number
                return ` ${v >= 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(v))} ₺`
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: isDark ? '#888780' : '#888780',
              font: { size: 12 },
            },
          },
          y: {
            grid: {
              color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            },
            border: { display: false, dash: [4, 4] },
            ticks: {
              color: isDark ? '#888780' : '#888780',
              font: { size: 11 },
              maxTicksLimit: 5,
              callback: (v: any) => {
                const abs = Math.abs(v)
                if (abs >= 1_000_000) return (v < 0 ? '-' : '') + (abs / 1_000_000).toFixed(1) + 'M ₺'
                if (abs >= 1_000)     return (v < 0 ? '-' : '') + (abs / 1_000).toFixed(0) + 'K ₺'
                return v + ' ₺'
              },
            },
            suggestedMin: -maxVal * 0.2,
            suggestedMax:  maxVal * 1.15,
          },
        },
      },
    }

    if (chartInst.current) chartInst.current.destroy()
    const Chart = (window as any).Chart
    if (Chart) chartInst.current = new Chart(chartRef.current, cfg)
  }, [cars])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const sortIcon = (col: typeof sortBy) =>
    sortBy !== col ? ' ↕' : sortDir === 'desc' ? ' ↓' : ' ↑'

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Kâr Raporu</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
          Aylık trend ve araç bazlı kâr marjı analizi
        </p>
      </div>

      {/* ── Özet kartlar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Toplam kâr',     value: fmt(toplamKar),   hi: toplamKar >= 0 },
          { label: 'Ort. kâr marjı', value: pct(ortMarj),     hi: ortMarj >= 0 },
          { label: 'En yüksek kâr',  value: fmt(enYuksek),    hi: true },
          { label: 'En düşük kâr',   value: fmt(enDusuk),     hi: enDusuk >= 0 },
        ].map(({ label, value, hi }) => (
          <div key={label} style={{
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '1rem',
          }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{label}</p>
            <p style={{
              fontSize: 20, fontWeight: 500, margin: 0,
              color: label.includes('düşük') && enDusuk < 0 ? '#A32D2D' : 'var(--color-text-primary)',
            }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Aylık grafik ── */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 2px' }}>Aylık kâr trendi</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>Son 6 ay</p>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-secondary)', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#1D9E75', display: 'inline-block' }}></span>
              Kâr
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E24B4A', display: 'inline-block' }}></span>
              Zarar
            </span>
          </div>
        </div>
        <div style={{ position: 'relative', height: 220 }}>
          <canvas ref={chartRef}></canvas>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: '1rem', paddingTop: '1rem', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
          {monthlyData.map(m => (
            <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>{m.label}</p>
              <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: m.kar >= 0 ? '#27500A' : '#791F1F' }}>
                {m.adet} araç
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Araç bazlı tablo ── */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 2px' }}>Araç bazlı kâr marjı</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              {sorted.length} araç · sütuna tıklayarak sırala
            </p>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
            style={{ fontSize: 12, padding: '5px 8px' }}
          >
            <option value="hepsi">Tüm araçlar</option>
            <option value="satildi">Yalnızca satılanlar</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                <th
                  onClick={() => toggleSort('model')}
                  style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Model{sortIcon('model')}
                </th>
                {[
                  { label: 'Alış + maliyet', col: null },
                  { label: 'Satış fiyatı',   col: null },
                ].map(({ label }) => (
                  <th key={label} style={{ textAlign: 'right', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {label}
                  </th>
                ))}
                <th
                  onClick={() => toggleSort('kar')}
                  style={{ textAlign: 'right', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Kâr{sortIcon('kar')}
                </th>
                <th
                  onClick={() => toggleSort('marj')}
                  style={{ textAlign: 'right', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Marj{sortIcon('marj')}
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  Görsel
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => {
                const maxKar = Math.max(...withMetrics.map(x => Math.abs(x.kar)), 1)
                const barW   = Math.round(Math.abs(c.kar) / maxKar * 100)
                const isPos  = c.kar >= 0

                return (
                  <tr key={c.id} style={{
                    background: i % 2 === 1 ? 'var(--color-background-secondary)' : 'transparent',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                  }}>
                    <td style={{ padding: '12px 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{c.model}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {fmt(c.totalCost)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13 }}>
                      {fmt(c.sell_price)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: isPos ? '#27500A' : '#791F1F' }}>
                      {isPos ? '+' : ''}{fmt(c.kar)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 'var(--border-radius-md)',
                        fontSize: 12,
                        fontWeight: 500,
                        background: isPos
                          ? (c.marj > 15 ? '#EAF3DE' : '#E6F1FB')
                          : '#FCEBEB',
                        color: isPos
                          ? (c.marj > 15 ? '#27500A' : '#0C447C')
                          : '#791F1F',
                      }}>
                        {isPos ? '+' : ''}{pct(c.marj)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          height: 6,
                          width: barW + '%',
                          minWidth: barW > 0 ? 4 : 0,
                          maxWidth: '100%',
                          background: isPos ? '#1D9E75' : '#E24B4A',
                          borderRadius: 3,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {filter === 'satildi' ? 'Henüz satılan araç yok.' : 'Henüz araç eklenmedi.'}
                  </td>
                </tr>
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--color-background-secondary)', borderTop: '0.5px solid var(--color-border-secondary)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                    Toplam
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {fmt(sorted.reduce((s, c) => s + c.totalCost, 0))}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>
                    {fmt(sorted.reduce((s, c) => s + c.sell_price, 0))}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: toplamKar >= 0 ? '#27500A' : '#791F1F' }}>
                    {toplamKar >= 0 ? '+' : ''}{fmt(toplamKar)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px',
                      borderRadius: 'var(--border-radius-md)', fontSize: 12, fontWeight: 500,
                      background: ortMarj >= 0 ? '#EAF3DE' : '#FCEBEB',
                      color: ortMarj >= 0 ? '#27500A' : '#791F1F',
                    }}>
                      {ortMarj >= 0 ? '+' : ''}{pct(ortMarj)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
