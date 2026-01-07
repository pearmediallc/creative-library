import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { mediaApi, editorApi, folderApi, adminApi } from '../lib/api';
import { MediaFile, Editor } from '../types';
import { formatBytes, formatDate } from '../lib/utils';
import { Image as ImageIcon, Video, X, Download, Trash2, Info, PackageOpen, Calendar, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BulkMetadataEditor } from '../components/BulkMetadataEditor';
import { MetadataViewer } from '../components/MetadataViewer';
import { FolderTree } from '../components/FolderTree';
import { Breadcrumb } from '../components/Breadcrumb';
import { FolderCard } from '../components/FolderCard';
import { CreateFolderModal } from '../components/CreateFolderModal';
import { FolderContextMenu } from '../components/FolderContextMenu';
import { AdvancedFilterPanel } from '../components/AdvancedFilterPanel';
import { useMediaFilters } from '../hooks/useMediaFilters';

interface FolderNode {
  id: string;
  name: string;
  created_at: string;
  color?: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
  level: number;
}

export function MediaLibraryPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [buyers, setBuyers] = useState<Array<{ id: string; name: string }>>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const filesPerPage = 12;

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);

  // Folder context menu state
  const [contextMenuFolder, setContextMenuFolder] = useState<FolderNode | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Bulk editor state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  // Metadata viewer state
  const [metadataViewerFile, setMetadataViewerFile] = useState<{
    id: string;
    filename: string;
    metadata: Record<string, any>;
  } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Drag and drop state
  const [draggedFileIds, setDraggedFileIds] = useState<string[]>([]);

  // Advanced filters
  const filters = useMediaFilters();
  const [showFilters, setShowFilters] = useState(false);

  // Role-based permissions
  const isAdmin = user?.role === 'admin';
  const canUpload = user?.role === 'admin' || user?.role === 'creative';
  const canDelete = user?.role === 'admin';

  // Initial load: fetch buyers and tags
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (isAdmin) {
          const usersRes = await adminApi.getUsers();
          const allUsers = usersRes.data.data || [];
          const buyerUsers = allUsers.filter((u: any) => u.role === 'buyer');
          setBuyers(buyerUsers.map((u: any) => ({ id: u.id, name: u.name })));
        }

        // Extract unique tags from existing files (simplified approach)
        // In a production app, you might have a dedicated tags endpoint
        const filesRes = await mediaApi.getAll({});
        const allFiles = filesRes.data.data.files || [];
        const tags = new Set<string>();
        allFiles.forEach((file: any) => {
          if (file.tags && Array.isArray(file.tags)) {
            file.tags.forEach((tag: string) => tags.add(tag));
          }
        });
        setAvailableTags(Array.from(tags).sort());
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [filters.filters, currentFolderId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (currentFolderId) {
        // Fetch folder contents
        const [contentsRes, breadcrumbRes, editorsRes] = await Promise.all([
          folderApi.getContents(currentFolderId),
          folderApi.getBreadcrumb(currentFolderId),
          editorApi.getAll(),
        ]);

        const contents = contentsRes.data.data;
        setFolders(contents.folders || []);
        setFiles(contents.files || []);
        setBreadcrumb(breadcrumbRes.data.data || []);
        setEditors(editorsRes.data.data || []);
      } else {
        // Fetch root level with advanced filters
        const queryParams = filters.toQueryParams();

        const [filesRes, editorsRes] = await Promise.all([
          mediaApi.getAll(queryParams),
          editorApi.getAll(),
        ]);

        setFiles(filesRes.data.data.files || []);
        setEditors(editorsRes.data.data || []);
        setFolders([]);
        setBreadcrumb([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = () => {
    setCreateFolderParentId(currentFolderId);
    setShowCreateFolderModal(true);
  };

  const handleFolderContextMenu = (folder: FolderNode, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuFolder(folder);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const handleRenameFolder = () => {
    if (!contextMenuFolder) return;
    const newName = prompt('Enter new folder name:', contextMenuFolder.name);
    if (newName && newName.trim()) {
      folderApi.update(contextMenuFolder.id, { name: newName.trim() })
        .then(() => fetchData())
        .catch((error) => alert('Failed to rename folder: ' + error.message));
    }
  };

  const handleDeleteFolder = () => {
    if (!contextMenuFolder) return;
    // eslint-disable-next-line no-restricted-globals
    const confirmed = confirm(`Delete folder "${contextMenuFolder.name}"? This will also delete all files inside.`);
    if (confirmed) {
      folderApi.delete(contextMenuFolder.id, true)
        .then(() => fetchData())
        .catch((error) => alert('Failed to delete folder: ' + error.message));
    }
  };

  const handleCreateSubfolder = () => {
    if (!contextMenuFolder) return;
    setCreateFolderParentId(contextMenuFolder.id);
    setShowCreateFolderModal(true);
  };

  const handleFolderProperties = () => {
    if (!contextMenuFolder) return;
    alert(`Folder: ${contextMenuFolder.name}\nCreated: ${formatDate(contextMenuFolder.created_at)}`);
  };

  const handleDownload = async (file: MediaFile) => {
    try {
      const url = file.s3_url || file.download_url;
      if (!url) return;

      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await mediaApi.delete(fileId);
      setDeleteConfirmId(null);
      fetchData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.error || 'Failed to delete file');
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  const handleViewMetadata = async (file: MediaFile) => {
    try {
      const response = await mediaApi.extractMetadata(file.id);
      setMetadataViewerFile({
        id: file.id,
        filename: file.original_filename,
        metadata: response.data.data.metadata || {},
      });
    } catch (error: any) {
      console.error('Failed to extract metadata:', error);
      alert(error.response?.data?.error || 'Failed to extract metadata');
    }
  };

  const handleBulkDownloadZip = async () => {
    if (selectedFiles.length === 0) return;

    setDownloadingZip(true);
    try {
      const response = await mediaApi.bulkDownloadZip(selectedFiles);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `creative-library-files-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to download ZIP:', error);
      alert(error.response?.data?.error || 'Failed to download files');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Drag and drop handlers
  const handleFileDragStart = (e: React.DragEvent, fileId: string) => {
    if (selectedFiles.includes(fileId)) {
      setDraggedFileIds(selectedFiles);
    } else {
      setDraggedFileIds([fileId]);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (draggedFileIds.length === 0) return;

    try {
      await folderApi.moveFiles({
        file_ids: draggedFileIds,
        target_folder_id: targetFolderId,
      });
      setDraggedFileIds([]);
      setSelectedFiles([]);
      fetchData();
    } catch (error: any) {
      alert('Failed to move files: ' + error.message);
    }
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const selectedFileObjects = files.filter(f => selectedFiles.includes(f.id));

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Folder Tree Sidebar */}
        <div className="w-64 flex-shrink-0">
          <FolderTree
            currentFolderId={currentFolderId}
            onFolderSelect={handleFolderSelect}
            onCreateFolder={handleCreateFolder}
            onFolderContextMenu={handleFolderContextMenu}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Media Library</h1>
                <p className="text-muted-foreground">Manage your creative assets</p>
              </div>
              {canUpload && (
                <div className="flex gap-2">
                  <Button onClick={() => setShowUploadModal(true)}>
                    Upload File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedFiles([]);
                    }}
                  >
                    {selectionMode ? 'Cancel Selection' : 'Bulk Edit'}
                  </Button>
                  {selectionMode && selectedFiles.length > 0 && (
                    <>
                      <Button onClick={() => setShowBulkEditor(true)}>
                        Edit {selectedFiles.length} Selected
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleBulkDownloadZip}
                        disabled={downloadingZip}
                      >
                        <PackageOpen className="w-4 h-4 mr-2" />
                        {downloadingZip ? 'Creating ZIP...' : `Download ${selectedFiles.length} as ZIP`}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
              <Breadcrumb items={breadcrumb} onNavigate={handleFolderSelect} />
            )}

            {/* Selection Mode */}
            {selectionMode && (
              <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFiles.length === files.length && files.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">
                    Select All ({selectedFiles.length} / {files.length})
                  </span>
                </label>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 items-center">
              <Button
                variant={filters.hasActiveFilters() ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter size={16} />
                Filters
                {filters.hasActiveFilters() && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full">
                    {filters.getActiveFilterCount()}
                  </span>
                )}
              </Button>
              {filters.hasActiveFilters() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={filters.clearFilters}
                >
                  Clear All Filters
                </Button>
              )}
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                {/* FOLDERS FIRST */}
                {folders.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Folders</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {folders.map((folder: any) => (
                        <div
                          key={folder.id}
                          onDrop={(e) => handleFolderDrop(e, folder.id)}
                          onDragOver={handleFolderDragOver}
                        >
                          <FolderCard
                            folder={{
                              id: folder.id,
                              name: folder.name,
                              file_count: folder.file_count || 0,
                              created_at: folder.created_at,
                              color: folder.color,
                            }}
                            onClick={() => handleFolderSelect(folder.id)}
                            onContextMenu={(e) => handleFolderContextMenu(folder, e)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FILES */}
                {files.length > 0 ? (
                  <>
                    {folders.length > 0 && <h2 className="text-lg font-semibold mb-4 mt-8">Files</h2>}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {(() => {
                        const totalPages = Math.ceil(files.length / filesPerPage);
                        const startIdx = (currentPage - 1) * filesPerPage;
                        const endIdx = startIdx + filesPerPage;
                        const paginatedFiles = files.slice(startIdx, endIdx);

                        return paginatedFiles.map((file) => (
                          <Card
                            key={file.id}
                            className="overflow-hidden"
                            draggable
                            onDragStart={(e) => handleFileDragStart(e, file.id)}
                          >
                            <div className="aspect-video bg-muted relative">
                              {file.thumbnail_url ? (
                                <img
                                  src={file.thumbnail_url}
                                  alt={file.original_filename}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full">
                                  {file.file_type === 'image' ? (
                                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                                  ) : (
                                    <Video className="w-16 h-16 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                              {selectionMode && (
                                <div className="absolute top-2 left-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => toggleFileSelection(file.id)}
                                    className="w-5 h-5 cursor-pointer"
                                  />
                                </div>
                              )}
                              <div className="absolute top-2 right-2">
                                <span className="px-2 py-1 text-xs font-medium rounded bg-background/80 backdrop-blur">
                                  {file.file_type}
                                </span>
                              </div>
                            </div>
                            <div className="p-4 space-y-2">
                              <h3 className="font-medium truncate" title={file.original_filename}>
                                {file.original_filename}
                              </h3>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Editor: {file.editor_name || 'N/A'}</p>
                                <p>Size: {formatBytes(file.file_size)}</p>
                                <p>Uploaded: {formatDate(file.created_at)}</p>
                              </div>
                              {file.tags && file.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {file.tags.slice(0, 3).map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent-foreground"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="space-y-2">
                                <div className="flex gap-2 pt-3 border-t border-border">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleDownload(file)}
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleViewMetadata(file)}
                                    title="View embedded metadata"
                                  >
                                    <Info className="w-4 h-4 mr-1" />
                                    Metadata
                                  </Button>
                                </div>
                                {canDelete && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-destructive hover:text-destructive"
                                    onClick={() => setDeleteConfirmId(file.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        ));
                      })()}
                    </div>

                    {/* Pagination */}
                    {files.length > filesPerPage && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing {((currentPage - 1) * filesPerPage) + 1}-{Math.min(currentPage * filesPerPage, files.length)} of {files.length} files
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="flex items-center px-3 text-sm">
                            Page {currentPage} of {Math.ceil(files.length / filesPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(files.length / filesPerPage), p + 1))}
                            disabled={currentPage === Math.ceil(files.length / filesPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : folders.length === 0 ? (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No files or folders found</p>
                  </Card>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <UploadModal
          editors={editors}
          currentFolderId={currentFolderId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchData();
          }}
        />
      )}

      {deleteConfirmId && (
        <DeleteConfirmModal
          fileName={files.find(f => f.id === deleteConfirmId)?.original_filename || 'this file'}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {showBulkEditor && (
        <BulkEditorModal
          selectedFiles={selectedFileObjects}
          onClose={() => setShowBulkEditor(false)}
          onComplete={() => {
            setSelectionMode(false);
            setSelectedFiles([]);
            fetchData();
          }}
        />
      )}

      {metadataViewerFile && (
        <MetadataViewer
          metadata={metadataViewerFile.metadata}
          filename={metadataViewerFile.filename}
          onClose={() => setMetadataViewerFile(null)}
        />
      )}

      {showCreateFolderModal && (
        <CreateFolderModal
          isOpen={showCreateFolderModal}
          onClose={() => setShowCreateFolderModal(false)}
          onSuccess={fetchData}
          parentFolderId={createFolderParentId}
          parentFolderName={
            createFolderParentId && breadcrumb.length > 0
              ? breadcrumb[breadcrumb.length - 1]?.name
              : undefined
          }
        />
      )}

      <FolderContextMenu
        isOpen={contextMenuFolder !== null}
        position={contextMenuPosition}
        onClose={() => setContextMenuFolder(null)}
        onRename={handleRenameFolder}
        onDelete={handleDeleteFolder}
        onCreateSubfolder={handleCreateSubfolder}
        onProperties={handleFolderProperties}
      />

      <AdvancedFilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        editors={editors}
        buyers={buyers}
        folders={folders}
        availableTags={availableTags}
      />
    </DashboardLayout>
  );
}

function UploadModal({
  editors,
  currentFolderId,
  onClose,
  onSuccess,
}: {
  editors: Editor[];
  currentFolderId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [editorId, setEditorId] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [addMetadata, setAddMetadata] = useState(true);
  const [organizeByDate, setOrganizeByDate] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !editorId) {
      setError('Please select a file and editor');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await mediaApi.upload(
        file,
        editorId,
        tagArray,
        description,
        { removeMetadata, addMetadata },
        { folderId: currentFolderId || undefined, organizeByDate }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Upload File</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {currentFolderId && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Uploading to current folder
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Editor {editors.length > 0 && `(${editors.length} available)`}
            </label>
            {editors.length === 0 ? (
              <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm">
                No editors found. Please add editors first in the Editors page.
              </div>
            ) : (
              <select
                value={editorId}
                onChange={(e) => setEditorId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                required
              >
                <option value="">Select editor...</option>
                {editors.map((editor) => (
                  <option key={editor.id} value={editor.id}>
                    {editor.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (comma-separated)</label>
            <Input
              placeholder="campaign, brand-a, product"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm min-h-[80px]"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Folder Options */}
          {!currentFolderId && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={organizeByDate}
                  onChange={(e) => setOrganizeByDate(e.target.checked)}
                  className="w-4 h-4"
                />
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Organize by date (auto-creates jan2024/15-jan/)</span>
              </label>
            </div>
          )}

          {/* Metadata Options */}
          <div className="space-y-3 p-4 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-medium block">Metadata Options</label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeMetadata}
                  onChange={(e) => setRemoveMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Remove existing metadata before upload</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addMetadata}
                  onChange={(e) => setAddMetadata(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Embed creator metadata (editor name, date, tags)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={uploading} className="flex-1">
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function DeleteConfirmModal({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Delete File</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{fileName}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. The file will be permanently removed from the library.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={onConfirm}
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BulkEditorModal({
  selectedFiles,
  onClose,
  onComplete,
}: {
  selectedFiles: MediaFile[];
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <BulkMetadataEditor
      selectedFiles={selectedFiles}
      onClose={onClose}
      onComplete={() => {
        onComplete();
        onClose();
      }}
    />
  );
}
