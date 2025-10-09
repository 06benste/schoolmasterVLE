import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { CurriculumExportService } from '../../services/curriculumExport'

export default function Curriculum(){
  const [courses, setCourses] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [topicLessons, setTopicLessons] = useState<any[]>([])
  const [courseTitle, setCourseTitle] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [lessonToAssign, setLessonToAssign] = useState<string>('')
  const [editingCourse, setEditingCourse] = useState<any>(null)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  async function load(){
    const [c, l] = await Promise.all([
      api.get('/curriculum/courses'),
      api.get('/lessons')
    ])
    setCourses(c.data); setLessons(l.data)
    if (!selectedCourse && c.data[0]) setSelectedCourse(c.data[0].id)
  }

  async function loadTopics(){
    if (!selectedCourse) { setTopics([]); setTopicLessons([]); return }
    const t = await api.get(`/curriculum/courses/${selectedCourse}/topics`)
    setTopics(t.data)
    if (!selectedTopic && t.data[0]) setSelectedTopic(t.data[0].id)
  }

  async function loadTopicLessons(){
    if (!selectedTopic) { setTopicLessons([]); return }
    try{
      const res = await api.get(`/curriculum/topics/${selectedTopic}/lessons`)
      setTopicLessons(res.data)
    }catch{}
  }

  async function removeLessonFromTopic(lessonId: string){
    if (!confirm('Remove this lesson from the topic?')) return
    try{
      await api.delete(`/curriculum/topics/${selectedTopic}/lessons/${lessonId}`)
      setMessage('Lesson removed from topic')
      await loadTopicLessons()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Removal failed')
    }
  }

  useEffect(()=>{ load() },[])
  useEffect(()=>{ loadTopics() },[selectedCourse])
  useEffect(()=>{ loadTopicLessons() },[selectedTopic])

  async function createCourse(){
    await api.post('/curriculum/courses', { title: courseTitle })
    setCourseTitle('')
    await load()
  }

  async function createTopic(){
    if (!selectedCourse) return
    await api.post(`/curriculum/courses/${selectedCourse}/topics`, { title: topicTitle })
    setTopicTitle('')
    await loadTopics()
  }

  async function assignLesson(){
    if (!selectedTopic || !lessonToAssign) return
    await api.post(`/curriculum/topics/${selectedTopic}/lessons`, { lessonId: lessonToAssign })
    setLessonToAssign('')
    await loadTopicLessons()
  }

  async function updateCourse(){
    if (!editingCourse) return
    try{
      await api.put(`/curriculum/courses/${editingCourse.id}`, { 
        title: editingCourse.title, 
        description: editingCourse.description 
      })
      setMessage('Course updated successfully')
      setEditingCourse(null)
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Update failed')
    }
  }

  async function deleteCourse(id: string){
    if (!confirm('Are you sure you want to delete this course? This will also delete all topics and lessons in this course.')) return
    try{
      await api.delete(`/curriculum/courses/${id}`)
      setMessage('Course deleted successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  async function updateTopic(){
    if (!editingTopic) return
    try{
      await api.put(`/curriculum/topics/${editingTopic.id}`, { 
        title: editingTopic.title, 
        description: editingTopic.description 
      })
      setMessage('Topic updated successfully')
      setEditingTopic(null)
      await loadTopics()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Update failed')
    }
  }

  async function deleteTopic(id: string){
    if (!confirm('Are you sure you want to delete this topic?')) return
    try{
      await api.delete(`/curriculum/topics/${id}`)
      setMessage('Topic deleted successfully')
      await loadTopics()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  async function exportCourse(courseId: string, courseTitle: string){
    try{
      setMessage('Exporting course...')
      await CurriculumExportService.downloadCourseExport(courseId, courseTitle)
      setMessage('Course exported successfully')
    }catch(err: any){
      setMessage(err?.message ?? 'Export failed')
    }
  }

  async function exportTopic(topicId: string, topicTitle: string){
    try{
      setMessage('Exporting topic...')
      await CurriculumExportService.downloadTopicExport(topicId, topicTitle)
      setMessage('Topic exported successfully')
    }catch(err: any){
      setMessage(err?.message ?? 'Export failed')
    }
  }

  async function importCurriculum(){
    try{
      setImporting(true)
      setMessage('Select ZIP file to import...')
      const file = await CurriculumExportService.loadFile()
      setMessage('Importing curriculum...')
      const result = await CurriculumExportService.importCurriculum(file)
      setMessage(result.message)
      await load()
      await loadTopics()
    }catch(err: any){
      setMessage(err?.message ?? 'Import failed')
    }finally{
      setImporting(false)
    }
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      {message && <div className="card">{message}</div>}
      
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Curriculum Management</h3>
          <button 
            onClick={importCurriculum} 
            disabled={importing}
            style={{ 
              backgroundColor: '#38a169', 
              color: 'white', 
              padding: '8px 16px', 
              border: 'none', 
              borderRadius: '6px',
              cursor: importing ? 'not-allowed' : 'pointer'
            }}
          >
            {importing ? 'Importing...' : '📥 Import Course/Topic'}
          </button>
        </div>
      </div>
      
      <div className="card">
        <h3>Courses</h3>
        <div className="row" style={{ gap:8 }}>
          <input placeholder="New course title" value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} />
          <button onClick={createCourse}>Add course</button>
        </div>
        <div className="space" />
        <select value={selectedCourse} onChange={e=>{ setSelectedCourse(e.target.value); setSelectedTopic('') }}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        
        <div className="space" />
        <div className="grid" style={{ gap: 8 }}>
          {courses.map(c => (
            <div key={c.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.title}</strong>
                  {c.description && <div className="muted">{c.description}</div>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button onClick={() => exportCourse(c.id, c.title)} style={{ backgroundColor: '#3182ce', color: 'white' }}>📤 Export</button>
                  <button onClick={() => setEditingCourse({...c})}>Edit</button>
                  <button onClick={() => deleteCourse(c.id)} className="danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Topics</h3>
        <div className="row" style={{ gap:8 }}>
          <input placeholder="New topic title" value={topicTitle} onChange={e=>setTopicTitle(e.target.value)} />
          <button onClick={createTopic}>Add topic</button>
        </div>
        <div className="space" />
        <select value={selectedTopic} onChange={e=>setSelectedTopic(e.target.value)}>
          {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        
        <div className="space" />
        <div className="grid" style={{ gap: 8 }}>
          {topics.map(t => (
            <div key={t.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{t.title}</strong>
                  {t.description && <div className="muted">{t.description}</div>}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button onClick={() => exportTopic(t.id, t.title)} style={{ backgroundColor: '#3182ce', color: 'white' }}>📤 Export</button>
                  <button onClick={() => setEditingTopic({...t})}>Edit</button>
                  <button onClick={() => deleteTopic(t.id)} className="danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Assign Lessons to Topic</h3>
        <div className="grid cols-3">
          <select value={lessonToAssign} onChange={e=>setLessonToAssign(e.target.value)}>
            <option value="">Select lesson</option>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <button onClick={assignLesson}>Assign</button>
        </div>
        <div className="space" />
        <div className="muted">Topic lessons will appear in the learning path for that topic.</div>
      </div>

      {selectedTopic && (
        <div className="card">
          <h3>Lessons in Selected Topic</h3>
          {topicLessons.length === 0 ? (
            <div className="muted">No lessons assigned to this topic yet.</div>
          ) : (
            <div className="grid" style={{ gap: 8 }}>
              {topicLessons.map(lesson => (
                <div key={lesson.id} className="card">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{lesson.title}</strong>
                      {lesson.description && <div className="muted">{lesson.description}</div>}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={() => removeLessonFromTopic(lesson.id)} className="danger">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingCourse && (
        <div className="card">
          <h3>Edit Course</h3>
          <div className="grid cols-2">
            <input 
              placeholder="Course title" 
              value={editingCourse.title} 
              onChange={e => setEditingCourse({...editingCourse, title: e.target.value})} 
            />
            <input 
              placeholder="Description (optional)" 
              value={editingCourse.description || ''} 
              onChange={e => setEditingCourse({...editingCourse, description: e.target.value})} 
            />
            <div className="row" style={{ gap: 8 }}>
              <button onClick={updateCourse}>Update Course</button>
              <button onClick={() => setEditingCourse(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingTopic && (
        <div className="card">
          <h3>Edit Topic</h3>
          <div className="grid cols-2">
            <input 
              placeholder="Topic title" 
              value={editingTopic.title} 
              onChange={e => setEditingTopic({...editingTopic, title: e.target.value})} 
            />
            <input 
              placeholder="Description (optional)" 
              value={editingTopic.description || ''} 
              onChange={e => setEditingTopic({...editingTopic, description: e.target.value})} 
            />
            <div className="row" style={{ gap: 8 }}>
              <button onClick={updateTopic}>Update Topic</button>
              <button onClick={() => setEditingTopic(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


