
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Client, Comment, MessageTemplate, Tag, LeadAnalysisOutput, ClientStatus, clientStatuses } from "@/lib/types";
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
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "./icons/whatsapp-icon";
import { useState, useEffect, useTransition } from "react";
import { getComments, addComment, analyzeLeadAction, saveLeadAnalysis } from "@/app/actions";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { WhatsappTemplateDialog } from "./whatsapp-template-dialog";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSaving, startSavingTransition] = useTransition();
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);

  const [isAnalyzing, startAnalysisTransition] = useTransition();
  const [analysisResult, setAnalysisResult] = useState<LeadAnalysisOutput | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);


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

  useEffect(() => {
    if (isOpen && client) {
        fetchClientComments();
        // Load existing analysis if present
        if (client.lastAnalysis) {
            setAnalysisResult(client.lastAnalysis);
        }
    } else {
        // Reset state when sheet is closed
        setAnalysisResult(null);
        setAnalysisError(null);
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
            
            // Save the successful analysis
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
    navigator.clipboard.writeText(message).then(() => {
      toast({ title: "Mensagem copiada!", description: "A mensagem foi copiada para a área de transferência." });
    }, () => {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível copiar a mensagem." });
    });
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
      icon: Bell,
      label: "Lembrete de Remarketing",
      value: client.remarketingReminder || "Nenhum",
    },
  ];

  const clientTags = tags.filter(tag => client.tagIds?.includes(tag.id));

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col gap-0 p-0">
          <SheetHeader className="text-left p-6 border-b">
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
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {detailItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <item.icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <div className="font-medium text-foreground break-words flex items-center gap-2">
                        <span>{item.value}</span>
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
              </div>

              <Separator />
              
              {/* AI Analysis Section */}
               <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Análise com IA
                    </h3>
                    <div className="flex items-center gap-2">
                         <Button size="sm" variant="outline" onClick={() => onOpenProposalDialog(client)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Gerar Proposta
                        </Button>
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
              </div>


              <Separator />

              <div className="space-y-4">
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
              </div>
            </div>
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
