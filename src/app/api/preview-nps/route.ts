import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Só admin: liga/desliga a simulação "ver como aluno da Mentoria NPS" (cookie).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('profiles') as any).select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.redirect(new URL('/dashboard', request.url))

  const ligar = request.nextUrl.searchParams.get('on') === '1'
  const resposta = NextResponse.redirect(new URL(ligar ? '/mentoria-nps' : '/dashboard', request.url))
  if (ligar) {
    resposta.cookies.set('sn_preview_nps', '1', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 })
  } else {
    resposta.cookies.delete('sn_preview_nps')
  }
  return resposta
}
