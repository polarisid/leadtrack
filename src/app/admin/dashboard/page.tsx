

'use client';

import { useEffect, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
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
import { LogOut, ShieldCheck, Users, AlertCircle, MoreHorizontal, Edit, KeyRound, Trash2, UserCheck, UserX, DollarSign, Target, BarChart3, Trophy, TrendingUp, TrendingDown, Minus, Repeat, Percent, PlusCircle, Users2, CreditCard, AlertTriangle, MessageSquare, Goal as GoalIcon, Link2, Tag as TagIcon, Sparkles, BrainCircuit, Lightbulb, Flame, CheckCircle, XCircle, Clock, Loader2, Brush, UploadCloud, Link as LinkIcon, Wrench, History, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUsersForAdmin, sendPasswordResetForUser, deleteUserRecord, updateUserStatus, getDashboardAnalytics, getSellerAnalytics, getGroups, createGroup, deleteGroup, getMessageTemplates, deleteMessageTemplate, getGoals, createOrUpdateGroupGoal, updateIndividualGoal, deleteGoal, getTags, deleteTag, getAdminDailySummaryAction, getAllOffersForAdmin, updateOfferStatus, deleteOffer, updateBrandingSettings, getBrandingSettings, getInstallationServices, deleteInstallationService, getActivityLogs, getCampaigns, deleteCampaign } from '@/app/actions';
import { UserProfile, UserStatus, DashboardAnalyticsData, SellerAnalytics, ClientStatus, AnalyticsPeriod, Group, MessageTemplate, Goal, UserGoal, Tag, AdminDailySummaryOutput, Offer, OfferStatus, InstallationService, ActivityLog, Campaign } from '@/lib/types';
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
import { format, subMonths, isPast, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const UserEditDialog = dynamic(() => import('@/components/admin/user-edit-dialog').then(mod => mod.UserEditDialog));
const UserGroupDialog = dynamic(() => import('@/components/admin/user-group-dialog').then(mod => mod.UserGroupDialog));
const GroupEditDialog = dynamic(() => import('@/components/admin/group-edit-dialog').then(mod => mod.GroupEditDialog));
const TemplateEditDialog = dynamic(() => import('@/components/admin/template-edit-dialog').then(mod => mod.TemplateEditDialog));
const TagEditDialog = dynamic(() => import('@/components/admin/tag-edit-dialog').then(mod => mod.TagEditDialog));
const SellerLeadsDialog = dynamic(() => import('@/components/admin/seller-leads-dialog').then(mod => mod.SellerLeadsDialog));
const OfferForm = dynamic(() => import('@/components/offer-form').then(mod => mod.OfferForm));
const ServiceEditDialog = dynamic(() => import('@/components/admin/service-edit-dialog').then(mod => mod.ServiceEditDialog));
const CampaignForm = dynamic(() => import('@/components/admin/campaign-form').then(mod => mod.CampaignForm));
const CampaignDetailDialog = dynamic(() => import('@/components/admin/campaign-detail-dialog').then(mod => mod.CampaignDetailDialog));
const CampaignLeadArchiveDialog = dynamic(() => import('@/components/admin/campaign-lead-archive-dialog').then(mod => mod.CampaignLeadArchiveDialog));


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
  const { user, userProfile } = useAuth();
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
  
  const [services, setServices] = useState<InstallationService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<InstallationService | null>(null);
  const [isEditServiceOpen, setIsEditServiceOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<InstallationService | null>(null);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);
  const [offerFilter, setOfferFilter] = useState<'all' | OfferStatus>('all');
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [isOfferFormOpen, setIsOfferFormOpen] = useState(false);

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
  
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logPeriod, setLogPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [logUserFilter, setLogUserFilter] = useState<string>("all");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [isCampaignFormOpen, setIsCampaignFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);


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
  
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'link'>('upload');
  const [companyName, setCompanyName] = useState('');


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

  const fetchServices = () => {
    if (!user) return;
    setIsLoadingServices(true);
    setServicesError(null);
    getInstallationServices()
      .then(setServices)
      .catch(err => {
        setServicesError(err.message || 'Ocorreu um erro ao buscar os serviços.');
        toast({ variant: 'destructive', title: 'Erro de Serviços', description: 'Não foi possível carregar os serviços.' });
      })
      .finally(() => setIsLoadingServices(false));
  };

  const fetchOffers = () => {
    if (!user) return;
    setIsLoadingOffers(true);
    setOffersError(null);
    getAllOffersForAdmin(user.uid)
        .then(setOffers)
        .catch(err => {
            setOffersError(err.message || 'Ocorreu um erro ao buscar as ofertas.');
            toast({ variant: 'destructive', title: 'Erro de Ofertas', description: 'Não foi possível carregar as ofertas.' });
        })
        .finally(() => setIsLoadingOffers(false));
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
  
  const fetchBranding = () => {
      if (!user) return;
      getBrandingSettings()
        .then(settings => {
            if (settings?.logoUrl) {
                setLogoUrl(settings.logoUrl);
                setLogoPreview(settings.logoUrl);
            }
            if (settings?.companyName) {
                setCompanyName(settings.companyName);
            }
        })
        .catch(err => {
            console.warn("Could not fetch branding settings:", err.message);
        });
  }

  const fetchLogs = () => {
    if (!user) return;
    setIsLoadingLogs(true);
    setLogsError(null);
    getActivityLogs(user.uid, logPeriod, logUserFilter === "all" ? null : logUserFilter)
      .then(setActivityLogs)
      .catch(err => {
        setLogsError(err.message || 'Ocorreu um erro ao buscar o registro de atividades.');
        toast({ variant: 'destructive', title: 'Erro de Logs', description: 'Não foi possível carregar o registro de atividades.' });
      })
      .finally(() => setIsLoadingLogs(false));
  }
  
  const fetchCampaigns = () => {
    if (!user) return;
    setIsLoadingCampaigns(true);
    setCampaignsError(null);
    getCampaigns(user.uid)
      .then(setCampaigns)
      .catch(err => {
        setCampaignsError(err.message || 'Ocorreu um erro ao buscar as campanhas.');
        toast({ variant: 'destructive', title: 'Erro de Campanhas', description: 'Não foi possível carregar as campanhas.' });
      })
      .finally(() => setIsLoadingCampaigns(false));
  };

  useEffect(() => {
    if (user?.uid) {
        fetchGroups();
        fetchTemplates();
        fetchTags();
        fetchOffers();
        fetchBranding();
        fetchServices();
        fetchCampaigns();
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

  useEffect(() => {
    if (user?.uid) {
      fetchLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, logPeriod, logUserFilter]);


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

  const handleOpenOfferForm = (offer: Offer | null) => {
    setEditingOffer(offer);
    setIsOfferFormOpen(true);
  };
  
  const handleOpenServiceEdit = (service: InstallationService | null) => {
    setEditingService(service);
    setIsEditServiceOpen(true);
  };

  const onDataUpdated = () => {
    fetchGroups();
    fetchUsers();
    fetchDashboardAnalytics();
    fetchSellerAnalytics();
    fetchTemplates();
    fetchTags();
    fetchGoals();
    fetchOffers();
    fetchBranding();
    fetchServices();
    fetchLogs();
    fetchCampaigns();
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
  
  const handleDeleteService = () => {
    if (!serviceToDelete || !user) return;
    startTransition(async () => {
        const result = await deleteInstallationService(serviceToDelete.id, user.uid);
        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Serviço deletado.' });
            setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
        setServiceToDelete(null);
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
  
  const handleOfferStatusChange = (offerId: string, status: OfferStatus) => {
      if (!user) return;
      startTransition(async () => {
          const result = await updateOfferStatus(offerId, status, user.uid);
          if (result.success) {
              toast({ title: 'Sucesso!', description: 'Status da oferta atualizado.' });
              fetchOffers();
          } else {
              toast({ variant: 'destructive', title: 'Erro', description: result.error });
          }
      });
  };

  const handleDeleteOffer = () => {
      if (!offerToDelete || !user) return;
      startTransition(async () => {
          const result = await deleteOffer(offerToDelete.id, user.uid);
          if (result.success) {
              toast({ title: 'Sucesso!', description: 'Oferta deletada.' });
              setOffers(prev => prev.filter(o => o.id !== offerToDelete.id));
          } else {
              toast({ variant: 'destructive', title: 'Erro', description: result.error });
          }
          setOfferToDelete(null);
      });
  };

  const handleDeleteCampaign = () => {
    if (!campaignToDelete || !user) return;
    startTransition(async () => {
      const result = await deleteCampaign(campaignToDelete.id, user.uid);
      if (result.success) {
        toast({ title: "Sucesso!", description: `Campanha "${campaignToDelete.name}" foi deletada.` });
        onDataUpdated();
      } else {
        toast({ variant: "destructive", title: "Erro", description: result.error });
      }
      setCampaignToDelete(null);
    });
  };

  const handleOpenCampaignEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setIsCampaignFormOpen(true);
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

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit for logo
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "O tamanho máximo do logo é 1MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBranding = () => {
    if (!user) return;
    startTransition(async () => {
        const result = await updateBrandingSettings(user.uid, { logoUrl, companyName });
        if (result.success) {
            toast({ title: 'Sucesso!', description: 'Configurações de marca atualizadas.' });
        } else {
            toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
    });
  }


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
  
  const renderOfferManagementContent = () => {
    const getStatusBadge = (status: OfferStatus) => {
      const styleMap: Record<OfferStatus, string> = {
        pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800",
        approved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800",
        rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800",
      };
      const textMap: Record<OfferStatus, string> = {
        pending: "Pendente",
        approved: "Aprovada",
        rejected: "Rejeitada",
      };
      return <Badge variant="outline" className={cn("font-normal", styleMap[status])}>{textMap[status]}</Badge>;
    }

    const filteredOffers = offers.filter(offer => offerFilter === 'all' || offer.status === offerFilter);
    
    let content;
    if (isLoadingOffers) {
      content = (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      );
    } else if (offersError) {
      content = <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{offersError}</AlertDescription></Alert>;
    } else if (filteredOffers.length === 0) {
      content = <p className="text-sm text-muted-foreground text-center py-8">Nenhuma oferta encontrada para o filtro selecionado.</p>;
    } else {
      content = (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.map(offer => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.title}</TableCell>
                  <TableCell>{offer.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                  <TableCell className={cn(isPast(new Date(offer.validUntil)) && "text-destructive")}>
                    {format(new Date(offer.validUntil), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{offer.createdByName}</TableCell>
                   <TableCell>
                      <Badge variant="secondary">{offer.category}</Badge>
                   </TableCell>
                  <TableCell>{getStatusBadge(offer.status)}</TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isPending}>
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => handleOpenOfferForm(offer)}>
                                <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           {offer.status !== 'approved' && (
                               <DropdownMenuItem onSelect={() => handleOfferStatusChange(offer.id, 'approved')}>
                                   <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Aprovar
                               </DropdownMenuItem>
                           )}
                           {offer.status !== 'rejected' && (
                               <DropdownMenuItem onSelect={() => handleOfferStatusChange(offer.id, 'rejected')}>
                                   <XCircle className="mr-2 h-4 w-4 text-red-500" /> Rejeitar
                               </DropdownMenuItem>
                           )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setOfferToDelete(offer)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Deletar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }
    
    return (
      <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle>Gerenciamento de Ofertas</CardTitle>
                <CardDescription>Aprove, edite ou delete as ofertas sugeridas pelos vendedores.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={offerFilter} onValueChange={(value) => setOfferFilter(value as 'all' | OfferStatus)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas as Ofertas</SelectItem>
                        <SelectItem value="pending">Pendentes</SelectItem>
                        <SelectItem value="approved">Aprovadas</SelectItem>
                        <SelectItem value="rejected">Rejeitadas</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={() => handleOpenOfferForm(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Criar Oferta
                </Button>
              </div>
            </div>
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    );
  };
  
  const renderBrandingContent = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customização da Marca</CardTitle>
          <CardDescription>
            Personalize a aparência das suas propostas e outros materiais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa (para Propostas)</Label>
              <Input
                id="companyName"
                placeholder="Ex: Minha Loja Incrível"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
               <p className="text-sm text-muted-foreground">
                Este nome será usado no cabeçalho das propostas em PDF se nenhum logo for enviado.
              </p>
            </div>
             <div className="space-y-2">
                <Label>Logo da Empresa</Label>
                <p className="text-sm text-muted-foreground">
                    Faça o upload de uma imagem ou cole um link externo. Recomendamos um logo com fundo transparente (PNG) e com no máximo 500px de largura.
                </p>
             </div>
          </div>
          <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as any)} className="w-full max-w-lg">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Fazer Upload</TabsTrigger>
              <TabsTrigger value="link">Usar um Link</TabsTrigger>
            </TabsList>
            <TabsContent value="upload">
              <div className="relative flex items-center justify-center w-full mt-2">
                <label htmlFor="logo-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para enviar</span> ou arraste</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP (Max. 1MB)</p>
                    </div>
                    <Input id="logo-upload" type="file" className="hidden" onChange={handleLogoFileChange} accept="image/png, image/jpeg, image/webp" />
                </label>
              </div>
            </TabsContent>
            <TabsContent value="link">
              <div className="relative mt-2">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="https://exemplo.com/imagem.png"
                      value={logoUrl.startsWith('data:image') ? '' : logoUrl}
                      onChange={(e) => {
                          setLogoUrl(e.target.value);
                          setLogoPreview(e.target.value);
                      }}
                      className="pl-10"
                    />
              </div>
            </TabsContent>
          </Tabs>
           {logoPreview && (
                <div className="mt-4 space-y-2">
                    <Label>Pré-visualização do Logo</Label>
                    <div className="relative w-full h-32 p-4 border rounded-md flex items-center justify-center bg-muted/20">
                    <Image src={logoPreview} alt="Prévia do logo" layout="fill" objectFit="contain" className="rounded-lg" />
                    </div>
                </div>
            )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveBranding} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Customizações
          </Button>
        </CardFooter>
      </Card>
    );
  };
  
  const renderServiceManagementContent = () => {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Gerenciamento de Serviços</CardTitle>
              <CardDescription>Crie e gerencie os serviços de instalação oferecidos.</CardDescription>
            </div>
            <Button onClick={() => handleOpenServiceEdit(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Serviço
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingServices ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : servicesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{servicesError}</AlertDescription>
            </Alert>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum serviço de instalação criado.</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Serviço</TableHead>
                    <TableHead>Valor Padrão</TableHead>
                    <TableHead>Link dos Termos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map(service => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>{service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell className="text-muted-foreground max-w-sm truncate">
                        <a href={service.termsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{service.termsUrl || "N/A"}</a>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenServiceEdit(service)} disabled={isPending}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setServiceToDelete(service)} disabled={isPending}>
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
  
  const renderActivityLogContent = () => {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Registro de Atividades</CardTitle>
              <CardDescription>Veja as ações recentes de todos os usuários no sistema.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={logUserFilter} onValueChange={setLogUserFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Usuários</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={logPeriod} onValueChange={(value) => setLogPeriod(value as any)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filtrar por período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Hoje</SelectItem>
                  <SelectItem value="weekly">Esta Semana</SelectItem>
                  <SelectItem value="monthly">Este Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{logsError}</AlertDescription>
            </Alert>
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada para o filtro selecionado.</p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.actorName}</TableCell>
                      <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{log.details?.summary || 'N/A'}</TableCell>
                      <TableCell>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const renderCampaignManagementContent = () => {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Gerenciamento de Campanhas</CardTitle>
                        <CardDescription>Crie campanhas, importe listas de leads e monitore o progresso.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingCampaign(null); setIsCampaignFormOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Criar Campanha
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoadingCampaigns ? <Skeleton className="h-40 w-full" /> : 
                 campaignsError ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{campaignsError}</AlertDescription></Alert> :
                 campaigns.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha criada ainda.</p> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Grupo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Leads</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.map(campaign => (
                                <TableRow key={campaign.id}>
                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                    <TableCell>{campaign.groupName || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant={campaign.isActive ? 'default' : 'secondary'}>
                                            {campaign.isActive ? 'Ativa' : 'Inativa'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{campaign.leadCount || 0}</TableCell>
                                    <TableCell>{format(new Date(campaign.createdAt), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => setViewingCampaignId(campaign.id)}>
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleOpenCampaignEdit(campaign)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onSelect={() => setCampaignToDelete(campaign)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
  };


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
              <TabsList className="flex flex-wrap h-auto justify-start">
                <TabsTrigger value="overview">Visão Geral e Usuários</TabsTrigger>
                <TabsTrigger value="seller-data">Dados por Vendedor</TabsTrigger>
                <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
                <TabsTrigger value="logs">Registro de Atividades</TabsTrigger>
                <TabsTrigger value="briefing">Briefing Geral</TabsTrigger>
                <TabsTrigger value="offers">Ofertas</TabsTrigger>
                <TabsTrigger value="goals">Metas</TabsTrigger>
                <TabsTrigger value="groups">Gerenciamento de Grupos</TabsTrigger>
                <TabsTrigger value="templates">Templates de Mensagem</TabsTrigger>
                <TabsTrigger value="tags">Tags de Clientes</TabsTrigger>
                <TabsTrigger value="customization">Customização</TabsTrigger>
                <TabsTrigger value="services">Serviços</TabsTrigger>
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
              
              <TabsContent value="campaigns">
                {renderCampaignManagementContent()}
              </TabsContent>

              <TabsContent value="logs">
                {renderActivityLogContent()}
              </TabsContent>
              
              <TabsContent value="offers">
                {renderOfferManagementContent()}
              </TabsContent>

              <TabsContent value="briefing">
                {renderAdminBriefingContent()}
              </TabsContent>

              <TabsContent value="goals">
                {renderGoalsManagementContent()}
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
              
              <TabsContent value="customization">
                {renderBrandingContent()}
              </TabsContent>
              
              <TabsContent value="services">
                {renderServiceManagementContent()}
              </TabsContent>

            </Tabs>
        </main>
      </div>

      {isEditUserOpen && <UserEditDialog
        isOpen={isEditUserOpen}
        onOpenChange={setIsEditUserOpen}
        user={editingUser}
        onUserUpdated={onDataUpdated}
      />}

      {isGroupDialogOpen && <UserGroupDialog
        isOpen={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        user={userForGroupAssignment}
        groups={groups}
        onUserUpdated={onDataUpdated}
      />}

      {isEditGroupOpen && <GroupEditDialog
        isOpen={isEditGroupOpen}
        onOpenChange={setIsEditGroupOpen}
        group={editingGroup}
        onGroupUpdated={onDataUpdated}
      />}
      
      {isEditTemplateOpen && <TemplateEditDialog
        isOpen={isEditTemplateOpen}
        onOpenChange={setIsEditTemplateOpen}
        template={editingTemplate}
        onTemplateUpdated={onDataUpdated}
      />}

      {isEditTagOpen && <TagEditDialog
        isOpen={isEditTagOpen}
        onOpenChange={setIsEditTagOpen}
        tag={editingTag}
        onTagUpdated={onDataUpdated}
      />}
      
      {isEditServiceOpen && <ServiceEditDialog
        isOpen={isEditServiceOpen}
        onOpenChange={setIsEditServiceOpen}
        service={editingService}
        onServiceUpdated={onDataUpdated}
      />}
      
      {isOfferFormOpen && <OfferForm
        isOpen={isOfferFormOpen}
        onOpenChange={setIsOfferFormOpen}
        onDataUpdated={onDataUpdated}
        currentUserProfile={userProfile}
        offerToEdit={editingOffer}
        isAdmin
      />}

      {viewingSellerLeads && <SellerLeadsDialog
        isOpen={!!viewingSellerLeads}
        onOpenChange={() => setViewingSellerLeads(null)}
        seller={viewingSellerLeads}
      />}

      {isCampaignFormOpen && (
        <CampaignForm
            isOpen={isCampaignFormOpen}
            onOpenChange={setIsCampaignFormOpen}
            onCampaignUpdated={onDataUpdated}
            campaign={editingCampaign}
            tags={tags}
            groups={groups}
        />
      )}

      {viewingCampaignId && (
        <CampaignDetailDialog
            isOpen={!!viewingCampaignId}
            onOpenChange={() => setViewingCampaignId(null)}
            campaignId={viewingCampaignId}
            adminId={user?.uid || null}
            onCampaignUpdated={onDataUpdated}
        />
      )}

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

       <AlertDialog open={!!offerToDelete} onOpenChange={(open) => !open && setOfferToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar a oferta "{offerToDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita e irá remover a oferta permanentemente.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOfferToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteOffer} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Deletar o serviço "{serviceToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita e o serviço será removido permanentemente.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleDeleteService} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isPending}>
                {isPending ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir a campanha "{campaignToDelete?.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todos os leads associados a esta campanha também serão excluídos permanentemente.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCampaignToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDeleteCampaign}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isPending}
                    >
                        {isPending ? "Excluindo..." : "Sim, excluir campanha"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
