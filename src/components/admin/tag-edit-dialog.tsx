
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
import { Tag } from "@/lib/types";
import { createTag, updateTag } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  name: z.string().min(2, "O nome da tag deve ter pelo menos 2 caracteres."),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use o formato hexadecimal (ex: #RRGGBB)."),
});

type TagFormValues = z.infer<typeof formSchema>;

interface TagEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  onTagUpdated: () => void;
}

export function TagEditDialog({ isOpen, onOpenChange, tag, onTagUpdated }: TagEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<TagFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", color: "#888888" },
  });

  useEffect(() => {
    if (tag) {
      form.reset({ name: tag.name, color: tag.color });
    } else {
      form.reset({ name: "", color: "#888888" });
    }
  }, [tag, form, isOpen]);

  const onSubmit = (values: TagFormValues) => {
    if (!adminUser) return;

    startTransition(async () => {
      const result = tag
        ? await updateTag(tag.id, values, adminUser.uid)
        : await createTag(values, adminUser.uid);

      if (result.success) {
        toast({ title: "Sucesso!", description: `Tag ${tag ? 'atualizada' : 'criada'} com sucesso.` });
        onTagUpdated();
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

  const colorValue = form.watch("color");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tag ? "Editar Tag" : "Criar Nova Tag"}</DialogTitle>
          <DialogDescription>
            Gerencie as tags para categorizar seus clientes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Tag</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: VIP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                   <div className="flex items-center gap-2">
                    <Input type="color" {...field} className="p-1 h-10 w-14" />
                    <Input placeholder="#RRGGBB" {...field} />
                   </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Tag'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
