import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import VisualAssessmentBuilder from '../../components/VisualAssessmentBuilder'
import { useAutosave } from '../../hooks/useAutosave'

type Block =
  | { type: 'quiz'; question: string; options: string[]; answerIndex: number; allowMultiple?: boolean; correctAnswers?: number[]; marks: number }
  | { type: 'fillblank'; prompt: string; answer: string; marks: number }
  | { type: 'shortanswer'; question: string; answer: string; marks: number; validation?: { type: 'text' | 'number' | 'email' | 'url'; minLength?: number; maxLength?: number } }
  | { type: 'longanswer'; question: string; answer: string; marks: number; minWords?: number; maxWords?: number }
  | { type: 'checkbox'; question: string; options: string[]; correctAnswers: number[]; marks: number; minSelections?: number; maxSelections?: number }
  | { type: 'linearscale'; question: string; minValue: number; maxValue: number; minLabel: string; maxLabel: string; correctAnswer: number; marks: number; tolerance?: number }
  | { type: 'dropdown'; question: string; options: string[]; answerIndex: number; marks: number }
  | { type: 'multigrid'; question: string; rows: string[]; columns: string[]; correctAnswers: {[key: string]: number}; marks: number; allowMultiple?: boolean }
  | { type: 'tickgrid'; question: string; rows: string[]; columns: string[]; correctAnswers: {[key: string]: number[]}; marks: number }
  | { type: 'date'; question: string; answer: string; marks: number; minDate?: string; maxDate?: string }
  | { type: 'time'; question: string; answer: string; marks: number; timeType?: 'time' | 'duration' }
  | { type: 'fileupload'; question: string; allowedTypes: string[]; maxSize: number; marks: number }
  | { type: 'image'; url: string; alt: string; caption?: string }

// Visual block type (compatible with the visual builder)
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

export default function AssessmentBuilder(){
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [visualBlocks, setVisualBlocks] = useState<VisualAssessmentBlock[]>([])
  const [list, setList] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [editingAssessment, setEditingAssessment] = useState<any>(null)
  const [showVisualBuilder, setShowVisualBuilder] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)

  // Convert visual blocks to regular blocks for saving
  const convertVisualBlocksToBlocks = (visualBlocks: VisualAssessmentBlock[]): Block[] => {
    return visualBlocks
      .filter(vb => ['quiz', 'fillblank', 'shortanswer', 'longanswer', 'checkbox', 'linearscale', 'dropdown', 'multigrid', 'tickgrid', 'date', 'time', 'fileupload', 'image'].includes(vb.type))
      .map(vb => {
        switch (vb.type) {
          case 'quiz':
            return { 
              type: 'quiz', 
              question: vb.question, 
              options: vb.options, 
              answerIndex: vb.answerIndex, 
              allowMultiple: vb.allowMultiple, 
              correctAnswers: vb.correctAnswers, 
              marks: vb.marks 
            };
          case 'fillblank':
            return { type: 'fillblank', prompt: vb.prompt, answer: vb.answer, marks: vb.marks };
          case 'shortanswer':
            return { type: 'shortanswer', question: vb.question, answer: vb.answer, marks: vb.marks, validation: vb.validation };
          case 'longanswer':
            return { type: 'longanswer', question: vb.question, answer: vb.answer, marks: vb.marks, minWords: vb.minWords, maxWords: vb.maxWords };
          case 'checkbox':
            return { type: 'checkbox', question: vb.question, options: vb.options, correctAnswers: vb.correctAnswers, marks: vb.marks, minSelections: vb.minSelections, maxSelections: vb.maxSelections };
          case 'linearscale':
            return { type: 'linearscale', question: vb.question, minValue: vb.minValue, maxValue: vb.maxValue, minLabel: vb.minLabel, maxLabel: vb.maxLabel, correctAnswer: vb.correctAnswer, marks: vb.marks, tolerance: vb.tolerance };
          case 'dropdown':
            return { type: 'dropdown', question: vb.question, options: vb.options, answerIndex: vb.answerIndex, marks: vb.marks };
          case 'multigrid':
            return { type: 'multigrid', question: vb.question, rows: vb.rows, columns: vb.columns, correctAnswers: vb.correctAnswers, marks: vb.marks, allowMultiple: vb.allowMultiple };
          case 'tickgrid':
            return { type: 'tickgrid', question: vb.question, rows: vb.rows, columns: vb.columns, correctAnswers: vb.correctAnswers, marks: vb.marks };
          case 'date':
            return { type: 'date', question: vb.question, answer: vb.answer, marks: vb.marks, minDate: vb.minDate, maxDate: vb.maxDate };
          case 'time':
            return { type: 'time', question: vb.question, answer: vb.answer, marks: vb.marks, timeType: vb.timeType };
          case 'fileupload':
            return { type: 'fileupload', question: vb.question, allowedTypes: vb.allowedTypes, maxSize: vb.maxSize, marks: vb.marks };
          case 'image':
            return { type: 'image', url: vb.url, alt: vb.alt, caption: vb.caption };
          default:
            return null;
        }
      })
      .filter(Boolean) as Block[];
  };

  // Convert regular blocks to visual blocks for editing
  const convertBlocksToVisualBlocks = (blocks: Block[]): VisualAssessmentBlock[] => {
    return blocks.map(block => {
      switch (block.type) {
        case 'quiz':
          return { 
            type: 'quiz', 
            id: Math.random().toString(36).substr(2, 9), 
            question: block.question, 
            options: block.options, 
            answerIndex: block.answerIndex, 
            allowMultiple: block.allowMultiple, 
            correctAnswers: block.correctAnswers, 
            marks: block.marks 
          };
        case 'fillblank':
          return { type: 'fillblank', id: Math.random().toString(36).substr(2, 9), prompt: block.prompt, answer: block.answer, marks: block.marks };
        case 'shortanswer':
          return { type: 'shortanswer', id: Math.random().toString(36).substr(2, 9), question: block.question, answer: block.answer, marks: block.marks, validation: block.validation };
        case 'longanswer':
          return { type: 'longanswer', id: Math.random().toString(36).substr(2, 9), question: block.question, answer: block.answer, marks: block.marks, minWords: block.minWords, maxWords: block.maxWords };
        case 'checkbox':
          return { type: 'checkbox', id: Math.random().toString(36).substr(2, 9), question: block.question, options: block.options, correctAnswers: block.correctAnswers, marks: block.marks, minSelections: block.minSelections, maxSelections: block.maxSelections };
        case 'linearscale':
          return { type: 'linearscale', id: Math.random().toString(36).substr(2, 9), question: block.question, minValue: block.minValue, maxValue: block.maxValue, minLabel: block.minLabel, maxLabel: block.maxLabel, correctAnswer: block.correctAnswer, marks: block.marks, tolerance: block.tolerance };
        case 'dropdown':
          return { type: 'dropdown', id: Math.random().toString(36).substr(2, 9), question: block.question, options: block.options, answerIndex: block.answerIndex, marks: block.marks };
        case 'multigrid':
          return { type: 'multigrid', id: Math.random().toString(36).substr(2, 9), question: block.question, rows: block.rows, columns: block.columns, correctAnswers: block.correctAnswers, marks: block.marks, allowMultiple: block.allowMultiple };
        case 'tickgrid':
          return { type: 'tickgrid', id: Math.random().toString(36).substr(2, 9), question: block.question, rows: block.rows, columns: block.columns, correctAnswers: block.correctAnswers, marks: block.marks };
        case 'date':
          return { type: 'date', id: Math.random().toString(36).substr(2, 9), question: block.question, answer: block.answer, marks: block.marks, minDate: block.minDate, maxDate: block.maxDate };
        case 'time':
          return { type: 'time', id: Math.random().toString(36).substr(2, 9), question: block.question, answer: block.answer, marks: block.marks, timeType: block.timeType };
        case 'fileupload':
          return { type: 'fileupload', id: Math.random().toString(36).substr(2, 9), question: block.question, allowedTypes: block.allowedTypes, maxSize: block.maxSize, marks: block.marks };
        case 'image':
          return { type: 'image', id: Math.random().toString(36).substr(2, 9), url: block.url, alt: block.alt, caption: block.caption, width: 100, height: 200 };
        default:
          return { type: 'text', id: Math.random().toString(36).substr(2, 9), content: '', size: 'medium' };
      }
    });
  };

  async function save(){
    try{
      // Validate required fields
      if (!title || title.trim() === '') {
        setMessage('Assessment title is required');
        return;
      }
      
      const blocksToSave = showVisualBuilder ? convertVisualBlocksToBlocks(visualBlocks) : blocks;
      
      // Validate that we have content
      if (!blocksToSave || blocksToSave.length === 0) {
        setMessage('Assessment must have at least one question or content block');
        return;
      }
      
      console.log('Assessment save data:', {
        title,
        description,
        blocksToSave,
        showVisualBuilder,
        visualBlocks,
        blocks
      });
      
      if (editingAssessment) {
        await api.put(`/assessments/${editingAssessment.id}`, { title, description, content: { blocks: blocksToSave } })
        setMessage('Assessment updated successfully')
        setEditingAssessment(null)
      } else {
        const res = await api.post('/assessments', { title, description, content: { blocks: blocksToSave } })
        setMessage(`Saved assessment ${res.data.id}`)
      }
      setTitle(''); setDescription(''); setBlocks([]); setVisualBlocks([])
      setShowVisualBuilder(false)
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Save failed')
    }
  }

  async function deleteAssessment(id: string){
    if (!confirm('Are you sure you want to delete this assessment?')) return
    try{
      await api.delete(`/assessments/${id}`)
      setMessage('Assessment deleted successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  async function loadAssessment(id: string){
    try{
      const res = await api.get(`/assessments/${id}`)
      const assessment = res.data
      setEditingAssessment(assessment)
      setTitle(assessment.title)
      setDescription(assessment.description || '')
      setBlocks(assessment.content?.blocks || [])
      setVisualBlocks(convertBlocksToVisualBlocks(assessment.content?.blocks || []))
      setShowVisualBuilder(true)
      setMessage(null)
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to load assessment')
    }
  }

  function startEdit(){
    setTitle(''); setDescription(''); setBlocks([])
    setEditingAssessment(null)
    setMessage(null)
  }

  function openCreateDialog(){
    setShowVisualBuilder(true)
    setTitle(''); setDescription(''); setBlocks([]); setVisualBlocks([])
    setEditingAssessment(null)
    setMessage(null)
  }

  function closeVisualBuilder() {
    setShowVisualBuilder(false)
  }

  function handleVisualSave() {
    save()
  }

  function handleVisualCancel() {
    closeVisualBuilder()
  }

  async function load(){
    try{
      const res = await api.get('/assessments')
      // Migrate existing assessments to include marks field if missing
      const migratedList = res.data.map((assessment: any) => {
        if (assessment.content?.blocks) {
          assessment.content.blocks = assessment.content.blocks.map((block: any) => {
            if (block.type !== 'text' && !block.marks) {
              // Add default marks based on question type
              switch (block.type) {
                case 'quiz':
                case 'fillblank':
                  return { ...block, marks: 1 };
                case 'shortanswer':
                  return { ...block, marks: 5 };
                case 'longanswer':
                  return { ...block, marks: 10 };
                default:
                  return block;
              }
            }
            return block;
          });
        }
        return assessment;
      });
      setList(migratedList)
    }catch{}
  }

  useEffect(() => { load() }, [])

  // Autosave functionality
  const autosaveData = {
    title,
    description,
    visualBlocks,
    editingAssessmentId: editingAssessment?.id
  }

  const { saveNow } = useAutosave(autosaveData, {
    enabled: !!title.trim() && visualBlocks.length > 0,
    delay: 3000,
    onSave: async (data) => {
      if (!editingAssessment) {
        // For new assessments, we can't autosave without creating them first
        // Just show that we're tracking changes
        setAutosaveStatus('saving')
        setTimeout(() => setAutosaveStatus('saved'), 500)
        setTimeout(() => setAutosaveStatus(null), 2000)
        return
      }
      
      setAutosaveStatus('saving')
      try {
        const blocksToSave = convertVisualBlocksToBlocks(data.visualBlocks)
        await api.put(`/assessments/${editingAssessment.id}`, { 
          title: data.title, 
          description: data.description, 
          content: { blocks: blocksToSave } 
        })
        setAutosaveStatus('saved')
        setTimeout(() => setAutosaveStatus(null), 2000)
      } catch (error) {
        console.error('Autosave failed:', error)
        setAutosaveStatus('error')
        setTimeout(() => setAutosaveStatus(null), 3000)
      }
    },
    onError: (error) => {
      console.error('Autosave error:', error)
      setAutosaveStatus('error')
      setTimeout(() => setAutosaveStatus(null), 3000)
    }
  })

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Assessment Management</h2>
          <button onClick={openCreateDialog} className="button">+ Create New Assessment</button>
        </div>
        {message && (
          <div style={{ 
            padding: 12, 
            backgroundColor: message.includes('successfully') ? '#d4edda' : '#f8d7da',
            border: `1px solid ${message.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: 4,
            marginTop: 16,
            color: '#000000'
          }}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Existing Assessments</h3>
        {list.length === 0 ? (
          <div className="muted">No assessments created yet.</div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {list.map(assessment => (
              <div key={assessment.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
                    <strong>{assessment.title}</strong>
                    {assessment.description && <div className="muted">{assessment.description}</div>}
                    <div className="muted" style={{ fontSize: '0.8em' }}>
                      Created: {new Date(assessment.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button onClick={() => loadAssessment(assessment.id)}>Edit</button>
                    <button onClick={() => deleteAssessment(assessment.id)} className="danger">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showVisualBuilder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000
        }}>
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '95vw',
            height: '90vh',
            backgroundColor: 'var(--panel)',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            <VisualAssessmentBuilder
              blocks={visualBlocks}
              onBlocksChange={setVisualBlocks}
              onSave={handleVisualSave}
              onCancel={handleVisualCancel}
              title={title}
              description={description}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
            />
          </div>
        </div>
      )}
    </div>
  )
}