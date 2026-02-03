import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=7', {
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Fear & Greed Index:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Fear & Greed Index' }, 
      { status: 500 }
    );
  }
}
