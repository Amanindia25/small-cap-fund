import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { DailySnapshot } from '../models/DailySnapshot';
import { HoldingSnapshot } from '../models/HoldingSnapshot';

async function run(): Promise<void> {
  await connectDB();

  // Helpers to parse YYYY-MM-DD
  const parseYmd = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCHours(0, 0, 0, 0);
    return dt;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today); todayEnd.setDate(todayEnd.getDate() + 1);

  // Target date env (YYYY-MM-DD); default to yesterday
  const targetEnv = process.env.TARGET_DATE;
  const targetStart = targetEnv ? parseYmd(targetEnv) : new Date(today.getTime() - 24*60*60*1000);
  const targetEnd = new Date(targetStart); targetEnd.setDate(targetEnd.getDate() + 1);

  // Optional: backfill only one fund if FUND_ID env is set
  const fundFilter: Record<string, unknown> = {};
  const fundIdEnv = process.env.FUND_ID;
  if (fundIdEnv) {
    try {
      fundFilter.fundId = new mongoose.Types.ObjectId(fundIdEnv);
    } catch {
      console.error('Invalid FUND_ID. Provide a valid ObjectId.');
      process.exit(1);
    }
  }

  // Determine source date: prefer today; allow SOURCE_DATE override; else fallback to most recent
  let sourceDate: Date | null = today;
  const sourceEnv = process.env.SOURCE_DATE;
  if (sourceEnv) {
    sourceDate = parseYmd(sourceEnv);
  }
  const srcEndForQuery = new Date(sourceDate.getTime() + 24*60*60*1000);
  let dailyDocs = await DailySnapshot.find({ date: { $gte: sourceDate, $lt: srcEndForQuery }, ...fundFilter }).lean();
  if (dailyDocs.length === 0) {
    const latestDaily = await DailySnapshot
      .find({ ...fundFilter })
      .sort({ date: -1 })
      .limit(1)
      .lean();
    if (latestDaily.length > 0) {
      sourceDate = new Date(latestDaily[0].date);
      sourceDate.setHours(0,0,0,0);
      console.log(`No DailySnapshot for today. Falling back to latest date: ${sourceDate.toISOString().slice(0,10)}`);
      const srcEnd = new Date(sourceDate); srcEnd.setDate(srcEnd.getDate() + 1);
      dailyDocs = await DailySnapshot.find({ date: { $gte: sourceDate, $lt: srcEnd }, ...fundFilter }).lean();
    } else {
      sourceDate = null;
    }
  }

  // 1) Daily snapshots
  if (!sourceDate || dailyDocs.length === 0) {
    console.log('No DailySnapshot found to backfill.');
  } else {
    // Upsert-protect: Avoid duplicate unique (fundId,date)
    const dailyPayload = dailyDocs.map(d => {
      const { _id, createdAt, updatedAt, ...rest } = d as Record<string, unknown>;
      return { ...rest, date: targetStart, createdAt: targetStart, updatedAt: targetStart };
    });
    for (const doc of dailyPayload) {
      try {
        await DailySnapshot.create(doc as any);
      } catch (e: any) {
        if (e && e.code === 11000) {
          // duplicate for (fundId, date) – ignore
        } else {
          throw e;
        }
      }
    }
    console.log(`Backfilled DailySnapshot from ${sourceDate.toISOString().slice(0,10)} -> ${targetStart.toISOString().slice(0,10)}: ${dailyDocs.length} docs`);
  }

  // 2) Holding snapshots
  let holdingDocs = sourceDate
    ? await HoldingSnapshot.find({ date: { $gte: sourceDate, $lt: new Date(sourceDate.getTime() + 24*60*60*1000) }, ...fundFilter }).lean()
    : [] as any[];
  if (holdingDocs.length === 0) {
    console.log('No HoldingSnapshot found to backfill.');
  } else {
    const holdingPayload = holdingDocs.map(h => {
      const { _id, createdAt, updatedAt, ...rest } = h as Record<string, unknown>;
      return { ...rest, date: targetStart, createdAt: targetStart, updatedAt: targetStart };
    });

    // Unique composite (fundId, stockSymbol, date) → use upserts
    for (const doc of holdingPayload) {
      try {
        await HoldingSnapshot.create(doc as any);
      } catch (e: any) {
        if (e && e.code === 11000) {
          // duplicate for (fundId, stockSymbol, date) – ignore
        } else {
          throw e;
        }
      }
    }
    console.log(`Backfilled HoldingSnapshot from ${sourceDate!.toISOString().slice(0,10)} -> ${targetStart.toISOString().slice(0,10)}: ${holdingDocs.length} docs`);
  }

  await mongoose.connection.close();
  console.log('Done backfilling yesterday snapshots.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


