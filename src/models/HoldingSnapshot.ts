import mongoose, { Schema, Document } from 'mongoose';

export interface IHoldingSnapshot extends Document {
  fundId: mongoose.Types.ObjectId;
  date: Date;
  stockName: string;
  stockSymbol: string;
  percentage: number;
  sector: string;
  marketValue: number;
  quantity: number;
  oneMonthChange: number;
  createdAt: Date;
}

const HoldingSnapshotSchema = new Schema<IHoldingSnapshot>({
  fundId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fund', 
    required: true 
  },
  date: { type: Date, required: true, default: Date.now },
  stockName: { type: String, required: true },
  stockSymbol: { type: String, required: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  sector: { type: String, required: true },
  marketValue: { type: Number, required: true },
  quantity: { type: Number },
  oneMonthChange: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Create indexes for faster queries
HoldingSnapshotSchema.index({ fundId: 1, date: -1 });
HoldingSnapshotSchema.index({ date: -1 });
HoldingSnapshotSchema.index({ stockSymbol: 1, date: -1 });
HoldingSnapshotSchema.index({ fundId: 1, stockSymbol: 1, date: 1 }, { unique: true }); // One snapshot per stock per fund per day

export const HoldingSnapshot = mongoose.model<IHoldingSnapshot>('HoldingSnapshot', HoldingSnapshotSchema);
