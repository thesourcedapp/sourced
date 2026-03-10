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

    // Validate inputs
    if (!itemId || !itemType || !userId) {
      return NextResponse.json(
        { error: 'Missing fields', received: { itemId, itemType, userId } },
        { status: 400 }
      );
    }

    // Determine table name
    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    // Call the function to track click
    const { data, error } = await supabase.rpc('increment_click_count', {
      p_table_name: tableName,
      p_item_id: itemId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Supabase RPC Error:', error);
      return NextResponse.json(
        {
          error: 'Database error',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 }
      );
    }

    // Now check if item is verified/monetized and add earnings
    let earningsAdded = false;
    let earningsCents = 0;

    try {
      // Get item data to check verification status and owner
      const { data: itemData, error: itemError } = await supabase
        .from(tableName)
        .select(`
          id,
          is_verified,
          is_monetized,
          ${itemType === 'catalog' ? 'catalogs!inner(owner_id)' : 'feed_posts!inner(user_id)'}
        `)
        .eq('id', itemId)
        .single();

      if (!itemError && itemData && (itemData.is_verified || itemData.is_monetized)) {
        // Get creator ID
        const creatorId = itemType === 'catalog'
          ? (itemData as any).catalogs?.owner_id
          : (itemData as any).feed_posts?.user_id;

        if (creatorId) {
          // TIERED EARNINGS:
          // Monetized items (with affiliate links): 5-12 cents
          // Verified items (no affiliate link yet): 1-3 cents
          if (itemData.is_monetized) {
            earningsCents = Math.floor(Math.random() * 8) + 5; // 5-12 cents
          } else if (itemData.is_verified) {
            earningsCents = Math.floor(Math.random() * 3) + 1; // 1-3 cents
          }

          // Add earnings
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
          }
        }
      }
    } catch (earningsErr) {
      // Don't fail the whole request if earnings fails
      console.error('Earnings error:', earningsErr);
    }

    // Success
    return NextResponse.json({
      success: true,
      clicks: data && data.length > 0 ? data[0] : null,
      earnings_added: earningsAdded,
      earnings_cents: earningsAdded ? earningsCents : 0,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}