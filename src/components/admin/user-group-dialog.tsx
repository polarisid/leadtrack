
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
import { useToast } from "@/hooks/use-toast";
import { UserProfile, Group } from "@/lib/types";
import { updateUserGroup } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  groupId: z.string().nullable(),
});

type UserGroupFormValues = z.infer<typeof formSchema>;

interface UserGroupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  groups: Group[];
  onUserUpdated: () => void;
}

export function UserGroupDialog({ isOpen, onOpenChange, user, groups, onUserUpdated }: UserGroupDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<UserGroupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      groupId: null
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({ groupId: user.groupId || null });
    }
  }, [user, form, isOpen]);


  const onSubmit = (values: UserGroupFormValues) => {
    if (!adminUser || !user) {
        toast({ variant: "destructive", title: "Erro", description: "Ação não permitida." });
        return;
    }

    startTransition(async () => {
      const result = await updateUserGroup(user.id, values.groupId, adminUser.uid);
      if (result.success) {
        toast({ title: "Sucesso!", description: "Grupo do usuário atualizado." });
        onUserUpdated();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: result.error || "Ocorreu um erro ao atualizar o grupo.",
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atribuir Grupo: {user?.name}</DialogTitle>
          <DialogDescription>
            Selecione um grupo para este usuário ou remova-o de um grupo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">
                        Nenhum
                      </SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
