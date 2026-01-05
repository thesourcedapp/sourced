"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type Comment = {
  id: string;
  content: string;
  created_at: string;
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
          content,
          created_at,
          user_id,
          profiles!feed_post_comments_user_id_fkey(id, username, avatar_url, is_verified)
        `)
        .eq('feed_post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedComments: Comment[] = (data || []).map((comment: any) => {
        const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
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
      const { error } = await supabase
        .from('feed_post_comments')
        .insert({
          feed_post_id: postId,
          user_id: currentUserId,
          post_owner_id: postOwnerId,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      loadComments(); // Reload comments
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-neutral-900 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
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
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed break-words">
                    {comment.content}
                  </p>
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