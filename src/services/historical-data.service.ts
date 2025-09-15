import { Fund, IFund } from '../models/Fund';
import { Holding, IHolding } from '../models/Holding';
import { FundSnapshot, IFundSnapshot } from '../models/FundSnapshot';
import { HoldingSnapshot, IHoldingSnapshot } from '../models/HoldingSnapshot';
import { DailySnapshot, IDailySnapshot } from '../models/DailySnapshot';
import { PortfolioChange, IPortfolioChange } from '../models/PortfolioChange';
import mongoose from 'mongoose';

// Interface for portfolio change data before saving to database
interface PortfolioChangeData {
  fundId: mongoose.Types.ObjectId;
  date: Date;
  changeType: 'ADDITION' | 'EXIT' | 'INCREASE' | 'DECREASE';
  stockSymbol: string;
  stockName: string;
  oldPercentage?: number;
  newPercentage?: number;
  changeAmount: number;
  sector: string;
  significance: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class HistoricalDataService {

  async createDailySnapshots(): Promise<void> {
    try {
      console.log('📸 Creating daily snapshots for all funds...');
      const funds = await Fund.find({}) as IFund[];
      
      for (const fund of funds) {
        await this.createFundSnapshot((fund._id as any).toString());
        await this.createHoldingsSnapshot((fund._id as any).toString());
        await this.createPortfolioSnapshot((fund._id as any).toString());
      }
      
      console.log(`✅ Created daily snapshots for ${funds.length} funds`);
    } catch (error) {
      console.error('❌ Error creating daily snapshots:', error);
    }
  }

  async createFundSnapshot(fundId: string): Promise<IFundSnapshot | null> {
    try {
      const fund = await Fund.findById(fundId) as IFund;
      if (!fund) {
        console.log(`Fund not found: ${fundId}`);
        return null;
      }

      // Check if snapshot already exists for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingSnapshot = await FundSnapshot.findOne({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: today, $lt: tomorrow }
      });

      if (existingSnapshot) {
        console.log(`Snapshot already exists for ${fund.name} today`);
        return existingSnapshot;
      }

      const snapshot = new FundSnapshot({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: new Date(),
        name: fund.name,
        amc: fund.amc,
        category: fund.category,
        subCategory: fund.subCategory,
        aum: fund.aum,
        expenseRatio: fund.expenseRatio,
        fundManager: fund.fundManager,
        crisilRating: fund.crisilRating,
        planType: fund.planType,
        isSponsored: fund.isSponsored,
        portfolio: fund.portfolio,
        returns: fund.returns
      });

      const savedSnapshot = await snapshot.save();
      console.log(`✅ Created fund snapshot for ${fund.name}`);
      return savedSnapshot;
    } catch (error) {
      console.error(`Error creating fund snapshot for ${fundId}:`, error);
      return null;
    }
  }

  async createHoldingsSnapshot(fundId: string): Promise<void> {
    try {
      const holdings = await Holding.find({ 
        fundId: new mongoose.Types.ObjectId(fundId) 
      });

      if (holdings.length === 0) {
        console.log(`No holdings found for fund ${fundId}`);
        return;
      }

      // Check if snapshots already exist for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingCount = await HoldingSnapshot.countDocuments({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: today, $lt: tomorrow }
      });

      if (existingCount > 0) {
        console.log(`Holdings snapshots already exist for fund ${fundId} today`);
        return;
      }

      // Create snapshots for all holdings
      const snapshots = holdings.map(holding => ({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: new Date(),
        stockName: holding.stockName,
        stockSymbol: holding.stockSymbol,
        percentage: holding.percentage,
        sector: holding.sector,
        marketValue: holding.marketValue,
        quantity: holding.quantity,
        oneMonthChange: holding.oneMonthChange
      }));

      await HoldingSnapshot.insertMany(snapshots);
      console.log(`✅ Created ${snapshots.length} holdings snapshots for fund ${fundId}`);
    } catch (error) {
      console.error(`Error creating holdings snapshots for ${fundId}:`, error);
    }
  }

  async createPortfolioSnapshot(fundId: string): Promise<IDailySnapshot | null> {
    try {
      const holdings = await Holding.find({ 
        fundId: new mongoose.Types.ObjectId(fundId) 
      }).sort({ percentage: -1 });

      if (holdings.length === 0) {
        console.log(`No holdings found for fund ${fundId}`);
        return null;
      }

      // Check if snapshot already exists for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingSnapshot = await DailySnapshot.findOne({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: today, $lt: tomorrow }
      });

      if (existingSnapshot) {
        console.log(`Portfolio snapshot already exists for fund ${fundId} today`);
        return existingSnapshot;
      }

      // Calculate portfolio metrics
      const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
      const top5Weight = holdings.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
      const top10Weight = holdings.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);

      // Calculate sector allocation
      const sectorMap = new Map<string, { percentage: number; count: number }>();
      holdings.forEach(holding => {
        const existing = sectorMap.get(holding.sector) || { percentage: 0, count: 0 };
        sectorMap.set(holding.sector, {
          percentage: existing.percentage + holding.percentage,
          count: existing.count + 1
        });
      });

      const sectorAllocation = Array.from(sectorMap.entries()).map(([sector, data]) => ({
        sector,
        percentage: data.percentage,
        holdingsCount: data.count
      })).sort((a, b) => b.percentage - a.percentage);

      const top3SectorWeight = sectorAllocation.slice(0, 3).reduce((sum, s) => sum + s.percentage, 0);
      const diversificationScore = holdings.reduce((sum, h) => sum + Math.pow(h.percentage, 2), 0);

      // Create snapshot
      const snapshot = new DailySnapshot({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: new Date(),
        totalHoldings: holdings.length,
        totalMarketValue,
        topHoldings: holdings.slice(0, 10).map(h => ({
          stockName: h.stockName,
          stockSymbol: h.stockSymbol,
          percentage: h.percentage,
          sector: h.sector,
          marketValue: h.marketValue
        })),
        sectorAllocation,
        portfolioMetrics: {
          top5Weight,
          top10Weight,
          top3SectorWeight,
          diversificationScore
        }
      });

      const savedSnapshot = await snapshot.save();
      console.log(`✅ Created portfolio snapshot for fund ${fundId}`);
      return savedSnapshot;
    } catch (error) {
      console.error(`Error creating portfolio snapshot for ${fundId}:`, error);
      return null;
    }
  }

  async detectPortfolioChanges(fundId: string): Promise<IPortfolioChange[]> {
    try {
      const changes: PortfolioChangeData[] = [];
      
      // Get today's and yesterday's holdings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayHoldings = await HoldingSnapshot.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: today, $lt: tomorrow }
      });

      const yesterdayHoldings = await HoldingSnapshot.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: yesterday, $lt: today }
      });

      if (todayHoldings.length === 0 || yesterdayHoldings.length === 0) {
        console.log(`Insufficient data for change detection for fund ${fundId}`);
        return [] as IPortfolioChange[];
      }

      // Create maps for easier comparison
      const todayMap = new Map(todayHoldings.map(h => [h.stockSymbol, h]));
      const yesterdayMap = new Map(yesterdayHoldings.map(h => [h.stockSymbol, h]));

      // Detect additions (new stocks)
      for (const [symbol, todayHolding] of todayMap) {
        if (!yesterdayMap.has(symbol)) {
          changes.push({
            fundId: new mongoose.Types.ObjectId(fundId),
            date: new Date(),
            changeType: 'ADDITION',
            stockSymbol: symbol,
            stockName: todayHolding.stockName,
            newPercentage: todayHolding.percentage,
            changeAmount: todayHolding.percentage,
            sector: todayHolding.sector,
            significance: this.calculateSignificance(todayHolding.percentage)
          });
        }
      }

      // Detect exits (removed stocks)
      for (const [symbol, yesterdayHolding] of yesterdayMap) {
        if (!todayMap.has(symbol)) {
          changes.push({
            fundId: new mongoose.Types.ObjectId(fundId),
            date: new Date(),
            changeType: 'EXIT',
            stockSymbol: symbol,
            stockName: yesterdayHolding.stockName,
            oldPercentage: yesterdayHolding.percentage,
            changeAmount: -yesterdayHolding.percentage,
            sector: yesterdayHolding.sector,
            significance: this.calculateSignificance(yesterdayHolding.percentage)
          });
        }
      }

      // Detect increases and decreases
      for (const [symbol, todayHolding] of todayMap) {
        const yesterdayHolding = yesterdayMap.get(symbol);
        if (yesterdayHolding) {
          const change = todayHolding.percentage - yesterdayHolding.percentage;
          if (Math.abs(change) > 0.1) { // Only track changes > 0.1%
            changes.push({
              fundId: new mongoose.Types.ObjectId(fundId),
              date: new Date(),
              changeType: change > 0 ? 'INCREASE' : 'DECREASE',
              stockSymbol: symbol,
              stockName: todayHolding.stockName,
              oldPercentage: yesterdayHolding.percentage,
              newPercentage: todayHolding.percentage,
              changeAmount: change,
              sector: todayHolding.sector,
              significance: this.calculateSignificance(Math.abs(change))
            });
          }
        }
      }

      // Save changes to database
      if (changes.length > 0) {
        const savedChanges: IPortfolioChange[] = await PortfolioChange.insertMany(changes);
        console.log(`✅ Detected ${changes.length} portfolio changes for fund ${fundId}`);
        return savedChanges;
      }

      return [] as IPortfolioChange[];
    } catch (error) {
      console.error(`Error detecting portfolio changes for ${fundId}:`, error);
      return [] as IPortfolioChange[];
    }
  }

  private calculateSignificance(changeAmount: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (changeAmount >= 2) return 'HIGH';
    if (changeAmount >= 1) return 'MEDIUM';
    return 'LOW';
  }

  async getFundHistory(fundId: string, days: number = 30): Promise<IFundSnapshot[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await FundSnapshot.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 });
    } catch (error) {
      console.error(`Error getting fund history for ${fundId}:`, error);
      return [];
    }
  }

  async getHoldingsHistory(fundId: string, days: number = 30): Promise<IHoldingSnapshot[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await HoldingSnapshot.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1, percentage: -1 });
    } catch (error) {
      console.error(`Error getting holdings history for ${fundId}:`, error);
      return [];
    }
  }

  async getPortfolioChanges(fundId: string, days: number = 30): Promise<IPortfolioChange[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await PortfolioChange.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: -1 }).populate('fundId', 'name amc');
    } catch (error) {
      console.error(`Error getting portfolio changes for ${fundId}:`, error);
      return [];
    }
  }

  async getSignificantChanges(days: number = 7): Promise<IPortfolioChange[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await PortfolioChange.find({
        date: { $gte: startDate, $lte: endDate },
        significance: { $in: ['HIGH', 'MEDIUM'] }
      }).sort({ date: -1 }).populate('fundId', 'name amc');
    } catch (error) {
      console.error(`Error getting significant changes:`, error);
      return [];
    }
  }
}
