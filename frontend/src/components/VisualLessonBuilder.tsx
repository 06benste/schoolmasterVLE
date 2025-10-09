import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

// Enhanced block types for the visual builder
type VisualBlock = 
  | { type: 'heading'; id: string; level: 1 | 2 | 3 | 4 | 5 | 6; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'text'; id: string; content: string; size?: 'small' | 'medium' | 'large'; formatting?: {
      fontFamily?: string;
      fontSize?: number;
      color?: string;
      backgroundColor?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      textAlign?: 'left' | 'center' | 'right' | 'justify';
      lineHeight?: number;
      listType?: 'none' | 'bullet' | 'numbered';
    }; links?: Array<{ id: string; text: string; url: string; start: number; end: number }> }
  | { type: 'image'; id: string; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'video'; id: string; url: string; width?: number; height?: number }
  | { type: 'columns'; id: string; columns: Array<{ id: string; content: string; width: number; blocks?: VisualBlock[] }> }
  | { type: 'spacer'; id: string; height: number }
  | { type: 'divider'; id: string; style?: 'solid' | 'dashed' | 'dotted' }
  | { type: 'quiz'; id: string; question: string; options: string[]; answerIndex: number }
  | { type: 'fillblank'; id: string; prompt: string; answer: string }
  | { type: 'documents'; id: string; title: string; documents: Array<{ id: string; name: string; url: string; size: number; type: string }> }

interface VisualLessonBuilderProps {
  blocks: VisualBlock[];
  onBlocksChange: (blocks: VisualBlock[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

// Block palette items
const blockPalette = [
  { type: 'heading', label: 'Heading', icon: '📝', description: 'Add a heading' },
  { type: 'text', label: 'Text', icon: '📄', description: 'Add text content' },
  { type: 'image', label: 'Image', icon: '🖼️', description: 'Add an image' },
  { type: 'video', label: 'Video', icon: '🎥', description: 'Add a video' },
  { type: 'columns', label: 'Columns', icon: '📊', description: 'Add columns layout' },
  { type: 'spacer', label: 'Spacer', icon: '⬜', description: 'Add spacing' },
  { type: 'divider', label: 'Divider', icon: '➖', description: 'Add a divider line' },
  { type: 'quiz', label: 'Multiple Choice', icon: '❓', description: 'Add a multiple choice question' },
  { type: 'fillblank', label: 'Fill Blank', icon: '✏️', description: 'Add fill in the blank' },
  { type: 'documents', label: 'Documents', icon: '📁', description: 'Add downloadable documents' },
];

export default function VisualLessonBuilder({ blocks, onBlocksChange, onSave, onCancel }: VisualLessonBuilderProps) {
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkData, setLinkData] = useState({ text: '', url: '' });
  const [currentTextBlock, setCurrentTextBlock] = useState<string | null>(null);

  // Generate unique ID for new blocks
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Create a new block
  const createBlock = (type: string): VisualBlock => {
    switch (type) {
      case 'heading':
        return { type: 'heading', id: generateId(), level: 1, content: '', size: 'medium' };
      case 'text':
        return { 
          type: 'text', 
          id: generateId(), 
          content: '', 
          size: 'medium',
          formatting: {
            fontFamily: 'Arial, sans-serif',
            fontSize: 16,
            color: '#000000',
            backgroundColor: 'transparent',
            bold: false,
            italic: false,
            underline: false,
            textAlign: 'left',
            lineHeight: 1.5
          },
          links: []
        };
      case 'image':
        return { type: 'image', id: generateId(), url: '', alt: '', caption: '', width: 100, height: 200 };
      case 'video':
        return { type: 'video', id: generateId(), url: '', width: 100, height: 200 };
      case 'columns':
        return { 
          type: 'columns', 
          id: generateId(), 
          columns: [
            { id: generateId(), content: '', width: 50, blocks: [] },
            { id: generateId(), content: '', width: 50, blocks: [] }
          ]
        };
      case 'spacer':
        return { type: 'spacer', id: generateId(), height: 40 };
      case 'divider':
        return { type: 'divider', id: generateId(), style: 'solid' };
      case 'quiz':
        return { type: 'quiz', id: generateId(), question: '', options: ['', ''], answerIndex: 0 };
      case 'fillblank':
        return { type: 'fillblank', id: generateId(), prompt: '', answer: '' };
      case 'documents':
        return { type: 'documents', id: generateId(), title: 'Download Documents', documents: [] };
      default:
        return { type: 'text', id: generateId(), content: '', size: 'medium' };
    }
  };

  // Add a new block at the end
  const addBlock = (type: string) => {
    const newBlock = createBlock(type);
    onBlocksChange([...blocks, newBlock]);
  };

  // Add a new block at a specific position
  const addBlockAtPosition = (type: string, position: number) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks];
    newBlocks.splice(position, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  // Add a new block to a specific column
  const addBlockToColumn = (type: string, blockId: string, columnIndex: number) => {
    console.log('addBlockToColumn called:', { type, blockId, columnIndex });
    const newBlock = createBlock(type);
    console.log('Created new block:', newBlock);
    
    const updatedBlocks = blocks.map(block => {
      if (block.id === blockId && block.type === 'columns') {
        console.log('Found target columns block:', block);
        const newColumns = [...block.columns];
        newColumns[columnIndex] = {
          ...newColumns[columnIndex],
          blocks: [...(newColumns[columnIndex].blocks || []), newBlock]
        };
        console.log('Updated column:', newColumns[columnIndex]);
        return { ...block, columns: newColumns };
      }
      return block;
    });
    
    console.log('Updated blocks:', updatedBlocks);
    onBlocksChange(updatedBlocks);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('text/plain', blockType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if we're dragging an existing block or a new block from palette
    const hasExistingBlock = e.dataTransfer.types.includes('application/json');
    e.dataTransfer.dropEffect = hasExistingBlock ? 'move' : 'copy';
    
    console.log('Drag over:', e.dataTransfer.types, 'hasExistingBlock:', hasExistingBlock);
    
    // Calculate drop position for visual feedback
    const dropY = e.clientY;
    const editorRect = e.currentTarget.getBoundingClientRect();
    const relativeY = dropY - editorRect.top;
    const editorHeight = editorRect.height;
    
    const blockElements = Array.from(e.currentTarget.querySelectorAll('[data-block-id]'));
    let newDragOverIndex = blocks.length;
    
    // If we're near the bottom of the editor (within 50px), always set to end
    if (relativeY > editorHeight - 50) {
      newDragOverIndex = blocks.length;
    } else {
    for (let i = 0; i < blockElements.length; i++) {
      const element = blockElements[i];
      const elementRect = element.getBoundingClientRect();
      const elementTop = elementRect.top - editorRect.top;
      const elementBottom = elementRect.bottom - editorRect.top;
      
      if (relativeY < (elementTop + elementBottom) / 2) {
        newDragOverIndex = i;
        break;
        }
      }
    }
    
    setDragOverIndex(newDragOverIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Main editor drop event triggered', e.dataTransfer.types);
    
    // Check if we're dropping over a column
    const target = e.target as HTMLElement;
    const columnElement = target.closest('[data-column-id]');
    console.log('Drop target:', target, 'Column element:', columnElement);
    
    if (columnElement) {
      console.log('Drop is over a column, letting column handle it');
      return;
    }
    
    // Also check if we're dropping over a column by checking the drop coordinates
    const dropY = e.clientY;
    const editorRect = e.currentTarget.getBoundingClientRect();
    const relativeY = dropY - editorRect.top;
    
    console.log('Drop coordinates:', { dropY, editorRect: editorRect.top, relativeY });
    
    // Check if we're over any column elements
    const columnElements = Array.from(e.currentTarget.querySelectorAll('[data-column-id]'));
    console.log('Found column elements:', columnElements.length);
    
    for (const colEl of columnElements) {
      const colRect = colEl.getBoundingClientRect();
      const colTop = colRect.top - editorRect.top;
      const colBottom = colRect.bottom - editorRect.top;
      
      console.log('Column bounds:', { colTop, colBottom, relativeY, isOver: relativeY >= colTop && relativeY <= colBottom });
      
      if (relativeY >= colTop && relativeY <= colBottom) {
        console.log('Drop coordinates are over a column, letting column handle it');
        return;
      }
    }
    
    // Check if dragOverColumn is set (meaning we were dragging over a column)
    if (dragOverColumn) {
      // Parse the dragOverColumn to get blockId and columnIndex
      const [blockId, columnIndexStr] = dragOverColumn.split('-');
      const columnIndex = parseInt(columnIndexStr);
      
      // Check if we're actually over the column by coordinates
      const columnElements = Array.from(e.currentTarget.querySelectorAll('[data-column-id]'));
      let isOverColumn = false;
      
      for (const colEl of columnElements) {
        const colRect = colEl.getBoundingClientRect();
        const colTop = colRect.top - editorRect.top;
        const colBottom = colRect.bottom - editorRect.top;
        
        if (relativeY >= colTop && relativeY <= colBottom) {
          const colId = colEl.getAttribute('data-column-id');
          if (colId === dragOverColumn) {
            isOverColumn = true;
            break;
          }
        }
      }
      
      if (isOverColumn) {
        console.log('Drag was over column, manually calling column drop handler');
        console.log('Manually calling column drop:', blockId, columnIndex);
        handleColumnDrop(e, blockId, columnIndex);
        return;
      } else {
        console.log('Drag was over column but coordinates show we moved out, treating as main editor drop');
      }
    }
    
    console.log('Main editor processing drop - dragOverColumn:', dragOverColumn);
    
    const blockType = e.dataTransfer.getData('text/plain');
    const draggedBlockId = e.dataTransfer.getData('application/json');
    
    console.log('Main editor drop data:', { blockType, draggedBlockId });
    
    if (draggedBlockId) {
      // Handle dragging existing blocks
      const draggedBlock = JSON.parse(draggedBlockId);
      const insertIndex = dragOverIndex !== null ? dragOverIndex : blocks.length;
      
      console.log('Moving existing block:', draggedBlock, 'to index:', insertIndex);
      console.log('Is nested?', draggedBlock.isNested);
      
      if (draggedBlock.isNested) {
        // Moving a nested block out of a column
        console.log('Moving nested block out of column:', draggedBlock.id, 'from parent:', draggedBlock.parentId, 'column:', draggedBlock.columnIndex);
        moveBlockOutOfColumn(draggedBlock.id, draggedBlock.parentId, draggedBlock.columnIndex, insertIndex);
      } else {
        // Moving a main block
        console.log('Moving main block:', draggedBlock.id, 'to index:', insertIndex);
        moveBlockToPosition(draggedBlock.id, insertIndex);
      }
    } else if (blockType) {
      // Handle dragging new blocks from palette
      const insertIndex = dragOverIndex !== null ? dragOverIndex : blocks.length;
      addBlockAtPosition(blockType, insertIndex);
    }
    
    setDragOverIndex(null);
    setDragOverColumn(null);
    setDraggedBlockId(null);
    setDraggedBlockIndex(null);
  };

  // Handle dragging existing blocks
  const handleBlockDragStart = (e: React.DragEvent, blockId: string, blockIndex: number) => {
    console.log('Block drag start:', blockId, blockIndex);
    e.dataTransfer.setData('application/json', JSON.stringify({ id: blockId, index: blockIndex }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBlockId(blockId);
    setDraggedBlockIndex(blockIndex);
  };

  // Move a block to a new position
  const moveBlockToPosition = (blockId: string, newIndex: number) => {
    const currentIndex = blocks.findIndex(b => b.id === blockId);
    if (currentIndex === -1) return;
    
    const block = blocks[currentIndex];
    const newBlocks = [...blocks];
    newBlocks.splice(currentIndex, 1);
    
    // Adjust newIndex if we're moving within the same array
    const adjustedIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
    newBlocks.splice(adjustedIndex, 0, block);
    
    onBlocksChange(newBlocks);
  };

  // Move a block into a column
  const moveBlockIntoColumn = (blockId: string, columnBlockId: string, columnIndex: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const updatedBlocks = blocks.map(b => {
      if (b.id === columnBlockId && b.type === 'columns') {
        const newColumns = [...b.columns];
        newColumns[columnIndex] = {
          ...newColumns[columnIndex],
          blocks: [...(newColumns[columnIndex].blocks || []), block]
        };
        return { ...b, columns: newColumns };
      }
      return b;
    });
    
    // Remove the block from the main blocks array
    const filteredBlocks = updatedBlocks.filter(b => b.id !== blockId);
    onBlocksChange(filteredBlocks);
  };

  // Move a block out of a column
  const moveBlockOutOfColumn = (blockId: string, columnBlockId: string, columnIndex: number, newIndex: number) => {
    const columnBlock = blocks.find(b => b.id === columnBlockId);
    if (!columnBlock || columnBlock.type !== 'columns') return;
    
    const column = columnBlock.columns[columnIndex];
    const block = column.blocks?.find(b => b.id === blockId);
    if (!block) return;
    
    // Add block to main blocks array
    const newBlocks = [...blocks];
    newBlocks.splice(newIndex, 0, block);
    
    // Remove block from column
    const updatedBlocks = newBlocks.map(b => {
      if (b.id === columnBlockId && b.type === 'columns') {
        const newColumns = [...b.columns];
        newColumns[columnIndex] = {
          ...newColumns[columnIndex],
          blocks: newColumns[columnIndex].blocks?.filter(bl => bl.id !== blockId) || []
        };
        return { ...b, columns: newColumns };
      }
      return b;
    });
    
    onBlocksChange(updatedBlocks);
  };

  // Move a nested block between columns
  const moveNestedBlockBetweenColumns = (blockId: string, sourceColumnBlockId: string, sourceColumnIndex: number, targetColumnBlockId: string, targetColumnIndex: number) => {
    console.log('moveNestedBlockBetweenColumns called:', { blockId, sourceColumnBlockId, sourceColumnIndex, targetColumnBlockId, targetColumnIndex });
    
    const sourceColumnBlock = blocks.find(b => b.id === sourceColumnBlockId);
    if (!sourceColumnBlock || sourceColumnBlock.type !== 'columns') {
      console.log('Source column block not found or not columns type');
      return;
    }
    
    const sourceColumn = sourceColumnBlock.columns[sourceColumnIndex];
    const block = sourceColumn.blocks?.find(b => b.id === blockId);
    if (!block) {
      console.log('Block not found in source column');
      return;
    }
    
    console.log('Found block to move:', block);
    
    // If source and target are the same columns block, handle it specially
    if (sourceColumnBlockId === targetColumnBlockId) {
      console.log('Moving within same columns block');
      const updatedBlocks = blocks.map(b => {
        if (b.id === sourceColumnBlockId && b.type === 'columns') {
          const newColumns = [...b.columns];
          
          // Remove from source column
          newColumns[sourceColumnIndex] = {
            ...newColumns[sourceColumnIndex],
            blocks: newColumns[sourceColumnIndex].blocks?.filter(bl => bl.id !== blockId) || []
          };
          
          // Add to target column
          newColumns[targetColumnIndex] = {
            ...newColumns[targetColumnIndex],
            blocks: [...(newColumns[targetColumnIndex].blocks || []), block]
          };
          
          console.log('Updated columns:', newColumns);
          return { ...b, columns: newColumns };
        }
        return b;
      });
      
      onBlocksChange(updatedBlocks);
    } else {
      // Different columns blocks - handle separately
      console.log('Moving between different columns blocks');
      const updatedBlocks = blocks.map(b => {
        if (b.id === sourceColumnBlockId && b.type === 'columns') {
          // Remove from source column
          const newColumns = [...b.columns];
          newColumns[sourceColumnIndex] = {
            ...newColumns[sourceColumnIndex],
            blocks: newColumns[sourceColumnIndex].blocks?.filter(bl => bl.id !== blockId) || []
          };
          return { ...b, columns: newColumns };
        } else if (b.id === targetColumnBlockId && b.type === 'columns') {
          // Add to target column
          const newColumns = [...b.columns];
          newColumns[targetColumnIndex] = {
            ...newColumns[targetColumnIndex],
            blocks: [...(newColumns[targetColumnIndex].blocks || []), block]
          };
          return { ...b, columns: newColumns };
        }
        return b;
      });
      
      onBlocksChange(updatedBlocks);
    }
  };

  // Column-specific drag handlers
  const handleColumnDragOver = (e: React.DragEvent, blockId: string, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if this is a new block from palette or existing block
    const hasExistingBlock = e.dataTransfer.types.includes('application/json');
    e.dataTransfer.dropEffect = hasExistingBlock ? 'move' : 'copy';
    
    console.log('Column drag over:', blockId, columnIndex, 'hasExistingBlock:', hasExistingBlock);
    setDragOverColumn(`${blockId}-${columnIndex}`);
  };

  const handleColumnDragEnter = (e: React.DragEvent, blockId: string, columnIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Column drag enter:', blockId, columnIndex);
    setDragOverColumn(`${blockId}-${columnIndex}`);
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Column drag leave');
    // Don't clear dragOverColumn on drag leave - let drag end handle it
    // This prevents the state from being cleared prematurely
  };

  const handleColumnDrop = (e: React.DragEvent, blockId: string, columnIndex: number) => {
    console.log('Column drop handler called!', blockId, columnIndex);
    e.preventDefault();
    e.stopPropagation();
    (e.nativeEvent as Event).stopImmediatePropagation(); // Prevent other handlers from running
    
    console.log('Column drop event:', blockId, columnIndex);
    
    const blockType = e.dataTransfer.getData('text/plain');
    const draggedBlockId = e.dataTransfer.getData('application/json');
    
    console.log('Column drop data:', { blockType, draggedBlockId });
    
    if (draggedBlockId) {
      // Handle moving existing blocks into columns
      const draggedBlock = JSON.parse(draggedBlockId);
      
      console.log('Column drop - dragged block:', draggedBlock);
      
      if (draggedBlock.isNested) {
        // Moving a nested block between columns
        console.log('Moving nested block between columns:', draggedBlock.id, 'from', draggedBlock.parentId, draggedBlock.columnIndex, 'to', blockId, columnIndex);
        moveNestedBlockBetweenColumns(draggedBlock.id, draggedBlock.parentId, draggedBlock.columnIndex, blockId, columnIndex);
      } else {
        // Moving a main block into a column
        console.log('Moving main block into column:', draggedBlock.id, 'to', blockId, columnIndex);
        moveBlockIntoColumn(draggedBlock.id, blockId, columnIndex);
      }
    } else if (blockType) {
      // Handle adding new blocks to columns
      console.log('Adding new block to column:', blockType, 'to', blockId, columnIndex);
      addBlockToColumn(blockType, blockId, columnIndex);
    }
    
    setDragOverColumn(null);
    setDraggedBlockId(null);
    setDraggedBlockIndex(null);
  };

  // Update a block
  const updateBlock = (id: string, updates: any) => {
    const updatedBlocks = blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    );
    onBlocksChange(updatedBlocks);
  };

  // Delete a block
  const deleteBlock = (id: string) => {
    onBlocksChange(blocks.filter(block => block.id !== id));
    setSelectedBlock(null);
  };

  // Move block up/down
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < blocks.length) {
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      onBlocksChange(newBlocks);
    }
  };

  // Render a nested block (with full editing capabilities)
  const renderNestedBlock = (block: VisualBlock, index: number, parentBlockId: string, columnIndex: number) => {
    const isSelected = selectedBlock === block.id;
    
    const updateNestedBlock = (id: string, updates: any) => {
      const updatedBlocks = blocks.map(b => {
        if (b.id === parentBlockId && b.type === 'columns') {
          const newColumns = [...b.columns];
          newColumns[columnIndex] = {
            ...newColumns[columnIndex],
            blocks: newColumns[columnIndex].blocks?.map(bl => 
              bl.id === id ? { ...bl, ...updates } : bl
            ) || []
          };
          return { ...b, columns: newColumns };
        }
        return b;
      });
      onBlocksChange(updatedBlocks);
    };

    const deleteNestedBlock = (id: string) => {
      const updatedBlocks = blocks.map(b => {
        if (b.id === parentBlockId && b.type === 'columns') {
          const newColumns = [...b.columns];
          newColumns[columnIndex] = {
            ...newColumns[columnIndex],
            blocks: newColumns[columnIndex].blocks?.filter(bl => bl.id !== id) || []
          };
          return { ...b, columns: newColumns };
        }
        return b;
      });
      onBlocksChange(updatedBlocks);
      setSelectedBlock(null);
    };

    const blockStyle = {
      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '8px',
      backgroundColor: 'var(--bg)',
      cursor: 'pointer',
      position: 'relative' as const
    };

    return (
      <div
        style={blockStyle}
        onClick={() => setSelectedBlock(block.id)}
      >
        {/* Block controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase' }}>
            {block.type}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNestedBlock(block.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px'
            }}
          >
            ×
          </button>
        </div>

        {/* Block content based on type */}
        {(() => {
          switch (block.type) {
            case 'text':
              return (
                <div>
                  {/* Rich Text Formatting Controls */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '8px', 
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--panel)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)'
                  }}>
                    {/* Font Family */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>Font:</label>
                      <select
                        value={block.formatting?.fontFamily || 'Arial, sans-serif'}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, fontFamily: e.target.value }
                        })}
                        style={{ 
                          padding: '4px 8px', 
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="Courier New, monospace">Courier New</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>Size:</label>
                      <input
                        type="number"
                        value={block.formatting?.fontSize || 16}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, fontSize: parseInt(e.target.value) || 16 }
                        })}
                        style={{ 
                          width: '60px',
                          padding: '4px 8px', 
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                        min="8"
                        max="72"
                      />
                    </div>

                    {/* Text Color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>Color:</label>
                      <input
                        type="color"
                        value={block.formatting?.color || '#000000'}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, color: e.target.value }
                        })}
                        style={{ 
                          width: '30px',
                          height: '24px',
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* Background Color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>BG:</label>
                      <input
                        type="color"
                        value={block.formatting?.backgroundColor || '#ffffff'}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, backgroundColor: e.target.value }
                        })}
                        style={{ 
                          width: '30px',
                          height: '24px',
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* Text Alignment */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>Align:</label>
                      <select
                        value={block.formatting?.textAlign || 'left'}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, textAlign: e.target.value as any }
                        })}
                        style={{ 
                          padding: '4px 8px', 
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>

                    {/* Formatting Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, bold: !block.formatting?.bold }
                        })}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: block.formatting?.bold ? 'var(--accent)' : 'var(--bg)',
                          color: block.formatting?.bold ? 'white' : 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        B
                      </button>
                      <button
                        onClick={() => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, italic: !block.formatting?.italic }
                        })}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: block.formatting?.italic ? 'var(--accent)' : 'var(--bg)',
                          color: block.formatting?.italic ? 'white' : 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontStyle: 'italic'
                        }}
                      >
                        I
                      </button>
                      <button
                        onClick={() => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, underline: !block.formatting?.underline }
                        })}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: block.formatting?.underline ? 'var(--accent)' : 'var(--bg)',
                          color: block.formatting?.underline ? 'white' : 'var(--text)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          textDecoration: 'underline'
                        }}
                      >
                        U
                      </button>
                    </div>

                    {/* Line Height */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>Line Height:</label>
                      <input
                        type="number"
                        value={block.formatting?.lineHeight || 1.5}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, lineHeight: parseFloat(e.target.value) || 1.5 }
                        })}
                        style={{ 
                          width: '60px',
                          padding: '4px 8px', 
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                        min="0.5"
                        max="3"
                        step="0.1"
                      />
                    </div>

                    {/* List Type */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500' }}>List:</label>
                      <select
                        value={block.formatting?.listType || 'none'}
                        onChange={(e) => updateNestedBlock(block.id, { 
                          formatting: { ...block.formatting, listType: e.target.value as any }
                        })}
                        style={{ 
                          padding: '4px 8px', 
                          border: '1px solid var(--border)', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value="none">None</option>
                        <option value="bullet">Bullet Points</option>
                        <option value="numbered">Numbered List</option>
                      </select>
                    </div>
                  </div>

                  {/* List formatting help text */}
                  {(block.formatting?.listType === 'bullet' || block.formatting?.listType === 'numbered') && (
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #2196f3',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#1565c0',
                      marginBottom: '12px'
                    }}>
                      Tip: Each line will become a {block.formatting.listType === 'bullet' ? 'bullet point' : 'numbered item'}. Press Enter for a new item.
                    </div>
                  )}

                  {/* Text Content with Live Preview */}
                <textarea
                  value={block.content}
                  onChange={(e) => updateNestedBlock(block.id, { content: e.target.value })}
                  onFocus={(e) => {
                    // Clear placeholder text when focused if it's empty or just placeholder
                    if (!block.content || block.content === 'Enter your text here...') {
                      updateNestedBlock(block.id, { content: '' });
                    }
                  }}
                  style={{
                    width: '100%',
                      minHeight: '120px',
                      padding: '12px',
                    border: '1px solid var(--border)',
                      borderRadius: '6px',
                      resize: 'vertical',
                      fontFamily: block.formatting?.fontFamily || 'Arial, sans-serif',
                      fontSize: `${block.formatting?.fontSize || 16}px`,
                      color: block.formatting?.color || '#000000',
                      backgroundColor: block.formatting?.backgroundColor || 'transparent',
                      fontWeight: block.formatting?.bold ? 'bold' : 'normal',
                      fontStyle: block.formatting?.italic ? 'italic' : 'normal',
                      textDecoration: block.formatting?.underline ? 'underline' : 'none',
                      textAlign: block.formatting?.textAlign || 'left',
                      lineHeight: block.formatting?.lineHeight || 1.5
                  }}
                  placeholder={
                    block.formatting?.listType === 'bullet' ? "Enter each bullet point on a new line:\nFirst item\nSecond item\nThird item" :
                    block.formatting?.listType === 'numbered' ? "Enter each numbered item on a new line:\nFirst item\nSecond item\nThird item" :
                    "Enter your text here..."
                  }
                />

                  {/* Live Preview */}
                  <div style={{ 
                    marginTop: '12px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg)'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '500', 
                      marginBottom: '8px',
                      color: 'var(--muted)'
                    }}>
                      Live Preview:
                    </div>
                    <div
                      style={{
                        fontFamily: block.formatting?.fontFamily || 'Arial, sans-serif',
                        fontSize: `${block.formatting?.fontSize || 16}px`,
                        color: block.formatting?.color || '#000000',
                        backgroundColor: block.formatting?.backgroundColor || 'transparent',
                        fontWeight: block.formatting?.bold ? 'bold' : 'normal',
                        fontStyle: block.formatting?.italic ? 'italic' : 'normal',
                        textDecoration: block.formatting?.underline ? 'underline' : 'none',
                        textAlign: block.formatting?.textAlign || 'left',
                        lineHeight: block.formatting?.lineHeight || 1.5,
                        minHeight: '40px',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {block.content || 'Preview will appear here...'}
                    </div>
                  </div>
                </div>
              );

            case 'heading':
              return (
                <div>
                  <select
                    value={block.level}
                    onChange={(e) => updateNestedBlock(block.id, { level: parseInt(e.target.value) })}
                    style={{ marginBottom: '8px', padding: '4px' }}
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                    <option value={4}>H4</option>
                    <option value={5}>H5</option>
                    <option value={6}>H6</option>
                  </select>
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => updateNestedBlock(block.id, { content: e.target.value })}
                    onFocus={(e) => {
                      // Clear placeholder text when focused if it's empty or just placeholder
                      if (!block.content || block.content === 'Enter heading text...') {
                        updateNestedBlock(block.id, { content: '' });
                      }
                    }}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                    placeholder="Enter heading text..."
                  />
                </div>
              );

            case 'image':
              const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                  alert('Please select an image file');
                  return;
                }

                if (file.size > 5 * 1024 * 1024) {
                  alert('Image file must be smaller than 5MB');
                  return;
                }

                try {
                  const formData = new FormData();
                  formData.append('image', file);

                  const response = await api.post('/uploads/image', formData, {
                    headers: {
                      'Content-Type': 'multipart/form-data',
                    },
                  });

                  updateNestedBlock(block.id, { url: response.data.url });
                } catch (error) {
                  console.error('Upload error:', error);
                  alert('Failed to upload image. Please try again.');
                }
              };

              return (
                <div>
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={block.url}
                    onChange={(e) => updateNestedBlock(block.id, { url: e.target.value })}
                    style={{ width: '100%', marginBottom: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="Alt text"
                    value={block.alt}
                    onChange={(e) => updateNestedBlock(block.id, { alt: e.target.value })}
                    style={{ width: '100%', marginBottom: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  {block.url && (
                    <img
                      src={block.url}
                      alt={block.alt}
                      style={{
                        width: `${block.width || 100}%`,
                        height: 'auto',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
              );

            case 'video':
              return (
                <div>
                  <input
                    type="text"
                    placeholder="Video URL (YouTube or direct link)"
                    value={block.url}
                    onChange={(e) => updateNestedBlock(block.id, { url: e.target.value })}
                    style={{ width: '100%', marginBottom: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  {block.url && (
                    <div style={{ textAlign: 'center' }}>
                      {block.url.includes('youtube.com') || block.url.includes('youtu.be') ? (
                        <div style={{ position: 'relative', width: '100%', height: 0, paddingBottom: '56.25%' }}>
                          <iframe
                            width="100%"
                            height="100%"
                            src={block.url.replace('watch?v=', 'embed/')}
                            title="YouTube video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ 
                              position: 'absolute', 
                              top: 0, 
                              left: 0, 
                              width: '100%', 
                              height: '100%',
                              borderRadius: '8px' 
                            }}
                          />
                        </div>
                      ) : (
                        <video
                          src={block.url}
                          controls
                          style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );

            default:
              return <div>Unsupported block type: {block.type}</div>;
          }
        })()}
      </div>
    );
  };

  // Render a block in preview mode (like lesson viewer)
  const renderPreviewBlock = (block: VisualBlock) => {
    switch (block.type) {
      case 'text':
        const renderTextWithLinks = (content: string, links: any[] = [], listType?: 'none' | 'bullet' | 'numbered') => {
          if (!content) return '';
          
          let formatted = content;
          
          // Handle list formatting
          if (listType === 'bullet' || listType === 'numbered') {
            // Split by line breaks to create list items
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length > 0) {
              const listTag = listType === 'numbered' ? 'ol' : 'ul';
              const listItems = lines.map(line => `<li>${line.trim()}</li>`).join('');
              formatted = `<${listTag}>${listItems}</${listTag}>`;
            }
          } else {
            // Regular text formatting - convert line breaks to <br> tags
            formatted = content.replace(/\n/g, '<br>');
          }
          
          // Process links if any
          if (links && links.length > 0 && listType !== 'bullet' && listType !== 'numbered') {
            let result = formatted;
            let offset = 0;
            
            links.forEach(link => {
              const beforeLink = result.substring(0, link.start + offset);
              const afterLink = result.substring(link.end + offset);
              const linkElement = `<a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: underline;">${link.text}</a>`;
              result = beforeLink + linkElement + afterLink;
              offset += linkElement.length - link.text.length;
            });
            
            return result;
          }
          
          return formatted;
        };

        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div 
              style={{
                fontFamily: block.formatting?.fontFamily || 'Arial, sans-serif',
                fontSize: `${block.formatting?.fontSize || 16}px`,
                color: block.formatting?.color || '#000000',
                backgroundColor: block.formatting?.backgroundColor || 'transparent',
                fontWeight: block.formatting?.bold ? 'bold' : 'normal',
                fontStyle: block.formatting?.italic ? 'italic' : 'normal',
                textDecoration: block.formatting?.underline ? 'underline' : 'none',
                textAlign: block.formatting?.textAlign || 'left',
                lineHeight: block.formatting?.lineHeight || 1.5,
                whiteSpace: block.formatting?.listType === 'bullet' || block.formatting?.listType === 'numbered' ? 'normal' : 'pre-wrap'
              }}
              dangerouslySetInnerHTML={{ 
                __html: renderTextWithLinks(block.content, block.links, block.formatting?.listType) 
              }}
            />
          </div>
        );
      
      case 'heading':
        const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <HeadingTag 
              style={{ 
                fontSize: block.size === 'small' ? '1.2em' : block.size === 'large' ? '2.5em' : '1.8em',
                margin: '16px 0 8px 0',
                fontWeight: 'bold'
              }}
              dangerouslySetInnerHTML={{ __html: block.content.replace(/\n/g, '<br>') }}
            />
          </div>
        );
      
      case 'image':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            {block.url && (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={block.url} 
                  alt={block.alt || 'Image'} 
                  style={{ 
                    maxWidth: '100%', 
                    height: 'auto',
                    borderRadius: '8px',
                    width: block.width ? `${block.width}%` : '100%'
                  }} 
                />
                {block.caption && (
                  <div style={{ 
                    fontSize: '0.9em', 
                    color: 'var(--muted)', 
                    marginTop: '8px',
                    fontStyle: 'italic'
                  }}>
                    {block.caption}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      case 'video':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            {block.url && (
              <div style={{ textAlign: 'center' }}>
                {block.url.includes('youtube.com') || block.url.includes('youtu.be') ? (
                  <div style={{ position: 'relative', width: '100%', height: 0, paddingBottom: '56.25%', maxWidth: '560px', margin: '0 auto' }}>
                    <iframe
                      width="100%"
                      height="100%"
                      src={block.url.replace('watch?v=', 'embed/')}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '8px' 
                      }}
                    />
                  </div>
                ) : (
                  <video
                    src={block.url}
                    controls
                    style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                  />
                )}
              </div>
            )}
          </div>
        );
      
      case 'columns':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              display: 'flex', 
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              {block.columns.map((column, colIndex) => (
                <div 
                  key={colIndex} 
                  style={{ 
                    flex: `0 0 ${column.width}%`,
                    minWidth: '200px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--panel)'
                  }}
                >
                  {/* Render nested blocks in this column */}
                  {column.blocks && column.blocks.length > 0 ? (
                    column.blocks.map((colBlock, colBlockIndex) => (
                      <div key={colBlockIndex} style={{ marginBottom: '12px' }}>
                        {(() => {
                          switch (colBlock.type) {
                            case 'text':
                              return (
                                <div 
                                  style={{
                                    fontFamily: colBlock.formatting?.fontFamily || 'Arial, sans-serif',
                                    fontSize: colBlock.formatting?.fontSize ? `${colBlock.formatting.fontSize}px` : '1em',
                                    color: colBlock.formatting?.color || '#000000',
                                    backgroundColor: colBlock.formatting?.backgroundColor || 'transparent',
                                    fontWeight: colBlock.formatting?.bold ? 'bold' : 'normal',
                                    fontStyle: colBlock.formatting?.italic ? 'italic' : 'normal',
                                    textDecoration: colBlock.formatting?.underline ? 'underline' : 'none',
                                    textAlign: colBlock.formatting?.textAlign || 'left',
                                    lineHeight: colBlock.formatting?.lineHeight || 1.5,
                                    whiteSpace: colBlock.formatting?.listType === 'bullet' || colBlock.formatting?.listType === 'numbered' ? 'normal' : 'pre-wrap'
                                  }}
                                  dangerouslySetInnerHTML={{ 
                                    __html: (() => {
                                      const listType = colBlock.formatting?.listType;
                                      let formatted = colBlock.content;
                                      
                                      // Handle list formatting
                                      if (listType === 'bullet' || listType === 'numbered') {
                                        const lines = colBlock.content.split('\n').filter(line => line.trim());
                                        if (lines.length > 0) {
                                          const listTag = listType === 'numbered' ? 'ol' : 'ul';
                                          const listItems = lines.map(line => `<li>${line.trim()}</li>`).join('');
                                          return `<${listTag}>${listItems}</${listTag}>`;
                                        }
                                      }
                                      
                                      // Handle links for non-list content
                                      if (!colBlock.links?.length) return formatted.replace(/\n/g, '<br>');
                                      
                                      let result = formatted;
                                      let offset = 0;
                                      
                                      colBlock.links.forEach(link => {
                                        const beforeLink = result.substring(0, link.start + offset);
                                        const afterLink = result.substring(link.end + offset);
                                        const linkElement = `<a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: underline;">${link.text}</a>`;
                                        result = beforeLink + linkElement + afterLink;
                                        offset += linkElement.length - link.text.length;
                                      });
                                      
                                      return result;
                                    })()
                                  }}
                                />
                              );
                            case 'heading':
                              const HeadingTag = `h${colBlock.level}` as keyof JSX.IntrinsicElements;
                              return (
                                <HeadingTag style={{ 
                                  fontSize: colBlock.size === 'small' ? '1.2em' : colBlock.size === 'large' ? '2em' : '1.5em',
                                  margin: '8px 0 4px 0',
                                  fontWeight: 'bold'
                                }}>
                                  {colBlock.content}
                                </HeadingTag>
                              );
                            case 'image':
                              return (
                                <div style={{ textAlign: 'center' }}>
                                  {colBlock.url && (
                                    <img 
                                      src={colBlock.url} 
                                      alt={colBlock.alt || 'Image'} 
                                      style={{ 
                                        maxWidth: '100%', 
                                        height: 'auto',
                                        borderRadius: '8px',
                                        width: colBlock.width ? `${colBlock.width}%` : '100%'
                                      }} 
                                    />
                                  )}
                                  {colBlock.caption && (
                                    <div style={{ 
                                      fontSize: '0.9em', 
                                      color: 'var(--muted)', 
                                      marginTop: '8px',
                                      fontStyle: 'italic'
                                    }}>
                                      {colBlock.caption}
                                    </div>
                                  )}
                                </div>
                              );
                            case 'video':
                              return (
                                <div style={{ textAlign: 'center' }}>
                                  {colBlock.url && (
                                    <>
                                      {colBlock.url.includes('youtube.com') || colBlock.url.includes('youtu.be') ? (
                                        <div style={{ position: 'relative', width: '100%', height: 0, paddingBottom: '56.25%' }}>
                                          <iframe
                                            width="100%"
                                            height="100%"
                                            src={colBlock.url.replace('watch?v=', 'embed/')}
                                            title="YouTube video"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            style={{ 
                                              position: 'absolute', 
                                              top: 0, 
                                              left: 0, 
                                              width: '100%', 
                                              height: '100%',
                                              borderRadius: '8px' 
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <video 
                                          src={colBlock.url} 
                                          controls 
                                          style={{ 
                                            width: '100%', 
                                            maxWidth: '100%', 
                                            height: 'auto',
                                            borderRadius: '8px'
                                          }} 
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            default:
                              return <div>Unsupported block type</div>;
                          }
                        })()}
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      color: 'var(--muted)', 
                      fontStyle: 'italic',
                      textAlign: 'center',
                      padding: '20px'
                    }}>
                      Empty column
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'spacer':
        return <div style={{ height: block.height, margin: '8px 0' }} />;
      
      case 'divider':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <hr style={{ 
              border: 'none', 
              borderTop: `2px ${block.style || 'solid'} var(--border)`,
              margin: '16px 0'
            }} />
          </div>
        );
      
      case 'quiz':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <h4 style={{ margin: '0 0 12px 0' }}>{block.question}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {block.options.map((option, optionIndex) => (
                  <label key={optionIndex} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    cursor: 'pointer'
                  }}>
                    <input type="radio" name={`quiz-${block.id}`} disabled />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'fillblank':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <p>{block.prompt}</p>
              <input 
                type="text" 
                placeholder="Your answer..." 
                disabled 
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)'
                }} 
              />
            </div>
          </div>
        );

      case 'documents':
        const formatFileSize = (bytes: number) => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const getFileIcon = (type: string) => {
          if (type.includes('pdf')) return '📄';
          if (type.includes('word') || type.includes('document')) return '📝';
          if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
          if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
          if (type.includes('image')) return '🖼️';
          if (type.includes('video')) return '🎥';
          if (type.includes('audio')) return '🎵';
          if (type.includes('zip') || type.includes('rar')) return '🗜️';
          return '📁';
        };

        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '20px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: '1.2em',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📁 {block.title}
              </h3>
              
              {block.documents.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--muted)',
                  fontStyle: 'italic',
                  padding: '20px'
                }}>
                  No documents uploaded yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {block.documents.map((doc) => (
                    <div key={doc.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span style={{ fontSize: '20px' }}>{getFileIcon(doc.type)}</span>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text)' }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {formatFileSize(doc.size)} • {doc.type}
                          </div>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        download={doc.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent-dark)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        📥 Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return <div className="card" style={{ margin: '8px 0' }}>Unsupported block type</div>;
    }
  };

  // Render a block
  const renderBlock = (block: VisualBlock, index: number, parentId?: string) => {
    const isSelected = selectedBlock === block.id;
    
    // In preview mode, render like the lesson viewer
    if (isPreviewMode) {
      return renderPreviewBlock(block);
    }
    
    const blockStyle = {
      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      backgroundColor: isSelected ? 'var(--panel)' : 'var(--bg)',
      cursor: 'pointer',
      position: 'relative' as const,
      minHeight: '40px',
    };

    const renderContent = () => {
      switch (block.type) {
        case 'heading':
          const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return (
            <HeadingTag 
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateBlock(block.id, { content: e.target.textContent || '' })}
              style={{ 
                fontSize: block.size === 'small' ? '1.2em' : block.size === 'large' ? '2.5em' : '1.8em',
                margin: 0,
                outline: 'none'
              }}
            >
              {block.content}
            </HeadingTag>
          );

        case 'text':
          return (
            <div>
              {/* Rich Text Formatting Controls - Only show when selected */}
              {isSelected && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: 'var(--panel)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)'
                }}>
                  {/* Font Family */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>Font:</label>
                    <select
                      value={block.formatting?.fontFamily || 'Arial, sans-serif'}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, fontFamily: e.target.value }
                      })}
                      style={{ 
                        padding: '4px 8px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value="Courier New, monospace">Courier New</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>Size:</label>
                    <input
                      type="number"
                      value={block.formatting?.fontSize || 16}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, fontSize: parseInt(e.target.value) || 16 }
                      })}
                      style={{ 
                        width: '60px',
                        padding: '4px 8px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                      min="8"
                      max="72"
                    />
                  </div>

                  {/* Text Color */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>Color:</label>
                    <input
                      type="color"
                      value={block.formatting?.color || '#000000'}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, color: e.target.value }
                      })}
                      style={{ 
                        width: '30px',
                        height: '24px',
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* Background Color */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>BG:</label>
                    <input
                      type="color"
                      value={block.formatting?.backgroundColor || '#ffffff'}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, backgroundColor: e.target.value }
                      })}
                      style={{ 
                        width: '30px',
                        height: '24px',
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* Text Alignment */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>Align:</label>
                    <select
                      value={block.formatting?.textAlign || 'left'}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, textAlign: e.target.value as any }
                      })}
                      style={{ 
                        padding: '4px 8px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justify</option>
                    </select>
                  </div>

                  {/* Formatting Buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => updateBlock(block.id, { 
                        formatting: { ...block.formatting, bold: !block.formatting?.bold }
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: block.formatting?.bold ? 'var(--accent)' : 'var(--bg)',
                        color: block.formatting?.bold ? 'white' : 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      B
                    </button>
                    <button
                      onClick={() => updateBlock(block.id, { 
                        formatting: { ...block.formatting, italic: !block.formatting?.italic }
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: block.formatting?.italic ? 'var(--accent)' : 'var(--bg)',
                        color: block.formatting?.italic ? 'white' : 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontStyle: 'italic'
                      }}
                    >
                      I
                    </button>
                    <button
                      onClick={() => updateBlock(block.id, { 
                        formatting: { ...block.formatting, underline: !block.formatting?.underline }
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: block.formatting?.underline ? 'var(--accent)' : 'var(--bg)',
                        color: block.formatting?.underline ? 'white' : 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textDecoration: 'underline'
                      }}
                    >
                      U
                    </button>
                    <button
                      onClick={() => {
                        setCurrentTextBlock(block.id);
                        setLinkData({ text: '', url: '' });
                        setShowLinkModal(true);
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      🔗
                    </button>
                  </div>

                  {/* Line Height */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500' }}>Line Height:</label>
                    <input
                      type="number"
                      value={block.formatting?.lineHeight || 1.5}
                      onChange={(e) => updateBlock(block.id, { 
                        formatting: { ...block.formatting, lineHeight: parseFloat(e.target.value) || 1.5 }
                      })}
                      style={{ 
                        width: '60px',
                        padding: '4px 8px', 
                        border: '1px solid var(--border)', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                      min="0.5"
                      max="3"
                      step="0.1"
                    />
                  </div>
                </div>
              )}

              {/* Text Content */}
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateBlock(block.id, { content: e.target.textContent || '' })}
              style={{ 
                  fontFamily: block.formatting?.fontFamily || 'Arial, sans-serif',
                  fontSize: block.formatting?.fontSize ? `${block.formatting.fontSize}px` : (block.size === 'small' ? '0.9em' : block.size === 'large' ? '1.2em' : '1em'),
                  color: block.formatting?.color || '#000000',
                  backgroundColor: block.formatting?.backgroundColor || 'transparent',
                  fontWeight: block.formatting?.bold ? 'bold' : 'normal',
                  fontStyle: block.formatting?.italic ? 'italic' : 'normal',
                  textDecoration: block.formatting?.underline ? 'underline' : 'none',
                  textAlign: block.formatting?.textAlign || 'left',
                  lineHeight: block.formatting?.lineHeight || 1.6,
                outline: 'none',
                  minHeight: '20px',
                  whiteSpace: 'pre-wrap'
                }}
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    if (!block.links?.length) return block.content;
                    
                    let result = block.content;
                    let offset = 0;
                    
                    block.links.forEach(link => {
                      const beforeLink = result.substring(0, link.start + offset);
                      const afterLink = result.substring(link.end + offset);
                      const linkElement = `<a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; text-decoration: underline;">${link.text}</a>`;
                      result = beforeLink + linkElement + afterLink;
                      offset += linkElement.length - link.text.length;
                    });
                    
                    return result;
                  })()
                }}
              />
            </div>
          );

        case 'image':
          const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
              alert('Please select an image file');
              return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
              alert('Image file must be smaller than 5MB');
              return;
            }

            try {
              const formData = new FormData();
              formData.append('image', file);

              const response = await api.post('/uploads/image', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              });

              updateBlock(block.id, { url: response.data.url });
            } catch (error) {
              console.error('Upload error:', error);
              alert('Failed to upload image. Please try again.');
            }
          };

          const handleResize = (direction: string, deltaX: number, deltaY: number) => {
            const currentWidth = block.width || 100;
            
            let newWidth = currentWidth;
            
            // Only resize width, let height scale naturally
            if (direction.includes('right')) {
              newWidth = Math.max(20, Math.min(100, currentWidth + (deltaX / 5)));
            } else if (direction.includes('left')) {
              newWidth = Math.max(20, Math.min(100, currentWidth - (deltaX / 5)));
            }
            
            updateBlock(block.id, { width: newWidth });
          };

          return (
            <div style={{ textAlign: 'center', position: 'relative', display: 'inline-block' }}>
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Image URL"
                  value={block.url}
                  onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  placeholder="Alt text"
                  value={block.alt}
                  onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={block.caption || ''}
                  onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ width: '100%', marginBottom: '8px' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  You can either enter an image URL above or upload an image file from your computer.
                </div>
              </div>
              {block.url && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={block.url}
                    alt={block.alt}
                    style={{
                      width: `${block.width || 100}%`,
                      height: 'auto',
                      borderRadius: '8px',
                      border: '1px solid var(--border)'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const errorDiv = document.createElement('div');
                      errorDiv.textContent = 'Failed to load image';
                      errorDiv.style.color = '#666';
                      errorDiv.style.fontStyle = 'italic';
                      (e.target as HTMLImageElement).parentNode?.appendChild(errorDiv);
                    }}
                  />
                  
                  {/* Resize handles */}
                  {isSelected && (
                    <>
                      {/* Corner handles */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          left: '-5px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: 'var(--accent)',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'nw-resize',
                          zIndex: 10
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          
                          const handleMouseMove = (e: MouseEvent) => {
                            const deltaX = e.clientX - startX;
                            const deltaY = e.clientY - startY;
                            handleResize('top-left', deltaX, deltaY);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: 'var(--accent)',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'ne-resize',
                          zIndex: 10
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          
                          const handleMouseMove = (e: MouseEvent) => {
                            const deltaX = e.clientX - startX;
                            const deltaY = e.clientY - startY;
                            handleResize('top-right', deltaX, deltaY);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-5px',
                          left: '-5px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: 'var(--accent)',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'sw-resize',
                          zIndex: 10
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          
                          const handleMouseMove = (e: MouseEvent) => {
                            const deltaX = e.clientX - startX;
                            const deltaY = e.clientY - startY;
                            handleResize('bottom-left', deltaX, deltaY);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-5px',
                          right: '-5px',
                          width: '10px',
                          height: '10px',
                          backgroundColor: 'var(--accent)',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'se-resize',
                          zIndex: 10
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          
                          const handleMouseMove = (e: MouseEvent) => {
                            const deltaX = e.clientX - startX;
                            const deltaY = e.clientY - startY;
                            handleResize('bottom-right', deltaX, deltaY);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      />
                    </>
                  )}
                </div>
              )}
              {block.caption && (
                <div style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--muted)', fontStyle: 'italic' }}>
                  {block.caption}
                </div>
              )}
            </div>
          );

        case 'video':
          return (
            <div>
              <input
                type="text"
                placeholder="Video URL (YouTube or direct link)"
                value={block.url}
                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              {block.url && (
                <div style={{ textAlign: 'center' }}>
                  {block.url.includes('youtube.com') || block.url.includes('youtu.be') ? (
                    <div style={{ position: 'relative', width: '100%', height: 0, paddingBottom: '56.25%', maxWidth: '560px', margin: '0 auto' }}>
                      <iframe
                        width="100%"
                        height="100%"
                        src={block.url.replace('watch?v=', 'embed/')}
                        title="YouTube video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%',
                          borderRadius: '8px' 
                        }}
                      />
                    </div>
                  ) : (
                    <video
                      src={block.url}
                      controls
                      style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                    />
                  )}
                </div>
              )}
            </div>
          );

        case 'columns':
          return (
            <div>
              <div style={{ marginBottom: '8px' }}>
                <label>Number of columns:</label>
                <select
                  value={block.columns.length}
                  onChange={(e) => {
                    const newCount = parseInt(e.target.value);
                    const newColumns = [];
                    for (let i = 0; i < newCount; i++) {
                      newColumns.push({
                        id: generateId(),
                        content: block.columns[i]?.content || `Column ${i + 1} content`,
                        width: Math.floor(100 / newCount),
                        blocks: block.columns[i]?.blocks || []
                      });
                    }
                    updateBlock(block.id, { columns: newColumns });
                  }}
                  style={{ marginLeft: '8px', padding: '4px' }}
                >
                  <option value={2}>2 columns</option>
                  <option value={3}>3 columns</option>
                  <option value={4}>4 columns</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {block.columns.map((column, colIndex) => (
                  <div
                    key={column.id}
                    data-column-id={`${block.id}-${colIndex}`}
                    style={{ 
                      flex: column.width,
                      minHeight: '100px',
                      border: dragOverColumn === `${block.id}-${colIndex}` ? '2px solid var(--accent)' : '1px dashed var(--border)',
                      borderRadius: '4px',
                      padding: '12px',
                      backgroundColor: dragOverColumn === `${block.id}-${colIndex}` ? 'var(--accent-light)' : 'var(--panel)',
                      transition: 'all 0.2s ease'
                    }}
                    onDragOver={(e) => handleColumnDragOver(e, block.id, colIndex)}
                    onDragEnter={(e) => handleColumnDragEnter(e, block.id, colIndex)}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={(e) => {
                      console.log('Column drop event fired!', block.id, colIndex);
                      handleColumnDrop(e, block.id, colIndex);
                    }}
                  >
                    <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                      Column {colIndex + 1} ({column.width}%)
                    </div>
                    
                    {/* Nested blocks in this column */}
                    {column.blocks && column.blocks.length > 0 ? (
                      column.blocks.map((colBlock, colBlockIndex) => (
                        <div 
                          key={colBlock.id} 
                          style={{ marginBottom: '8px', position: 'relative' }}
                          draggable
                          onDragStart={(e) => {
                            console.log('Nested block drag start:', colBlock.id, 'parent:', block.id, 'column:', colIndex);
                            e.dataTransfer.setData('application/json', JSON.stringify({ 
                              id: colBlock.id, 
                              index: colBlockIndex,
                              parentId: block.id,
                              columnIndex: colIndex,
                              isNested: true
                            }));
                            e.dataTransfer.effectAllowed = 'move';
                            e.stopPropagation(); // Prevent event bubbling
                          }}
                          onDragEnd={(e) => {
                            console.log('Nested block drag end');
                          }}
                        >
                          {renderNestedBlock(colBlock, colBlockIndex, block.id, colIndex)}
                        </div>
                      ))
                    ) : (
                      <div style={{ 
                        color: 'var(--muted)', 
                        fontStyle: 'italic',
                        textAlign: 'center',
                        padding: '20px',
                        border: '1px dashed var(--border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg)'
                      }}>
                        Drop blocks here or click + Add Block
                      </div>
                    )}
                    
                    {/* Add block button for this column */}
                    <div style={{ marginTop: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          const newBlock = createBlock('text');
                          const newColumns = [...block.columns];
                          newColumns[colIndex] = {
                            ...column,
                            blocks: [...(column.blocks || []), newBlock]
                          };
                          updateBlock(block.id, { columns: newColumns });
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        + Add Block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

        case 'spacer':
          return (
            <div style={{ height: `${block.height}px`, backgroundColor: 'var(--border)', borderRadius: '4px' }}>
              <div style={{ textAlign: 'center', padding: '8px', color: 'var(--muted)' }}>
                Spacer ({block.height}px)
              </div>
            </div>
          );

        case 'divider':
          return (
            <hr style={{ 
              border: 'none',
              borderTop: `2px ${block.style || 'solid'} var(--border)`,
              margin: '20px 0'
            }} />
          );

        case 'quiz':
          return (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Question"
                  value={block.question}
                  onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                  onFocus={(e) => {
                    // Clear placeholder text when focused if it's empty or just placeholder
                    if (!block.question || block.question === 'Question') {
                      updateBlock(block.id, { question: '' });
                    }
                  }}
                  style={{ width: '100%', marginBottom: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
                <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--muted)' }}>
                  Select the correct answer:
                </div>
                {block.options.map((option, optIndex) => (
                  <div key={optIndex} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '8px',
                    padding: '8px',
                    border: optIndex === block.answerIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: optIndex === block.answerIndex ? 'var(--accent-light)' : 'var(--bg)',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="radio"
                      name={`quiz-${block.id}`}
                      checked={optIndex === block.answerIndex}
                      onChange={() => {
                        console.log('Setting answer index to:', optIndex);
                        updateBlock(block.id, { answerIndex: optIndex });
                      }}
                      style={{ 
                        marginRight: '12px',
                        transform: 'scale(1.2)',
                        cursor: 'pointer'
                      }}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...block.options];
                        newOptions[optIndex] = e.target.value;
                        updateBlock(block.id, { options: newOptions });
                      }}
                      onFocus={(e) => {
                        // Clear placeholder text when focused if it's empty or just placeholder
                        if (!option || option === `Option ${optIndex + 1}`) {
                          const newOptions = [...block.options];
                          newOptions[optIndex] = '';
                          updateBlock(block.id, { options: newOptions });
                        }
                      }}
                      style={{ 
                        flex: 1, 
                        padding: '6px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg)'
                      }}
                      placeholder={`Option ${optIndex + 1}`}
                    />
                    {optIndex === block.answerIndex && (
                      <span style={{ 
                        marginLeft: '8px', 
                        color: 'var(--accent)', 
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        ✓ Correct
                      </span>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => {
                    const newOptions = [...block.options, 'New Option'];
                    updateBlock(block.id, { options: newOptions });
                  }}
                    style={{ 
                      padding: '6px 12px',
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                >
                  + Add Option
                </button>
                  {block.options.length > 2 && (
                    <button
                      onClick={() => {
                        const newOptions = block.options.slice(0, -1);
                        const newAnswerIndex = block.answerIndex >= newOptions.length ? newOptions.length - 1 : block.answerIndex;
                        updateBlock(block.id, { options: newOptions, answerIndex: newAnswerIndex });
                      }}
                      style={{ 
                        padding: '6px 12px',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      - Remove Last Option
                    </button>
                  )}
                </div>
              </div>
            </div>
          );

        case 'fillblank':
          return (
            <div>
              <input
                type="text"
                placeholder="Prompt (e.g., 'Complete the sentence: The capital of France is _____')"
                value={block.prompt}
                onChange={(e) => updateBlock(block.id, { prompt: e.target.value })}
                onFocus={(e) => {
                  // Clear placeholder text when focused if it's empty or just placeholder
                  if (!block.prompt || block.prompt === "Prompt (e.g., 'Complete the sentence: The capital of France is _____')") {
                    updateBlock(block.id, { prompt: '' });
                  }
                }}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <input
                type="text"
                placeholder="Answer"
                value={block.answer}
                onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                onFocus={(e) => {
                  // Clear placeholder text when focused if it's empty or just placeholder
                  if (!block.answer || block.answer === 'Answer') {
                    updateBlock(block.id, { answer: '' });
                  }
                }}
                style={{ width: '100%' }}
              />
            </div>
          );

        case 'documents':
          const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;

            const uploadPromises = Array.from(files).map(async (file) => {
              try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await api.post('/uploads/document', formData, {
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                });

                return {
                  id: generateId(),
                  name: file.name,
                  url: response.data.url,
                  size: file.size,
                  type: file.type
                };
              } catch (error) {
                console.error('Upload error:', error);
                alert(`Failed to upload ${file.name}. Please try again.`);
                return null;
              }
            });

            const uploadedDocs = (await Promise.all(uploadPromises)).filter(doc => doc !== null);
            if (uploadedDocs.length > 0) {
              updateBlock(block.id, {
                documents: [...block.documents, ...uploadedDocs]
              });
            }
          };

          const removeDocument = (docId: string) => {
            updateBlock(block.id, {
              documents: block.documents.filter(doc => doc.id !== docId)
            });
          };

          const formatFileSize = (bytes: number) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
          };

          const getFileIcon = (type: string) => {
            if (type.includes('pdf')) return '📄';
            if (type.includes('word') || type.includes('document')) return '📝';
            if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
            if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
            if (type.includes('image')) return '🖼️';
            if (type.includes('video')) return '🎥';
            if (type.includes('audio')) return '🎵';
            if (type.includes('zip') || type.includes('rar')) return '🗜️';
            return '📁';
          };

          return (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Documents section title"
                  value={block.title}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '1px solid var(--border)', 
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.wav"
                  onChange={handleDocumentUpload}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '2px dashed var(--border)', 
                    borderRadius: '6px',
                    backgroundColor: 'var(--panel)',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--muted)', 
                  marginTop: '4px',
                  textAlign: 'center'
                }}>
                  📁 Click to upload multiple documents (PDF, Word, Excel, PowerPoint, images, videos, etc.)
                </div>
              </div>

              {block.documents.length > 0 && (
                <div style={{ 
                  border: '1px solid var(--border)', 
                  borderRadius: '6px',
                  backgroundColor: 'var(--panel)',
                  padding: '12px'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '12px',
                    color: 'var(--text)'
                  }}>
                    Uploaded Documents ({block.documents.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {block.documents.map((doc) => (
                      <div key={doc.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span style={{ fontSize: '16px' }}>{getFileIcon(doc.type)}</span>
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '14px' }}>{doc.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {formatFileSize(doc.size)} • {doc.type}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeDocument(doc.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#e53e3e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

        default:
          return <div>Unknown block type</div>;
      }
    };

    return (
      <div
        style={blockStyle}
        onClick={() => setSelectedBlock(block.id)}
      >
        {renderContent()}
        
        {/* Block controls */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            display: 'flex',
            gap: '4px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(block.id);
              }}
              style={{
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                opacity: 0.7
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.backgroundColor = '#c53030';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = '#e53e3e';
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Block Palette */}
      <div style={{
        width: '250px',
        backgroundColor: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>Blocks</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {blockPalette.map((item) => (
            <div
              key={item.type}
              onClick={() => addBlock(item.type)}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              style={{
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'grab',
                backgroundColor: 'var(--bg)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--bg)';
                e.currentTarget.style.cursor = 'grab';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg)';
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.cursor = 'grab';
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: '600' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--panel)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              style={{
                padding: '8px 16px',
                backgroundColor: isPreviewMode ? 'var(--accent)' : 'var(--border)',
                color: isPreviewMode ? 'var(--bg)' : 'var(--text)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
            </button>
          </div>
          
        </div>

        {/* Content Area */}
        <div 
          style={{
            flex: 1,
            padding: '20px',
            paddingBottom: '100px', // Add extra padding at bottom for drag targets
            overflowY: 'auto',
            backgroundColor: isPreviewMode ? 'var(--bg)' : '#f8f9fa',
            minHeight: '400px'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            console.log('Main editor drop event fired!');
            handleDrop(e);
          }}
        >
          {blocks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--muted)',
              border: '2px dashed var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <h3>Start building your lesson</h3>
              <p>Drag blocks from the left panel to create your content</p>
            </div>
          ) : (
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
              {blocks.map((block, index) => (
                <div key={block.id} data-block-id={block.id}>
                  {/* Drop indicator line */}
                  {dragOverIndex === index && (
                    <div style={{
                      height: '2px',
                      backgroundColor: 'var(--accent)',
                      margin: '8px 0',
                      borderRadius: '1px',
                      boxShadow: '0 0 4px var(--accent)'
                    }} />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      console.log('Drag start event triggered for block:', block.id);
                      handleBlockDragStart(e, block.id, index);
                    }}
                    onDragEnd={(e) => {
                      console.log('Drag end event triggered');
                      console.log('Drag end - dragOverColumn:', dragOverColumn);
                      console.log('Drag end - dropEffect:', e.dataTransfer.dropEffect);
                      console.log('Drag end - effectAllowed:', e.dataTransfer.effectAllowed);
                      
                      // If we were dragging over a column, manually trigger the drop
                      if (dragOverColumn) {
                        console.log('Drag ended over column, manually triggering drop');
                        const [blockId, columnIndexStr] = dragOverColumn.split('-');
                        const columnIndex = parseInt(columnIndexStr);
                        
                        // Create a synthetic drop event
                        const syntheticEvent = {
                          ...e,
                          preventDefault: () => {},
                          stopPropagation: () => {},
                          stopImmediatePropagation: () => {},
                          dataTransfer: e.dataTransfer
                        } as React.DragEvent;
                        
                        handleColumnDrop(syntheticEvent, blockId, columnIndex);
                      }
                      
                      setDraggedBlockId(null);
                      setDraggedBlockIndex(null);
                      setDragOverColumn(null);
                    }}
                    style={{
                      cursor: 'grab',
                      position: 'relative'
                    }}
                  >
                    {renderBlock(block, index)}
                  </div>
                </div>
              ))}
              {/* Drop indicator at the end */}
              {dragOverIndex === blocks.length && (
                <div style={{
                  height: '2px',
                  backgroundColor: 'var(--accent)',
                  margin: '8px 0',
                  borderRadius: '1px',
                  boxShadow: '0 0 4px var(--accent)'
                }} />
              )}
              
              {/* Bottom drop zone indicator when dragging */}
              {blocks.length > 0 && (
                <div style={{
                  height: '60px',
                  border: '2px dashed var(--border)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: '14px',
                  marginTop: '20px',
                  backgroundColor: 'var(--panel)',
                  opacity: 0.7,
                  transition: 'all 0.2s ease'
                }}>
                  Drop blocks here to add to the end
            </div>
          )}
        </div>
          )}
      </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--panel)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            minWidth: '400px',
            maxWidth: '500px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: '1.2em',
              color: 'var(--text)'
            }}>
              Add Hyperlink
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                Link Text:
              </label>
              <input
                type="text"
                value={linkData.text}
                onChange={(e) => setLinkData({ ...linkData, text: e.target.value })}
                placeholder="Enter link text"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: 'var(--text)'
              }}>
                URL:
              </label>
              <input
                type="url"
                value={linkData.url}
                onChange={(e) => setLinkData({ ...linkData, url: e.target.value })}
                placeholder="bbc.co.uk or https://example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--muted)', 
                marginTop: '4px' 
              }}>
                💡 You can enter just the domain (e.g., bbc.co.uk) or a full URL with https://
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--muted)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (linkData.text && linkData.url && currentTextBlock) {
                    const block = blocks.find(b => b.id === currentTextBlock);
                    if (block && block.type === 'text') {
                      // Ensure URL has proper protocol
                      let processedUrl = linkData.url.trim();
                      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
                        processedUrl = 'https://' + processedUrl;
                      }
                      
                      const newLink = {
                        id: generateId(),
                        text: linkData.text,
                        url: processedUrl,
                        start: block.content.length,
                        end: block.content.length + linkData.text.length
                      };
                      const updatedLinks = [...(block.links || []), newLink];
                      const updatedContent = block.content + (block.content ? ' ' : '') + linkData.text;
                      
                      updateBlock(currentTextBlock, {
                        content: updatedContent,
                        links: updatedLinks
                      });
                    }
                  }
                  setShowLinkModal(false);
                  setLinkData({ text: '', url: '' });
                  setCurrentTextBlock(null);
                }}
                disabled={!linkData.text || !linkData.url}
                style={{
                  padding: '10px 20px',
                  backgroundColor: linkData.text && linkData.url ? 'var(--accent)' : 'var(--muted)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: linkData.text && linkData.url ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  opacity: linkData.text && linkData.url ? 1 : 0.5
                }}
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
