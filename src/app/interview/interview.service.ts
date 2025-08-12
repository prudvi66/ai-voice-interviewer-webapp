import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface AiHelpResponse { 
    choices: {
        message: { 
            content: string 
        } 
    }[];
 }
interface Question {
  questionId: string;
  questionName: string;
  dept: string;
  nestedQuestion: Question[];
  isMaster: boolean;
  nestedOf?: string;
}

interface InterviewResponse {
  roundName: string;
  shceduledDate: number;
  candidateId: number;
  companyId: number;
  files: {
    file: string;
    type: string;
    extension: string;
  };
  metris: {
    windowFocusLost: number;
    audioDrop: number;
    videoDrop: number;
    interviewDuration: number;
    gazingOutTime: number;
  };
  deptQuestions: {
    department: string;
    masterQuestion: {
      questionName: string;
      isMandatory: boolean;
      questionId: number;
      answer: string;
      relevantScore: number;
      nestedQuestion: {
        questionName: string;
        isMandatory: boolean;
        questionId: number;
        answer: string;
        relevantScore: number;
      }[];
    }[];
  }[];
}


@Injectable({ providedIn: 'root' })
export class AiInterviewService {
    private base = 'http://localhost:8080/api/';

    private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private apiKey = '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';

    constructor(private http: HttpClient) { }

    getQuestions(candidateId: string, companyId: string, round: string): Observable<any> {
        return this.http.get(`${this.base}interview/questions`, {
            params: { candidateId, companyId, roundName: round }
        });
    }


    // queryAi(input: string): Promise<string> {
    //     return this.http
    //         .post<AiHelpResponse>(`${this.base}/ai/grok-chat`, { input })
    //         .toPromise()
    //         .then(r => {
    //             // safe‑access reply, default to empty string
    //             const text = (r && r.reply) ? r.reply : '';
    //             return text.split(/[\.\n]/)[3].trim();
    //         })
    //         .catch(() => 'Sorry, I can’t help with that right now.');
    // }

    // saveInterviewResponse(interviewResponse: any): Observable<any> {
    //     const url = 'http://localhost:8080/api/interview/saveResponse';
    //     return this.http.post(url, interviewResponse);
    // }
    saveInterviewResponse(response: InterviewResponse): Promise<void> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return new Promise((resolve, reject) => {
      this.http
        .post<void>(`${this.base}interview/saveResponse`, response, { headers })
        .subscribe({
          next: () => resolve(),
          error: (error: any) => {
            console.error('Error saving interview response:', error);
            reject(new Error('Failed to save interview response.'));
          }
        });
    });
  }

    queryAi(input: string): Promise<string> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        });
        const payload = {
            model: 'x-ai/grok-3-beta',
            messages: [{ role: 'user', content: input }],
            max_tokens: 1000
        };
        return new Promise((resolve, reject) => {
            this.http
                .post<AiHelpResponse>(this.apiUrl, payload, { headers })
                .subscribe({
                    next: (response: AiHelpResponse) => {
                        const content = response.choices[0]?.message.content || 'Sorry, I can’t help with that right now.';
                        resolve(content);
                    },
                    error: (error: any) => {
                        console.error('Error calling Grok API:', error);
                        const message = error.status === 401 ? 'Unauthorized: Invalid API key.' : 'Failed to query AI. Please try again later.';
                        resolve(message); // Resolve with fallback to maintain Promise<string>
                    }
                });
        });
    }

}
