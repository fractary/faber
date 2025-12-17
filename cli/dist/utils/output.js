/**
 * Output formatting utilities for CLI commands
 */
export function formatJSON(data, error) {
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
export function outputJSON(data) {
    console.log(JSON.stringify(data, null, 2));
}
export function formatTable(rows) {
    if (rows.length === 0) {
        return '';
    }
    const keys = Object.keys(rows[0]);
    const columnWidths = keys.map((key) => {
        const headerWidth = String(key).length;
        const maxContentWidth = Math.max(...rows.map((row) => String(row[key] ?? '').length));
        return Math.max(headerWidth, maxContentWidth);
    });
    const separator = columnWidths
        .map((width) => '─'.repeat(width + 2))
        .join('┼');
    const header = keys
        .map((key, i) => ` ${String(key).padEnd(columnWidths[i])} `)
        .join('┃');
    const lines = rows.map((row) => keys
        .map((key, i) => ` ${String(row[key] ?? '').padEnd(columnWidths[i])} `)
        .join('┃'));
    return [header, separator, ...lines].join('\n');
}
