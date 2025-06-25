
"use client"

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"

import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { Lightbulb } from "lucide-react"

const tips = [
  "Lembre-se de enviar uma mensagem aos clientes que já compraram, isso reforça a conexão.",
  "Um bom acompanhamento (follow-up) pode dobrar suas chances de fechar negócio.",
  "Mantenha os dados dos seus clientes sempre atualizados para um atendimento personalizado.",
  "Use o status 'Pós-venda' para planejar futuras ofertas e manter o cliente engajado.",
  "Nunca subestime o poder de uma anotação. Anote tudo sobre o lead!",
]

export function SalesTipsCarousel() {
  const plugin = React.useRef(
    Autoplay({ delay: 7000, stopOnInteraction: true })
  )

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full max-w-full"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
      <CarouselContent>
        {tips.map((tip, index) => (
          <CarouselItem key={index}>
            <div className="p-1">
              <Card className="bg-accent/20 border-accent/30 shadow-sm">
                <CardContent className="flex items-center gap-4 p-4 text-sm">
                  <Lightbulb className="h-5 w-5 text-accent-foreground flex-shrink-0" />
                  <p className="text-accent-foreground/80 font-medium">{tip}</p>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
