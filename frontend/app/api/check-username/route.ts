import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { safe: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking username:', username);

    // Call your FastAPI backend
    const backendUrl = "https://sourced-5ovn.onrender.com/check-username";
    console.log('📡 Calling backend:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ username }),
    });

    console.log('📊 Backend status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend error:', response.status, errorText);

      // Fail open - allow username if backend fails
      return NextResponse.json({ safe: true });
    }

    const data = await response.json();
    console.log('✅ Backend response:', data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('💥 Error checking username:', error.message);

    // Fail open - allow username if check fails
    return NextResponse.json({ safe: true });
  }
}