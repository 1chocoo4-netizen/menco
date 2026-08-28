"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AgeBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#262b36" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#8a8f9c", fontSize: 12 }} axisLine={{ stroke: "#262b36" }} tickLine={false} />
        <YAxis tick={{ fill: "#8a8f9c", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#171a21",
            border: "1px solid #262b36",
            borderRadius: 10,
            fontSize: 12,
            color: "#f2f2f7",
          }}
        />
        <Bar dataKey="value" name="사용자 수" fill="#6c8cff" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
