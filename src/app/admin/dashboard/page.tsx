
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogOut, ShieldCheck, Users, AlertCircle, MoreHorizontal, Edit, KeyRound, Trash2, UserCheck, UserX, DollarSign, Target, BarChart3, Trophy, TrendingUp, TrendingDown, Minus, Repeat, Percent, PlusCircle, Users2, CreditCard, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUsersForAdmin, sendPasswordResetForUser, deleteUserRecord, updateUserStatus, getDashboardAnalytics, getSellerAnalytics, getGroups, createGroup, deleteGroup } from '@/app/actions';
import { UserProfile, UserStatus, DashboardAnalyticsData, SellerAnalytics, ClientStatus, AnalyticsPeriod, Group } from '@/lib/types';
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
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UserEditDialog } from '@/components/admin/user-edit-dialog';
import { UserGroupDialog } from '@/components/admin/user-group-dialog';
import { GroupEditDialog } from '@/components/admin/group-edit-dialog';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';


const chartConfig = {
  leads: {
    label: "Novos Leads",
    color: "hsl(var(--primary))",
  },
  sales: {
    label: "Vendas",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const ComparisonText = ({ value }: { value: number | undefined }) => {
  if (value === undefined || !isFinite(value)) {
    return (
      <p className="text-xs text-muted-foreground flex items-center">
        --
      </p>
    );
  }
  
  const isPositive = value > 0;
  const isNegative = value < 0;

  if (value === 0) {
    return (
      <p className="text-xs text-muted-foreground flex items-center">
        <Minus className="mr-1 h-4 w-4" />
        sem alteração
      </p>
    );
  }

  return (
    <p className={cn(
      "text-xs font-medium flex items-center",
      isPositive && "text-emerald-600",
      isNegative && "text-red-600",
    )}>
      {isPositive && <TrendingUp className="mr-1 h-4 w-4" />}
      {isNegative && <TrendingDown className="mr-1 h-4 w-4" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}% na última semana
    </p>
  );
};


export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  
  const [sellerAnalytics, setSellerAnalytics] = useState<SellerAnalytics[]>([]);
  const [isSellerAnalyticsLoading, setIsSellerAnalyticsLoading] = useState(true);
  const [sellerAnalyticsError, setSellerAnalyticsError] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('total');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [userGroupFilter, setUserGroupFilter] = useState<string>('all');
  const [overviewGroupFilter, setOverviewGroupFilter] = useState<string>('all');


  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const [userForGroupAssignment, setUserForGroupAssignment] = useState<UserProfile | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);

  const fetchUsers = () => {
    if (!user) return;
    setIsLoadingUsers(true);
    setUsersError(null);
    getUsersForAdmin(user.uid, userGroupFilter === 'all' ? null : userGroupFilter)
      .then((data) => setUsers(data))
      .catch((err) => {
        setUsersError(err.message || 'Ocorreu um erro ao buscar os usuários.');
        toast({ variant: "destructive", title: "Erro de Usuários", description: "Não foi possível carregar a lista de usuários." })
      })
      .finally(() => setIsLoadingUsers(false));
  };
  
  const fetchDashboardAnalytics = () => {
     if (!user) return;
     setIsAnalyticsLoading(true);
     setAnalyticsError(null);
     getDashboardAnalytics(user.uid, overviewGroupFilter === 'all' ? null : overviewGroupFilter)
       .then(setAnalyticsData)
       .catch((err) => {
         setAnalyticsError(err.message || 'Ocorreu um erro ao buscar os dados do painel.');
         toast({ variant: "destructive", title: "Erro de Dados", description: "Não foi possível carregar as métricas." })
       })
       .finally(() => setIsAnalyticsLoading(false));
  }

  const fetchSellerAnalytics = () => {
     if (!user) return;
     setIsSellerAnalyticsLoading(true);
     setSellerAnalyticsError(null);
     getSellerAnalytics(user.uid, analyticsPeriod, groupFilter === 'all' ? null : groupFilter)
       .then(setSellerAnalytics)
       .catch((err) => {
         setSellerAnalyticsError(err.message || 'Ocorreu um erro ao buscar os dados por vendedor.');
         toast({ variant: "destructive", title: "Erro de Análise", description: "Não foi possível carregar os dados por vendedor." });
       })
       .finally(() => setIsSellerAnalyticsLoading(false));
  }

  const fetchGroups = () => {
    if (!user) return;
    setIsLoadingGroups(true);
    setGroupsError(null);
    getGroups(user.uid)
      .then(setGroups)
      .catch((err) => {
        setGroupsError(err.message || 'Ocorreu um erro ao buscar os grupos.');
        toast({ variant: 'destructive', title: 'Erro de Grupos', description: 'Não foi possível carregar os grupos de vendedores.' });
      })
      .finally(() => setIsLoadingGroups(false));
  };

  useEffect(() => {
    if (user?.uid) {
        fetchGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
        fetchDashboardAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, overviewGroupFilter]);


  useEffect(() => {
    if (user?.uid) {
        fetchUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userGroupFilter]);

  useEffect(() => {
    if(user?.uid) {
        fetchSellerAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, analyticsPeriod, groupFilter]);


  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handleOpenEdit = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit);
    setIsEditUserOpen(true);
  };
  
  const handleOpenGroupDialog = (userToAssign: UserProfile) => {
    setUserForGroupAssignment(userToAssign);
    setIsGroupDialogOpen(true);
  }

   const handleOpenGroupEdit = (groupToEdit: Group) => {
    setEditingGroup(groupToEdit);
    setIsEditGroupOpen(true);
  };
  
  const onDataUpdated = () => {
    fetchGroups();
    fetchUsers();
    fetchDashboardAnalytics();
    fetchSellerAnalytics();
  };
  
  const handleSendPasswordReset = (email: string) => {
    startTransition(async () => {
      if (!user) return;
      const result = await sendPasswordResetForUser(email, user.uid);
      if (result.success) {
        toast({ title: 'Sucesso!', description: `E-mail de redefinição de senha enviado para ${email}.` });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  const handleDeleteUser = () => {
    if (!userToDelete || !user) return;
    startTransition(async () => {
      const result = await deleteUserRecord(userToDelete.id, user.uid);
      if (result.success) {
        toast({ title: 'Sucesso!', description: `O registro de ${userToDelete.name} foi deletado.` });
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
      setUserToDelete(null);
    });
  };

  const handleToggleStatus = (userToUpdate: UserProfile) => {
    if (!user) return;
    const newStatus: UserStatus = userToUpdate.status === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? 'ativado' : 'inativado';

    startTransition(async () => {
      const result = await updateUserStatus(userToUpdate.id, newStatus, user.uid);
      if (result.success) {
        toast({ title: 'Sucesso!', description: `Usuário ${userToUpdate.name} foi ${actionText}.` });
        setUsers(prev => prev.map(u => u.id === userToUpdate.id ? {...u, status: newStatus} : u));
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

   const handleCreateGroup = () => {
    if (!newGroupName.trim() || !user) return;
    startTransition(async () => {
      const result = await createGroup(newGroupName, user.uid);
      if (result.success) {
        toast({ title: 'Sucesso!', description: `Grupo "${newGroupName}" criado.` });
        setNewGroupName('');
        fetchGroups();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  const handleDeleteGroup = () => {
    if (!groupToDelete || !user) return;
    startTransition(async () => {
      const result = await deleteGroup(groupToDelete.id, user.uid);
      if (result.success) {
        toast({ title: 'Sucesso!', description: `Grupo "${groupToDelete.name}" deletado.` });
        fetchGroups();
        fetchUsers();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
      setGroupToDelete(null);
    });
  };

  const renderUsersContent = () => {
    if (isLoadingUsers) {
      return (
        <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (usersError) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro ao Carregar Usuários</AlertTitle>
                <AlertDescription>{usersError}</AlertDescription>
            </Alert>
        );
    }
    
    if (users.length === 0) {
        return <p className="text-muted-foreground text-center">Nenhum usuário encontrado para o filtro selecionado.</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data de Cadastro</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const groupName = groups.find(g => g.id === u.groupId)?.name || 'Sem grupo';
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{groupName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    u.status === 'active' 
                      ? "border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-300 dark:bg-green-950" 
                      : "border-gray-300 text-gray-600 bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:bg-gray-800"
                  )}>
                    {u.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(u.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                        <span className="sr-only">Abrir menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleOpenEdit(u)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar Função
                      </DropdownMenuItem>
                       <DropdownMenuItem onSelect={() => handleOpenGroupDialog(u)}>
                        <Users2 className="mr-2 h-4 w-4" />
                        Atribuir Grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleToggleStatus(u)}>
                        {u.status === 'active' ? (
                          <UserX className="mr-2 h-4 w-4" />
                        ) : (
                          <UserCheck className="mr-2 h-4 w-4" />
                        )}
                        <span>{u.status === 'active' ? 'Inativar' : 'Ativar'}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSendPasswordReset(u.email)}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Redefinir Senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setUserToDelete(u)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    );
  };

  const renderSellerAnalyticsContent = () => {
    if (isSellerAnalyticsLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }

    if (sellerAnalyticsError) {
      return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao Carregar Dados</AlertTitle>
            <AlertDescription>{sellerAnalyticsError}</AlertDescription>
        </Alert>
      );
    }
    
    if (sellerAnalytics.length === 0) {
      return <p className="text-muted-foreground text-center">Nenhum dado de vendedor encontrado para o período selecionado.</p>;
    }

    return (
       <Accordion type="single" collapsible className="w-full">
        {sellerAnalytics.map((seller) => (
          <AccordionItem value={seller.sellerId} key={seller.sellerId}>
            <AccordionTrigger className="hover:no-underline font-medium text-base">
               <div className="flex justify-between items-center w-full pr-4">
                <span>{seller.sellerName}</span>
                <div className="flex items-center gap-4 text-sm text-muted-foreground font-normal">
                  <span>Receita: <span className="font-semibold text-foreground">{seller.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</span></span>
                  <span>Vendas: <span className="font-semibold text-foreground">{seller.totalSales}</span></span>
                  <span>Recompras: <span className="font-semibold text-foreground">{seller.totalRepurchases}</span></span>
                  <span>Conversão: <span className="font-semibold text-foreground">{seller.conversionRate.toFixed(1)}%</span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-1">
              <Card>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                      <h4 className="font-medium">Resumo de Leads</h4>
                      <div className="space-y-2">
                        {(Object.keys(seller.leadsByStatus) as ClientStatus[]).map((status) => (
                          <div key={status} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{status}</span>
                            <span className="font-medium">{seller.leadsByStatus[status]}</span>
                          </div>
                        ))}
                      </div>
                  </div>
                   <div className="space-y-4">
                     <h4 className="font-medium">Receita Total ({analyticsPeriod === 'total' ? 'Total' : 'no período'})</h4>
                     <p className="text-3xl font-bold">{seller.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                     <p className="text-xs text-muted-foreground">
                        {seller.totalSales} vendas de {seller.totalLeads} leads totais.
                     </p>
                  </div>
                  <div className="space-y-4">
                     <h4 className="font-medium">Taxa de Conversão</h4>
                     <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold">{seller.conversionRate.toFixed(1)}%</p>
                     </div>
                     <p className="text-xs text-muted-foreground">
                        Baseado nos leads e vendas do período.
                     </p>
                     <Progress value={seller.conversionRate} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderGroupManagementContent = () => {
    return (
        <div className="grid gap-8 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Criar Novo Grupo</CardTitle>
                    <CardDescription>Crie um novo grupo para organizar seus vendedores.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex space-x-2">
                        <Input
                            placeholder="Nome do Grupo"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            disabled={isPending}
                        />
                        <Button onClick={handleCreateGroup} disabled={isPending || !newGroupName.trim()}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Criar
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Grupos Existentes</CardTitle>
                    <CardDescription>Gerencie os grupos de vendedores já criados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingGroups ? <Skeleton className="h-20 w-full" /> : 
                     groupsError ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{groupsError}</AlertDescription></Alert> :
                     groups.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo criado ainda.</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Membros</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups.map(group => (
                                    <TableRow key={group.id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                          <Badge variant="secondary">{group.memberCount || 0}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button variant="ghost" size="icon" onClick={() => handleOpenGroupEdit(group)} disabled={isPending}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setGroupToDelete(group)} disabled={isPending}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
  }


  return (
    <>
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-background">
        <header className="sticky top-0 z-10 border-b bg-white dark:bg-card">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Painel do Admin</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Visão Geral e Usuários</TabsTrigger>
                <TabsTrigger value="seller-data">Dados por Vendedor</TabsTrigger>
                <TabsTrigger value="groups">Gerenciamento de Grupos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-8">
                <div className="flex justify-end">
                    <Select value={overviewGroupFilter} onValueChange={setOverviewGroupFilter}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue placeholder="Filtrar por grupo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Visão Geral - Todos</SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <section className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Receita da Semana</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-8 w-3/4" /> : (
                            <>
                                <div className="text-2xl font-bold">
                                    {analyticsData?.weeklyRevenue.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                                <ComparisonText value={analyticsData?.weeklyRevenue.change} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                     <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendas da Semana</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">{analyticsData?.weeklySales.count}</div>
                                <ComparisonText value={analyticsData?.weeklySales.change} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads da Semana</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                         {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">{analyticsData?.weeklyLeads.count}</div>
                                <ComparisonText value={analyticsData?.weeklyLeads.change} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Conversão (Semana)</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                         {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">
                                  {analyticsData?.weeklyConversionRate.rate.toFixed(1)}%
                                </div>
                                <ComparisonText value={analyticsData?.weeklyConversionRate.change} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads Abandonados</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">{analyticsData?.abandonedLeadsCount}</div>
                                <p className="text-xs text-muted-foreground">
                                  Sem interação há mais de 7 dias.
                                </p>
                            </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-7">
                    <Card className="md:col-span-4">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Leads e Vendas nos Últimos 30 Dias</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-[250px] w-full" /> : (
                          <ChartContainer config={chartConfig} className="h-[250px] w-full">
                            <ResponsiveContainer>
                              <LineChart data={analyticsData?.performanceOverTime} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                                <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Line dataKey="leads" type="monotone" stroke="var(--color-leads)" strokeWidth={2} dot={false} />
                                <Line dataKey="sales" type="monotone" stroke="var(--color-sales)" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="md:col-span-3">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Ranking de Vendas (por Receita)</CardTitle>
                        <CardDescription>Vendedores com maior receita total.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-[250px] w-full" /> : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Grupo</TableHead>
                                <TableHead>Vendas</TableHead>
                                <TableHead className="text-right">Receita</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {analyticsData?.salesRanking.map((seller) => (
                                <TableRow key={seller.sellerId}>
                                  <TableCell className="font-medium">{seller.sellerName}</TableCell>
                                  <TableCell className="text-muted-foreground">{seller.groupName}</TableCell>
                                   <TableCell>{seller.sales}</TableCell>
                                  <TableCell className="text-right font-bold">{seller.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                </TableRow>
                              ))}
                              {analyticsData?.salesRanking.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma venda registrada.</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Gerenciamento de Usuários
                            </CardTitle>
                            <CardDescription className="mt-2">
                            Para adicionar um novo usuário, peça que ele se registre na página de cadastro. A conta aparecerá aqui para sua aprovação. Para atribuir um grupo a um vendedor, use o menu de ações (⋮) na lista abaixo. Os grupos podem ser criados na aba 'Gerenciamento de Grupos'.
                            </CardDescription>
                        </div>
                        <Select value={userGroupFilter} onValueChange={setUserGroupFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filtrar por grupo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Grupos</SelectItem>
                                {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                        {group.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                      {renderUsersContent()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="seller-data">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                          <CardTitle>Análise por Vendedor</CardTitle>
                          <CardDescription>
                            Veja o desempenho individual da equipe. Os dados refletem o período e grupo selecionado.
                          </CardDescription>
                        </div>
                         <div className="flex flex-col sm:flex-row gap-2">
                            <Select value={groupFilter} onValueChange={setGroupFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filtrar por grupo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Grupos</SelectItem>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={analyticsPeriod} onValueChange={(value) => setAnalyticsPeriod(value as AnalyticsPeriod)}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Selecionar período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="total">Total</SelectItem>
                                <SelectItem value="monthly">Este Mês</SelectItem>
                                <SelectItem value="weekly">Esta Semana</SelectItem>
                                <SelectItem value="daily">Hoje</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderSellerAnalyticsContent()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="groups">
                {renderGroupManagementContent()}
              </TabsContent>

            </Tabs>
        </main>
      </div>

      <UserEditDialog
        isOpen={isEditUserOpen}
        onOpenChange={setIsEditUserOpen}
        user={editingUser}
        onUserUpdated={onDataUpdated}
      />

      <UserGroupDialog
        isOpen={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        user={userForGroupAssignment}
        groups={groups}
        onUserUpdated={onDataUpdated}
      />

      <GroupEditDialog
        isOpen={isEditGroupOpen}
        onOpenChange={setIsEditGroupOpen}
        group={editingGroup}
        onGroupUpdated={onDataUpdated}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação irá remover o registro do usuário do banco de dados, mas não da autenticação do Firebase. Isso não pode ser desfeito.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteUser} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!groupToDelete} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar o grupo "{groupToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os usuários deste grupo serão desassociados.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGroupToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteGroup} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
