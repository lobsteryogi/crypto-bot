// instrumentation.ts - Next.js server-side initialization
// This runs when the Next.js server starts

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Next.js server starting - initializing trading loop...');
    
    // Dynamic import to avoid bundling issues
    const { startTrading } = await import('./lib/trading/index.js');
    
    // Small delay to ensure server is fully ready
    setTimeout(async () => {
      try {
        const result = await startTrading();
        console.log('✅ Trading loop started:', result.message);
      } catch (error) {
        console.error('❌ Failed to start trading loop:', error);
      }
    }, 3000); // 3 second delay
  }
}

export const onRequestError = async (err: Error) => {
  console.error('Request error:', err);
};
