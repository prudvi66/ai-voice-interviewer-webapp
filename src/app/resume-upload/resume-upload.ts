import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { Location } from '@angular/common';
@Component({
  selector: 'app-resume-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule,
    MatButtonModule, MatInputModule, MatFormFieldModule, MatIconModule],
  templateUrl: './resume-upload.html',
  styleUrls: ['./resume-upload.scss']
})
export class ResumeUpload {


  resumeFile: File | null = null;
  extractedFields: any = null;

  constructor(private http: HttpClient, private router: Router, private location: Location) { }

  ngOnInit() {
    this.extractedFields = {};
    // If HR is logged in
    if (localStorage.getItem('recruiterName')) {
      this.extractedFields.recruiterName = localStorage.getItem('recruiterName') || '';
      this.extractedFields.recruiterEmail = localStorage.getItem('recruiterEmail') || '';
      this.extractedFields.companyName = localStorage.getItem('companyName') || '';
      this.extractedFields.companyId = localStorage.getItem('companyId') || '';
    }
    // If Candidate is logged in
    if (localStorage.getItem('candidateName')) {
      this.extractedFields.name = localStorage.getItem('candidateName') || '';
      this.extractedFields.email = localStorage.getItem('candidateEmail') || '';
      this.extractedFields.phone = localStorage.getItem('candidatePhone') || '';
      this.extractedFields.designation = localStorage.getItem('candidateDesignation') || '';
      this.extractedFields.experience = localStorage.getItem('candidateExperience') || '';
      this.extractedFields.role = localStorage.getItem('candidateRole') || '';
      this.extractedFields.companyId = localStorage.getItem('companyId') || '';
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.resumeFile = input.files[0];
      const formData = new FormData();
      formData.append('file', this.resumeFile);

      // Call backend API to extract fields from resume
      this.http.post('http://localhost:8080/api/resume/upload', formData)
        .subscribe({
          next: (res: any) => {
            this.extractedFields = res;
            // Optionally auto-call registerCandidate here if you want auto-registration
            // this.registerCandidate();
          },
          error: () => alert('Failed to extract fields from resume')
        });
    }
  }


  registerCandidate(form?: any): void {
    if (!this.resumeFile) {
      alert('Please select a resume file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64File = reader.result as string;

      const requestBody = {
        name: this.extractedFields.name || '',
        email: this.extractedFields.email || '',
        phone: this.extractedFields.phone || this.extractedFields.phoneNumber || '',
        techStack: this.extractedFields.techStack || '',
        experience: this.extractedFields.experience || '',
        designation: this.extractedFields.designation || '',
        title: this.extractedFields.title || '',
        recruiterEmail: localStorage.getItem('recruiterEmail') || '',
        recruiterName: localStorage.getItem('recruiterName') || '',
        companyId: localStorage.getItem('companyId') || '',
        resume: base64File
      };

      this.http.post('http://localhost:8080/api/user/registerCandidateJson', requestBody)
        .subscribe({
          next: (res: any) => {
            if (res.successResponse) {
              alert('Candidate registered successfully!');
              this.resumeFile = null;
              this.extractedFields = {};
              if (form) form.reset();
              this.router.navigate(['/interview-schedule']);
            } else {
              alert('Failed to register candidate');
              this.router.navigate(['/interview-schedule']);
            }
          },
          error: () => alert('Failed to register candidate')
        });
    };

    reader.readAsDataURL(this.resumeFile); // triggers reader.onload
  }

  goBack(): void {
    this.location.back();
  }

}
