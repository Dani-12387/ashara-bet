const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    
    // Check if MONGODB_URI is set
    if (!uri) {
      console.error('❌ MONGODB_URI environment variable is NOT SET!');
      console.log('💡 Please set MONGODB_URI in your environment variables.');
      console.log('💡 For Render: Go to Dashboard → Environment → Add MONGODB_URI');
      process.exit(1);
    }
    
    console.log('🔄 Connecting to MongoDB Atlas...');
    console.log('📊 Using URI:', uri.substring(0, 50) + '...');
    
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
    });
    
    console.log(`✅ MongoDB Connected Successfully`);
    console.log(`📊 Host: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
    console.log(`📊 Connection State: ${mongoose.connection.readyState}`);
    
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`❌ Error Details:`, error);
    process.exit(1);
  }
};

module.exports = connectDB;