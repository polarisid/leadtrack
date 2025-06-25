
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Group } from "@/lib/types";
import { updateGroup } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  name: z.string().min(2, "O nome do grupo deve ter pelo menos 2 caracteres."),
});

type GroupFormValues = z.infer<typeof formSchema>;

interface GroupEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  onGroupUpdated: () => void;
}

export function GroupEditDialog({ isOpen, onOpenChange, group, onGroupUpdated }: GroupEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (group) {
      form.reset({ name: group.name });
    }
  }, [group, form, isOpen]);


  const onSubmit = (values: GroupFormValues) => {
    if (!adminUser || !group) {
        toast({ variant: "destructive", title: "Erro", description: "Ação não permitida." });
        return;
    }

    startTransition(async () => {
      const result = await updateGroup(group.id, values.name, adminUser.uid);
      if (result.success) {
        toast({ title: "Sucesso!", description: "Nome do grupo atualizado." });
        onGroupUpdated();
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Grupo: {group?.name}</DialogTitle>
          <DialogDescription>
            Altere o nome do grupo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Time Vendas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
