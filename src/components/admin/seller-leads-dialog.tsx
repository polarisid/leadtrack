
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getClients } from "@/app/actions";
import { Client } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { StatusBadge } from "../status-badge";
import * as Papa from "papaparse";

interface SellerLeadsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  seller: { id: string; name: string } | null;
}

export function SellerLeadsDialog({ isOpen, onOpenChange, seller }: SellerLeadsDialogProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSellerClients = useCallback(async () => {
    if (!seller) return;
    setIsLoading(true);
    try {
      const sellerClients = await getClients(seller.id);
      setClients(sellerClients);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os leads do vendedor.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [seller, toast]);

  useEffect(() => {
    if (isOpen && seller) {
      fetchSellerClients();
    }
  }, [isOpen, seller, fetchSellerClients]);
  
  const handleExport = () => {
    if (clients.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum lead para exportar",
      });
      return;
    }

    const dataToExport = clients.map(client => ({
      "Nome do Cliente": client.name,
      "Cidade": client.city,
      "Contato": client.contact,
      "Ultimo Produto": client.lastProductBought,
      "Status": client.status,
      "Produto Desejado": client.desiredProduct,
      "Lembrete de Remarketing": client.remarketingReminder,
      "Data de Criação": new Date(client.createdAt).toLocaleDateString('pt-BR')
    }));

    const csv = Papa.unparse(dataToExport, { delimiter: ";" });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${seller?.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportação iniciada!", description: `Leads de ${seller?.name} serão baixados.` });
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Leads de: {seller?.name}</DialogTitle>
          <DialogDescription>
            Visualize e exporte a lista de todos os leads gerenciados por este vendedor.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : clients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Produto Desejado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.city}</TableCell>
                      <TableCell>{client.desiredProduct}</TableCell>
                      <TableCell>
                        <StatusBadge status={client.status} />
                      </TableCell>
                       <TableCell>{new Date(client.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Este vendedor ainda não possui leads.</p>
                </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleExport} disabled={clients.length === 0}>
            <Download className="mr-2" />
            Baixar CSV
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
