export function exportToCsv<T>(
  data: T[],
  filename: string,
  columns: { header: string; key: keyof T | ((item: T) => any) }[]
) {
  if (data.length === 0) return;

  const escapeCsvValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = columns.map(col => escapeCsvValue(col.header)).join(',');
  const rows = data.map(item => {
    return columns.map(col => {
      const val = typeof col.key === 'function' ? col.key(item) : item[col.key];
      return escapeCsvValue(val);
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
