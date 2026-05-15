import type { TableFrame } from "@/types/pageLayout";

export function createDefaultTableFrame(x: number, y: number, rows = 3, cols = 3): TableFrame {
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(r === 0 ? `Header ${c + 1}` : "");
    }
    cells.push(row);
  }
  return {
    id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "table",
    rows,
    cols,
    cells,
    cellBorders: true,
    headerRow: true,
    visible: true,
    locked: false,
    zIndex: 0,
    opacity: 1,
    x,
    y,
    width: cols * 120,
    height: rows * 30,
    rotation: 0,
  };
}

export function updateTableCell(
  table: TableFrame,
  rowIndex: number,
  colIndex: number,
  text: string,
): TableFrame {
  const cells = table.cells.map((r, ri) =>
    ri === rowIndex ? r.map((c, ci) => (ci === colIndex ? text : c)) : r,
  );
  return { ...table, cells };
}

export function insertTableRow(table: TableFrame, afterIndex: number): TableFrame {
  const cells = [...table.cells];
  const newRow = new Array(table.cols).fill("");
  cells.splice(afterIndex + 1, 0, newRow);
  return { ...table, cells, rows: table.rows + 1, height: table.height + 30 };
}

export function insertTableColumn(table: TableFrame, afterIndex: number): TableFrame {
  const cells = table.cells.map((r) => {
    const c = [...r];
    c.splice(afterIndex + 1, 0, "");
    return c;
  });
  return { ...table, cells, cols: table.cols + 1, width: table.width + 120 };
}
