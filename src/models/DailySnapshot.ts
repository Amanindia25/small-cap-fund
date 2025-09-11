import mongoose, { Schema, Document } from 'mongoose';

export interface IDailySnapshot extends Document {
  fundId: mongoose.Types.ObjectId;
  date: Date;
  totalHoldings: number;
  totalMarketValue: number;
  topHoldings: Array<{
    stockName: string;
    stockSymbol: string;
    percentage: number;
    sector: string;
    marketValue: number;
  }>;
  sectorAllocation: Array<{
    sector: string;
    percentage: number;
    holdingsCount: number;
  }>;
  portfolioMetrics: {
    top5Weight: number;
    top10Weight: number;
    top3SectorWeight: number;
    diversificationScore: number;
  };
  createdAt: Date;
}

const DailySnapshotSchema = new Schema<IDailySnapshot>({
  fundId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fund', 
    required: true 
  },
  date: { type: Date, required: true, default: Date.now },
  totalHoldings: { type: Number, required: true },
  totalMarketValue: { type: Number, required: true },
  topHoldings: [{
    stockName: { type: String, required: true },
    stockSymbol: { type: String, required: true },
    percentage: { type: Number, required: true },
    sector: { type: String, required: true },
    marketValue: { type: Number, required: true }
  }],
  sectorAllocation: [{
    sector: { type: String, required: true },
    percentage: { type: Number, required: true },
    holdingsCount: { type: Number, required: true }
  }],
  portfolioMetrics: {
    top5Weight: { type: Number, required: true },
    top10Weight: { type: Number, required: true },
    top3SectorWeight: { type: Number, required: true },
    diversificationScore: { type: Number, required: true }
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
DailySnapshotSchema.index({ fundId: 1, date: -1 });
DailySnapshotSchema.index({ date: -1 });
DailySnapshotSchema.index({ fundId: 1, date: 1 }, { unique: true }); // One snapshot per fund per day

export const DailySnapshot = mongoose.model<IDailySnapshot>('DailySnapshot', DailySnapshotSchema);
