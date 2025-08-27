
"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Client } from "@/lib/types";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ClientDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onConfirmDelete: (client: Client, reason?: string) => void;
  isPending: boolean;
}

export function ClientDeleteDialog({
  isOpen,
  onOpenChange,
  client,
  onConfirmDelete,
  isPending,
}: ClientDeleteDialogProps) {
  const [reason, setReason] = useState("");
  const isCampaignLead = !!client?.campaignId;
  const { toast } = useToast();

  const handleConfirm = () => {
    if (isCampaignLead && !reason.trim()) {
      toast({
        variant: "destructive",
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da exclusão deste lead de campanha.",
      });
      return;
    }
    if (client) {
      onConfirmDelete(client, reason);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason("");
    }
    onOpenChange(open);
  };
  
  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa ação não pode ser desfeita. Isso irá deletar permanentemente o cliente.
            {isCampaignLead && " O status do lead na campanha será atualizado para 'Recusado'."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isCampaignLead && (
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-reason">Motivo da Exclusão (Obrigatório)</Label>
            <Textarea
              id="delete-reason"
              placeholder="Ex: Cliente já comprou, contato inválido, não tem interesse, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive hover:bg-destructive/90"
            disabled={isPending}
          >
            {isPending ? "Deletando..." : "Deletar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
