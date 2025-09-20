// MongoDB Atlas Configuration
// Copy this file to config.ts and add your actual connection string

export const config = {
  // MongoDB Atlas connection string from environment
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://amankumarsinghindia2004_db_user:miUp3hUpWXHFGikQ@scrap-compare-small-cap.ugrij72.mongodb.net/?retryWrites=true&w=majority&appName=scrap-compare-small-cap-fund',
  
  // Server Configuration
  PORT: 3000,
  NODE_ENV: 'development'
};
