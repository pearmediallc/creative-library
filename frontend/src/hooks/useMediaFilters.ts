import { useState, useCallback } from 'react';

export interface MediaFilters {
  search: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  mediaTypes: ('image' | 'video')[];
  editorIds: string[];
  buyerIds: string[];
  folderIds: string[];
  tags: string[];
  sizeMin?: number;
  sizeMax?: number;
  widthMin?: number;
  widthMax?: number;
  heightMin?: number;
  heightMax?: number;
}

const initialFilters: MediaFilters = {
  search: '',
  dateFrom: null,
  dateTo: null,
  mediaTypes: [],
  editorIds: [],
  buyerIds: [],
  folderIds: [],
  tags: [],
};

export function useMediaFilters() {
  const [filters, setFilters] = useState<MediaFilters>(initialFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const updateFilter = useCallback(<K extends keyof MediaFilters>(
    key: K,
    value: MediaFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleMediaType = useCallback((type: 'image' | 'video') => {
    setFilters(prev => ({
      ...prev,
      mediaTypes: prev.mediaTypes.includes(type)
        ? prev.mediaTypes.filter(t => t !== type)
        : [...prev.mediaTypes, type]
    }));
  }, []);

  const toggleEditor = useCallback((editorId: string) => {
    setFilters(prev => ({
      ...prev,
      editorIds: prev.editorIds.includes(editorId)
        ? prev.editorIds.filter(id => id !== editorId)
        : [...prev.editorIds, editorId]
    }));
  }, []);

  const toggleBuyer = useCallback((buyerId: string) => {
    setFilters(prev => ({
      ...prev,
      buyerIds: prev.buyerIds.includes(buyerId)
        ? prev.buyerIds.filter(id => id !== buyerId)
        : [...prev.buyerIds, buyerId]
    }));
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setFilters(prev => ({
      ...prev,
      folderIds: prev.folderIds.includes(folderId)
        ? prev.folderIds.filter(id => id !== folderId)
        : [...prev.folderIds, folderId]
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const hasActiveFilters = useCallback(() => {
    return (
      filters.search !== '' ||
      filters.dateFrom !== null ||
      filters.dateTo !== null ||
      filters.mediaTypes.length > 0 ||
      filters.editorIds.length > 0 ||
      filters.buyerIds.length > 0 ||
      filters.folderIds.length > 0 ||
      filters.tags.length > 0 ||
      filters.sizeMin !== undefined ||
      filters.sizeMax !== undefined
    );
  }, [filters]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.mediaTypes.length > 0) count++;
    if (filters.editorIds.length > 0) count++;
    if (filters.buyerIds.length > 0) count++;
    if (filters.folderIds.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) count++;
    return count;
  }, [filters]);

  // Convert filters to API query parameters
  const toQueryParams = useCallback(() => {
    const params: any = {};

    if (filters.search) params.search = filters.search;
    if (filters.dateFrom) params.date_from = filters.dateFrom.toISOString().split('T')[0];
    if (filters.dateTo) params.date_to = filters.dateTo.toISOString().split('T')[0];
    if (filters.mediaTypes.length > 0) params.media_type = filters.mediaTypes.join(',');
    if (filters.editorIds.length > 0) params.editor_id = filters.editorIds.join(',');
    if (filters.buyerIds.length > 0) params.buyer_id = filters.buyerIds.join(',');
    if (filters.folderIds.length > 0) params.folder_id = filters.folderIds.join(',');
    if (filters.tags.length > 0) params.tags = filters.tags.join(',');
    if (filters.sizeMin !== undefined) params.size_min = filters.sizeMin;
    if (filters.sizeMax !== undefined) params.size_max = filters.sizeMax;
    if (filters.widthMin !== undefined) params.width_min = filters.widthMin;
    if (filters.widthMax !== undefined) params.width_max = filters.widthMax;
    if (filters.heightMin !== undefined) params.height_min = filters.heightMin;
    if (filters.heightMax !== undefined) params.height_max = filters.heightMax;

    return params;
  }, [filters]);

  return {
    filters,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    updateFilter,
    toggleMediaType,
    toggleEditor,
    toggleBuyer,
    toggleFolder,
    toggleTag,
    clearFilters,
    hasActiveFilters: hasActiveFilters(),
    activeFilterCount: getActiveFilterCount(),
    toQueryParams,
  };
}
