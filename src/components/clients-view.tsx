

'use client';

import { useState, useMemo, useTransition, useRef, useEffect, useCallback } from 'react';
import { Client, ClientStatus, clientStatuses, ProductCategory, productCategories, RecentSale, MessageTemplate, Tag, Offer, Reminder, Campaign, CampaignLead } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
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
import { ClientForm } from './client-form';
import { StatusBadge } from './status-badge';
import {
  PlusCircle,
  MoreHorizontal,
  Search,
  Trash2,
  Edit,
  MapPin,
  Phone,
  Target,
  ShoppingBag,
  LogOut,
  Upload,
  Download,
  XCircle,
  Clock,
  LayoutGrid,
  BarChart2,
  Users,
  Hand,
  Loader2,
  MessageSquare,
  Tag as TagIcon,
  Flame,
  FileText,
  Bell,
  CheckCircle,
  Megaphone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteClient, updateClientStatus, getClients, getRecentSales, cancelSale, getMessageTemplates, getUnclaimedLeads, claimLead, getTags, updateClientTags, getOffers, getReminders, updateReminderStatus, getCampaignsForUserGroup, getAvailableCampaignLeads, addClient } from '@/app/actions';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Skeleton } from './ui/skeleton';
import { ClientImportDialog } from './client-import-dialog';
import Papa from "papaparse";
import ClientDetailSheet from './client-detail-sheet';
import { DailyBriefing } from './daily-briefing';
import { format, subDays, isBefore, formatDistanceToNow, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SaleValueDialog } from './sale-value-dialog';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SellerPerformanceView } from './seller-performance-view';
import { OfferFeed } from './offer-feed';
import { Badge } from './ui/badge';
import { ProposalFormDialog } from './proposal-form-dialog';
import { ClientDeleteDialog } from './client-delete-dialog';


interface CampaignLeadsTableProps {
    leads: CampaignLead[];
    isLoading: boolean;
    campaign: Campaign;
    onLeadClaimed: (lead: CampaignLead) => void;
}

function CampaignLeadsTable({ leads, isLoading, campaign, onLeadClaimed }: CampaignLeadsTableProps) {
    const [claimingId, setClaimingId] = useState<string | null>(null);

    const handleClaimLead = (lead: CampaignLead) => {
        setClaimingId(lead.id);
        onLeadClaimed(lead);
    }
    
    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    if (leads.length === 0) {
        return <p className="text-center text-muted-foreground text-sm p-4">Nenhum lead disponível nesta campanha no momento.</p>
    }

    return (
        <div className="max-h-60 overflow-y-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.map(lead => (
                        <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" variant="secondary" onClick={() => handleClaimLead(lead)} disabled={claimingId === lead.id}>
                                    {claimingId === lead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pegar Lead"}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function ClientsView() {
  const { user, userProfile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [unclaimedLeads, setUnclaimedLeads] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isLoadingUnclaimed, setIsLoadingUnclaimed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [productFilter, setProductFilter] = useState<ProductCategory | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'updatedAtDesc' | 'updatedAtAsc'>('updatedAtDesc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [clientForProposal, setClientForProposal] = useState<Client | null>(null);

  const [reminders, setReminders] = useState<any[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);

  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [isLoadingRecentSales, setIsLoadingRecentSales] = useState(true);
  const [saleToCancel, setSaleToCancel] = useState<RecentSale | null>(null);
  
  const [saleValueClient, setSaleValueClient] = useState<Client | null>(null);
  
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [availableCampaignLeads, setAvailableCampaignLeads] = useState<Record<string, CampaignLead[]>>({});
  const [isLoadingCampaignLeads, setIsLoadingCampaignLeads] = useState(false);


  const [isPending, startTransition] = useTransition();
  const [isClaiming, startClaimingTransition] = useTransition();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAllData = useCallback(() => {
    if (user?.uid) {
      setIsLoadingClients(true);
      setIsLoadingRecentSales(true);
      setIsLoadingOffers(true);
      
      Promise.all([
        getClients(user.uid),
        getRecentSales(user.uid),
        getMessageTemplates(user.uid),
        getTags(user.uid),
        getOffers(),
        getReminders(user.uid),
      ]).then(([clientsData, salesData, templatesData, tagsData, offersData, remindersData]) => {
        setClients(clientsData);
        setRecentSales(salesData);
        setMessageTemplates(templatesData);
        setTags(tagsData);
        setOffers(offersData);
        setReminders(remindersData);
      }).catch((error) => {
        console.error("Firebase permission error:", error);
        toast({
          variant: "destructive",
          title: "Erro ao buscar dados",
          description: "Verifique as regras de segurança do seu Firestore.",
          duration: 9000,
        });
      }).finally(() => {
        setIsLoadingClients(false);
        setIsLoadingRecentSales(false);
        setIsLoadingOffers(false);
        setIsLoadingReminders(false);
      });
    }
  }, [user?.uid, toast]);
  
  const fetchGroupLeads = useCallback(() => {
    if (userProfile?.groupId) {
        setIsLoadingUnclaimed(true);
        getUnclaimedLeads(userProfile.groupId)
            .then(setUnclaimedLeads)
            .catch(() => toast({ variant: "destructive", title: "Erro", description: "Não foi possível buscar os leads do grupo." }))
            .finally(() => setIsLoadingUnclaimed(false));
    }
  }, [userProfile?.groupId, toast]);

  const fetchCampaignsAndLeads = useCallback(async () => {
    if (userProfile?.groupId) {
        setIsLoadingCampaigns(true);
        setIsLoadingCampaignLeads(true);
        try {
            const userCampaigns = await getCampaignsForUserGroup(userProfile.groupId);
            setCampaigns(userCampaigns);

            const leadsPromises = userCampaigns.map(campaign => getAvailableCampaignLeads(campaign.id));
            const leadsResults = await Promise.all(leadsPromises);
            
            const leadsMap: Record<string, CampaignLead[]> = {};
            userCampaigns.forEach((campaign, index) => {
                leadsMap[campaign.id] = leadsResults[index];
            });
            setAvailableCampaignLeads(leadsMap);

        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível buscar as campanhas e seus leads." });
        } finally {
            setIsLoadingCampaigns(false);
            setIsLoadingCampaignLeads(false);
        }
    }
  }, [userProfile?.groupId, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    fetchGroupLeads();
    fetchCampaignsAndLeads();
  }, [fetchGroupLeads, fetchCampaignsAndLeads]);

  useEffect(() => {
    const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgyLjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/84Qpg36AAAAAABPTUMAAADDZODL+AAAQAAAATE5MDI4MgAAAP/zhCoE/1AAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
    audio.preload = 'auto';
    audioRef.current = audio;
  }, []);
  
  const pendingReminders = useMemo(() => reminders.filter(r => !r.isCompleted), [reminders]);

  const filteredClients = useMemo(() => {
    const filtered = clients
      .filter((client) =>
        statusFilter === 'all' ? true : client.status === statusFilter
      )
      .filter((client) =>
        productFilter === 'all' ? true : client.desiredProduct === productFilter
      )
      .filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

    return filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      if (sortOrder === 'updatedAtAsc') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });
  }, [clients, searchTerm, statusFilter, productFilter, sortOrder]);

  const fifteenDaysAgo = subDays(new Date(), 15);

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };
  
  const handleClientAdded = (newClient: Client) => {
    setClients(prev => [newClient, ...prev]);
    if (newClient.campaignLeadId) {
      setAvailableCampaignLeads(prev => {
        const campaignId = newClient.campaignId!;
        const updatedLeads = (prev[campaignId] || []).filter(lead => lead.id !== newClient.campaignLeadId);
        return { ...prev, [campaignId]: updatedLeads };
      });
    }
  };

  const handleClientUpdated = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
  };
  
  const handleClientsImported = (importedClients: Client[]) => {
      setClients(prev => [...importedClients, ...prev]);
  };

  const handleDeleteConfirmed = (clientToDelete: Client, reason?: string) => {
    if (!clientToDelete || !user) return;

    startTransition(async () => {
      const result = await deleteClient(clientToDelete.id, user.uid, reason);
      if (result.success) {
        toast({
          title: "Cliente deletado!",
          description: `${clientToDelete.name} foi removido com sucesso.`,
        });
        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        setClientToDelete(null);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao deletar",
          description: result.error,
        });
      }
    });
  };

  const handleStatusChange = (client: Client, newStatus: ClientStatus) => {
      if (newStatus === 'Fechado') {
          setSaleValueClient(client);
      } else {
          startTransition(async () => {
              if (!user) return;
              const result = await updateClientStatus(client.id, newStatus, user.uid);
              if(result.success) {
                  toast({ title: 'Status atualizado!', description: `O status de ${client.name} foi alterado para ${newStatus}.`});
                  setClients(prev => prev.map(c => c.id === client.id ? {...c, status: newStatus, updatedAt: new Date().toISOString()} : c));
              } else {
                  toast({ variant: 'destructive', title: 'Erro', description: result.error });
              }
          });
      }
  };
  
  const handleConfirmSale = (value: number, productInfo: string) => {
    if (!saleValueClient || !user) return;
    startTransition(async () => {
        const result = await updateClientStatus(saleValueClient.id, 'Fechado', user.uid, value, productInfo);
        if(result.success) {
            toast({ title: 'Venda registrada!', description: `Venda para ${saleValueClient.name} registrada com sucesso.`});
            setClients(prev => prev.map(c => c.id === saleValueClient.id ? {...c, status: 'Fechado', updatedAt: new Date().toISOString()} : c));
            setSaleValueClient(null);
            // Play sound effect
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.error("Error playing audio:", e));
            }
        } else {
            toast({ variant: 'destructive', title: 'Erro ao registrar venda', description: result.error });
        }
    });
  }

  const handleExport = () => {
    if (clients.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum cliente para exportar",
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
    link.setAttribute("download", "meus_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportação iniciada!", description: "Seu arquivo CSV será baixado." });
  };
  
  const handleLogout = async () => {
      await signOut(auth);
      // router is available because this is a client component
  }

  const handleViewDetails = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsDetailSheetOpen(true);
  }
  
  const handleDetailSheetOpenChange = (open: boolean) => {
      if (!open) {
          setSelectedClientId(null);
      }
      setIsDetailSheetOpen(open);
  }
  
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  const handleCancelSale = () => {
    if (!saleToCancel || !user) return;
    startTransition(async () => {
        const result = await cancelSale(saleToCancel.id, user.uid);
        if (result.success && result.updatedClient) {
            toast({ title: 'Venda Cancelada', description: `A venda para ${saleToCancel.clientName} foi cancelada.` });
            setRecentSales(prev => prev.filter(s => s.id !== saleToCancel.id));
            handleClientUpdated(result.updatedClient);
            setSaleToCancel(null);
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
    });
  }
  
  const handleTagChange = (client: Client, tagId: string, isChecked: boolean) => {
      if (!user) return;
      startTransition(async () => {
          const currentTags = client.tagIds || [];
          const newTags = isChecked ? [...currentTags, tagId] : currentTags.filter(id => id !== tagId);
          const result = await updateClientTags(client.id, newTags, user.uid);
          if (result.success) {
              setClients(prev => prev.map(c => c.id === client.id ? { ...c, tagIds: newTags, updatedAt: new Date().toISOString() } : c));
              toast({ title: "Tags atualizadas!" });
          } else {
              toast({ variant: "destructive", title: "Erro", description: result.error });
          }
      });
  }

  const onOfferCreated = (newOffer: Offer) => {
      setOffers(prev => [newOffer, ...prev]);
      toast({ title: "Oferta enviada para aprovação!" });
  }

  const onOfferLiked = (offerId: string, newLikedBy: string[]) => {
      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, likedBy: newLikedBy } : o));
  }
  
  const handleToggleReminder = (reminderId: string, isCompleted: boolean) => {
      const reminderToUpdate = reminders.find(r => r.id === reminderId);
      if(!reminderToUpdate || !user) return;
      
      startTransition(async () => {
          const result = await updateReminderStatus(reminderToUpdate.clientId, reminderId, isCompleted, user.uid);
          if (result.success && result.client) {
              toast({ title: "Lembrete atualizado!" });
              handleClientUpdated(result.client);
              // Optimistically update reminders list
              setReminders(prev => prev.map(r => r.id === reminderId ? {...r, isCompleted} : r));
          } else {
              toast({ variant: "destructive", title: "Erro", description: result.error });
          }
      });
  }
  
  const handleOpenProposalDialog = (client: Client) => {
      setIsDetailSheetOpen(false); // Close details
      setTimeout(() => setClientForProposal(client), 150); // Open new dialog after a short delay
  }

  const handleClaimLead = (lead: Client) => {
      if (!user?.uid || !userProfile?.name) return;
      startClaimingTransition(async () => {
          const result = await claimLead(lead.id, user.uid, userProfile.name);
          if (result.success && result.client) {
              setUnclaimedLeads(prev => prev.filter(l => l.id !== lead.id));
              setClients(prev => [result.client, ...prev]);
              toast({ title: "Lead pego com sucesso!" });
          } else {
              toast({ variant: "destructive", title: "Erro ao pegar lead", description: result.error });
          }
      });
  }

  const handleClaimCampaignLead = (lead: CampaignLead) => {
        if (!user || !userProfile) return;

        const campaign = campaigns.find(c => c.id === lead.campaignId);
        if (!campaign) {
            toast({ variant: "destructive", title: "Erro", description: "Campanha não encontrada." });
            return;
        }

        startClaimingTransition(async () => {
            const remarketingText = campaign.script ? campaign.script.replace(/<cliente>/g, lead.name) : '';
            const result = await addClient({
                name: lead.name,
                city: lead.city || 'Não informado',
                contact: lead.contact || 'Não informado',
                desiredProduct: "Outros", // Or get from campaign if available
                lastProductBought: '',
                status: "Novo Lead",
                remarketingReminder: remarketingText,
                tagIds: campaign.defaultTagId ? [campaign.defaultTagId] : [],
                campaignId: campaign.id,
                campaignLeadId: lead.id,
            }, user.uid);

            if (result.success) {
                toast({ title: "Lead pego com sucesso!" });
                fetchAllData();
                fetchCampaignsAndLeads();
            } else {
                toast({ variant: "destructive", title: "Erro ao pegar lead", description: result.error?.formErrors?.join(', ') || result.error?.fieldErrors?.contact?.[0] || 'Ocorreu um erro.' });
            }
        });
    }

  return (
    <div className="flex-1 flex flex-col w-full">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                    <Target className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-bold text-foreground">
                        LeadTrack
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleAddClient} size="sm" className="px-3">
                        <PlusCircle className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Adicionar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="px-3">
                      <Upload className="h-4 w-4 md:mr-2"/>
                      <span className="hidden md:inline">Importar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="px-3">
                      <Download className="h-4 w-4 md:mr-2"/>
                       <span className="hidden md:inline">Exportar</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="clientes" className="w-full">
             <TabsList className="grid w-full grid-cols-5 max-w-4xl mx-auto mb-6 h-auto">
                <TabsTrigger value="clientes" className="flex-col md:flex-row h-auto py-2 md:py-1.5 gap-1">
                    <LayoutGrid className="h-5 w-5" />
                    <span className="hidden sm:inline">Clientes</span>
                    <Badge variant="secondary" className="ml-0 sm:ml-2 rounded-full">{filteredClients.length}</Badge>
                </TabsTrigger>
                 <TabsTrigger value="offers" className="flex-col md:flex-row h-auto py-2 md:py-1.5 gap-1">
                    <Flame className="h-5 w-5" />
                    <span className="hidden sm:inline">Ofertas</span>
                     <Badge
                        variant={offers.length > 0 ? 'default' : 'secondary'}
                        className="ml-0 sm:ml-2 rounded-full"
                    >
                        {offers.length}
                    </Badge>
                </TabsTrigger>
                <TabsTrigger value="reminders" className="flex-col md:flex-row h-auto py-2 md:py-1.5 gap-1">
                    <Bell className="h-5 w-5" />
                    <span className="hidden sm:inline">Lembretes</span>
                     <Badge
                        variant={pendingReminders.length > 0 ? 'default' : 'secondary'}
                        className="ml-0 sm:ml-2 rounded-full"
                    >
                        {pendingReminders.length}
                    </Badge>
                </TabsTrigger>
                <TabsTrigger value="campaigns" disabled={campaigns.length === 0} className="flex-col md:flex-row h-auto py-2 md:py-1.5 gap-1">
                    <Megaphone className="h-5 w-5" />
                    <span className="hidden sm:inline">Campanhas</span>
                    {campaigns.length > 0 && (
                        <Badge
                            variant='default'
                            className="ml-0 sm:ml-2 rounded-full"
                        >
                            {campaigns.length}
                        </Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="resultados" className="flex-col md:flex-row h-auto py-2 md:py-1.5 gap-1">
                    <BarChart2 className="h-5 w-5" />
                    <span className="hidden sm:inline">Resultados</span>
                </TabsTrigger>
            </TabsList>

            <TabsContent value="clientes" className="space-y-8">
                <div>
                    <DailyBriefing />
                </div>
                
                <div className="space-y-4">
                    <h2 className="text-2xl md:text-3xl font-bold">Seus Clientes</h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                            placeholder="Pesquisar por nome..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select
                            value={sortOrder}
                            onValueChange={(value) => setSortOrder(value as 'updatedAtDesc' | 'updatedAtAsc')}
                        >
                            <SelectTrigger className="w-full md:w-[240px]">
                            <SelectValue placeholder="Ordenar por..." />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="updatedAtDesc">Atualizações mais recentes</SelectItem>
                            <SelectItem value="updatedAtAsc">Atualizações mais antigas</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as ClientStatus | 'all')}
                        >
                            <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Filtrar por status" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            {clientStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                {status}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={productFilter}
                            onValueChange={(value) => setProductFilter(value as ProductCategory | 'all')}
                        >
                            <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Filtrar por produto" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">Todos os Produtos</SelectItem>
                            {productCategories.map((product) => (
                                <SelectItem key={product} value={product}>
                                {product}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {isLoadingClients ? (
                    <div className="w-full space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block">
                            <Card>
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Cidade</TableHead>
                                        <TableHead>Contato</TableHead>
                                        <TableHead>Última Atualização</TableHead>
                                        <TableHead>Produto Desejado</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {filteredClients.map((client) => {
                                        const isInactive = client.updatedAt &&
                                                        isBefore(new Date(client.updatedAt), fifteenDaysAgo) &&
                                                        (client.status === 'Novo Lead' || client.status === 'Em negociação');
                                        const clientTags = tags.filter(tag => client.tagIds?.includes(tag.id));
                                        return (
                                        <TableRow 
                                            key={client.id} 
                                            onClick={() => handleViewDetails(client.id)}
                                            className={cn("cursor-pointer", isInactive && "bg-red-100/50 dark:bg-red-900/20 hover:bg-red-100/70 dark:hover:bg-red-900/30 text-red-900 dark:text-red-200")}
                                        >
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col gap-1">
                                                <span>{client.name}</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {clientTags.map(tag => (
                                                        <Badge key={tag.id} variant="secondary" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40`}} className="font-normal">
                                                            {tag.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{client.city}</TableCell>
                                        <TableCell>{client.contact}</TableCell>
                                        <TableCell>
                                            {client.updatedAt ? formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true, locale: ptBR }) : '-'}
                                        </TableCell>
                                        <TableCell>{client.desiredProduct}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={client.status} />
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => handleEditClient(client)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setClientForProposal(client)}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    <span>Gerar Proposta</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>Mudar Status</DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuSubContent>
                                                    {clientStatuses.map((status) => (
                                                        <DropdownMenuItem
                                                        key={status}
                                                        onSelect={() => handleStatusChange(client, status)}
                                                        >
                                                        {status}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <TagIcon className="mr-2 h-4 w-4" />
                                                        <span>Mudar Tags</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                        {tags.map((tag) => (
                                                            <DropdownMenuCheckboxItem
                                                            key={tag.id}
                                                            checked={client.tagIds?.includes(tag.id)}
                                                            onCheckedChange={(isChecked) => handleTagChange(client, tag.id, !!isChecked)}
                                                            >
                                                            {tag.name}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                        {tags.length === 0 && <DropdownMenuItem disabled>Nenhuma tag criada.</DropdownMenuItem>}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onSelect={() => setClientToDelete(client)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Deletar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        </TableRow>
                                    )})}
                                    </TableBody>
                                </Table>
                                {filteredClients.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground p-8">Nenhum cliente encontrado.</p>
                                )}
                            </Card>
                        </div>

                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredClients.map((client) => {
                                const isInactive = client.updatedAt &&
                                                isBefore(new Date(client.updatedAt), fifteenDaysAgo) &&
                                                (client.status === 'Novo Lead' || client.status === 'Em negociação');
                                const clientTags = tags.filter(tag => client.tagIds?.includes(tag.id));
                                return (
                                <Card key={client.id} className={cn(isInactive && "bg-red-100/50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 text-red-900 dark:text-red-200")}>
                                    <CardHeader onClick={() => handleViewDetails(client.id)}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{client.name}</CardTitle>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {clientTags.map(tag => (
                                                        <Badge key={tag.id} variant="secondary" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40`}} className="font-normal">
                                                            {tag.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 -mr-2 -mt-2" disabled={isPending} onClick={(e) => e.stopPropagation()}>
                                                <span className="sr-only">Abrir menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenuItem onSelect={() => handleEditClient(client)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setClientForProposal(client)}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    <span>Gerar Proposta</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>Mudar Status</DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuSubContent>
                                                    {clientStatuses.map((status) => (
                                                        <DropdownMenuItem
                                                        key={status}
                                                        onSelect={() => handleStatusChange(client, status)}
                                                        >
                                                        {status}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                 <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <TagIcon className="mr-2 h-4 w-4" />
                                                        <span>Mudar Tags</span>
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                            {tags.map((tag) => (
                                                                <DropdownMenuCheckboxItem
                                                                key={tag.id}
                                                                checked={client.tagIds?.includes(tag.id)}
                                                                onCheckedChange={(isChecked) => handleTagChange(client, tag.id, !!isChecked)}
                                                                >
                                                                {tag.name}
                                                                </DropdownMenuCheckboxItem>
                                                            ))}
                                                            {tags.length === 0 && <DropdownMenuItem disabled>Nenhuma tag criada.</DropdownMenuItem>}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                                </DropdownMenuSub>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onSelect={() => setClientToDelete(client)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Deletar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm" onClick={() => handleViewDetails(client.id)}>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            <span>{client.city}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <Phone className="h-4 w-4" />
                                            <span>{client.contact}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <ShoppingBag className="h-4 w-4" />
                                            <span>{client.desiredProduct}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>
                                                Última atualização: {client.updatedAt ? formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true, locale: ptBR }) : '-'}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                                )})}
                            {filteredClients.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground p-8">Nenhum cliente encontrado.</p>
                                )}
                        </div>
                    </>
                )}
            </TabsContent>

            <TabsContent value="offers">
                <OfferFeed 
                    offers={offers} 
                    isLoading={isLoadingOffers}
                    onOfferCreated={onOfferCreated}
                    onOfferLiked={onOfferLiked}
                    currentUserId={user?.uid || ''}
                    currentUserProfile={userProfile}
                    clients={clients}
                />
            </TabsContent>
            
            <TabsContent value="reminders">
                <Card>
                    <CardHeader>
                        <CardTitle>Lembretes Pendentes</CardTitle>
                        <CardDescription>Todas as suas tarefas e lembretes que ainda não foram concluídos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingReminders ? <Skeleton className="h-20 w-full" /> : 
                         pendingReminders.length === 0 ? <p className="text-center text-muted-foreground text-sm p-8">Você não tem lembretes pendentes. 🎉</p> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Lembrete</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingReminders.map((reminder) => (
                                        <TableRow key={reminder.id} className={cn(isPast(parseISO(reminder.reminderDate)) && 'bg-destructive/10')}>
                                            <TableCell className="font-medium">{reminder.clientName}</TableCell>
                                            <TableCell>{reminder.text}</TableCell>
                                            <TableCell>{format(parseISO(reminder.reminderDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleToggleReminder(reminder.clientId, reminder.id, true)}>
                                                    <CheckCircle className="mr-2 h-4 w-4"/>
                                                    Concluir
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         )
                        }
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="campaigns">
                <Card>
                    <CardHeader>
                        <CardTitle>Campanhas Ativas</CardTitle>
                        <CardDescription>Veja as campanhas disponíveis para o seu grupo e pegue novos leads para trabalhar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingCampaigns ? <Skeleton className="h-40" /> : 
                         campaigns.length === 0 ? <p className="text-center text-muted-foreground">Nenhuma campanha ativa para seu grupo no momento.</p> : (
                            <Accordion type="single" collapsible className="w-full">
                                {campaigns.map(campaign => (
                                    <AccordionItem value={campaign.id} key={campaign.id}>
                                        <AccordionTrigger>
                                            <div className='flex justify-between items-center w-full'>
                                                <span>{campaign.name}</span>
                                                <Badge variant="secondary">
                                                    {(availableCampaignLeads[campaign.id] || []).length} leads disponíveis
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-4">
                                                <p className="text-sm text-muted-foreground">{campaign.description}</p>
                                                <CampaignLeadsTable
                                                    campaign={campaign}
                                                    leads={availableCampaignLeads[campaign.id] || []}
                                                    isLoading={isLoadingCampaignLeads}
                                                    onLeadClaimed={handleClaimCampaignLead}
                                                />
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                         )
                        }
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="resultados">
                <SellerPerformanceView />
            </TabsContent>
        </Tabs>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t">
        Desenvolvido por Daniel Carvalho
      </footer>

      {isFormOpen && <ClientForm isOpen={isFormOpen} onOpenChange={setIsFormOpen} client={editingClient} onClientAdded={handleClientAdded} onClientUpdated={handleClientUpdated} availableTags={tags} />}
      <ClientImportDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} onClientsImported={handleClientsImported} />
      {selectedClient && <ClientDetailSheet isOpen={isDetailSheetOpen} onOpenChange={handleDetailSheetOpenChange} client={selectedClient} templates={messageTemplates} tags={tags} onClientUpdated={handleClientUpdated} onOpenProposalDialog={handleOpenProposalDialog} onStatusChange={handleStatusChange} />}
      
      {clientForProposal && <ProposalFormDialog isOpen={!!clientForProposal} onOpenChange={() => setClientForProposal(null)} client={clientForProposal} />}

      <SaleValueDialog
        isOpen={!!saleValueClient}
        onOpenChange={() => setSaleValueClient(null)}
        onConfirm={handleConfirmSale}
        isPending={isPending}
      />
      
      {clientToDelete && <ClientDeleteDialog 
        isOpen={!!clientToDelete}
        onOpenChange={() => setClientToDelete(null)}
        client={clientToDelete}
        onConfirmDelete={handleDeleteConfirmed}
        isPending={isPending}
      />}

      {/* Legacy AlertDialog - Keep for sale cancellation */}
      <AlertDialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Cancelar a Venda?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. O status do cliente "{saleToCancel?.clientName}" será revertido para "Pós-venda" e o registro desta venda será removido.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSaleToCancel(null)}>Manter Venda</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleCancelSale} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Cancelar Venda"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
