import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCachedUser, getCachedProfile } from '@/lib/supabase/cached-user'
import { TopNavbar } from '@/components/layout/TopNavbar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { isEnrolledInFormacao } from '@/lib/formacao-queries'
import type { Profile } from '@/types'

// Aluno que só tem a Mentoria NPS: tudo que não for da NPS fica "em manutenção"
// até existir a página de venda dos outros produtos.
const NPS_PERMITIDO = ['/mentoria-nps', '/cursos/mentoria-nps', '/aula', '/perfil']
const CURSO_NPS = '/cursos/mentoria-nps'

function caminhoPermitidoNps(pathname: string) {
  return NPS_PERMITIDO.some(p => pathname === p || pathname.startsWith(`${p}/`)) &&
    (!pathname.startsWith('/cursos') || pathname === CURSO_NPS || pathname.startsWith(`${CURSO_NPS}/`))
}

function EmManutencao() {
  return (
    <div className="max-w-md mx-auto px-6 pt-28 pb-20 text-center space-y-5">
      <div
        className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
        style={{ background: 'rgba(255,184,0,0.10)', border: '1px solid rgba(255,184,0,0.25)' }}
      >
        <Wrench className="w-6 h-6 text-[#FFB800]" />
      </div>
      <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-fraunces, Georgia, serif)' }}>
        Em manutenção
      </h1>
      <p className="text-sm text-white/55 leading-relaxed">
        Esta área está sendo preparada e em breve estará disponível. Enquanto isso, aproveite tudo o que já está liberado na sua Mentoria NPS.
      </p>
      <Link
        href="/mentoria-nps"
        className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-[#0D1638] bg-[#FFB800] hover:bg-[#FFC933] transition-colors"
      >
        Ir para a Mentoria NPS
      </Link>
    </div>
  )
}

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile(user.id)

  if (!profile) redirect('/login')

  const supabase = await createClient()

  const isAdmin = profile.role === 'admin'

  // Todas as matrículas ativas do aluno, com o slug do produto e a validade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matriculas } = await (supabase.from('enrollments') as any)
    .select('id, expires_at, products!inner(slug)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linhas = (matriculas ?? []) as any[]
  const vigente = (e: { expires_at: string | null }) => !e.expires_at || new Date(e.expires_at).getTime() > Date.now()
  const slugsVigentes = new Set(linhas.filter(vigente).map(e => e.products.slug as string))

  // Mentoria NPA e NPA Presencial (ebook+telas) são produtos separados — qualquer um dos
  // dois libera o link "Mentoria NPA" na navegação (a própria página trata o que cada um vê).
  const temNpa = linhas.some(e => e.products.slug === 'mentoria-npa' || e.products.slug === 'ebook-telas-npa')
  // Mentoria NPS é assinatura mensal: só conta dentro da validade.
  const temNps = slugsVigentes.has('mentoria-nps')

  // Turma NPS: só a NPS vigente e nenhum outro produto. O admin pode simular esse
  // modo (cookie) pra ver como o aluno enxerga.
  const turmaNps = !isAdmin && temNps && slugsVigentes.size === 1
  const simulandoNps = isAdmin && (await cookies()).get('sn_preview_nps')?.value === '1'
  const npsOnly = turmaNps || simulandoNps

  const hasNpaAccess = npsOnly ? false : isAdmin || temNpa
  const hasNpsAccess = npsOnly ? true : isAdmin || temNps
  const formacaoEnrolled = npsOnly ? false : isAdmin || (await isEnrolledInFormacao())

  let conteudo = children
  if (npsOnly) {
    const pathname = (await headers()).get('x-pathname') ?? ''
    if (pathname === '/dashboard' || pathname === '/') redirect('/mentoria-nps')
    if (!caminhoPermitidoNps(pathname)) conteudo = <EmManutencao />
  }

  return (
    <div className="min-h-screen bg-[#0D1638]">
      <TopNavbar profile={profile as Profile} hasNpaAccess={hasNpaAccess} hasNpsAccess={hasNpsAccess} formacaoEnrolled={formacaoEnrolled} npsOnly={npsOnly} />
      {simulandoNps && (
        <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full px-4 py-2 text-xs font-semibold text-[#0D1638] bg-[#FFB800] shadow-lg">
          Visualizando como aluno da Mentoria NPS
          <a href="/api/preview-nps?on=0" className="underline">Sair do modo</a>
        </div>
      )}
      <main className="pb-20 md:pb-8">
        {conteudo}
      </main>
      <MobileTabBar hasNpaAccess={hasNpaAccess} hasNpsAccess={hasNpsAccess} npsOnly={npsOnly} />
    </div>
  )
}
