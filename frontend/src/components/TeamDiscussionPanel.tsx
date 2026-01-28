import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { teamApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Send, Edit2, Trash2, Reply, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { TeamMentionInput } from './TeamMentionInput';

// Updated: 2026-01-28 20:00 - Fixed Show/Hide Replies and input height

interface Message {
  id: string;
  team_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  message_text: string;
  parent_message_id?: string;
  mentions?: string[];
  attachments?: any[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  read_receipts?: Array<{
    user_id: string;
    user_name: string;
    read_at: string;
  }>;
  reply_count?: number;
}

interface TeamDiscussionPanelProps {
  teamId: string;
}

export function TeamDiscussionPanel({ teamId }: TeamDiscussionPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [sending, setSending] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [teamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await teamApi.getMessages(teamId, { limit: 100 });
      setMessages(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      setSending(true);
      await teamApi.postMessage(teamId, {
        message_text: messageText.trim(),
        parent_message_id: replyingTo?.id,
      });
      setMessageText('');
      setReplyingTo(null);
      await fetchMessages();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      alert('Failed to send message: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (message: Message) => {
    if (!editText.trim()) return;

    try {
      await teamApi.editMessage(teamId, message.id, { message_text: editText.trim() });
      setEditingMessage(null);
      setEditText('');
      await fetchMessages();
    } catch (error: any) {
      console.error('Failed to edit message:', error);
      alert('Failed to edit message: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await teamApi.deleteMessage(teamId, messageId);
      await fetchMessages();
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message: ' + (error.response?.data?.error || 'Unknown error'));
    }
  };

  const startEdit = (message: Message) => {
    setEditingMessage(message);
    setEditText(message.message_text);
    setOpenMenuId(null);
  };

  const startReply = (message: Message) => {
    setReplyingTo(message);
    setOpenMenuId(null);
  };

  const toggleReplies = (messageId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const renderMessage = (message: Message, isReply: boolean = false) => {
    const isOwnMessage = message.user_id === user?.id;
    const isEditing = editingMessage?.id === message.id;
    const actualReplyCount = messages.filter(m => m.parent_message_id === message.id).length;

    return (
      <div
        key={message.id}
        className={`flex gap-3 p-4 rounded-lg ${
          message.parent_message_id ? 'ml-8 bg-accent/30' : 'bg-accent/50'
        } ${isOwnMessage ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {message.user_name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-semibold text-sm">{message.user_name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </span>
              {message.is_edited && (
                <span className="text-xs text-muted-foreground ml-2">(edited)</span>
              )}
            </div>

            {/* Action Menu */}
            {isOwnMessage && (
              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === message.id ? null : message.id)}
                  className="p-1 hover:bg-accent rounded"
                >
                  <MoreVertical size={16} className="text-muted-foreground" />
                </button>

                {openMenuId === message.id && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => startEdit(message)}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-accent text-red-600 flex items-center gap-2"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message Text or Edit Form */}
          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-3 py-2 border rounded-md resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleEditMessage(message)}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingMessage(null);
                    setEditText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{message.message_text}</p>
          )}

          {/* Reply actions */}
          {!message.parent_message_id && !isEditing && (
            <div className="flex items-center gap-3 mt-2">
              {/* Toggle replies visibility */}
              {actualReplyCount > 0 && (
                <button
                  onClick={() => toggleReplies(message.id)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Reply size={12} />
                  {expandedReplies.has(message.id) ? 'Hide' : 'Show'} Replies ({actualReplyCount})
                </button>
              )}
              {/* Start writing a reply */}
              <button
                onClick={() => startReply(message)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Reply size={12} />
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-muted-foreground">Start the conversation by sending the first message!</p>
          </Card>
        ) : (
          <>
            {messages
              .filter((m) => !m.parent_message_id)
              .map((message) => (
                <div key={message.id}>
                  {renderMessage(message)}
                  {/* Render replies - only if expanded */}
                  {expandedReplies.has(message.id) && messages
                    .filter((m) => m.parent_message_id === message.id)
                    .map((reply) => renderMessage(reply))}
                </div>
              ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-accent/50 border-t flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Replying to </span>
            <span className="font-semibold">{replyingTo.user_name}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-sm text-primary hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <TeamMentionInput
            teamId={teamId}
            value={messageText}
            onChange={setMessageText}
            placeholder={replyingTo ? 'Write a reply... (use @ to mention team members)' : 'Type your message... (use @ to mention team members)'}
            className="flex-1 px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            rows={5}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
          />
          <Button type="submit" disabled={sending || !messageText.trim()}>
            <Send size={16} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line • Use @ to mention team members
        </p>
      </form>
    </div>
  );
}
