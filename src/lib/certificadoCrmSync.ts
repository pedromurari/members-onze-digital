import 'server-only'
import { createSistema11Client } from '@/lib/sistema11'

// ─────────────────────────────────────────────────────────────────────────
// Quando um aluno resgata o certificado em /certificado, tenta casar esse
// lead com o card dele no Kanban do lançamento ATIVO no Sistema Onze Digital
// (Plataforma 11ds — projeto Supabase separado) e mover pra coluna
// "Certificado gerado", guardando a fase anterior numa anotação no card.
//
// Busca o lançamento ativo dinamicamente (status = 'em_andamento', ativo =
// true) em vez de fixar o id da turma — assim continua funcionando nas
// próximas turmas sem precisar mexer no código a cada lançamento. Se a
// coluna "Certificado gerado" ainda não existir nesse lançamento (ex: time
// esqueceu de criar pra turma nova), não cria sozinho — só loga e sai, pra
// não surpreender o time mexendo no board sem eles saberem.
//
// Falha aqui NUNCA deve impedir o aluno de receber o PDF — por isso todo
// esse fluxo é best-effort, sempre dentro de try/catch no caller.
// ─────────────────────────────────────────────────────────────────────────

const COLUNA_CERTIFICADO_NOME = 'Certificado gerado'

function apenasDigitosLocais(raw: string): string {
  const d = raw.replace(/\D/g, '')
  // remove o "55" do DDI quando presente, pra comparar só DDD + número
  return d.length > 11 && d.startsWith('55') ? d.slice(2) : d
}

export async function sincronizarCertificadoNoCrm(params: {
  nome: string
  email: string
  telefone: string
}): Promise<void> {
  const emailNorm = params.email.trim().toLowerCase()
  const telefoneNorm = apenasDigitosLocais(params.telefone)

  const sistema11 = createSistema11Client()

  // 1. Lançamento ativo agora
  const { data: lancamento, error: lancamentoError } = await sistema11
    .from('lancamentos')
    .select('id, nome')
    .eq('status', 'em_andamento')
    .eq('ativo', true)
    .order('data_live', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lancamentoError || !lancamento) {
    console.warn('[certificado-crm-sync] nenhum lançamento ativo encontrado:', lancamentoError?.message)
    return
  }

  // 2. Coluna "Certificado gerado" desse lançamento
  const { data: coluna, error: colunaError } = await sistema11
    .from('kanban_colunas')
    .select('id')
    .eq('lancamento_id', lancamento.id)
    .eq('nome', COLUNA_CERTIFICADO_NOME)
    .maybeSingle()

  if (colunaError || !coluna) {
    console.warn(
      `[certificado-crm-sync] coluna "${COLUNA_CERTIFICADO_NOME}" não existe no lançamento "${lancamento.nome}" — pulando (crie a coluna manualmente se quiser sincronizar essa turma).`
    )
    return
  }

  // 3. Achar o lead desse lançamento por e-mail OU telefone
  const { data: leads, error: leadsError } = await sistema11
    .from('lancamento_leads')
    .select('id, fase, observacoes, email, whatsapp')
    .eq('lancamento_id', lancamento.id)

  if (leadsError || !leads) {
    console.warn('[certificado-crm-sync] erro ao buscar leads do lançamento:', leadsError?.message)
    return
  }

  const lead = leads.find(l => {
    const leadEmail = (l.email ?? '').trim().toLowerCase()
    const leadTelefone = apenasDigitosLocais(l.whatsapp ?? '')
    return (emailNorm && leadEmail === emailNorm) || (telefoneNorm && leadTelefone === telefoneNorm)
  })

  if (!lead) {
    console.warn(`[certificado-crm-sync] nenhum lead encontrado em "${lancamento.nome}" pra ${emailNorm || telefoneNorm}`)
    return
  }

  // Já está na coluna de certificado — nada a fazer
  if (lead.fase === coluna.id) return

  // 4. Guardar a fase anterior como anotação, e mover o card
  const { data: faseAnterior } = lead.fase
    ? await sistema11.from('kanban_colunas').select('nome').eq('id', lead.fase).maybeSingle()
    : { data: null }

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const notaFaseAnterior = faseAnterior?.nome ?? 'sem fase definida'
  const novaObservacao = `[${timestamp}] Certificado gerado via idmpsi.com.br/certificado — estava em "${notaFaseAnterior}".`
  const observacoesAtualizadas = lead.observacoes ? `${lead.observacoes}\n${novaObservacao}` : novaObservacao

  const { error: updateError } = await sistema11
    .from('lancamento_leads')
    .update({
      fase: coluna.id,
      observacoes: observacoesAtualizadas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)

  if (updateError) {
    console.error('[certificado-crm-sync] erro ao mover o card:', updateError.message)
  }
}
