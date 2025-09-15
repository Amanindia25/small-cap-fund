export interface StockHolding {
  stockName: string;
  stockSymbol: string;
  percentage: number;
  sector: string;
  marketValue: number;
  quantity?: number;
  oneMonthChange?: number;
  oneYearHighest?: number;
  oneYearLowest?: number;
  quantityChange?: number;
}

export interface PortfolioSummary {
  equityHolding: number;
  numberOfStocks: number;
  largeCapPercentage?: number;
  midCapPercentage?: number;
  smallCapPercentage?: number;
  top5StockWeight?: number;
  top10StockWeight?: number;
  top3SectorWeight?: number;
}

export interface ReturnsData {
  oneMonth?: number;
  threeMonth?: number;
  sixMonth?: number;
  oneYear?: number;
  threeYear?: number;
  categoryAverage?: {
    oneMonth?: number;
    threeMonth?: number;
    sixMonth?: number;
    oneYear?: number;
    threeYear?: number;
  };
  rankWithinCategory?: {
    oneMonth?: number;
    threeMonth?: number;
    sixMonth?: number;
    oneYear?: number;
    threeYear?: number;
  };
}

export interface RiskRatios {
  standardDeviation?: number;
  beta?: number;
  sharpeRatio?: number;
  treynorRatio?: number;
  jensenAlpha?: number;
}

export interface FundData {
  schemeName: string;
  amc?: string;
  category?: string;
  subCategory?: string;
  aum?: number;
  expenseRatio?: number;
  fundManager?: string;
  inceptionDate?: Date;
  benchmark?: string;
  crisilRating?: number;
  portfolio: {
    turnoverRatio?: number;
    equityHolding?: number;
    numberOfStocks?: number;
    debtHolding?: number;
    numberOfDebtHoldings?: number;
    mfHolding?: number;
    cashHolding?: number;
    otherHolding?: number;
  };
  individualHoldings?: StockHolding[];
  portfolioSummary?: PortfolioSummary;
  returns?: ReturnsData;
  riskRatios?: RiskRatios;
  planType: 'Direct Plan' | 'Regular Plan';
  isSponsored: boolean;
  fundUrl?: string;
}

export interface ScrapingConfig {
  url: string;
  headless: boolean;
  timeout: number;
  delay: number;
  userAgent: string;
}

export interface ScrapingResult {
  success: boolean;
  data: FundData[];
  error?: string;
  timestamp: Date;
  totalFunds: number;
}
