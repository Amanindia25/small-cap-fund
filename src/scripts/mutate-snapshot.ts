import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { HoldingSnapshot } from '../models/HoldingSnapshot';

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

async function run(): Promise<void> {
  await connectDB();

  const target = process.env.DATE || process.env.TARGET_DATE;
  if (!target) {
    console.error('Provide DATE=YYYY-MM-DD');
    process.exit(1);
  }
  const dateStart = parseYmd(target);
  const dateEnd = new Date(dateStart); dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

  const fundIdEnv = process.env.FUND_ID;
  const baseFilter: Record<string, unknown> = { date: { $gte: dateStart, $lt: dateEnd } };
  if (fundIdEnv) baseFilter.fundId = new mongoose.Types.ObjectId(fundIdEnv);

  const holdings = await HoldingSnapshot.find(baseFilter).limit(5).lean();
  if (holdings.length === 0) {
    console.log('No holdings found for given date/fund.');
    await mongoose.connection.close();
    return;
  }

  const pickedFundId = holdings[0].fundId as unknown as mongoose.Types.ObjectId;

  // 1) Increase percentage of first holding by +0.50
  await HoldingSnapshot.updateOne(
    { _id: holdings[0]._id },
    { $inc: { percentage: 0.5 } }
  );

  // 2) Decrease percentage of second holding by -0.30 (if exists and safe)
  if (holdings[1]) {
    await HoldingSnapshot.updateOne(
      { _id: holdings[1]._id },
      { $inc: { percentage: -0.3 } }
    );
  }

  // 3) Insert a new small holding to simulate ADDITION
  await HoldingSnapshot.create({
    fundId: pickedFundId,
    date: dateStart,
    stockName: 'Demo Test Holding Ltd.',
    stockSymbol: 'ZZ_TEST',
    percentage: 0.25,
    sector: 'Unknown',
    marketValue: 100,
    quantity: 1,
    oneMonthChange: 0,
    createdAt: dateStart,
    updatedAt: dateStart
  });

  console.log(`Mutated holdings for ${target} (fundId=${pickedFundId.toString()}).`);
  await mongoose.connection.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


