'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface Props {
  data: Array<{ date: string } & Record<string, number>>
  players: Record<string, string>
  myId: string
  totalPlayers: number
}

const PALETTE = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
  '#ec4899','#14b8a6','#f97316','#8b5cf6','#84cc16',
]

function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}

export default function RankingHistory({ data, players, myId, totalPlayers }: Props) {
  const playerIds = Object.keys(players)
  const colorMap: Record<string, string> = {}
  let ci = 0
  for (const id of playerIds) {
    colorMap[id] = id === myId ? '#16a34a' : PALETTE[ci++ % PALETTE.length]
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[1, totalPlayers]}
            reversed
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: unknown, name: unknown, item: any) =>
              [`#${value}`, players[item?.dataKey] ?? name]
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => shortDate(label)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ fontSize: 11, color: value === myId ? '#16a34a' : '#6b7280' }}>
                {players[value] ?? value}
              </span>
            )}
          />
          {playerIds.map(id => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={colorMap[id]}
              strokeWidth={id === myId ? 3 : 1.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
