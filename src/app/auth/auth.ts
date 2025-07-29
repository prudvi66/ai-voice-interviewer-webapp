import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule,
     MatCardModule, MatButtonModule, MatInputModule, MatButtonToggleModule,
    MatIconModule, MatProgressBarModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.scss']
})
export class Auth {
  role: 'HR' | 'CANDIDATE' = 'HR';
  email = '';
  password = '';
  otp = '';
  showOtp = false;
  loading = false;

  constructor(private http: HttpClient,private router: Router) {}

  

  login() {
    if (this.role === 'HR') {
      const body = {
        email: this.email,
        password: this.password,
        role: 'HR'
      };
      console.log("hr login body", body);
      this.loading = true;
      this.http.post('http://localhost:8080/api/user/login', body)
        .subscribe({
          next: (res: any) => {
            this.loading = false;
            if (res.successMessage) {
               // Store only HR details
              localStorage.setItem('recruiterName', res.name || '');
              localStorage.setItem('recruiterEmail', res.email || '');
              localStorage.setItem('companyName', res.companyName || '');
              localStorage.setItem('companyId', res.companyId || '');
              // Clear candidate details
              localStorage.removeItem('candidateName');
              localStorage.removeItem('candidateEmail');
              localStorage.removeItem('candidatePhone');
              localStorage.removeItem('candidateDesignation');
              localStorage.removeItem('candidateExperience');
              localStorage.removeItem('candidateRole');
               localStorage.removeItem('candidateId');
              alert(res.successMessage);
              this.router.navigate(['/interview-schedule']); 
            } else {
              alert('Login failed');
            }
          },
          error: () => {
            this.loading = false;
            alert('Login failed')
          }
        });
    } else {
      this.loading = true;
      this.http.get(`http://localhost:8080/api/user/sendMail?mail=${this.email}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.successResponse) {
            alert(res.successResponse);
            this.showOtp = true;
          } else {
            alert('Failed to send OTP');
          }
        },
        error: () => {
          this.loading = false;
          alert('Failed to send OTP')
        }
      });
    }
  }

  verifyOtp() {
    const body = {
    email: this.email,
    role: 'CANDIDATE',
    otp: this.otp
  };
  this.loading = true;
  this.http.post('http://localhost:8080/api/user/login', body)
    .subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.successMessage) {
           localStorage.setItem('candidateName', res.name || '');
            localStorage.setItem('candidateEmail', res.email || '');
            localStorage.setItem('candidatePhone', res.phone || '');
            localStorage.setItem('candidateId', res.candidateId || '');
            localStorage.setItem('candidateDesignation', res.designation || '');
            localStorage.setItem('candidateExperience', res.experience || '');
            localStorage.setItem('roundName', res.roundName  || '');
            localStorage.setItem('companyId', res.companyId );
            localStorage.setItem('companyName', res.companyName );
            // Clear HR details
            localStorage.removeItem('recruiterName');
            localStorage.removeItem('recruiterEmail');
           
          alert(res.successMessage);
          this.router.navigate(['/interview']); 
        } else {
          alert('OTP verification failed');
        }
      },
      error: () => {
        this.loading = false;
        alert('OTP verification failed')
      }
    });
  }
}