from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
import random
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Go up TWO levels to reach Sourced folder
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.config import NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

router = APIRouter()


# Test endpoint to verify router is working
@router.get("/feed/test")
async def test_feed():
    """Simple test endpoint to verify feed router is connected"""
    return {"status": "Feed router is working!", "timestamp": datetime.utcnow().isoformat()}


# Initialize Supabase client
SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("⚠️  WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Feed endpoints will not work.")


def get_supabase() -> Client:
    """Get Supabase client or raise error if not configured"""
    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail="Supabase not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
        )
    return supabase


class FeedRequest(BaseModel):
    exclude_ids: List[str] = []
    is_initial: bool = False
    user_id: Optional[str] = None


class LogViewRequest(BaseModel):
    post_id: str
    time_spent: int
    interacted: bool
    user_id: str


class FeedItem(BaseModel):
    id: str
    title: str
    image_url: str
    product_url: Optional[str]
    price: Optional[str]
    seller: Optional[str]
    like_count: int
    is_liked: bool


class FeedOwner(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str]
    is_verified: bool


class FeedPost(BaseModel):
    id: str
    image_url: str
    caption: Optional[str]
    music_preview_url: Optional[str]
    like_count: int
    is_liked: bool
    is_saved: bool
    comment_count: int
    owner: FeedOwner
    items: List[FeedItem]


def calculate_engagement_score(post_data: Dict) -> float:
    """Calculate engagement score for ranking posts"""
    like_count = post_data.get('like_count', 0)
    comment_count = post_data.get('comment_count', 0)

    # Recency boost - newer posts get higher scores
    created_at = datetime.fromisoformat(post_data['created_at'].replace('Z', '+00:00'))
    hours_old = (datetime.now(created_at.tzinfo) - created_at).total_seconds() / 3600
    recency_multiplier = 1.0 / (1.0 + hours_old / 24)  # Decay over days

    # Engagement score: likes (1 point) + comments (3 points) * recency
    score = (like_count + (comment_count * 3)) * recency_multiplier

    return score


def get_user_preference_signals(sb: Client, user_id: str) -> Dict:
    """Analyze user behavior to understand preferences"""
    signals = {
        'followed_users': [],
        'engaged_creators': [],
        'recent_interactions': [],
        'avg_view_time': 0
    }

    try:
        # Get followed users
        following_response = sb.table('followers').select('following_id').eq('follower_id', user_id).limit(
            200).execute()
        signals['followed_users'] = [f['following_id'] for f in
                                     following_response.data] if following_response.data else []

        # Get recent post views (last 100)
        views_response = sb.table('post_views').select('post_id, time_spent_ms, interacted, viewed_at').eq('user_id',
                                                                                                           user_id).order(
            'viewed_at', desc=True).limit(100).execute()

        if views_response.data:
            # Calculate average view time
            total_time = sum(v.get('time_spent_ms', 0) for v in views_response.data)
            signals['avg_view_time'] = total_time / len(views_response.data) if views_response.data else 0

            # Get posts where user spent >3 seconds or interacted
            engaged_posts = [
                v['post_id'] for v in views_response.data
                if v.get('interacted') or v.get('time_spent_ms', 0) > 3000
            ]

            # Get creators of engaged posts
            if engaged_posts:
                engaged_posts_response = sb.table('feed_posts').select('owner_id').in_('id',
                                                                                       engaged_posts[:50]).execute()
                if engaged_posts_response.data:
                    # Count frequency of each creator
                    creator_counts = {}
                    for post in engaged_posts_response.data:
                        creator_id = post['owner_id']
                        creator_counts[creator_id] = creator_counts.get(creator_id, 0) + 1

                    # Sort by frequency
                    signals['engaged_creators'] = sorted(creator_counts.keys(), key=lambda x: creator_counts[x],
                                                         reverse=True)

            signals['recent_interactions'] = engaged_posts[:20]

    except Exception as e:
        print(f"Error getting preference signals: {e}")

    return signals


@router.post("/feed/next")
async def get_next_feed_post(request: FeedRequest):
    """
    Enhanced TikTok-style feed algorithm with:
    - Personalized content based on engagement patterns
    - Recency bias (newer content prioritized)
    - Diversity injection (prevent echo chamber)
    - Engagement score ranking
    """
    try:
        sb = get_supabase()
        user_id = request.user_id
        exclude_ids = request.exclude_ids
        is_initial = request.is_initial

        # Get user preference signals
        signals = {'followed_users': [], 'engaged_creators': [], 'avg_view_time': 0}
        if user_id:
            signals = get_user_preference_signals(sb, user_id)

        # Determine content strategy with more variety
        strategies = []

        if signals['followed_users']:
            strategies.append(('followed', 40))  # 40% from followed users

        if signals['engaged_creators']:
            strategies.append(('engaged_creators', 30))  # 30% from creators you engage with

        strategies.append(('popular', 20))  # 20% popular/trending content
        strategies.append(('discovery', 10))  # 10% pure discovery (random new creators)

        # Weighted random selection
        rand = random.random() * 100
        cumulative = 0
        selected_strategy = 'discovery'

        for strategy, weight in strategies:
            cumulative += weight
            if rand <= cumulative:
                selected_strategy = strategy
                break

        # Build query based on strategy
        query = sb.table('feed_posts').select(
            'id, image_url, caption, like_count, comment_count, music_preview_url, owner_id, created_at, '
            'profiles!feed_posts_owner_id_fkey(id, username, avatar_url, is_verified)'
        )

        # Apply strategy filters
        if selected_strategy == 'followed' and signals['followed_users']:
            query = query.in_('owner_id', signals['followed_users'][:50])
        elif selected_strategy == 'engaged_creators' and signals['engaged_creators']:
            query = query.in_('owner_id', signals['engaged_creators'][:30])
        elif selected_strategy == 'popular':
            # Get posts with high engagement
            query = query.gte('like_count', 1)  # At least 1 like
        # 'discovery' has no filter - completely random

        # Exclude recently seen posts (if list is manageable)
        # Only exclude if we haven't seen too many (to allow recirculation)
        if len(exclude_ids) > 0 and len(exclude_ids) <= 20:
            # For small exclude lists, filter them out
            for post_id in exclude_ids:
                query = query.neq('id', post_id)

        # Fetch candidates (get more for better selection)
        fetch_limit = 20 if selected_strategy != 'discovery' else 50
        query = query.order('created_at', desc=True).limit(fetch_limit)

        posts_response = query.execute()

        # If no posts found with filters, try without filters (fallback to all posts)
        if not posts_response.data and selected_strategy != 'discovery':
            print(f"⚠️ No posts found with strategy '{selected_strategy}'. Falling back to all posts...")

            # Build fresh query without strategy filters
            query = sb.table('feed_posts').select(
                'id, image_url, caption, like_count, comment_count, music_preview_url, owner_id, created_at, '
                'profiles!feed_posts_owner_id_fkey(id, username, avatar_url, is_verified)'
            )

            # Still respect exclude_ids if reasonable
            if len(exclude_ids) > 0 and len(exclude_ids) <= 20:
                for post_id in exclude_ids:
                    query = query.neq('id', post_id)

            query = query.order('created_at', desc=True).limit(50)
            posts_response = query.execute()

        # If STILL no posts found AND we're excluding posts, reset and recirculate
        if not posts_response.data:
            if len(exclude_ids) > 0:
                # All posts seen! Reset exclude list and recirculate
                print(f"🔄 All content seen ({len(exclude_ids)} posts). Recirculating...")
                return await get_next_feed_post(FeedRequest(exclude_ids=[], is_initial=False, user_id=user_id))
            # Truly no posts available
            return {"post": None, "message": "No posts available"}

        # Score and rank posts
        scored_posts = []
        for post in posts_response.data:
            score = calculate_engagement_score(post)
            scored_posts.append((post, score))

        # Sort by score (highest first)
        scored_posts.sort(key=lambda x: x[1], reverse=True)

        # Select from top candidates with some randomness
        # Pick from top 5 to avoid always showing the exact same order
        top_candidates = scored_posts[:min(5, len(scored_posts))]
        selected_post = random.choice(top_candidates)[0] if top_candidates else scored_posts[0][0]

        # Get fresh like/save status for current user
        is_liked = False
        is_saved = False

        if user_id:
            liked_response = sb.table('liked_feed_posts').select('feed_post_id').eq('user_id', user_id).eq(
                'feed_post_id', selected_post['id']).maybe_single().execute()
            saved_response = sb.table('saved_feed_posts').select('feed_post_id').eq('user_id', user_id).eq(
                'feed_post_id', selected_post['id']).maybe_single().execute()

            is_liked = bool(liked_response.data)
            is_saved = bool(saved_response.data)

        # Get items for this post
        items_response = sb.table('feed_post_items').select(
            'id, title, image_url, product_url, price, seller, like_count').eq('feed_post_id',
                                                                               selected_post['id']).execute()

        # Get liked items for current user
        liked_item_ids = set()
        if user_id and items_response.data:
            item_ids = [item['id'] for item in items_response.data]
            liked_items_response = sb.table('liked_feed_post_items').select('item_id').eq('user_id', user_id).in_(
                'item_id', item_ids).execute()
            liked_item_ids = {like['item_id'] for like in
                              liked_items_response.data} if liked_items_response.data else set()

        items = [
            FeedItem(
                id=item['id'],
                title=item['title'],
                image_url=item['image_url'],
                product_url=item.get('product_url'),
                price=item.get('price'),
                seller=item.get('seller'),
                like_count=item.get('like_count', 0),
                is_liked=item['id'] in liked_item_ids
            )
            for item in (items_response.data or [])
        ]

        # Format owner data
        owner_data = selected_post['profiles']
        if isinstance(owner_data, list):
            owner_data = owner_data[0] if owner_data else {}

        owner = FeedOwner(
            id=owner_data.get('id', ''),
            username=owner_data.get('username', ''),
            avatar_url=owner_data.get('avatar_url'),
            is_verified=owner_data.get('is_verified', False)
        )

        # Build feed post response
        feed_post = FeedPost(
            id=selected_post['id'],
            image_url=selected_post['image_url'],
            caption=selected_post.get('caption'),
            music_preview_url=selected_post.get('music_preview_url'),
            like_count=selected_post.get('like_count', 0),
            is_liked=is_liked,
            is_saved=is_saved,
            comment_count=selected_post.get('comment_count', 0),
            owner=owner,
            items=items
        )

        return {
            "post": feed_post.dict(),
            "algorithm_info": {
                "strategy": selected_strategy,
                "candidates_evaluated": len(scored_posts),
                "total_fetched": len(posts_response.data)
            }
        }

    except Exception as e:
        print(f"Feed algorithm error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch feed post: {str(e)}")


@router.post("/feed/log-view")
async def log_post_view(request: LogViewRequest):
    """
    Log post view for algorithm improvement
    Tracks time spent and interaction status
    """
    try:
        sb = get_supabase()

        # Upsert post view
        data = {
            "user_id": request.user_id,
            "post_id": request.post_id,
            "viewed_at": datetime.utcnow().isoformat(),
            "time_spent_ms": request.time_spent,
            "interacted": request.interacted
        }

        response = sb.table('post_views').upsert(
            data,
            on_conflict='user_id,post_id'
        ).execute()

        return {"success": True, "data": response.data}

    except Exception as e:
        print(f"Log view error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to log post view: {str(e)}")


@router.get("/feed/preferences/{user_id}")
async def get_user_preferences(user_id: str):
    """
    Get user's feed preferences for debugging/analytics
    """
    try:
        sb = get_supabase()

        signals = get_user_preference_signals(sb, user_id)

        return {
            "user_id": user_id,
            "following_count": len(signals['followed_users']),
            "engaged_creators_count": len(signals['engaged_creators']),
            "avg_view_time_ms": signals['avg_view_time'],
            "recent_interactions_count": len(signals['recent_interactions'])
        }

    except Exception as e:
        print(f"Get preferences error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")