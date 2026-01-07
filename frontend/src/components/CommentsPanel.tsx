import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  MessageSquare,
  Send,
  MoreVertical,
  Reply,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  Smile
} from 'lucide-react';
import { Button } from './ui/Button';
import { commentApi, adminApi } from '../lib/api';

interface Reaction {
  type: string;
  user_id: string;
  user_name: string;
}

interface Comment {
  id: string;
  file_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  content: string;
  mentions: string[];
  parent_comment_id: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  reactions: Reaction[] | null;
  replies?: Comment[];
  reply_count?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  fileName: string;
}

export function CommentsPanel({ isOpen, onClose, fileId, fileName }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const reactionEmojis = ['👍', '❤️', '😂', '😮', '👏'];

  const fetchComments = useCallback(async () => {
    if (!fileId) return;

    try {
      setLoading(true);
      setError('');
      const response = await commentApi.getComments(fileId, showResolved);
      setComments(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch comments:', err);
      setError(err.response?.data?.error || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [fileId, showResolved]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await adminApi.getUsers();
      setAllUsers(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen && fileId) {
      fetchComments();
      fetchUsers();

      // Poll for new comments every 30 seconds
      const interval = setInterval(fetchComments, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fileId, fetchComments, fetchUsers]);

  // Handle @mention detection
  useEffect(() => {
    const lastWord = newComment.split(/\s/).pop() || '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const search = lastWord.substring(1);
      setMentionSearch(search);
      const filtered = allUsers.filter(
        u => u.name.toLowerCase().includes(search.toLowerCase()) ||
             u.email.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 5);
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  }, [newComment, allUsers]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = editingId ? editContent : newComment;
    if (!content.trim()) return;

    try {
      setError('');

      if (editingId) {
        await commentApi.updateComment(editingId, content);
        setEditingId(null);
        setEditContent('');
      } else {
        await commentApi.createComment({
          file_id: fileId,
          content,
          parent_comment_id: replyTo || undefined
        });
        setNewComment('');
        setReplyTo(null);
      }

      await fetchComments();
    } catch (err: any) {
      console.error('Failed to submit comment:', err);
      setError(err.response?.data?.error || 'Failed to submit comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await commentApi.deleteComment(commentId);
      await fetchComments();
    } catch (err: any) {
      console.error('Failed to delete comment:', err);
      setError(err.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleToggleResolve = async (commentId: string) => {
    try {
      await commentApi.toggleResolve(commentId);
      await fetchComments();
    } catch (err: any) {
      console.error('Failed to toggle resolve:', err);
      setError(err.response?.data?.error || 'Failed to update comment');
    }
  };

  const handleReaction = async (commentId: string, reactionType: string) => {
    try {
      const comment = findCommentById(commentId);
      const hasReacted = comment?.reactions?.some(
        r => r.type === reactionType && r.user_id === currentUser.id
      );

      if (hasReacted) {
        await commentApi.removeReaction(commentId, reactionType);
      } else {
        await commentApi.addReaction(commentId, reactionType);
      }

      await fetchComments();
      setReactionMenuId(null);
    } catch (err: any) {
      console.error('Failed to handle reaction:', err);
      setError(err.response?.data?.error || 'Failed to update reaction');
    }
  };

  const findCommentById = (id: string): Comment | undefined => {
    for (const comment of comments) {
      if (comment.id === id) return comment;
      if (comment.replies) {
        const reply = comment.replies.find(r => r.id === id);
        if (reply) return reply;
      }
    }
    return undefined;
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setMenuOpenId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const startReply = (commentId: string) => {
    setReplyTo(commentId);
    textareaRef.current?.focus();
  };

  const insertMention = (user: User) => {
    const words = newComment.split(/\s/);
    words[words.length - 1] = `@${user.name}`;
    setNewComment(words.join(' ') + ' ');
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-orange-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const groupReactions = (reactions: Reaction[] | null) => {
    if (!reactions) return [];

    const grouped: { [key: string]: { count: number; users: string[]; hasCurrentUser: boolean } } = {};

    reactions.forEach(r => {
      if (!grouped[r.type]) {
        grouped[r.type] = { count: 0, users: [], hasCurrentUser: false };
      }
      grouped[r.type].count++;
      grouped[r.type].users.push(r.user_name);
      if (r.user_id === currentUser.id) {
        grouped[r.type].hasCurrentUser = true;
      }
    });

    return Object.entries(grouped).map(([type, data]) => ({
      type,
      ...data
    }));
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isAuthor = comment.user_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    const canEdit = isAuthor || isAdmin;
    const isEditing = editingId === comment.id;
    const groupedReactions = groupReactions(comment.reactions);

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-12 mt-3' : 'mt-4'} ${
          comment.is_resolved ? 'opacity-60' : ''
        }`}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full ${getAvatarColor(
              comment.user_name
            )} flex items-center justify-center text-white text-xs font-semibold`}
          >
            {getUserInitials(comment.user_name)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {comment.user_name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(comment.created_at)}
                </span>
                {comment.is_resolved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Resolved
                  </span>
                )}
              </div>

              {/* Actions Menu */}
              {canEdit && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === comment.id ? null : comment.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>

                  {menuOpenId === comment.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
                      {!comment.parent_comment_id && (
                        <button
                          onClick={() => {
                            handleToggleResolve(comment.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          {comment.is_resolved ? (
                            <Circle className="w-4 h-4" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          {comment.is_resolved ? 'Unresolve' : 'Resolve'}
                        </button>
                      )}
                      {isAuthor && (
                        <button
                          onClick={() => startEdit(comment)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleDeleteComment(comment.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment Body */}
            {isEditing ? (
              <form onSubmit={handleSubmitComment} className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!editContent.trim()}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>

                {/* Reactions & Reply */}
                <div className="flex items-center gap-3 mt-2">
                  {/* Reactions Display */}
                  {groupedReactions.length > 0 && (
                    <div className="flex items-center gap-1">
                      {groupedReactions.map(reaction => (
                        <button
                          key={reaction.type}
                          onClick={() => handleReaction(comment.id, reaction.type)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${
                            reaction.hasCurrentUser
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          } hover:bg-gray-100 dark:hover:bg-gray-700`}
                          title={reaction.users.join(', ')}
                        >
                          <span>{reaction.type}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {reaction.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Add Reaction */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setReactionMenuId(reactionMenuId === comment.id ? null : comment.id)
                      }
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      <Smile className="w-3 h-3" />
                    </button>

                    {reactionMenuId === comment.id && (
                      <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-2 flex gap-1">
                        {reactionEmojis.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(comment.id, emoji)}
                            className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reply Button */}
                  {!comment.parent_comment_id && (
                    <button
                      onClick={() => startReply(comment.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Comments</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[250px]">
              {fileName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Show Resolved Toggle */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-700 dark:text-gray-300">Show resolved</span>
        </label>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No comments yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Be the first to comment
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-gray-600 dark:text-gray-400">
            <span>Replying to thread...</span>
            <button onClick={() => setReplyTo(null)} className="text-blue-500 hover:underline">
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={handleSubmitComment} className="relative">
          {/* Mention Suggestions */}
          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {mentionSuggestions.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => insertMention(user)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <div
                    className={`w-6 h-6 rounded-full ${getAvatarColor(
                      user.name
                    )} flex items-center justify-center text-white text-xs`}
                  >
                    {getUserInitials(user.name)}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment... (use @ to mention)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim()}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
