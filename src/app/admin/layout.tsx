
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If not loading and not an admin, redirect to the main login page.
    if (!loading && !isAdmin) {
      router.replace('/login');
    }
  }, [user, loading, isAdmin, router, pathname]);

  // Show a loading screen while auth state is being determined.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Skeleton className="h-20 w-20 rounded-full" />
      </div>
    );
  }

  // If the user is an admin, render the content.
  // The useEffect will handle redirecting non-admins.
  if (isAdmin) {
    return <>{children}</>;
  }

  // This return is a fallback, but the useEffect should handle redirection.
  // Returning null or a loader is fine while redirecting.
  return null;
}
