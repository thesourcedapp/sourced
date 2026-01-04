import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '20';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error('Deezer API failed');
    }

    const data = await response.json();

    const tracks = data.data.map((track: any) => ({
      trackId: track.id.toString(),
      previewUrl: track.preview,
      trackName: track.title,
      artist: track.artist.name,
      albumArt: track.album.cover_xl || track.album.cover_big,
      deezerUrl: track.link,
      duration: track.duration
    }));

    return NextResponse.json({ tracks });

  } catch (error: any) {
    console.error('Deezer search error:', error);
    return NextResponse.json(
      { error: 'Failed to search music' },
      { status: 500 }
    );
  }
}