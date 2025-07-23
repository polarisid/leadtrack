'use server';
/**
 * @fileOverview An AI flow to generate a daily summary for an admin about all sellers.
 *
 * - generateAdminDailySummary - A function that handles the daily summary generation for the admin.
 */

import { ai } from '@/ai/genkit';
import { AdminDailySummaryInputSchema, AdminDailySummaryOutputSchema, AdminDailySummaryInput } from '@/lib/types';
import { googleAI } from '@genkit-ai/googleai';

export async function generateAdminDailySummary(input: AdminDailySummaryInput) {
  return adminDailySummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adminDailySummaryPrompt',
  input: { schema: AdminDailySummaryInputSchema },
  output: { schema: AdminDailySummaryOutputSchema },
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `Você é um diretor de vendas experiente e sua tarefa é gerar um resumo diário para um administrador sobre o desempenho de toda a equipe de vendas.

Analise a lista de vendedores e seus respectivos clientes. Considere a data de "última atualização" (updatedAt) e o "status" de cada lead para fazer suas recomendações. Leads em "Novo Lead" ou "Em negociação" sem atualização por muito tempo são um risco. Vendedores com muitos leads nessa situação podem precisar de ajuda.

Sua resposta DEVE estar no formato JSON, usando codificação UTF-8.

1.  **portfolioOverview:** Um parágrafo curto (2-3 frases) dando um panorama geral da saúde da carteira de clientes de toda a equipe.
2.  **topSellers:** Uma lista de 2 a 3 vendedores que estão se destacando hoje (ex: muitos leads quentes, negociações avançadas), com o motivo.
3.  **sellersToWatch:** Uma lista de 1 a 2 vendedores que precisam de atenção (ex: muitos leads parados, sem atividade), com o motivo.
4.  **globalOpportunities:** Uma lista de 1 a 2 oportunidades ou riscos globais que você identificou (ex: "Muitos clientes buscando 'TV e AV', podemos criar uma campanha" ou "Vários leads estão parados há mais de 15 dias, risco de esfriamento geral da base").

Exemplo de resposta JSON:
{
  "portfolioOverview": "A carteira geral está aquecida, com um bom volume de novos leads entrando. No entanto, há um número considerável de leads em negociação parados há mais de uma semana, indicando um ponto de atenção para a equipe.",
  "topSellers": [
    { "name": "Ana", "reason": "Está com 3 leads quentes que tiveram interação nos últimos 2 dias e parece próxima de fechar duas vendas." },
    { "name": "Marcos", "reason": "Conseguiu engajar 5 novos leads essa semana, mostrando ótima prospecção." }
  ],
  "sellersToWatch": [
    { "name": "Juliana", "reason": "Possui 8 leads na carteira sem atualização há mais de 15 dias. Pode precisar de ajuda para reengajar esses contatos." }
  ],
  "globalOpportunities": [
     { "description": "Notamos um aumento na procura por produtos de 'Informática'. Seria uma boa oportunidade para focar as campanhas de marketing nesse segmento esta semana." }
  ]
}

Dados da Equipe para Análise:
{{#each sellers}}
Vendedor: {{sellerName}}
  Clientes:
  {{#each clients}}
  - Status: {{status}}, Última Atualização: {{updatedAt}}
  {{/each}}
{{/each}}
`,
});

const adminDailySummaryFlow = ai.defineFlow(
  {
    name: 'adminDailySummaryFlow',
    inputSchema: AdminDailySummaryInputSchema,
    outputSchema: AdminDailySummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
