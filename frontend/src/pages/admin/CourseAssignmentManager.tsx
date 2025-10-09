import { useEffect, useState, useMemo } from 'react';
import { api } from '../../api/client';

interface Course {
  id: string;
  title: string;
  description: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  course_id: string;
  course_title?: string;
}

interface Student {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
}

interface Class {
  id: string;
  name: string;
  teacher_id: string;
}

interface CourseAssignment {
  id: string;
  course_id: string;
  course_title: string;
  course_description: string;
  target_type: 'student' | 'class';
  target_id: string;
  target_name: string;
  assigned_at: string;
  assigned_by_name: string;
  assigned_by_lastname: string;
}

interface TopicAssignment {
  id: string;
  topic_id: string;
  topic_title: string;
  topic_description: string;
  course_title: string;
  target_type: 'student' | 'class';
  target_id: string;
  target_name: string;
  assigned_at: string;
  assigned_by_name: string;
  assigned_by_lastname: string;
}

export default function CourseAssignmentManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignment[]>([]);
  const [topicAssignments, setTopicAssignments] = useState<TopicAssignment[]>([]);
  
  const [showCourseAssignmentModal, setShowCourseAssignmentModal] = useState(false);
  const [showTopicAssignmentModal, setShowTopicAssignmentModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<Array<{ type: 'student' | 'class'; id: string; name: string }>>([]);
  const [targetType, setTargetType] = useState<'student' | 'class'>('student');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter students/classes based on search term
  const filteredTargets = useMemo(() => {
    const items = targetType === 'student' ? students : classes;
    if (!searchTerm.trim()) return items;
    
    const search = searchTerm.toLowerCase();
    return items.filter(item => {
      if (targetType === 'student') {
        const student = item as Student;
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
        return (
          student.username?.toLowerCase().includes(search) ||
          student.firstName?.toLowerCase().includes(search) ||
          student.lastName?.toLowerCase().includes(search) ||
          student.email?.toLowerCase().includes(search) ||
          fullName.includes(search)
        );
      } else {
        const cls = item as Class;
        return cls.name?.toLowerCase().includes(search);
      }
    });
  }, [students, classes, targetType, searchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, topicsRes, studentsRes, classesRes, courseAssignmentsRes, topicAssignmentsRes] = await Promise.all([
        api.get('/curriculum/courses'),
        api.get('/curriculum/topics'),
        api.get('/users'),
        api.get('/classes/placeholder-list'),
        api.get('/course-assignments/courses/assignments'),
        api.get('/course-assignments/topics/assignments')
      ]);



      setCourses(coursesRes.data);
      setTopics(topicsRes.data);
      setStudents(studentsRes.data.filter((u: Student) => u.role === 'student'));
      setClasses(classesRes.data);
      setCourseAssignments(courseAssignmentsRes.data);
      setTopicAssignments(topicAssignmentsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      console.error('Error details:', error);
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedCourseId || selectedTargets.length === 0) {
      alert('Please select a course and at least one target.');
      return;
    }

    try {
      await api.post('/course-assignments/courses/assign', {
        courseId: selectedCourseId,
        targets: selectedTargets.map(t => ({ type: t.type, id: t.id }))
      });

      setShowCourseAssignmentModal(false);
      setSelectedCourseId('');
      setSelectedTargets([]);
      loadData();
    } catch (error: any) {
      console.error('Failed to assign course:', error);
      const errorMessage = error?.response?.data?.error || 'Failed to assign course.';
      alert(errorMessage);
    }
  };

  const handleAssignTopic = async () => {
    if (!selectedTopicId || selectedTargets.length === 0) {
      alert('Please select a topic and at least one target.');
      return;
    }

    try {
      await api.post('/course-assignments/topics/assign', {
        topicId: selectedTopicId,
        targets: selectedTargets.map(t => ({ type: t.type, id: t.id }))
      });

      setShowTopicAssignmentModal(false);
      setSelectedTopicId('');
      setSelectedTargets([]);
      loadData();
    } catch (error: any) {
      console.error('Failed to assign topic:', error);
      const errorMessage = error?.response?.data?.error || 'Failed to assign topic.';
      alert(errorMessage);
    }
  };

  const handleRemoveCourseAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this course assignment?')) return;

    try {
      await api.delete(`/course-assignments/courses/${assignmentId}`);
      loadData();
    } catch (error) {
      console.error('Failed to remove course assignment:', error);
      alert('Failed to remove course assignment.');
    }
  };

  const handleRemoveTopicAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this topic assignment?')) return;

    try {
      await api.delete(`/course-assignments/topics/${assignmentId}`);
      loadData();
    } catch (error) {
      console.error('Failed to remove topic assignment:', error);
      alert('Failed to remove topic assignment.');
    }
  };

  const toggleTarget = (type: 'student' | 'class', id: string, name: string) => {
    const target = { type, id, name };
    setSelectedTargets(prev => {
      const exists = prev.find(t => t.type === type && t.id === id);
      if (exists) {
        return prev.filter(t => !(t.type === type && t.id === id));
      } else {
        return [...prev, target];
      }
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Manage Access - Courses & Topics</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="button" 
            onClick={() => {
              setShowCourseAssignmentModal(true);
              setSearchTerm('');
              setSelectedTargets([]);
            }}
            style={{ backgroundColor: '#007acc', color: 'white' }}
          >
            Assign Course
          </button>
          <button 
            className="button" 
            onClick={() => {
              setShowTopicAssignmentModal(true);
              setSearchTerm('');
              setSelectedTargets([]);
            }}
            style={{ backgroundColor: '#28a745', color: 'white' }}
          >
            Assign Topic
          </button>
        </div>
      </div>

      {/* Course Assignments */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 15 }}>Course Assignments</h2>
        {courseAssignments.length === 0 ? (
          <p className="muted">No course assignments yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--border)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Course</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Assigned To</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Assigned By</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courseAssignments.map((assignment) => (
                  <tr key={assignment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{assignment.course_title}</div>
                      <div className="muted" style={{ fontSize: '0.9em' }}>{assignment.course_description}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{assignment.target_name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8em',
                        backgroundColor: assignment.target_type === 'student' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                        color: assignment.target_type === 'student' ? '#60a5fa' : '#c084fc'
                      }}>
                        {assignment.target_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {assignment.assigned_by_name} {assignment.assigned_by_lastname}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button 
                        className="button" 
                        onClick={() => handleRemoveCourseAssignment(assignment.id)}
                        style={{ backgroundColor: '#dc3545', color: 'white', fontSize: '0.8em', padding: '4px 8px' }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Topic Assignments */}
      <div className="card">
        <h2 style={{ marginBottom: 15 }}>Topic Assignments</h2>
        {topicAssignments.length === 0 ? (
          <p className="muted">No topic assignments yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Topic</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Course</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Assigned To</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Assigned By</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {topicAssignments.map((assignment) => (
                  <tr key={assignment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{assignment.topic_title}</div>
                      <div className="muted" style={{ fontSize: '0.9em' }}>{assignment.topic_description}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{assignment.course_title}</td>
                    <td style={{ padding: '12px' }}>{assignment.target_name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8em',
                        backgroundColor: assignment.target_type === 'student' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                        color: assignment.target_type === 'student' ? '#60a5fa' : '#c084fc'
                      }}>
                        {assignment.target_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {assignment.assigned_by_name} {assignment.assigned_by_lastname}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button 
                        className="button" 
                        onClick={() => handleRemoveTopicAssignment(assignment.id)}
                        style={{ backgroundColor: '#dc3545', color: 'white', fontSize: '0.8em', padding: '4px 8px' }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Course Assignment Modal */}
      {showCourseAssignmentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: 16, color: '#333', fontSize: '1.3em' }}>Assign Course</h2>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Select Course:
              </label>
              <select 
                value={selectedCourseId} 
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="">Choose a course...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Assignment Type:
              </label>
              <select 
                value={targetType} 
                onChange={(e) => {
                  setTargetType(e.target.value as 'student' | 'class');
                  setSearchTerm('');
                }}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="student">Students</option>
                <option value="class">Classes</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Select Classes/Students:
              </label>
              <input
                type="text"
                placeholder={`Search ${targetType === 'student' ? 'students' : 'classes'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px', 
                  marginBottom: '6px',
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  color: '#333',
                  fontSize: '12px'
                }}
              />
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {filteredTargets.length === 0 ? (
                  <div style={{ padding: '12px', color: '#999', textAlign: 'center', fontSize: '12px' }}>
                    No {targetType === 'student' ? 'students' : 'classes'} found
                  </div>
                ) : (
                  filteredTargets.map((item) => (
                    <label key={item.id} style={{ display: 'block', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTargets.some(t => t.type === targetType && t.id === item.id)}
                        onChange={() => toggleTarget(targetType, item.id, targetType === 'student' ? `${(item as Student).firstName} ${(item as Student).lastName}` : (item as Class).name)}
                        style={{ marginRight: 8 }}
                      />
                      {targetType === 'student' ? `${(item as Student).firstName} ${(item as Student).lastName}` : (item as Class).name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button 
                className="button" 
                onClick={() => setShowCourseAssignmentModal(false)}
                style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                className="button" 
                onClick={handleAssignCourse}
                style={{ backgroundColor: '#007acc', color: 'white', padding: '8px 16px', fontSize: '13px' }}
              >
                Assign Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Assignment Modal */}
      {showTopicAssignmentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: 16, color: '#333', fontSize: '1.3em' }}>Assign Topic</h2>
            
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Select Topic:
              </label>
              <select 
                value={selectedTopicId} 
                onChange={(e) => setSelectedTopicId(e.target.value)}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="">Choose a topic...</option>
                {topics.map(topic => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title} ({topic.course_title})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Assignment Type:
              </label>
              <select 
                value={targetType} 
                onChange={(e) => {
                  setTargetType(e.target.value as 'student' | 'class');
                  setSearchTerm('');
                }}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="student">Students</option>
                <option value="class">Classes</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 'bold', color: '#333', fontSize: '13px' }}>
                Select Classes/Students:
              </label>
              <input
                type="text"
                placeholder={`Search ${targetType === 'student' ? 'students' : 'classes'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px', 
                  marginBottom: '6px',
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  color: '#333',
                  fontSize: '12px'
                }}
              />
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {filteredTargets.length === 0 ? (
                  <div style={{ padding: '12px', color: '#999', textAlign: 'center', fontSize: '12px' }}>
                    No {targetType === 'student' ? 'students' : 'classes'} found
                  </div>
                ) : (
                  filteredTargets.map((item) => (
                    <label key={item.id} style={{ display: 'block', padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTargets.some(t => t.type === targetType && t.id === item.id)}
                        onChange={() => toggleTarget(targetType, item.id, targetType === 'student' ? `${(item as Student).firstName} ${(item as Student).lastName}` : (item as Class).name)}
                        style={{ marginRight: 8 }}
                      />
                      {targetType === 'student' ? `${(item as Student).firstName} ${(item as Student).lastName}` : (item as Class).name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button 
                className="button" 
                onClick={() => setShowTopicAssignmentModal(false)}
                style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button 
                className="button" 
                onClick={handleAssignTopic}
                style={{ backgroundColor: '#28a745', color: 'white', padding: '8px 16px', fontSize: '13px' }}
              >
                Assign Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
