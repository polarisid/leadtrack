
'use server';
/**
 * @fileOverview An AI flow to generate a daily summary for a seller's leads.
 *
 * - generateDailySummary - A function that handles the daily summary generation.
 */

import { ai } from '@/ai/genkit';
import { DailySummaryInputSchema, DailySummaryOutputSchema, DailySummaryInput } from '@/lib/types';
import { googleAI } from '@genkit-ai/googleai';


export async function generateDailySummary(input: DailySummaryInput) {
  return dailySummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dailySummaryPrompt',
  input: { schema: DailySummaryInputSchema },
  output: { schema: DailySummaryOutputSchema },
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `Você é um coach de vendas especialista e sua tarefa é gerar um resumo diário para um vendedor com base em sua carteira de clientes.

Analise a lista de clientes fornecida e gere um resumo conciso e acionável.

Considere a data de "última atualização" (updatedAt) e o "status" de cada lead para fazer suas recomendações. Leads com status "Novo Lead" ou "Em negociação" que não são atualizados há muito tempo são leads em risco. Leads com interações recentes ou status positivos são mais promissores.

Responda em português do Brasil.
Sua resposta DEVE estar no formato JSON, usando codificação UTF-8.

1.  **overview:** Um parágrafo curto (2-3 frases) dando um panorama geral da carteira.
2.  **hotLeads:** Uma lista de 2 a 3 leads "quentes" que o vendedor deve priorizar hoje, com o motivo.
3.  **leadsToWatch:** Uma lista de 1 a 2 leads que precisam de atenção (em risco de ficarem frios), com o motivo.
4.  **dailyActions:** Uma lista de 3 ações práticas e específicas que o vendedor pode tomar hoje para aumentar suas vendas.

Exemplo de resposta JSON:
{
  "overview": "Sua carteira está aquecida, com vários leads em negociação. O foco hoje deve ser converter os leads mais antigos e nutrir os novos para não perdê-los.",
  "hotLeads": [
    { "name": "Maria Silva", "reason": "Demonstrou forte interesse no produto de TV e AV e a última interação foi recente." },
    { "name": "João Pereira", "reason": "É um novo lead com produto de interesse definido, uma ótima oportunidade para o primeiro contato." }
  ],
  "leadsToWatch": [
    { "name": "Carlos Souza", "reason": "Está em negociação há mais de duas semanas sem atualização. Risco de esfriar." }
  ],
  "dailyActions": [
    "Envie uma mensagem de acompanhamento para os leads em 'Em negociação' que não atualiza há mais de 5 dias.",
    "Tente uma nova abordagem com os 'leadsToWatch', talvez oferecendo um benefício ou condição especial.",
    "Reserve 30 minutos para prospectar novos clientes com o perfil dos seus 'hotLeads'."
  ]
}

Lista de Clientes para Análise:
{{#each clients}}
- Nome: {{name}}, Status: {{status}}, Produto Desejado: {{desiredProduct}}, Última Atualização: {{updatedAt}}
{{/each}}
`,
});


const dailySummaryFlow = ai.defineFlow(
  {
    name: 'dailySummaryFlow',
    inputSchema: DailySummaryInputSchema,
    outputSchema: DailySummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
