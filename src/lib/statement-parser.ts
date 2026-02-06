import * as XLSX from 'xlsx';

// Common bank format detection patterns
interface BankFormat {
  name: string;
  dateColumns: string[];
  descriptionColumns: string[];
  amountColumns: string[];
  debitColumns: string[];
  creditColumns: string[];
}

const COMMON_BANK_FORMATS: BankFormat[] = [
  {
    name: 'Generic CSV',
    dateColumns: ['date', 'transaction date', 'posting date', 'trans date', 'value date'],
    descriptionColumns: ['description', 'details', 'narrative', 'memo', 'particulars', 'transaction description'],
    amountColumns: ['amount', 'value', 'transaction amount'],
    debitColumns: ['debit', 'withdrawal', 'withdrawals', 'money out', 'dr'],
    creditColumns: ['credit', 'deposit', 'deposits', 'money in', 'cr'],
  },
  {
    name: 'Chase Bank',
    dateColumns: ['posting date', 'trans date'],
    descriptionColumns: ['description'],
    amountColumns: ['amount'],
    debitColumns: [],
    creditColumns: [],
  },
  {
    name: 'Bank of America',
    dateColumns: ['date'],
    descriptionColumns: ['description'],
    amountColumns: ['amount'],
    debitColumns: [],
    creditColumns: [],
  },
  {
    name: 'Wells Fargo',
    dateColumns: ['date'],
    descriptionColumns: ['description'],
    amountColumns: ['amount'],
    debitColumns: [],
    creditColumns: [],
  },
  {
    name: 'PayPal',
    dateColumns: ['date'],
    descriptionColumns: ['name', 'type'],
    amountColumns: ['net'],
    debitColumns: [],
    creditColumns: [],
  },
];

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  rawData?: Record<string, unknown>;
}

export interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  detectedFormat?: string;
  headers?: string[];
  columnMapping?: ColumnMapping;
  error?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Normalize a column name for comparison
 */
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_-]/g, ' ');
}

/**
 * Find a matching column from a list of possible names
 */
function findColumn(headers: string[], possibleNames: string[]): string | undefined {
  const normalizedHeaders = headers.map(normalizeColumnName);

  for (const name of possibleNames) {
    const normalizedName = normalizeColumnName(name);
    const index = normalizedHeaders.findIndex(h => h === normalizedName || h.includes(normalizedName));
    if (index !== -1) {
      return headers[index];
    }
  }
  return undefined;
}

/**
 * Auto-detect column mapping from headers
 */
function autoDetectColumnMapping(headers: string[]): { mapping: ColumnMapping; format: string } | null {
  for (const format of COMMON_BANK_FORMATS) {
    const dateColumn = findColumn(headers, format.dateColumns);
    const descriptionColumn = findColumn(headers, format.descriptionColumns);
    const amountColumn = findColumn(headers, format.amountColumns);
    const debitColumn = findColumn(headers, format.debitColumns);
    const creditColumn = findColumn(headers, format.creditColumns);

    // Must have at least date, description, and some amount column
    if (dateColumn && descriptionColumn && (amountColumn || debitColumn || creditColumn)) {
      return {
        mapping: {
          dateColumn,
          descriptionColumn,
          amountColumn,
          debitColumn,
          creditColumn,
        },
        format: format.name,
      };
    }
  }

  return null;
}

/**
 * Parse a date string into a Date object
 */
function parseDate(dateStr: string | number | Date): Date | null {
  if (dateStr instanceof Date) {
    return dateStr;
  }

  if (typeof dateStr === 'number') {
    // Excel serial date number
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
  }

  // Try common date formats
  const formats = [
    // ISO format
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // US format (MM/DD/YYYY)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // UK format (DD/MM/YYYY)
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
    // Date with dashes (DD-MM-YYYY or MM-DD-YYYY)
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
  ];

  for (const regex of formats) {
    const match = dateStr.match(regex);
    if (match) {
      // Try to parse as date
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  // Fallback to Date constructor
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Parse an amount string into a number
 */
function parseAmount(value: string | number): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (!value || typeof value !== 'string') {
    return null;
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$€£¥,\s]/g, '').trim();

  // Handle parentheses as negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const num = parseFloat(cleaned.slice(1, -1));
    return isNaN(num) ? null : -num;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse a CSV string into an array of rows
 */
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }

  return result;
}

/**
 * Parse bank statement file (CSV or Excel)
 */
export async function parseStatementFile(
  buffer: Buffer,
  filename: string,
  customMapping?: ColumnMapping
): Promise<ParseResult> {
  try {
    const extension = filename.toLowerCase().split('.').pop();
    let headers: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (extension === 'csv' || extension === 'txt') {
      const content = buffer.toString('utf-8');
      const parsed = parseCSV(content);

      if (parsed.length < 2) {
        return {
          success: false,
          transactions: [],
          error: 'File appears to be empty or has no data rows',
        };
      }

      headers = parsed[0];
      rows = parsed.slice(1).map(row => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] || '';
        });
        return obj;
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: 50000 });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });

      if (data.length < 2) {
        return {
          success: false,
          transactions: [],
          error: 'File appears to be empty or has no data rows',
        };
      }

      headers = (data[0] as unknown[]).map(h => String(h || ''));
      rows = data.slice(1).map(row => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = (row as unknown[])[i] || '';
        });
        return obj;
      });
    } else {
      return {
        success: false,
        transactions: [],
        error: `Unsupported file format: ${extension}`,
      };
    }

    // Determine column mapping
    let mapping: ColumnMapping;
    let detectedFormat: string | undefined;

    if (customMapping) {
      mapping = customMapping;
    } else {
      const detected = autoDetectColumnMapping(headers);
      if (!detected) {
        return {
          success: false,
          transactions: [],
          headers,
          error: 'Could not auto-detect column mapping. Please specify column mapping manually.',
        };
      }
      mapping = detected.mapping;
      detectedFormat = detected.format;
    }

    // Parse transactions
    const transactions: ParsedTransaction[] = [];
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    for (const row of rows) {
      const dateValue = row[mapping.dateColumn];
      const descriptionValue = row[mapping.descriptionColumn];

      if (!dateValue || !descriptionValue) continue;

      const date = parseDate(dateValue as string | number | Date);
      if (!date) continue;

      let amount: number;
      let type: 'DEBIT' | 'CREDIT';

      if (mapping.amountColumn) {
        const amountValue = parseAmount(row[mapping.amountColumn] as string | number);
        if (amountValue === null) continue;
        amount = Math.abs(amountValue);
        type = amountValue < 0 ? 'DEBIT' : 'CREDIT';
      } else if (mapping.debitColumn && mapping.creditColumn) {
        const debitValue = parseAmount(row[mapping.debitColumn] as string | number);
        const creditValue = parseAmount(row[mapping.creditColumn] as string | number);

        if (debitValue && debitValue !== 0) {
          amount = Math.abs(debitValue);
          type = 'DEBIT';
        } else if (creditValue && creditValue !== 0) {
          amount = Math.abs(creditValue);
          type = 'CREDIT';
        } else {
          continue;
        }
      } else {
        continue;
      }

      transactions.push({
        date,
        description: String(descriptionValue).trim(),
        amount,
        type,
        rawData: row,
      });

      // Track date range
      if (!startDate || date < startDate) startDate = date;
      if (!endDate || date > endDate) endDate = date;
    }

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        headers,
        columnMapping: mapping,
        detectedFormat,
        error: 'No valid transactions found in file',
      };
    }

    // Sort by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      success: true,
      transactions,
      headers,
      columnMapping: mapping,
      detectedFormat,
      startDate,
      endDate,
    };
  } catch (error) {
    console.error('Error parsing statement file:', error);
    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Failed to parse file',
    };
  }
}

/**
 * Get headers from a file for manual column mapping
 */
export async function getFileHeaders(buffer: Buffer, filename: string): Promise<string[]> {
  const extension = filename.toLowerCase().split('.').pop();

  if (extension === 'csv' || extension === 'txt') {
    const content = buffer.toString('utf-8');
    const parsed = parseCSV(content);
    return parsed.length > 0 ? parsed[0] : [];
  } else if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer', sheetRows: 50000 });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    return data.length > 0 ? (data[0] as unknown[]).map(h => String(h || '')) : [];
  }

  return [];
}
