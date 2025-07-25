
'use client';

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
import { Offer, OfferFormValues, OfferSchema, UserProfile, productCategories } from "@/lib/types";
import { createOffer, updateOffer } from "@/app/actions";
import { useTransition, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface OfferFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDataUpdated: () => void;
  currentUserProfile: UserProfile | null;
  offerToEdit?: Offer | null;
  isAdmin?: boolean;
}

export function OfferForm({ isOpen, onOpenChange, onDataUpdated, currentUserProfile, offerToEdit, isAdmin = false }: OfferFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<OfferFormValues>({
    resolver: zodResolver(OfferSchema),
    defaultValues: {
      title: "",
      sku: "",
      price: 0,
      coupon: "",
      photoUrl: "",
      validUntil: undefined,
      category: "Outros",
    },
  });

  useEffect(() => {
    if (offerToEdit && isOpen) {
      form.reset({
        ...offerToEdit,
        price: offerToEdit.price,
        validUntil: parseISO(offerToEdit.validUntil),
        category: offerToEdit.category,
      });
    } else if (isOpen) {
      form.reset({
        title: "",
        sku: "",
        price: 0,
        coupon: "",
        photoUrl: "",
        validUntil: undefined,
        category: "Outros",
      });
    }
  }, [offerToEdit, isOpen, form]);
  
  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  }

  const onSubmit = (values: OfferFormValues) => {
    if (!currentUserProfile) {
        toast({ variant: "destructive", title: "Erro", description: "Você precisa estar logado." });
        return;
    }
    
    startTransition(async () => {
        const result = offerToEdit
            ? await updateOffer(offerToEdit.id, values, currentUserProfile.id)
            : await createOffer(values, currentUserProfile.id, currentUserProfile.name, isAdmin);

        if (result.success) {
            toast({ title: "Sucesso!", description: `Oferta ${offerToEdit ? 'atualizada' : (isAdmin ? 'criada' : 'enviada para aprovação')}.` });
            onDataUpdated();
            handleClose();
        } else {
            toast({ variant: "destructive", title: "Erro", description: result.error });
        }
    });
  };

  const isEditMode = !!offerToEdit;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Oferta' : (isAdmin ? 'Criar Nova Oferta' : 'Sugerir Nova Oferta')}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Atualize os dados da oferta abaixo.' : (isAdmin ? 'Crie uma nova oferta que ficará visível para todos imediatamente.' : 'Preencha os dados da oferta. Ela será enviada para aprovação do administrador.')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da Oferta</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: TV 55 polegadas 4K" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria do produto" />
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
            <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço à Vista (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="1599.90" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem className="flex flex-col pt-2">
                      <FormLabel>Válido Até</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: ptBR })
                              ) : (
                                <span>Escolha uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="COD12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coupon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cupom (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="PROMO10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             </div>
             <FormField
                control={form.control}
                name="photoUrl"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>URL da Foto (Opcional)</FormLabel>
                    <FormControl>
                        <Input type="url" placeholder="https://exemplo.com/imagem.png" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : (isEditMode ? 'Salvar Alterações' : (isAdmin ? 'Criar Oferta' : 'Enviar para Aprovação'))}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
