
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
    // Allow access to the admin login page itself
    if (pathname === '/admin/login') {
      return;
    }
    
    // If not loading and not an admin, redirect to the admin login page.
    if (!loading && !isAdmin) {
      router.replace('/admin/login');
    }
  }, [user, loading, isAdmin, router, pathname]);

  // If trying to access a protected page while loading, show a skeleton.
  if (loading && pathname !== '/admin/login') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Skeleton className="h-20 w-20 rounded-full" />
      </div>
    );
  }

  // Allow access to admin login page for anyone, or to children for authenticated admins
  if (pathname === '/admin/login' || isAdmin) {
    return <>{children}</>;
  }


  // This return is a fallback, but the useEffect should handle redirection.
  // Returning null or a loader is fine while redirecting.
  return null;
}
