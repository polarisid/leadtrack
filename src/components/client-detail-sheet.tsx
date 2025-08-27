
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Client, Comment, MessageTemplate, Tag, LeadAnalysisOutput, ClientStatus, clientStatuses, Reminder, ReminderFormValues, Campaign } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  MapPin,
  Phone,
  Tag as TagIcon,
  Bell,
  Calendar as CalendarIcon,
  Briefcase,
  Loader2,
  MessageSquare,
  Info,
  Sparkles,
  Lightbulb,
  Copy,
  FileText,
  ChevronDown,
  Trash2,
  CheckCircle,
  PlusCircle,
  Megaphone,
  Repeat,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { format, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "./icons/whatsapp-icon";
import { useState, useEffect, useTransition, useCallback } from "react";
import { getComments, addComment, analyzeLeadAction, saveLeadAnalysis, addReminder, updateReminderStatus, deleteReminder, getCampaignsForUserGroup } from "@/app/actions";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { WhatsappTemplateDialog } from "./whatsapp-template-dialog";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReminderSchema } from "@/lib/types";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { generateWhatsappLink } from "@/lib/whatsapp-config";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ClientDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  templates: MessageTemplate[];
  tags: Tag[];
  onClientUpdated: (client: Client) => void;
  onOpenProposalDialog: (client: Client) => void;
  onStatusChange: (client: Client, status: ClientStatus) => void;
}

export default function ClientDetailSheet({
  isOpen,
  onOpenChange,
  client,
  templates,
  tags,
  onClientUpdated,
  onOpenProposalDialog,
  onStatusChange,
}: ClientDetailSheetProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSaving, startSavingTransition] = useTransition();
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);

  const [isAnalyzing, startAnalysisTransition] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<LeadAnalysisOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const reminderForm = useForm<ReminderFormValues>({
    resolver: zodResolver(ReminderSchema),
    defaultValues: {
        text: "",
        reminderDate: undefined,
    },
  });

  const fetchCampaignDetails = useCallback(async () => {
    if (client?.campaignId && userProfile?.groupId) {
        try {
            const campaigns = await getCampaignsForUserGroup(userProfile.groupId);
            const currentCampaign = campaigns.find(c => c.id === client.campaignId);
            setCampaign(currentCampaign || null);
        } catch (error) {
            console.error("Failed to fetch campaign details:", error);
            setCampaign(null);
        }
    } else {
        setCampaign(null);
    }
  }, [client?.campaignId, userProfile?.groupId]);


  const fetchClientComments = () => {
      if (client?.id && user?.uid) {
      setIsLoadingComments(true);
      getComments(client.id, user.uid)
        .then((fetchedComments) => {
          setComments(fetchedComments);
        })
        .catch(() => {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Não foi possível carregar as observações.",
          });
        })
        .finally(() => {
          setIsLoadingComments(false);
        });
    }
  }

  const fetchClientReminders = () => {
      if(client?.id) {
          setIsLoadingReminders(true);
          const sortedReminders = client.reminders?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) || [];
          setReminders(sortedReminders);
          setIsLoadingReminders(false);
      }
  }

  useEffect(() => {
    if (isOpen && client) {
        fetchClientComments();
        fetchClientReminders();
        fetchCampaignDetails();
        if (client.lastAnalysis) {
            setAnalysisResult(client.lastAnalysis);
        }
    } else {
        setAnalysisResult(null);
        setAnalysisError(null);
        setReminders([]);
        setCampaign(null);
        reminderForm.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, client, user?.uid]);

  const handleSaveComment = () => {
    if (!newComment.trim() || !client || !user) return;

    startSavingTransition(async () => {
      const result = await addComment(client.id, newComment, user.uid);
      if (result.success && result.comment) {
        setComments((prev) => [result.comment!, ...prev]);
        setNewComment("");
        toast({ title: "Observação salva com sucesso!" });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao salvar",
          description: result.error || "Não foi possível salvar a observação.",
        });
      }
    });
  };

  const handleAddReminder = (values: ReminderFormValues) => {
      if(!client || !user) return;
      startSavingTransition(async () => {
          const result = await addReminder(client.id, values, user.uid);
          if (result.success && result.client) {
              toast({ title: "Lembrete adicionado!" });
              onClientUpdated(result.client);
              setReminders(result.client.reminders || []);
              reminderForm.reset();
          } else {
              toast({ variant: "destructive", title: "Erro", description: result.error });
          }
      });
  }

   const handleToggleReminder = (reminderId: string, isCompleted: boolean) => {
      if(!client || !user) return;
      startSavingTransition(async () => {
          const result = await updateReminderStatus(client.id, reminderId, isCompleted, user.uid);
          if (result.success && result.client) {
              toast({ title: "Lembrete atualizado!" });
              onClientUpdated(result.client);
              setReminders(result.client.reminders || []);
          } else {
              toast({ variant: "destructive", title: "Erro", description: result.error });
          }
      });
  }
  
  const handleDeleteReminder = (reminderId: string) => {
    if(!client || !user) return;
    startSavingTransition(async () => {
        const result = await deleteReminder(client.id, reminderId, user.uid);
        if (result.success && result.client) {
            toast({ title: "Lembrete removido!" });
            onClientUpdated(result.client);
            setReminders(result.client.reminders || []);
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.error });
        }
    });
  }

  const handleAnalyzeLead = () => {
    if (!client) return;

    startAnalysisTransition(async () => {
        setAnalysisResult(null);
        setAnalysisError(null);
        try {
            const result = await analyzeLeadAction({
                name: client.name,
                city: client.city,
                status: client.status,
                desiredProduct: client.desiredProduct,
                lastProductBought: client.lastProductBought,
                remarketingReminder: client.remarketingReminder,
                comments: comments.map(c => ({ text: c.text, userName: c.userName, isSystemMessage: c.isSystemMessage }))
            });
            setAnalysisResult(result);
            
            const saveResult = await saveLeadAnalysis(client.id, result);
            if (saveResult.success && saveResult.updatedClient) {
              onClientUpdated(saveResult.updatedClient);
              toast({ title: "Análise salva com sucesso!" });
            } else {
              toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a análise." });
            }

        } catch (error) {
            setAnalysisError("A IA não conseguiu analisar este lead. Tente novamente mais tarde.");
            console.error("AI Analysis Error:", error);
        }
    });
  };

  const handleCopyMessage = (message: string) => {
    if (!client) return;
    const finalMessage = message.replace(/<cliente>/g, client.name.split(' ')[0]);
    navigator.clipboard.writeText(finalMessage).then(() => {
      toast({ title: "Mensagem copiada!", description: "A mensagem foi copiada para a área de transferência." });
    }, () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível copiar a mensagem." });
    });
  };
  
  const handleSendToWhatsapp = (message: string) => {
    if (!client) return;
    const finalMessage = message.replace(/<cliente>/g, client.name.split(' ')[0]);
    const link = generateWhatsappLink(client, finalMessage);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  if (!client) {
    return null;
  }

  const detailItems = [
    { icon: MapPin, label: "Cidade", value: client.city },
    { icon: Phone, label: "Contato", value: client.contact },
    {
      icon: Briefcase,
      label: "Último Produto Comprado",
      value: client.lastProductBought || "Nenhum",
    },
    { icon: TagIcon, label: "Produto Desejado", value: client.desiredProduct },
    {
      icon: CalendarIcon,
      label: "Data de Criação",
      value: format(new Date(client.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    },
     {
      icon: Repeat,
      label: "Lembrete de Remarketing",
      value: client.remarketingReminder || "Nenhum",
      isLongText: true,
    },
  ];

  const clientTags = tags.filter(tag => client.tagIds?.includes(tag.id));

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col gap-0 p-0">
          <SheetHeader className="text-left p-6 border-b">
             <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                        <SheetTitle className="text-2xl">{client.name}</SheetTitle>
                        <SheetDescription className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={client.status} className="mt-1" />
                        {clientTags.map(tag => (
                            <Badge key={tag.id} variant="secondary" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40`}} className="font-normal mt-1">
                                {tag.name}
                            </Badge>
                        ))}
                        </SheetDescription>
                    </div>
                </div>
                 <Button size="sm" variant="outline" onClick={() => onOpenProposalDialog(client)} className="flex-shrink-0">
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar Proposta
                </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full grid grid-cols-4 rounded-none border-b">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="analysis">Análise IA</TabsTrigger>
                <TabsTrigger value="comments">Observações</TabsTrigger>
                <TabsTrigger value="reminders">Lembretes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="p-6 space-y-6">
                {campaign && campaign.script && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Megaphone className="h-5 w-5 text-primary" />
                        Script da Campanha: {campaign.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap border p-3 rounded-md bg-muted/50">
                        {campaign.script.replace(/<cliente>/g, client.name.split(' ')[0])}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCopyMessage(campaign.script)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar Script
                        </Button>
                        <Button size="sm" onClick={() => handleSendToWhatsapp(campaign.script)}>
                          <WhatsappIcon className="mr-2 h-4 w-4" />
                          Enviar via WhatsApp
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {detailItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-4">
                        <item.icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <div className="font-medium text-foreground break-words flex items-center gap-2">
                            <span className={cn(item.isLongText && "whitespace-pre-wrap")}>{item.value}</span>
                            {item.label === "Contato" && client.contact && (
                            <button
                                onClick={() => setIsWhatsappDialogOpen(true)}
                                title="Enviar mensagem no WhatsApp"
                                className="p-1.5 rounded-md text-green-500 hover:bg-green-500/10 transition-colors"
                            >
                                <WhatsappIcon className="h-5 w-5" />
                                <span className="sr-only">
                                Enviar mensagem no WhatsApp
                                </span>
                            </button>
                            )}
                        </div>
                        </div>
                    </div>
                ))}
              </TabsContent>
              
              <TabsContent value="analysis" className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Análise com IA
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleAnalyzeLead} disabled={isAnalyzing}>
                            {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Analisar Lead
                        </Button>
                    </div>
                </div>
                {isAnalyzing ? (
                     <div className="space-y-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-8 w-1/2 mt-2" />
                     </div>
                ) : analysisError ? (
                    <Alert variant="destructive">
                        <AlertTitle>Erro na Análise</AlertTitle>
                        <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                ) : analysisResult ? (
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold mb-1 text-foreground">Análise do Lead</h4>
                            <p className="text-muted-foreground italic">{analysisResult.analysis}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-foreground">Dicas de Venda</h4>
                            <ul className="space-y-2">
                                {analysisResult.salesTips.map((tip, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-muted-foreground">{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {analysisResult.suggestedMessage && (
                            <div>
                                <h4 className="font-semibold mb-2 text-foreground">Mensagem de Saudação</h4>
                                <div className="p-3 rounded-md border bg-muted/50 text-muted-foreground relative group">
                                    <p className="italic">"{analysisResult.suggestedMessage}"</p>
                                     <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleCopyMessage(analysisResult.suggestedMessage)}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center p-4 bg-muted/50 rounded-md">
                        Clique em "Analisar Lead" para receber dicas e insights da IA sobre este cliente.
                    </p>
                )}
              </TabsContent>
              
              <TabsContent value="comments" className="p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Observações
                </h3>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Adicione uma observação sobre o andamento..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    disabled={isSaving}
                  />
                  <Button
                    onClick={handleSaveComment}
                    disabled={isSaving || !newComment.trim()}
                  >
                    {isSaving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Salvar Observação
                  </Button>
                </div>

                <div className="space-y-4">
                  {isLoadingComments ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={cn(
                          "text-sm p-3 rounded-md flex gap-3",
                          comment.isSystemMessage
                            ? "bg-sky-50 dark:bg-sky-900/30"
                            : "bg-muted/50"
                        )}
                      >
                        {comment.isSystemMessage && (
                            <Info className="h-4 w-4 mt-0.5 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                        )}
                         <div className="flex-1">
                           <p className={cn(
                               "text-foreground break-words whitespace-pre-wrap",
                               comment.isSystemMessage && "italic text-sky-800 dark:text-sky-200"
                            )}>
                            {!comment.isSystemMessage && (
                              <strong className="font-semibold">{comment.userName || 'Usuário'}: </strong>
                            )}
                            {comment.text}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(
                              new Date(comment.createdAt),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center p-4">
                      Nenhuma observação ainda.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reminders" className="p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Lembretes
                </h3>
                 <Form {...reminderForm}>
                    <form onSubmit={reminderForm.handleSubmit(handleAddReminder)} className="space-y-4 p-4 border rounded-lg">
                         <FormField
                            control={reminderForm.control}
                            name="text"
                            render={({ field }) => (
                                <FormItem>
                                <Textarea {...field} placeholder="Lembrar de..." rows={2} />
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-4 items-center">
                             <FormField
                                control={reminderForm.control}
                                name="reminderDate"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value ? (
                                                format(field.value, "PPP", { locale: ptBR })
                                            ) : (
                                                <span>Escolha uma data</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                            initialFocus
                                        />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}
                             />
                            <Button type="submit" disabled={isSaving} size="sm">
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Adicionar
                            </Button>
                        </div>
                    </form>
                </Form>
                 <div className="space-y-4">
                    {isLoadingReminders ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    : reminders.length > 0 ? reminders.map(reminder => (
                        <div key={reminder.id} className={cn("p-3 rounded-md flex gap-3 items-center", reminder.isCompleted ? 'bg-green-50 dark:bg-green-900/30' : 'bg-muted/50')}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleReminder(reminder.id, !reminder.isCompleted)}>
                                {reminder.isCompleted ? <CheckCircle className="h-5 w-5 text-green-600" /> : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />}
                            </Button>
                            <div className="flex-1">
                                <p className={cn("text-sm text-foreground", reminder.isCompleted && "line-through text-muted-foreground")}>{reminder.text}</p>
                                <p className="text-xs text-muted-foreground">
                                    {format(parseISO(reminder.reminderDate), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteReminder(reminder.id)}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    )) :
                    <p className="text-sm text-muted-foreground text-center p-4">Nenhum lembrete para este cliente.</p>
                    }
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <SheetFooter className="p-6 pt-4 mt-auto border-t flex-row justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>Mudar Status <ChevronDown className="ml-2 h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {clientStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={client.status === status}
                    onSelect={() => onStatusChange(client, status)}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <WhatsappTemplateDialog
        isOpen={isWhatsappDialogOpen}
        onOpenChange={setIsWhatsappDialogOpen}
        client={client}
        templates={templates}
      />
    </>
  );
}
