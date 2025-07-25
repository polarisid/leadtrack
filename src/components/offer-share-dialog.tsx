
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Client, Offer } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateOfferShareTextAction } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";
import { generateWhatsappLink } from "@/lib/whatsapp-config";
import { Send, Copy, Sparkles } from "lucide-react";
import { Textarea } from "./ui/textarea";

interface OfferShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  clients: Client[];
}

export function OfferShareDialog({ isOpen, onOpenChange, offer, clients }: OfferShareDialogProps) {
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, startGenerating] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && offer) {
      startGenerating(async () => {
        setGeneratedText("");
        try {
          const result = await generateOfferShareTextAction({
            title: offer.title,
            price: offer.price,
            coupon: offer.coupon,
            validUntil: offer.validUntil,
          });
          setGeneratedText(result.text);
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Erro de IA",
            description: "Não foi possível gerar a mensagem da oferta.",
          });
        }
      });
    }
  }, [isOpen, offer, toast]);

  const interestedClients = useMemo(() => {
    if (!offer) return [];
    return clients.filter(client => client.desiredProduct === offer.category && (client.status === 'Novo Lead' || client.status === 'Em negociação' || client.status === 'Pós-venda'));
  }, [clients, offer]);

  const handleSendMessage = (client: Client) => {
    if (!generatedText) return;
    const personalizedMessage = generatedText.replace(/<cliente>/g, client.name);
    const link = generateWhatsappLink(client, personalizedMessage);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedText).then(() => {
        toast({ title: "Mensagem copiada!" });
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartilhar Oferta: {offer?.title}</DialogTitle>
          <DialogDescription>
            A IA gerou uma mensagem para você. Envie para os leads com interesse na categoria "{offer?.category}".
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Mensagem Gerada</h4>
                {isGenerating ? (
                    <div className="space-y-2">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <>
                        <Textarea 
                            value={generatedText} 
                            onChange={(e) => setGeneratedText(e.target.value)}
                            rows={8}
                            className="text-sm"
                        />
                         <Button onClick={handleCopyToClipboard} variant="outline" className="w-full">
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar Texto Base
                        </Button>
                    </>
                )}
            </div>
            <div className="space-y-4">
                 <h4 className="font-semibold">Leads Interessados ({interestedClients.length})</h4>
                 <ScrollArea className="h-64 border rounded-md">
                    {interestedClients.length > 0 ? (
                        <div className="p-2 space-y-2">
                            {interestedClients.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <div className="text-sm">
                                        <p className="font-medium">{client.name}</p>
                                        <p className="text-muted-foreground">{client.city}</p>
                                    </div>
                                    <Button size="sm" onClick={() => handleSendMessage(client)} disabled={!generatedText}>
                                        <Send className="mr-2 h-4 w-4"/>
                                        Enviar
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                            Nenhum lead com interesse nesta categoria.
                        </div>
                    )}
                 </ScrollArea>
            </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
