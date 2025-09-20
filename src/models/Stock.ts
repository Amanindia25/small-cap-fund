import mongoose, { Schema, Document } from 'mongoose';

export interface IStock extends Document {
  stockName: string;
  stockSymbol: string;
  screenerUrl?: string;
  currentPrice?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  debtToEquity?: number;
  roe?: number;
  roa?: number;
  salesGrowth?: number;
  profitGrowth?: number;
  sector: string;
  industry?: string;
  faceValue?: number;
  bookValue?: number;
  dividendYield?: number;
  eps?: number;
  priceToSales?: number;
  evToEbitda?: number;
  currentRatio?: number;
  quickRatio?: number;
  debtToAssets?: number;
  interestCoverage?: number;
  operatingMargin?: number;
  netProfitMargin?: number;
  returnOnCapitalEmployed?: number;
  inventoryTurnover?: number;
  receivablesTurnover?: number;
  assetTurnover?: number;
  workingCapital?: number;
  freeCashFlow?: number;
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  netCashFlow?: number;
  cashAndEquivalents?: number;
  totalDebt?: number;
  totalEquity?: number;
  totalAssets?: number;
  totalRevenue?: number;
  netProfit?: number;
  operatingIncome?: number;
  ebitda?: number;
  ebit?: number;
  grossProfit?: number;
  costOfGoodsSold?: number;
  sellingGeneralAdminExpenses?: number;
  depreciation?: number;
  interestExpense?: number;
  taxExpense?: number;
  sharesOutstanding?: number;
  promoterHolding?: number;
  fiiHolding?: number;
  diiHolding?: number;
  publicHolding?: number;
  balanceSheet?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: 'Consolidated' | 'Standalone';
  };
  peers?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  cashFlow?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  profitLoss?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  ratios?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  investors?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  quarters?: {
    headers: string[];
    rows: Array<{ label: string; values: number[] }>;
    unit?: string;
    scope?: string;
  };
  analysis?: {
    pros: string[];
    cons: string[];
  };
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>({
  stockName: { type: String, required: true },
  stockSymbol: { type: String, required: true, unique: true },
  screenerUrl: { type: String },
  currentPrice: { type: Number },
  marketCap: { type: Number },
  pe: { type: Number },
  pb: { type: Number },
  debtToEquity: { type: Number },
  roe: { type: Number },
  roa: { type: Number },
  salesGrowth: { type: Number },
  profitGrowth: { type: Number },
  sector: { type: String, required: true },
  industry: { type: String },
  faceValue: { type: Number },
  bookValue: { type: Number },
  dividendYield: { type: Number },
  eps: { type: Number },
  priceToSales: { type: Number },
  evToEbitda: { type: Number },
  currentRatio: { type: Number },
  quickRatio: { type: Number },
  debtToAssets: { type: Number },
  interestCoverage: { type: Number },
  operatingMargin: { type: Number },
  netProfitMargin: { type: Number },
  returnOnCapitalEmployed: { type: Number },
  inventoryTurnover: { type: Number },
  receivablesTurnover: { type: Number },
  assetTurnover: { type: Number },
  workingCapital: { type: Number },
  freeCashFlow: { type: Number },
  operatingCashFlow: { type: Number },
  investingCashFlow: { type: Number },
  financingCashFlow: { type: Number },
  netCashFlow: { type: Number },
  cashAndEquivalents: { type: Number },
  totalDebt: { type: Number },
  totalEquity: { type: Number },
  totalAssets: { type: Number },
  totalRevenue: { type: Number },
  netProfit: { type: Number },
  operatingIncome: { type: Number },
  ebitda: { type: Number },
  ebit: { type: Number },
  grossProfit: { type: Number },
  costOfGoodsSold: { type: Number },
  sellingGeneralAdminExpenses: { type: Number },
  depreciation: { type: Number },
  interestExpense: { type: Number },
  taxExpense: { type: Number },
  sharesOutstanding: { type: Number },
  promoterHolding: { type: Number },
  fiiHolding: { type: Number },
  diiHolding: { type: Number },
  publicHolding: { type: Number },
  balanceSheet: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String, enum: ['Consolidated', 'Standalone'], default: 'Consolidated' }
  },
  peers: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  cashFlow: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  profitLoss: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  ratios: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  investors: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  quarters: {
    headers: { type: [String], default: [] },
    rows: { type: [{ label: String, values: [Number] }], default: [] },
    unit: { type: String },
    scope: { type: String }
  },
  analysis: {
    pros: { type: [String], default: [] },
    cons: { type: [String], default: [] }
  },
  date: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

// Create indexes for faster queries
// Note: stockSymbol already has unique index from schema definition
StockSchema.index({ stockName: 1 });
StockSchema.index({ sector: 1 });
StockSchema.index({ date: -1 });

export const Stock = mongoose.model<IStock>('Stock', StockSchema);
