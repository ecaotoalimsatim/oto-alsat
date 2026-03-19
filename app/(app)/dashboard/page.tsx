import { createClient } from '@/lib/supabase/server'

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M ₺'
  if (Math.abs(n) >= 1_000)
    return (n / 1_000).toFixed(0) + ' K ₺'
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺'
}

const STATUS_LABEL: Record<string, string> = {
  in_stock: 'Stokta', for_sale: 'Satılık', sold: 'Satıldı', in_repair: 'Tamirde',
}
const STATUS_DOT: Record<string, string> = {
  in_stock: '#378ADD', for_sale: '#EF9F27', sold: '#1D9E75', in_repair: '#E24B4A',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cars }, { data: customers }] = await Promise.all([
    supabase.from('cars').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('customers').select('id, status').eq('user_id', user!.id),
  ])

  const all     = cars ?? []
  const forSale = all.filter(c => c.status === 'for_sale')
  const sold    = all.filter(c => c.status === 'sold')
  const inStock = all.filter(c => c.status === 'in_stock')
  const toplamKar = all.reduce((s, c) => s + (c.sell_price - c.buy_price - c.cost), 0)
  const aktifMusteri = (customers ?? []).filter(c => c.status !== 'satın_aldı' && c.status !== 'vazgeçti').length

  const cards = [
    {
      label: 'Toplam araç', value: String(all.length), suffix: 'adet',
      iconPath: 'M8 17l4-4 4 4m0-5l-4-4-4 4',
      iconBg: '#E6F1FB', iconClr: '#185FA5',
      sub: `${inStock.length} stokta`,
    },
    {
      label: 'Satılık araçlar', value: String(forSale.length), suffix: 'adet',
      iconPath: 'M7 7h10M7 12h10M7 17h6',
      iconBg: '#FAEEDA', iconClr: '#854F0B',
      sub: forSale.length > 0 ? forSale[0].model : 'Listeye araç ekle',
    },
    {
      label: 'Satılan araçlar', value: String(sold.length), suffix: 'adet',
      iconPath: 'M5 13l4 4L19 7',
      iconBg: '#EAF3DE', iconClr: '#3B6D11',
      sub: sold.length > 0 ? `Son: ${sold[0].model}` : 'Henüz satış yok',
    },
    {
      label: 'Toplam kâr', value: fmt(toplamKar), suffix: '',
      iconPath: toplamKar >= 0 ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
      iconBg: toplamKar >= 0 ? '#EAF3DE' : '#FCEBEB',
      iconClr: toplamKar >= 0 ? '#3B6D11' : '#A32D2D',
      sub: `${sold.length} araçtan`,
      valueColor: toplamKar >= 0 ? '#0F6E56' : '#A32D2D',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
          Galerinin genel durumuna hızlı bakış
        </p>
      </div>

      {/* 4 stat kartı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: '2rem' }}>
        {cards.map(({ label, value, suffix, iconPath, iconBg, iconClr, sub, valueColor }) => (
          <div key={label} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 16, padding: '1.25rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconClr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath} />
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 500, margin: '0 0 4px', lineHeight: 1.1, color: valueColor ?? 'var(--color-text-primary)' }}>
              {value}
              {suffix && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 4 }}>{suffix}</span>}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Alt satır */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        {/* Son araçlar */}
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Son araçlar</p>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{all.length} toplam</span>
          </div>
          {all.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>Henüz araç eklenmedi.</div>
          ) : all.slice(0, 5).map((c, i) => {
            const kar = c.sell_price - c.buy_price - c.cost
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 1.25rem', borderBottom: i < Math.min(all.length, 5) - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none', background: i % 2 === 1 ? 'var(--color-background-secondary)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: STATUS_DOT[c.status] ?? '#888780' }} />
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.model}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0 }}>{STATUS_LABEL[c.status] ?? c.status}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{fmt(c.sell_price)}</p>
                  <p style={{ fontSize: 11, margin: 0, color: kar >= 0 ? '#3B6D11' : '#A32D2D' }}>{kar >= 0 ? '+' : ''}{fmt(kar)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Sağ kolon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Aktif müşteri */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>Aktif müşteri</p>
              <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{aktifMusteri}</p>
            </div>
          </div>

          {/* Durum dağılımı */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 16, padding: '1.25rem', flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 1rem' }}>Durum dağılımı</p>
            {all.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Veri yok.</p>
            ) : (['for_sale', 'in_stock', 'sold', 'in_repair'] as const).map(status => {
              const count = all.filter(c => c.status === status).length
              const pct   = Math.round((count / all.length) * 100)
              return (
                <div key={status} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[status], display: 'inline-block' }} />
                      <span style={{ color: 'var(--color-text-secondary)' }}>{STATUS_LABEL[status]}</span>
                    </span>
                    <span style={{ fontWeight: 500 }}>{count} <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(%{pct})</span></span>
                  </div>
                  <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: STATUS_DOT[status], borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
