import mongoose, { Schema, Document } from 'mongoose';

export interface IFundSnapshot extends Document {
  fundId: mongoose.Types.ObjectId;
  date: Date;
  name: string;
  amc: string;
  category: string;
  subCategory: string;
  aum: number;
  expenseRatio: number;
  fundManager: string;
  crisilRating: number;
  planType: string;
  isSponsored: boolean;
  portfolio: {
    turnoverRatio: number;
    equityHolding: number;
    numberOfStocks: number;
    debtHolding: number;
    numberOfDebtHoldings: number;
    cashHolding?: number;
    otherHolding?: number;
  };
  returns: {
    oneMonth: number;
    threeMonth: number;
    sixMonth: number;
    oneYear: number;
    threeYear: number;
  };
  createdAt: Date;
}

const FundSnapshotSchema = new Schema<IFundSnapshot>({
  fundId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fund', 
    required: true 
  },
  date: { type: Date, required: true, default: Date.now },
  name: { type: String, required: true },
  amc: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String, required: true },
  aum: { type: Number, required: true },
  expenseRatio: { type: Number, required: true },
  fundManager: { type: String, required: true },
  crisilRating: { type: Number, required: true },
  planType: { type: String, required: true },
  isSponsored: { type: Boolean, default: false },
  portfolio: {
    turnoverRatio: { type: Number, required: true },
    equityHolding: { type: Number, required: true },
    numberOfStocks: { type: Number, required: true },
    debtHolding: { type: Number, required: true },
    numberOfDebtHoldings: { type: Number, required: true },
    cashHolding: { type: Number },
    otherHolding: { type: Number }
  },
  returns: {
    oneMonth: { type: Number, required: true },
    threeMonth: { type: Number, required: true },
    sixMonth: { type: Number, required: true },
    oneYear: { type: Number, required: true },
    threeYear: { type: Number, required: true }
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
FundSnapshotSchema.index({ fundId: 1, date: -1 });
FundSnapshotSchema.index({ date: -1 });
FundSnapshotSchema.index({ fundId: 1, date: 1 }, { unique: true }); // One snapshot per fund per day

export const FundSnapshot = mongoose.model<IFundSnapshot>('FundSnapshot', FundSnapshotSchema);
