
'use server';
/**
 * @fileOverview An AI flow to generate a shareable text for an offer.
 *
 * - generateOfferShareText - A function that handles the text generation.
 */

import { ai } from '@/ai/genkit';
import { OfferTextGeneratorInputSchema, OfferTextGeneratorOutputSchema, OfferTextGeneratorInput } from '@/lib/types';
import { googleAI } from '@genkit-ai/googleai';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function generateOfferShareText(input: OfferTextGeneratorInput) {
    const formattedDate = format(parseISO(input.validUntil), "dd/MM/yyyy", { locale: ptBR });
    return offerTextFlow({ ...input, validUntil: formattedDate });
}

const prompt = ai.definePrompt({
  name: 'offerTextGeneratorPrompt',
  input: { schema: OfferTextGeneratorInputSchema },
  output: { schema: OfferTextGeneratorOutputSchema },
  model: googleAI.model('gemini-1.5-flash'),
  prompt: `Você é um especialista em marketing e sua tarefa é criar uma mensagem curta e persuasiva para o WhatsApp para compartilhar uma oferta com um cliente.

A mensagem deve:
- Ser amigável e entusiasmada.
- Conter o placeholder <cliente> para ser substituído pelo nome do cliente.
- Destacar o produto e o preço de forma clara.
- Mencionar a data de validade da oferta.
- Usar emojis para tornar a mensagem mais visual e atrativa.
- Ser concisa e direta.

Responda em português do Brasil.
Sua resposta DEVE estar no formato JSON, usando codificação UTF-8.

Dados da Oferta:
- Título: {{{title}}}
- Preço: {{{price}}}
- Válido até: {{{validUntil}}}

Exemplo de resposta JSON:
{
  "text": "🎉 Olá, <cliente>! Tenho uma oferta imperdível para você! 🔥 A TV dos sonhos, {{{title}}}, está por um preço incrível de apenas R$ {{{price}}}! Mas corre, que é só até {{{validUntil}}}! 🚀"
}
`,
});

const offerTextFlow = ai.defineFlow(
  {
    name: 'offerTextFlow',
    inputSchema: OfferTextGeneratorInputSchema,
    outputSchema: OfferTextGeneratorOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
