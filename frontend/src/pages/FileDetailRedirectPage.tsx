import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Redirect page for Slack deep links
 * Handles /media/:fileId routes and redirects to media library with file selected
 */
export function FileDetailRedirectPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (fileId) {
      // Redirect to media library with fileId as query param
      // The MediaLibraryPage can then open the file details modal
      navigate(`/media?fileId=${fileId}`, { replace: true });
    } else {
      // If no fileId, just go to media library
      navigate('/media', { replace: true });
    }
  }, [fileId, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading file...</p>
      </div>
    </div>
  );
}
