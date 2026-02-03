// POST /api/trading/stop - Stop trading loop
import { NextResponse } from 'next/server';
import { stopTrading, getTradingStatus } from '../../../../../lib/trading/index.js';

export async function POST() {
  try {
    const result = stopTrading();
    const status = getTradingStatus();
    
    return NextResponse.json({
      ...result,
      status
    });
  } catch (error) {
    console.error('Error stopping trading:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop trading', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
