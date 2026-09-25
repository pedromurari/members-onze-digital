import { redirect } from 'next/navigation'
import { Layers, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MapaEsferasCard, VoltarButton } from '../mentoria-npa/HubCards'

export const metadata = { title: 'Mentoria NPS — Instituto Despertamente' }

export default async function MentoriaNpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: profile } = await sb.from('profiles').select('role, full_name').eq('id', user.id).single()

  const { data: enrollments } = await sb
    .from('enrollments')
    .select('id, expires_at, products!inner(slug)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('products.slug', 'mentoria-nps')

  const now = Date.now()
  const hasNps = (enrollments ?? []).some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => !e.expires_at || new Date(e.expires_at).getTime() > now,
  )
  const isAdmin = profile?.role === 'admin'

  if (!hasNps && !isAdmin) redirect('/dashboard')

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'Bem-vindo'

  return (
    <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 pb-24 md:pb-16 space-y-10">
      <VoltarButton />

      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFB800]">Mentoria NPS</p>
        <h1
          className="text-4xl sm:text-[2.75rem] leading-[1.08] font-bold text-white"
          style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}
        >
          Bem-vindo,<br className="hidden sm:block" /> {firstName}.
        </h1>
        <p className="text-sm sm:text-[15px] text-white/55 max-w-lg leading-relaxed">
          Sua mensalidade está em dia. Você pode gerar até 5 mapas por mês no Mapa 7 Esferas.
        </p>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
          style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.22)' }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#FFB800]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FFB800]">Matrícula ativa</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-[#FFB800]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Plataformas</span>
        </div>
        <MapaEsferasCard />
      </div>
    </div>
  )
}
