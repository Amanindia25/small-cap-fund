import mongoose, { Schema, Document } from 'mongoose';

export interface IPortfolioChange extends Document {
  fundId: mongoose.Types.ObjectId;
  date: Date;
  changeType: 'ADDITION' | 'EXIT' | 'INCREASE' | 'DECREASE';
  stockSymbol: string;
  stockName: string;
  oldPercentage?: number;
  newPercentage?: number;
  changeAmount: number;
  sector: string;
  significance: 'LOW' | 'MEDIUM' | 'HIGH'; // Based on change amount
  createdAt: Date;
}

const PortfolioChangeSchema = new Schema<IPortfolioChange>({
  fundId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Fund', 
    required: true 
  },
  date: { type: Date, required: true, default: Date.now },
  changeType: { 
    type: String, 
    enum: ['ADDITION', 'EXIT', 'INCREASE', 'DECREASE'], 
    required: true 
  },
  stockSymbol: { type: String, required: true },
  stockName: { type: String, required: true },
  oldPercentage: { type: Number, min: 0, max: 100 },
  newPercentage: { type: Number, min: 0, max: 100 },
  changeAmount: { type: Number, required: true },
  sector: { type: String, required: true },
  significance: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH'], 
    required: true 
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
PortfolioChangeSchema.index({ fundId: 1, date: -1 });
PortfolioChangeSchema.index({ changeType: 1 });
PortfolioChangeSchema.index({ significance: 1 });
PortfolioChangeSchema.index({ date: -1 });

export const PortfolioChange = mongoose.model<IPortfolioChange>('PortfolioChange', PortfolioChangeSchema);
