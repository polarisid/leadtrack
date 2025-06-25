
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
import { UserProfile, userRoles } from "@/lib/types";
import { updateUserRole } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  role: z.enum(userRoles),
});

type UserFormValues = z.infer<typeof formSchema>;

interface UserEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onUserUpdated: () => void;
}

export function UserEditDialog({ isOpen, onOpenChange, user, onUserUpdated }: UserEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (user) {
      form.reset({ role: user.role });
    }
  }, [user, form, isOpen]);


  const onSubmit = (values: UserFormValues) => {
    if (!adminUser || !user) {
        toast({ variant: "destructive", title: "Erro", description: "Ação não permitida." });
        return;
    }

    startTransition(async () => {
      const result = await updateUserRole(user.id, values.role, adminUser.uid);
      if (result.success) {
        toast({ title: "Sucesso!", description: "Função do usuário atualizada." });
        onUserUpdated();
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
          <DialogTitle>Editar Usuário: {user?.name}</DialogTitle>
          <DialogDescription>
            Altere a função do usuário no sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
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
