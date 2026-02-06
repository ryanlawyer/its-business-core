// Column configuration type
export interface TemplateColumn {
  sourceField: string;
  headerName: string;
  order: number;
}

// Available fields for export templates
export const AVAILABLE_EXPORT_FIELDS = [
  { field: 'employeeId', label: 'Employee ID' },
  { field: 'employeeName', label: 'Employee Name' },
  { field: 'employeeEmail', label: 'Employee Email' },
  { field: 'department', label: 'Department' },
  { field: 'clockIn', label: 'Clock In' },
  { field: 'clockOut', label: 'Clock Out' },
  { field: 'date', label: 'Date' },
  { field: 'regularHours', label: 'Regular Hours' },
  { field: 'dailyOvertimeHours', label: 'Daily OT Hours' },
  { field: 'weeklyOvertimeHours', label: 'Weekly OT Hours' },
  { field: 'totalHours', label: 'Total Hours' },
  { field: 'status', label: 'Status' },
  { field: 'approvedBy', label: 'Approved By' },
  { field: 'approvedAt', label: 'Approved At' },
];
