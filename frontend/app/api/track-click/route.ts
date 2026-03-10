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

    if (!itemId || !itemType || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call the increment_click_count function (existing functionality)
    const { data: clickData, error: clickError } = await supabase.rpc(
      'increment_click_count',
      {
        table_name: itemType === 'catalog' ? 'catalog_items' : 'feed_post_items',
        item_id: itemId,
        user_id_param: userId,
      }
    );

    if (clickError) {
      console.error('Click tracking error:', clickError);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }

    // Check if item is monetized and get owner
    const table = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';
    const { data: itemData, error: itemError } = await supabase
      .from(table)
      .select(`
        id,
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

    // If item is monetized, add earnings
    let earningsAdded = false;
    let earningsCents = 0;

    if (itemData.is_monetized) {
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

      // Random amount between 3 cents and 10 cents
      earningsCents = Math.floor(Math.random() * 8) + 3; // 3-10 cents

      // Add earnings using the SQL function
      const { error: earningsError } = await supabase.rpc('add_creator_earnings', {
        p_user_id: creatorId,
        p_item_id: itemId,
        p_item_type: itemType,
        p_amount_cents: earningsCents,
        p_description: `Click earning from ${itemType} item`,
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