
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, insira seu nome.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (db) {
        // Create a document for the new user in the 'users' collection
        await setDoc(doc(db, "users", user.uid), {
          name: name,
          email: user.email,
          role: 'vendedor', // Default role
          status: 'inactive', // Default status, requires admin approval
          createdAt: Timestamp.now(),
        });
      }

      toast({ title: "Registro enviado!", description: "Sua conta foi criada e aguarda aprovação de um administrador." });
      router.push("/login");
    } catch (error: any) {
        let description = "Ocorreu um erro ao criar sua conta.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Este e-mail já está em uso.";
        } else if (error.code === 'auth/weak-password') {
            description = "A senha deve ter pelo menos 6 caracteres.";
        }
      toast({
        variant: "destructive",
        title: "Erro no registro",
        description: description,
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
          <CardTitle>Criar Conta</CardTitle>
          <CardDescription>
            Crie sua conta de vendedor para começar.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
             <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Criando conta..." : "Registrar"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Já tem uma conta?{" "}
              <Link href="/login" className="underline hover:text-primary">
                Faça login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
