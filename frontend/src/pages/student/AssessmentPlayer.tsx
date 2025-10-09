import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'

export default function AssessmentPlayer(){
  const [searchParams] = useSearchParams()
  const assessmentId = searchParams.get('assessmentId')
  const assignmentId = searchParams.get('assignmentId')
  const [assessment, setAssessment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<{[key: string]: number | string | number[]}>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadAssessment(){
      if (!assessmentId) {
        setError('Assessment ID not provided')
        setLoading(false)
        return
      }
      
      try {
        const res = await api.get(`/assessments/${assessmentId}`)
        setAssessment(res.data)
      } catch (err: any) {
        setError(err?.response?.data?.error ?? 'Failed to load assessment')
      }
      setLoading(false)
    }
    loadAssessment()
  }, [assessmentId])

  // Load saved progress when assessment and assignmentId are available
  useEffect(() => {
    async function loadSavedProgress() {
      if (!assessment || !assignmentId) {
        return
      }
      
      try {
        const res = await api.get(`/assignments/${assignmentId}/progress`)
        
        if (res.data.data && Object.keys(res.data.data).length > 0) {
          setAnswers(res.data.data)
        }
      } catch (err: any) {
        // Silently handle progress loading errors
      }
    }
    
    loadSavedProgress()
  }, [assessment, assignmentId])

  function handleAnswerChange(questionIndex: number, answerIndex: number) {
    setAnswers(prev => ({
      ...prev,
      [`question_${questionIndex}`]: answerIndex
    }))
  }

  function handleMultipleAnswerChange(questionIndex: number, answerIndex: number, checked: boolean) {
    setAnswers(prev => {
      const currentAnswers = (prev[`question_${questionIndex}`] as number[]) || [];
      const newAnswers = checked 
        ? [...currentAnswers, answerIndex]
        : currentAnswers.filter(a => a !== answerIndex);
      return {
        ...prev,
        [`question_${questionIndex}`]: newAnswers
      };
    });
  }

  function handleTextAnswerChange(questionIndex: number, answer: string) {
    setAnswers(prev => ({
      ...prev,
      [`question_${questionIndex}`]: answer
    }))
  }

  async function submitAssessment() {
    if (!assignmentId) {
      setError('Assignment ID not provided')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Calculate score based on individual question marks
      let score = 0
      let maxScore = 0
      const questionScores: {[key: number]: number} = {}

      assessment.content.blocks.forEach((block: any, index: number) => {
        const questionMarks = block.marks || 1
        maxScore += questionMarks
        
        if (block.type === 'quiz') {
          const userAnswer = answers[`question_${index}`]
          if (block.allowMultiple) {
            // For multiple choice questions, check if all correct answers are selected
            const correctAnswers = block.correctAnswers || [block.answerIndex]
            const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer]
            const allCorrect = correctAnswers.length === userAnswers.length && 
                              correctAnswers.every((ans: number) => userAnswers.includes(ans))
            if (allCorrect) {
              score += questionMarks
              questionScores[index] = questionMarks
            } else {
              questionScores[index] = 0
            }
          } else {
            // For single choice questions
            const userAnswerNum = Number(userAnswer)
            const correctAnswerNum = Number(block.answerIndex)
            
            if (userAnswerNum === correctAnswerNum) {
              score += questionMarks
              questionScores[index] = questionMarks
            } else {
              questionScores[index] = 0
            }
          }
        } else if (block.type === 'checkbox') {
          const userAnswer = answers[`question_${index}`] as number[]
          const correctAnswers = block.correctAnswers || []
          
          if (Array.isArray(userAnswer) && Array.isArray(correctAnswers)) {
            const userAnswers = userAnswer || []
            const allCorrect = correctAnswers.length === userAnswers.length && 
                              correctAnswers.every((ans: number) => userAnswers.includes(ans))
            if (allCorrect) {
              score += questionMarks
              questionScores[index] = questionMarks
            } else {
              questionScores[index] = 0
            }
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'dropdown') {
          const userAnswer = Number(answers[`question_${index}`])
          const correctAnswer = Number(block.answerIndex)
          
          if (userAnswer === correctAnswer) {
            score += questionMarks
            questionScores[index] = questionMarks
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'linearscale') {
          const userAnswer = Number(answers[`question_${index}`])
          const correctAnswer = Number(block.correctAnswer)
          const tolerance = Number(block.tolerance) || 0
          
          if (Math.abs(userAnswer - correctAnswer) <= tolerance) {
            score += questionMarks
            questionScores[index] = questionMarks
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'date') {
          const userAnswer = answers[`question_${index}`] as string
          const correctAnswer = block.answer
          
          if (userAnswer === correctAnswer) {
            score += questionMarks
            questionScores[index] = questionMarks
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'time') {
          const userAnswer = answers[`question_${index}`] as string
          const correctAnswer = block.answer
          
          if (userAnswer === correctAnswer) {
            score += questionMarks
            questionScores[index] = questionMarks
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'multigrid') {
          let gridScore = 0
          const totalRows = block.rows?.length || 0
          
          block.rows?.forEach((row: string, rowIndex: number) => {
            const userAnswer = Number(answers[`question_${index}_row_${rowIndex}`])
            const correctAnswer = Number(block.correctAnswers?.[rowIndex])
            
            if (userAnswer === correctAnswer) {
              gridScore += 1
            }
          })
          
          const rowMarks = questionMarks / totalRows
          questionScores[index] = gridScore * rowMarks
          score += questionScores[index]
        } else if (block.type === 'tickgrid') {
          let gridScore = 0
          const totalRows = block.rows?.length || 0
          
          block.rows?.forEach((row: string, rowIndex: number) => {
            const userAnswers = answers[`question_${index}_row_${rowIndex}`] as number[] || []
            const correctAnswers = block.correctAnswers?.[rowIndex] || []
            
            const allCorrect = correctAnswers.length === userAnswers.length && 
                              correctAnswers.every((ans: number) => userAnswers.includes(ans))
            if (allCorrect) {
              gridScore += 1
            }
          })
          
          const rowMarks = questionMarks / totalRows
          questionScores[index] = gridScore * rowMarks
          score += questionScores[index]
        } else if (block.type === 'fileupload') {
          // File uploads are typically graded manually, but we can give points for submission
          const userAnswer = answers[`question_${index}`]
          if (userAnswer && userAnswer !== '') {
            score += questionMarks
            questionScores[index] = questionMarks
          } else {
            questionScores[index] = 0
          }
        } else if (block.type === 'shortanswer' || block.type === 'longanswer') {
          // For text-based questions, we'll let teachers grade manually
          questionScores[index] = 0
        } else {
          // For other question types, default to 0 marks
          questionScores[index] = 0
        }
      })

      
      await api.post(`/assignments/${assignmentId}/attempts`, {
        score,
        maxScore,
        data: {
          answers,
          questionScores,
          submittedAt: new Date().toISOString()
        }
      })

      alert('Assessment submitted successfully!')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to submit assessment')
    }
    setSubmitting(false)
  }

  async function saveProgress() {
    if (!assignmentId) {
      setError('Assignment ID not provided')
      return
    }

    try {
      await api.post(`/assignments/${assignmentId}/save-progress`, {
        answers: answers,
        savedAt: new Date().toISOString()
      })
      
      alert('Progress saved!')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save progress')
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="card" style={{ color: '#dc3545' }}>Error: {error}</div>
  if (!assessment) return <div>Assessment not found</div>

  return (
    <div className="card">
      <h2>{assessment.title}</h2>
      {assessment.description && <p>{assessment.description}</p>}
      
      {assessment.content && assessment.content.blocks && (
        <div style={{ marginTop: 20 }}>
          {assessment.content.blocks.map((block: any, index: number) => (
            <div key={index} style={{ marginBottom: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
              {block.type === 'quiz' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  {block.options && (
                    <div style={{ marginTop: 10 }}>
                      {block.options.map((option: string, optIndex: number) => (
                        <label key={optIndex} style={{ display: 'block', marginBottom: 8 }}>
                          <input 
                            type={block.allowMultiple ? "checkbox" : "radio"}
                            name={`question_${index}`} 
                            value={optIndex}
                            checked={block.allowMultiple 
                              ? (answers[`question_${index}`] as number[] || []).includes(optIndex)
                              : answers[`question_${index}`] === optIndex
                            }
                            onChange={block.allowMultiple 
                              ? (e) => handleMultipleAnswerChange(index, optIndex, e.target.checked)
                              : () => handleAnswerChange(index, optIndex)
                            }
                          />
                          <span style={{ marginLeft: 8 }}>{option}</span>
                        </label>
                      ))}
                      {block.allowMultiple && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                          You can select multiple correct answers
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {block.type === 'text' && (
                <div dangerouslySetInnerHTML={{ __html: block.data?.text || block.text }} />
              )}
              {block.type === 'shortanswer' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <input 
                      type="text"
                      placeholder="Enter your answer..."
                      value={typeof answers[`question_${index}`] === 'string' ? answers[`question_${index}`] as string : ''}
                      onChange={e => handleTextAnswerChange(index, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              )}
              {block.type === 'longanswer' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <textarea 
                      placeholder="Enter your detailed answer..."
                      value={typeof answers[`question_${index}`] === 'string' ? answers[`question_${index}`] as string : ''}
                      onChange={e => handleTextAnswerChange(index, e.target.value)}
                      rows={4}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              )}
              {block.type === 'checkbox' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  {block.options && (
                    <div style={{ marginTop: 10 }}>
                      {block.options.map((option: string, optIndex: number) => (
                        <label key={optIndex} style={{ display: 'block', marginBottom: 8 }}>
                          <input 
                            type="checkbox"
                            checked={(answers[`question_${index}`] as number[] || []).includes(optIndex)}
                            onChange={e => handleMultipleAnswerChange(index, optIndex, e.target.checked)}
                          />
                          <span style={{ marginLeft: 8 }}>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {block.type === 'dropdown' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <select 
                      value={typeof answers[`question_${index}`] === 'number' ? answers[`question_${index}`] as number : ''}
                      onChange={e => handleAnswerChange(index, parseInt(e.target.value))}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="">Select an option...</option>
                      {block.options && block.options.map((option: string, optIndex: number) => (
                        <option key={optIndex} value={optIndex}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {block.type === 'linearscale' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>{block.minLabel}</span>
                      <input 
                        type="range"
                        min={block.minValue}
                        max={block.maxValue}
                        value={typeof answers[`question_${index}`] === 'number' ? answers[`question_${index}`] as number : block.minValue}
                        onChange={e => handleAnswerChange(index, parseInt(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: '14px', color: '#666' }}>{block.maxLabel}</span>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px', color: '#666' }}>
                      Value: {typeof answers[`question_${index}`] === 'number' ? answers[`question_${index}`] as number : block.minValue}
                    </div>
                  </div>
                </div>
              )}
              {block.type === 'date' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <input 
                      type="date"
                      value={typeof answers[`question_${index}`] === 'string' ? answers[`question_${index}`] as string : ''}
                      onChange={e => handleTextAnswerChange(index, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              )}
              {block.type === 'time' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <input 
                      type="time"
                      value={typeof answers[`question_${index}`] === 'string' ? answers[`question_${index}`] as string : ''}
                      onChange={e => handleTextAnswerChange(index, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              )}
              {block.type === 'fileupload' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <input 
                      type="file"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Validate file type
                          const allowedTypes = block.allowedTypes || [];
                          const isValidType = allowedTypes.some((type: string) => {
                            if (type.startsWith('.')) {
                              return file.name.toLowerCase().endsWith(type.toLowerCase());
                            }
                            return file.type.match(type.replace('*', '.*'));
                          });
                          
                          if (!isValidType) {
                            alert(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
                            e.target.value = '';
                            return;
                          }
                          
                          // Validate file size
                          if (file.size > (block.maxSize || 10485760)) {
                            alert(`File too large. Maximum size: ${Math.round((block.maxSize || 10485760) / 1024 / 1024)}MB`);
                            e.target.value = '';
                            return;
                          }
                          
                          handleTextAnswerChange(index, file.name);
                        }
                      }}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Allowed types: {block.allowedTypes?.join(', ') || 'Any'} | Max size: {Math.round((block.maxSize || 10485760) / 1024 / 1024)}MB
                    </div>
                  </div>
                </div>
              )}
              {block.type === 'multigrid' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f8f9fa' }}></th>
                          {block.columns && block.columns.map((column: string, colIndex: number) => (
                            <th key={colIndex} style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f8f9fa' }}>
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows && block.rows.map((row: string, rowIndex: number) => (
                          <tr key={rowIndex}>
                            <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                              {row}
                            </td>
                            {block.columns && block.columns.map((column: string, colIndex: number) => (
                              <td key={colIndex} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                <input 
                                  type="radio"
                                  name={`question_${index}_row_${rowIndex}`}
                                  checked={answers[`question_${index}_row_${rowIndex}`] === colIndex}
                                  onChange={() => {
                                    setAnswers(prev => ({
                                      ...prev,
                                      [`question_${index}_row_${rowIndex}`]: colIndex
                                    }));
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {block.type === 'tickgrid' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.question}</p>
                  <div style={{ marginTop: 10, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f8f9fa' }}></th>
                          {block.columns && block.columns.map((column: string, colIndex: number) => (
                            <th key={colIndex} style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f8f9fa' }}>
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows && block.rows.map((row: string, rowIndex: number) => (
                          <tr key={rowIndex}>
                            <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 'bold' }}>
                              {row}
                            </td>
                            {block.columns && block.columns.map((column: string, colIndex: number) => (
                              <td key={colIndex} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox"
                                  checked={(answers[`question_${index}_row_${rowIndex}`] as number[] || []).includes(colIndex)}
                                  onChange={e => {
                                    const currentAnswers = answers[`question_${index}_row_${rowIndex}`] as number[] || [];
                                    const newAnswers = e.target.checked 
                                      ? [...currentAnswers, colIndex]
                                      : currentAnswers.filter(i => i !== colIndex);
                                    setAnswers(prev => ({
                                      ...prev,
                                      [`question_${index}_row_${rowIndex}`]: newAnswers
                                    }));
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {block.type === 'image' && (
                <div>
                  <img 
                    src={block.url} 
                    alt={block.alt || 'Image'} 
                    style={{ 
                      width: block.width ? `${block.width}%` : '100%', 
                      height: 'auto', 
                      borderRadius: '8px', 
                      marginBottom: '8px'
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
                  {block.caption && (
                    <div style={{ fontSize: '0.9em', color: '#666', fontStyle: 'italic', marginTop: '8px' }}>
                      {block.caption}
                    </div>
                  )}
                </div>
              )}
              {block.type === 'question' && (
                <div>
                  <h4>Question {index + 1}</h4>
                  <p>{block.data?.question || block.question}</p>
                  {(block.data?.options || block.options) && (
                    <div style={{ marginTop: 10 }}>
                      {(block.data?.options || block.options).map((option: string, optIndex: number) => (
                        <label key={optIndex} style={{ display: 'block', marginBottom: 8 }}>
                          <input type="radio" name={`question_${index}`} value={optIndex} />
                          <span style={{ marginLeft: 8 }}>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {block.type === 'paragraph' && (
                <p>{block.data?.text || block.text}</p>
              )}
            </div>
          ))}
        </div>
      )}
      
      {error && (
        <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f8d7da', color: '#721c24', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <button 
          className="button" 
          style={{ marginRight: 10 }} 
          onClick={submitAssessment}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
        <button 
          className="button" 
          style={{ backgroundColor: '#6c757d' }}
          onClick={saveProgress}
        >
          Save Progress
        </button>
      </div>
    </div>
  )
}
