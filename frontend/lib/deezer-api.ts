/**
 * Deezer API Client
 * No authentication required for search and preview URLs
 * Free and always available
 */

export interface DeezerTrack {
  trackId: string;
  previewUrl: string;
  trackName: string;
  artist: string;
  albumArt: string;
  deezerUrl: string;
  duration: number;
}

/**
 * Search for tracks on Deezer via backend API
 */
export async function searchDeezerTracks(query: string, limit: number = 20): Promise<DeezerTrack[]> {
  try {
    const response = await fetch(
      `/api/deezer/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error('Deezer search failed');
    }

    const data = await response.json();
    return data.tracks;
  } catch (error) {
    console.error('Deezer search error:', error);
    throw error;
  }
}

/**
 * Get track by ID via backend API
 */
export async function getDeezerTrack(trackId: string): Promise<DeezerTrack> {
  try {
    const response = await fetch(`/api/deezer/track/${trackId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch track');
    }

    const data = await response.json();
    return data.track;
  } catch (error) {
    console.error('Deezer track fetch error:', error);
    throw error;
  }
}

/**
 * Extract Deezer track ID from URL
 * Example: https://www.deezer.com/track/123456
 */
export function extractDeezerTrackId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    if (!urlObj.hostname.includes('deezer.com')) {
      return null;
    }

    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'track' && pathParts[1]) {
      return pathParts[1].split('?')[0];
    }

    return null;
  } catch {
    return null;
  }
}