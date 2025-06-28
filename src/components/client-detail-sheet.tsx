
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Client, Comment, MessageTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User,
  MapPin,
  Phone,
  Tag,
  Bell,
  Calendar as CalendarIcon,
  Briefcase,
  Loader2,
  MessageSquare,
  Info,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "./icons/whatsapp-icon";
import { useState, useEffect, useTransition } from "react";
import { getComments, addComment } from "@/app/actions";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import { WhatsappTemplateDialog } from "./whatsapp-template-dialog";

interface ClientDetailSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  templates: MessageTemplate[];
}

export default function ClientDetailSheet({
  isOpen,
  onOpenChange,
  client,
  templates,
}: ClientDetailSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSaving, startTransition] = useTransition();
  const [isWhatsappDialogOpen, setIsWhatsappDialogOpen] = useState(false);

  useEffect(() => {
    if (isOpen && client?.id && user?.uid) {
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
  }, [isOpen, client?.id, user?.uid, toast]);

  const handleSaveComment = () => {
    if (!newComment.trim() || !client || !user) return;

    startTransition(async () => {
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
    { icon: Tag, label: "Produto Desejado", value: client.desiredProduct },
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

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col gap-0 p-0">
          <SheetHeader className="text-left p-6 border-b">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-2xl">{client.name}</SheetTitle>
                <SheetDescription>
                  <StatusBadge status={client.status} className="mt-1" />
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

          <SheetFooter className="p-6 pt-4 mt-auto border-t">
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
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
