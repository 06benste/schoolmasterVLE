import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

// Assessment block types
type VisualAssessmentBlock = 
  | { type: 'heading'; id: string; level: 1 | 2 | 3 | 4 | 5 | 6; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'text'; id: string; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'image'; id: string; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'quiz'; id: string; question: string; options: string[]; answerIndex: number; allowMultiple?: boolean; correctAnswers?: number[]; marks: number }
  | { type: 'fillblank'; id: string; prompt: string; answer: string; marks: number }
  | { type: 'shortanswer'; id: string; question: string; answer: string; marks: number; validation?: { type: 'text' | 'number' | 'email' | 'url'; minLength?: number; maxLength?: number } }
  | { type: 'longanswer'; id: string; question: string; answer: string; marks: number; minWords?: number; maxWords?: number }
  | { type: 'checkbox'; id: string; question: string; options: string[]; correctAnswers: number[]; marks: number; minSelections?: number; maxSelections?: number }
  | { type: 'linearscale'; id: string; question: string; minValue: number; maxValue: number; minLabel: string; maxLabel: string; correctAnswer: number; marks: number; tolerance?: number }
  | { type: 'dropdown'; id: string; question: string; options: string[]; answerIndex: number; marks: number }
  | { type: 'multigrid'; id: string; question: string; rows: string[]; columns: string[]; correctAnswers: {[key: string]: number}; marks: number; allowMultiple?: boolean }
  | { type: 'tickgrid'; id: string; question: string; rows: string[]; columns: string[]; correctAnswers: {[key: string]: number[]}; marks: number }
  | { type: 'date'; id: string; question: string; answer: string; marks: number; minDate?: string; maxDate?: string }
  | { type: 'time'; id: string; question: string; answer: string; marks: number; timeType?: 'time' | 'duration' }
  | { type: 'fileupload'; id: string; question: string; allowedTypes: string[]; maxSize: number; marks: number }
  | { type: 'spacer'; id: string; height: number }
  | { type: 'divider'; id: string; style?: 'solid' | 'dashed' | 'dotted' }

interface VisualAssessmentBuilderProps {
  blocks: VisualAssessmentBlock[];
  onBlocksChange: (blocks: VisualAssessmentBlock[]) => void;
  onSave: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  onTitleChange?: (title: string) => void;
  onDescriptionChange?: (description: string) => void;
}

// Block palette items for assessments
const assessmentBlockPalette = [
  { type: 'heading', label: 'Heading', icon: '📝', description: 'Add a heading' },
  { type: 'text', label: 'Text', icon: '📄', description: 'Add text content' },
  { type: 'image', label: 'Image', icon: '🖼️', description: 'Add an image' },
  { type: 'quiz', label: 'Multiple Choice', icon: '❓', description: 'Add a multiple choice question' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️', description: 'Add checkbox question (multiple selections)' },
  { type: 'dropdown', label: 'Dropdown', icon: '📋', description: 'Add dropdown question' },
  { type: 'fillblank', label: 'Fill Blank', icon: '✏️', description: 'Add fill in the blank' },
  { type: 'shortanswer', label: 'Short Answer', icon: '📝', description: 'Add short answer question' },
  { type: 'longanswer', label: 'Long Answer', icon: '📄', description: 'Add long answer question' },
  { type: 'linearscale', label: 'Linear Scale', icon: '📊', description: 'Add rating scale question' },
  { type: 'multigrid', label: 'Multiple Choice Grid', icon: '🗂️', description: 'Add multiple choice grid' },
  { type: 'tickgrid', label: 'Tick Box Grid', icon: '☑️', description: 'Add tick box grid' },
  { type: 'date', label: 'Date', icon: '📅', description: 'Add date question' },
  { type: 'time', label: 'Time', icon: '⏰', description: 'Add time question' },
  { type: 'fileupload', label: 'File Upload', icon: '📁', description: 'Add file upload question' },
  { type: 'spacer', label: 'Spacer', icon: '⬜', description: 'Add spacing' },
  { type: 'divider', label: 'Divider', icon: '➖', description: 'Add a divider line' },
];

export default function VisualAssessmentBuilder({ 
  blocks, 
  onBlocksChange, 
  onSave, 
  onCancel, 
  title = '', 
  description = '', 
  onTitleChange, 
  onDescriptionChange 
}: VisualAssessmentBuilderProps) {
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageData, setImageData] = useState({ url: '', alt: '', caption: '' });
  const [previewAnswers, setPreviewAnswers] = useState<{[key: string]: any}>({});

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const createBlock = (type: string): VisualAssessmentBlock => {
    switch (type) {
      case 'heading':
        return { type: 'heading', id: generateId(), level: 2, content: '', size: 'medium' };
      case 'text':
        return { type: 'text', id: generateId(), content: '', size: 'medium' };
      case 'image':
        return { type: 'image', id: generateId(), url: '', alt: '', caption: '', width: 100, height: 200 };
      case 'quiz':
        return { type: 'quiz', id: generateId(), question: '', options: ['', ''], answerIndex: 0, allowMultiple: false, correctAnswers: [0], marks: 1 };
      case 'checkbox':
        return { type: 'checkbox', id: generateId(), question: '', options: ['', ''], correctAnswers: [0], marks: 1, minSelections: 1, maxSelections: undefined };
      case 'dropdown':
        return { type: 'dropdown', id: generateId(), question: '', options: ['', ''], answerIndex: 0, marks: 1 };
      case 'fillblank':
        return { type: 'fillblank', id: generateId(), prompt: '', answer: '', marks: 1 };
      case 'shortanswer':
        return { type: 'shortanswer', id: generateId(), question: '', answer: '', marks: 5, validation: { type: 'text' } };
      case 'longanswer':
        return { type: 'longanswer', id: generateId(), question: '', answer: '', marks: 10 };
      case 'linearscale':
        return { type: 'linearscale', id: generateId(), question: '', minValue: 1, maxValue: 5, minLabel: 'Not at all', maxLabel: 'Very much', correctAnswer: 3, marks: 1, tolerance: 0 };
      case 'multigrid':
        return { type: 'multigrid', id: generateId(), question: '', rows: ['', ''], columns: ['', ''], correctAnswers: {}, marks: 1, allowMultiple: false };
      case 'tickgrid':
        return { type: 'tickgrid', id: generateId(), question: '', rows: ['', ''], columns: ['', ''], correctAnswers: {}, marks: 1 };
      case 'date':
        return { type: 'date', id: generateId(), question: '', answer: '', marks: 1 };
      case 'time':
        return { type: 'time', id: generateId(), question: '', answer: '', marks: 1, timeType: 'time' };
      case 'fileupload':
        return { type: 'fileupload', id: generateId(), question: '', allowedTypes: ['image/*', '.pdf', '.doc', '.docx'], maxSize: 10485760, marks: 1 }; // 10MB default
      case 'spacer':
        return { type: 'spacer', id: generateId(), height: 40 };
      case 'divider':
        return { type: 'divider', id: generateId(), style: 'solid' };
      default:
        return { type: 'text', id: generateId(), content: '', size: 'medium' };
    }
  };

  const addBlock = (type: string) => {
    const newBlock = createBlock(type);
    onBlocksChange([...blocks, newBlock]);
  };

  const addBlockAtPosition = (type: string, position: number) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks];
    newBlocks.splice(position, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  const deleteBlock = (id: string) => {
    onBlocksChange(blocks.filter(block => block.id !== id));
    if (selectedBlock === id) {
      setSelectedBlock(null);
    }
  };

  const updateBlock = (id: string, updates: Partial<VisualAssessmentBlock>) => {
    onBlocksChange(blocks.map(block => 
      block.id === id ? { ...block, ...updates } as VisualAssessmentBlock : block
    ));
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, movedBlock);
    onBlocksChange(newBlocks);
  };

  // Drag and drop handlers (using same methodology as lesson editor)
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('text/plain', blockType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if we're dragging an existing block or a new block from palette
    const hasExistingBlock = e.dataTransfer.types.includes('application/json');
    e.dataTransfer.dropEffect = hasExistingBlock ? 'move' : 'copy';
    
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
    
    const blockType = e.dataTransfer.getData('text/plain');
    const draggedBlockId = e.dataTransfer.getData('application/json');
    
    if (draggedBlockId) {
      // Handle dragging existing blocks
      const draggedBlock = JSON.parse(draggedBlockId);
      const insertIndex = dragOverIndex !== null ? dragOverIndex : blocks.length;
      moveBlockToPosition(draggedBlock.id, insertIndex);
    } else if (blockType) {
      // Handle dragging new blocks from palette
      const insertIndex = dragOverIndex !== null ? dragOverIndex : blocks.length;
      addBlockAtPosition(blockType, insertIndex);
    }
    
    setDragOverIndex(null);
  };

  // Handle dragging existing blocks
  const handleBlockDragStart = (e: React.DragEvent, blockId: string, blockIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: blockId, index: blockIndex }));
    e.dataTransfer.effectAllowed = 'move';
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

  const renderPreviewBlock = (block: VisualAssessmentBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              fontSize: block.size === 'small' ? '0.9em' : block.size === 'large' ? '1.2em' : '1em',
              whiteSpace: 'pre-wrap'
            }}>
              {block.content}
            </div>
          </div>
        );
      
      case 'heading':
        const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <HeadingTag style={{ 
              fontSize: block.size === 'small' ? '1.2em' : block.size === 'large' ? '2.5em' : '1.8em',
              margin: '16px 0 8px 0',
              fontWeight: 'bold'
            }}>
              {block.content}
            </HeadingTag>
          </div>
        );

      case 'image':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <img 
              src={block.url} 
              alt={block.alt || 'Image'} 
              style={{ 
                width: block.width ? `${block.width}%` : '100%', 
                height: 'auto', 
                borderRadius: '8px'
              }}
            />
            {block.caption && (
              <div style={{ 
                textAlign: 'center', 
                fontSize: '0.9em', 
                color: 'var(--muted)', 
                marginTop: '8px' 
              }}>
                {block.caption}
              </div>
            )}
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
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {block.options.map((option, index) => (
                  <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type={block.allowMultiple ? "checkbox" : "radio"}
                      name={`preview-${block.id}`}
                      checked={block.allowMultiple 
                        ? (previewAnswers[block.id] as number[] || []).includes(index)
                        : previewAnswers[block.id] === index
                      }
                      onChange={(e) => {
                        if (block.allowMultiple) {
                          const current = previewAnswers[block.id] as number[] || [];
                          setPreviewAnswers({
                            ...previewAnswers,
                            [block.id]: e.target.checked 
                              ? [...current, index]
                              : current.filter(i => i !== index)
                          });
                        } else {
                          setPreviewAnswers({
                            ...previewAnswers,
                            [block.id]: index
                          });
                        }
                      }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {block.allowMultiple && (
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                  You can select multiple correct answers
                </div>
              )}
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
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.prompt} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <input 
                type="text" 
                placeholder="Your answer..." 
                value={previewAnswers[block.id] as string || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: e.target.value
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }} 
              />
            </div>
          </div>
        );

      case 'shortanswer':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <textarea 
                placeholder="Your answer..." 
                value={previewAnswers[block.id] as string || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: e.target.value
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  minHeight: '60px',
                  resize: 'vertical'
                }} 
              />
            </div>
          </div>
        );

      case 'longanswer':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <textarea 
                placeholder="Your answer..." 
                value={previewAnswers[block.id] as string || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: e.target.value
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  minHeight: '120px',
                  resize: 'vertical'
                }} 
              />
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              {block.options.map((option, index) => (
                <label key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={(previewAnswers[block.id] as number[] || []).includes(index)}
                    onChange={(e) => {
                      const current = previewAnswers[block.id] as number[] || [];
                      setPreviewAnswers({
                        ...previewAnswers,
                        [block.id]: e.target.checked 
                          ? [...current, index]
                          : current.filter(i => i !== index)
                      });
                    }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'dropdown':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <select 
                value={previewAnswers[block.id] as number || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: parseInt(e.target.value)
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}>
                <option value="">Select an option...</option>
                {block.options.map((option, index) => (
                  <option key={index} value={index}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'linearscale':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{block.minLabel}</span>
                <input 
                  type="range" 
                  min={block.minValue} 
                  max={block.maxValue} 
                  value={previewAnswers[block.id] as number || block.minValue}
                  onChange={(e) => setPreviewAnswers({
                    ...previewAnswers,
                    [block.id]: parseInt(e.target.value)
                  })}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 'bold' }}>
                  {previewAnswers[block.id] as number || block.minValue}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{block.maxLabel}</span>
              </div>
            </div>
          </div>
        );

      case 'date':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <input 
                type="date" 
                value={previewAnswers[block.id] as string || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: e.target.value
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }} 
              />
            </div>
          </div>
        );

      case 'time':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <input 
                type="time" 
                value={previewAnswers[block.id] as string || ''}
                onChange={(e) => setPreviewAnswers({
                  ...previewAnswers,
                  [block.id]: e.target.value
                })}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }} 
              />
            </div>
          </div>
        );

      case 'fileupload':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <input 
                type="file" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPreviewAnswers({
                      ...previewAnswers,
                      [block.id]: file.name
                    });
                  }
                }}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }} 
              />
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Allowed: {block.allowedTypes.join(', ')} | Max size: {Math.round(block.maxSize / 1024 / 1024)}MB
              </div>
            </div>
          </div>
        );

      case 'multigrid':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid var(--border)', padding: '8px', backgroundColor: 'var(--bg)' }}></th>
                      {block.columns && block.columns.map((column, colIndex) => (
                        <th key={colIndex} style={{ border: '1px solid var(--border)', padding: '8px', backgroundColor: 'var(--bg)' }}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows && block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td style={{ border: '1px solid var(--border)', padding: '8px', fontWeight: 'bold' }}>
                          {row}
                        </td>
                        {block.columns && block.columns.map((column, colIndex) => (
                          <td key={colIndex} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="radio" 
                              name={`preview-${block.id}-row-${rowIndex}`}
                              checked={previewAnswers[`${block.id}-row-${rowIndex}`] === colIndex}
                              onChange={() => setPreviewAnswers({
                                ...previewAnswers,
                                [`${block.id}-row-${rowIndex}`]: colIndex
                              })}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'tickgrid':
        return (
          <div className="card" style={{ margin: '8px 0' }}>
            <div style={{ 
              padding: '16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {block.question} ({block.marks} mark{block.marks !== 1 ? 's' : ''})
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid var(--border)', padding: '8px', backgroundColor: 'var(--bg)' }}></th>
                      {block.columns && block.columns.map((column, colIndex) => (
                        <th key={colIndex} style={{ border: '1px solid var(--border)', padding: '8px', backgroundColor: 'var(--bg)' }}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows && block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td style={{ border: '1px solid var(--border)', padding: '8px', fontWeight: 'bold' }}>
                          {row}
                        </td>
                        {block.columns && block.columns.map((column, colIndex) => (
                          <td key={colIndex} style={{ border: '1px solid var(--border)', padding: '8px', textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={(previewAnswers[`${block.id}-row-${rowIndex}`] as number[] || []).includes(colIndex)}
                              onChange={(e) => {
                                const current = previewAnswers[`${block.id}-row-${rowIndex}`] as number[] || [];
                                setPreviewAnswers({
                                  ...previewAnswers,
                                  [`${block.id}-row-${rowIndex}`]: e.target.checked 
                                    ? [...current, colIndex]
                                    : current.filter(i => i !== colIndex)
                                });
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'spacer':
        return <div style={{ height: block.height, margin: '8px 0' }} />;

      case 'divider':
        return (
          <div style={{ 
            height: '1px', 
            backgroundColor: 'var(--border)', 
            margin: '16px 0',
            borderStyle: block.style || 'solid'
          }} />
        );

      default:
        return <div className="card" style={{ margin: '8px 0' }}>Unsupported block type</div>;
    }
  };

  const renderBlock = (block: VisualAssessmentBlock, index: number) => {
    const isSelected = selectedBlock === block.id;
    
    if (isPreviewMode) {
      return renderPreviewBlock(block);
    }
    
    const blockStyle = {
      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: '8px',
      margin: '8px 0',
      position: 'relative' as const,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    };

    return (
      <div
        key={block.id}
        style={blockStyle}
        onClick={() => setSelectedBlock(block.id)}
        draggable
        onDragStart={(e) => handleBlockDragStart(e, block.id, index)}
      >
        {/* Block Controls */}
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '8px',
          display: 'flex',
          gap: '4px',
          zIndex: 10
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

        {/* Block Content */}
        <div style={{ padding: '16px' }}>
          {renderBlockContent(block)}
        </div>
      </div>
    );
  };

  const renderBlockContent = (block: VisualAssessmentBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div>
            <textarea
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder="Enter your text here..."
              style={{ 
                width: '100%', 
                minHeight: '60px',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                resize: 'vertical',
                fontSize: block.size === 'small' ? '0.9em' : block.size === 'large' ? '1.2em' : '1em'
              }}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <select
                value={block.size || 'medium'}
                onChange={(e) => updateBlock(block.id, { size: e.target.value as any })}
                style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        );

      case 'heading':
        return (
          <div>
            <input
              type="text"
              value={block.content}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              placeholder="Enter heading text"
              style={{ 
                width: '100%', 
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                fontSize: block.size === 'small' ? '1.2em' : block.size === 'large' ? '2.5em' : '1.8em',
                fontWeight: 'bold'
              }}
            />
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <select
                value={block.level}
                onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) as any })}
                style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
              >
                <option value={1}>H1</option>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
                <option value={4}>H4</option>
                <option value={5}>H5</option>
                <option value={6}>H6</option>
              </select>
              <select
                value={block.size || 'medium'}
                onChange={(e) => updateBlock(block.id, { size: e.target.value as any })}
                style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px' }}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        );

      case 'image':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="url"
                value={block.url}
                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                placeholder="Image URL"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.alt}
                onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                placeholder="Alt text"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                placeholder="Caption (optional)"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                value={block.width || 100}
                onChange={(e) => updateBlock(block.id, { width: parseInt(e.target.value) })}
                placeholder="Width %"
                min="10"
                max="100"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <input
                type="number"
                value={block.height || 200}
                onChange={(e) => updateBlock(block.id, { height: parseInt(e.target.value) })}
                placeholder="Height px"
                min="50"
                max="800"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            {block.url && (
              <div style={{ marginTop: '12px' }}>
                <img 
                  src={block.url} 
                  alt={block.alt} 
                  style={{ 
                    maxWidth: '100%', 
                    height: 'auto', 
                    borderRadius: '4px',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'quiz':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              {block.options.map((option, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="radio"
                    name={`correct-${block.id}`}
                    checked={block.answerIndex === index}
                    onChange={() => updateBlock(block.id, { answerIndex: index })}
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...block.options];
                      newOptions[index] = e.target.value;
                      updateBlock(block.id, { options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                    style={{ 
                      flex: 1, 
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                  <button
                    onClick={() => {
                      const newOptions = block.options.filter((_, i) => i !== index);
                      const newAnswerIndex = block.answerIndex > index ? block.answerIndex - 1 : 
                                           block.answerIndex === index ? 0 : block.answerIndex;
                      updateBlock(block.id, { options: newOptions, answerIndex: newAnswerIndex });
                    }}
                    style={{ 
                      padding: '4px 8px', 
                      backgroundColor: '#e53e3e', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateBlock(block.id, { options: [...block.options, ''] })}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: 'var(--accent)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Option
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'fillblank':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.prompt}
                onChange={(e) => updateBlock(block.id, { prompt: e.target.value })}
                placeholder="Enter your prompt"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.answer}
                onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                placeholder="Correct answer"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'shortanswer':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.answer}
                onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                placeholder="Model answer"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'longanswer':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <textarea
                value={block.answer}
                onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                placeholder="Model answer"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Options:</label>
              {block.options.map((option, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={block.correctAnswers.includes(index)}
                    onChange={(e) => {
                      const newCorrectAnswers = e.target.checked 
                        ? [...block.correctAnswers, index]
                        : block.correctAnswers.filter(i => i !== index);
                      updateBlock(block.id, { correctAnswers: newCorrectAnswers });
                    }}
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...block.options];
                      newOptions[index] = e.target.value;
                      updateBlock(block.id, { options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...block.options, ''];
                  updateBlock(block.id, { options: newOptions });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Option
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'dropdown':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Options:</label>
              {block.options.map((option, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="radio"
                    name={`correct-${block.id}`}
                    checked={block.answerIndex === index}
                    onChange={() => updateBlock(block.id, { answerIndex: index })}
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...block.options];
                      newOptions[index] = e.target.value;
                      updateBlock(block.id, { options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newOptions = [...block.options, ''];
                  updateBlock(block.id, { options: newOptions });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Option
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'linearscale':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Min Value:</label>
                <input
                  type="number"
                  value={block.minValue}
                  onChange={(e) => updateBlock(block.id, { minValue: parseInt(e.target.value) })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Max Value:</label>
                <input
                  type="number"
                  value={block.maxValue}
                  onChange={(e) => updateBlock(block.id, { maxValue: parseInt(e.target.value) })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Min Label:</label>
                <input
                  type="text"
                  value={block.minLabel}
                  onChange={(e) => updateBlock(block.id, { minLabel: e.target.value })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Max Label:</label>
                <input
                  type="text"
                  value={block.maxLabel}
                  onChange={(e) => updateBlock(block.id, { maxLabel: e.target.value })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Correct Answer:</label>
                <input
                  type="number"
                  value={block.correctAnswer}
                  onChange={(e) => updateBlock(block.id, { correctAnswer: parseInt(e.target.value) })}
                  min={block.minValue}
                  max={block.maxValue}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Tolerance:</label>
                <input
                  type="number"
                  value={block.tolerance || 0}
                  onChange={(e) => updateBlock(block.id, { tolerance: parseInt(e.target.value) })}
                  min="0"
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'date':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="date"
                value={block.answer}
                onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                placeholder="Correct date"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'time':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Type:</label>
                <select
                  value={block.timeType || 'time'}
                  onChange={(e) => updateBlock(block.id, { timeType: e.target.value as 'time' | 'duration' })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="time">Time</option>
                  <option value="duration">Duration</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Correct Answer:</label>
                <input
                  type="time"
                  value={block.answer}
                  onChange={(e) => updateBlock(block.id, { answer: e.target.value })}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'fileupload':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Allowed File Types:</label>
              <input
                type="text"
                value={block.allowedTypes.join(', ')}
                onChange={(e) => updateBlock(block.id, { allowedTypes: e.target.value.split(',').map(s => s.trim()) })}
                placeholder="e.g., image/*, .pdf, .doc"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text)', fontSize: '14px' }}>Max File Size (bytes):</label>
              <input
                type="number"
                value={block.maxSize}
                onChange={(e) => updateBlock(block.id, { maxSize: parseInt(e.target.value) })}
                placeholder="10485760"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'multigrid':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Rows:</label>
              {block.rows.map((row, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={row}
                    onChange={(e) => {
                      const newRows = [...block.rows];
                      newRows[index] = e.target.value;
                      updateBlock(block.id, { rows: newRows });
                    }}
                    placeholder={`Row ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newRows = [...block.rows, ''];
                  updateBlock(block.id, { rows: newRows });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Row
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Columns:</label>
              {block.columns.map((column, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={column}
                    onChange={(e) => {
                      const newColumns = [...block.columns];
                      newColumns[index] = e.target.value;
                      updateBlock(block.id, { columns: newColumns });
                    }}
                    placeholder={`Column ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newColumns = [...block.columns, ''];
                  updateBlock(block.id, { columns: newColumns });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Column
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Correct Answers (one per row):</label>
              <div style={{ backgroundColor: 'var(--panel)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {block.rows.map((row, rowIndex) => (
                  <div key={rowIndex} style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: 'var(--text)' }}>
                      {row || `Row ${rowIndex + 1}`}:
                    </label>
                    <select
                      value={block.correctAnswers?.[rowIndex] ?? ''}
                      onChange={(e) => {
                        const newCorrectAnswers = { ...block.correctAnswers };
                        newCorrectAnswers[rowIndex] = parseInt(e.target.value);
                        updateBlock(block.id, { correctAnswers: newCorrectAnswers });
                      }}
                      style={{ 
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text)'
                      }}
                    >
                      <option value="">Select correct answer...</option>
                      {block.columns.map((column, colIndex) => (
                        <option key={colIndex} value={colIndex}>
                          {column || `Column ${colIndex + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'tickgrid':
        return (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={block.question}
                onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                placeholder="Enter your question"
                style={{ 
                  width: '100%', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Rows:</label>
              {block.rows.map((row, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={row}
                    onChange={(e) => {
                      const newRows = [...block.rows];
                      newRows[index] = e.target.value;
                      updateBlock(block.id, { rows: newRows });
                    }}
                    placeholder={`Row ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newRows = [...block.rows, ''];
                  updateBlock(block.id, { rows: newRows });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Row
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Columns:</label>
              {block.columns.map((column, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={column}
                    onChange={(e) => {
                      const newColumns = [...block.columns];
                      newColumns[index] = e.target.value;
                      updateBlock(block.id, { columns: newColumns });
                    }}
                    placeholder={`Column ${index + 1}`}
                    style={{ 
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)'
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => {
                  const newColumns = [...block.columns, ''];
                  updateBlock(block.id, { columns: newColumns });
                }}
                style={{ 
                  padding: '8px 16px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Column
              </button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text)', fontWeight: '600' }}>Correct Answers (multiple per row):</label>
              <div style={{ backgroundColor: 'var(--panel)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {block.rows.map((row, rowIndex) => (
                  <div key={rowIndex} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                      {row || `Row ${rowIndex + 1}`}:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {block.columns.map((column, colIndex) => (
                        <label key={colIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={(block.correctAnswers?.[rowIndex] || []).includes(colIndex)}
                            onChange={(e) => {
                              const newCorrectAnswers = { ...block.correctAnswers };
                              const currentRow = newCorrectAnswers[rowIndex] || [];
                              
                              if (e.target.checked) {
                                newCorrectAnswers[rowIndex] = [...currentRow, colIndex];
                              } else {
                                newCorrectAnswers[rowIndex] = currentRow.filter(i => i !== colIndex);
                              }
                              
                              updateBlock(block.id, { correctAnswers: newCorrectAnswers });
                            }}
                          />
                          <span>{column || `Column ${colIndex + 1}`}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                value={block.marks}
                onChange={(e) => updateBlock(block.id, { marks: parseInt(e.target.value) })}
                placeholder="Marks"
                min="1"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '14px' }}>marks</span>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>Spacer Height:</span>
              <input
                type="number"
                value={block.height}
                onChange={(e) => updateBlock(block.id, { height: parseInt(e.target.value) })}
                min="10"
                max="200"
                style={{ 
                  width: '80px', 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              />
              <span style={{ color: 'var(--muted)' }}>px</span>
            </div>
          </div>
        );

      case 'divider':
        return (
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>Style:</span>
              <select
                value={block.style || 'solid'}
                onChange={(e) => updateBlock(block.id, { style: e.target.value as any })}
                style={{ 
                  padding: '8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)'
                }}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
          </div>
        );

      default:
        return <div>Unknown block type</div>;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Block Palette */}
      <div style={{ 
        width: '250px', 
        backgroundColor: 'var(--panel)', 
        borderRight: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>Assessment Blocks</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {assessmentBlockPalette.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-light)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
            {/* Title Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>Assessment Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder="Enter assessment title..."
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Description Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '500' }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => onDescriptionChange?.(e.target.value)}
                placeholder="Enter description (optional)..."
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              style={{
                padding: '8px 16px',
                backgroundColor: isPreviewMode ? 'var(--accent)' : 'var(--panel)',
                color: isPreviewMode ? 'white' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {isPreviewMode ? '✏️ Edit' : '👁️ Preview'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Save Assessment
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div 
          style={{ 
            flex: 1, 
            padding: '20px', 
            overflowY: 'auto',
            paddingBottom: '100px'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {blocks.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: 'var(--muted)', 
              padding: '40px',
              border: '2px dashed var(--border)',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Start Building Your Assessment</div>
              <div style={{ fontSize: '14px' }}>Drag blocks from the left panel or click to add content</div>
            </div>
          ) : (
            <div>
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  style={{
                    position: 'relative',
                    border: dragOverIndex === index ? '2px dashed var(--accent)' : 'none',
                    borderRadius: '4px',
                    padding: dragOverIndex === index ? '8px' : '0'
                  }}
                >
                  {renderBlock(block, index)}
                </div>
              ))}
              
              {/* Drop Zone at Bottom */}
              <div
                style={{
                  height: '60px',
                  border: dragOverIndex === blocks.length ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  marginTop: '20px',
                  transition: 'all 0.2s ease',
                  backgroundColor: dragOverIndex === blocks.length ? 'var(--accent-light)' : 'transparent'
                }}
              >
                Drop blocks here to add to the end
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
