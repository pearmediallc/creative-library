import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
  resourceType: 'file' | 'folder';
}

export function RenameDialog({
  isOpen,
  onClose,
  onRename,
  currentName,
  resourceType
}: RenameDialogProps) {
  const [newName, setNewName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setError('');
      // Focus and select the name without extension
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (resourceType === 'file') {
            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex > 0) {
              inputRef.current.setSelectionRange(0, lastDotIndex);
            } else {
              inputRef.current.select();
            }
          } else {
            inputRef.current.select();
          }
        }
      }, 100);
    }
  }, [isOpen, currentName, resourceType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = newName.trim();

    if (!trimmedName) {
      setError('Name cannot be empty');
      return;
    }

    if (trimmedName === currentName) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onRename(trimmedName);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to rename ${resourceType}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <form onSubmit={handleSubmit} className="p-6 space-y-4" onKeyDown={handleKeyDown}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Rename {resourceType === 'file' ? 'File' : 'Folder'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {resourceType === 'file' ? 'File name' : 'Folder name'}
            </label>
            <Input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter new ${resourceType} name`}
              disabled={isSubmitting}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {resourceType === 'file'
                ? 'You can include or omit the file extension. The original extension will be preserved if omitted.'
                : 'Enter a unique name for this folder'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !newName.trim()}
              className="flex-1"
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
