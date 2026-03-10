import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, itemType, userId } = body;

    // Validate inputs (userId is now optional)
    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Missing itemId or itemType' },
        { status: 400 }
      );
    }

    // Get IP address for logged-out users
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    console.log('🌐 IP Address:', ip);
    console.log('👤 User ID:', userId || 'logged out');

    // Determine table name
    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    // 1. TRACK CLICK (pass both userId and IP)
    const { data: clickData, error: clickError } = await supabase.rpc('increment_click_count', {
      p_table_name: tableName,
      p_item_id: itemId,
      p_user_id: userId || null,
      p_ip_address: userId ? null : ip, // Only use IP if not logged in
    });

    if (clickError) {
      console.error('Click tracking failed:', clickError);
      return NextResponse.json(
        { error: 'Click tracking failed', details: clickError.message },
        { status: 500 }
      );
    }

    const isNewUniqueClick = clickData?.[0]?.is_new_unique || false;
    console.log('🆕 Is new unique click:', isNewUniqueClick);

    // 2. TRY TO ADD EARNINGS (only for NEW unique clicks from verified creators)
    let earningsAdded = false;
    let earningsCents = 0;

    // Only add earnings if this is a NEW unique click
    if (!isNewUniqueClick) {
      console.log('ℹ️ Not a new unique click (already clicked from this user/IP), skipping earnings');
    } else {
      try {
        console.log('🔍 Checking earnings for new unique click on item:', itemId);

        // Get item and owner in one query
        let ownerId = null;
        let itemIsMonetized = false;

        if (itemType === 'catalog') {
          const { data: catalogData, error: catalogError } = await supabase
            .from('catalog_items')
            .select('is_monetized, catalogs!inner(owner_id, profiles!inner(is_verified))')
            .eq('id', itemId)
            .single();

          console.log('📋 Catalog data:', catalogData);
          console.log('❌ Catalog error:', catalogError);

          if (catalogData) {
            const catalogItem = catalogData as any;
            ownerId = catalogItem?.catalogs?.owner_id;
            itemIsMonetized = catalogItem?.is_monetized || false;
            const creatorIsVerified = catalogItem?.catalogs?.profiles?.is_verified || false;

            console.log('👤 Owner ID:', ownerId);
            console.log('✅ Creator verified:', creatorIsVerified);
            console.log('💎 Item monetized:', itemIsMonetized);

            // Only add earnings if creator is verified
            if (!creatorIsVerified) {
              console.log('ℹ️ Creator not verified, skipping earnings');
              ownerId = null; // Clear owner ID to skip earnings
            }
          }
        } else {
          const { data: feedData, error: feedError } = await supabase
            .from('feed_post_items')
            .select('is_monetized, feed_posts!inner(user_id, profiles!inner(is_verified))')
            .eq('id', itemId)
            .single();

          console.log('📋 Feed data:', feedData);
          console.log('❌ Feed error:', feedError);

          if (feedData) {
            const feedItem = feedData as any;
            ownerId = feedItem?.feed_posts?.user_id;
            itemIsMonetized = feedItem?.is_monetized || false;
            const creatorIsVerified = feedItem?.feed_posts?.profiles?.is_verified || false;

            console.log('👤 Owner ID:', ownerId);
            console.log('✅ Creator verified:', creatorIsVerified);
            console.log('💎 Item monetized:', itemIsMonetized);

            if (!creatorIsVerified) {
              console.log('ℹ️ Creator not verified, skipping earnings');
              ownerId = null;
            }
          }
        }

        if (ownerId) {
          // TIERED EARNINGS (only for NEW unique clicks):
          // Monetized items: 3-8 cents
          // Regular items (verified creator): 2-4 cents
          if (itemIsMonetized) {
            earningsCents = Math.floor(Math.random() * 6) + 3; // 3-8 cents
          } else {
            earningsCents = Math.floor(Math.random() * 3) + 2; // 2-4 cents
          }

          console.log('💰 Adding earnings:', earningsCents, 'cents (NEW unique click)');

          // Add earnings
          const { data: earningsData, error: earningsError } = await supabase.rpc('add_creator_earnings', {
            p_user_id: ownerId,
            p_item_id: itemId,
            p_item_type: itemType,
            p_amount_cents: earningsCents,
            p_description: itemIsMonetized ? 'Monetized item click' : 'Regular item click',
          });

          console.log('💰 Earnings data:', earningsData);
          console.log('❌ Earnings error:', earningsError);

          if (!earningsError) {
            earningsAdded = true;
            console.log('✅ Earnings added successfully!');
          }
        }
      } catch (err) {
        // Log but don't fail the request
        console.error('❌ Earnings failed (non-critical):', err);
      }
    }

    // Return success with click data
    return NextResponse.json({
      success: true,
      clicks: clickData?.[0] || null,
      earnings_added: earningsAdded,
      earnings_cents: earningsCents,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}