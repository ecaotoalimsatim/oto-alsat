'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'in_stock' | 'for_sale' | 'sold' | 'in_repair'

interface Car {
  id: string
  model: string
  buy_price: number
  cost: number
  sell_price: number
  profit: number
  status: Status
  created_at: string
}

const STATUS_LABELS: Record<Status, string> = {
  in_stock:  'Stokta',
  for_sale:  'Satılık',
  sold:      'Satıldı',
  in_repair: 'Tamirde',
}

const STATUS_STYLES: Record<Status, string> = {
  in_stock:  'background:#EAF3DE;color:#27500A',
  for_sale:  'background:#E6F1FB;color:#0C447C',
  sold:      'background:#E1F5EE;color:#085041',
  in_repair: 'background:#FAEEDA;color:#633806',
}

const EMPTY_FORM = {
  model: '',
  buy_price: '',
  cost: '',
  sell_price: '',
  status: 'for_sale' as Status,
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺'
}

export default function AraclarPage() {
  const supabase = createClient()
  const [cars, setCars]       = useState<Car[]>([])
  const [form, setForm]       = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadCars = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('cars')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCars(data ?? [])
  }, [supabase])

  useEffect(() => { loadCars() }, [loadCars])

  function setField(key: keyof typeof EMPTY_FORM, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setError('')
  }

  function validate() {
    if (!form.model.trim()) return 'Model alanı zorunludur.'
    if (!form.buy_price || isNaN(+form.buy_price) || +form.buy_price < 0)
      return 'Geçerli bir alış fiyatı girin.'
    if (!form.sell_price || isNaN(+form.sell_price) || +form.sell_price < 0)
      return 'Geçerli bir satış fiyatı girin.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Oturum açmanız gerekiyor.'); setLoading(false); return }

    const payload = {
      model:       form.model.trim(),
      buy_price:   +form.buy_price,
      cost:        +(form.cost || 0),
      sell_price:  +form.sell_price,
      status:      form.status,
      user_id:     user.id,
    }

    let dbErr = null
    if (editId) {
      const { error } = await supabase.from('cars').update(payload).eq('id', editId)
      dbErr = error
    } else {
      const { error } = await supabase.from('cars').insert(payload)
      dbErr = error
    }

    if (dbErr) {
      setError('Kayıt sırasında hata: ' + dbErr.message)
    } else {
      setSuccess(editId ? 'Araç güncellendi.' : 'Araç başarıyla eklendi.')
      setForm(EMPTY_FORM)
      setEditId(null)
      await loadCars()
    }
    setLoading(false)
  }

  function startEdit(car: Car) {
    setForm({
      model:      car.model,
      buy_price:  String(car.buy_price),
      cost:       String(car.cost),
      sell_price: String(car.sell_price),
      status:     car.status,
    })
    setEditId(car.id)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setError('')
  }

  async function deleteCar(id: string) {
    if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return
    setDeleting(id)
    await supabase.from('cars').delete().eq('id', id)
    await loadCars()
    setDeleting(null)
  }

  const previewProfit = form.sell_price && form.buy_price
    ? +form.sell_price - +form.buy_price - +(form.cost || 0)
    : null

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>
          {editId ? 'Aracı Düzenle' : 'Araç Ekle'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
          {editId ? 'Bilgileri güncelleyip kaydet.' : 'Yeni araç bilgilerini girerek stoğa ekle.'}
        </p>
      </div>

      {/* ── FORM ── */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>

            {/* Model */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Araç modeli
              </label>
              <input
                type="text"
                value={form.model}
                onChange={e => setField('model', e.target.value)}
                placeholder="ör. BMW 320i 2021"
                style={{ width: '100%' }}
              />
            </div>

            {/* Alış fiyatı */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Alış fiyatı (₺)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.buy_price}
                onChange={e => setField('buy_price', e.target.value)}
                placeholder="380000"
              />
            </div>

            {/* Ek maliyet */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Ek maliyet (₺)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={form.cost}
                onChange={e => setField('cost', e.target.value)}
                placeholder="12000"
              />
            </div>

            {/* Satış fiyatı */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Satış fiyatı (₺)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.sell_price}
                onChange={e => setField('sell_price', e.target.value)}
                placeholder="440000"
              />
            </div>

            {/* Durum */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
                Durum
              </label>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value)}
                style={{ width: '100%' }}
              >
                {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Canlı kâr önizleme */}
          {previewProfit !== null && (
            <div style={{
              background: previewProfit >= 0 ? '#EAF3DE' : '#FCEBEB',
              border: `0.5px solid ${previewProfit >= 0 ? '#97C459' : '#F09595'}`,
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 14px',
              marginBottom: '1rem',
              fontSize: 14,
              color: previewProfit >= 0 ? '#27500A' : '#791F1F',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                {previewProfit >= 0 ? '↑' : '↓'}
              </span>
              Tahmini kâr:{' '}
              <strong>{fmt(previewProfit)}</strong>
              {+form.sell_price > 0 && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>
                  (%{Math.round((previewProfit / +form.sell_price) * 100)} marj)
                </span>
              )}
            </div>
          )}

          {/* Hata / başarı mesajı */}
          {error && (
            <div style={{
              background: '#FCEBEB', border: '0.5px solid #F09595',
              borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
              marginBottom: '1rem', fontSize: 14, color: '#791F1F',
            }}>{error}</div>
          )}
          {success && (
            <div style={{
              background: '#E1F5EE', border: '0.5px solid #5DCAA5',
              borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
              marginBottom: '1rem', fontSize: 14, color: '#085041',
            }}>{success}</div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading} style={{ minWidth: 120 }}>
              {loading ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Ekle'}
            </button>
            {editId && (
              <button type="button" onClick={cancelEdit} style={{ minWidth: 80 }}>
                İptal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── TABLO ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Araç listesi</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {cars.length} araç
          </span>
        </div>

        {cars.length === 0 ? (
          <div style={{
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
          }}>
            Henüz araç eklenmedi. Yukarıdaki formu kullanarak ilk aracınızı ekleyin.
          </div>
        ) : (
          <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    {['Model', 'Alış', 'Maliyet', 'Satış', 'Kâr', 'Durum', 'İşlem'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '10px 14px',
                        fontSize: 12, fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cars.map((car, i) => {
                    const isEven = i % 2 === 0
                    const kar = car.profit ?? (car.sell_price - car.buy_price - car.cost)
                    return (
                      <tr
                        key={car.id}
                        style={{
                          background: editId === car.id
                            ? '#E6F1FB'
                            : isEven ? 'transparent' : 'var(--color-background-secondary)',
                          borderBottom: '0.5px solid var(--color-border-tertiary)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {car.model}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          {fmt(car.buy_price)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          {fmt(car.cost)}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500 }}>
                          {fmt(car.sell_price)}
                        </td>
                        <td style={{
                          padding: '12px 14px', fontSize: 13, fontWeight: 500,
                          color: kar >= 0 ? '#27500A' : '#791F1F',
                        }}>
                          {kar >= 0 ? '+' : ''}{fmt(kar)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: 'var(--border-radius-md)',
                            fontSize: 11,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            ...Object.fromEntries(
                              STATUS_STYLES[car.status].split(';').filter(Boolean).map(s => {
                                const [k, v] = s.split(':')
                                return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.trim()]
                              })
                            ),
                          }}>
                            {STATUS_LABELS[car.status]}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => startEdit(car)}
                              style={{ fontSize: 12, padding: '4px 10px' }}
                            >
                              Düzenle
                            </button>
                            <button
                              onClick={() => deleteCar(car.id)}
                              disabled={deleting === car.id}
                              style={{
                                fontSize: 12, padding: '4px 10px',
                                background: '#FCEBEB',
                                borderColor: '#F09595',
                                color: '#791F1F',
                              }}
                            >
                              {deleting === car.id ? '…' : 'Sil'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Toplam satırı */}
                {cars.length > 0 && (() => {
                  const toplamKar = cars.reduce((s, c) => s + (c.profit ?? (c.sell_price - c.buy_price - c.cost)), 0)
                  const toplamSatis = cars.reduce((s, c) => s + c.sell_price, 0)
                  return (
                    <tfoot>
                      <tr style={{ background: 'var(--color-background-secondary)', borderTop: '0.5px solid var(--color-border-secondary)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                          Toplam ({cars.length} araç)
                        </td>
                        <td colSpan={2} />
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                          {fmt(toplamSatis)}
                        </td>
                        <td style={{
                          padding: '10px 14px', fontSize: 13, fontWeight: 500,
                          color: toplamKar >= 0 ? '#27500A' : '#791F1F',
                        }}>
                          {toplamKar >= 0 ? '+' : ''}{fmt(toplamKar)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
