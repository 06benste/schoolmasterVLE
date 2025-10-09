import { api } from '../api/client';

export interface ExportData {
  metadata: {
    exportDate: string;
    version: string;
    databaseVersion: string;
  };
  settings: any[];
  users: any[];
  classes: any[];
  classStudents: any[];
  lessons: any[];
  assessments: any[];
  courses: any[];
  topics: any[];
  topicLessons: any[];
  assignments: any[];
  assignmentTargets: any[];
  courseAssignments: any[];
  topicAssignments: any[];
  attempts: any[];
  assignmentProgress: any[];
  assignmentAccess: any[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    settings: number;
    users: number;
    classes: number;
    lessons: number;
    assessments: number;
    courses: number;
    topics: number;
    assignments: number;
    courseAssignments: number;
    topicAssignments: number;
    attempts: number;
    assets: number;
  };
  errors: string[];
}

export interface ImportOptions {
  clearExisting?: boolean;
  importUsers?: boolean;
  importProgress?: boolean;
  importAssets?: boolean;
}

export interface SystemStats {
  users: number;
  classes: number;
  lessons: number;
  assessments: number;
  courses: number;
  topics: number;
  assignments: number;
  attempts: number;
  uploadedFiles: number;
}

export class ImportExportService {
  /**
   * Export complete system data as JSON
   */
  static async exportAll(): Promise<ExportData> {
    try {
      const response = await api.get('/import-export/export');
      return response.data;
    } catch (error) {
      throw new Error('Failed to export data: ' + (error as Error).message);
    }
  }

  /**
   * Export complete system as ZIP archive with all assets
   */
  static async exportZip(): Promise<Blob> {
    try {
      const response = await api.get('/import-export/export-zip', {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to export ZIP: ' + (error as Error).message);
    }
  }

  /**
   * Download complete system export as ZIP file
   */
  static async downloadCompleteExport(onProgress?: (percent: number) => void): Promise<void> {
    try {
      const blob = await this.exportZip();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `school-master-complete-export-${timestamp}.zip`;
      
      this.downloadBlob(blob, filename);
    } catch (error) {
      throw new Error('Failed to download export: ' + (error as Error).message);
    }
  }

  /**
   * Download JSON export
   */
  static async downloadJsonExport(): Promise<void> {
    try {
      const data = await this.exportAll();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `school-master-data-${timestamp}.json`;
      
      this.downloadFile(data, filename);
          } catch (error) {
      throw new Error('Failed to download JSON export: ' + (error as Error).message);
    }
  }

  /**
   * Import complete system from ZIP file
   */
  static async importZip(file: File, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clearExisting', String(options.clearExisting ?? false));
      formData.append('importUsers', String(options.importUsers ?? true));
      formData.append('importProgress', String(options.importProgress ?? true));
      formData.append('importAssets', String(options.importAssets ?? true));

      const response = await api.post('/import-export/import-zip', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error: any) {
      throw new Error('Failed to import data: ' + (error.response?.data?.error || error.message));
    }
  }

  /**
   * Get system statistics
   */
  static async getStats(): Promise<SystemStats> {
    try {
      const response = await api.get('/import-export/stats');
      return response.data;
          } catch (error) {
      throw new Error('Failed to get statistics: ' + (error as Error).message);
    }
  }

  /**
   * Load file from user's computer
   */
  static async loadFile(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.json';
      
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        resolve(file);
      };
      
      input.click();
    });
  }

  /**
   * Download file to user's computer
   */
  static downloadFile(data: any, filename: string, type: string = 'application/json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download blob to user's computer
   */
  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}