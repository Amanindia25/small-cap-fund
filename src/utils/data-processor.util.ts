import { FundData, ScrapingResult } from '../types/fund.types';
import * as fs from 'fs';
import * as path from 'path';

export class DataProcessor {
  static cleanFundData(funds: FundData[]): FundData[] {
    return funds.filter(fund => {
      // Remove sponsored ads and invalid entries
      return !fund.isSponsored && 
             fund.schemeName.length > 0;
    });
  }

  static sortFundsByEquityHolding(funds: FundData[]): FundData[] {
    return funds.sort((a, b) => {
      const aEquity = a.portfolio.equityHolding || -999;
      const bEquity = b.portfolio.equityHolding || -999;
      return bEquity - aEquity;
    });
  }

  static sortFundsByNumberOfStocks(funds: FundData[]): FundData[] {
    return funds.sort((a, b) => {
      const aStocks = a.portfolio.numberOfStocks || -999;
      const bStocks = b.portfolio.numberOfStocks || -999;
      return bStocks - aStocks;
    });
  }

  static generateSummary(result: ScrapingResult): string {
    const { data, totalFunds, timestamp } = result;
    const directPlans = data.filter(f => f.planType === 'Direct Plan').length;
    const regularPlans = data.filter(f => f.planType === 'Regular Plan').length;
    
    const avgEquityHolding = data
      .filter(f => f.portfolio.equityHolding !== undefined)
      .reduce((sum, fund) => sum + (fund.portfolio.equityHolding || 0), 0) / 
      data.filter(f => f.portfolio.equityHolding !== undefined).length;
      
    const avgNumberOfStocks = data
      .filter(f => f.portfolio.numberOfStocks !== undefined)
      .reduce((sum, fund) => sum + (fund.portfolio.numberOfStocks || 0), 0) / 
      data.filter(f => f.portfolio.numberOfStocks !== undefined).length;

    return `
=== SMALL CAP FUNDS PORTFOLIO SCRAPING SUMMARY ===
Timestamp: ${timestamp.toISOString()}
Total Funds Found: ${totalFunds}
Direct Plans: ${directPlans}
Regular Plans: ${regularPlans}
Average Equity Holding: ${avgEquityHolding.toFixed(2)}%
Average Number of Stocks: ${avgNumberOfStocks.toFixed(0)}
========================================
    `.trim();
  }

  static saveToJSON(data: FundData[], filename: string = 'small-cap-funds.json'): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to: ${filePath}`);
  }

  static saveToCSV(data: FundData[], filename: string = 'small-cap-funds.csv'): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const headers = [
      'Scheme Name',
      'CRISIL Rating',
      'Plan Type',
      'Turnover Ratio (%)',
      'Equity Holding (%)',
      'Number of Stocks',
      'Debt Holding (%)',
      'Number of Debt Holdings',
      'MF Holding (%)',
      'Cash Holding (%)',
      'Other Holding (%)'
    ];

    const csvRows = [headers.join(',')];

    data.forEach(fund => {
      const row = [
        `"${fund.schemeName}"`,
        fund.crisilRating || '',
        fund.planType,
        fund.portfolio.turnoverRatio || '',
        fund.portfolio.equityHolding || '',
        fund.portfolio.numberOfStocks || '',
        fund.portfolio.debtHolding || '',
        fund.portfolio.numberOfDebtHoldings || '',
        fund.portfolio.mfHolding || '',
        fund.portfolio.cashHolding || '',
        fund.portfolio.otherHolding || ''
      ];
      csvRows.push(row.join(','));
    });

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, csvRows.join('\n'));
    console.log(`CSV saved to: ${filePath}`);
  }

  static printTopFunds(funds: FundData[], count: number = 10): void {
    console.log(`\n=== TOP ${count} FUNDS BY EQUITY HOLDING ===`);
    const topByEquity = this.sortFundsByEquityHolding(funds).slice(0, count);
    
    topByEquity.forEach((fund, index) => {
      console.log(`${index + 1}. ${fund.schemeName}`);
      console.log(`   Equity: ${fund.portfolio.equityHolding?.toFixed(2) || 'N/A'}% | Stocks: ${fund.portfolio.numberOfStocks || 'N/A'} | Rating: ${fund.crisilRating || 'N/A'}⭐`);
    });
  }
}
