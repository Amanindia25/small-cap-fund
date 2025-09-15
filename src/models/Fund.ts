import mongoose, { Schema, Document } from 'mongoose';

export interface IStockHolding {
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

export interface IPortfolioSummary {
  equityHolding: number;
  numberOfStocks: number;
  largeCapPercentage?: number;
  midCapPercentage?: number;
  smallCapPercentage?: number;
  top5StockWeight?: number;
  top10StockWeight?: number;
  top3SectorWeight?: number;
}

export interface IReturnsData {
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

export interface IRiskRatios {
  standardDeviation?: number;
  beta?: number;
  sharpeRatio?: number;
  treynorRatio?: number;
  jensenAlpha?: number;
}

export interface IFund extends Document {
  name: string;
  amc: string;
  category: string;
  subCategory: string;
  aum: number;
  expenseRatio: number;
  fundManager: string;
  inceptionDate: Date;
  benchmark: string;
  crisilRating?: number;
  planType: 'Direct Plan' | 'Regular Plan';
  isSponsored: boolean;
  fundUrl?: string;
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
  individualHoldings?: IStockHolding[];
  portfolioSummary?: IPortfolioSummary;
  returns?: IReturnsData;
  riskRatios?: IRiskRatios;
  createdAt: Date;
  updatedAt: Date;
}

const StockHoldingSchema = new Schema<IStockHolding>({
  stockName: { type: String, required: true },
  stockSymbol: { type: String, required: true },
  percentage: { type: Number, required: true },
  sector: { type: String, required: true },
  marketValue: { type: Number, required: true },
  quantity: { type: Number },
  oneMonthChange: { type: Number },
  oneYearHighest: { type: Number },
  oneYearLowest: { type: Number },
  quantityChange: { type: Number }
});

const PortfolioSummarySchema = new Schema<IPortfolioSummary>({
  equityHolding: { type: Number, required: true },
  numberOfStocks: { type: Number, required: true },
  largeCapPercentage: { type: Number },
  midCapPercentage: { type: Number },
  smallCapPercentage: { type: Number },
  top5StockWeight: { type: Number },
  top10StockWeight: { type: Number },
  top3SectorWeight: { type: Number }
});

const ReturnsDataSchema = new Schema<IReturnsData>({
  oneMonth: { type: Number },
  threeMonth: { type: Number },
  sixMonth: { type: Number },
  oneYear: { type: Number },
  threeYear: { type: Number },
  categoryAverage: {
    oneMonth: { type: Number },
    threeMonth: { type: Number },
    sixMonth: { type: Number },
    oneYear: { type: Number },
    threeYear: { type: Number }
  },
  rankWithinCategory: {
    oneMonth: { type: Number },
    threeMonth: { type: Number },
    sixMonth: { type: Number },
    oneYear: { type: Number },
    threeYear: { type: Number }
  }
});

const RiskRatiosSchema = new Schema<IRiskRatios>({
  standardDeviation: { type: Number },
  beta: { type: Number },
  sharpeRatio: { type: Number },
  treynorRatio: { type: Number },
  jensenAlpha: { type: Number }
});

const FundSchema = new Schema<IFund>({
  name: { type: String, required: true },
  amc: { type: String, required: true },
  category: { type: String, required: true, default: 'small-cap' },
  subCategory: { type: String, required: true },
  aum: { type: Number, required: true },
  expenseRatio: { type: Number, required: true },
  fundManager: { type: String, required: true },
  inceptionDate: { type: Date, required: true },
  benchmark: { type: String, required: true },
  crisilRating: { type: Number, min: 1, max: 5 },
  planType: { type: String, enum: ['Direct Plan', 'Regular Plan'], required: true },
  isSponsored: { type: Boolean, default: false },
  fundUrl: { type: String },
  portfolio: {
    turnoverRatio: { type: Number },
    equityHolding: { type: Number },
    numberOfStocks: { type: Number },
    debtHolding: { type: Number },
    numberOfDebtHoldings: { type: Number },
    mfHolding: { type: Number },
    cashHolding: { type: Number },
    otherHolding: { type: Number }
  },
  individualHoldings: [StockHoldingSchema],
  portfolioSummary: PortfolioSummarySchema,
  returns: ReturnsDataSchema,
  riskRatios: RiskRatiosSchema
}, {
  timestamps: true
});

// Create index for faster queries
FundSchema.index({ name: 1, planType: 1 }, { unique: true }); // Unique combination of name + planType
FundSchema.index({ amc: 1 });
FundSchema.index({ category: 1 });

export const Fund = mongoose.model<IFund>('Fund', FundSchema);

