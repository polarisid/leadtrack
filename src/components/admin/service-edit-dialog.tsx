
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
import { InstallationService } from "@/lib/types";
import { createInstallationService, updateInstallationService } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

const serviceFormSchema = z.object({
  name: z.string().min(3, "O nome do serviço deve ter pelo menos 3 caracteres."),
  price: z.number().min(0, "O valor não pode ser negativo."),
  termsUrl: z.string().url("A URL dos termos é inválida.").optional().or(z.literal('')),
});

type ServiceFormValues = z.infer<typeof serviceFormSchema>;

interface ServiceEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  service?: InstallationService | null;
  onServiceUpdated: () => void;
}

export function ServiceEditDialog({ isOpen, onOpenChange, service, onServiceUpdated }: ServiceEditDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: { name: "", price: 0, termsUrl: "" },
  });

  useEffect(() => {
    if (service) {
      form.reset({ name: service.name, price: service.price, termsUrl: service.termsUrl || "" });
    } else {
      form.reset({ name: "", price: 0, termsUrl: "" });
    }
  }, [service, form, isOpen]);

  const onSubmit = (values: ServiceFormValues) => {
    if (!adminUser) return;

    startTransition(async () => {
      const result = service
        ? await updateInstallationService(service.id, values, adminUser.uid)
        : await createInstallationService(values, adminUser.uid);

      if (result.success) {
        toast({ title: "Sucesso!", description: `Serviço ${service ? 'atualizado' : 'criado'} com sucesso.` });
        onServiceUpdated();
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
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitizedValue = value.replace("R$", "").trim().replace(/\./g, "").replace(",", ".");
    form.setValue("price", parseFloat(sanitizedValue) || 0, { shouldValidate: true });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Editar Serviço" : "Criar Novo Serviço"}</DialogTitle>
          <DialogDescription>
            Gerencie os serviços que podem ser adicionados às propostas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Serviço</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Instalação de TV" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Padrão (R$)</FormLabel>
                  <FormControl>
                    <Input type="text" value={field.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} onChange={handlePriceChange} placeholder="0,00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="termsUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL dos Termos (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://samsung.com/termos.pdf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Serviço'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
