import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  multiline = false,
  rows = 3
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('📋 Fetched users for mentions:', response.data.data?.length || 0, 'users');
        setUsers(response.data.data || []);
      } catch (error) {
        console.error('❌ Failed to fetch users for mentions:', error);
      }
    };
    fetchUsers();
  }, []);

  // Detect @ mention and filter users
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(cursor);

    // Find @ symbol before cursor
    const textBeforeCursor = newValue.substring(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Check if there's no space after @ (still typing mention)
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);

        // Filter users by name or email
        const filtered = users.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.email.toLowerCase().includes(textAfterAt.toLowerCase())
        );

        console.log(`🔍 Mention query: "@${textAfterAt}" -> Found ${filtered.length} users out of ${users.length} total`);
        setFilteredUsers(filtered);
        setShowDropdown(filtered.length > 0);
        setSelectedIndex(0);
        return;
      }
    }

    setShowDropdown(false);
  };

  // Insert mention at cursor position
  const insertMention = (user: User) => {
    if (!inputRef.current) return;

    const cursor = cursorPosition;
    const textBeforeCursor = value.substring(0, cursor);
    const textAfterCursor = value.substring(cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    // Replace @query with just @Name (clean display, ID stored in data attribute)
    const beforeAt = value.substring(0, lastAtIndex);
    const mention = `@${user.name}`;
    const newValue = beforeAt + mention + ' ' + textAfterCursor;

    onChange(newValue);
    setShowDropdown(false);
    setMentionQuery('');

    // Set cursor after mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursor = beforeAt.length + mention.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        break;
      case 'Enter':
        if (filteredUsers.length > 0) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={className}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
        />
      )}

      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              data-index={index}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => insertMention(user)}
            >
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
