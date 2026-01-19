/**
 * Upload Queue Manager
 * Manages parallel uploads, resumability, and persistent tracking
 */

// Get API base URL from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface UploadTask {
  id: string;
  file: File;
  requestId: string;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
  startTime?: number;
  endTime?: number;
  comments?: string;
}

class UploadQueueManager {
  private queue: UploadTask[] = [];
  private activeUploads = 0;
  private maxConcurrent = 3; // Upload 3 files in parallel
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

      const task: UploadTask = {
        id: taskId,
        file,
        requestId,
        status: 'pending',
        progress: 0,
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
   * Upload a single task (direct upload, no chunking for now)
   */
  private async uploadTask(task: UploadTask): Promise<void> {
    const abortController = new AbortController();
    this.abortControllers.set(task.id, abortController);

    try {
      const formData = new FormData();
      formData.append('file', task.file);
      if (task.comments) {
        formData.append('comments', task.comments);
      }

      // Use XMLHttpRequest for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            task.uploadedBytes = e.loaded;
            task.progress = Math.round((e.loaded / e.total) * 100);
            console.log(`Upload progress for ${task.file.name}: ${task.progress}% (${e.loaded}/${e.total})`);
            this.notifyListeners();
          }
        });

        xhr.addEventListener('load', () => {
          console.log(`Upload load event for ${task.file.name} - Status: ${xhr.status}`);
          if (xhr.status >= 200 && xhr.status < 300) {
            task.uploadedBytes = task.totalBytes;
            task.progress = 100;
            console.log(`✅ Upload SUCCESS for ${task.file.name}`);
            resolve(xhr.response);
          } else {
            const errorMsg = `Upload failed with status ${xhr.status}`;
            console.error('❌ Upload error:', errorMsg, xhr.responseText);
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener('error', (e) => {
          console.error('❌ Network error during upload for', task.file.name, e);
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          console.log('⚠️ Upload cancelled for', task.file.name);
          reject(new Error('Upload cancelled'));
        });

        xhr.addEventListener('loadstart', () => {
          console.log(`🚀 XHR loadstart for ${task.file.name}`);
        });

        xhr.addEventListener('loadend', () => {
          console.log(`🏁 XHR loadend for ${task.file.name} - Status: ${xhr.status}`);
        });

        abortController.signal.addEventListener('abort', () => xhr.abort());

        const uploadUrl = `${API_BASE_URL}/file-requests/${task.requestId}/upload`;
        console.log(`📤 Opening XHR POST to: ${uploadUrl}`);
        xhr.open('POST', uploadUrl);

        const token = localStorage.getItem('token');
        console.log(`🔑 Authorization token ${token ? 'present' : 'MISSING'} (length: ${token?.length || 0})`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        console.log(`📦 FormData contents: file=${task.file.name} (${task.file.size} bytes), comments=${task.comments || 'none'}`);
        console.log(`🚀 Sending XHR request for file: ${task.file.name} to request: ${task.requestId}`);
        xhr.send(formData);
        console.log(`✉️ XHR.send() called for ${task.file.name}`);
      });

      // Only save/notify after successful upload (inside the load handler above)
      this.saveToStorage();
      this.notifyListeners();
    } finally {
      this.abortControllers.delete(task.id);
    }
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
        fileName: task.file?.name || 'Unknown',
        fileSize: task.file?.size || task.totalBytes,
        fileType: task.file?.type || 'unknown'
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
