import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const username = searchParams.get('username') || 'user'
    const bio = searchParams.get('bio') || ''
    const catalogCount = searchParams.get('catalogs') || '0'
    const followerCount = searchParams.get('followers') || '0'
    const avatarUrl = searchParams.get('avatar') || null

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#fff',
            position: 'relative',
          }}
        >
          {/* Left Side - Black */}
          <div
            style={{
              width: '50%',
              height: '100%',
              backgroundColor: '#000',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '8px solid #fff',
                }}
              />
            ) : (
              <div
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 120,
                }}
              >
                👤
              </div>
            )}
          </div>

          {/* Right Side - White */}
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '60px',
              gap: '30px',
            }}
          >
            {/* Logo */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '0.3em',
                opacity: 0.4,
              }}
            >
              SOURCED
            </div>

            {/* Username */}
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              @{username}
            </div>

            {/* Bio */}
            {bio && (
              <div
                style={{
                  fontSize: 24,
                  opacity: 0.7,
                  lineHeight: 1.4,
                  maxWidth: '400px',
                }}
              >
                {bio.slice(0, 100)}{bio.length > 100 ? '...' : ''}
              </div>
            )}

            {/* Stats */}
            <div
              style={{
                display: 'flex',
                gap: '40px',
                fontSize: 20,
                opacity: 0.6,
                letterSpacing: '0.1em',
              }}
            >
              <div>{followerCount} FOLLOWERS</div>
              <div>{catalogCount} CATALOGS</div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e) {
    console.error(e)
    return new Response('Failed to generate image', { status: 500 })
  }
}