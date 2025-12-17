/**
 * Output formatting utilities for CLI commands
 */

export interface JSONOutput<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function formatJSON<T>(data: T, error?: { code: string; message: string }): JSONOutput<T> {
  if (error) {
    return {
      status: 'error',
      error,
    };
  }

  return {
    status: 'success',
    data,
  };
}

export function outputJSON<T>(data: JSONOutput<T>): void {
  console.log(JSON.stringify(data, null, 2));
}

export function formatTable<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) {
    return '';
  }

  const keys = Object.keys(rows[0]);
  const columnWidths = keys.map((key) => {
    const headerWidth = String(key).length;
    const maxContentWidth = Math.max(
      ...rows.map((row) => String(row[key] ?? '').length),
    );
    return Math.max(headerWidth, maxContentWidth);
  });

  const separator = columnWidths
    .map((width) => '─'.repeat(width + 2))
    .join('┼');

  const header = keys
    .map((key, i) => ` ${String(key).padEnd(columnWidths[i])} `)
    .join('┃');

  const lines = rows.map((row) =>
    keys
      .map((key, i) => ` ${String(row[key] ?? '').padEnd(columnWidths[i])} `)
      .join('┃'),
  );

  return [header, separator, ...lines].join('\n');
}
