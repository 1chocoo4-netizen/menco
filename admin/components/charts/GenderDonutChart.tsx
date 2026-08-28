"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#ff6c8c", "#6c8cff", "#8a8f9c"];

export function GenderDonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={90}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#171a21",
            border: "1px solid #262b36",
            borderRadius: 10,
            fontSize: 12,
            color: "#f2f2f7",
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={32}
          formatter={(value) => <span style={{ color: "#c9cdd6", fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
