import React from 'react';
import { Image as ImageIcon, Video, FileText } from 'lucide-react';

/**
 * Get the appropriate icon component for a file based on its type
 */
export function getFileIcon(fileType: string, fileName: string, size: number = 16, className?: string) {
  const isPDF = fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf');

  if (fileType === 'image') {
    return <ImageIcon size={size} className={className} />;
  } else if (fileType === 'video') {
    return <Video size={size} className={className} />;
  } else if (isPDF) {
    return <FileText size={size} className={className} />;
  } else {
    // Default to image icon for unknown types
    return <ImageIcon size={size} className={className} />;
  }
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(fileType: string, fileName: string): boolean {
  return fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf');
}
