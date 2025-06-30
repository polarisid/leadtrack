
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getSellerPerformanceData } from '@/app/actions';
import { SellerPerformanceData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Target, DollarSign, Percent, Trophy, TrendingUp, TrendingDown, Minus, Goal, Star, CalendarCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';

const ComparisonText = ({ value, periodText }: { value: number | undefined; periodText: string }) => {
  if (value === undefined || !isFinite(value)) {
    return (
      <p className="text-xs text-muted-foreground flex items-center">
        --
      </p>
    );
  }
  
  const isPositive = value > 0;
  const isNegative = value < 0;

  if (value === 0) {
    return (
      <p className="text-xs text-muted-foreground flex items-center">
        <Minus className="mr-1 h-4 w-4" />
        sem alteração
      </p>
    );
  }

  return (
    <p className={cn(
      "text-xs font-medium flex items-center",
      isPositive && "text-emerald-600",
      isNegative && "text-red-600",
    )}>
      {isPositive && <TrendingUp className="mr-1 h-4 w-4" />}
      {isNegative && <TrendingDown className="mr-1 h-4 w-4" />}
      {isPositive ? '+' : ''}{value.toFixed(1)}% {periodText}
    </p>
  );
};


export function SellerPerformanceView() {
  const { user } = useAuth();
  const [data, setData] = useState<SellerPerformanceData | null>(null);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      setIsLoading(true);
      getSellerPerformanceData(user.uid, period)
        .then(setData)
        .catch(() => setError('Não foi possível carregar os dados de desempenho.'))
        .finally(() => setIsLoading(false));
    }
  }, [user, period]);

  const periodMap = {
    weekly: { title: 'Esta Semana', comparison: 'vs semana passada' },
    monthly: { title: 'Este Mês', comparison: 'vs mês passado' },
    yearly: { title: 'Este Ano', comparison: 'vs ano passado' },
  }

  const renderStatsCards = () => {
    if (isLoading) {
      return Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ));
    }
    if (!data) return null;
    
    const { personalStats } = data;
    const currentPeriodText = periodMap[period].comparison;

    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {personalStats.revenue.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <ComparisonText value={personalStats.revenue.change} periodText={currentPeriodText} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personalStats.sales.count}</div>
            <ComparisonText value={personalStats.sales.change} periodText={currentPeriodText} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personalStats.leads.count}</div>
            <ComparisonText value={personalStats.leads.change} periodText={currentPeriodText} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{personalStats.conversionRate.rate.toFixed(1)}%</div>
             <ComparisonText value={personalStats.conversionRate.change} periodText={currentPeriodText} />
          </CardContent>
        </Card>
      </>
    );
  };
  
  const renderRankingTable = (ranking: SellerPerformanceData['generalRanking']) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (!ranking || ranking.length === 0) {
      return <p className="text-center text-muted-foreground p-4">Nenhum dado de ranking para exibir.</p>;
    }
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Pos.</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Vendas</TableHead>
            <TableHead className="text-right">Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((seller, index) => (
            <TableRow key={seller.sellerId} className={seller.sellerId === user?.uid ? 'bg-primary/10' : ''}>
              <TableCell className="font-bold">#{index + 1}</TableCell>
              <TableCell className="font-medium">{seller.sellerName}</TableCell>
              <TableCell className="text-right">{seller.totalSales}</TableCell>
              <TableCell className="text-right font-semibold">
                {seller.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  const renderGoalChampionsTable = (ranking: SellerPerformanceData['goalChampionsRanking']) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }
    
    if (!ranking || ranking.length === 0) {
      return <p className="text-center text-muted-foreground p-4">Nenhuma meta definida para o mês.</p>;
    }
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Pos.</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Progresso da Meta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((seller, index) => (
            <TableRow key={seller.sellerId} className={seller.sellerId === user?.uid ? 'bg-primary/10' : ''}>
              <TableCell className="font-bold">
                  {index < 3 ? <Trophy className={cn("h-5 w-5", index === 0 && "text-yellow-500", index === 1 && "text-gray-400", index === 2 && "text-yellow-700")} /> : `#${index + 1}`}
              </TableCell>
              <TableCell className="font-medium flex items-center gap-2">
                {seller.sellerName}
                {seller.goalProgress >= 100 && <Star className="h-4 w-4 text-green-500 fill-green-500" />}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                    <span className="font-semibold">{seller.goalProgress.toFixed(1)}%</span>
                    <Progress value={seller.goalProgress} className="h-2 w-24" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Seu Desempenho ({periodMap[period].title})</h2>
             <Select value={period} onValueChange={(value) => setPeriod(value as 'weekly' | 'monthly' | 'yearly')}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Selecionar período" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="weekly">Esta Semana</SelectItem>
                    <SelectItem value="monthly">Este Mês</SelectItem>
                    <SelectItem value="yearly">Este Ano</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {renderStatsCards()}
        </div>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
                <>
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </>
            ) : (
                <>
                    {data?.personalStats.goal && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Goal className="h-5 w-5" /> Minha Meta Pessoal</CardTitle>
                                <CardDescription>Seu progresso para a meta do mês.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Progress value={data.personalStats.goal.progress} className="h-3" />
                                <p className="text-sm text-muted-foreground text-center">
                                    <span className="font-bold text-foreground">{data.personalStats.goal.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> de <span className="font-bold text-foreground">{data.personalStats.goal.target.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> ({data.personalStats.goal.progress.toFixed(1)}%)
                                </p>
                                {data.personalStats.goal.dailyTarget > 0 && (
                                    <p className="text-xs text-muted-foreground text-center pt-1">
                                        Faltam {data.personalStats.goal.dailyTarget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/dia útil para bater a meta.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}
                    {data?.personalStats.goal && (
                       <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Meta Diária</CardTitle>
                                <CardDescription>Valor que você precisa vender por dia útil para atingir seu objetivo.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">
                                    {data.personalStats.goal.dailyTarget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Restam {data.personalStats.goal.remainingDays} dias úteis no mês.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    {data?.groupGoal && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Goal className="h-5 w-5" /> Meta do Grupo: {data.groupName}</CardTitle>
                                <CardDescription>Progresso do seu grupo para a meta do mês.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Progress value={data.groupGoal.progress} className="h-3" />
                                <p className="text-sm text-muted-foreground text-center">
                                <span className="font-bold text-foreground">{data.groupGoal.current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> de <span className="font-bold text-foreground">{data.groupGoal.target.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> ({data.groupGoal.progress.toFixed(1)}%)
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Rankings ({periodMap[period].title})</CardTitle>
            <CardDescription>Compare seu desempenho com outros vendedores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Geral</TabsTrigger>
                {data?.groupRanking && (
                  <TabsTrigger value="group">
                    Meu Grupo ({data.groupName || '...'})
                  </TabsTrigger>
                )}
                {data?.goalChampionsRanking && data.goalChampionsRanking.length > 0 && (
                    <TabsTrigger value="goals">Campeões de Meta</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="general" className="mt-4">
                {renderRankingTable(data?.generalRanking || [])}
              </TabsContent>
              {data?.groupRanking && (
                <TabsContent value="group" className="mt-4">
                   {renderRankingTable(data.groupRanking)}
                </TabsContent>
              )}
               {data?.goalChampionsRanking && (
                <TabsContent value="goals" className="mt-4">
                   {renderGoalChampionsTable(data.goalChampionsRanking)}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
