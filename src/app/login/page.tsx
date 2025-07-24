
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Target } from "lucide-react";

export default function SellerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (db) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.status === 'inactive') {
            await signOut(auth);
            toast({
              variant: "destructive",
              title: "Acesso Negado",
              description: "Sua conta está inativa. Entre em contato com o administrador.",
            });
            setIsLoading(false);
            return;
          }

          if (userData.role === 'admin') {
            await signOut(auth);
            toast({
              variant: "destructive",
              title: "Login Inválido",
              description: "Esta é a página de login para vendedores. Use a página de login de administrador.",
            });
            setIsLoading(false);
            router.push('/admin/login');
            return;
          }
        }
      }
      
      toast({ title: "Login bem-sucedido!" });
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: "Verifique seu e-mail e senha.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Target className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">LeadTrack</h1>
          </div>
          <CardTitle className="text-2xl">Login do Vendedor</CardTitle>
          <CardDescription>
            Acesse sua conta para gerenciar seus clientes.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vendedor@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Não tem uma conta?{" "}
              <Link href="/register" className="underline hover:text-primary">
                Registre-se
              </Link>
            </p>
             <p className="text-xs text-muted-foreground">
              É um administrador?{" "}
              <Link href="/admin/login" className="underline hover:text-primary">
                Login de Admin
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
