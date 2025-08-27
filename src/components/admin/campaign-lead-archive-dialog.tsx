
"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CampaignLead } from "@/lib/types";
import { archiveCampaignLead } from "@/app/actions";
import { Loader2 } from "lucide-react";

interface CampaignLeadArchiveDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead: CampaignLead | null;
  adminId: string | null;
  onLeadArchived: () => void;
}

export function CampaignLeadArchiveDialog({ isOpen, onOpenChange, lead, adminId, onLeadArchived }: CampaignLeadArchiveDialogProps) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleArchive = () => {
    if (!lead || !adminId) return;
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "Justificativa obrigatória", description: "Por favor, forneça um motivo para recusar o lead." });
      return;
    }

    startTransition(async () => {
      const result = await archiveCampaignLead(lead.id, reason, adminId);
      if (result.success) {
        toast({ title: "Lead recusado com sucesso!" });
        onLeadArchived();
        onOpenChange(false);
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar Lead: {lead?.name}</DialogTitle>
          <DialogDescription>
            Por favor, informe o motivo pelo qual este lead está sendo recusado. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="reason">Motivo da Recusa</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Contato inválido, cliente já atendido, etc."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Recusar Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
