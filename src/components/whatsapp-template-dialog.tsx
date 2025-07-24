
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Client, MessageTemplate } from "@/lib/types";
import { generateWhatsappLink } from "@/lib/whatsapp-config";
import { Send } from "lucide-react";
import { Textarea } from "./ui/textarea";

interface WhatsappTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  templates: MessageTemplate[];
}

export function WhatsappTemplateDialog({ isOpen, onOpenChange, client, templates }: WhatsappTemplateDialogProps) {
  const [customMessage, setCustomMessage] = useState("");
  
  if (!client) return null;

  const handleTemplateClick = (templateContent: string) => {
    const message = templateContent.replace(/<cliente>/g, client.name);
    const link = generateWhatsappLink(client, message);
    window.open(link, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleCustomMessageSend = () => {
    if (!customMessage.trim()) return;
    const message = customMessage.replace(/<cliente>/g, client.name);
    const link = generateWhatsappLink(client, message);
    window.open(link, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mensagem para {client.name}</DialogTitle>
          <DialogDescription>
            Escreva uma mensagem personalizada ou selecione um modelo abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Textarea 
            placeholder="Escreva sua mensagem aqui... Use <cliente> para inserir o nome do cliente."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
          />
          <Button 
            className="w-full"
            onClick={handleCustomMessageSend}
            disabled={!customMessage.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            Enviar Mensagem Personalizada
          </Button>
        </div>
        
        {templates.length > 0 && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou use um template
                </span>
              </div>
            </div>
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-3 pr-4">
                {templates.map((template) => (
                  <div key={template.id} className="p-3 rounded-lg border bg-muted/50 flex flex-col items-start gap-2">
                    <p className="font-semibold text-sm">{template.title}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {template.content.replace(/<cliente>/g, client.name)}
                    </p>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="self-end"
                      onClick={() => handleTemplateClick(template.content)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Usar Template
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
