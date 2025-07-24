
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageTemplate } from "@/lib/types";
import { createMessageTemplate, updateMessageTemplate } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  content: z.string().min(10, "O conteúdo do template deve ter pelo menos 10 caracteres."),
});

type TemplateFormValues = z.infer<typeof formSchema>;

interface TemplateEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  template?: MessageTemplate | null;
  onTemplateUpdated: () => void;
}

export function TemplateEditDialog({ isOpen, onOpenChange, template, onTemplateUpdated }: TemplateEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", content: "" },
  });

  useEffect(() => {
    if (template) {
      form.reset({ title: template.title, content: template.content });
    } else {
      form.reset({ title: "", content: "" });
    }
  }, [template, form, isOpen]);

  const onSubmit = (values: TemplateFormValues) => {
    if (!adminUser) return;

    startTransition(async () => {
      const result = template
        ? await updateMessageTemplate(template.id, values, adminUser.uid)
        : await createMessageTemplate(values, adminUser.uid);

      if (result.success) {
        toast({ title: "Sucesso!", description: `Template ${template ? 'atualizado' : 'criado'} com sucesso.` });
        onTemplateUpdated();
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Criar Novo Template"}</DialogTitle>
          <DialogDescription>
            Crie mensagens rápidas para o WhatsApp. Use `&lt;cliente&gt;` para inserir o nome do cliente automaticamente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Template</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pós-venda" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conteúdo da Mensagem</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Olá <cliente>, tudo bom? ..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
