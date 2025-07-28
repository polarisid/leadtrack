

"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "./ui/textarea";

interface SaleValueDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: number, productInfo: string) => void;
  isPending: boolean;
}

export function SaleValueDialog({ isOpen, onOpenChange, onConfirm, isPending }: SaleValueDialogProps) {
  const [saleValue, setSaleValue] = useState("");
  const [productInfo, setProductInfo] = useState("");
  const { toast } = useToast();

  const handleConfirm = () => {
    const value = parseFloat(saleValue);
    if (isNaN(value) || value <= 0) {
      toast({
        variant: "destructive",
        title: "Valor Inválido",
        description: "Por favor, insira um valor de venda positivo.",
      });
      return;
    }
    onConfirm(value, productInfo);
  };
  
  const handleOpenChange = (open: boolean) => {
      if (!open) {
          setSaleValue("");
          setProductInfo("");
      }
      onOpenChange(open);
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Registrar Venda</AlertDialogTitle>
          <AlertDialogDescription>
            Insira os detalhes da venda para registrar o fechamento do negócio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="saleValue">Valor da Venda (R$)</Label>
                <Input
                    id="saleValue"
                    type="number"
                    placeholder="Ex: 150.50"
                    value={saleValue}
                    onChange={(e) => setSaleValue(e.target.value)}
                    min="0.01"
                    step="0.01"
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="productInfo">Informações sobre o produto (Opcional)</Label>
                 <Textarea
                    id="productInfo"
                    placeholder="Ex: TV 55 polegadas, Samsung S23"
                    value={productInfo}
                    onChange={(e) => setProductInfo(e.target.value)}
                />
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Registrando..." : "Confirmar Venda"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
