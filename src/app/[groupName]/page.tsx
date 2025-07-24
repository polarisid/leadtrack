
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, notFound } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getGroupInfoBySlug, captureLead } from '@/app/actions';
import { productCategories, Group, ProductCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { Target, CheckCircle } from 'lucide-react';

// To prevent this dynamic route from catching existing pages like /login, /admin, etc.
const RESERVED_PATHS = ['login', 'register', 'admin', 'dashboard', 'api', 'capture', 'assets', 'public', 'favicon.ico'];

const captureLeadSchema = z.object({
  name: z.string().min(2, "Seu nome deve ter pelo menos 2 caracteres."),
  city: z.string().min(2, "Sua cidade deve ter pelo menos 2 caracteres."),
  contact: z.string().min(10, "O contato com DDD deve ter pelo menos 10 dígitos."),
  desiredProduct: z.enum(productCategories),
  referredBy: z.string().optional(),
});

type CaptureLeadFormValues = z.infer<typeof captureLeadSchema>;

export default function LeadCapturePage() {
  const params = useParams();
  const groupSlug = params.groupName as string;
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<CaptureLeadFormValues>({
    resolver: zodResolver(captureLeadSchema),
    defaultValues: {
      name: "",
      city: "",
      contact: "",
      desiredProduct: "Outros",
      referredBy: "",
    },
  });

  useEffect(() => {
    if (!groupSlug || RESERVED_PATHS.includes(groupSlug)) {
        notFound();
    }

    getGroupInfoBySlug(groupSlug)
        .then(foundGroup => {
            if (!foundGroup) {
                notFound();
            }
            setGroup(foundGroup);
        })
        .catch(() => {
            notFound();
        })
        .finally(() => setIsLoading(false));
    
  }, [groupSlug]);
  
  const onSubmit = (values: CaptureLeadFormValues) => {
    if (!group?.id) return;
    startTransition(async () => {
      const result = await captureLead(values, group.id);
      if (result.success) {
        setIsSubmitted(true);
      } else {
        if (result.error && typeof result.error === 'object') {
           const errors = result.error as any;
           if (errors.contact) {
             form.setError("contact", { type: "manual", message: errors.contact[0] });
           } else {
             toast({
               variant: "destructive",
               title: "Erro ao Enviar",
               description: "Ocorreu um erro. Tente novamente.",
             });
           }
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Target className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!group) {
    // This should be caught by notFound() in useEffect, but as a fallback.
    return null;
  }
  
  if (isSubmitted) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                     <div className="flex justify-center items-center mb-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl">Obrigado!</CardTitle>
                    <CardDescription>Seus dados foram enviados com sucesso. Um de nossos consultores do time <span className="font-bold">{group.name}</span> entrará em contato em breve.</CardDescription>
                </CardHeader>
            </Card>
        </div>
      )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Target className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">LeadTrack</h1>
          </div>
          <CardTitle>Cadastro de Lead</CardTitle>
          <CardDescription>
            Preencha seus dados para receber nosso contato. Você está sendo atendido pelo time <span className="font-bold text-primary">{group.name}</span>.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                            <Input placeholder="Seu nome" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                                <Input placeholder="Sua cidade" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="contact"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>WhatsApp (com DDD)</FormLabel>
                            <FormControl>
                                <Input type="tel" placeholder="(11) 99999-9999" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="desiredProduct"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Produto de Interesse</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto de interesse" />
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
                 <FormField
                    control={form.control}
                    name="referredBy"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Indicado por (Opcional)</FormLabel>
                        <FormControl>
                            <Input placeholder="Nome de quem indicou" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Enviando..." : "Enviar Meus Dados"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
