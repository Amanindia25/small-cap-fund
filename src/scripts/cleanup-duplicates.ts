import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import { Fund } from '../models/Fund';
import { Holding } from '../models/Holding';

async function cleanupDuplicates(): Promise<void> {
  try {
    await connectDB();

    const funds = await Fund.find({}).lean();
    const fundGroups = new Map<string, any[]>();

    for (const fund of funds) {
      const key = `${fund.name}|${fund.planType}`;
      if (!fundGroups.has(key)) fundGroups.set(key, []);
      fundGroups.get(key)!.push(fund);
    }

    let removed = 0;

    for (const [key, group] of fundGroups) {
      if (group.length > 1) {
        // Sort by updatedAt desc
        group.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const toRemove = group.slice(1);
        for (const duplicate of toRemove) {
          await Holding.deleteMany({ fundId: duplicate._id });
          await Fund.deleteOne({ _id: duplicate._id });
          removed++;
          console.log(`Removed duplicate: ${duplicate.name} (${duplicate.planType}) - ${duplicate._id}`);
        }
      }
    }

    const finalCount = await Fund.countDocuments();
    console.log(`✅ Cleanup done. Removed: ${removed}. Final funds: ${finalCount}`);
  } catch (err) {
    console.error('❌ Cleanup error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

cleanupDuplicates();
