
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UnifiedLoginPage() {
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSellerLoading, setIsSellerLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSellerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSellerLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, sellerEmail, sellerPassword);
      const user = userCredential.user;

      if (db) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists() && userDoc.data().status === 'inactive') {
          await signOut(auth);
          toast({
            variant: "destructive",
            title: "Acesso Negado",
            description: "Sua conta está inativa. Entre em contato com o administrador.",
          });
          return;
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
      setIsSellerLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;

      if (db) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            await signOut(auth);
            toast({
                variant: "destructive",
                title: "Acesso Negado",
                description: "Você não tem permissão de administrador.",
            });
            return;
        }

        if (userDoc.data().status === 'inactive') {
          await signOut(auth);
          toast({
            variant: "destructive",
            title: "Acesso Negado",
            description: "Sua conta de administrador está inativa.",
          });
          return;
        }
      }

      toast({ title: "Login de administrador bem-sucedido!" });
      router.push("/admin/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: "Verifique suas credenciais de administrador.",
      });
    } finally {
      setIsAdminLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
        <Tabs defaultValue="vendedor" className="w-full max-w-sm">
            <Card>
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center items-center gap-2 mb-4">
                        <Target className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold">LeadTrack</h1>
                    </div>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="vendedor">Vendedor</TabsTrigger>
                        <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>
                </CardHeader>
                <TabsContent value="vendedor">
                    <form onSubmit={handleSellerLogin}>
                    <CardHeader className="pt-0">
                      <CardTitle className="text-2xl text-center">Login do Vendedor</CardTitle>
                      <CardDescription className="text-center">
                        Acesse sua conta para gerenciar seus clientes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                        <Label htmlFor="seller-email">Email</Label>
                        <Input
                            id="seller-email"
                            type="email"
                            placeholder="vendedor@email.com"
                            required
                            value={sellerEmail}
                            onChange={(e) => setSellerEmail(e.target.value)}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="seller-password">Senha</Label>
                        <Input
                            id="seller-password"
                            type="password"
                            required
                            value={sellerPassword}
                            onChange={(e) => setSellerPassword(e.target.value)}
                        />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={isSellerLoading}>
                        {isSellerLoading ? "Entrando..." : "Entrar"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                        Não tem uma conta?{" "}
                        <Link href="/register" className="underline hover:text-primary">
                            Registre-se
                        </Link>
                        </p>
                    </CardFooter>
                    </form>
                </TabsContent>
                <TabsContent value="admin">
                    <form onSubmit={handleAdminLogin}>
                    <CardHeader className="pt-0">
                       <CardTitle className="text-2xl text-center">Login do Admin</CardTitle>
                       <CardDescription className="text-center">
                        Acesse o painel de controle.
                       </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                            id="admin-email"
                            type="email"
                            placeholder="admin@email.com"
                            required
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                        />
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="admin-password">Senha</Label>
                        <Input
                            id="admin-password"
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                        />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isAdminLoading}>
                        {isAdminLoading ? "Entrando..." : "Entrar"}
                        </Button>
                    </CardFooter>
                    </form>
                </TabsContent>
            </Card>
        </Tabs>
    </div>
  );
}
