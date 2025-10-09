import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import VisualLessonBuilder from '../../components/VisualLessonBuilder'

type Block =
  | { type: 'video'; url: string }
  | { type: 'text'; content: string; formatting?: {
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
  const [courses, setCourses] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  // Load courses and topics when link dialog is opened
  async function loadCourses() {
    try {
      const res = await api.get('/curriculum/courses')
      setCourses(res.data)
      if (res.data.length > 0) {
        setSelectedCourse(res.data[0].id)
      }
    } catch (err) {
      console.error('Failed to load courses:', err)
    }
  }

  async function loadTopics(courseId: string) {
    if (!courseId) {
      setTopics([])
      setSelectedTopic('')
      return
    }
    try {
      const res = await api.get(`/curriculum/courses/${courseId}/topics`)
      setTopics(res.data)
      if (res.data.length > 0) {
        setSelectedTopic(res.data[0].id)
      } else {
        setSelectedTopic('')
      }
    } catch (err) {
      console.error('Failed to load topics:', err)
    }
  }

  async function openLinkDialog() {
    setShowLinkDialog(true)
    await loadCourses()
  }

  async function handleCourseChange(courseId: string) {
    setSelectedCourse(courseId)
    await loadTopics(courseId)
  }

  // Load topics when course changes
  useEffect(() => {
    if (selectedCourse) {
      loadTopics(selectedCourse)
    }
  }, [selectedCourse])

  // Convert visual blocks to regular blocks for saving
  const convertVisualBlocksToBlocks = (visualBlocks: VisualBlock[]): Block[] => {
    return visualBlocks
      .filter(vb => ['text', 'video', 'image', 'quiz', 'fillblank', 'heading', 'columns', 'documents'].includes(vb.type))
      .map(vb => {
        switch (vb.type) {
          case 'text':
            return { type: 'text', content: vb.content, formatting: vb.formatting, links: vb.links };
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
      const lessonId = res.data.id
      
      // If a topic was selected, link the lesson to it
      if (selectedTopic) {
        try {
          await api.post(`/curriculum/topics/${selectedTopic}/lessons`, { lessonId })
          setMessage(`Lesson "${title}" created and linked to topic successfully!`)
        } catch (linkErr) {
          setMessage(`Lesson created but failed to link to topic`)
        }
      } else {
        setMessage(`Lesson "${title}" created successfully!`)
      }
      
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
          {selectedTopic && (
            <span style={{
              padding: '6px 12px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent)',
              borderRadius: '4px',
              fontSize: '0.9em',
              border: '1px solid var(--accent)'
            }}>
              Linked to: {topics.find(t => t.id === selectedTopic)?.title || 'Topic'}
            </span>
          )}
          <button 
            onClick={openLinkDialog}
            style={{ 
              padding: '8px 16px',
              backgroundColor: selectedTopic ? 'var(--bg)' : 'var(--accent-light)',
              color: selectedTopic ? 'var(--text)' : 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {selectedTopic ? 'Change Topic' : 'Link to Topic'}
          </button>
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

      {/* Link to Topic Dialog */}
      {showLinkDialog && (
        <>
          <div className="modal-overlay" onClick={() => setShowLinkDialog(false)} />
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3 className="modal-header">Link Lesson to Topic</h3>
            <div className="modal-content">
              <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9em' }}>
                Link this lesson to a topic in your curriculum. This is optional - you can skip this and organize lessons later.
              </p>
              
              {courses.length === 0 ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px'
                }}>
                  No courses available. Create a course first in the Curriculum section.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Select Course</label>
                    <select 
                      className="form-select"
                      value={selectedCourse}
                      onChange={(e) => handleCourseChange(e.target.value)}
                    >
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCourse && (
                    <div className="form-group">
                      <label className="form-label">Select Topic</label>
                      {topics.length === 0 ? (
                        <div style={{ 
                          padding: '12px', 
                          color: 'var(--muted)', 
                          fontSize: '0.9em',
                          border: '1px solid var(--border)',
                          borderRadius: '4px'
                        }}>
                          No topics available in this course. Create a topic first.
                        </div>
                      ) : (
                        <select 
                          className="form-select"
                          value={selectedTopic}
                          onChange={(e) => setSelectedTopic(e.target.value)}
                        >
                          {topics.map(topic => (
                            <option key={topic.id} value={topic.id}>
                              {topic.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setSelectedCourse('')
                  setSelectedTopic('')
                  setShowLinkDialog(false)
                }}
              >
                Clear & Close
              </button>
              <button 
                className="btn-primary"
                onClick={() => setShowLinkDialog(false)}
                disabled={!selectedTopic}
              >
                {selectedTopic ? 'Link to Topic' : 'Close'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}