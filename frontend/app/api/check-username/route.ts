import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 Frontend received username check for:', body.username);

    // Call your FastAPI backend
    const response = await fetch('http://127.0.0.1:5000/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('❌ Backend error:', response.status);
      const errorText = await response.text();
      console.error('❌ Backend error details:', errorText);
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📦 Backend response:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('💥 Error checking username:', error);
    // Fail open - allow username if check fails
    return NextResponse.json(
      { safe: true },
      { status: 200 }
    );
  }
}