
"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Offer, Client } from "@/lib/types";
import { generateOfferShareTextAction } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";
import { Sparkles, Send, Copy } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { ScrollArea } from "./ui/scroll-area";
import { generateWhatsappLink } from "@/lib/whatsapp-config";


interface OfferShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  clients: Client[];
}

export function OfferShareDialog({ isOpen, onOpenChange, offer, clients = [] }: OfferShareDialogProps) {
  const [generatedText, setGeneratedText] = useState("");
  const [isGenerating, startGenerating] = useTransition();
  const { toast } = useToast();
  
  const interestedClients = clients.filter(client => client.desiredProduct === offer?.category);

  useEffect(() => {
    if (isOpen && offer) {
      setGeneratedText("");

      startGenerating(async () => {
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

  const handleShareToClient = (client: Client) => {
    if (!generatedText) return;
    const message = generatedText.replace(/<cliente>/g, client.name.split(' ')[0]);
    const link = generateWhatsappLink(client, message);
    window.open(link, '_blank', 'noopener,noreferrer');
    toast({ title: `Abrindo WhatsApp para ${client.name}`});
  };

  const handleCopy = () => {
    if (!generatedText) return;
    const messageToCopy = generatedText.replace(/<cliente>/g, 'você');
    navigator.clipboard.writeText(messageToCopy).then(() => {
      toast({ title: "Mensagem copiada!" });
    }, () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível copiar a mensagem." });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar Oferta: {offer?.title}</DialogTitle>
          <DialogDescription>
            Use a mensagem sugerida e envie para os leads interessados nesta categoria.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Mensagem Sugerida</h4>
                    <Button variant="ghost" size="sm" onClick={handleCopy} disabled={isGenerating || !generatedText}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                    </Button>
                </div>
                {isGenerating ? (
                    <Skeleton className="h-24 w-full" />
                ) : (
                    <Textarea 
                        value={generatedText.replace(/<cliente>/g, 'você')}
                        onChange={(e) => setGeneratedText(e.target.value)}
                        rows={5}
                        className="text-sm"
                    />
                )}
            </div>
             <div className="space-y-2">
                <h4 className="font-semibold text-sm">Leads para referência ({interestedClients.length})</h4>
                <ScrollArea className="h-60 w-full pr-4 border rounded-md">
                  {interestedClients.length > 0 ? (
                    <div className="space-y-2 p-2">
                        {interestedClients.map(client => (
                            <div key={client.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <span className="text-sm font-medium">{client.name}</span>
                                <Button size="sm" variant="secondary" onClick={() => handleShareToClient(client)} disabled={isGenerating}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Enviar
                                </Button>
                            </div>
                        ))}
                    </div>
                  ): (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-center text-sm text-muted-foreground p-4">
                            Nenhum cliente seu tem interesse na categoria "{offer?.category}".
                        </p>
                    </div>
                  )}
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
