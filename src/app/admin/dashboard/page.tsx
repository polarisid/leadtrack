
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogOut, ShieldCheck, Users, AlertCircle, MoreHorizontal, Edit, KeyRound, Trash2, UserCheck, UserX, DollarSign, Target, BarChart3, Trophy, TrendingUp, TrendingDown, Minus, Repeat, Percent, PlusCircle, Users2, CreditCard, AlertTriangle, MessageSquare, Goal as GoalIcon, Link2, Tag as TagIcon, Sparkles, BrainCircuit, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUsersForAdmin, sendPasswordResetForUser, deleteUserRecord, updateUserStatus, getDashboardAnalytics, getSellerAnalytics, getGroups, createGroup, deleteGroup, getMessageTemplates, deleteMessageTemplate, getGoals, createOrUpdateGroupGoal, updateIndividualGoal, deleteGoal, getTags, deleteTag, getAdminDailySummaryAction } from '@/app/actions';
import { UserProfile, UserStatus, DashboardAnalyticsData, SellerAnalytics, ClientStatus, AnalyticsPeriod, Group, MessageTemplate, Goal, UserGoal, Tag, AdminDailySummaryOutput } from '@/lib/types';
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
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UserEditDialog } from '@/components/admin/user-edit-dialog';
import { UserGroupDialog } from '@/components/admin/user-group-dialog';
import { GroupEditDialog } from '@/components/admin/group-edit-dialog';
import { TemplateEditDialog } from '@/components/admin/template-edit-dialog';
import { TagEditDialog } from '@/components/admin/tag-edit-dialog';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { SellerLeadsDialog } from '@/components/admin/seller-leads-dialog';


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

const ComparisonText = ({ value, period }: { value: number | undefined; period: 'weekly' | 'monthly' | 'yearly' }) => {
  if (value === undefined || !isFinite(value)) {
    return (
      <p className="text-xs text-muted-foreground flex items-center">
        --
      </p>
    );
  }
  
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  let periodText = 'no último período';
  if (period === 'weekly') periodText = 'na última semana';
  if (period === 'monthly') periodText = 'no último mês';
  if (period === 'yearly') periodText = 'no último ano';

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
      {isPositive ? '+' : ''}{value.toFixed(1)}% {periodText}
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

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [tagsError, setTagsError] = useState<string | null>(null);

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
  const [overviewPeriod, setOverviewPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalPeriod, setGoalPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [newGoalGroupId, setNewGoalGroupId] = useState<string>('');
  const [newGoalValue, setNewGoalValue] = useState('');
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
  const [individualGoalValues, setIndividualGoalValues] = useState<Record<string, string>>({});


  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const [userForGroupAssignment, setUserForGroupAssignment] = useState<UserProfile | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [viewingSellerLeads, setViewingSellerLeads] = useState<{ id: string; name: string } | null>(null);
  
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isEditTemplateOpen, setIsEditTemplateOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);
  
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  
  const [adminSummary, setAdminSummary] = useState<AdminDailySummaryOutput | null>(null);
  const [isGeneratingAdminSummary, setIsGeneratingAdminSummary] = useState(false);
  const [adminSummaryError, setAdminSummaryError] = useState<string | null>(null);


  const periodMap = { weekly: 'Semana', monthly: 'Mês', yearly: 'Ano' };
  const periodArticleMap = { weekly: 'da', monthly: 'do', yearly: 'do' };
  
  const periodChartTitleMap: Record<AnalyticsPeriod, string> = {
    daily: "Esta Semana",
    weekly: "Esta Semana",
    monthly: "Este Mês",
    yearly: "Este Ano",
    total: "Últimos 30 dias",
  };
  const chartTitle = `Desempenho (${periodChartTitleMap[analyticsPeriod]})`;


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
     getDashboardAnalytics(user.uid, overviewPeriod, overviewGroupFilter === 'all' ? null : overviewGroupFilter)
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
  
  const fetchTemplates = () => {
    if (!user) return;
    setIsLoadingTemplates(true);
    setTemplatesError(null);
    getMessageTemplates(user.uid)
      .then(setTemplates)
      .catch((err) => {
        setTemplatesError(err.message || 'Ocorreu um erro ao buscar os templates.');
        toast({ variant: 'destructive', title: 'Erro de Templates', description: 'Não foi possível carregar os templates de mensagem.' });
      })
      .finally(() => setIsLoadingTemplates(false));
  };

  const fetchTags = () => {
    if (!user) return;
    setIsLoadingTags(true);
    setTagsError(null);
    getTags(user.uid)
      .then(setTags)
      .catch((err) => {
        setTagsError(err.message || 'Ocorreu um erro ao buscar as tags.');
        toast({ variant: 'destructive', title: 'Erro de Tags', description: 'Não foi possível carregar as tags.' });
      })
      .finally(() => setIsLoadingTags(false));
  };

  const fetchGoals = () => {
    if (!user) return;
    setIsLoadingGoals(true);
    setGoalsError(null);
    getGoals(user.uid, goalPeriod)
        .then(setGoals)
        .catch(err => {
            setGoalsError(err.message || 'Ocorreu um erro ao buscar as metas.');
            toast({ variant: 'destructive', title: 'Erro de Metas', description: 'Não foi possível carregar as metas.' });
        })
        .finally(() => setIsLoadingGoals(false));
  };

  useEffect(() => {
    if (user?.uid) {
        fetchGroups();
        fetchTemplates();
        fetchTags();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
        fetchDashboardAnalytics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, overviewGroupFilter, overviewPeriod]);


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

  useEffect(() => {
    if(user?.uid) {
      fetchGoals();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, goalPeriod]);


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
  
  const handleOpenTemplateEdit = (template: MessageTemplate | null) => {
    setEditingTemplate(template);
    setIsEditTemplateOpen(true);
  }
  
  const handleOpenTagEdit = (tag: Tag | null) => {
    setEditingTag(tag);
    setIsEditTagOpen(true);
  }

  const onDataUpdated = () => {
    fetchGroups();
    fetchUsers();
    fetchDashboardAnalytics();
    fetchSellerAnalytics();
    fetchTemplates();
    fetchTags();
    fetchGoals();
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

  const handleDeleteTemplate = () => {
    if (!templateToDelete || !user) return;
    startTransition(async () => {
        const result = await deleteMessageTemplate(templateToDelete.id, user.uid);
        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Template deletado.' });
            setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
        setTemplateToDelete(null);
    });
  };

  const handleDeleteTag = () => {
    if (!tagToDelete || !user) return;
    startTransition(async () => {
        const result = await deleteTag(tagToDelete.id, user.uid);
        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Tag deletada.' });
            setTags(prev => prev.filter(t => t.id !== tagToDelete.id));
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
        setTagToDelete(null);
    });
  };

  const handleSaveGoal = () => {
    if (!user || !newGoalGroupId || !newGoalValue) {
        toast({ variant: "destructive", title: "Erro", description: "Selecione um grupo e um valor para a meta." });
        return;
    }
    startTransition(async () => {
        const result = await createOrUpdateGroupGoal({
            groupId: newGoalGroupId,
            targetValue: parseFloat(newGoalValue),
            period: goalPeriod
        }, user.uid);

        if (result.success) {
            toast({ title: "Sucesso!", description: "Meta do grupo salva com sucesso." });
            setNewGoalGroupId('');
            setNewGoalValue('');
            fetchGoals();
        } else {
            toast({ variant: "destructive", title: "Erro ao Salvar Meta", description: result.error });
        }
    });
  };

  const handleSaveIndividualGoal = (userGoalId: string) => {
    if (!user) return;
    const newValue = parseFloat(individualGoalValues[userGoalId]);
    if (isNaN(newValue) || newValue < 0) {
        toast({ variant: "destructive", title: "Erro", description: "Valor da meta individual inválido." });
        return;
    }
    startTransition(async () => {
        const result = await updateIndividualGoal(userGoalId, newValue, user.uid);
        if (result.success) {
            toast({ title: "Sucesso!", description: "Meta individual atualizada." });
            fetchGoals();
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.error });
        }
    });
  };

  const handleDeleteGoal = () => {
    if (!goalToDelete || !user) return;
    startTransition(async () => {
        const result = await deleteGoal(goalToDelete.id, user.uid);
        if (result.success) {
            toast({ title: 'Sucesso!', description: `Meta do grupo "${goalToDelete.groupName}" deletada.` });
            fetchGoals();
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
        setGoalToDelete(null);
    });
  };

  const generateGoalPeriodOptions = () => {
    const options = [];
    let currentDate = new Date();
    for (let i = 0; i < 12; i++) {
        const value = format(currentDate, 'yyyy-MM');
        const label = format(currentDate, 'MMMM yyyy', { locale: ptBR });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
        currentDate = subMonths(currentDate, 1);
    }
    return options;
  };
  
  const handleCopyLink = (group: Group) => {
    if (!group.slug) {
        toast({
            variant: "destructive",
            title: "Link Indisponível",
            description: "Este grupo antigo não possui um link de captação. Edite o nome do grupo para gerar um novo link e salvá-lo.",
        });
        return;
    }
    const link = `${window.location.origin}/${group.slug}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        toast({ title: "Link Copiado!", description: "O link de captação foi copiado para sua área de transferência." });
      })
      .catch(err => {
        toast({ variant: "destructive", title: "Erro ao Copiar", description: "Não foi possível copiar o link." });
        console.error('Could not copy text: ', err);
      });
  };

  const handleGenerateAdminSummary = () => {
    if (!user) return;
    setIsGeneratingAdminSummary(true);
    setAdminSummaryError(null);
    getAdminDailySummaryAction(user.uid)
      .then(result => {
        if (result.success && result.summary) {
          setAdminSummary(result.summary);
          toast({ title: "Briefing geral gerado com sucesso!" });
        } else {
          setAdminSummaryError(result.error || "Ocorreu um erro desconhecido.");
          toast({ variant: "destructive", title: "Erro ao Gerar Briefing", description: result.error });
        }
      })
      .finally(() => setIsGeneratingAdminSummary(false));
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
                <div className="flex items-center flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-muted-foreground font-normal">
                  <span>Receita: <span className="font-semibold text-foreground">{seller.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</span></span>
                  <span>Vendas: <span className="font-semibold text-foreground">{seller.totalSales}</span></span>
                  <span>Recompras: <span className="font-semibold text-foreground">{seller.totalRepurchases}</span></span>
                  <span>Conversão: <span className="font-semibold text-foreground">{seller.conversionRate.toFixed(1)}%</span></span>
                  <span>Deletados: <span className="font-semibold text-foreground">{seller.totalDeletedLeads}</span></span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-1">
              <Card>
                <CardContent className="p-4 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2"><Trash2 className="h-4 w-4" /> Leads Deletados</h4>
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-bold">{seller.totalDeletedLeads}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total de leads removidos da carteira (desde o início do rastreamento).
                        </p>
                      </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                      <h4 className="font-medium">{chartTitle}</h4>
                        {seller.performanceOverTime && seller.performanceOverTime.length > 0 ? (
                          <ChartContainer config={chartConfig} className="h-[200px] w-full">
                            <ResponsiveContainer>
                              <LineChart data={seller.performanceOverTime} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                                <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Line dataKey="leads" type="monotone" stroke="var(--color-leads)" strokeWidth={2} dot={false} />
                                <Line dataKey="sales" type="monotone" stroke="var(--color-sales)" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        ) : (
                          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                              Nenhum dado de desempenho para exibir.
                          </div>
                        )}
                   </div>
                </CardContent>
                 <CardFooter>
                  <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingSellerLeads({ id: seller.sellerId, name: seller.sellerName })}
                  >
                      <Users className="mr-2 h-4 w-4" />
                      Ver Leads ({seller.totalLeads})
                  </Button>
                </CardFooter>
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
                    <CardDescription>Gerencie os grupos de vendedores e copie os links de captação.</CardDescription>
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
                                    <TableHead>Link de Captura</TableHead>
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
                                        <TableCell>
                                          <Button variant="outline" size="sm" onClick={() => handleCopyLink(group)}>
                                            <Link2 className="mr-2 h-4 w-4" />
                                            Copiar Link
                                          </Button>
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

  const renderTemplateManagementContent = () => {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Templates de Mensagem</CardTitle>
              <CardDescription>Crie e gerencie templates para o WhatsApp.</CardDescription>
            </div>
            <Button onClick={() => handleOpenTemplateEdit(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : templatesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{templatesError}</AlertDescription>
            </Alert>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum template criado.</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.title}</TableCell>
                      <TableCell className="text-muted-foreground max-w-sm truncate">{template.content}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenTemplateEdit(template)} disabled={isPending}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setTemplateToDelete(template)} disabled={isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTagManagementContent = () => {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Gerenciamento de Tags</CardTitle>
              <CardDescription>Crie, edite e delete tags para organizar seus clientes.</CardDescription>
            </div>
            <Button onClick={() => handleOpenTagEdit(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingTags ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : tagsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{tagsError}</AlertDescription>
            </Alert>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tag criada.</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Tag</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map(tag => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }}></div>
                          <span className="text-muted-foreground">{tag.color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenTagEdit(tag)} disabled={isPending}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setTagToDelete(tag)} disabled={isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  const renderGoalsManagementContent = () => {
    return (
        <div className="space-y-8">
            <div className="flex justify-end">
                <Select value={goalPeriod} onValueChange={setGoalPeriod}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Selecionar Período" />
                    </SelectTrigger>
                    <SelectContent>
                        {generateGoalPeriodOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Definir Nova Meta de Grupo</CardTitle>
                    <CardDescription>Defina uma meta de vendas para um grupo para o período de {format(new Date(`${goalPeriod}-02`), 'MMMM yyyy', { locale: ptBR })}.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Select value={newGoalGroupId} onValueChange={setNewGoalGroupId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map(group => (
                                <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input 
                        type="number"
                        placeholder="Valor da Meta (Ex: 50000)"
                        value={newGoalValue}
                        onChange={e => setNewGoalValue(e.target.value)}
                        disabled={isPending}
                    />
                    <Button onClick={handleSaveGoal} disabled={isPending || !newGoalGroupId || !newGoalValue}>
                        Salvar Meta
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Metas do Período</CardTitle>
                    <CardDescription>Acompanhe e edite as metas definidas para {format(new Date(`${goalPeriod}-02`), 'MMMM yyyy', { locale: ptBR })}.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingGoals ? <Skeleton className="h-40 w-full" /> : 
                     goalsError ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{goalsError}</AlertDescription></Alert> :
                     goals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta definida para este período.</p> : (
                        <Accordion type="multiple" className="w-full space-y-4">
                            {goals.map(goal => {
                                const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
                                return (
                                    <AccordionItem value={goal.id} key={goal.id} className="border rounded-lg bg-card text-card-foreground shadow-sm">
                                        <AccordionTrigger className="p-4 hover:no-underline font-medium text-base">
                                            <div className="flex justify-between items-center w-full pr-4">
                                                <div className="flex items-center gap-3">
                                                    <GoalIcon className="h-5 w-5 text-primary"/>
                                                    <span>{goal.groupName}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground font-normal">
                                                    <span>{goal.currentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})} / <span className="font-semibold text-foreground">{goal.targetValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</span></span>
                                                    <Progress value={progress} className="w-32 h-2" />
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-1 px-4 pb-4">
                                            <div className="flex justify-end mb-2">
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setGoalToDelete(goal)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Deletar Meta do Grupo
                                                </Button>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Vendedor</TableHead>
                                                        <TableHead>Meta Individual</TableHead>
                                                        <TableHead>Progresso</TableHead>
                                                        <TableHead className="text-right">Ação</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {goal.userGoals.map(userGoal => {
                                                        const userProgress = userGoal.targetValue > 0 ? (userGoal.currentValue / userGoal.targetValue) * 100 : 0;
                                                        return (
                                                            <TableRow key={userGoal.id}>
                                                                <TableCell>{userGoal.userName}</TableCell>
                                                                <TableCell>
                                                                    <Input 
                                                                        type="number"
                                                                        className="w-40"
                                                                        value={individualGoalValues[userGoal.id] ?? userGoal.targetValue}
                                                                        onChange={e => setIndividualGoalValues(prev => ({...prev, [userGoal.id]: e.target.value}))}
                                                                        disabled={isPending}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <Progress value={userProgress} className="w-24 h-2" />
                                                                        <span className="text-xs text-muted-foreground">{userProgress.toFixed(1)}%</span>
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground">{userGoal.currentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL'})}</span>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button size="sm" onClick={() => handleSaveIndividualGoal(userGoal.id)} disabled={isPending}>Salvar</Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                        </Accordion>
                     )}
                </CardContent>
            </Card>
        </div>
    );
  };

  const renderAdminBriefingContent = () => {
    const renderSummary = () => {
      if (isGeneratingAdminSummary) {
        return (
          <div className="space-y-4 p-6 pt-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="pt-4 space-y-2">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        );
      }

      if (adminSummaryError) {
        return <p className="text-sm text-destructive text-center p-6">{adminSummaryError}</p>;
      }

      if (adminSummary) {
        return (
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Visão Geral do Portfólio</h4>
              <p className="text-sm text-muted-foreground italic">"{adminSummary.portfolioOverview}"</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" /> Vendedores em Destaque</h4>
                <ul className="space-y-2">
                  {adminSummary.topSellers.map((seller, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">{seller.name}:</span>
                        <span className="text-muted-foreground ml-1">{seller.reason}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Vendedores para Acompanhar</h4>
                <ul className="space-y-2">
                  {adminSummary.sellersToWatch.map((seller, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">{seller.name}:</span>
                        <span className="text-muted-foreground ml-1">{seller.reason}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2"><BrainCircuit className="h-4 w-4" /> Oportunidades Globais</h4>
              <ul className="space-y-2">
                {adminSummary.globalOpportunities.map((op, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{op.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        );
      }

      return (
        <CardContent className="flex flex-col items-center justify-center text-center p-8">
          <p className="text-muted-foreground mb-4">Receba um resumo inteligente de toda a equipe de vendas para tomar decisões estratégicas.</p>
          <Button onClick={handleGenerateAdminSummary} disabled={isGeneratingAdminSummary}>
            {isGeneratingAdminSummary && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Briefing da Equipe
          </Button>
        </CardContent>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Briefing Diário da Equipe
          </CardTitle>
          <CardDescription>
            Análise de toda a carteira de clientes da equipe gerada por IA.
          </CardDescription>
        </CardHeader>
        {renderSummary()}
      </Card>
    );
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
                <TabsTrigger value="briefing">Briefing Geral</TabsTrigger>
                <TabsTrigger value="groups">Gerenciamento de Grupos</TabsTrigger>
                <TabsTrigger value="templates">Templates de Mensagem</TabsTrigger>
                <TabsTrigger value="tags">Tags de Clientes</TabsTrigger>
                <TabsTrigger value="goals">Metas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-8">
                <div className="flex justify-end gap-2">
                    <Select value={overviewPeriod} onValueChange={(value) => setOverviewPeriod(value as 'weekly' | 'monthly' | 'yearly')}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Visão Semanal</SelectItem>
                            <SelectItem value="monthly">Visão Mensal</SelectItem>
                            <SelectItem value="yearly">Visão Anual</SelectItem>
                        </SelectContent>
                    </Select>
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
                        <CardTitle className="text-sm font-medium">Receita {periodArticleMap[overviewPeriod]} {periodMap[overviewPeriod]}</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-8 w-3/4" /> : (
                            <>
                                <div className="text-2xl font-bold">
                                    {analyticsData?.revenue.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                                <ComparisonText value={analyticsData?.revenue.change} period={overviewPeriod} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                     <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vendas {periodArticleMap[overviewPeriod]} {periodMap[overviewPeriod]}</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">{analyticsData?.sales.count}</div>
                                <ComparisonText value={analyticsData?.sales.change} period={overviewPeriod} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads {periodArticleMap[overviewPeriod]} {periodMap[overviewPeriod]}</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                         {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">{analyticsData?.leads.count}</div>
                                <ComparisonText value={analyticsData?.leads.change} period={overviewPeriod} />
                            </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Conversão ({periodMap[overviewPeriod]})</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                         {isAnalyticsLoading ? <Skeleton className="h-8 w-1/4" /> : (
                            <>
                                <div className="text-2xl font-bold">
                                  {analyticsData?.conversionRate.rate.toFixed(1)}%
                                </div>
                                <ComparisonText value={analyticsData?.conversionRate.change} period={overviewPeriod} />
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
                                  Sem interação há mais de 30 dias.
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
                        <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Ranking de Vendas ({periodMap[overviewPeriod]})</CardTitle>
                        <CardDescription>Vendedores com maior receita no período.</CardDescription>
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
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma venda registrada no período.</TableCell>
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
                                <SelectItem value="yearly">Este Ano</SelectItem>
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

              <TabsContent value="briefing">
                {renderAdminBriefingContent()}
              </TabsContent>

              <TabsContent value="groups">
                {renderGroupManagementContent()}
              </TabsContent>

              <TabsContent value="templates">
                {renderTemplateManagementContent()}
              </TabsContent>

              <TabsContent value="tags">
                {renderTagManagementContent()}
              </TabsContent>

              <TabsContent value="goals">
                {renderGoalsManagementContent()}
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
      
      <TemplateEditDialog
        isOpen={isEditTemplateOpen}
        onOpenChange={setIsEditTemplateOpen}
        template={editingTemplate}
        onTemplateUpdated={onDataUpdated}
      />

      <TagEditDialog
        isOpen={isEditTagOpen}
        onOpenChange={setIsEditTagOpen}
        tag={editingTag}
        onTagUpdated={onDataUpdated}
      />

      <SellerLeadsDialog
        isOpen={!!viewingSellerLeads}
        onOpenChange={() => setViewingSellerLeads(null)}
        seller={viewingSellerLeads}
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

       <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar o template "{templateToDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita e o template será removido permanentemente.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteTemplate} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar a tag "{tagToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. A tag será removida de todos os clientes.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTagToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteTag} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar a meta de "{goalToDelete?.groupName}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita e irá remover a meta do grupo e de todos os seus membros para este período.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteGoal} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar meta"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
