"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CompetencyAverage } from "@/lib/mock-data";

export function CompetencyRadarChart({ items }: { items: CompetencyAverage[] }) {
  const data = items.map((i) => ({ subject: i.subScale, 사전: i.pre, 사후: i.post }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#262b36" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#c9cdd6", fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "#8a8f9c", fontSize: 10 }} />
        <Radar name="사전(Pre)" dataKey="사전" stroke="#ff8f6c" fill="#ff8f6c" fillOpacity={0.25} />
        <Radar name="사후(Post)" dataKey="사후" stroke="#6cffb0" fill="#6cffb0" fillOpacity={0.3} />
        <Legend
          formatter={(value) => <span style={{ color: "#c9cdd6", fontSize: 12 }}>{value}</span>}
        />
        <Tooltip
          contentStyle={{
            background: "#171a21",
            border: "1px solid #262b36",
            borderRadius: 10,
            fontSize: 12,
            color: "#f2f2f7",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
