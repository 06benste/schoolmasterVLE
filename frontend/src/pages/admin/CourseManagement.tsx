import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import HelpButton from '../../components/HelpButton'
import { CurriculumExportService } from '../../services/curriculumExport'

export default function CourseManagement(){
  const [courses, setCourses] = useState<any[]>([])
  const [topics, setTopics] = useState<any[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [courseTitle, setCourseTitle] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [topicTitle, setTopicTitle] = useState('')
  const [topicDescription, setTopicDescription] = useState('')
  const [editingCourse, setEditingCourse] = useState<any>(null)
  const [editingTopic, setEditingTopic] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showCreateCourseDialog, setShowCreateCourseDialog] = useState(false)
  const [showCreateTopicDialog, setShowCreateTopicDialog] = useState(false)
  const [courseStats, setCourseStats] = useState<{[key: string]: {topics: number, lessons: number}}>({})
  const [topicStats, setTopicStats] = useState<{[key: string]: number}>({})
  const [importing, setImporting] = useState(false)

  async function loadCourses(){
    try{
      const res = await api.get('/curriculum/courses')
      setCourses(res.data)
      if (!selectedCourse && res.data[0]) setSelectedCourse(res.data[0].id)
    }catch{}
  }

  async function loadTopics(){
    if (!selectedCourse) { setTopics([]); return }
    try{
      const res = await api.get(`/curriculum/courses/${selectedCourse}/topics`)
      setTopics(res.data)
    }catch{}
  }

  async function loadCourseStats(){
    try{
      const stats: {[key: string]: {topics: number, lessons: number}} = {}
      for (const course of courses) {
        const topicsRes = await api.get(`/curriculum/courses/${course.id}/topics`)
        const topics = topicsRes.data
        let totalLessons = 0
        
        for (const topic of topics) {
          try {
            const lessonsRes = await api.get(`/curriculum/topics/${topic.id}/lessons`)
            totalLessons += lessonsRes.data.length
          } catch {}
        }
        
        stats[course.id] = { topics: topics.length, lessons: totalLessons }
      }
      setCourseStats(stats)
    }catch{}
  }

  async function loadTopicStats(){
    try{
      const stats: {[key: string]: number} = {}
      for (const topic of topics) {
        try {
          const lessonsRes = await api.get(`/curriculum/topics/${topic.id}/lessons`)
          stats[topic.id] = lessonsRes.data.length
        } catch {}
      }
      setTopicStats(stats)
    }catch{}
  }

  useEffect(() => { loadCourses() }, [])
  useEffect(() => { loadTopics() }, [selectedCourse])
  useEffect(() => { loadCourseStats() }, [courses])
  useEffect(() => { loadTopicStats() }, [topics])

  async function createCourse(){
    if (!courseTitle.trim()) return
    try{
      await api.post('/curriculum/courses', { title: courseTitle, description: courseDescription })
      setCourseTitle('')
      setCourseDescription('')
      setMessage('Course created successfully')
      setShowCreateCourseDialog(false)
      await loadCourses()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to create course')
    }
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
      await loadCourses()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to update course')
    }
  }

  async function deleteCourse(id: string){
    if (!confirm('Are you sure you want to delete this course? This will also delete all topics and lessons in this course.')) return
    try{
      await api.delete(`/curriculum/courses/${id}`)
      setMessage('Course deleted successfully')
      await loadCourses()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to delete course')
    }
  }

  async function createTopic(){
    if (!selectedCourse || !topicTitle.trim()) return
    try{
      await api.post(`/curriculum/courses/${selectedCourse}/topics`, { 
        title: topicTitle, 
        description: topicDescription 
      })
      setTopicTitle('')
      setTopicDescription('')
      setMessage('Topic created successfully')
      setShowCreateTopicDialog(false)
      await loadTopics()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to create topic')
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
      setMessage(err?.response?.data?.error ?? 'Failed to update topic')
    }
  }

  async function deleteTopic(id: string){
    if (!confirm('Are you sure you want to delete this topic? This will also remove all lessons from this topic.')) return
    try{
      await api.delete(`/curriculum/topics/${id}`)
      setMessage('Topic deleted successfully')
      await loadTopics()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Failed to delete topic')
    }
  }

  async function exportCourse(courseId: string, courseTitle: string){
    try{
      setMessage('Exporting course...')
      await CurriculumExportService.downloadCourseExport(courseId, courseTitle)
      setMessage('Course exported successfully!')
    }catch(err: any){
      setMessage(err?.message ?? 'Export failed')
    }
  }

  async function exportTopic(topicId: string, topicTitle: string){
    try{
      setMessage('Exporting topic...')
      await CurriculumExportService.downloadTopicExport(topicId, topicTitle)
      setMessage('Topic exported successfully!')
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
      await loadCourses()
      await loadTopics()
    }catch(err: any){
      if (err?.message !== 'No file selected') {
        setMessage(err?.message ?? 'Import failed')
      }
    }finally{
      setImporting(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      {message && <div className="card" style={{ backgroundColor: '#f0f8ff', border: '1px solid #007acc' }}>{message}</div>}
      
      {/* Course Management */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Course Management</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={importCurriculum}
              disabled={importing}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#38a169', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {importing ? 'Importing...' : '📥 Import Course/Topic'}
            </button>
            <button 
              onClick={() => setShowCreateCourseDialog(true)}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              + Create New Course
            </button>
          </div>
        </div>

        {/* Course List */}
        <div>
          <h4>Existing Courses</h4>
          <div className="grid" style={{ gap: 8 }}>
            {courses.map(course => (
              <div key={course.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{course.title}</strong>
                    {course.description && <div className="muted">{course.description}</div>}
                    <div className="muted" style={{ fontSize: '0.9em' }}>
                      {courseStats[course.id] && (
                        <>
                          {courseStats[course.id].topics} topics, {courseStats[course.id].lessons} lessons
                        </>
                      )}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button onClick={() => exportCourse(course.id, course.title)} style={{ backgroundColor: '#3182ce', color: 'white' }}>📤 Export</button>
                    <button onClick={() => setEditingCourse({...course})}>Edit</button>
                    <button onClick={() => deleteCourse(course.id)} className="danger">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Topic Management */}
      <div className="card">
        <h3>Topic Management</h3>
        
        {/* Course Selection */}
        <div style={{ marginBottom: 16 }}>
          <h4>Select Course</h4>
          <select 
            value={selectedCourse} 
            onChange={e => setSelectedCourse(e.target.value)}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <option value="">Select a course to manage topics</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
        </div>

        {selectedCourse && (
          <>
            {/* Create Topic Button */}
            <div style={{ marginBottom: 16 }}>
              <button 
                onClick={() => setShowCreateTopicDialog(true)}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: '#4299e1', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Create New Topic
              </button>
            </div>

            {/* Topic List */}
            <div>
              <h4>Topics in {courses.find(c => c.id === selectedCourse)?.title}</h4>
              <div className="grid" style={{ gap: 8 }}>
                {topics.map(topic => (
                  <div key={topic.id} className="card">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{topic.title}</strong>
                        {topic.description && <div className="muted">{topic.description}</div>}
                        <div className="muted" style={{ fontSize: '0.9em' }}>
                          {topicStats[topic.id] !== undefined && (
                            <>
                              {topicStats[topic.id]} lessons
                            </>
                          )}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button onClick={() => exportTopic(topic.id, topic.title)} style={{ backgroundColor: '#3182ce', color: 'white' }}>📤 Export</button>
                        <button onClick={() => setEditingTopic({...topic})}>Edit</button>
                        <button onClick={() => deleteTopic(topic.id)} className="danger">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
                {topics.length === 0 && (
                  <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
                    No topics created yet for this course.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 500,
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 24, fontSize: '1.5em' }}>Edit Course</h3>
          <div className="grid cols-2" style={{ gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Course Title
              </label>
              <input 
                placeholder="Enter course title" 
                value={editingCourse.title} 
                onChange={e => setEditingCourse({...editingCourse, title: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Description (Optional)
              </label>
              <input 
                placeholder="Enter course description" 
                value={editingCourse.description || ''} 
                onChange={e => setEditingCourse({...editingCourse, description: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setEditingCourse(null)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >Cancel</button>
            <button 
              onClick={updateCourse}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >Update Course</button>
          </div>
          {message && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px', 
              borderRadius: '8px', 
              backgroundColor: message.includes('updated') ? '#22543d' : '#742a2a',
              color: message.includes('updated') ? '#68d391' : '#fc8181',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Edit Topic Modal */}
      {editingTopic && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 500,
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 24, fontSize: '1.5em' }}>Edit Topic</h3>
          <div className="grid cols-2" style={{ gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Topic Title
              </label>
              <input 
                placeholder="Enter topic title" 
                value={editingTopic.title} 
                onChange={e => setEditingTopic({...editingTopic, title: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Description (Optional)
              </label>
              <input 
                placeholder="Enter topic description" 
                value={editingTopic.description || ''} 
                onChange={e => setEditingTopic({...editingTopic, description: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setEditingTopic(null)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >Cancel</button>
            <button 
              onClick={updateTopic}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >Update Topic</button>
          </div>
          {message && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px', 
              borderRadius: '8px', 
              backgroundColor: message.includes('updated') ? '#22543d' : '#742a2a',
              color: message.includes('updated') ? '#68d391' : '#fc8181',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Create Course Dialog */}
      {showCreateCourseDialog && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 500,
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 24, fontSize: '1.5em' }}>Create New Course</h3>
          <div className="grid cols-2" style={{ gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Course Title
              </label>
              <input 
                placeholder="Enter course title" 
                value={courseTitle} 
                onChange={e => setCourseTitle(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Description (Optional)
              </label>
              <input 
                placeholder="Enter course description" 
                value={courseDescription} 
                onChange={e => setCourseDescription(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowCreateCourseDialog(false)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >Cancel</button>
            <button 
              onClick={createCourse}
              disabled={!courseTitle.trim()}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: !courseTitle.trim() ? 0.5 : 1
              }}
            >Create Course</button>
          </div>
          {message && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px', 
              borderRadius: '8px', 
              backgroundColor: message.includes('created') ? '#22543d' : '#742a2a',
              color: message.includes('created') ? '#68d391' : '#fc8181',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Create Topic Dialog */}
      {showCreateTopicDialog && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 500,
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 24, fontSize: '1.5em' }}>Create New Topic</h3>
          <div className="grid cols-2" style={{ gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Topic Title
              </label>
              <input 
                placeholder="Enter topic title" 
                value={topicTitle} 
                onChange={e => setTopicTitle(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
                Description (Optional)
              </label>
              <input 
                placeholder="Enter topic description" 
                value={topicDescription} 
                onChange={e => setTopicDescription(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowCreateTopicDialog(false)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >Cancel</button>
            <button 
              onClick={createTopic}
              disabled={!topicTitle.trim()}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: !topicTitle.trim() ? 0.5 : 1
              }}
            >Create Topic</button>
          </div>
          {message && (
            <div style={{ 
              marginTop: 16, 
              padding: '12px', 
              borderRadius: '8px', 
              backgroundColor: message.includes('created') ? '#22543d' : '#742a2a',
              color: message.includes('created') ? '#68d391' : '#fc8181',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}
        </div>
      )}
      
      <HelpButton 
        pageName="Course Management" 
        helpContent={`<h4>Course & Topic Management</h4>
        
<p><strong>Creating Courses:</strong></p>
<ul>
<li>Click "Create New Course" to add a new course</li>
<li>Enter a title and optional description</li>
<li>Courses organize related topics together</li>
</ul>

<p><strong>Managing Topics:</strong></p>
<ul>
<li>Select a course from the dropdown to view its topics</li>
<li>Click "Create New Topic" to add topics to the selected course</li>
<li>Topics contain individual lessons</li>
<li>Each topic shows how many lessons are assigned to it</li>
</ul>

<p><strong>Course Statistics:</strong></p>
<ul>
<li>Each course shows the number of topics and total lessons</li>
<li>Each topic shows the number of lessons assigned</li>
<li>Use this information to track content organization</li>
</ul>

<p><strong>Editing & Deleting:</strong></p>
<ul>
<li>Click "Edit" to modify course or topic details</li>
<li>Click "Delete" to remove courses or topics</li>
<li>Deleting a course will also delete all its topics</li>
</ul>`}
      />
    </div>
  )
}
