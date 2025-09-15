import mongoose, { Schema, Document } from 'mongoose';

export interface IHolding extends Document {
  fundId: mongoose.Types.ObjectId;
  stockName: string;
  stockSymbol: string;
  percentage: number;
  sector: string;
  marketValue: number;
  quantity?: number;
  oneMonthChange?: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HoldingSchema = new Schema<IHolding>({
  fundId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fund', 
    required: true 
  },
  stockName: { type: String, required: true },
  stockSymbol: { type: String, required: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  sector: { type: String, required: true },
  marketValue: { type: Number, required: true },
  quantity: { type: Number },
  oneMonthChange: { type: Number },
  date: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

// Create indexes for faster queries
HoldingSchema.index({ fundId: 1, date: -1 });
HoldingSchema.index({ stockSymbol: 1 });
HoldingSchema.index({ sector: 1 });
HoldingSchema.index({ date: -1 });

export const Holding = mongoose.model<IHolding>('Holding', HoldingSchema);
