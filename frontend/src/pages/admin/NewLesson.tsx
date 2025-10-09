import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import VisualLessonBuilder from '../../components/VisualLessonBuilder'

type Block =
  | { type: 'video'; url: string }
  | { type: 'text'; content: string }
  | { type: 'quiz'; question: string; options: string[]; answerIndex: number }
  | { type: 'fillblank'; prompt: string; answer: string }
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'columns'; columns: Array<{ content: string; width: number }> }
  | { type: 'documents'; title: string; documents: Array<{ id: string; name: string; url: string; size: number; type: string }> }

// Visual block type (compatible with the visual builder)
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
    }; links?: Array<{ id: string; text: string; url: string; start: number; end: number }> }
  | { type: 'image'; id: string; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'video'; id: string; url: string; width?: number; height?: number }
  | { type: 'columns'; id: string; columns: Array<{ id: string; content: string; width: number; blocks?: VisualBlock[] }> }
  | { type: 'spacer'; id: string; height: number }
  | { type: 'divider'; id: string; style?: 'solid' | 'dashed' | 'dotted' }
  | { type: 'quiz'; id: string; question: string; options: string[]; answerIndex: number }
  | { type: 'fillblank'; id: string; prompt: string; answer: string }
  | { type: 'documents'; id: string; title: string; documents: Array<{ id: string; name: string; url: string; size: number; type: string }> }

export default function NewLesson(){
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visualBlocks, setVisualBlocks] = useState<VisualBlock[]>([])
  const [message, setMessage] = useState<string | null>(null)

  // Convert visual blocks to regular blocks for saving
  const convertVisualBlocksToBlocks = (visualBlocks: VisualBlock[]): Block[] => {
    return visualBlocks
      .filter(vb => ['text', 'video', 'image', 'quiz', 'fillblank', 'heading', 'columns', 'documents'].includes(vb.type))
      .map(vb => {
        switch (vb.type) {
          case 'text':
            return { type: 'text', content: vb.content };
          case 'video':
            return { type: 'video', url: vb.url };
          case 'image':
            return { type: 'image', url: vb.url, alt: vb.alt, caption: vb.caption };
          case 'quiz':
            return { type: 'quiz', question: vb.question, options: vb.options, answerIndex: vb.answerIndex };
          case 'fillblank':
            return { type: 'fillblank', prompt: vb.prompt, answer: vb.answer };
          case 'heading':
            return { type: 'heading', level: vb.level, content: vb.content, size: vb.size };
          case 'columns':
            return { type: 'columns', columns: vb.columns };
          case 'documents':
            return { type: 'documents', title: vb.title, documents: vb.documents };
          default:
            return null;
        }
      })
      .filter(Boolean) as Block[];
  };

  async function save(){
    if (!title.trim()) {
      setMessage('Please enter a lesson title')
      return
    }
    
    const blocksToSave = convertVisualBlocksToBlocks(visualBlocks);
    
    if (blocksToSave.length === 0) {
      setMessage('Please add at least one content block')
      return
    }
    
    try{
      const res = await api.post('/lessons', { title, description, content: { blocks: blocksToSave } })
      setMessage(`Lesson "${title}" created successfully!`)
      setTimeout(() => {
        navigate('/admin/lessons')
      }, 1500)
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Save failed')
    }
  }

  function cancel(){
    const hasContent = title || description || visualBlocks.length > 0;
    if (hasContent) {
      if (confirm('Are you sure you want to cancel? Your changes will be lost.')) {
        navigate('/admin/lessons')
      }
    } else {
      navigate('/admin/lessons')
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with lesson details */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--panel)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <input 
            placeholder="Lesson Title *" 
            value={title} 
            onChange={e=>setTitle(e.target.value)} 
            style={{ 
              fontSize: '1.2em', 
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              minWidth: '300px'
            }}
          />
          <textarea 
            placeholder="Description (optional)" 
            value={description} 
            onChange={e=>setDescription(e.target.value)}
            rows={1}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              resize: 'none',
              minWidth: '200px'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={cancel} style={{ padding: '8px 16px' }}>
            Cancel
          </button>
          <button 
            onClick={save} 
            disabled={!title.trim() || visualBlocks.length === 0}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: 'var(--accent)', 
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: (!title.trim() || visualBlocks.length === 0) ? 0.5 : 1
            }}
          >
            Save Lesson
          </button>
        </div>
      </div>

      {/* Message display */}
      {message && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: message.includes('successfully') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`,
          color: message.includes('successfully') ? '#155724' : '#721c24'
        }}>
          {message}
        </div>
      )}

      {/* Visual Builder */}
      <div style={{ flex: 1 }}>
        <VisualLessonBuilder
          blocks={visualBlocks}
          onBlocksChange={setVisualBlocks}
          onSave={save}
          onCancel={cancel}
        />
      </div>
    </div>
  );
}