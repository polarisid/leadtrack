
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, notFound } from 'next/navigation';
import { getOfferById } from '@/app/actions';
import { Offer } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, BadgePercent, Calendar, CheckCircle, Copy, Flame, ShoppingCart, Sparkles, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function OfferSkeleton() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-muted p-4">
            <Card className="w-full max-w-md animate-pulse">
                <Skeleton className="h-64 w-full rounded-t-lg" />
                <CardHeader>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-12 w-1/3 mb-4" />
                    <Skeleton className="h-6 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-12 w-full" />
                </CardFooter>
            </Card>
        </div>
    );
}

export default function OfferPage() {
    const params = useParams();
    const offerId = params.id as string;
    const { toast } = useToast();

    const [offer, setOffer] = useState<Offer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOffer = () => {
        if (!offerId) return;
        getOfferById(offerId)
            .then(data => {
                if (!data || data.status !== 'approved') {
                    notFound();
                }
                setOffer(data);
            })
            .catch(() => {
                setError('Ocorreu um erro ao buscar a oferta.');
            })
            .finally(() => setIsLoading(false));
    };

    useEffect(() => {
        fetchOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offerId]);

    const handleCopy = (textToCopy: string, fieldName: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({ title: `${fieldName} copiado!`, description: `O ${fieldName.toLowerCase()} foi copiado para sua área de transferência.` });
        }, () => {
            toast({ variant: "destructive", title: "Erro", description: `Não foi possível copiar o ${fieldName.toLowerCase()}.` });
        });
    };

    if (isLoading) {
        return <OfferSkeleton />;
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    if (!offer) {
        return null; // Should be caught by notFound, but as a fallback.
    }

    const isExpired = isPast(new Date(offer.validUntil));

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted p-4">
            <Card className="w-full max-w-lg overflow-hidden">
                {isExpired && (
                    <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full z-10">
                        OFERTA EXPIRADA
                    </div>
                )}
                {offer.photoUrl && (
                    <div className="aspect-video relative w-full">
                        <Image src={offer.photoUrl} alt={offer.title} layout="fill" objectFit="cover" />
                    </div>
                )}
                <CardHeader>
                    <CardDescription className='font-semibold text-primary'>{offer.category}</CardDescription>
                    <CardTitle className="text-3xl">{offer.title}</CardTitle>
                    {offer.sku && <CardDescription>SKU: {offer.sku}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-5xl font-extrabold text-foreground">
                        {offer.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    {offer.coupon && (
                       <div className="flex items-center gap-2 text-sm p-3 bg-primary/10 rounded-lg">
                           <BadgePercent className="h-5 w-5 text-primary" />
                           <span className='text-muted-foreground'>Use o cupom:</span>
                           <span className="font-semibold text-foreground">{offer.coupon}</span>
                           <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => handleCopy(offer.coupon, 'Cupom')}>
                               <Copy className="h-4 w-4" />
                           </Button>
                       </div>
                    )}
                    <div className={cn("flex items-center text-sm", isExpired ? 'text-destructive' : 'text-muted-foreground')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Válido até {format(new Date(offer.validUntil), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full text-lg py-6" size="lg" disabled={isExpired}>
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Eu quero!
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
