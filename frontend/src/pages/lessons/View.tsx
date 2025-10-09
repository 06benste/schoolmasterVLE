import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

// Function to render text with formatting (line breaks, bullets, numbering)
const renderTextWithFormatting = (content: string): string => {
  if (!content) return '';
  
  // First, convert line breaks to <br> tags
  let formatted = content.replace(/\n/g, '<br>');
  
  // Handle bullet points (lines starting with - or •)
  formatted = formatted.replace(/(<br>|^)(\s*)([-•]\s+)([^<]*?)(<br>|$)/g, '$1$2<li>$4</li>$5');
  
  // Handle numbered lists (lines starting with numbers followed by . or ))
  formatted = formatted.replace(/(<br>|^)(\s*)(\d+[.)]\s+)([^<]*?)(<br>|$)/g, '$1$2<li>$4</li>$5');
  
  // Wrap consecutive <li> elements in <ul> or <ol>
  formatted = formatted.replace(/(<li>.*?<\/li>(?:<br>)*)+/g, (match) => {
    // Check if it contains numbered items
    const hasNumbers = /\d+[.)]\s+/.test(match);
    const listType = hasNumbers ? 'ol' : 'ul';
    return `<${listType}>${match.replace(/<br>/g, '')}</${listType}>`;
  });
  
  return formatted;
};

export default function LessonView(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<any | null>(null)
  const [user, setUser] = useState<any | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    async function load(){
      if (!id) return
      try {
        const lessonRes = await api.get(`/lessons/${id}`)
        setLesson(lessonRes.data)
        
        // Get user data from localStorage
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }
      } catch (error) {
        console.error('Failed to load lesson data:', error)
      }
    }
    load()
  }, [id])

  const blocks: Block[] = useMemo(()=> lesson?.content?.blocks ?? [], [lesson])

  function updateAnswer(idx: number, val: any){
    setAnswers(a => ({ ...a, [idx]: val }))
  }

  function calculateScore(){
    let score = 0, max = 0
    blocks.forEach((b, i) => {
      if (b.type === 'quiz'){
        max += 1
        if (answers[i] === b.answerIndex) score += 1
      }
      if (b.type === 'fillblank'){
        max += 1
        const given = (answers[i] ?? '').toString().trim().toLowerCase()
        const expected = b.answer.trim().toLowerCase()
        if (given === expected) score += 1
      }
    })
    return { score, max }
  }

  function checkAnswers(){
    setShowResults(true)
  }

  function resetQuiz(){
    setAnswers({})
    setShowResults(false)
  }

  if (!lesson) return <div>Loading...</div>

  const canEdit = user && (user.role === 'admin' || user.role === 'teacher')
  const isStudent = user && user.role === 'student'

  return (
    <div className="grid" style={{ gap:12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{lesson.title}</h2>
            {lesson.description && <div className="muted">{lesson.description}</div>}
          </div>
          {canEdit && (
            <button 
              onClick={() => navigate(`/admin/lessons?edit=${id}`)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              ✏️ Edit Lesson
            </button>
          )}
        </div>
      </div>

      {/* Lesson content */}
      {blocks.map((b, i) => (
        <div key={i} className="card">
          {b.type==='text' && <div dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(b.content) }} />}
          {b.type==='heading' && (
            (() => {
              const HeadingTag = `h${b.level}` as keyof JSX.IntrinsicElements;
              return (
                <HeadingTag 
                  style={{ 
                    fontSize: b.size === 'small' ? '1.2em' : b.size === 'large' ? '2.5em' : '1.8em',
                    margin: '16px 0 8px 0',
                    color: 'var(--text)',
                    fontWeight: 'bold'
                  }}
                  dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(b.content) }}
                />
              );
            })()
          )}
          {b.type==='columns' && (
            <div style={{ display: 'flex', gap: '16px' }}>
              {b.columns.map((column, colIndex) => (
                <div
                  key={colIndex}
                  style={{ 
                    flex: column.width,
                    minHeight: '100px',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
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
                              return <div dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(colBlock.content) }} />;
                            case 'heading':
                              const HeadingTag = `h${colBlock.level}` as keyof JSX.IntrinsicElements;
                              return (
                                <HeadingTag 
                                  style={{ 
                                    fontSize: colBlock.size === 'small' ? '1.2em' : colBlock.size === 'large' ? '2em' : '1.5em',
                                    margin: '0 0 8px 0'
                                  }}
                                  dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(colBlock.content) }}
                                />
                              );
                            case 'image':
                              return (
                                <div>
                                  <img 
                                    src={colBlock.url} 
                                    alt={colBlock.alt || 'Image'} 
                                    style={{ 
                                      width: colBlock.width ? `${colBlock.width}%` : '100%', 
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
                                  {colBlock.caption && (
                                    <div style={{ marginTop: '8px', fontSize: '0.9em', color: 'var(--muted)', fontStyle: 'italic' }}>
                                      {colBlock.caption}
                                    </div>
                                  )}
                                </div>
                              );
                            case 'video':
                              return (
                                <div>
                                  {colBlock.url && (
                                    <div style={{ textAlign: 'center' }}>
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
                                    </div>
                                  )}
                                </div>
                              );
                            default:
                              return <div>{(colBlock as any).content || 'Unsupported block type'}</div>;
                          }
                        })()}
                      </div>
                    ))
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(column.content) }} />
                  )}
                </div>
              ))}
            </div>
          )}
          {b.type==='video' && (
            <div>
              {b.url.includes('youtube.com') || b.url.includes('youtu.be') ? (
                <iframe width="560" height="315" src={b.url.replace('watch?v=','embed/')} title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
              ) : (
                <video src={b.url} controls style={{ maxWidth:'100%' }} />
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
                      cursor: isStudent ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      fontSize: '16px'
                    }}
                  >
                    <input 
                      type="radio" 
                      name={`q-${i}`} 
                      checked={answers[i]===k} 
                      onChange={()=>isStudent && updateAnswer(i,k)}
                      disabled={!isStudent}
                      style={{
                        transform: 'scale(1.2)',
                        cursor: isStudent ? 'pointer' : 'default'
                      }}
                    />
                    <span style={{ flex: 1 }}>{opt}</span>
                    {showResults && (
                      <span style={{
                        color: k === b.answerIndex ? '#28a745' : '#dc3545',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}>
                        {k === b.answerIndex ? '✓' : answers[i] === k ? '✗' : ''}
                      </span>
                    )}
                    {answers[i] === k && !showResults && (
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                    )}
                  </label>
                ))}
              </div>
              {showResults && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: answers[i] === b.answerIndex ? '#d4edda' : '#f8d7da',
                  color: answers[i] === b.answerIndex ? '#155724' : '#721c24',
                  borderRadius: '6px',
                  border: `1px solid ${answers[i] === b.answerIndex ? '#c3e6cb' : '#f5c6cb'}`,
                  fontWeight: '600'
                }}>
                  {answers[i] === b.answerIndex ? '✅ Correct!' : '❌ Incorrect. The correct answer is: ' + b.options[b.answerIndex]}
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
                onChange={e=>isStudent && updateAnswer(i, e.target.value)}
                disabled={!isStudent}
                placeholder={isStudent ? "Type your answer here..." : "Answer hidden - student view only"}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: isStudent ? 'var(--bg)' : 'var(--muted)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  cursor: isStudent ? 'text' : 'default'
                }}
                onFocus={(e) => {
                  if (isStudent) e.target.style.borderColor = 'var(--accent)'
                }}
                onBlur={(e) => {
                  if (isStudent) e.target.style.borderColor = 'var(--border)'
                }}
              />
              {showResults && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: answers[i]?.toString().trim().toLowerCase() === b.answer.trim().toLowerCase() ? '#d4edda' : '#f8d7da',
                  color: answers[i]?.toString().trim().toLowerCase() === b.answer.trim().toLowerCase() ? '#155724' : '#721c24',
                  borderRadius: '6px',
                  border: `1px solid ${answers[i]?.toString().trim().toLowerCase() === b.answer.trim().toLowerCase() ? '#c3e6cb' : '#f5c6cb'}`,
                  fontWeight: '600'
                }}>
                  {answers[i]?.toString().trim().toLowerCase() === b.answer.trim().toLowerCase() 
                    ? '✅ Correct!' 
                    : `❌ Incorrect. The correct answer is: ${b.answer}`
                  }
                </div>
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
        </div>
      ))}
      
      {/* Quiz Controls for Students */}
      {isStudent && blocks.some(b => b.type === 'quiz' || b.type === 'fillblank') && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ margin: 0 }}>📝 Quiz Section</h3>
            {showResults && (
              <div style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent)',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '16px'
              }}>
                Score: {calculateScore().score}/{calculateScore().max}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={checkAnswers}
              disabled={showResults}
              style={{
                padding: '12px 24px',
                backgroundColor: showResults ? 'var(--muted)' : 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: showResults ? 'default' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: showResults ? 0.6 : 1
              }}
            >
              {showResults ? '✅ Answers Checked' : '🔍 Check My Answers'}
            </button>
            
            {showResults && (
              <button
                onClick={resetQuiz}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                🔄 Try Again
              </button>
            )}
          </div>
          
          {showResults && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: calculateScore().score === calculateScore().max ? '#d4edda' : '#fff3cd',
              color: calculateScore().score === calculateScore().max ? '#155724' : '#856404',
              borderRadius: '8px',
              border: `1px solid ${calculateScore().score === calculateScore().max ? '#c3e6cb' : '#ffeaa7'}`,
              fontWeight: '600'
            }}>
              {calculateScore().score === calculateScore().max 
                ? '🎉 Perfect! You got all questions correct!' 
                : `📊 You got ${calculateScore().score} out of ${calculateScore().max} questions correct. Keep practicing!`
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}


