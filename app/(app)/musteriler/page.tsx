'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type CustomerStatus = 'ilgileniyor' | 'teklif_verildi' | 'pazarlık' | 'satın_aldı' | 'vazgeçti'

interface Car {
  id: string
  model: string
  sell_price: number
  status: string
}

interface Customer {
  id: string
  user_id: string
  name: string
  phone: string
  car_id: string | null
  offer: number | null
  interest: string
  notes: string
  status: CustomerStatus
  created_at: string
  car?: Pick<Car, 'id' | 'model' | 'sell_price'>
}

const STATUS_META: Record<CustomerStatus, { label: string; bg: string; color: string }> = {
  ilgileniyor:   { label: 'İlgileniyor',    bg: '#E6F1FB', color: '#0C447C' },
  teklif_verildi:{ label: 'Teklif Verildi', bg: '#FAEEDA', color: '#633806' },
  pazarlık:      { label: 'Pazarlık',       bg: '#EEEDFE', color: '#3C3489' },
  'satın_aldı':  { label: 'Satın Aldı',     bg: '#EAF3DE', color: '#27500A' },
  vazgeçti:      { label: 'Vazgeçti',       bg: '#FCEBEB', color: '#791F1F' },
}

const EMPTY: Partial<Customer> = {
  name: '', phone: '', car_id: null,
  offer: undefined, interest: '', notes: '', status: 'ilgileniyor',
}

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₺'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function initials(name: string) {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}
const AVATAR_COLORS = [
  ['#E6F1FB','#0C447C'], ['#EAF3DE','#27500A'], ['#EEEDFE','#3C3489'],
  ['#FAEEDA','#633806'], ['#E1F5EE','#085041'],
]
function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

type View = 'list' | 'detail' | 'form'

export default function MusterilerPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cars, setCars]           = useState<Car[]>([])
  const [view, setView]           = useState<View>('list')
  const [selected, setSelected]   = useState<Customer | null>(null)
  const [form, setForm]           = useState<Partial<Customer>>(EMPTY)
  const [editId, setEditId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<CustomerStatus | 'hepsi'>('hepsi')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('customers')
        .select('*, car:cars(id,model,sell_price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('cars').select('id,model,sell_price,status').eq('user_id', user.id),
    ])
    setCustomers((c ?? []) as Customer[])
    setCars(v ?? [])
  }, [supabase])

  useEffect(() => { load() }, [load])

  function setField(k: keyof Customer, v: any) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  function openNew() {
    setForm(EMPTY); setEditId(null); setError(''); setSuccess(''); setView('form')
  }
  function openEdit(c: Customer) {
    setForm({ ...c }); setEditId(c.id); setError(''); setSuccess(''); setView('form')
  }
  function openDetail(c: Customer) {
    setSelected(c); setView('detail')
  }

  async function save() {
    if (!form.name?.trim()) { setError('İsim zorunludur.'); return }
    if (!form.phone?.trim()) { setError('Telefon zorunludur.'); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name:     form.name!.trim(),
      phone:    form.phone!.trim(),
      car_id:   form.car_id || null,
      offer:    form.offer ? +form.offer : null,
      interest: form.interest || '',
      notes:    form.notes || '',
      status:   form.status,
      user_id:  user!.id,
    }
    const { error: dbErr } = editId
      ? await supabase.from('customers').update(payload).eq('id', editId)
      : await supabase.from('customers').insert(payload)
    if (dbErr) { setError(dbErr.message) }
    else {
      setSuccess(editId ? 'Müşteri güncellendi.' : 'Müşteri eklendi.')
      await load()
      setTimeout(() => { setView('list'); setSuccess('') }, 800)
    }
    setLoading(false)
  }

  async function remove(id: string) {
    if (!confirm('Bu müşteriyi silmek istediğinize emin misiniz?')) return
    await supabase.from('customers').delete().eq('id', id)
    if (view === 'detail') setView('list')
    await load()
  }

  async function updateStatus(id: string, status: CustomerStatus) {
    await supabase.from('customers').update({ status }).eq('id', id)
    await load()
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.car as any)?.model?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'hepsi' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    toplam:   customers.length,
    aktif:    customers.filter(c => c.status !== 'satın_aldı' && c.status !== 'vazgeçti').length,
    satinAldi: customers.filter(c => c.status === 'satın_aldı').length,
    toplamTeklif: customers.filter(c => c.offer).reduce((s, c) => s + (c.offer ?? 0), 0),
  }

  // ── FORM VIEW ──
  if (view === 'form') return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <button onClick={() => setView('list')} style={{ fontSize: 13, padding: '6px 12px' }}>← Geri</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 2px' }}>
            {editId ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            {editId ? 'Bilgileri güncelleyip kaydet.' : 'Müşteri bilgilerini gir.'}
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 12, padding: '1.5rem',
      }}>
        {[
          { label: 'İsim', key: 'name', type: 'text', placeholder: 'Ahmet Yılmaz', required: true },
          { label: 'Telefon', key: 'phone', type: 'tel', placeholder: '0532 000 00 00', required: true },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
              {label}
            </label>
            <input type={type} value={(form as any)[key] ?? ''} placeholder={placeholder}
              onChange={e => setField(key as any, e.target.value)} style={{ width: '100%' }} />
          </div>
        ))}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            İlgilendiği araç
          </label>
          <select value={form.car_id ?? ''} onChange={e => setField('car_id', e.target.value || null)} style={{ width: '100%' }}>
            <option value="">— Seçiniz —</option>
            {cars.map(v => <option key={v.id} value={v.id}>{v.model} · {fmt(v.sell_price)}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            Teklif fiyatı (₺)
          </label>
          <input type="number" min="0" step="1000" value={form.offer ?? ''}
            onChange={e => setField('offer', e.target.value ? +e.target.value : undefined)}
            placeholder="420000" style={{ width: '100%' }} />
          {form.offer && form.car_id && (() => {
            const car = cars.find(v => v.id === form.car_id)
            if (!car) return null
            const diff = +form.offer - car.sell_price
            return (
              <p style={{ fontSize: 12, marginTop: 5, color: diff >= 0 ? '#27500A' : '#791F1F' }}>
                {diff >= 0 ? '↑' : '↓'} Satış fiyatına göre {diff >= 0 ? '+' : ''}{fmt(diff)}
              </p>
            )
          })()}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            Durum
          </label>
          <select value={form.status} onChange={e => setField('status', e.target.value)} style={{ width: '100%' }}>
            {(Object.entries(STATUS_META) as [CustomerStatus, any][]).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            İlgi notu
          </label>
          <input type="text" value={form.interest ?? ''}
            onChange={e => setField('interest', e.target.value)}
            placeholder="ör. Beyaz renk istiyor, 2020 model tercih" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            Notlar
          </label>
          <textarea value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)}
            placeholder="Ek notlar, hatırlatıcılar…" rows={3}
            style={{ width: '100%', resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ background: '#FCEBEB', border: '0.5px solid #F09595', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: '#791F1F' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#E1F5EE', border: '0.5px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: '#085041' }}>
            {success}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('list')} style={{ flex: 1 }}>İptal</button>
          <button onClick={save} disabled={loading}
            style={{ flex: 2, background: '#1D9E75', borderColor: '#0F6E56', color: '#fff', fontWeight: 500 }}>
            {loading ? 'Kaydediliyor…' : editId ? 'Güncelle' : 'Müşteri Ekle'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── DETAIL VIEW ──
  if (view === 'detail' && selected) {
    const s = STATUS_META[selected.status]
    const [avatarBg, avatarTxt] = avatarColor(selected.name)
    const car = (selected as any).car
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ fontSize: 13, padding: '6px 12px' }}>← Geri</button>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Müşteri Detayı</h1>
        </div>

        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden', marginBottom: '1rem' }}>
          {/* Header */}
          <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarBg, color: avatarTxt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, flexShrink: 0 }}>
                {initials(selected.name)}
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, margin: '0 0 4px' }}>{selected.name}</p>
                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: s.bg, color: s.color }}>
                  {s.label}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(selected)} style={{ fontSize: 12, padding: '6px 12px' }}>Düzenle</button>
              <button onClick={() => remove(selected.id)} style={{ fontSize: 12, padding: '6px 12px', background: '#FCEBEB', borderColor: '#F09595', color: '#791F1F' }}>Sil</button>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'Telefon', value: selected.phone },
              { label: 'Eklenme tarihi', value: fmtDate(selected.created_at) },
              ...(car ? [{ label: 'İlgilendiği araç', value: car.model }] : []),
              ...(car ? [{ label: 'Araç fiyatı', value: fmt(car.sell_price) }] : []),
              ...(selected.offer ? [{ label: 'Teklif', value: fmt(selected.offer) }] : []),
              ...(selected.offer && car ? [{
                label: 'Fark', value: (() => {
                  const d = selected.offer - car.sell_price
                  return (d >= 0 ? '+' : '') + fmt(d)
                })()
              }] : []),
            ].map(({ label, value }, i) => (
              <div key={label} style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderRight: i % 2 === 0 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 3px' }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* İlgi notu */}
          {selected.interest && (
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>İlgi notu</p>
              <p style={{ fontSize: 14, margin: 0 }}>{selected.interest}</p>
            </div>
          )}

          {/* Notlar */}
          {selected.notes && (
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Notlar</p>
              <p style={{ fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>{selected.notes}</p>
            </div>
          )}

          {/* Hızlı durum güncelle */}
          <div style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>Durumu güncelle</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.entries(STATUS_META) as [CustomerStatus, any][]).map(([val, { label, bg, color }]) => (
                <button key={val} onClick={() => updateStatus(selected.id, val)}
                  style={{
                    fontSize: 12, padding: '5px 12px',
                    background: selected.status === val ? bg : 'transparent',
                    borderColor: selected.status === val ? color : 'var(--color-border-secondary)',
                    color: selected.status === val ? color : 'var(--color-text-secondary)',
                    fontWeight: selected.status === val ? 500 : 400,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {/* Başlık + yeni müşteri */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Müşteriler</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>Tüm müşteri kayıtları ve teklifler</p>
        </div>
        <button onClick={openNew}
          style={{ background: '#1D9E75', borderColor: '#0F6E56', color: '#fff', fontWeight: 500, padding: '8px 16px', flexShrink: 0 }}>
          + Müşteri Ekle
        </button>
      </div>

      {/* Özet metrikler */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Toplam müşteri',  value: stats.toplam },
          { label: 'Aktif müşteri',   value: stats.aktif },
          { label: 'Satın alan',      value: stats.satinAldi },
          { label: 'Toplam teklif',   value: fmt(stats.toplamTeklif) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '1rem' }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Arama + filtre */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="İsim, telefon veya araç ara…"
          style={{ flex: 1, maxWidth: 320 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          style={{ fontSize: 13 }}>
          <option value="hepsi">Tüm durumlar</option>
          {(Object.entries(STATUS_META) as [CustomerStatus, any][]).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 12, padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {customers.length === 0 ? 'Henüz müşteri eklenmedi.' : 'Arama kriterlerine uyan müşteri bulunamadı.'}
        </div>
      ) : (
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  {['Müşteri', 'Telefon', 'İlgilendiği araç', 'Teklif', 'Durum', 'İşlem'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const s = STATUS_META[c.status]
                  const car = (c as any).car
                  const [avatarBg, avatarTxt] = avatarColor(c.name)
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 1 ? 'var(--color-background-secondary)' : 'transparent', borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer' }}
                      onClick={() => openDetail(c)}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarBg, color: avatarTxt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                            {initials(c.name)}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{c.phone}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {car ? car.model : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500 }}>
                        {c.offer ? fmt(c.offer) : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(c)} style={{ fontSize: 12, padding: '4px 10px' }}>Düzenle</button>
                          <button onClick={() => remove(c.id)} style={{ fontSize: 12, padding: '4px 10px', background: '#FCEBEB', borderColor: '#F09595', color: '#791F1F' }}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '0.5px solid var(--color-border-secondary)' }}>
                  <td colSpan={3} style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {filtered.length} müşteri gösteriliyor
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500 }}>
                    {fmt(filtered.filter(c => c.offer).reduce((s, c) => s + (c.offer ?? 0), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
