/**
 * Upload Queue Manager
 * Manages parallel uploads, resumability, and persistent tracking
 */

export interface UploadTask {
  id: string;
  file: File;
  requestId: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  progress: number;
  uploadedChunks: number[];
  totalChunks: number;
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
  startTime?: number;
  endTime?: number;
  comments?: string;
}

export interface UploadChunk {
  index: number;
  start: number;
  end: number;
  blob: Blob;
}

class UploadQueueManager {
  private queue: UploadTask[] = [];
  private activeUploads = 0;
  private maxConcurrent = 3; // Upload 3 files in parallel
  private chunkSize = 10 * 1024 * 1024; // 10MB chunks
  private listeners: ((queue: UploadTask[]) => void)[] = [];
  private abortControllers: Map<string, AbortController> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add files to upload queue
   */
  addToQueue(files: File[], requestId: string, comments?: string): string[] {
    const taskIds: string[] = [];

    for (const file of files) {
      const taskId = this.generateTaskId();
      const totalChunks = Math.ceil(file.size / this.chunkSize);

      const task: UploadTask = {
        id: taskId,
        file,
        requestId,
        status: 'pending',
        progress: 0,
        uploadedChunks: [],
        totalChunks,
        uploadedBytes: 0,
        totalBytes: file.size,
        comments,
        startTime: Date.now()
      };

      this.queue.push(task);
      taskIds.push(taskId);
    }

    this.saveToStorage();
    this.notifyListeners();
    this.processQueue();

    return taskIds;
  }

  /**
   * Process upload queue with parallel uploads
   */
  private async processQueue() {
    while (this.activeUploads < this.maxConcurrent) {
      const nextTask = this.queue.find(t => t.status === 'pending');
      if (!nextTask) break;

      this.activeUploads++;
      nextTask.status = 'uploading';
      this.notifyListeners();

      this.uploadTask(nextTask)
        .then(() => {
          nextTask.status = 'completed';
          nextTask.progress = 100;
          nextTask.endTime = Date.now();
        })
        .catch((error) => {
          nextTask.status = 'failed';
          nextTask.error = error.message;
        })
        .finally(() => {
          this.activeUploads--;
          this.saveToStorage();
          this.notifyListeners();
          this.processQueue(); // Process next in queue
        });
    }
  }

  /**
   * Upload a single task with chunking and resumability
   */
  private async uploadTask(task: UploadTask): Promise<void> {
    const chunks = this.createChunks(task.file);
    const abortController = new AbortController();
    this.abortControllers.set(task.id, abortController);

    try {
      // Upload chunks sequentially (for single file)
      for (let i = 0; i < chunks.length; i++) {
        // Skip already uploaded chunks (resumability)
        if (task.uploadedChunks.includes(i)) {
          continue;
        }

        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        await this.uploadChunk(task, chunks[i], i, abortController.signal);

        // Update progress
        task.uploadedChunks.push(i);
        task.uploadedBytes = task.uploadedChunks.length * this.chunkSize;
        task.progress = Math.round((task.uploadedChunks.length / task.totalChunks) * 100);

        this.saveToStorage();
        this.notifyListeners();
      }

      // Finalize upload
      await this.finalizeUpload(task);
    } finally {
      this.abortControllers.delete(task.id);
    }
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    task: UploadTask,
    chunk: UploadChunk,
    index: number,
    signal: AbortSignal
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', chunk.blob, task.file.name);
    formData.append('chunkIndex', index.toString());
    formData.append('totalChunks', task.totalChunks.toString());
    formData.append('fileName', task.file.name);
    formData.append('fileSize', task.totalBytes.toString());

    if (task.comments) {
      formData.append('comments', task.comments);
    }

    const response = await fetch(`/api/file-requests/${task.requestId}/upload-chunk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
      signal
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Chunk upload failed');
    }
  }

  /**
   * Finalize upload after all chunks are uploaded
   */
  private async finalizeUpload(task: UploadTask): Promise<void> {
    const response = await fetch(`/api/file-requests/${task.requestId}/finalize-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: task.file.name,
        fileSize: task.totalBytes,
        totalChunks: task.totalChunks,
        comments: task.comments
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to finalize upload');
    }
  }

  /**
   * Create chunks from file
   */
  private createChunks(file: File): UploadChunk[] {
    const chunks: UploadChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < file.size) {
      const end = Math.min(start + this.chunkSize, file.size);
      chunks.push({
        index,
        start,
        end,
        blob: file.slice(start, end)
      });
      start = end;
      index++;
    }

    return chunks;
  }

  /**
   * Pause an upload
   */
  pauseUpload(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === 'uploading') {
      const controller = this.abortControllers.get(taskId);
      if (controller) {
        controller.abort();
      }
      task.status = 'paused';
      this.activeUploads--;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Resume a paused upload
   */
  resumeUpload(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === 'paused') {
      task.status = 'pending';
      this.saveToStorage();
      this.notifyListeners();
      this.processQueue();
    }
  }

  /**
   * Retry a failed upload
   */
  retryUpload(taskId: string) {
    const task = this.queue.find(t => t.id === taskId);
    if (task && task.status === 'failed') {
      task.status = 'pending';
      task.error = undefined;
      this.saveToStorage();
      this.notifyListeners();
      this.processQueue();
    }
  }

  /**
   * Cancel an upload
   */
  cancelUpload(taskId: string) {
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.queue[taskIndex];

      if (task.status === 'uploading') {
        const controller = this.abortControllers.get(taskId);
        if (controller) {
          controller.abort();
        }
        this.activeUploads--;
      }

      this.queue.splice(taskIndex, 1);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Clear completed uploads
   */
  clearCompleted() {
    this.queue = this.queue.filter(t => t.status !== 'completed');
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get queue status
   */
  getQueue(): UploadTask[] {
    return this.queue;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: UploadTask[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.queue]));
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage() {
    try {
      const queueData = this.queue.map(task => ({
        ...task,
        file: undefined, // Don't store File object
        fileName: task.file.name,
        fileSize: task.file.size,
        fileType: task.file.type
      }));
      localStorage.setItem('uploadQueue', JSON.stringify(queueData));
    } catch (error) {
      console.error('Failed to save upload queue:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('uploadQueue');
      if (stored) {
        const queueData = JSON.parse(stored);
        // Filter out completed uploads older than 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        this.queue = queueData.filter((task: UploadTask) => {
          if (task.status === 'completed' && task.endTime && task.endTime < oneDayAgo) {
            return false;
          }
          return true;
        });
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to load upload queue:', error);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get upload statistics
   */
  getStats() {
    const total = this.queue.length;
    const completed = this.queue.filter(t => t.status === 'completed').length;
    const uploading = this.queue.filter(t => t.status === 'uploading').length;
    const failed = this.queue.filter(t => t.status === 'failed').length;
    const pending = this.queue.filter(t => t.status === 'pending').length;
    const paused = this.queue.filter(t => t.status === 'paused').length;

    return { total, completed, uploading, failed, pending, paused };
  }
}

// Singleton instance
export const uploadQueueManager = new UploadQueueManager();
