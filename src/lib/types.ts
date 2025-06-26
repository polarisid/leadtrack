
export const productCategories = ['Eletrodomésticos', 'TV e AV', 'Telefonia', 'Informática', 'Outros'] as const;
export type ProductCategory = (typeof productCategories)[number];

export const clientStatuses = ['Novo Lead', 'Em negociação', 'Fechado', 'Pós-venda'] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const userRoles = ['vendedor', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['active', 'inactive'] as const;
export type UserStatus = (typeof userStatuses)[number];

export const analyticsPeriods = ['total', 'monthly', 'weekly', 'daily'] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];


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
  userId: string;
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

export interface DashboardAnalyticsData {
  weeklySales: {
    count: number;
    change: number;
  };
   weeklyRevenue: {
    total: number;
    change: number;
  };
  weeklyLeads: {
    count: number;
    change: number;
  };
  weeklyConversionRate: {
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
}
