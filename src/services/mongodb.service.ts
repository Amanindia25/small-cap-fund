import mongoose from 'mongoose';
import { Fund, IFund } from '../models/Fund';
import { Holding, IHolding } from '../models/Holding';
import { FundData, StockHolding } from '../types/fund.types';

export class MongoDBService {
  
  async saveFund(fundData: FundData): Promise<IFund | null> {
    try {
      // Check if fund already exists with same name AND planType
      const existingFund = await Fund.findOne({ 
        name: fundData.schemeName, 
        planType: fundData.planType 
      });
      
      if (existingFund) {
        console.log(`📝 Updating existing fund: ${fundData.schemeName} (${fundData.planType})`);
        
        // Update existing fund
        const updatedFund = await Fund.findByIdAndUpdate(
          existingFund._id,
          {
            $set: {
              amc: fundData.amc || existingFund.amc,
              category: fundData.category || existingFund.category,
              subCategory: fundData.subCategory || existingFund.subCategory,
              aum: fundData.aum || existingFund.aum,
              expenseRatio: fundData.expenseRatio || existingFund.expenseRatio,
              fundManager: fundData.fundManager || existingFund.fundManager,
              inceptionDate: fundData.inceptionDate || existingFund.inceptionDate,
              benchmark: fundData.benchmark || existingFund.benchmark,
              crisilRating: fundData.crisilRating || existingFund.crisilRating,
              isSponsored: fundData.isSponsored,
              fundUrl: fundData.fundUrl || existingFund.fundUrl,
              updatedAt: new Date()
            }
          },
          { new: true }
        );
        
        return updatedFund;
      } else {
        console.log(`➕ Creating new fund: ${fundData.schemeName} (${fundData.planType})`);
        
        // Create new fund
        const newFund = new Fund({
          name: fundData.schemeName,
          amc: fundData.amc || 'Unknown',
          category: fundData.category || 'small-cap',
          subCategory: fundData.subCategory || 'Equity',
          aum: fundData.aum || 0,
          expenseRatio: fundData.expenseRatio || 0,
          fundManager: fundData.fundManager || 'Unknown',
          inceptionDate: fundData.inceptionDate || new Date(),
          benchmark: fundData.benchmark || 'Nifty Small Cap 100',
          crisilRating: fundData.crisilRating,
          planType: fundData.planType,
          isSponsored: fundData.isSponsored,
          fundUrl: fundData.fundUrl
        });
        
        const savedFund = await newFund.save();
        return savedFund;
      }
    } catch (error) {
      console.error(`❌ Error saving fund ${fundData.schemeName}:`, error);
      return null;
    }
  }

  async saveHoldings(fundId: string, holdings: StockHolding[]): Promise<IHolding[]> {
    try {
      if (!holdings || holdings.length === 0) {
        console.log(`⚠️ No holdings to save for fund ${fundId}`);
        return [];
      }

      console.log(`💾 Saving ${holdings.length} holdings for fund ${fundId}`);
      
      // Clear existing holdings for this fund
      await Holding.deleteMany({ fundId: new mongoose.Types.ObjectId(fundId) });
      
      // Create new holdings
      const holdingsToSave = holdings.map(holding => ({
        fundId: new mongoose.Types.ObjectId(fundId),
        stockName: holding.stockName,
        stockSymbol: holding.stockSymbol,
        percentage: holding.percentage,
        sector: holding.sector,
        marketValue: holding.marketValue,
        quantity: holding.quantity,
        oneMonthChange: holding.oneMonthChange,
        oneYearHighest: holding.oneYearHighest,
        oneYearLowest: holding.oneYearLowest,
        quantityChange: holding.quantityChange,
        date: new Date()
      }));

      const savedHoldings = await Holding.insertMany(holdingsToSave);
      console.log(`✅ Saved ${savedHoldings.length} holdings successfully`);
      
      return savedHoldings as IHolding[];
    } catch (error) {
      console.error(`❌ Error saving holdings for fund ${fundId}:`, error);
      return [];
    }
  }

  async saveFundWithHoldings(fundData: FundData): Promise<{ fund: IFund | null; holdings: IHolding[] }> {
    try {
      // Save fund first
      const fund = await this.saveFund(fundData);
      
      if (!fund) {
        return { fund: null, holdings: [] };
      }

      // Save holdings if they exist
      let holdings: IHolding[] = [];
      if (fundData.individualHoldings && fundData.individualHoldings.length > 0) {
        holdings = await this.saveHoldings((fund._id as mongoose.Types.ObjectId).toString(), fundData.individualHoldings);
        
        // Update the fund document to include individualHoldings
        await Fund.findByIdAndUpdate(fund._id, {
          $set: {
            individualHoldings: fundData.individualHoldings,
            portfolioSummary: fundData.portfolioSummary,
            returns: fundData.returns,
            riskRatios: fundData.riskRatios,
            updatedAt: new Date()
          }
        });
        
        console.log(`✅ Updated fund document with ${fundData.individualHoldings.length} holdings`);
      }

      return { fund, holdings };
    } catch (error) {
      console.error(`❌ Error saving fund with holdings:`, error);
      return { fund: null, holdings: [] };
    }
  }

  async getAllFunds(): Promise<IFund[]> {
    try {
      return await Fund.find().sort({ createdAt: -1 });
    } catch (error) {
      console.error('❌ Error fetching funds:', error);
      return [];
    }
  }

  async getFundHoldings(fundId: string): Promise<IHolding[]> {
    try {
      return await Holding.find({ fundId: new mongoose.Types.ObjectId(fundId) }).sort({ percentage: -1 });
    } catch (error) {
      console.error(`❌ Error fetching holdings for fund ${fundId}:`, error);
      return [];
    }
  }

  async getFundByName(fundName: string): Promise<IFund | null> {
    try {
      return await Fund.findOne({ name: fundName });
    } catch (error) {
      console.error(`❌ Error fetching fund ${fundName}:`, error);
      return null;
    }
  }

  async getTopHoldingsBySector(sector: string, limit: number = 10): Promise<IHolding[]> {
    try {
      return await Holding.find({ sector })
        .sort({ percentage: -1 })
        .limit(limit)
        .populate('fundId', 'name amc');
    } catch (error) {
      console.error(`❌ Error fetching top holdings for sector ${sector}:`, error);
      return [];
    }
  }

  async getFundStatistics(): Promise<{
    totalFunds: number;
    totalHoldings: number;
    topSectors: Array<{ sector: string; count: number }>;
    averageHoldingsPerFund: number;
  }> {
    try {
      const totalFunds = await Fund.countDocuments();
      const totalHoldings = await Holding.countDocuments();
      
      const sectorStats = await Holding.aggregate([
        { $group: { _id: '$sector', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const topSectors = sectorStats.map(stat => ({
        sector: stat._id,
        count: stat.count
      }));

      const averageHoldingsPerFund = totalFunds > 0 ? totalHoldings / totalFunds : 0;

      return {
        totalFunds,
        totalHoldings,
        topSectors,
        averageHoldingsPerFund
      };
    } catch (error) {
      console.error('❌ Error fetching statistics:', error);
      return {
        totalFunds: 0,
        totalHoldings: 0,
        topSectors: [],
        averageHoldingsPerFund: 0
      };
    }
  }

  // Rewrite holdings for a fund from the embedded fund.individualHoldings
  async rewriteHoldingsFromFund(fundId: string): Promise<IHolding[]> {
    try {
      const fund = await Fund.findById(fundId).lean();
      if (!fund || !Array.isArray((fund as any).individualHoldings)) {
        return [];
      }
      const sourceHoldings = (fund as any).individualHoldings as StockHolding[];
      return await this.saveHoldings(fundId, sourceHoldings);
    } catch (error) {
      console.error(`❌ Error rewriting holdings for fund ${fundId}:`, error);
      return [];
    }
  }

  // Rewrite holdings for all funds
  async rewriteAllHoldings(): Promise<{ updated: number }> {
    try {
      const funds = await Fund.find({}, { _id: 1 }).lean();
      let updated = 0;
      for (const f of funds) {
        const res = await this.rewriteHoldingsFromFund((f._id as unknown as mongoose.Types.ObjectId).toString());
        if (res.length > 0) updated += 1;
      }
      return { updated };
    } catch (error) {
      console.error('❌ Error rewriting holdings for all funds:', error);
      return { updated: 0 };
    }
  }
}
