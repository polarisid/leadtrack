
'use client';

import { useState, useMemo, useTransition, useRef, useEffect, useCallback } from 'react';
import { Client, ClientStatus, clientStatuses, ProductCategory, productCategories, RecentSale } from '@/lib/types';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteClient, updateClientStatus, getClients, getRecentSales, cancelSale } from '@/app/actions';
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
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { Skeleton } from './ui/skeleton';
import { ClientImportDialog } from './client-import-dialog';
import Papa from "papaparse";
import ClientDetailSheet from './client-detail-sheet';
import { SalesTipsCarousel } from './sales-tips-carousel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SaleValueDialog } from './sale-value-dialog';


export function ClientsView() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [productFilter, setProductFilter] = useState<ProductCategory | 'all'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);

  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [isLoadingRecentSales, setIsLoadingRecentSales] = useState(true);
  const [saleToCancel, setSaleToCancel] = useState<RecentSale | null>(null);
  
  const [saleValueClient, setSaleValueClient] = useState<Client | null>(null);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchAllClients = useCallback(() => {
    if (user?.uid) {
      setIsLoadingClients(true);
      getClients(user.uid)
        .then(setClients)
        .catch((error) => {
          console.error("Firebase permission error:", error);
          toast({
            variant: "destructive",
            title: "Erro ao buscar clientes",
            description: "Verifique as regras de segurança do seu Firestore.",
            duration: 9000,
          });
        })
        .finally(() => setIsLoadingClients(false));
    }
  }, [user?.uid, toast]);

  const fetchAllRecentSales = useCallback(() => {
     if (user?.uid) {
      setIsLoadingRecentSales(true);
      getRecentSales(user.uid)
        .then(setRecentSales)
        .catch((error) => {
          toast({
            variant: "destructive",
            title: "Erro ao buscar vendas recentes",
            description: error.message,
          });
        })
        .finally(() => setIsLoadingRecentSales(false));
    }
  }, [user?.uid, toast]);

  useEffect(() => {
    fetchAllClients();
    fetchAllRecentSales();
  }, [fetchAllClients, fetchAllRecentSales]);

  useEffect(() => {
    const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgyLjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/84Qpg36AAAAAABPTUMAAADDZODL+AAAQAAAATE5MDI4MgAAAP/zhCoE/1AAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
    audio.preload = 'auto';
    audioRef.current = audio;
  }, []);

  const filteredClients = useMemo(() => {
    return clients
      .filter((client) =>
        statusFilter === 'all' ? true : client.status === statusFilter
      )
       .filter((client) =>
        productFilter === 'all' ? true : client.desiredProduct === productFilter
      )
      .filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [clients, searchTerm, statusFilter, productFilter]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);
  
  const handleAddClient = useCallback(() => {
    setEditingClient(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClient = useCallback((client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  }, []);
  
  const handleViewDetails = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setIsDetailSheetOpen(true);
  }, []);

  const handleDetailSheetOpenChange = useCallback((isOpen: boolean) => {
    setIsDetailSheetOpen(isOpen);
    if (!isOpen) {
      setSelectedClientId(null);
    }
  }, []);


  const handleStatusChange = (client: Client, newStatus: ClientStatus) => {
    if (!user) return;

    if (newStatus === 'Fechado') {
        setSaleValueClient(client);
    } else {
        startTransition(async () => {
            const originalClients = [...clients];
            setClients(prev => prev.map(c => c.id === client.id ? {...c, status: newStatus} : c));

            const result = await updateClientStatus(client.id, newStatus, user.uid);
            if (result.success) {
                toast({ title: 'Status atualizado com sucesso!' });
            } else {
                setClients(originalClients);
                toast({ variant: 'destructive', title: 'Erro ao atualizar status.', description: result.error || "Verifique suas permissões no Firestore." });
            }
        });
    }
  };

  const handleConfirmSale = (saleValue: number) => {
    if (!saleValueClient || !user) return;

    startTransition(async () => {
        const originalClients = [...clients];
        const clientId = saleValueClient.id;

        setClients(prev => prev.map(c => c.id === clientId ? {...c, status: 'Fechado'} : c));
        setSaleValueClient(null);

        const result = await updateClientStatus(clientId, 'Fechado', user.uid, saleValue);

        if (result.success) {
            toast({ title: 'Venda registrada com sucesso!' });
            if (audioRef.current) {
                audioRef.current.play().catch(e => console.error("Error playing audio:", e));
            }
            fetchAllRecentSales();
        } else {
            setClients(originalClients);
            toast({ variant: 'destructive', title: 'Erro ao registrar venda.', description: result.error });
        }
    });
  };

  const handleDeleteClient = useCallback((id: string) => {
    if (!user) return;
    startTransition(async () => {
        const originalClients = [...clients];
        setClients(prevClients => prevClients.filter(c => c.id !== id));

        const result = await deleteClient(id, user.uid);
        if(result.success) {
            toast({ title: 'Cliente deletado com sucesso!' });
        } else {
            setClients(originalClients);
            toast({ variant: 'destructive', title: 'Erro ao deletar cliente.', description: result.error || "Verifique suas permissões no Firestore." });
        }
    })
  }, [user, clients, toast]);
  
  const handleClientAdded = useCallback((newClient: Client) => {
    setClients(prevClients => [newClient, ...prevClients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const handleClientUpdated = useCallback((updatedClient: Client) => {
      setClients(prevClients => 
          prevClients.map(c => c.id === updatedClient.id ? {...c, ...updatedClient} : c)
      );
  }, []);

  const handleClientsImported = useCallback((newClients: Client[]) => {
    setClients(prevClients => [...newClients, ...prevClients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const handleExport = useCallback(() => {
    if (filteredClients.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum cliente para exportar",
        description: "A exportação reflete os filtros aplicados na tela.",
      });
      return;
    }

    const dataToExport = filteredClients.map(client => ({
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
    link.setAttribute("download", "clientes_exportados.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exportação iniciada!", description: "Seu arquivo será baixado em breve." });
  }, [filteredClients, toast]);

  const handleCancelSale = () => {
    if (!saleToCancel || !user) return;
    startTransition(async () => {
      const result = await cancelSale(saleToCancel.id, user.uid);
      if (result.success && result.updatedClient) {
        toast({ title: 'Venda cancelada com sucesso!' });
        setRecentSales(prev => prev.filter(s => s.id !== saleToCancel.id));
        handleClientUpdated(result.updatedClient);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao cancelar venda.', description: result.error });
      }
      setSaleToCancel(null);
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
  };


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
                    <Button onClick={handleAddClient} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adicionar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
                      <Upload className="mr-2 h-4 w-4"/>
                      Importar
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="mr-2 h-4 w-4"/>
                      Exportar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <SalesTipsCarousel />
        </div>

        <Accordion type="single" collapsible className="w-full mb-8">
          <AccordionItem value="recent-sales" className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <AccordionTrigger className="p-6 hover:no-underline w-full">
                <div className="flex w-full justify-between items-center">
                    <div className="text-left">
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" />
                            Últimas Vendas
                        </CardTitle>
                        <CardDescription className="pt-2">
                           Clique para ver suas últimas 10 vendas.
                        </CardDescription>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-6 pb-6 pt-0">
                  {isLoadingRecentSales ? (
                      <div className="space-y-2">
                          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                  ) : recentSales.length > 0 ? (
                      <ul className="space-y-3">
                          {recentSales.map((sale) => (
                              <li key={sale.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                  <div className="text-sm">
                                      <p className="font-medium">{sale.clientName} - <span className="text-green-600 font-semibold">{sale.saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                                      <p className="text-muted-foreground">
                                          {format(new Date(sale.saleDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                      </p>
                                  </div>
                                  <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setSaleToCancel(sale)}
                                      disabled={isPending}
                                  >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancelar
                                  </Button>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <p className="text-center text-muted-foreground p-4">Nenhuma venda recente encontrada.</p>
                  )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        <div className="mb-6 space-y-4">
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
                                <TableHead>Produto Desejado</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {filteredClients.map((client) => (
                                <TableRow key={client.id} onClick={() => handleViewDetails(client.id)} className="cursor-pointer">
                                <TableCell className="font-medium">{client.name}</TableCell>
                                <TableCell>{client.city}</TableCell>
                                <TableCell>{client.contact}</TableCell>
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
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onSelect={() => setClientToDelete(client)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4"/>
                                            Deletar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        {filteredClients.length === 0 && (
                             <div className="text-center p-8 text-muted-foreground">
                                Nenhum cliente encontrado.
                            </div>
                        )}
                    </Card>
                </div>

                <div className="grid gap-4 md:hidden">
                    {filteredClients.map((client) => (
                        <Card key={client.id} onClick={() => handleViewDetails(client.id)} className="cursor-pointer">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                     <div>
                                        <CardTitle>{client.name}</CardTitle>
                                        <StatusBadge status={client.status} className="mt-2" />
                                    </div>
                                   
                                    <div onClick={(e) => e.stopPropagation()}>
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
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onSelect={() => setClientToDelete(client)}
                                          >
                                              <Trash2 className="mr-2 h-4 w-4"/>
                                              Deletar
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="h-4 w-4"/>
                                    <span>{client.city}</span>
                                </div>
                                 <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4"/>
                                    <span>{client.contact}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <ShoppingBag className="h-4 w-4"/>
                                    <span>{client.desiredProduct}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                     {filteredClients.length === 0 && (
                             <div className="text-center p-8 text-muted-foreground">
                                Nenhum cliente encontrado.
                            </div>
                        )}
                </div>
            </>
        )}
      </main>

      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        Desenvolvido por Daniel Carvalho
      </footer>

      <ClientForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onClientAdded={handleClientAdded}
        onClientUpdated={handleClientUpdated}
      />

      <ClientImportDialog 
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        onClientsImported={handleClientsImported}
      />

      <ClientDetailSheet
        isOpen={isDetailSheetOpen}
        onOpenChange={handleDetailSheetOpenChange}
        client={selectedClient}
      />
      
      <SaleValueDialog
        isOpen={!!saleValueClient}
        onOpenChange={(open) => !open && setSaleValueClient(null)}
        onConfirm={handleConfirmSale}
        isPending={isPending}
      />

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
                Essa ação não pode ser desfeita. Isso irá deletar permanentemente o cliente.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={() => {
                    if (clientToDelete) {
                        handleDeleteClient(clientToDelete.id);
                    }
                    setClientToDelete(null);
                }} 
                className="bg-destructive hover:bg-destructive/90">
                Deletar
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!saleToCancel} onOpenChange={(open) => !open && setSaleToCancel(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Venda?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. O status do cliente "{saleToCancel?.clientName}" será revertido para "Pós-venda" e o registro desta venda será removido.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSaleToCancel(null)}>Manter Venda</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleCancelSale}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}
            >
                {isPending ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
