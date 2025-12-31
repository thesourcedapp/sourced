import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const catalogName = searchParams.get('catalog') || 'Catalog'
    const username = searchParams.get('username') || 'user'
    const itemCount = searchParams.get('items') || '0'
    const catalogImage = searchParams.get('image') || null

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000',
            position: 'relative',
          }}
        >
          {/* Background Image (if exists) */}
          {catalogImage && (
            <img
              src={catalogImage}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.3,
              }}
            />
          )}

          {/* Dark Overlay */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.9))',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              padding: '60px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Top Section */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 32,
                  color: '#fff',
                  opacity: 0.6,
                  letterSpacing: '0.3em',
                  fontWeight: 900,
                  marginBottom: '20px',
                }}
              >
                SOURCED
              </div>
            </div>

            {/* Middle Section - Catalog Name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  maxWidth: '900px',
                }}
              >
                {catalogName}
              </div>
            </div>

            {/* Bottom Section - Stats */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  color: '#fff',
                  opacity: 0.8,
                  letterSpacing: '0.1em',
                }}
              >
                @{username}
              </div>
              <div
                style={{
                  fontSize: 28,
                  color: '#fff',
                  opacity: 0.8,
                  letterSpacing: '0.1em',
                }}
              >
                {itemCount} ITEMS
              </div>
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