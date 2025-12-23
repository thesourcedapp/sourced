import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 Checking image safety for:', body.image_url);

    // Call your FastAPI backend
    const response = await fetch('http://127.0.0.1:5000/check-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('❌ Backend error:', response.status);
      const errorText = await response.text();
      console.error('❌ Error details:', errorText);
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📦 Backend response:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('💥 Error checking image:', error);
    // Fail closed - don't allow image if check fails
    return NextResponse.json(
      { safe: false, error: "Failed to verify image safety" },
      { status: 200 }
    );
  }
}