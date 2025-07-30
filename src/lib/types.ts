

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

export const offerStatuses = ['pending', 'approved', 'rejected'] as const;
export type OfferStatus = (typeof offerStatuses)[number];

// Offer Schema
export const OfferSchema = z.object({
  title: z.string().min(3, "O título deve ter pelo menos 3 caracteres."),
  sku: z.string().optional(),
  price: z.number().positive("O preço deve ser um número positivo."),
  coupon: z.string().optional(),
  photoUrl: z.string().url("A URL da foto é inválida.").optional().or(z.literal('')),
  validUntil: z.date({ required_error: "A data de validade é obrigatória."}),
  category: z.enum(productCategories, { required_error: "A categoria é obrigatória." }),
});
export type OfferFormValues = z.infer<typeof OfferSchema>;

const ProductSchema = z.object({
  name: z.string().min(1, "O nome do produto não pode ser vazio."),
  sku: z.string().optional(),
  photoUrl: z.string().optional(),
  cashPrice: z.number().positive("O valor à vista deve ser positivo.").or(z.literal(0)),
  installmentPriceTotal: z.number().positive("O valor a prazo deve ser positivo.").optional(),
  installments: z.number().int().positive("O número de parcelas deve ser positivo.").optional(),
}).refine(data => {
    // Se um campo de parcela for preenchido, o outro também deve ser.
    return (data.installments && data.installmentPriceTotal) || (!data.installments && !data.installmentPriceTotal);
}, {
    message: "Preencha o valor a prazo e o n° de parcelas.",
    path: ["installments"],
});

const IncludedServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  termsUrl: z.string().optional(),
});

export const ProposalSchema = z.object({
  products: z.array(ProductSchema).min(1, "Adicione pelo menos um produto."),
  proposalDate: z.date(),
  includedServices: z.array(IncludedServiceSchema).optional(),
  observations: z.string().optional(),
});
export type ProposalFormValues = z.infer<typeof ProposalSchema>;


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

export const DailySummaryInputSchema = z.object({
    clients: z.array(z.object({
        name: z.string(),
        status: z.enum(clientStatuses),
        desiredProduct: z.enum(productCategories),
        updatedAt: z.string().describe("ISO date string of last update"),
    })).describe("A list of clients for the user.")
});
export type DailySummaryInput = z.infer<typeof DailySummaryInputSchema>;

export const DailySummaryOutputSchema = z.object({
    overview: z.string().describe("A brief, general overview of the client portfolio's health and potential for the day."),
    hotLeads: z.array(z.object({
        name: z.string(),
        reason: z.string(),
    })).describe("A list of 2-3 hot leads to prioritize, with a brief reason for each."),
    leadsToWatch: z.array(z.object({
        name: z.string(),
        reason: z.string(),
    })).describe("A list of 1-2 leads that are at risk or need attention, with a brief reason."),
    dailyActions: z.array(z.string()).describe("A list of 3 actionable daily tasks to increase sales."),
});
export type DailySummaryOutput = z.infer<typeof DailySummaryOutputSchema>;

export const AdminDailySummaryInputSchema = z.object({
    sellers: z.array(z.object({
        sellerName: z.string(),
        clients: z.array(z.object({
            status: z.enum(clientStatuses),
            updatedAt: z.string().describe("ISO date string of last update"),
        })),
    })).describe("A list of sellers and their respective clients."),
});
export type AdminDailySummaryInput = z.infer<typeof AdminDailySummaryInputSchema>;

export const AdminDailySummaryOutputSchema = z.object({
    portfolioOverview: z.string().describe("Uma visão geral de alto nível sobre a saúde do portfólio de toda a equipe."),
    topSellers: z.array(z.object({
        name: z.string(),
        reason: z.string(),
    })).describe("Uma lista de 2-3 vendedores com melhor desempenho ou potencial para o dia, com o motivo."),
    sellersToWatch: z.array(z.object({
        name: z.string(),
        reason: z.string(),
    })).describe("Uma lista de 1-2 vendedores que precisam de atenção ou suporte, com o motivo."),
    globalOpportunities: z.array(z.object({
        description: z.string(),
    })).describe("Uma lista de 1-2 oportunidades ou riscos globais na carteira de clientes."),
});
export type AdminDailySummaryOutput = z.infer<typeof AdminDailySummaryOutputSchema>;

export const OfferTextGeneratorInputSchema = z.object({
    title: z.string().describe('O título da oferta (nome do produto).'),
    price: z.number().describe('O preço da oferta.'),
    coupon: z.string().optional().describe('Um cupom de desconto, se houver.'),
    validUntil: z.string().describe('A data de validade da oferta (string ISO).'),
});
export type OfferTextGeneratorInput = z.infer<typeof OfferTextGeneratorInputSchema>;

export const OfferTextGeneratorOutputSchema = z.object({
    text: z.string().describe('Uma mensagem curta, amigável e persuasiva para o WhatsApp. Use o placeholder <cliente> para o nome do cliente. Inclua emojis para deixar a mensagem mais atrativa.'),
});
export type OfferTextGeneratorOutput = z.infer<typeof OfferTextGeneratorOutputSchema>;

const ProposalProductSchema = z.object({
  name: z.string().describe('O nome do produto.'),
  sku: z.string().optional().describe('O SKU do produto, se houver.'),
  cashPrice: z.number().describe('O valor do produto para pagamento à vista.'),
  installmentPriceTotal: z.number().optional().describe('O valor total do produto para pagamento a prazo.'),
  installments: z.number().optional().describe('O número de parcelas para o pagamento a prazo.'),
});

export const ProposalTextGeneratorInputSchema = z.object({
    products: z.array(ProposalProductSchema).describe('Uma lista com os produtos da proposta e seus detalhes.'),
    proposalDate: z.string().describe('A data em que a proposta foi gerada (string formatada).'),
});
export type ProposalTextGeneratorInput = z.infer<typeof ProposalTextGeneratorInputSchema>;

export const ProposalTextGeneratorOutputSchema = z.object({
    text: z.string().describe('O texto completo da proposta comercial, formatado para ser enviado ao cliente. Use o placeholder <cliente>.'),
});
export type ProposalTextGeneratorOutput = z.infer<typeof ProposalTextGeneratorOutputSchema>;


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
  dailySummary?: {
    date: string; // YYYY-MM-DD
    summary: DailySummaryOutput;
  }
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

export interface Offer {
  id: string;
  title: string;
  sku: string;
  price: number;
  coupon: string;
  photoUrl?: string;
  validUntil: string;
  status: OfferStatus;
  category: ProductCategory;
  createdBy: string;
  createdByName: string;
  likedBy: string[];
  createdAt: string;
}

export interface BrandingSettings {
    logoUrl?: string;
    companyName?: string;
}

export interface InstallationService {
    id: string;
    name: string;
    price: number;
    termsUrl?: string;
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
