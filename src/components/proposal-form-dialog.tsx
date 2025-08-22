
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Client, ProposalFormValues, ProposalSchema, InstallationService } from "@/lib/types";
import { Loader2, Trash2, PlusCircle, FileDown, UploadCloud, X, Wrench, Check } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from "@/context/auth-context";
import { getBrandingSettings, getInstallationServices } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";
import Image from "next/image";
import { Checkbox } from "./ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Textarea } from "./ui/textarea";


interface ProposalFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function ProposalFormDialog({ isOpen, onOpenChange, client }: ProposalFormDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userProfile } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isBrandingLoading, setIsBrandingLoading] = useState(true);
  const [availableServices, setAvailableServices] = useState<InstallationService[]>([]);

  const wrenchIconBase64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXdyZW5jaCI+PHBhdGggZD0iTTIuOSA2LjFsMi0yTDcuMyA3LjVsNiA5bC0zLTN6Ii8+PHBhdGggZD0iTTEzIDEzbGw2IDZjMSAxIDIuNSAxIDQgMGwxLjgtMS44Yy41LS40LjUtMS4xIDAtMS41TDE4IDEybC01LTUgMS0xTDMgMyAxIDEzLjVMMTggMThjLjQuNC40IDEgMCAxLjVsLTEuOCAxLjhjLTEgMS0yLjUgMS00IDBsLTYtNnoiLz48cGF0aCBkPSJtMTIuNSA4LjUtNS40IDUuNCIvPjwvc3ZnPg==";

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(ProposalSchema),
    defaultValues: {
        products: [{ name: "", quantity: 1, cashPrice: 0, photoUrl: "" }],
        proposalDate: new Date(),
        includedServices: [],
        observations: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });
  
  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
      control: form.control,
      name: "includedServices",
  });

  useEffect(() => {
    if (isOpen) {
      setIsBrandingLoading(true);
      form.reset({
        products: [{ name: "", quantity: 1, cashPrice: 0, sku: "", installmentPriceTotal: undefined, installments: undefined, photoUrl: "" }],
        proposalDate: new Date(),
        includedServices: [],
        observations: "",
      });
      getBrandingSettings().then(settings => {
          if(settings?.logoUrl) {
              setLogoUrl(settings.logoUrl);
          }
          if(settings?.companyName) {
              setCompanyName(settings.companyName);
          }
      }).catch(() => {
          // Silently fail, as branding is optional
      }).finally(() => {
          setIsBrandingLoading(false);
      });
      getInstallationServices().then(setAvailableServices);
    } else {
        setLogoUrl(null);
        setCompanyName(null);
    }
  }, [isOpen, form]);

  const generateProposalHtml = (values: ProposalFormValues) => {
    let productsHtml = "";
    values.products.forEach((product, index) => {
        const totalCashPrice = product.cashPrice * product.quantity;
        const cashPriceFormatted = totalCashPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const unitCashPriceFormatted = product.cashPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let installmentText = "";
        if (product.installmentPriceTotal && product.installments) {
            const totalInstallmentPrice = product.installmentPriceTotal * product.quantity;
            const installmentValue = (totalInstallmentPrice / product.installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            installmentText = `ou em ${product.installments}x de ${installmentValue} (total a prazo: ${totalInstallmentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
        }

        const imageHtml = product.photoUrl
          ? `<img src="${product.photoUrl}" style="width: 100px; height: auto; margin-right: 20px; object-fit: contain;" />`
          : '';
        
        productsHtml += `
            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; display: flex; align-items: flex-start;">
                ${imageHtml}
                <div style="flex: 1;">
                    <h3 style="font-size: 16px; color: #000000; font-weight: bold; margin-top: 0; margin-bottom: 10px;">${product.name}</h3>
                    <p style="margin: 5px 0;"><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
                    <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${product.quantity}</p>
                    <p style="margin: 5px 0;"><strong>Valor à Vista:</strong> ${cashPriceFormatted} (${unitCashPriceFormatted} / un)</p>
                    ${installmentText ? `<p style="margin: 5px 0;"><strong>Opção a Prazo:</strong> ${installmentText}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    const headerContent = logoUrl
      ? `<img id="pdf-logo" src="${logoUrl}" alt="Logo" style="max-height: 240px; max-width: 450px; height: auto; width: auto;"/>`
      : `<h2 style="font-size: 24px; color: #000000; font-weight: bold;">${companyName || "Smart Center Samsung Aracaju"}</h2>`;

    let servicesHtml = "";
    if (values.includedServices && values.includedServices.length > 0) {
      servicesHtml += `
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; display: flex; align-items: flex-start;">
          <img src="${wrenchIconBase64}" style="width: 20px; height: 20px; margin-right: 12px; margin-top: 4px;" />
          <div style="flex: 1;">
            <h3 style="font-size: 16px; color: #000000; font-weight: bold; margin: 0 0 10px 0;">Serviços Inclusos</h3>`;

      values.includedServices.forEach(service => {
        const priceText = `<strong style="color: #22c55e;">Cortesia</strong>`;
        servicesHtml += `
          <div style="margin-bottom: 10px;">
            <p style="margin: 5px 0;"><strong>${service.name}:</strong> ${priceText}</p>
            ${service.termsUrl ? `<a href="${service.termsUrl}" target="_blank" style="font-size: 12px; color: #007bff; text-decoration: none;">Ver Termos e Condições</a>` : ''}
          </div>
        `;
      });

      servicesHtml += `
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #555;"><em>* Instalação do produto não inclui serviços de alvenaria, marcenaria, etc.</em></p>
          </div>
        </div>
      `;
    }

    let observationsHtml = "";
    if (values.observations) {
        observationsHtml = `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                <h3 style="font-size: 16px; color: #000000; font-weight: bold; margin: 0 0 10px 0;">Observações</h3>
                <p style="white-space: pre-wrap; font-size: 14px; color: #333;">${values.observations}</p>
            </div>
        `;
    }

    return `
      <div id="pdf-content" style="font-family: Arial, sans-serif; color: #333; padding: 40px; width: 210mm; min-height: 297mm; background-color: white;">
        <div style="text-align: center; margin-bottom: 30px; height: 120px; display: flex; align-items: center; justify-content: center;">
          ${headerContent}
        </div>
        <h1 style="color: #000000; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 20px; text-align: center; font-size: 20px; font-weight: bold;">Proposta Comercial</h1>
        <div style="margin-bottom: 30px; font-size: 14px;">
            <p><strong>Data da Proposta:</strong> ${new Date(values.proposalDate).toLocaleDateString('pt-BR')}</p>
            <p><strong>Cliente:</strong> ${client?.name}</p>
        </div>
        ${productsHtml}
        ${servicesHtml}
        ${observationsHtml}
        <div style="margin-top: 40px; font-size: 12px; color: #555;">
            <p>Agradecemos a sua preferência!</p>
            <p>Proposta valida por 24h ou enquanto durarem os estoques.</p>
        </div>
        <div style="position: absolute; bottom: 40px; left: 40px; right: 40px; text-align: center; font-size: 12px; color: #777;">
            ${userProfile?.name ? `<p style="margin-top: 5px;">Vendedor(a): ${userProfile.name}</p>` : ''}
            <p>Proposta gerada por LeadTrack</p>
        </div>
      </div>
    `;
  }

  const handleExportPdf = (values: ProposalFormValues) => {
    if (!client) {
        toast({ variant: "destructive", title: "Cliente não encontrado" });
        return;
    }
    setIsSubmitting(true);
    
    const container = document.createElement("div");
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.innerHTML = generateProposalHtml(values);
    document.body.appendChild(container);

    const contentToConvert = document.getElementById('pdf-content');
    
    const captureCanvas = () => {
       if (!contentToConvert) {
          toast({ variant: "destructive", title: "Erro ao gerar PDF", description: "Conteúdo não encontrado." });
          setIsSubmitting(false);
          document.body.removeChild(container);
          return;
       }
       
       const imageElements = Array.from(contentToConvert.getElementsByTagName('img'));
       const imagePromises = imageElements.map(img => {
           return new Promise<void>((resolve, reject) => {
               if (img.complete) {
                   resolve();
                   return;
               }
               const newImage = new window.Image();
               newImage.crossOrigin = "anonymous";
               newImage.src = img.src;
               newImage.onload = () => {
                   img.src = newImage.src;
                   resolve();
               };
               newImage.onerror = () => {
                   console.error(`Could not load image: ${img.src}`);
                   resolve(); // Resolve anyway to not block PDF generation
               };
           });
       });


       Promise.all(imagePromises).then(() => {
           html2canvas(contentToConvert, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
                width: contentToConvert.scrollWidth,
                height: contentToConvert.scrollHeight,
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`proposta_${client.name.replace(/\s/g, '_')}.pdf`);
                
                toast({ title: "PDF Gerado!", description: "Sua proposta será baixada em breve."});
                onOpenChange(false);
            }).catch(err => {
                console.error("PDF generation error:", err);
                toast({ variant: "destructive", title: "Erro ao gerar PDF" });
            }).finally(() => {
                if (document.body.contains(container)) {
                  document.body.removeChild(container);
                }
                setIsSubmitting(false);
            });
       }).catch(err => {
            console.error("Error pre-loading images for canvas:", err);
            toast({ variant: "destructive", title: "Erro ao carregar imagens", description: "Não foi possível carregar as imagens para o PDF."});
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            setIsSubmitting(false);
       });
    }

    setTimeout(captureCanvas, 500);
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, index: number, fieldName: 'cashPrice' | 'installmentPriceTotal') => {
    const value = e.target.value;
    const sanitizedValue = value.replace("R$", "").trim().replace(/\./g, "").replace(",", ".");
    form.setValue(`products.${index}.${fieldName}`, parseFloat(sanitizedValue) || 0, { shouldValidate: true });
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "O tamanho máximo da imagem é 2MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue(`products.${index}.photoUrl`, reader.result as string, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar Proposta em PDF para {client?.name}</DialogTitle>
          <DialogDescription>
            Adicione os produtos e os detalhes para gerar la proposta em PDF.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
            <form id="proposal-form" onSubmit={form.handleSubmit(handleExportPdf)} className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {isBrandingLoading ? <Skeleton className="h-10 w-full" /> : fields.map((field, index) => {
                    const photoUrlValue = form.watch(`products.${index}.photoUrl`);
                    return (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-card">
                         <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-md">Produto {index + 1}</h4>
                            {fields.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="h-7 w-7"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name={`products.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Nome do Produto</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Ex: TV 55 polegadas" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`products.${index}.quantity`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantidade</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} min="1" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name={`products.${index}.sku`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="SKU123" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`products.${index}.cashPrice`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor Unitário à Vista (R$)</FormLabel>
                                    <FormControl>
                                        <Input type="text" value={(field.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} onChange={(e) => handlePriceChange(e, index, 'cashPrice')} placeholder="3.043,80"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={`products.${index}.installmentPriceTotal`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor Unitário a Prazo (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="text" value={field.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? ''} onChange={(e) => handlePriceChange(e, index, 'installmentPriceTotal')} placeholder="3.205,00"/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`products.${index}.installments`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nº de Parcelas</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => form.setValue(`products.${index}.installments`, parseInt(e.target.value) || undefined)} placeholder="10" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>
                         <FormField
                            control={form.control}
                            name={`products.${index}.photoUrl`}
                            render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem>
                                    <FormLabel>Foto do Produto (Opcional)</FormLabel>
                                    <div className="relative flex items-center justify-center w-full">
                                        <label htmlFor={`file-upload-${index}`} className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                                            {photoUrlValue ? (
                                                <>
                                                    <Image src={photoUrlValue} alt="Prévia da imagem" layout="fill" objectFit="contain" className="rounded-lg p-2" />
                                                    <Button 
                                                        type="button"
                                                        variant="destructive" 
                                                        size="icon" 
                                                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            onChange("");
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para enviar</span></p>
                                                    <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP (Max. 2MB)</p>
                                                </div>
                                            )}
                                            <Input id={`file-upload-${index}`} type="file" className="hidden" onChange={(e) => handleFileChange(e, index)} accept="image/png, image/jpeg, image/webp" {...rest} />
                                        </label>
                                    </div>
                                </FormItem>
                            )}
                         />
                    </div>
                )})}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", quantity: 1, cashPrice: 0, sku: "", installmentPriceTotal: undefined, installments: undefined, photoUrl: "" })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Outro Produto
                </Button>

                <div className="space-y-2 pt-4">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="services">
                            <AccordionTrigger>
                                Serviços Inclusos (Opcional)
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2 p-1">
                                    <Controller
                                        control={form.control}
                                        name="includedServices"
                                        render={({ field }) => (
                                            <>
                                                {availableServices.map((service) => (
                                                    <div key={service.id} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={service.id}
                                                            checked={(field.value || []).some(s => s.id === service.id)}
                                                            onCheckedChange={(checked) => {
                                                                const currentServices = field.value || [];
                                                                if (checked) {
                                                                    field.onChange([...currentServices, { id: service.id, name: service.name, price: service.price, termsUrl: service.termsUrl }]);
                                                                } else {
                                                                    field.onChange(currentServices.filter(s => s.id !== service.id));
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={service.id}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            {service.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    />
                                    {availableServices.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center">Nenhum serviço disponível.</p>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
                 <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Observações (Opcional)</FormLabel>
                            <FormControl>
                                <Textarea
                                placeholder="Adicione qualquer observação relevante para a proposta..."
                                {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
            </form>
        </Form>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="proposal-form" disabled={isSubmitting || isBrandingLoading}>
            {isSubmitting || isBrandingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Gerar PDF da Proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
