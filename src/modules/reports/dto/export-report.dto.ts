import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject } from 'class-validator';

export class ExportReportDto {
  @ApiProperty({ enum: ['pdf', 'excel', 'csv'] })
  @IsIn(['pdf', 'excel', 'csv'])
  format: 'pdf' | 'excel' | 'csv';

  @ApiProperty({ enum: ['tasks_by_department', 'tasks_by_employee', 'completed_vs_overdue', 'productivity'] })
  @IsIn(['tasks_by_department', 'tasks_by_employee', 'completed_vs_overdue', 'productivity'])
  report: 'tasks_by_department' | 'tasks_by_employee' | 'completed_vs_overdue' | 'productivity';

  @ApiProperty()
  @IsObject()
  filters: Record<string, unknown>;
}
