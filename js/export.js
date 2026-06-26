/**
 * Export utilities — CSV/Excel-compatible downloads and image downloads
 */

/** Trigger browser download of a Blob */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Escape CSV cell value */
function csvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Export rows as CSV (UTF-8 BOM for Excel Arabic support) */
export function exportToCsv(filename, headers, rows) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/** Export single member data row */
export function exportMemberData(member) {
  exportToCsv(
    `member_${member.studentId || member.id}.csv`,
    ['Field', 'Value'],
    [
      ['Full Name', member.fullName],
      ['National ID', member.nationalId],
      ['Age', member.age],
      ['Student ID', member.studentId],
      ['Email', member.email],
      ['Phone', member.phone],
      ['Address', member.address],
      ['Registration Date', member.registrationDate?.toDate?.()?.toLocaleDateString?.() ?? ''],
    ]
  );
}

/** Export all members to one spreadsheet */
export function exportAllMembers(members) {
  exportToCsv(
    `team_members_${new Date().toISOString().slice(0, 10)}.csv`,
    ['Full Name', 'National ID', 'Age', 'Student ID', 'Email', 'Phone', 'Address', 'Registered'],
    members.map((m) => [
      m.fullName,
      m.nationalId,
      m.age,
      m.studentId,
      m.email ?? '',
      m.phone ?? '',
      m.address ?? '',
      m.registrationDate?.toDate?.()?.toLocaleDateString?.() ?? '',
    ])
  );
}

/** Download image from URL or Base64 data URL */
export async function downloadImageFromUrl(url, filename) {
  if (!url) return false;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    downloadBlob(blob, filename);
    return true;
  } catch {
    return false;
  }
}
