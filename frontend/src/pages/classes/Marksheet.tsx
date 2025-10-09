import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'

export default function Marksheet(){
  const { id } = useParams()
  const [data, setData] = useState<any | null>(null)

  useEffect(() => {
    async function load(){
      const res = await api.get(`/classes/${id}/marksheet`)
      setData(res.data)
    }
    if (id) load()
  }, [id])

  if (!data) return <div>Loading...</div>

  const { students, assignments, scores } = data

  return (
    <div>
      <h2>Marksheet</h2>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ border:'1px solid #ccc', padding:4 }}>Student</th>
              {assignments.map((a: any) => (
                <th key={a.id} style={{ border:'1px solid #ccc', padding:4 }}>{a.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id}>
                <td style={{ border:'1px solid #ccc', padding:4 }}>{s.firstName} {s.lastName}</td>
                {assignments.map((a: any) => {
                  const sc = scores.find((x: any) => x.studentId === s.id && x.assignmentId === a.id)
                  return (
                    <td key={a.id} style={{ border:'1px solid #ccc', padding:4 }}>
                      {sc ? `${sc.score ?? '-'} / ${sc.maxScore ?? '-'}` : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}



