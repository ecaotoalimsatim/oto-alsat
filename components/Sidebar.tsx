'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',   icon: '📊' },
  { href: '/araclar',    label: 'Araçlar',      icon: '🚗' },
  { href: '/musteriler', label: 'Müşteriler',   icon: '👥' },
  { href: '/raporlar',   label: 'Kâr Raporu',   icon: '📈' },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobil üst bar */}
      <div style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, background: '#fff', borderBottom: '1px solid #f3f4f6', padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between' }}
        className="mobile-bar">
        <span style={{ fontWeight: 700, fontSize: 16 }}>🚗 OtoGaleri</span>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>☰</button>
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#fff', borderRight: '1px solid #f3f4f6',
        height: '100vh', position: 'sticky', top: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#16a34a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚗</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>OtoGaleri</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Al-Sat Yönetim</p>
          </div>
        </div>

        {/* Menü */}
        <nav style={{ flex: 1, padding: 12 }}>
          {navItems.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 400,
                background: active ? '#f0fdf4' : 'transparent',
                color: active ? '#16a34a' : '#374151',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Çıkış */}
        <div style={{ padding: 12, borderTop: '1px solid #f3f4f6' }}>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 10, border: 'none',
            background: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280',
          }}>
            🚪 Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  )
}
