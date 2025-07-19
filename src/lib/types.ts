
import { z } from 'zod';

export const productCategories = ['Eletrodomésticos', 'TV e AV', 'Telefonia', 'Informática', 'Outros'] as const;
export type ProductCategory = (typeof productCategories)[number];

export const clientStatuses = ['Novo Lead', 'Em negociação', 'Fechado', 'Pós-venda'] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const userRoles = ['vendedor', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['active', 'inactive'] as const;
export type UserStatus = (typeof userStatuses)[number];

export const analyticsPeriods = ['total', 'yearly', 'monthly', 'weekly', 'daily'] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];

// AI Related Schemas
export const LeadAnalysisInputSchema = z.object({
  name: z.string().describe('O nome do cliente.'),
  city: z.string().describe('A cidade do cliente.'),
  status: z.enum(clientStatuses).describe('O status atual do lead.'),
  desiredProduct: z.enum(productCategories).describe('O produto que o cliente deseja.'),
  lastProductBought: z.string().optional().describe('O último produto que o cliente comprou, se houver.'),
  remarketingReminder: z.string().optional().describe('Um lembrete de remarketing, se houver.'),
  comments: z.array(z.object({
    userName: z.string().optional(),
    text: z.string(),
    isSystemMessage: z.boolean().optional(),
  })).describe('Uma lista de comentários e observações sobre o lead.'),
});
export type LeadAnalysisInput = z.infer<typeof LeadAnalysisInputSchema>;

export const LeadAnalysisOutputSchema = z.object({
  analysis: z.string().describe('Uma análise concisa do potencial deste lead, incluindo pontos fortes e fracos.'),
  salesTips: z.array(z.string()).describe('Uma lista de 2 a 3 dicas de vendas acionáveis e específicas para este lead.'),
  suggestedMessage: z.string().describe('Uma mensagem de saudação curta e personalizada para iniciar a conversa com este lead no WhatsApp.'),
});
export type LeadAnalysisOutput = z.infer<typeof LeadAnalysisOutputSchema>;


export interface Client {
  id: string;
  name: string;
  city: string;
  contact: string;
  normalizedContact?: string;
  lastProductBought: string;
  desiredProduct: ProductCategory;
  status: ClientStatus;
  remarketingReminder: string;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  groupId?: string;
  referredBy?: string;
  tagIds?: string[];
  lastAnalysis?: LeadAnalysisOutput;
}

export interface RecentSale {
  id: string;
  clientId: string;
  clientName: string;
  saleDate: string;
  saleValue: number;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  userName?: string;
  isSystemMessage?: boolean;
}

export interface Group {
    id: string;
    name: string;
    slug?: string;
    memberCount?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  groupId?: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  adminId: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  groupId: string;
  groupName: string;
  targetValue: number;
  currentValue: number;
  period: string; // YYYY-MM
  userGoals: UserGoal[];
}

export interface UserGoal {
  id: string;
  userId: string;
  userName: string;
  goalId: string;
  targetValue: number;
  currentValue: number;
  period: string; // YYYY-MM
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  adminId: string;
  createdAt: string;
}


export interface DashboardAnalyticsData {
  sales: {
    count: number;
    change: number;
  };
  revenue: {
    total: number;
    change: number;
  };
  leads: {
    count: number;
    change: number;
  };
  conversionRate: {
    rate: number;
    change: number;
  };
  abandonedLeadsCount: number;
  performanceOverTime: {
      date: string;
      leads: number;
      sales: number;
  }[];
  salesRanking: {
      sellerId: string;
      sellerName: string;
      groupName: string;
      sales: number;
      revenue: number;
  }[];
}

export interface SellerAnalytics {
  sellerId: string;
  sellerName: string;
  totalLeads: number;
  leadsByStatus: Record<ClientStatus, number>;
  totalSales: number;
  totalRevenue: number;
  totalRepurchases: number;
  conversionRate: number;
  totalDeletedLeads: number;
  performanceOverTime: {
    date: string;
    leads: number;
    sales: number;
  }[];
}

export interface SellerPerformanceData {
  personalStats: {
    leads: { count: number; change: number };
    sales: { count: number; change: number };
    revenue: { total: number; change: number };
    conversionRate: { rate: number; change: number };
    goal: {
        target: number;
        current: number;
        progress: number;
        dailyTarget: number;
        remainingDays: number;
    } | null;
  };
  generalRanking: {
    sellerId: string;
    sellerName: string;
    totalSales: number;
    totalRevenue: number;
  }[];
  groupRanking: {
    sellerId: string;
    sellerName: string;
    totalSales: number;
    totalRevenue: number;
  }[] | null;
  goalChampionsRanking: {
      sellerId: string;
      sellerName: string;
      goalProgress: number;
  }[];
  groupGoal: {
      target: number;
      current: number;
      progress: number;
  } | null;
  groupName?: string;
  period: 'yearly' | 'monthly' | 'weekly';
}
