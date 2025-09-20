import { Fund, IFund } from '../models/Fund';
import { Holding, IHolding } from '../models/Holding';
import { PortfolioChange, IPortfolioChange } from '../models/PortfolioChange';
import { DailySnapshot, IDailySnapshot } from '../models/DailySnapshot';
import mongoose from 'mongoose';

export class PortfolioChangeService {
  
  async createDailySnapshot(fundId: string): Promise<IDailySnapshot | null> {
    try {
      // Get current holdings for the fund
      const holdings = await Holding.find({ 
        fundId: new mongoose.Types.ObjectId(fundId) 
      }).sort({ percentage: -1 });

      if (holdings.length === 0) {
        console.log(`No holdings found for fund ${fundId}`);
        return null;
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

      // Calculate diversification score (lower is more diversified)
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

      return await snapshot.save();
    } catch (error) {
      console.error(`Error creating daily snapshot for fund ${fundId}:`, error);
      return null;
    }
  }

  /**
   * Compare two snapshots and compute portfolio changes.
   * If fromDate/toDate are not provided, the latest two snapshots are compared.
   */
  async compareSnapshots(
    fundId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<IPortfolioChange[]> {
    try {
      const fundObjectId = new mongoose.Types.ObjectId(fundId);

      let baseSnapshot: IDailySnapshot | null = null;
      let targetSnapshot: IDailySnapshot | null = null;

      if (fromDate && toDate) {
        // Find snapshots for the given dates (closest on or after start of day)
        const startA = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const endA = new Date(startA);
        endA.setDate(endA.getDate() + 1);

        const startB = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        const endB = new Date(startB);
        endB.setDate(endB.getDate() + 1);

        [baseSnapshot, targetSnapshot] = await Promise.all([
          DailySnapshot.findOne({ fundId: fundObjectId, date: { $gte: startA, $lt: endA } }).sort({ date: -1 }),
          DailySnapshot.findOne({ fundId: fundObjectId, date: { $gte: startB, $lt: endB } }).sort({ date: -1 })
        ]);
      } else {
        // Latest two snapshots
        const latestTwo = await DailySnapshot.find({ fundId: fundObjectId })
          .sort({ date: -1 })
          .limit(2);
        targetSnapshot = latestTwo[0] || null;
        baseSnapshot = latestTwo[1] || null;
      }

      if (!baseSnapshot || !targetSnapshot) {
        return [];
      }

      const changes: IPortfolioChange[] = [];
      const targetDate = targetSnapshot.date;

      const baseMap = new Map(
        (baseSnapshot.topHoldings || []).map(h => [h.stockSymbol, h])
      );
      const targetMap = new Map(
        (targetSnapshot.topHoldings || []).map(h => [h.stockSymbol, h])
      );

      // Additions
      for (const [symbol, cur] of targetMap) {
        if (!baseMap.has(symbol)) {
          changes.push({
            fundId: fundObjectId,
            date: targetDate,
            changeType: 'ADDITION',
            stockSymbol: symbol,
            stockName: cur.stockName,
            newPercentage: cur.percentage,
            changeAmount: cur.percentage,
            sector: cur.sector,
            significance: this.calculateSignificance(cur.percentage)
          } as IPortfolioChange);
        }
      }

      // Exits
      for (const [symbol, prev] of baseMap) {
        if (!targetMap.has(symbol)) {
          changes.push({
            fundId: fundObjectId,
            date: targetDate,
            changeType: 'EXIT',
            stockSymbol: symbol,
            stockName: prev.stockName,
            oldPercentage: prev.percentage,
            changeAmount: -prev.percentage,
            sector: prev.sector,
            significance: this.calculateSignificance(prev.percentage)
          } as IPortfolioChange);
        }
      }

      // Increases / Decreases
      for (const [symbol, cur] of targetMap) {
        const prev = baseMap.get(symbol);
        if (!prev) continue;
        const delta = cur.percentage - prev.percentage;
        if (Math.abs(delta) <= 0.1) continue; // ignore tiny noise
        changes.push({
          fundId: fundObjectId,
          date: targetDate,
          changeType: delta > 0 ? 'INCREASE' : 'DECREASE',
          stockSymbol: symbol,
          stockName: cur.stockName,
          oldPercentage: prev.percentage,
          newPercentage: cur.percentage,
          changeAmount: delta,
          sector: cur.sector,
          significance: this.calculateSignificance(Math.abs(delta))
        } as IPortfolioChange);
      }

      return changes.sort((a, b) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount));
    } catch (error) {
      console.error(`Error comparing snapshots for fund ${fundId}:`, error);
      return [];
    }
  }

  async detectPortfolioChanges(fundId: string): Promise<IPortfolioChange[]> {
    try {
      // Get today's and yesterday's snapshots
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [todaySnapshot, yesterdaySnapshot] = await Promise.all([
        DailySnapshot.findOne({ 
          fundId: new mongoose.Types.ObjectId(fundId), 
          date: { $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) }
        }),
        DailySnapshot.findOne({ 
          fundId: new mongoose.Types.ObjectId(fundId), 
          date: { $gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()) }
        })
      ]);

      if (!todaySnapshot || !yesterdaySnapshot) {
        console.log(`Missing snapshots for fund ${fundId}`);
        return [];
      }

      const changes: IPortfolioChange[] = [];

      // Create maps for easy comparison
      const todayHoldings = new Map(
        todaySnapshot.topHoldings.map(h => [h.stockSymbol, h])
      );
      const yesterdayHoldings = new Map(
        yesterdaySnapshot.topHoldings.map(h => [h.stockSymbol, h])
      );

      // Detect additions (new stocks)
      for (const [symbol, todayHolding] of todayHoldings) {
        if (!yesterdayHoldings.has(symbol)) {
          changes.push({
            fundId: new mongoose.Types.ObjectId(fundId),
            date: today,
            changeType: 'ADDITION',
            stockSymbol: symbol,
            stockName: todayHolding.stockName,
            newPercentage: todayHolding.percentage,
            changeAmount: todayHolding.percentage,
            sector: todayHolding.sector,
            significance: this.calculateSignificance(todayHolding.percentage)
          } as IPortfolioChange);
        }
      }

      // Detect exits (removed stocks)
      for (const [symbol, yesterdayHolding] of yesterdayHoldings) {
        if (!todayHoldings.has(symbol)) {
          changes.push({
            fundId: new mongoose.Types.ObjectId(fundId),
            date: today,
            changeType: 'EXIT',
            stockSymbol: symbol,
            stockName: yesterdayHolding.stockName,
            oldPercentage: yesterdayHolding.percentage,
            changeAmount: -yesterdayHolding.percentage,
            sector: yesterdayHolding.sector,
            significance: this.calculateSignificance(yesterdayHolding.percentage)
          } as IPortfolioChange);
        }
      }

      // Detect increases and decreases
      for (const [symbol, todayHolding] of todayHoldings) {
        const yesterdayHolding = yesterdayHoldings.get(symbol);
        if (yesterdayHolding) {
          const change = todayHolding.percentage - yesterdayHolding.percentage;
          if (Math.abs(change) > 0.1) { // Only track changes > 0.1%
            changes.push({
              fundId: new mongoose.Types.ObjectId(fundId),
              date: today,
              changeType: change > 0 ? 'INCREASE' : 'DECREASE',
              stockSymbol: symbol,
              stockName: todayHolding.stockName,
              oldPercentage: yesterdayHolding.percentage,
              newPercentage: todayHolding.percentage,
              changeAmount: change,
              sector: todayHolding.sector,
              significance: this.calculateSignificance(Math.abs(change))
            } as IPortfolioChange);
          }
        }
      }

      // Save changes to database
      if (changes.length > 0) {
        await PortfolioChange.insertMany(changes);
        console.log(`Detected ${changes.length} portfolio changes for fund ${fundId}`);
      }

      return changes;
    } catch (error) {
      console.error(`Error detecting portfolio changes for fund ${fundId}:`, error);
      return [];
    }
  }

  private calculateSignificance(changeAmount: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (changeAmount >= 2.0) return 'HIGH';
    if (changeAmount >= 0.5) return 'MEDIUM';
    return 'LOW';
  }

  async getPortfolioChangeHistory(fundId: string, days: number = 30): Promise<IPortfolioChange[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await PortfolioChange.find({
        fundId: new mongoose.Types.ObjectId(fundId),
        date: { $gte: startDate }
      }).sort({ date: -1 });
    } catch (error) {
      console.error(`Error fetching portfolio change history for fund ${fundId}:`, error);
      return [];
    }
  }

  async getSignificantChanges(days: number = 7): Promise<IPortfolioChange[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return await PortfolioChange.find({
        date: { $gte: startDate },
        significance: { $in: ['HIGH', 'MEDIUM'] }
      })
      .populate('fundId', 'name amc')
      .sort({ date: -1, changeAmount: -1 });
    } catch (error) {
      console.error('Error fetching significant changes:', error);
      return [];
    }
  }

  async getDailyChanges(fundId: string): Promise<IPortfolioChange[]> {
    try {
      // Compare latest two available snapshots (robust even if yesterday is missing)
      const changes = await this.compareSnapshots(fundId);
      return changes;
    } catch (error) {
      console.error(`Error fetching daily changes for fund ${fundId}:`, error);
      return [];
    }
  }
}
