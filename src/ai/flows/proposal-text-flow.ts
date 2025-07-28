'use server';
/**
 * @fileOverview An AI flow to generate a personalized proposal text for a client.
 *
 * - generateProposalText - A function that handles the text generation.
 */

import { ai } from '@/ai/genkit';
import { ProposalTextGeneratorInputSchema, ProposalTextGeneratorOutputSchema, type ProposalTextGeneratorInput } from '@/lib/types';
import { googleAI } from '@genkit-ai/googleai';

export async function generateProposalText(input: ProposalTextGeneratorInput) {
    return proposalTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'proposalTextGeneratorPrompt',
  input: { schema: ProposalTextGeneratorInputSchema },
  output: { schema: ProposalTextGeneratorOutputSchema },
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `Você é um vendedor especialista e sua tarefa é criar uma proposta comercial formal e persuasiva para um cliente.

A proposta deve:
- Ser direcionada ao cliente, usando o placeholder <cliente>.
- Apresentar os produtos de forma clara e organizada, listando cada um.
- Para cada produto, detalhar os valores (à vista e, se houver, a prazo).
- Se a prazo, calcular o valor da parcela (valor total a prazo / número de parcelas) e apresentar de forma clara, ex: "10x de R$ 320,50".
- Mencionar o SKU de cada produto, se houver.
- Ter um tom profissional, mas amigável.
- Incluir a data da proposta para referência.
- Ter uma chamada para ação clara, incentivando o cliente a dar o próximo passo.
- Usar emojis de forma moderada para manter o profissionalismo, mas com um toque de cordialidade.

Responda em português do Brasil.
Sua resposta DEVE estar no formato JSON, usando codificação UTF-8, com o campo "text".

Dados da Proposta:
- Nome do Cliente: <cliente>
- Data da Proposta: {{{proposalDate}}}
- Produtos:
{{#each products}}
  - Nome: {{{name}}}
    SKU: {{#if sku}}{{sku}}{{else}}N/A{{/if}}
    Valor à Vista: R$ {{{cashPrice}}}
    {{#if installmentPriceTotal}}
    Valor Total a Prazo: R$ {{{installmentPriceTotal}}}
    Número de Parcelas: {{{installments}}}
    {{/if}}
{{/each}}

Exemplo de resposta JSON:
{
  "text": "Prezado(a) <cliente>,\n\nEspero que esteja tudo bem! 😃\n\nConforme nossa conversa, preparei uma proposta especial para você com os produtos que selecionamos com carinho. Abaixo estão os detalhes:\n\n--- ITENS DA PROPOSTA ---\n{{#each products}}\n*Produto:* {{name}}\n*SKU para referência:* {{#if sku}}{{sku}}{{else}}N/A{{/if}}\n*Valor à vista:* R$ {{cashPrice}} (Um ótimo desconto!)\n{{#if installmentPriceTotal}}*Valor a prazo:* {{installments}}x de R$ {{#eval installmentPriceTotal '/' installments}}{{/eval}}\n{{/if}}\n------------------------\n{{/each}}\n\nEsta proposta é válida até {{proposalDate}}.\n\nEstou à disposição para qualquer dúvida e para darmos o próximo passo. O que acha de fecharmos negócio?\n\nFico no aguardo! 🚀\n\nAbraço!"
}
`,
});


const proposalTextFlow = ai.defineFlow(
  {
    name: 'proposalTextFlow',
    inputSchema: ProposalTextGeneratorInputSchema,
    outputSchema: ProposalTextGeneratorOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
