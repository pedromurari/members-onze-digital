'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Os layouts do Next não rodam de novo quando o aluno clica num link dentro do site
// (navegação do lado do cliente), então o bloqueio da turma NPS precisa ser conferido
// aqui também, a cada troca de página. A conferência do servidor continua valendo
// para quem abre a URL direto.
const PERMITIDO = ['/mentoria-nps', '/cursos/mentoria-nps', '/aula', '/perfil']

function permitido(pathname: string) {
  return PERMITIDO.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function NpsOnlyGuard({
  enabled,
  fallback,
  children,
}: {
  enabled: boolean
  fallback: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const vaiParaHub = enabled && (pathname === '/dashboard' || pathname === '/')

  useEffect(() => {
    if (vaiParaHub) router.replace('/mentoria-nps')
  }, [vaiParaHub, router])

  if (!enabled) return <>{children}</>
  if (vaiParaHub) return null
  if (!permitido(pathname)) return <>{fallback}</>
  return <>{children}</>
}
