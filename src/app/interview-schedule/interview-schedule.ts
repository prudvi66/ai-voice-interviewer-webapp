import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { ScheduleDialogComponent } from '../schedule-dialog-component/schedule-dialog-component';
import { ResumeUpload } from '../resume-upload/resume-upload';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-interview-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatDatepickerModule,
    MatNativeDateModule, MatSelectModule, MatMenuModule,
    MatToolbarModule,MatDividerModule],
  templateUrl: './interview-schedule.html',
  styleUrl: './interview-schedule.scss'
})
export class InterviewSchedule implements OnInit {
  candidates: any[] = [];
  loading = false;
  file = '';

  hrProfile = {
    name: localStorage.getItem('recruiterName') || '',
    email: localStorage.getItem('recruiterEmail') || '',
    company: localStorage.getItem('companyName') || ''
  };

  displayedColumns: string[] = ['id', 'name', 'email', 'recruiterName', 'recruiterEmail', 'designation', 'actions'];
  expandedElement: any | null = null;

  constructor(private http: HttpClient, private router: Router, private dialog: MatDialog) { }

  ngOnInit() {
    const companyId = localStorage.getItem('companyId') || '2';
    const recruiterEmail = localStorage.getItem('recruiterEmail') || '';

    this.http.get(`http://localhost:8080/api/user/getCandidateDetails?companyId=${companyId}&recruiterEmail=${recruiterEmail}`)
      .subscribe({
        next: (res: any) => this.candidates = res || [],
        error: () => alert('Failed to load candidates')
      });

    this.http.get<any[]>(`http://localhost:8080/api/interview/getRemarks?type=INTERVIEW_ROUND_TYPE&companyId=${companyId}`)
      .subscribe({
        next: (res: any[]) => {
          this.masterRounds = (res || []).map(r => r.value);
          this.selectedRound = this.masterRounds.length > 0 ? this.masterRounds[0] : '';
        },
        error: () => {
          this.masterRounds = [];
          this.selectedRound = '';
        }
      });
  }

  masterRounds: string[] = [];
  selectedRound: string = '';

  scheduleInterview(candidate: any) {
    if (!candidate.selectedDate || !candidate.selectedTime) {
      alert('Please select both date and time.');
      return;
    }

    const [hours, minutes] = candidate.selectedTime.split(':');
    const dateObj = new Date(candidate.selectedDate);
    dateObj.setHours(+hours, +minutes, 0, 0);
    const scheduleDate = dateObj.getTime();

    const body = {
      roundName: this.selectedRound,
      scheduleDate,
      candidateId: candidate.candidateId
    };

    this.loading = true;
    this.http.post('http://localhost:8080/api/interiew/schedule', body, { observe: 'response' })
      .subscribe({
        next: () => {
          this.loading = false;
          alert('Interview scheduled successfully!');
          candidate.status = 'SCHEDULED';
          candidate.scheduleDate = scheduleDate;
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

  openScheduleDialog(candidate: any) {
    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      width: '400px',
      data: { candidate, masterRounds: this.masterRounds }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Optionally refresh data or update UI
      }
    });
  }

  editCandidate(candidate: any) {
    alert('Edit candidate: ' + candidate.name);
  }

  deleteCandidate(candidate: any) {
    alert('Delete candidate: ' + candidate.name);
  }

  newCandidate: any = {
    name: '',
    email: '',
    phoneNumber: '',
    experience: '',
    techStack: '',
    title: '',
    resumeFile: '',
    companyId: '',
    recruiterName: '',
    recruiterEmail: '',
    designation: ''
  };

  onResumeSelected(event: any) {
    this.file = event.target.files[0];
    if (this.file) {
      this.newCandidate.resume = this.file;
      const formData = new FormData();
      formData.append('file', this.file);
      this.http.post('http://localhost:8080/api/resume/upload', formData)
        .subscribe({
          next: (res: any) => {
            if (res) {
              this.newCandidate.name = res.name || '';
              this.newCandidate.email = res.email || '';
              this.newCandidate.phone = res.phoneNumber || '';
              this.newCandidate.experience = res.experience || '';
              this.newCandidate.techStack = res.techStack || '';
              this.newCandidate.title = res.title || '';
              this.newCandidate.designation =res.designation || ''
            }
          },
          error: (err) => {
            alert('Failed to extract fields from resume');
            console.error(err);
          }
        });
    }
  }

  registerCandidate() {
     
    const formData = new FormData();
    formData.append('name', this.newCandidate.name);
    formData.append('email', this.newCandidate.email);
    formData.append('phoneNumber', this.newCandidate.phone);
    formData.append('experience', this.newCandidate.experience);
    formData.append('techStack', this.newCandidate.techStack);
    formData.append('designation', this.newCandidate.designation);
    formData.append('techStack', this.newCandidate.techStack);
    formData.append('title', this.newCandidate.title);
    formData.append('resumeFile', this.file);
    if (this.file) {
      formData.append('resumeFile', this.file);
    }
    const companyId = localStorage.getItem('companyId') || '';
    const recruiterName = localStorage.getItem('recruiterName') || '';
    const recruiterEmail = localStorage.getItem('recruiterEmail') || '';
    formData.append('companyId', companyId);
    formData.append('recruiterName', recruiterName);
    formData.append('recruiterEmail', recruiterEmail);

    this.http.post('http://localhost:8080/api/user/registerCandidate' ,  formData)
      .subscribe({
        next: (res: any) => {
          alert('Candidate registered successfully!');
          this.candidates.push(res);
          this.newCandidate = { name: '', email: '', phone: '', experience: '', techStack: '', title: '', resume: null };
        },
        error: () => alert('Failed to register candidate')
      });
  }

  onRegisterCandidateClick() {
    this.router.navigate(['/resume-upload']);
  }

  logout() {
    localStorage.clear(); 
    this.router.navigate(['/auth']); 
  }
}
