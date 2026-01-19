import React, { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface TeamMentionInputProps {
  teamId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const TeamMentionInput: React.FC<TeamMentionInputProps> = ({
  teamId,
  value,
  onChange,
  placeholder,
  className = '',
  rows = 3,
  disabled = false,
  onKeyDown
}) => {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/teams/${teamId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const members = response.data.data?.members || [];
        console.log('📋 Fetched team members for mentions:', members.length, 'members');
        setTeamMembers(members);
      } catch (error) {
        console.error('❌ Failed to fetch team members for mentions:', error);
      }
    };
    fetchTeamMembers();
  }, [teamId]);

  // Detect @ mention and filter users
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
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
        // Filter users by name or email
        const filtered = teamMembers.filter(member =>
          member.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          member.email.toLowerCase().includes(textAfterAt.toLowerCase())
        );

        console.log(`🔍 Team mention query: "@${textAfterAt}" -> Found ${filtered.length} team members out of ${teamMembers.length} total`);
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

    // Replace @query with @Name
    const beforeAt = value.substring(0, lastAtIndex);
    const mention = `@${user.name}`;
    const newValue = beforeAt + mention + ' ' + textAfterCursor;

    onChange(newValue);
    setShowDropdown(false);

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
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
          return;
        case 'Enter':
          if (filteredUsers.length > 0) {
            e.preventDefault();
            insertMention(filteredUsers[selectedIndex]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          return;
      }
    }

    // Pass through to parent onKeyDown
    if (onKeyDown) {
      onKeyDown(e);
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
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
      />

      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              data-index={index}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => insertMention(user)}
            >
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamMentionInput;
