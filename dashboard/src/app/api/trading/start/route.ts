// POST /api/trading/start - Start trading loop
import { NextResponse } from 'next/server';
import { startTrading, getTradingStatus } from '../../../../../lib/trading/index.js';

export async function POST() {
  try {
    const result = await startTrading();
    const status = getTradingStatus();
    
    return NextResponse.json({
      ...result,
      status
    });
  } catch (error) {
    console.error('Error starting trading:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start trading', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
