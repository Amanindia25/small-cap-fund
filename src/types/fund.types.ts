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

export interface StockData {
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
  balanceSheet?: BalanceSheetTable;
  peers?: PeersTable;
  cashFlow?: GenericTable;
  profitLoss?: GenericTable;
  ratios?: GenericTable;
  investors?: GenericTable;
  quarters?: GenericTable;
  analysis?: AnalysisData;
}

export interface StockScrapingResult {
  success: boolean;
  data: StockData[];
  error?: string;
  timestamp: Date;
  totalStocks: number;
}

export interface BalanceSheetRow {
  label: string;
  values: number[];
}

export interface BalanceSheetTable {
  headers: string[];
  rows: BalanceSheetRow[];
  unit?: string;
  scope?: 'Consolidated' | 'Standalone';
}

export interface PeersRow {
  label: string; // company name
  values: number[]; // numeric columns from peers table
}

export interface PeersTable {
  headers: string[];
  rows: PeersRow[];
}

export interface GenericTableRow {
  label: string;
  values: number[];
}

export interface GenericTable {
  headers: string[];
  rows: GenericTableRow[];
  unit?: string;
  scope?: string;
}

export interface AnalysisData {
  pros: string[];
  cons: string[];
}