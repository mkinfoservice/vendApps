interface Props {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 6, cols = 5 }: Props) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div
                className="h-3.5 rounded-lg animate-pulse"
                style={{
                  backgroundColor: "var(--surface-2)",
                  width: j === 0 ? "55%" : j === cols - 1 ? "40%" : "75%",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
