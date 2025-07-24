
'use server';
/**
 * @fileOverview Um agente de IA para analisar leads e fornecer dicas de vendas.
 *
 * - analyzeLead - Uma função que lida com o processo de análise de leads.
 */

import { ai } from '@/ai/genkit';
import { LeadAnalysisInputSchema, LeadAnalysisOutputSchema, type LeadAnalysisInput } from '@/lib/types';
import { googleAI } from '@genkit-ai/googleai';


export async function analyzeLead(input: LeadAnalysisInput) {
  return leadAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'leadAnalysisPrompt',
  input: { schema: LeadAnalysisInputSchema },
  output: { schema: LeadAnalysisOutputSchema },
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `Você é um coach de vendas especialista e sua tarefa é analisar um lead para um vendedor.

Analise os seguintes dados do lead:
- Nome: {{{name}}}
- Cidade: {{{city}}}
- Status Atual: {{{status}}}
- Produto Desejado: {{{desiredProduct}}}
- Última Compra: {{{lastProductBought}}}
- Lembrete de Remarketing: {{{remarketingReminder}}}
- Histórico de Comentários:
{{#each comments}}
  - {{#if isSystemMessage}}Sistema{{else}}{{#if userName}}{{userName}}{{else}}Vendedor{{/if}}{{/if}}: {{{text}}}
{{/each}}

Com base nessas informações, forneça:
1.  **Análise do Lead:** Um parágrafo curto e direto avaliando a "temperatura" do lead (quente, morno, frio), seu potencial de fechamento e quaisquer pontos de atenção (positivos ou negativos).
2.  **Dicas de Vendas:** Uma lista de 2 a 3 dicas práticas e acionáveis para o vendedor. As dicas devem ser específicas para este lead, sugerindo os próximos passos, argumentos de venda ou perguntas a serem feitas.
3.  **Mensagem de Saudação:** Uma mensagem de saudação curta, amigável e personalizada para iniciar a conversa com este lead no WhatsApp. A mensagem não deve se apresentar como IA.

Responda em português do Brasil.
Sua resposta DEVE estar no formato JSON, usando codificação UTF-8, e contendo os campos "analysis", "salesTips", e "suggestedMessage". Por exemplo:
{
  "analysis": "Este é um lead quente com alto potencial...",
  "salesTips": [
    "Dica 1...",
    "Dica 2..."
  ],
  "suggestedMessage": "Olá, {{{name}}}! Tudo bem? Vi que você tem interesse em nossos produtos de TV e AV."
}
`,
});


const leadAnalysisFlow = ai.defineFlow(
  {
    name: 'leadAnalysisFlow',
    inputSchema: LeadAnalysisInputSchema,
    outputSchema: LeadAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
