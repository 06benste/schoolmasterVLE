import { api } from '../api/client';

export interface CurriculumImportResult {
  success: boolean;
  message: string;
  imported: {
    course: string | null;
    topics: number;
    lessons: number;
    assets: number;
  };
}

export class CurriculumExportService {
  /**
   * Export a course with all topics and lessons as ZIP
   */
  static async exportCourse(courseId: string): Promise<Blob> {
    try {
      const response = await api.get(`/curriculum-export/course/${courseId}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to export course: ' + (error as Error).message);
    }
  }

  /**
   * Export a topic with all lessons as ZIP
   */
  static async exportTopic(topicId: string): Promise<Blob> {
    try {
      const response = await api.get(`/curriculum-export/topic/${topicId}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to export topic: ' + (error as Error).message);
    }
  }

  /**
   * Download course export as ZIP file
   */
  static async downloadCourseExport(courseId: string, courseTitle: string): Promise<void> {
    try {
      const blob = await this.exportCourse(courseId);
      const timestamp = new Date().toISOString().split('T')[0];
      const safeCourseTitle = courseTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `course-${safeCourseTitle}-${timestamp}.zip`;
      
      this.downloadBlob(blob, filename);
    } catch (error) {
      throw new Error('Failed to download course export: ' + (error as Error).message);
    }
  }

  /**
   * Download topic export as ZIP file
   */
  static async downloadTopicExport(topicId: string, topicTitle: string): Promise<void> {
    try {
      const blob = await this.exportTopic(topicId);
      const timestamp = new Date().toISOString().split('T')[0];
      const safeTopicTitle = topicTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `topic-${safeTopicTitle}-${timestamp}.zip`;
      
      this.downloadBlob(blob, filename);
    } catch (error) {
      throw new Error('Failed to download topic export: ' + (error as Error).message);
    }
  }

  /**
   * Import a course or topic from ZIP file
   */
  static async importCurriculum(file: File): Promise<CurriculumImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Don't set Content-Type header - let the browser set it with the correct boundary
      const response = await api.post('/curriculum-export/import', formData);

      return response.data;
    } catch (error: any) {
      throw new Error('Failed to import curriculum: ' + (error.response?.data?.error || error.message));
    }
  }

  /**
   * Load file from user's computer
   */
  static async loadFile(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';
      
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

