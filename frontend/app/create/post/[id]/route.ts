import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = params.id;

  try {
    const { data: post, error } = await supabase
      .from('feed_posts')
      .select(`
        id,
        image_url,
        caption,
        profiles!feed_posts_owner_id_fkey(username, full_name, is_verified)
      `)
      .eq('id', postId)
      .single();

    if (error || !post) {
      return new NextResponse('Post not found', { status: 404 });
    }

    const owner = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    const username = owner.username;
    const caption = post.caption || `Check out @${username}'s post on Sourced`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${username} on Sourced</title>
  <meta property="og:title" content="@${username} on Sourced" />
  <meta property="og:description" content="${caption.substring(0, 200)}" />
  <meta property="og:image" content="${post.image_url}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${request.url}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="@${username} on Sourced" />
  <meta name="twitter:description" content="${caption.substring(0, 200)}" />
  <meta name="twitter:image" content="${post.image_url}" />

  <meta http-equiv="refresh" content="0; url=/feed" />
</head>
<body>
  <p>Redirecting to Sourced...</p>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}