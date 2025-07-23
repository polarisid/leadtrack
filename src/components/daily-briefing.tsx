
"use client";

import { useAuth } from "@/context/auth-context";
import { DailySummaryOutput } from "@/lib/types";
import { useState, useTransition, useEffect } from "react";
import { getDailySummaryAction } from "@/app/actions";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Lightbulb, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { format, isToday, parseISO } from 'date-fns';

export function DailyBriefing() {
  const { user, userProfile } = useAuth();
  const [summary, setSummary] = useState<DailySummaryOutput | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const lastSummaryDate = userProfile?.dailySummary?.date;
  const hasTodaysSummary = lastSummaryDate ? isToday(parseISO(lastSummaryDate)) : false;

  useEffect(() => {
    if (userProfile?.dailySummary && hasTodaysSummary) {
        setSummary(userProfile.dailySummary.summary);
    }
  }, [userProfile, hasTodaysSummary]);


  const handleGenerateSummary = () => {
    if (!user?.uid || hasTodaysSummary) return;

    startGenerating(async () => {
        setError(null);
        const result = await getDailySummaryAction(user.uid);
        if (result.success && result.summary) {
            setSummary(result.summary);
            toast({ title: "Briefing diário gerado com sucesso!" });
        } else {
            setError(result.error || "Não foi possível gerar o resumo. Tente novamente mais tarde.");
            toast({ variant: "destructive", title: "Erro ao gerar briefing", description: result.error });
        }
    });
  };

  const renderContent = () => {
    if (isGenerating) {
        return (
            <div className="space-y-4 p-6 pt-0">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="pt-4 space-y-2">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
            </div>
        )
    }

    if (error) {
         return <p className="text-sm text-destructive text-center p-6">{error}</p>;
    }
    
    if (summary) {
        return (
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground italic">"{summary.overview}"</p>
                
                <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Leads em Destaque</h4>
                    <ul className="space-y-2">
                        {summary.hotLeads.map((lead, index) => (
                            <li key={index} className="flex items-start gap-3 text-sm">
                                <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">{lead.name}:</span>
                                    <span className="text-muted-foreground ml-1">{lead.reason}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                 <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Pontos de Atenção</h4>
                    <ul className="space-y-2">
                        {summary.leadsToWatch.map((lead, index) => (
                            <li key={index} className="flex items-start gap-3 text-sm">
                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <span className="font-semibold text-foreground">{lead.name}:</span>
                                    <span className="text-muted-foreground ml-1">{lead.reason}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="text-center pt-2">
                     <Button variant="secondary" size="sm" onClick={handleGenerateSummary} disabled={isGenerating || hasTodaysSummary}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : hasTodaysSummary ? <CheckCircle className="mr-2 h-4 w-4" /> : null}
                        {hasTodaysSummary ? "Briefing de hoje já gerado" : "Atualizar Briefing"}
                    </Button>
                </div>
            </CardContent>
        )
    }

    return (
         <CardContent className="flex flex-col items-center justify-center text-center p-8">
            <p className="text-muted-foreground mb-4">Receba um resumo inteligente da sua carteira para focar nas melhores oportunidades do dia.</p>
            <Button onClick={handleGenerateSummary} disabled={isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar Briefing do Dia com IA
            </Button>
        </CardContent>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Seu Briefing Diário
        </CardTitle>
        <CardDescription>
            Análise da sua carteira de clientes gerada por IA. {summary && lastSummaryDate && `Atualizado em: ${format(parseISO(lastSummaryDate), 'dd/MM/yyyy HH:mm')}`}
        </CardDescription>
      </CardHeader>
      {renderContent()}
    </Card>
  );
}
