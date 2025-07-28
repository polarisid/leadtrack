
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
import { useTransition, useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, UploadCloud, X, Link as LinkIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'link'>('upload');


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

  const photoUrlValue = form.watch("photoUrl");

  useEffect(() => {
    if (offerToEdit && isOpen) {
      form.reset({
        ...offerToEdit,
        price: offerToEdit.price,
        validUntil: parseISO(offerToEdit.validUntil),
        category: offerToEdit.category,
      });
      if (offerToEdit.photoUrl) {
        setPreview(offerToEdit.photoUrl);
        // Determine mode based on photoUrl content
        setUploadMode(offerToEdit.photoUrl.startsWith('data:image') ? 'upload' : 'link');
      }
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
      setPreview(null);
      setUploadMode('upload');
    }
  }, [offerToEdit, isOpen, form]);

   useEffect(() => {
    // Only update preview from photoUrlValue if it's a valid URL or data URI
    if (photoUrlValue && (photoUrlValue.startsWith('http') || photoUrlValue.startsWith('data:image'))) {
        setPreview(photoUrlValue);
    } else if (!photoUrlValue) {
        setPreview(null);
    }
  }, [photoUrlValue]);
  
  const handleClose = () => {
    form.reset();
    setPreview(null);
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
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "O tamanho máximo da imagem é 2MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("photoUrl", reader.result as string, { shouldValidate: true });
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const sanitizedValue = value.replace("R$", "").trim().replace(/\./g, "").replace(",", ".");
    form.setValue("price", parseFloat(sanitizedValue) || 0, { shouldValidate: true });
  }

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
                        <Input type="text" placeholder="1.599,90" value={field.value} onChange={handlePriceChange} />
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
             
             <FormItem>
                <FormLabel>Arte da Oferta (Opcional)</FormLabel>
                <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">Fazer Upload</TabsTrigger>
                        <TabsTrigger value="link">Usar um Link</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload">
                         <FormField
                            control={form.control}
                            name="photoUrl"
                            render={({ field }) => (
                                <FormItem>
                                <FormControl>
                                <div className="relative flex items-center justify-center w-full">
                                        <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                            {preview && uploadMode === 'upload' ? (
                                                <>
                                                    <Image src={preview} alt="Prévia da imagem" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                                                    <Button 
                                                        variant="destructive" 
                                                        size="icon" 
                                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setPreview(null);
                                                            field.onChange("");
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para enviar</span> ou arraste</p>
                                                    <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP (Max. 2MB)</p>
                                                </div>
                                            )}
                                            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
                                        </label>
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                    </TabsContent>
                    <TabsContent value="link">
                        <FormField
                        control={form.control}
                        name="photoUrl"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="https://exemplo.com/imagem.png"
                                        {...field}
                                        className="pl-10"
                                        onChange={(e) => {
                                            field.onChange(e.target.value);
                                            setPreview(e.target.value);
                                        }}
                                     />
                                </div>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        {preview && uploadMode === 'link' && (
                             <div className="mt-4 relative w-full h-32">
                                <Image src={preview} alt="Prévia do link" layout="fill" objectFit="contain" className="rounded-lg" />
                             </div>
                        )}
                    </TabsContent>
                </Tabs>
             </FormItem>


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
