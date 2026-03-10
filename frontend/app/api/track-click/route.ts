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
    const { itemId, itemType, userId } = await request.json();

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId and itemType' },
        { status: 400 }
      );
    }

    // userId is optional - if not provided, we still track the click but can't track unique users
    const userIdParam = userId || null;

    // Call the increment_click_count function (existing functionality)
    const { data: clickData, error: clickError } = await supabase.rpc(
      'increment_click_count',
      {
        table_name: itemType === 'catalog' ? 'catalog_items' : 'feed_post_items',
        item_id: itemId,
        user_id_param: userIdParam,
      }
    );

    if (clickError) {
      console.error('Click tracking error:', clickError);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }

    // Check if item is verified/monetized and get owner
    const table = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';
    const { data: itemData, error: itemError } = await supabase
      .from(table)
      .select(`
        id,
        is_verified,
        is_monetized,
        ${itemType === 'catalog' ? 'catalogs!inner(owner_id)' : 'feed_posts!inner(user_id)'}
      `)
      .eq('id', itemId)
      .single();

    if (itemError || !itemData) {
      console.error('Item fetch error:', itemError);
      return NextResponse.json({
        total_clicks: clickData?.total_clicks || 0,
        unique_clicks: clickData?.unique_clicks || 0,
        is_new_unique: clickData?.is_new_unique || false,
        earnings_added: false,
      });
    }

    // Add earnings for verified OR monetized items
    let earningsAdded = false;
    let earningsCents = 0;

    if (itemData.is_verified || itemData.is_monetized) {
      // Type-safe way to get creator ID
      let creatorId: string;

      if (itemType === 'catalog') {
        const catalogItem = itemData as any;
        creatorId = catalogItem.catalogs?.owner_id;
      } else {
        const feedItem = itemData as any;
        creatorId = feedItem.feed_posts?.user_id;
      }

      if (!creatorId) {
        console.error('Could not determine creator ID');
        return NextResponse.json({
          total_clicks: clickData?.total_clicks || 0,
          unique_clicks: clickData?.unique_clicks || 0,
          is_new_unique: clickData?.is_new_unique || false,
          earnings_added: false,
        });
      }

      // TIERED EARNINGS:
      // Monetized items (with affiliate links): 5-12 cents
      // Verified items (no affiliate link yet): 1-3 cents
      if (itemData.is_monetized) {
        // Higher earnings for monetized items with affiliate links
        earningsCents = Math.floor(Math.random() * 8) + 5; // 5-12 cents
      } else if (itemData.is_verified) {
        // Lower earnings for verified but not yet monetized items
        earningsCents = Math.floor(Math.random() * 3) + 1; // 1-3 cents
      }

      // Add earnings using the SQL function
      const { error: earningsError } = await supabase.rpc('add_creator_earnings', {
        p_user_id: creatorId,
        p_item_id: itemId,
        p_item_type: itemType,
        p_amount_cents: earningsCents,
        p_description: itemData.is_monetized
          ? `Affiliate click earning from ${itemType} item`
          : `Verified item click earning from ${itemType} item`,
      });

      if (!earningsError) {
        earningsAdded = true;
      } else {
        console.error('Earnings error:', earningsError);
      }
    }

    return NextResponse.json({
      total_clicks: clickData?.total_clicks || 0,
      unique_clicks: clickData?.unique_clicks || 0,
      is_new_unique: clickData?.is_new_unique || false,
      earnings_added: earningsAdded,
      earnings_cents: earningsAdded ? earningsCents : 0,
    });

  } catch (error) {
    console.error('Track click error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}