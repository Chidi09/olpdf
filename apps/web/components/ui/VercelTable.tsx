import React from "react";

export function VercelTable({ data }: { data: Array<{ name: string; status?: string; date: string }> }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[#222] bg-[#0A0A0A]">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead className="border-b border-[#222] bg-[#050505]">
          <tr>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Name</th>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Status</th>
            <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222]">
          {data.map((row, i) => (
            <tr key={`${row.name}-${i}`} className="transition-colors hover:bg-[#111]">
              <td className="px-5 py-3 font-medium text-[#ededed]">{row.name}</td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" /> {row.status || "Active"}
                </span>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-[#666]">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
