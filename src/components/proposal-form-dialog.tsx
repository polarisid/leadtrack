
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
import { Client, ProposalFormValues, ProposalSchema } from "@/lib/types";
import { Loader2, Trash2, PlusCircle, FileDown } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from "@/context/auth-context";
import { getBrandingSettings } from "@/app/actions";
import { Skeleton } from "./ui/skeleton";


interface ProposalFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function ProposalFormDialog({ isOpen, onOpenChange, client }: ProposalFormDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, userProfile } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isBrandingLoading, setIsBrandingLoading] = useState(true);

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(ProposalSchema),
    defaultValues: {
        products: [{ name: "", cashPrice: 0 }],
        proposalDate: new Date(),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  useEffect(() => {
    if (isOpen) {
      setIsBrandingLoading(true);
      form.reset({
        products: [{ name: "", cashPrice: 0, sku: "", installmentPriceTotal: undefined, installments: undefined }],
        proposalDate: new Date(),
      });
      if (user) {
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
      } else {
        setIsBrandingLoading(false);
      }
    } else {
        setLogoUrl(null);
        setCompanyName(null);
    }
  }, [isOpen, form, user]);

  const generateProposalHtml = (values: ProposalFormValues) => {
    let productsHtml = "";
    values.products.forEach((product, index) => {
        const cashPriceFormatted = product.cashPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        let installmentText = "";
        if (product.installmentPriceTotal && product.installments) {
            const installmentValue = (product.installmentPriceTotal / product.installments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            installmentText = `ou em ${product.installments}x de ${installmentValue} (total a prazo: ${product.installmentPriceTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
        }
        
        productsHtml += `
            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                <h3 style="font-size: 16px; color: #000000; font-weight: bold; margin-bottom: 10px;">Produto ${index + 1}: ${product.name}</h3>
                <p style="margin: 5px 0;"><strong>SKU:</strong> ${product.sku || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Valor à Vista:</strong> ${cashPriceFormatted}</p>
                ${installmentText ? `<p style="margin: 5px 0;"><strong>Opção a Prazo:</strong> ${installmentText}</p>` : ''}
            </div>
        `;
    });
    
    const headerContent = logoUrl
      ? `<img id="pdf-logo" src="${logoUrl}" alt="Logo" style="max-height: 236.25px; max-width: 596.25px; height: auto; width: auto;"/>`
      : `<h2 style="font-size: 24px; color: #005f73;">${companyName || "Smart Center Samsung Aracaju"}</h2>`;


    return `
      <div id="pdf-content" style="font-family: Arial, sans-serif; color: #333; padding: 40px; width: 210mm; min-height: 297mm; background-color: white;">
        <div style="text-align: center; margin-bottom: 30px; height: 80px; display: flex; align-items: center; justify-content: center;">
          ${headerContent}
        </div>
        <h1 style="color: #005f73; border-bottom: 2px solid #005f73; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">Proposta Comercial</h1>
        <div style="margin-bottom: 30px; font-size: 14px;">
            <p><strong>Data da Proposta:</strong> ${new Date(values.proposalDate).toLocaleDateString('pt-BR')}</p>
            <p><strong>Cliente:</strong> ${client?.name}</p>
        </div>
        ${productsHtml}
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
       
       const logoImage = document.getElementById('pdf-logo') as HTMLImageElement | null;
       const imagePromises: Promise<void>[] = [];
       if (logoImage) {
           const promise = new Promise<void>((resolve, reject) => {
               const newImage = new Image();
               newImage.crossOrigin = "anonymous";
               newImage.src = logoImage.src;
               newImage.onload = () => {
                   logoImage.src = newImage.src;
                   resolve();
               };
               newImage.onerror = reject;
           });
           imagePromises.push(promise);
       }

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
            console.error("Error pre-loading image for canvas:", err);
            toast({ variant: "destructive", title: "Erro ao carregar o logo", description: "Não foi possível carregar la imagem do logo para o PDF."});
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
                {isBrandingLoading ? <Skeleton className="h-10 w-full" /> : fields.map((field, index) => (
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
                        <FormField
                            control={form.control}
                            name={`products.${index}.name`}
                            render={({ field }) => (
                                <FormItem>
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
                         <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name={`products.${index}.cashPrice`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor à Vista (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="text" {...field} value={field.value.toLocaleString('pt-BR')} onChange={(e) => handlePriceChange(e, index, 'cashPrice')} placeholder="3.043,80"/>
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
                                name={`products.${index}.installmentPriceTotal`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor Total a Prazo (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="text" {...field} value={field.value?.toLocaleString('pt-BR') ?? ''} onChange={(e) => handlePriceChange(e, index, 'installmentPriceTotal')} placeholder="3.205,00"/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", cashPrice: 0, sku: "", installmentPriceTotal: undefined, installments: undefined })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Outro Produto
                </Button>
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
