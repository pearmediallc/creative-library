import React, { useState, useEffect } from 'react';
import { requestCommentsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import { MessageSquare, Send, Edit2, Trash2, X } from 'lucide-react';
import { Button } from './ui/Button';

interface Comment {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  username: string;
  email: string;
  user_role: string;
}

interface RequestCommentsSectionProps {
  requestId: string;
}

export function RequestCommentsSection({ requestId }: RequestCommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [requestId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await requestCommentsApi.getComments(requestId);
      setComments(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await requestCommentsApi.addComment(requestId, newComment.trim());
      setNewComment('');
      await fetchComments(); // Refresh comments
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      alert(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editText.trim()) return;

    try {
      setSubmitting(true);
      await requestCommentsApi.updateComment(commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      await fetchComments();
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      alert(error.response?.data?.error || 'Failed to update comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await requestCommentsApi.deleteComment(commentId);
      await fetchComments();
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      alert(error.response?.data?.error || 'Failed to delete comment');
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditText(comment.comment);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <MessageSquare className="w-5 h-5" />
        <h3 className="font-semibold">Comments ({comments.length})</h3>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{comment.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(comment.created_at)}
                    {comment.updated_at !== comment.created_at && ' (edited)'}
                  </div>
                </div>
                {user?.id === comment.user_id && editingId !== comment.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(comment)}
                      className="p-1 hover:bg-accent rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 hover:bg-accent rounded text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full min-h-[60px] p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Edit your comment..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEditComment(comment.id)}
                      disabled={submitting || !editText.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={submitting}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <div className="space-y-2 pt-2 border-t">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="w-full min-h-[80px] p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Write a comment..."
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleAddComment}
            disabled={submitting || !newComment.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Sending...' : 'Send Comment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
