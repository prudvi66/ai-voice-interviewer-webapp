import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
interface AiHelpResponse { reply: string; }

@Injectable({ providedIn: 'root' })
export class AiInterviewService {
    private base = 'http://localhost:8080/api';

    constructor(private http: HttpClient) { }

    getQuestions(candidateId: string, companyId: string, round: string): Observable<any> {
        return this.http.get(`${this.base}/interview/questions`, {
            params: { candidateId, companyId, roundName: round }
        });
    }

    transcribe(blob: Blob): Observable<string> {
        const fd = new FormData(); fd.append('audio', blob, 'chunk.webm');
        return this.http.post<AiHelpResponse>(`${this.base}/ai/transcribe`, fd)
            .pipe(map(r => r.reply));
    }

    recordAnswer(payload: any): Observable<any> {
        return this.http.post(`${this.base}/interview/answer`, payload);
    }

    recordSkip(questionId: string): Observable<any> {
        return this.http.post(`${this.base}/interview/skip`, { questionId });
    }

    finishInterview(): Observable<any> {
        return this.http.post(`${this.base}/interview/finish`, {});
    }

    queryAi(input: string): Promise<string> {
        return this.http
            .post<AiHelpResponse>(`${this.base}/ai/grok-chat`, { input })
            .toPromise()
            .then(r => {
                // safe‑access reply, default to empty string
                const text = (r && r.reply) ? r.reply : '';
                return text.split(/[\.\n]/)[3].trim();
            })
            .catch(() => 'Sorry, I can’t help with that right now.');
    }

    saveInterviewResponse(interviewResponse: any): Observable<any> {
        const url = 'http://localhost:8080/api/interview/saveResponse';
        return this.http.post(url, interviewResponse);
    }
}
