"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type Comment = {
  id: string;
  comment_text: string;
  created_at: string;
  like_count: number;
  is_liked: boolean;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

type CommentsModalProps = {
  postId: string;
  postOwnerId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
};

export default function CommentsModal({ postId, postOwnerId, isOpen, onClose, currentUserId }: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadComments();
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, postId]);

  async function loadComments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feed_post_comments')
        .select(`
          id,
          comment_text,
          created_at,
          like_count,
          user_id,
          profiles!feed_post_comments_user_id_fkey(id, username, avatar_url, is_verified)
        `)
        .eq('feed_post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading comments:', error);
        throw error;
      }

      // Get liked comments for current user
      let likedCommentIds: Set<string> = new Set();
      if (data && data.length > 0) {
        const commentIds = data.map(c => c.id);
        const { data: likedData } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .in('comment_id', commentIds);

        if (likedData) {
          likedCommentIds = new Set(likedData.map(like => like.comment_id));
        }
      }

      const formattedComments: Comment[] = (data || []).map((comment: any) => {
        const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
        return {
          id: comment.id,
          comment_text: comment.comment_text,
          created_at: comment.created_at,
          like_count: comment.like_count || 0,
          is_liked: likedCommentIds.has(comment.id),
          user: {
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            is_verified: profile.is_verified || false
          }
        };
      });

      setComments(formattedComments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function postComment() {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('feed_post_comments')
        .insert({
          feed_post_id: postId,
          user_id: currentUserId,
          comment_text: newComment.trim()
        })
        .select();

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      console.log('Comment posted successfully:', data);
      setNewComment('');
      await loadComments(); // Reload comments
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleCommentLike(commentId: string, currentlyLiked: boolean) {
    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('comment_id', commentId);

        if (error) {
          console.error('Unlike comment error:', error);
          return;
        }

        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, is_liked: false, like_count: Math.max(0, comment.like_count - 1) }
            : comment
        ));
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            user_id: currentUserId,
            comment_id: commentId
          });

        if (error && !error.message.includes('duplicate')) {
          console.error('Like comment error:', error);
          return;
        }

        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, is_liked: true, like_count: comment.like_count + 1 }
            : comment
        ));
      }
    } catch (error) {
      console.error('Toggle comment like failed:', error);
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    const months = Math.floor(days / 30);
    return `${months}mo`;
  }

  async function deleteComment(commentId: string) {
    try {
      const { error } = await supabase
        .from('feed_post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-[70] bg-neutral-900 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-black text-lg tracking-wider" style={{ fontFamily: 'Bebas Neue' }}>
            COMMENTS
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/40 text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                  {comment.user.avatar_url ? (
                    <img src={comment.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/60 text-xs">👤</div>
                  )}
                </div>

                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-black text-sm" style={{ fontFamily: 'Bebas Neue' }}>
                      {comment.user.username}
                    </span>
                    {comment.user.is_verified && (
                      <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className="text-white/40 text-xs">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                    {/* Delete button - show for comment owner OR post owner */}
                    {(comment.user.id === currentUserId || postOwnerId === currentUserId) && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="ml-auto text-red-400 hover:text-red-300 text-xs font-bold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed break-words mb-2">
                    {comment.comment_text}
                  </p>

                  {/* Like Button */}
                  <button
                    onClick={() => toggleCommentLike(comment.id, comment.is_liked)}
                    className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill={comment.is_liked ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {comment.like_count > 0 && (
                      <span className="text-xs font-black" style={{ fontFamily: 'Bebas Neue' }}>
                        {comment.like_count}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 p-4 bg-neutral-900">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  postComment();
                }
              }}
              placeholder="Add a comment..."
              className="flex-1 bg-neutral-800 text-white px-4 py-3 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/40 text-sm"
              rows={1}
              style={{ maxHeight: '100px' }}
            />
            <button
              onClick={postComment}
              disabled={!newComment.trim() || submitting}
              className="px-6 py-3 bg-white text-black font-black text-sm tracking-wider rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
              style={{ fontFamily: 'Bebas Neue' }}
            >
              {submitting ? '...' : 'POST'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
}