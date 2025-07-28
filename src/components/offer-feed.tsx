
'use client';

import { useState, useTransition } from 'react';
import { Client, Offer, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, PlusCircle, CheckCircle, Clock, Share2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toggleOfferLike } from '@/app/actions';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import { OfferForm } from './offer-form';
import { OfferShareDialog } from './offer-share-dialog';

interface OfferFeedProps {
  offers: Offer[];
  isLoading: boolean;
  onOfferCreated: (newOffer: Offer) => void;
  onOfferLiked: (offerId: string, newLikedBy: string[]) => void;
  currentUserId: string;
  currentUserProfile: UserProfile | null;
  clients: Client[];
}

export function OfferFeed({ offers, isLoading, onOfferCreated, onOfferLiked, currentUserId, currentUserProfile, clients }: OfferFeedProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [likeTransition, startLikeTransition] = useTransition();
  const [offerToShare, setOfferToShare] = useState<Offer | null>(null);
  const { toast } = useToast();

  const handleLikeClick = (offerId: string, likedBy: string[]) => {
    if (!currentUserId) return;
    
    // Prevent multiple clicks while transition is pending
    if (likeTransition) return;

    const currentlyLiked = likedBy.includes(currentUserId);

    startLikeTransition(async () => {
      const result = await toggleOfferLike(offerId, currentUserId);
      if (result.success && result.likedBy) {
        onOfferLiked(offerId, result.likedBy);
        toast({
            title: currentlyLiked ? "Descurtido!" : "Oferta 'esquentou'!",
            description: currentlyLiked ? "Você removeu seu 'foguinho' da oferta." : "Você adicionou um 'foguinho' à oferta.",
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result.error,
        });
      }
    });
  };
  
  const handleShareClick = (offer: Offer) => {
    setOfferToShare(offer);
  };
  
  const handleCopy = (textToCopy: string, fieldName: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
        toast({ title: `${fieldName} copiado!`, description: `O ${fieldName.toLowerCase()} foi copiado para sua área de transferência.` });
    }, () => {
        toast({ variant: "destructive", title: "Erro", description: `Não foi possível copiar o ${fieldName.toLowerCase()}.` });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                <CardTitle>Feed de Ofertas</CardTitle>
                <CardDescription>Veja as últimas promoções ou sugira uma nova.</CardDescription>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Sugerir Oferta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <div className="h-40 bg-muted rounded-t-lg"></div>
                            <CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader>
                            <CardContent className="space-y-2">
                                <div className="h-4 bg-muted rounded w-1/2"></div>
                                <div className="h-4 bg-muted rounded w-1/4"></div>
                            </CardContent>
                            <CardFooter><div className="h-10 bg-muted rounded w-full"></div></CardFooter>
                        </Card>
                    ))}
                </div>
            ) : offers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Flame className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">Nenhuma oferta no momento</h3>
                    <p className="mt-2 text-sm">Seja o primeiro a sugerir uma!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {offers.map((offer) => {
                        const isLiked = offer.likedBy.includes(currentUserId);
                        const isExpired = isPast(new Date(offer.validUntil));
                        return (
                        <Card key={offer.id} className="flex flex-col">
                            {offer.photoUrl && (
                                <div className="aspect-video relative w-full">
                                    <Image
                                        src={offer.photoUrl}
                                        alt={offer.title}
                                        layout="fill"
                                        objectFit="cover"
                                        className="rounded-t-lg"
                                    />
                                </div>
                            )}
                            <CardHeader>
                                {offer.category && <Badge variant="secondary" className='mb-2 w-fit'>{offer.category}</Badge>}
                                <CardTitle>{offer.title}</CardTitle>
                                {offer.sku && (
                                    <div className="flex items-center gap-2">
                                        <CardDescription>SKU: {offer.sku}</CardDescription>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(offer.sku, 'SKU')}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="flex-grow space-y-2">
                               <p className="text-3xl font-bold">{offer.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                               {offer.coupon && (
                                   <div className="flex items-center gap-2 text-sm">
                                       <span>Use o cupom:</span>
                                       <span className="font-semibold p-1 rounded bg-secondary">{offer.coupon}</span>
                                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(offer.coupon, 'Cupom')}>
                                           <Copy className="h-3 w-3" />
                                       </Button>
                                   </div>
                               )}
                               <div className={cn("flex items-center text-sm", isExpired ? 'text-destructive' : 'text-muted-foreground')}>
                                  <Clock className="mr-2 h-4 w-4" />
                                  <span>Válido até: {format(new Date(offer.validUntil), 'dd/MM/yyyy')}</span>
                               </div>
                            </CardContent>
                            <CardFooter className="flex-col items-stretch gap-2">
                                <Button onClick={() => handleLikeClick(offer.id, offer.likedBy)} variant={isLiked ? "default" : "outline"} disabled={likeTransition}>
                                    <Flame className={cn("mr-2 h-5 w-5", isLiked && "fill-current text-orange-400")} />
                                    Esquentar ({offer.likedBy.length})
                                </Button>
                                <Button onClick={() => handleShareClick(offer)} variant="outline">
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Compartilhar
                                </Button>
                                {offer.status === 'pending' && <p className="text-xs text-center text-amber-600">Aguardando aprovação do admin</p>}
                            </CardFooter>
                        </Card>
                    )})}
                </div>
            )}
        </CardContent>
      </Card>
      
      <OfferForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onDataUpdated={onOfferCreated}
        currentUserProfile={currentUserProfile}
      />

      <OfferShareDialog
        isOpen={!!offerToShare}
        onOpenChange={() => setOfferToShare(null)}
        offer={offerToShare}
        clients={clients}
      />
    </div>
  );
}
