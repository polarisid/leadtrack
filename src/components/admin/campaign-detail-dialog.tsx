
"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
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
import { getCampaignDetails, uploadCampaignLeads } from "@/app/actions";
import { Campaign, CampaignLead, CampaignLeadStatus } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Upload, AlertCircle, Loader2, Trash2, Info, Users, CheckCircle, XCircle } from "lucide-react";
import { StatusBadge } from "../status-badge";
import * as Papa from "papaparse";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { CampaignLeadArchiveDialog } from "./campaign-lead-archive-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


interface CampaignDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  adminId: string | null;
  onCampaignUpdated: () => void;
}

export function CampaignDetailDialog({ isOpen, onOpenChange, campaignId, adminId, onCampaignUpdated }: CampaignDetailDialogProps) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, startUploading] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  
  const [leadToArchive, setLeadToArchive] = useState<CampaignLead | null>(null);


  const fetchCampaignDetails = useCallback(async () => {
    if (!campaignId || !adminId) return;
    setIsLoading(true);
    try {
      const details = await getCampaignDetails(campaignId, adminId);
      if (details) {
        setCampaign(details.campaign);
        // Sort leads by creation date descending after fetching
        const sortedLeads = details.leads.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLeads(sortedLeads);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os detalhes da campanha.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, adminId, toast]);

  useEffect(() => {
    if (isOpen && campaignId && adminId) {
      fetchCampaignDetails();
    } else {
        setFile(null);
        setUploadErrors([]);
    }
  }, [isOpen, campaignId, adminId, fetchCampaignDetails]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setUploadErrors([]);
    }
  };

  const handleImport = () => {
    if (!file) {
      toast({ variant: "destructive", title: "Nenhum arquivo selecionado" });
      return;
    }
    if (!campaignId || !adminId) return;

    startUploading(() => {
        setUploadErrors([]);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                if (results.errors.length > 0) {
                    setUploadErrors(results.errors.map(e => `Erro na linha ${e.row}: ${e.message}`));
                    return;
                }
                
                const result = await uploadCampaignLeads(campaignId, results.data as Record<string, string>[], adminId);
                
                if (result.success) {
                    toast({ title: "Sucesso!", description: `${result.count} leads foram importados para a campanha.` });
                    fetchCampaignDetails(); // Refresh list
                    setFile(null);
                    onCampaignUpdated();
                } else {
                    setUploadErrors(result.errors || ["Ocorreu um erro desconhecido."]);
                }
            }
        });
    });
  }
  
  const handleExport = () => {
    if (leads.length === 0) {
        toast({ variant: "destructive", title: "Nenhum lead para exportar" });
        return;
    }
    const dataToExport = leads.map(lead => ({
        "Nome": lead.name,
        "Contato": lead.contact || "N/A",
        "Cidade": lead.city || "N/A",
        "Status Campanha": lead.status,
        "Pegado Por": lead.claimedByName || "N/A",
        "Status Final": lead.finalClientStatus || "N/A",
        "Motivo Recusa": lead.deletionReason || "N/A",
        ...lead.originalData
    }));
    const csv = Papa.unparse(dataToExport, { delimiter: ";" });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `resumo_campanha_${campaign?.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportação Iniciada", description: "O resumo da campanha será baixado." });
  };


  const getStatusBadge = (status: CampaignLeadStatus) => {
    const statusMap: Record<CampaignLeadStatus, React.ReactNode> = {
        available: <Badge variant="secondary">Disponível</Badge>,
        claimed: <Badge variant="outline" className="text-yellow-600 border-yellow-500">Sendo Trabalhado</Badge>,
        converted: <Badge variant="default" className="bg-green-600">Convertido</Badge>,
        archived: <Badge variant="destructive">Recusado</Badge>
    }
    return statusMap[status] || null;
  }

  const onLeadArchived = () => {
      fetchCampaignDetails();
      onCampaignUpdated();
      setLeadToArchive(null);
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          {isLoading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <>
                <div className="flex justify-between items-start">
                    <div>
                        <DialogTitle>Campanha: {campaign?.name}</DialogTitle>
                        <DialogDescription>{campaign?.description}</DialogDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar Resumo
                    </Button>
                </div>
            </>
          )}
        </DialogHeader>
        {isLoading ? (
            <Skeleton className="h-24 w-full" />
        ) : campaign && (
            <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{campaign.leadCount}</p>
                </div>
                 <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><Users className="h-4 w-4" /> Pegos</p>
                    <p className="text-2xl font-bold">{campaign.claimedCount}</p>
                </div>
                <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4" /> Convertidos</p>
                    <p className="text-2xl font-bold">{campaign.convertedCount}</p>
                </div>
                 <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><XCircle className="h-4 w-4" /> Recusados</p>
                    <p className="text-2xl font-bold">{campaign.archivedCount}</p>
                </div>
            </div>
        )}
        <div className="border p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-semibold">Importar Leads</h4>
            <div className="flex gap-4 items-end">
                <div className="flex-1">
                    <Input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} />
                </div>
                <Button onClick={handleImport} disabled={!file || isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Importar Planilha
                </Button>
            </div>
             {uploadErrors.length > 0 && (
                <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erros na Importação</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc list-inside max-h-24 overflow-y-auto text-xs">
                            {uploadErrors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : leads.length > 0 ? (
              <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pegado por</TableHead>
                    <TableHead>Status Final</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className={lead.status === 'archived' ? 'bg-muted/50 text-muted-foreground' : ''}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.contact || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell>{lead.claimedByName || 'N/A'}</TableCell>
                       <TableCell>
                        {lead.finalClientStatus ? <StatusBadge status={lead.finalClientStatus} /> : 
                         lead.deletionReason ? (
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{lead.deletionReason}</p>
                                </TooltipContent>
                            </Tooltip>
                         )
                         : 'N/A'}
                       </TableCell>
                       <TableCell className="text-right">
                           {lead.status === 'available' && (
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setLeadToArchive(lead)}>
                                   <Trash2 className="h-4 w-4" />
                               </Button>
                           )}
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TooltipProvider>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Nenhum lead importado para esta campanha ainda.</p>
                </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     {leadToArchive && adminId && (
        <CampaignLeadArchiveDialog
            isOpen={!!leadToArchive}
            onOpenChange={() => setLeadToArchive(null)}
            lead={leadToArchive}
            adminId={adminId}
            onLeadArchived={onLeadArchived}
        />
    )}
    </>
  );
}
