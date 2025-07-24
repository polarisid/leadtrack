import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';

export const metadata: Metadata = {
  title: 'LeadTrack',
  description: 'Gerencie seus clientes de forma eficiente.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  if (!isFirebaseConfigured) {
    return (
      <html lang="pt-BR">
        <head>
          <title>Erro de Configuração do Firebase</title>
          <meta charSet="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
        </head>
        <body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9fafb', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, padding: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid #ef4444', borderRadius: '0.5rem', backgroundColor: '#ffffff', maxWidth: '42rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '1rem' }}>Erro: Configuração do Firebase Incompleta</h1>
            <p style={{ marginBottom: '1rem' }}>
              A conexão com o Firebase não pôde ser estabelecida. O erro <code style={{ backgroundColor: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>auth/invalid-api-key</code> indica que as credenciais do seu projeto estão ausentes ou são inválidas.
            </p>
            <div style={{ textAlign: 'left', backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '0.5rem' }}>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>Para corrigir, siga estes passos:</p>
              <ol style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                <li style={{ marginBottom: '1rem' }}>Na raiz do seu projeto, crie um arquivo chamado <code style={{ backgroundColor: '#e5e7eb', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>.env.local</code>.</li>
                <li>
                  Copie o conteúdo abaixo para esse arquivo e substitua os valores pelos do seu projeto Firebase:
                  <pre style={{ backgroundColor: '#e5e7eb', padding: '0.5rem', borderRadius: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', overflowX: 'auto' }}><code style={{ fontFamily: 'monospace' }}>{
`NEXT_PUBLIC_FIREBASE_API_KEY=SUA_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=SEU_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=SEU_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=SEU_APP_ID`
                  }</code></pre>
                </li>
              </ol>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
      </head>
      <body className="bg-background text-foreground antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
