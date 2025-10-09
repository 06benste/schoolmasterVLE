import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

interface Course {
  id: string;
  title: string;
  description: string;
  assigned_at: string;
  assigned_by_name: string;
  assigned_by_lastname: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  position: number;
  course_title: string;
  assigned_at: string;
  assigned_by_name: string;
  assigned_by_lastname: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  created_at: string;
  course_title: string;
  topic_title: string;
  topic_position: number;
  source_type: 'course' | 'topic';
  source_id: string;
}

export default function MyCourses() {
  const [assignedContent, setAssignedContent] = useState<{
    courses: Course[];
    topics: Topic[];
    lessons: Lesson[];
  }>({ courses: [], topics: [], lessons: [] });
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const response = await api.get('/course-assignments/my-content');
      setAssignedContent(response.data);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLessonsForCourse = (courseId: string) => {
    return assignedContent.lessons.filter(lesson => 
      lesson.source_type === 'course' && lesson.source_id === courseId
    );
  };

  const getLessonsForTopic = (topicId: string) => {
    return assignedContent.lessons.filter(lesson => 
      lesson.source_type === 'topic' && lesson.source_id === topicId
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div>Loading your courses...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 20 }}>My Courses</h1>
      
      {assignedContent.courses.length === 0 && assignedContent.topics.length === 0 ? (
        <div className="card">
          <p className="muted">No courses or topics have been assigned to you yet. Please contact your teacher or administrator.</p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 20 }}>
          {/* Assigned Courses */}
          {assignedContent.courses.map((course) => {
            const courseLessons = getLessonsForCourse(course.id);
            return (
              <div key={course.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, marginBottom: 8 }}>{course.title}</h2>
                    {course.description && (
                      <p className="muted" style={{ margin: 0, marginBottom: 8 }}>{course.description}</p>
                    )}
                    <div className="muted" style={{ fontSize: '0.9em' }}>
                      Assigned by: {course.assigned_by_name} {course.assigned_by_lastname} • 
                      {new Date(course.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    className="button secondary"
                    onClick={() => setSelectedCourse(selectedCourse === course.id ? null : course.id)}
                  >
                    {selectedCourse === course.id ? 'Hide Lessons' : 'View Lessons'}
                  </button>
                </div>

                {selectedCourse === course.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {courseLessons.length === 0 ? (
                      <p className="muted">No lessons available in this course yet.</p>
                    ) : (
                      <div>
                        <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>Lessons in this Course</h3>
                        <div className="grid" style={{ gap: 12 }}>
                          {courseLessons.map((lesson) => (
                            <div key={lesson.id} style={{ padding: 12, backgroundColor: 'var(--border)', borderRadius: 6 }}>
                              <Link 
                                to={`/lessons/${lesson.id}`} 
                                style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 'bold' }}
                              >
                                {lesson.title}
                              </Link>
                              {lesson.description && (
                                <div className="muted" style={{ fontSize: '0.9em', marginTop: 4 }}>
                                  {lesson.description}
                                </div>
                              )}
                              <div className="muted" style={{ fontSize: '0.8em', marginTop: 4 }}>
                                📖 {lesson.topic_title}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Assigned Topics (Individual) */}
          {assignedContent.topics.map((topic) => {
            const topicLessons = getLessonsForTopic(topic.id);
            return (
              <div key={topic.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, marginBottom: 8 }}>
                      {topic.title}
                      <span className="muted" style={{ fontSize: '0.9em', marginLeft: 8 }}>
                        (from {topic.course_title})
                      </span>
                    </h2>
                    {topic.description && (
                      <p className="muted" style={{ margin: 0, marginBottom: 8 }}>{topic.description}</p>
                    )}
                    <div className="muted" style={{ fontSize: '0.9em' }}>
                      Assigned by: {topic.assigned_by_name} {topic.assigned_by_lastname} • 
                      {new Date(topic.assigned_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    className="button secondary"
                    onClick={() => setSelectedCourse(selectedCourse === topic.id ? null : topic.id)}
                  >
                    {selectedCourse === topic.id ? 'Hide Lessons' : 'View Lessons'}
                  </button>
                </div>

                {selectedCourse === topic.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    {topicLessons.length === 0 ? (
                      <p className="muted">No lessons available in this topic yet.</p>
                    ) : (
                      <div>
                        <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>Lessons in this Topic</h3>
                        <div className="grid" style={{ gap: 12 }}>
                          {topicLessons.map((lesson) => (
                            <div key={lesson.id} style={{ padding: 12, backgroundColor: 'var(--border)', borderRadius: 6 }}>
                              <Link 
                                to={`/lessons/${lesson.id}`} 
                                style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 'bold' }}
                              >
                                {lesson.title}
                              </Link>
                              {lesson.description && (
                                <div className="muted" style={{ fontSize: '0.9em', marginTop: 4 }}>
                                  {lesson.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
