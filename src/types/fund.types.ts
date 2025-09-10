export interface FundData {
  schemeName: string;
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
