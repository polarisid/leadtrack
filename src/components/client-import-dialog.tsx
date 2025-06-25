
"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import * as Papa from "papaparse";
import { useAuth } from "@/context/auth-context";
import { addBulkClients } from "@/app/actions";
import { Client, productCategories, clientStatuses } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, Loader2, AlertCircle } from "lucide-react";

interface ClientImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClientsImported: (clients: Client[]) => void;
}

const CSV_HEADERS = [
  "Nome do Cliente", "Cidade", "Contato", "Ultimo Produto", "Status", "Produto Desejado", "Lembrete de Remarketing"
];

const headerMapping: { [key: string]: keyof Partial<Client> } = {
  "Nome do Cliente": "name",
  "Cidade": "city",
  "Contato": "contact",
  "Ultimo Produto": "lastProductBought",
  "Status": "status",
  "Produto Desejado": "desiredProduct",
  "Lembrete de Remarketing": "remarketingReminder",
};

export function ClientImportDialog({ isOpen, onOpenChange, onClientsImported }: ClientImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleClose = () => {
    setFile(null);
    setErrors([]);
    onOpenChange(false);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setErrors([]);
    }
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([CSV_HEADERS], { delimiter: ";" });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImport = () => {
    if (!file) {
      toast({ variant: "destructive", title: "Nenhum arquivo selecionado" });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Usuário não autenticado" });
      return;
    }

    startTransition(() => {
      setErrors([]);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const validationErrors: string[] = [];

          if (results.errors.length > 0) {
             results.errors.forEach(err => validationErrors.push(`Erro de parse na linha ${err.row}: ${err.message}`));
          }
          
          const clientsToImport = (results.data as any[])
            .map((row: any, index) => {
              const client: any = {};
              let hasRequiredData = true;

              for (const header of CSV_HEADERS) {
                  const clientKey = headerMapping[header];
                  if (clientKey) {
                      client[clientKey] = row[header]?.trim() || '';
                  }
              }

              if (!client.name || !client.city || !client.contact) {
                  validationErrors.push(`Linha ${index + 2}: Nome do Cliente, Cidade e Contato são obrigatórios.`);
                  hasRequiredData = false;
              }
              
              client.status = clientStatuses.includes(client.status) ? client.status : 'Novo Lead';
              client.desiredProduct = productCategories.includes(client.desiredProduct) ? client.desiredProduct : 'Outros';

              return hasRequiredData ? client : null;
            })
            .filter(Boolean);

          if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
          }

          if (clientsToImport.length === 0) {
            setErrors(["Nenhum cliente válido encontrado no arquivo."]);
            return;
          }

          const result = await addBulkClients(clientsToImport as any[], user.uid);
          
          if (result.success && result.addedClients) {
            toast({
              title: "Importação Concluída!",
              description: `${result.addedClients.length} clientes importados com sucesso.`,
            });
            onClientsImported(result.addedClients);
            handleClose();
          } else {
            setErrors(result.errors || ["Ocorreu um erro desconhecido durante a importação."]);
          }
        },
        error: (error) => {
          setErrors([error.message]);
        }
      });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Clientes de Planilha</DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo CSV. Certifique-se que as colunas correspondem ao modelo.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                    <label htmlFor="file-upload" className="text-sm font-medium">Arquivo CSV</label>
                    <Input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} />
                </div>
                <Button variant="outline" className="self-end" onClick={downloadTemplate}>
                    <FileText className="mr-2 h-4 w-4" />
                    Baixar Modelo
                </Button>
            </div>
            
            {errors.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erros na Validação</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc list-inside max-h-32 overflow-y-auto text-xs">
                            {errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!file || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar Clientes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
