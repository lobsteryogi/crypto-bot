// GET /api/trading/status - Get trading status
import { NextResponse } from 'next/server';
import { getTradingStatus } from '../../../../../lib/trading/index.js';

export async function GET() {
  try {
    const status = getTradingStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting trading status:', error);
    return NextResponse.json(
      { error: 'Failed to get trading status', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
