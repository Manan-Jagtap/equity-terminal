/* Technical analysis tab — SMA chart + RSI/52w high/low stats. */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C, sans } from "../lib/theme.js";
import { fmt, inr } from "../lib/formatters.js";
import { Stat } from "./primitives.jsx";

export default function Technical({ rec }) {
  const t = rec.t;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 14 }}>
        <Stat label="Last close" value={inr(t.last)} />
        <Stat
          label="RSI (14)"
          value={fmt(t.rsi)}
          color={t.rsi > 70 ? C.red : t.rsi < 30 ? C.green : C.text}
          sub={t.rsi > 70 ? "Overbought" : t.rsi < 30 ? "Oversold" : "Neutral"}
        />
        <Stat label="Vs 50-DMA" value={t.aboveSMA50 ? "Above" : "Below"} color={t.aboveSMA50 ? C.green : C.red} />
        <Stat label="52w High" value={inr(t.hi)} />
        <Stat label="52w Low" value={inr(t.lo)} />
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 8px 8px 0" }}>
        <div style={{ ...sans, color: C.dim, fontSize: 12, padding: "0 0 8px 16px" }}>
          Price · 20-DMA · 50-DMA
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={t.data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: C.line }} width={55} />
            <Tooltip
              contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "monospace", fontSize: 12 }}
              labelStyle={{ color: C.dim }}
            />
            <Line type="monotone" dataKey="close" stroke={C.gold} dot={false} strokeWidth={1.6} name="Price" />
            <Line type="monotone" dataKey="sma20" stroke={C.blue} dot={false} strokeWidth={1.1} name="20-DMA" />
            <Line type="monotone" dataKey="sma50" stroke={C.dim} dot={false} strokeWidth={1.1} strokeDasharray="4 3" name="50-DMA" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
