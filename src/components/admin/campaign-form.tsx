
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Campaign, CampaignFormValues, CampaignSchema, Tag, Group } from "@/lib/types";
import { createCampaign, updateCampaign } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2 } from "lucide-react";

interface CampaignFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
  campaign?: Campaign | null;
  tags: Tag[];
  groups: Group[];
}

export function CampaignForm({ isOpen, onOpenChange, onCampaignUpdated, campaign, tags, groups }: CampaignFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(CampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      groupId: "",
      defaultTagId: "",
      script: "",
    },
  });

  useEffect(() => {
    if (campaign) {
      form.reset(campaign);
    } else {
      form.reset({
        name: "",
        description: "",
        groupId: "",
        defaultTagId: "",
        script: "",
      });
    }
  }, [campaign, form, isOpen]);

  const onSubmit = (values: CampaignFormValues) => {
    if (!adminUser) return;

    startTransition(async () => {
        const result = campaign
            ? await updateCampaign(campaign.id, values, adminUser.uid)
            : await createCampaign(values, adminUser.uid);
        
      if (result.success) {
        toast({ title: "Sucesso!", description: `Campanha ${campaign ? "atualizada" : "criada"} com sucesso.` });
        onCampaignUpdated();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: result.error || "Ocorreu um erro.",
        });
      }
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar Campanha" : "Criar Nova Campanha"}</DialogTitle>
          <DialogDescription>
            Defina os detalhes da campanha. Os leads podem ser importados após a criação.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Campanha</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Campanha de Trade-up TVs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição / Foco</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Foco em clientes que compraram TVs há mais de 2 anos..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo Alvo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.map(group => (
                            <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="defaultTagId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag Padrão da Campanha</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma tag" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tags.map(tag => (
                            <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
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
              name="script"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Script Padrão (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Olá <cliente>, vimos que você comprou uma TV conosco e temos uma oferta especial..." {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {campaign ? "Salvar Alterações" : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
