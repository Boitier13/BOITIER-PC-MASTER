import { File, Folder } from 'lucide-react'

export function Ranking({ rows, files = false }: { rows: (string | number)[][]; files?: boolean }) {
  return (
    <div className="ranking-list">
      {rows.map((row, index) => (
        <div className="ranking-row" key={String(row[0])}>
          <span className="rank-no">0{index + 1}</span>
          <span className="rank-icon">{files ? <File size={15} /> : <Folder size={15} />}</span>
          <strong>{row[0]}</strong>
          <span className="rank-size">{row[1]}</span>
          <div className="rank-track">
            <i style={{ width: `${row[2]}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
