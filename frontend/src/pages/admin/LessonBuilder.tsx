import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import VisualLessonBuilder from '../../components/VisualLessonBuilder'
import HelpButton from '../../components/HelpButton'
import { useAutosave } from '../../hooks/useAutosave'
import { useConfirm } from '../../contexts/ConfirmContext'

type Block =
  | { type: 'video'; url: string }
  | { type: 'text'; content: string }
  | { type: 'quiz'; question: string; options: string[]; answerIndex: number }
  | { type: 'fillblank'; prompt: string; answer: string }
  | { type: 'image'; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'columns'; columns: Array<{ content: string; width: number; blocks?: Block[] }> }
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

export default function LessonManagement(){
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const [list, setList] = useState<any[]>([])
  const [filteredList, setFilteredList] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<any>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [assigningLesson, setAssigningLesson] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visualBlocks, setVisualBlocks] = useState<VisualBlock[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [versionNote, setVersionNote] = useState('')
  const [lastEdited, setLastEdited] = useState<{by: string, when: string} | null>(null)
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterTopic, setFilterTopic] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Generate unique ID for new blocks
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Convert regular blocks to visual blocks
  const convertBlocksToVisualBlocks = (blocks: Block[]): VisualBlock[] => {
    return blocks.map(block => {
      switch (block.type) {
        case 'text':
          return { type: 'text', id: generateId(), content: block.content, size: 'medium' };
        case 'video':
          return { type: 'video', id: generateId(), url: block.url, width: 100, height: 200 };
        case 'image':
          return { type: 'image', id: generateId(), url: block.url, alt: block.alt, caption: block.caption, width: block.width || 100, height: block.height || 200 };
        case 'quiz':
          return { type: 'quiz', id: generateId(), question: block.question, options: block.options, answerIndex: block.answerIndex };
        case 'fillblank':
          return { type: 'fillblank', id: generateId(), prompt: block.prompt, answer: block.answer };
        case 'heading':
          return { type: 'heading', id: generateId(), level: block.level, content: block.content, size: block.size || 'medium' };
        case 'columns':
          return { 
            type: 'columns', 
            id: generateId(), 
            columns: block.columns.map(col => ({ 
              id: generateId(), 
              content: col.content, 
              width: col.width,
              blocks: col.blocks ? convertBlocksToVisualBlocks(col.blocks) : []
            })) 
          };
        case 'documents':
          return { type: 'documents', id: generateId(), title: block.title, documents: block.documents };
        default:
          return { type: 'text', id: generateId(), content: '', size: 'medium' };
      }
    });
  };

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
            return { type: 'image', url: vb.url, alt: vb.alt, caption: vb.caption, width: vb.width, height: vb.height };
          case 'quiz':
            return { type: 'quiz', question: vb.question, options: vb.options, answerIndex: vb.answerIndex };
          case 'fillblank':
            return { type: 'fillblank', prompt: vb.prompt, answer: vb.answer };
          case 'heading':
            return { type: 'heading', level: vb.level, content: vb.content, size: vb.size };
          case 'columns':
            return { 
              type: 'columns', 
              columns: vb.columns.map(col => ({
                content: col.content,
                width: col.width,
                blocks: col.blocks ? convertVisualBlocksToBlocks(col.blocks) : []
              }))
            };
          case 'documents':
            return { type: 'documents', title: vb.title, documents: vb.documents };
          default:
            return null;
        }
      })
      .filter(Boolean) as Block[];
  };

  async function save(){
    try{
      const blocksToSave = convertVisualBlocksToBlocks(visualBlocks);
      const res = await api.put(`/lessons/${editingLesson.id}`, { 
        title, 
        description, 
        content: { blocks: blocksToSave },
        versionNote: versionNote || undefined
      })
      setMessage(`Lesson "${title}" updated successfully!`)
      setEditingLesson(null)
      setTitle('')
      setDescription('')
      setVisualBlocks([])
      setVersionNote('')
      await load()
      
      // Navigate back to lesson view
      navigate(`/lessons/${editingLesson.id}`)
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Save failed')
    }
  }

  async function load(){
    try{
      const [lessonsRes, coursesRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/curriculum/courses')
      ])
      setList(lessonsRes.data)
      setFilteredList(lessonsRes.data)
      setCourses(coursesRes.data)
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Load failed')
    }
  }

  async function loadAllTopics(){
    try{
      const res = await api.get('/curriculum/topics')
      setTopics(res.data)
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Load topics failed')
    }
  }

  async function loadLesson(id: string){
    try{
      const res = await api.get(`/lessons/${id}`)
      return res.data
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Load lesson failed')
      return null
    }
  }

  async function deleteLesson(id: string){
    const confirmed = await confirm({
      title: 'Delete Lesson',
      message: 'Are you sure you want to delete this lesson? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    })
    
    if (!confirmed) return
    
    try{
      await api.delete(`/lessons/${id}`)
      setMessage('Lesson deleted successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  async function startEdit(lesson: any){
    const fullLesson = await loadLesson(lesson.id)
    if (fullLesson) {
      setTitle(fullLesson.title)
      setDescription(fullLesson.description || '')
      setVisualBlocks(convertBlocksToVisualBlocks(fullLesson.content?.blocks || []))
      setEditingLesson(fullLesson)
      setLastEdited({
        by: fullLesson.lastEditedBy || 'Unknown',
        when: fullLesson.updatedAt ? new Date(fullLesson.updatedAt).toLocaleString() : 'Unknown'
      })
    }
  }

  function cancelEdit(){
    setEditingLesson(null)
    setTitle('')
    setDescription('')
    setVisualBlocks([])
    setVersionNote('')
    setLastEdited(null)
  }

  async function assignLesson(){
    if (!selectedTopic) {
      setMessage('Please select a topic')
      return
    }
    try{
      await api.post(`/curriculum/topics/${selectedTopic}/lessons`, {
        lessonId: assigningLesson
      })
      setMessage('Lesson assigned successfully')
      setAssigningLesson('')
      setSelectedCourse('')
      setSelectedTopic('')
      await load() // Reload to update the lesson list
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Assignment failed')
    }
  }

  useEffect(() => { 
    load()
    loadAllTopics()
  }, [])

  // Autosave functionality
  const autosaveData = {
    title,
    description,
    visualBlocks,
    editingLessonId: editingLesson?.id
  }

  const { saveNow } = useAutosave(autosaveData, {
    enabled: !!title.trim() && visualBlocks.length > 0,
    delay: 3000,
    onSave: async (data) => {
      if (!editingLesson) {
        // For new lessons, we can't autosave without creating them first
        // Just show that we're tracking changes
        setAutosaveStatus('saving')
        setTimeout(() => setAutosaveStatus('saved'), 500)
        setTimeout(() => setAutosaveStatus(null), 2000)
        return
      }
      
      setAutosaveStatus('saving')
      try {
        const blocksToSave = convertVisualBlocksToBlocks(data.visualBlocks)
        await api.put(`/lessons/${editingLesson.id}`, { 
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

  // Check for edit parameter in URL
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (editId && list.length > 0) {
      const lessonToEdit = list.find(l => l.id === editId)
      if (lessonToEdit) {
        startEdit(lessonToEdit)
      }
    }
  }, [searchParams, list])

  useEffect(() => {
    let filtered = list

    if (searchTerm) {
      filtered = filtered.filter(l => 
        l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.description && l.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (filterCourse) {
      filtered = filtered.filter(l => l.courseId === filterCourse)
    }

    if (filterTopic) {
      filtered = filtered.filter(l => l.topicId === filterTopic)
    }

    setFilteredList(filtered)
  }, [list, searchTerm, filterCourse, filterTopic])

  // If editing, show the visual builder
  if (editingLesson) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg)', zIndex: 1000 }}>
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
            <input 
              placeholder="Version note (optional)" 
              value={versionNote} 
              onChange={e=>setVersionNote(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                minWidth: '200px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {autosaveStatus && (
              <div style={{ 
                fontSize: '12px', 
                color: autosaveStatus === 'saved' ? 'var(--success)' : 
                       autosaveStatus === 'saving' ? 'var(--warning)' : 'var(--error)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {autosaveStatus === 'saved' && '✓ Saved'}
                {autosaveStatus === 'saving' && '⏳ Saving...'}
                {autosaveStatus === 'error' && '⚠ Save failed'}
              </div>
            )}
            {lastEdited && (
              <div style={{ 
                fontSize: '11px', 
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                Last edited by {lastEdited.by} on {lastEdited.when}
              </div>
            )}
            <button onClick={cancelEdit} style={{ padding: '8px 16px' }}>
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
              Update Lesson
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
            onCancel={cancelEdit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Lesson Management</h2>
          <Link className="button" to="/admin/lessons/new">+ New Lesson</Link>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>All Lessons</h3>
          <button 
            style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gap: 12, marginBottom: 16, padding: 16, backgroundColor: 'var(--panel)', borderRadius: '8px' }}>
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
            />
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select
              value={filterTopic}
              onChange={e => setFilterTopic(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
            >
              <option value="">All Topics</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid" style={{ gap: 8 }}>
          {filteredList.map(l => (
            <div key={l.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Link to={`/lessons/${l.id}`} style={{ textDecoration: 'none', color: 'var(--accent)' }}>
                    <strong style={{ color: 'var(--text)' }}>{l.title}</strong>
                  </Link>
                  {l.topicId ? (
                    <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: 4 }}>
                      📚 {courses.find(c => c.id === l.courseId)?.title} → {topics.find(t => t.id === l.topicId)?.title}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.9em', color: 'rgb(239, 68, 68)', marginTop: 4 }}>
                      ⚠️ Not assigned to any topic
                    </div>
                  )}
                  <div style={{ fontSize: '0.8em', color: 'var(--muted)', marginTop: 4 }}>
                    Created: {new Date(l.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button onClick={() => setAssigningLesson(l.id)}>Assign to Topic</button>
                  <button onClick={() => startEdit(l)}>Edit</button>
                  <button onClick={() => deleteLesson(l.id)} className="danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment Modal */}
      {assigningLesson && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg)',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            minWidth: '400px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Assign Lesson to Topic</h3>
              <button
                onClick={() => setAssigningLesson('')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                  Select Course:
                </label>
                <select 
                  value={selectedCourse} 
                  onChange={e => setSelectedCourse(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Choose a course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                  Select Topic:
                </label>
                <select 
                  value={selectedTopic} 
                  onChange={e => setSelectedTopic(e.target.value)}
                  disabled={!selectedCourse}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: selectedCourse ? 'var(--bg)' : 'var(--panel)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    cursor: selectedCourse ? 'pointer' : 'not-allowed'
                  }}
                >
                  <option value="">Choose a topic...</option>
              {topics.filter(t => t.course_id === selectedCourse).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '8px'
              }}>
                <button 
                  onClick={() => setAssigningLesson('')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--border)',
                    color: 'var(--text)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={assignLesson} 
                  disabled={!selectedCourse || !selectedTopic}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: (!selectedCourse || !selectedTopic) ? 'var(--border)' : 'var(--accent)',
                    color: (!selectedCourse || !selectedTopic) ? 'var(--muted)' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!selectedCourse || !selectedTopic) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Assign Lesson
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ 
          padding: 12, 
          backgroundColor: message.includes('successfully') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: 4,
          color: message.includes('successfully') ? '#155724' : '#721c24'
        }}>
          {message}
        </div>
      )}
      
      <HelpButton 
        pageName="Lesson Management" 
        helpContent={`<h4>Lesson Management & Creation</h4>
        
<p><strong>Creating New Lessons:</strong></p>
<ul>
<li>Click "New Lesson" to create a lesson with the visual builder</li>
<li>Use drag-and-drop to add content blocks</li>
<li>Preview mode shows how the lesson will appear to students</li>
</ul>

<p><strong>Visual Builder Features:</strong></p>
<ul>
<li><strong>Text Blocks:</strong> Add paragraphs and formatted text</li>
<li><strong>Headings:</strong> Create section headers with different sizes</li>
<li><strong>Images:</strong> Upload images with captions and resizing</li>
<li><strong>Videos:</strong> Embed YouTube videos or direct video links</li>
<li><strong>Columns:</strong> Create multi-column layouts with nested content</li>
<li><strong>Quizzes:</strong> Add interactive quiz questions</li>
<li><strong>Fill-in-the-blank:</strong> Create completion exercises</li>
</ul>

<p><strong>Editing Existing Lessons:</strong></p>
<ul>
<li>Click "Edit" next to any lesson to modify it</li>
<li>Use the same visual builder interface</li>
<li>Changes are saved automatically</li>
</ul>

<p><strong>Assigning Lessons:</strong></p>
<ul>
<li>Select a course and topic to assign lessons</li>
<li>Lessons must be assigned to topics to be visible to students</li>
<li>Use the search and filter options to find specific lessons</li>
</ul>

<p><strong>Preview Mode:</strong></p>
<ul>
<li>Click "Preview Mode" to see how the lesson will look to students</li>
<li>This shows the exact layout and formatting students will see</li>
<li>Switch back to "Edit Mode" to make changes</li>
</ul>`}
      />
    </div>
  )
}