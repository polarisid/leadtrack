
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getClients } from '@/app/actions';
import { ClientsView } from '@/components/clients-view';
import { Skeleton } from '@/components/ui/skeleton';


export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
        <div className="flex flex-col flex-1">
            <header className="bg-card border-b sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                             <Skeleton className="h-6 w-6" />
                             <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </header>
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-4">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 w-[200px]" />
                </div>
                 <Skeleton className="w-full h-[400px]" />
            </main>
        </div>
    );
  }
  
  // O ideal seria passar `initialClients` como prop, mas como a busca depende do `user.uid`
  // que vem do client-side context, vamos chamar a `ClientsView` e deixar que ela busque os dados.
  return (
    <div className="flex-1 flex flex-col">
      <ClientsView />
    </div>
  );
}
