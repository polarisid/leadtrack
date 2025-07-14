

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Client, clientStatuses, productCategories, Tag } from "@/lib/types";
import { addClient, updateClient, checkContactExists } from "@/app/actions";
import { useTransition, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Loader2, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres."),
  city: z.string().min(2, "A cidade deve ter pelo menos 2 caracteres."),
  contact: z.string().min(5, "O contato precisa ter pelo menos 5 caracteres."),
  lastProductBought: z.string().optional(),
  desiredProduct: z.enum(productCategories),
  status: z.enum(clientStatuses),
  remarketingReminder: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

type ClientFormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onClientAdded?: (client: Client) => void;
  onClientUpdated?: (client: Client) => void;
  availableTags: Tag[];
}

export function ClientForm({ isOpen, onOpenChange, client, onClientAdded, onClientUpdated, availableTags }: ClientFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isCheckingContact, setIsCheckingContact] = useState(false);
  const [contactCheck, setContactCheck] = useState<{ status: string; message: string | null }>({ status: 'idle', message: null });


  const form = useForm<ClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      city: "",
      contact: "",
      lastProductBought: "",
      desiredProduct: "Outros",
      status: "Novo Lead",
      remarketingReminder: "",
      tagIds: [],
    },
  });

  const contactValue = form.watch("contact");

  useEffect(() => {
    if (!isOpen) {
      setContactCheck({ status: 'idle', message: null });
      return;
    }
    
    if (!user) return;
    const normalizedContact = contactValue?.replace(/\D/g, '') || '';

    if (!normalizedContact || normalizedContact.length < 10) {
      setContactCheck({ status: 'idle', message: null });
      return;
    }

    const handler = setTimeout(async () => {
      setIsCheckingContact(true);
      const result = await checkContactExists(contactValue, user.uid, client?.id);
      setContactCheck(result);
      setIsCheckingContact(false);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [contactValue, client, isOpen, user]);

  useEffect(() => {
    if (client) {
      form.reset({
        ...client,
        tagIds: client.tagIds || []
      });
    } else {
      form.reset({
        name: "",
        city: "",
        contact: "",
        lastProductBought: "",
        desiredProduct: "Outros",
        status: "Novo Lead",
        remarketingReminder: "",
        tagIds: [],
      });
    }
  }, [client, form, isOpen]);


  const onSubmit = (values: ClientFormValues) => {
    if (!user) {
        toast({ variant: "destructive", title: "Erro", description: "Você precisa estar logado." });
        return;
    }

    startTransition(async () => {
      try {
        if (client) {
          const result = await updateClient(client.id, values, user.uid);
          if (result.error) {
            if (result.error.fieldErrors.contact) {
                form.setError("contact", { type: "manual", message: result.error.fieldErrors.contact[0] });
            }
            if (result.error.formErrors && result.error.formErrors.length > 0) {
                toast({ variant: "destructive", title: "Erro", description: result.error.formErrors.join(", ") });
            }
            return;
          }
          if (!result.client) throw new Error("Falha ao atualizar cliente");
          
          toast({ title: "Sucesso!", description: "Cliente atualizado com sucesso." });
          onClientUpdated?.(result.client);

        } else {
          const result = await addClient(values, user.uid);
           if (result.error) {
            if (result.error.fieldErrors.contact) {
              form.setError("contact", { type: "manual", message: result.error.fieldErrors.contact[0] });
            }
            if (result.error.formErrors && result.error.formErrors.length > 0) {
              toast({ variant: "destructive", title: "Erro ao Adicionar", description: result.error.formErrors.join(", ") });
            }
            return;
          }
          if (!result.client) throw new Error("Falha ao adicionar cliente");

          if (result.transferred) {
            toast({ title: "Lead Transferido!", description: "Este cliente já existia e foi transferido para sua carteira." });
          } else {
            toast({ title: "Sucesso!", description: "Cliente adicionado com sucesso." });
          }
          onClientAdded?.(result.client);
        }
        onOpenChange(false);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: (error as Error).message || "Ocorreu um erro.",
        });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600';
      case 'warning': return 'text-amber-600';
      case 'error': return 'text-destructive';
      case 'info': return 'text-sky-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
          <DialogDescription>
            {client ? "Atualize os dados do cliente." : "Preencha os dados do novo cliente."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contato</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: (11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                    <div className="h-4 pt-1 text-sm">
                      {isCheckingContact ? (
                        <div className="flex items-center text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
                        </div>
                      ) : (
                        contactCheck.message && (
                          <p className={getStatusColor(contactCheck.status)}>
                            {contactCheck.message}
                          </p>
                        )
                      )}
                    </div>
                  </FormItem>
                )}
              />
            </div>
             <FormField
              control={form.control}
              name="tagIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <MultiSelectTags
                    tags={availableTags}
                    selected={field.value || []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastProductBought"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Último Produto Comprado</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Produto Y" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status do cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="desiredProduct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto Desejado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto desejado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {productCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="remarketingReminder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lembrete de Remarketing</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ex: Ligar na próxima semana..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending || contactCheck.status === 'error'}>
                {isPending ? 'Salvando...' : 'Salvar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


interface MultiSelectTagsProps {
  tags: Tag[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

function MultiSelectTags({ tags, selected, onChange, className }: MultiSelectTagsProps) {
  const [open, setOpen] = useState(false);

  const handleUnselect = (tagId: string) => {
    onChange(selected.filter((id) => id !== tagId));
  };

  const getTagById = useCallback((id: string) => tags.find(t => t.id === id), [tags]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(`w-full justify-between h-auto min-h-10`, selected.length > 0 ? 'h-full' : 'h-10', className)}
          onClick={() => setOpen(!open)}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
              selected.map((tagId) => {
                const tag = getTagById(tagId);
                return tag ? (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                    className="mr-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(tag.id);
                    }}
                  >
                    {tag.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ) : null;
              })
            ) : (
              "Selecione as tags"
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tags..." />
          <CommandList>
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => {
                    const newSelected = selected.includes(tag.id)
                      ? selected.filter((id) => id !== tag.id)
                      : [...selected, tag.id];
                    onChange(newSelected);
                    setOpen(true);
                  }}
                  value={tag.name}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(tag.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="h-4 w-4 rounded-full mr-2" style={{backgroundColor: tag.color}}></div>
                  <span>{tag.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
