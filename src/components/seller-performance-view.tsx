
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
import { AlertCircle, Target, DollarSign, Percent, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Ranking de Vendas ({periodMap[period].title})</CardTitle>
            <CardDescription>Compare seu desempenho com outros vendedores no período selecionado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">Geral</TabsTrigger>
                {data?.groupRanking && (
                  <TabsTrigger value="group">
                    Meu Grupo ({data.groupName || '...'})
                  </TabsTrigger>
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
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
