import JSZip from 'jszip';
import { api } from '../api/client';

export interface AssetInfo {
  url: string;
  filename: string;
  type: 'image' | 'video' | 'document' | 'other';
  size?: number;
}

export interface EnhancedExportData {
  metadata: {
    exportDate: string;
    version: string;
    schoolName?: string;
    totalAssets: number;
    totalSize: number;
  };
  data: {
    lessons: any[];
    assessments: any[];
    assignments: any[];
    courses: any[];
    classes: any[];
    users: any[];
  };
  assets: AssetInfo[];
}

export class AssetExportService {
  static async downloadAsset(url: string): Promise<Blob> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download asset: ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error(`Failed to download asset ${url}:`, error);
      throw error;
    }
  }

  static extractAssetsFromContent(content: any): AssetInfo[] {
    const assets: AssetInfo[] = [];
    
    if (!content || typeof content !== 'object') return assets;

    // Extract from lesson blocks
    if (content.blocks && Array.isArray(content.blocks)) {
      content.blocks.forEach((block: any) => {
        this.extractAssetsFromBlock(block, assets);
      });
    }

    return assets;
  }

  static extractAssetsFromBlock(block: any, assets: AssetInfo[]): void {
    if (!block || typeof block !== 'object') return;

    switch (block.type) {
      case 'image':
        if (block.url && block.url.startsWith('/uploads/')) {
          assets.push({
            url: block.url,
            filename: this.generateAssetFilename(block.url, 'image'),
            type: 'image'
          });
        }
        break;

      case 'video':
        if (block.url && !block.url.includes('youtube.com') && !block.url.includes('youtu.be') && !block.url.includes('vimeo.com')) {
          assets.push({
            url: block.url,
            filename: this.generateAssetFilename(block.url, 'video'),
            type: 'video'
          });
        }
        break;

      case 'documents':
        if (block.documents && Array.isArray(block.documents)) {
          block.documents.forEach((doc: any) => {
            if (doc.url && doc.url.startsWith('/uploads/')) {
              assets.push({
                url: doc.url,
                filename: this.generateAssetFilename(doc.url, 'document'),
                type: 'document',
                size: doc.size
              });
            }
          });
        }
        break;

      case 'columns':
        if (block.columns && Array.isArray(block.columns)) {
          block.columns.forEach((column: any) => {
            if (column.blocks && Array.isArray(column.blocks)) {
              column.blocks.forEach((nestedBlock: any) => {
                this.extractAssetsFromBlock(nestedBlock, assets);
              });
            }
          });
        }
        break;
    }
  }

  static generateAssetFilename(url: string, type: string): string {
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const timestamp = Date.now();
    return `assets/${type}s/${timestamp}_${filename}`;
  }

  static async createEnhancedExport(onProgress?: (percent: number) => void): Promise<Blob> {
    const zip = new JSZip();
    
    try {
      // Get all data
      const [lessonsRes, assessmentsRes, assignmentsRes, coursesRes, classesRes, usersRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/assessments'),
        api.get('/assignments'),
        api.get('/curriculum/courses'),
        api.get('/classes'),
        api.get('/users')
      ]);

      const lessons = lessonsRes.data;
      const assessments = assessmentsRes.data;
      const assignments = assignmentsRes.data;
      const courses = coursesRes.data;
      const classes = classesRes.data;
      const users = usersRes.data;

      // Extract all assets
      const allAssets: AssetInfo[] = [];
      
      // Extract from lessons
      lessons.forEach((lesson: any) => {
        const lessonAssets = this.extractAssetsFromContent(lesson.content);
        allAssets.push(...lessonAssets);
      });

      // Extract from assessments
      assessments.forEach((assessment: any) => {
        const assessmentAssets = this.extractAssetsFromContent(assessment.content);
        allAssets.push(...assessmentAssets);
      });

      // Remove duplicates
      const uniqueAssets = allAssets.filter((asset, index, self) => 
        index === self.findIndex(a => a.url === asset.url)
      );

      // Download all assets
      const assetPromises = uniqueAssets.map(async (asset) => {
        try {
          const blob = await this.downloadAsset(asset.url);
          return { ...asset, blob };
        } catch (error) {
          console.error(`Failed to download asset ${asset.url}:`, error);
          return null;
        }
      });

      const downloadedAssets = await Promise.all(assetPromises);
      const successfulAssets = downloadedAssets.filter(asset => asset !== null);

      // Add data files to ZIP
      zip.file('data/lessons.json', JSON.stringify(lessons, null, 2));
      zip.file('data/assessments.json', JSON.stringify(assessments, null, 2));
      zip.file('data/assignments.json', JSON.stringify(assignments, null, 2));
      zip.file('data/courses.json', JSON.stringify(courses, null, 2));
      zip.file('data/classes.json', JSON.stringify(classes, null, 2));
      zip.file('data/users.json', JSON.stringify(users, null, 2));

      // Add assets to ZIP
      successfulAssets.forEach((asset) => {
        if (asset && asset.blob) {
          zip.file(asset.filename, asset.blob);
        }
      });

      // Create manifest
      const manifest = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        schoolName: 'School Master',
        totalAssets: successfulAssets.length,
        totalSize: successfulAssets.reduce((total, asset) => total + (asset?.blob?.size || 0), 0),
        assets: successfulAssets.map(asset => ({
          url: asset?.url,
          filename: asset?.filename,
          type: asset?.type,
          size: asset?.blob?.size
        }))
      };

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // Create README
      const readme = `# School Master Export

This ZIP file contains a complete export of your School Master data.

## Contents

- \`data/\` - JSON files containing all system data
  - \`lessons.json\` - All lessons with content
  - \`assessments.json\` - All assessments
  - \`assignments.json\` - All assignments
  - \`courses.json\` - All courses and topics
  - \`users.json\` - All users

- \`assets/\` - All uploaded files organized by type
  - \`images/\` - Lesson images
  - \`videos/\` - Lesson videos
  - \`documents/\` - Lesson documents

- \`manifest.json\` - Export metadata and asset information

## Import Instructions

1. Extract this ZIP file
2. Use the Import/Export feature in School Master
3. Select the \`data\` folder or individual JSON files
4. All assets will be automatically restored

## Export Information

- Export Date: ${manifest.exportDate}
- Total Assets: ${manifest.totalAssets}
- Total Size: ${(manifest.totalSize / 1024 / 1024).toFixed(2)} MB

Generated by School Master v${manifest.version}
`;

      zip.file('README.md', readme);

      // Generate ZIP with progress
      return await zip.generateAsync({ type: 'blob' }, (metadata) => {
        if (onProgress) {
          const percent = Math.floor(metadata.percent);
          onProgress(percent);
        }
      });

    } catch (error) {
      console.error('Failed to create enhanced export:', error);
      throw new Error('Failed to create export: ' + (error as Error).message);
    }
  }

  static async downloadEnhancedExport(onProgress?: (percent: number) => void): Promise<void> {
    try {
      const zipBlob = await this.createEnhancedExport(onProgress);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `school-master-complete-export-${timestamp}.zip`;
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error('Failed to download enhanced export: ' + (error as Error).message);
    }
  }
}
