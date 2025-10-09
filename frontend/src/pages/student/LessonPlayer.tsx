import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'

type Block =
  | { type: 'video'; url: string }
  | { type: 'text'; content: string }
  | { type: 'quiz'; question: string; options: string[]; answerIndex: number }
  | { type: 'fillblank'; prompt: string; answer: string }
  | { type: 'image'; url: string; alt: string; caption?: string; width?: number; height?: number }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: string; size?: 'small' | 'medium' | 'large' }
  | { type: 'columns'; columns: Array<{ content: string; width: number; blocks?: Block[] }> }
  | { type: 'documents'; title: string; documents: Array<{ id: string; name: string; url: string; size: number; type: string }> }

export default function LessonPlayer(){
  const [sp] = useSearchParams()
  const lessonId = sp.get('lessonId')
  const assignmentId = sp.get('assignmentId')
  const [lesson, setLesson] = useState<any | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState<{ completed: boolean } | null>(null)

  useEffect(() => {
    async function load(){
      if (!lessonId) return
      const res = await api.get(`/lessons/${lessonId}`)
      setLesson(res.data)
      
      // Track assignment access if this is an assignment
      if (assignmentId) {
        try {
          await api.post(`/assignments/${assignmentId}/access`)
          
          // Check if assignment is already completed
          const assignmentRes = await api.get('/assignments/my')
          const currentAssignment = assignmentRes.data.find((a: any) => a.id === assignmentId)
          if (currentAssignment && currentAssignment.status === 'completed') {
            setSubmitted({ completed: true })
          }
        } catch (error) {
          console.error('Failed to track assignment access:', error)
        }
      }
    }
    load()
  }, [lessonId, assignmentId])

  const blocks: Block[] = useMemo(()=> lesson?.content?.blocks ?? [], [lesson])

  function updateAnswer(idx: number, val: any){
    setAnswers(a => ({ ...a, [idx]: val }))
  }

  // For lessons, we only track completion, not scores
  function isCompleted(){
    // Check if all interactive elements have been answered
    let hasInteractiveElements = false
    let allAnswered = true
    
    blocks.forEach((b, i) => {
      if (b.type === 'quiz' || b.type === 'fillblank'){
        hasInteractiveElements = true
        if (answers[i] === undefined || answers[i] === '') {
          allAnswered = false
        }
      }
    })
    
    // If no interactive elements, consider completed when viewed
    if (!hasInteractiveElements) {
      return true
    }
    
    return allAnswered
  }

  // Check if lesson has interactive elements
  const hasInteractiveElements = blocks.some(b => b.type === 'quiz' || b.type === 'fillblank')

  async function submit(){
    const completed = isCompleted()
    setSubmitted({ completed })
    if (assignmentId){
      // For lessons, we only track completion status, not scores
      await api.post(`/assignments/${assignmentId}/attempts`, { 
        completed: completed,
        data: { answers } 
      })
    }
  }

  if (!lesson) return <div>Loading...</div>

  return (
    <div className="grid" style={{ gap:12 }}>
      <div className="card">
        <h2>{lesson.title}</h2>
        {lesson.description && <div className="muted">{lesson.description}</div>}
      </div>

      {blocks.map((b, i) => (
        <div className="card" key={i}>
          {b.type==='text' && (
            <div>{b.content}</div>
          )}
          {b.type==='video' && (
            <div>
              {/* naive embed handling: if YouTube URL, use iframe */}
              {b.url.includes('youtube.com') || b.url.includes('youtu.be') ? (
                <iframe width="560" height="315" src={b.url.replace('watch?v=','embed/')} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
              ) : (
                <video src={b.url} controls style={{ maxWidth:'100%' }} />
              )}
            </div>
          )}
          {b.type==='documents' && (
            <div style={{
              padding: '20px',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)',
              margin: '16px 0'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: '1.2em',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📁 {b.title}
              </h3>
              
              {b.documents.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  color: 'var(--muted)',
                  fontStyle: 'italic',
                  padding: '20px'
                }}>
                  No documents available
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {b.documents.map((doc) => {
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
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {b.type==='image' && (
            <div>
              <img 
                src={b.url} 
                alt={b.alt || 'Image'} 
                style={{ 
                  width: b.width ? `${b.width}%` : '100%', 
                  height: 'auto', 
                  borderRadius: '8px'
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
              {b.caption && (
                <div style={{ marginTop: '8px', fontSize: '0.9em', color: '#666', fontStyle: 'italic' }}>
                  {b.caption}
                </div>
              )}
            </div>
          )}
          {b.type==='quiz' && (
            <div style={{
              padding: '20px',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)',
              margin: '16px 0'
            }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '18px',
                marginBottom: '16px',
                color: 'var(--text)'
              }}>
                ❓ {b.question}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {b.options.map((opt, k) => (
                  <label 
                    key={k} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      border: answers[i] === k ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: '8px',
                      backgroundColor: answers[i] === k ? 'var(--accent-light)' : 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '16px'
                    }}
                  >
                    <input 
                      type="radio" 
                      name={`q-${i}`} 
                      checked={answers[i]===k} 
                      onChange={()=>updateAnswer(i,k)}
                      style={{
                        transform: 'scale(1.2)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ flex: 1 }}>{opt}</span>
                    {answers[i] === k && (
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                    )}
                  </label>
                ))}
              </div>
              {answers[i] !== undefined && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  ✓ Answer selected
                </div>
              )}
            </div>
          )}
          {b.type==='fillblank' && (
            <div style={{
              padding: '20px',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              backgroundColor: 'var(--panel)',
              margin: '16px 0'
            }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '18px',
                marginBottom: '16px',
                color: 'var(--text)'
              }}>
                ✏️ {b.prompt}
              </div>
              <input 
                value={answers[i] ?? ''} 
                onChange={e=>updateAnswer(i, e.target.value)}
                placeholder="Type your answer here..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)'
                }}
              />
              {answers[i] && answers[i].trim() && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--accent)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  ✓ Answer provided
                </div>
              )}
            </div>
          )}
          {b.type==='heading' && (
            (() => {
              const HeadingTag = `h${b.level}` as keyof JSX.IntrinsicElements;
              return (
                <HeadingTag 
                  style={{ 
                    fontSize: b.size === 'small' ? '1.2em' : b.size === 'large' ? '2.5em' : '1.8em',
                    margin: '16px 0 8px 0',
                    fontWeight: 'bold'
                  }}
                >
                  {b.content}
                </HeadingTag>
              );
            })()
          )}
          {b.type==='columns' && (
            <div style={{ 
              display: 'flex', 
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              {b.columns.map((column, colIndex) => (
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
                              return <div dangerouslySetInnerHTML={{ __html: colBlock.content.replace(/\n/g, '<br>') }} />;
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
          )}
        </div>
      ))}

      <div className="row" style={{ alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={submit}
          disabled={submitted?.completed}
          style={{
            backgroundColor: submitted?.completed ? '#28a745' : 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: submitted?.completed ? 'default' : 'pointer',
            opacity: submitted?.completed ? 0.8 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {submitted?.completed ? '✅ Lesson Completed' : hasInteractiveElements ? '📝 Mark as Complete' : '✅ Mark as Complete'}
        </button>
        {submitted && (
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: submitted.completed ? '#d4edda' : '#fff3cd',
            color: submitted.completed ? '#155724' : '#856404',
            borderRadius: '6px',
            border: `1px solid ${submitted.completed ? '#c3e6cb' : '#ffeaa7'}`,
            fontSize: '14px',
            fontWeight: '500'
          }}>
            <span>{submitted.completed ? '✅' : '🔄'}</span>
            <span>
              {submitted.completed 
                ? 'This lesson has been completed and saved to your progress.' 
                : hasInteractiveElements 
                  ? 'Answer all questions above to complete this lesson.' 
                  : 'Click the button above to mark this lesson as complete.'
              }
            </span>
          </div>
        )}
      </div>
    </div>
  )
}


