import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
@Component({
  selector: 'app-schedule-dialog-component',
  imports: [
    CommonModule, FormsModule, MatCardModule, MatTableModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatDatepickerModule, MatNativeDateModule, MatSelectModule,
    MatDialogModule, MatDividerModule, MatInputModule,MatProgressSpinnerModule
  ],
  templateUrl: './schedule-dialog-component.html',
  styleUrls: ['./schedule-dialog-component.scss']
})
export class ScheduleDialogComponent implements OnInit {
 selectedRound: string;
  selectedDate: Date = new Date();
  selectedTime: string = '';
  timeSlots: string[] = [];
  loading = false;
  constructor(
    public dialogRef: MatDialogRef<ScheduleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {
    this.selectedRound = data.masterRounds[0];
  }

  ngOnInit() {
    this.timeSlots = this.generateTimeSlots();
  }

  generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${this.formatHour(hour)}:00`);
      slots.push(`${this.formatHour(hour)}:30`);
    }
    return slots;
  }

  formatHour(hour: number): string {
    return hour < 10 ? `0${hour}` : `${hour}`;
  }

  onCancel() {
    this.dialogRef.close();
  }

  onSchedule() {
    if (!this.selectedDate || !this.selectedTime) {
      alert('Please select date and time.');
      return;
    }

    const [hours, minutes] = this.selectedTime.split(':').map(Number);
    const scheduleDate = new Date(this.selectedDate);
    scheduleDate.setHours(hours, minutes, 0, 0);

    const body = {
      roundName: this.selectedRound,
      scheduleDate: scheduleDate.getTime(),
      candidateId: this.data.candidate.candidateId
    };
 this.loading = true;
    this.http.post('http://localhost:8080/api/interview/schedule', body, { observe: 'response' })
      .subscribe({
        next: () => {
          alert('Interview scheduled successfully!');
          this.loading = false; // ✅ Hide spinner
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.loading = false; 
          if (err.status === 409) {
            alert('Interview already scheduled for this candidate.');
          } else {
            alert('Failed to schedule interview.');
          }
        }
      });
  }
}