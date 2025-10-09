import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'

export default function ResponseReview(){
  const { assignmentId, studentId } = useParams()
  const [assignment, setAssignment] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [attempts, setAttempts] = useState<any[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  // Helper function to calculate automatic score for a question
  function calculateAutomaticScore(block: any, questionIndex: number, studentAnswer: any, allAnswers: any): number {
    const questionMarks = block.marks || 1;
    
    if (block.type === 'quiz') {
      if (block.allowMultiple) {
        const correctAnswers = block.correctAnswers || [block.answerIndex]
        const userAnswers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]
        const allCorrect = correctAnswers.length === userAnswers.length && 
                          correctAnswers.every((ans: number) => userAnswers.includes(ans))
        return allCorrect ? questionMarks : 0
      } else {
        return (Number(studentAnswer) === Number(block.answerIndex)) ? questionMarks : 0
      }
    } else if (block.type === 'checkbox') {
      const correctAnswers = block.correctAnswers || []
      const userAnswers = Array.isArray(studentAnswer) ? studentAnswer : []
      const allCorrect = correctAnswers.length === userAnswers.length && 
                        correctAnswers.every((ans: number) => userAnswers.includes(ans))
      return allCorrect ? questionMarks : 0
    } else if (block.type === 'dropdown') {
      return (Number(studentAnswer) === Number(block.answerIndex)) ? questionMarks : 0
    } else if (block.type === 'linearscale') {
      const tolerance = block.tolerance || 0
      return Math.abs(Number(studentAnswer) - Number(block.correctAnswer)) <= tolerance ? questionMarks : 0
    } else if (block.type === 'date') {
      return studentAnswer === block.answer ? questionMarks : 0
    } else if (block.type === 'time') {
      return studentAnswer === block.answer ? questionMarks : 0
    } else if (block.type === 'multigrid') {
      let gridScore = 0
      const totalRows = block.rows?.length || 0
      block.rows?.forEach((row: string, rowIndex: number) => {
        const userAnswer = Number(allAnswers[`question_${questionIndex}_row_${rowIndex}`])
        const correctAnswer = Number(block.correctAnswers?.[rowIndex])
        if (userAnswer === correctAnswer) gridScore += 1
      })
      return (gridScore / totalRows) * questionMarks
    } else if (block.type === 'tickgrid') {
      let gridScore = 0
      const totalRows = block.rows?.length || 0
      block.rows?.forEach((row: string, rowIndex: number) => {
        const userAnswers = allAnswers[`question_${questionIndex}_row_${rowIndex}`] || []
        const correctAnswers = block.correctAnswers?.[rowIndex] || []
        const allCorrect = correctAnswers.length === userAnswers.length && 
                          correctAnswers.every((ans: number) => userAnswers.includes(ans))
        if (allCorrect) gridScore += 1
      })
      return (gridScore / totalRows) * questionMarks
    } else if (block.type === 'fileupload') {
      return studentAnswer && studentAnswer !== '' ? questionMarks : 0
    }
    return 0 // Short answer and long answer questions get 0 initially
  }

  useEffect(() => {
    async function loadData(){
      if (!assignmentId || !studentId) {
        console.log('Missing IDs:', { assignmentId, studentId })
        return
      }
      
      try {
        console.log('Loading assignment:', assignmentId)
        // Load assignment details
        const assignmentRes = await api.get(`/assignments/${assignmentId}`)
        console.log('Assignment loaded:', assignmentRes.data)
        setAssignment(assignmentRes.data)
        
        console.log('Loading student:', studentId)
        // Load student details
        const studentRes = await api.get(`/users/${studentId}`)
        console.log('Student loaded:', studentRes.data)
        setStudent(studentRes.data)
        
        // Load assessment if it's an assessment assignment
        if (assignmentRes.data.type === 'assessment') {
          if (!assignmentRes.data.ref_id) {
            console.error('Assignment has no ref_id:', assignmentRes.data)
            setMessage('Assignment has no associated assessment')
            setLoading(false)
            return
          }
          console.log('Loading assessment:', assignmentRes.data.ref_id)
          try {
            const assessmentRes = await api.get(`/assessments/${assignmentRes.data.ref_id}`)
            console.log('Assessment loaded:', assessmentRes.data)
            setAssessment(assessmentRes.data)
          } catch (err: any) {
            console.error('Failed to load assessment:', err)
            setMessage('Failed to load assessment data')
            setLoading(false)
            return
          }
        }
        
        // Load student attempts
        console.log('Loading attempts for assignment:', assignmentId, 'student:', studentId)
        const attemptsRes = await api.get(`/assignments/${assignmentId}/attempts/${studentId}`)
      console.log('Attempts loaded:', attemptsRes.data)
      console.log('First attempt details:', attemptsRes.data[0])
      console.log('First attempt score:', attemptsRes.data[0]?.score)
      console.log('First attempt max_score:', attemptsRes.data[0]?.max_score)
      console.log('First attempt responses:', attemptsRes.data[0]?.responses)
      setAttempts(attemptsRes.data)
        
        if (attemptsRes.data.length > 0) {
          setSelectedAttempt(attemptsRes.data[attemptsRes.data.length - 1]) // Latest attempt
        }
        
      } catch (err: any) {
        console.error('Error loading data:', err)
        setMessage(err?.response?.data?.error ?? 'Failed to load data')
      }
      setLoading(false)
    }
    loadData()
  }, [assignmentId, studentId])

  async function updateScore(questionIndex: number, newScore: number) {
    if (!selectedAttempt) return
    
    try {
      const response = await api.put(`/assignments/${assignmentId}/attempts/${selectedAttempt.id}/score`, {
        questionIndex,
        score: newScore
      })
      console.log('Backend response:', response.data)
      setMessage('Score updated successfully')
      // Reload attempts to get updated data
      const attemptsRes = await api.get(`/assignments/${assignmentId}/attempts/${studentId}`)
      console.log('Reloaded attempts:', attemptsRes.data)
      setAttempts(attemptsRes.data)
      // Update the selected attempt with the new data
      const updatedAttempt = attemptsRes.data.find((a: any) => a.id === selectedAttempt.id)
      if (updatedAttempt) {
        console.log('Updated attempt:', updatedAttempt)
        setSelectedAttempt(updatedAttempt)
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Failed to update score')
    }
  }

  if (loading) return <div>Loading...</div>
  if (!assignment || !student) return <div>Assignment or student not found</div>

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Review Student Response</h2>
        <div className="grid cols-2" style={{ gap: 16 }}>
          <div>
            <h3>Assignment Details</h3>
            <p><strong>Title:</strong> {assignment.title}</p>
            <p><strong>Type:</strong> {assignment.type}</p>
            <p><strong>Due Date:</strong> {assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date'}</p>
          </div>
          <div>
            <h3>Student Details</h3>
            <p><strong>Name:</strong> {student.firstName} {student.lastName}</p>
            <p><strong>Email:</strong> {student.email}</p>
            <p><strong>Username:</strong> {student.username}</p>
          </div>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="card">
          <h3>Attempt History</h3>
          <div className="grid" style={{ gap: 8 }}>
            {attempts.map((attempt, index) => (
              <div 
                key={attempt.id} 
                className={`card ${selectedAttempt?.id === attempt.id ? 'selected' : ''}`}
                style={{ 
                  cursor: 'pointer', 
                  border: selectedAttempt?.id === attempt.id ? '2px solid #007acc' : '1px solid #ddd',
                  backgroundColor: selectedAttempt?.id === attempt.id ? '#f0f8ff' : '#fff'
                }}
                onClick={() => setSelectedAttempt(attempt)}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Attempt {index + 1}</strong>
                    <div style={{ color: '#666' }}>
                      Submitted: {new Date(attempt.submitted_at).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      backgroundColor: '#e3f2fd',
                      color: '#000000'
                    }}>
                      {attempt.score} / {attempt.max_score} marks
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedAttempt && assessment && (
        <div className="card">
          <h3>Question Review - Attempt {attempts.findIndex(a => a.id === selectedAttempt.id) + 1}</h3>
          <div style={{ marginBottom: 16 }}>
            <strong>Overall Score: {selectedAttempt.score} out of {selectedAttempt.max_score} marks</strong>
            <div style={{ color: '#666' }}>Submitted: {new Date(selectedAttempt.submitted_at).toLocaleString()}</div>
          </div>
          
          {console.log('Assessment content blocks:', assessment.content.blocks)}
          {assessment.content.blocks.map((block: any, index: number) => {
            console.log(`Rendering question ${index + 1}:`, block);
            return (
            <div key={index} style={{ marginBottom: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
              <h4>Question {index + 1} - {block.type === 'quiz' ? 'Multiple Choice' : block.type === 'shortanswer' ? 'Short Answer' : block.type === 'longanswer' ? 'Long Answer' : block.type}</h4>
              
              {block.type === 'quiz' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ marginTop: 5 }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] !== undefined ? (
                        <div style={{ 
                          padding: '8px', 
                          backgroundColor: '#e3f2fd', 
                          borderRadius: 4,
                          color: '#000000',
                          border: '1px solid #bbdefb'
                        }}>
                          {(() => {
                            const studentAnswer = selectedAttempt.responses.answers[`question_${index}`];
                            console.log(`Question ${index + 1} - Raw student answer:`, studentAnswer);
                            console.log(`Question ${index + 1} - Is array:`, Array.isArray(studentAnswer));
                            console.log(`Question ${index + 1} - Block:`, block);
                            
                            if (Array.isArray(studentAnswer)) {
                              // Multiple choice with multiple answers
                              const answers = studentAnswer.map((answerIndex: number) => 
                                block.options[answerIndex]
                              ).filter(Boolean);
                              console.log(`Question ${index + 1} - Mapped answers:`, answers);
                              return answers.join(', ') || 'Invalid answer';
                            } else {
                              // Single choice answer
                              console.log(`Question ${index + 1} - Single answer:`, block.options[studentAnswer]);
                              return block.options[studentAnswer] || 'Invalid answer';
                            }
                          })()}
                        </div>
                      ) : (
                        <div style={{ color: '#666' }}>No answer provided</div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ marginTop: 5 }}>
                      {block.allowMultiple ? (
                        <div>
                          {block.correctAnswers?.map((correctIndex: number) => (
                            <div key={correctIndex} style={{ 
                              padding: '8px', 
                              backgroundColor: '#d4edda', 
                              borderRadius: 4,
                              color: '#000000',
                              border: '1px solid #c3e6cb',
                              margin: '2px 0'
                            }}>
                              {block.options[correctIndex]}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ 
                          padding: '8px', 
                          backgroundColor: '#d4edda', 
                          borderRadius: 4,
                          color: '#000000',
                          border: '1px solid #c3e6cb'
                        }}>
                          {block.options[block.answerIndex]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}
              
              {block.type === 'shortanswer' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: 4, 
                      marginTop: 5,
                      border: '1px solid #dee2e6',
                      color: '#000000'
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] || 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Expected Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e8f5e8', 
                      borderRadius: 4, 
                      marginTop: 5,
                      border: '1px solid #c3e6c3',
                      color: '#000000'
                    }}>
                      {block.answer}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || (block.type === 'shortanswer' ? 5 : 10)}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || (block.type === 'shortanswer' ? 5 : 10)} marks</span>
                    </label>
                  </div>
                </div>
              )}
              
              {block.type === 'longanswer' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: 4, 
                      marginTop: 5,
                      border: '1px solid #dee2e6',
                      minHeight: '100px',
                      color: '#000000'
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] || 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Reference Answer:</strong>
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: '#e8f5e8', 
                      borderRadius: 4, 
                      marginTop: 5,
                      border: '1px solid #c3e6c3',
                      minHeight: '100px',
                      color: '#000000'
                    }}>
                      {block.answer}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || (block.type === 'longanswer' ? 20 : 10)}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || (block.type === 'longanswer' ? 20 : 10)} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'checkbox' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ marginTop: 5 }}>
                      {Array.isArray(selectedAttempt.responses.answers?.[`question_${index}`]) && selectedAttempt.responses.answers?.[`question_${index}`].length > 0 ? (
                        selectedAttempt.responses.answers[`question_${index}`].map((answerIndex: number) => (
                          <div key={answerIndex} style={{ 
                            padding: '8px', 
                            backgroundColor: '#e3f2fd', 
                            borderRadius: 4,
                            color: '#000000',
                            border: '1px solid #bbdefb',
                            margin: '2px 0'
                          }}>
                            {block.options[answerIndex]}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#666' }}>No answer provided</div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ marginTop: 5 }}>
                      {block.correctAnswers?.map((correctIndex: number) => (
                        <div key={correctIndex} style={{ 
                          padding: '8px', 
                          backgroundColor: '#d4edda', 
                          borderRadius: 4,
                          color: '#000000',
                          border: '1px solid #c3e6cb',
                          margin: '2px 0'
                        }}>
                          {block.options[correctIndex]}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'dropdown' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] !== undefined && selectedAttempt.responses.answers?.[`question_${index}`] !== '' ? block.options[selectedAttempt.responses.answers[`question_${index}`]] : 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#d4edda', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #c3e6cb',
                      marginTop: 5
                    }}>
                      {block.options[block.answerIndex]}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'linearscale' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] !== undefined ? `${selectedAttempt.responses.answers[`question_${index}`]} (${block.minLabel} ... ${block.maxLabel})` : 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#d4edda', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #c3e6cb',
                      marginTop: 5
                    }}>
                      {block.correctAnswer} {block.tolerance ? `(±${block.tolerance} tolerance)` : ''}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'date' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] || 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#d4edda', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #c3e6cb',
                      marginTop: 5
                    }}>
                      {block.answer}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'time' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] || 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Correct Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#d4edda', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #c3e6cb',
                      marginTop: 5
                    }}>
                      {block.answer}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'fileupload' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Submission:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] ? `File: ${selectedAttempt.responses.answers[`question_${index}`]}` : 'No file uploaded'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px', backgroundColor: '#fff3cd', borderRadius: 4, border: '1px solid #ffc107' }}>
                    <strong>Note:</strong> File uploads require manual grading
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'fillblank' && (
                <div>
                  <p><strong>Question:</strong> {block.prompt}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#e3f2fd', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #bbdefb',
                      marginTop: 5
                    }}>
                      {selectedAttempt.responses.answers?.[`question_${index}`] || 'No answer provided'}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <strong>Expected Answer:</strong>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: '#d4edda', 
                      borderRadius: 4,
                      color: '#000000',
                      border: '1px solid #c3e6cb',
                      marginTop: 5
                    }}>
                      {block.answer}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseInt(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'multigrid' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answers:</strong>
                    <table style={{ width: '100%', marginTop: 5, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Row</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Student Answer</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Correct Answer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row: string, rowIndex: number) => {
                          const studentAnswer = selectedAttempt.responses.answers?.[`question_${index}_row_${rowIndex}`];
                          const correctAnswer = block.correctAnswers?.[rowIndex];
                          const isCorrect = Number(studentAnswer) === Number(correctAnswer);
                          return (
                            <tr key={rowIndex} style={{ backgroundColor: isCorrect ? '#d4edda' : '#f8d7da' }}>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px', fontWeight: 'bold' }}>{row}</td>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                                {studentAnswer !== undefined ? block.columns[studentAnswer] || 'Invalid' : 'No answer'}
                              </td>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                                {correctAnswer !== undefined ? block.columns[correctAnswer] : 'Not set'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        step="0.01"
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseFloat(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}

              {block.type === 'tickgrid' && (
                <div>
                  <p><strong>Question:</strong> {block.question}</p>
                  <div style={{ marginTop: 10 }}>
                    <strong>Student's Answers:</strong>
                    <table style={{ width: '100%', marginTop: 5, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Row</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Student Answers</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '8px', backgroundColor: '#f8f9fa' }}>Correct Answers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row: string, rowIndex: number) => {
                          const studentAnswers = selectedAttempt.responses.answers?.[`question_${index}_row_${rowIndex}`] || [];
                          const correctAnswers = block.correctAnswers?.[rowIndex] || [];
                          const isCorrect = correctAnswers.length === studentAnswers.length && 
                                           correctAnswers.every((ans: number) => studentAnswers.includes(ans));
                          return (
                            <tr key={rowIndex} style={{ backgroundColor: isCorrect ? '#d4edda' : '#f8d7da' }}>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px', fontWeight: 'bold' }}>{row}</td>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                                {studentAnswers.length > 0 ? studentAnswers.map((idx: number) => block.columns[idx]).join(', ') : 'No answer'}
                              </td>
                              <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                                {correctAnswers.length > 0 ? correctAnswers.map((idx: number) => block.columns[idx]).join(', ') : 'Not set'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label>
                      <strong>Score:</strong>
                      <input 
                        type="number" 
                        min="0" 
                        max={block.marks || 1}
                        step="0.01"
                        defaultValue={selectedAttempt.responses.questionScores?.[index] ?? calculateAutomaticScore(block, index, selectedAttempt.responses.answers?.[`question_${index}`], selectedAttempt.responses.answers)}
                        onChange={e => updateScore(index, parseFloat(e.target.value))}
                        style={{ marginLeft: 8, padding: '4px', width: '80px' }}
                      />
                      <span style={{ marginLeft: 4, color: '#666' }}>/ {block.marks || 1} marks</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {message && (
        <div className="card" style={{ 
          backgroundColor: message.includes('successfully') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`,
          color: '#000000'
        }}>
          {message}
        </div>
      )}
    </div>
  )
}
