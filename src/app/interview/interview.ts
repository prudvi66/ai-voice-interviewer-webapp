import {
  OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, NgZone
} from '@angular/core';
import { Component } from '@angular/core';
import { Subscription, interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as faceapi from 'face-api.js';
import { AiInterviewService } from './interview.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';
import type { Face, Keypoint } from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { ChangeDetectorRef } from '@angular/core';
declare global {

  interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
  }

  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }



  interface Question {
    questionId: string;
    questionName: string;
    dept: string;
    nestedQuestion: Question[];
    isMaster: boolean;
    nestedOf?: string;
    isMandatory?: boolean;
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
}
@Component({
  standalone: true,
  selector: 'app-interview',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatDatepickerModule, MatNativeDateModule, MatSelectModule, MatMenuModule,
    MatToolbarModule, MatDividerModule, MatInputModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatStepperModule, MatExpansionModule, MatSidenavModule,
    MatButtonToggleModule, MatChipsModule, MatProgressBarModule
  ],
  templateUrl: './interview.html',
  styleUrls: ['./interview.scss']
})
export class Interview implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayerRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('hiddenCanvas', { static: false }) hiddenCanvasRef!: ElementRef<HTMLCanvasElement>;

  isLoadingSession = true;
  videoReady = false;
  isListening = false;
  isAnswering = false;
  cameraOn = true;
  microphoneOn = true;
  showWarning = false;
  interviewTimer = 0;
  lookAwayCounter = 0;
  gazeWarnings = 0;

  globalWarningMessage: string = '';
  motivationalNudge: string = '';
  currentExpression: string = '';
  expressionTimeline: { time: number; expression: string }[] = [];

  currentLiveTranscript: string = '';
  fullTranscriptEntries: { type: 'candidate' | 'ai'; text: string }[] = [];
  fullChatHistory: ChatMessage[] = [];
  private mediaStream: MediaStream | null = null;


  showRealtimeFeedback: boolean = false;
  speakingRateFeedback: string = '';
  fillerWordFeedback: string = '';
  showGazeOverlay: boolean = false;
  silenceWarning: boolean = false;
  showGlobalWarning: boolean = false;

  candidateName = localStorage.getItem('candidateName') || 'Candidate';
  companyName = localStorage.getItem('companyName') || 'Company';
  roundName = localStorage.getItem('roundName') || 'R1 Java Revamped';
  allQuestions: Question[] = [];
  currentQuestionIndex = 0;
  currentQuestion: Question | null = null;
  answers: Record<string, string> = {};
  currentQuestionId = '';
  lastQuestionSpoken = '';
  candidateIntroCaptured = false;
  candidateIntro = '';
  assistantMessages: string[] = [];
  userQuery = '';
  isLastQuestion = false;
  candidateQueries: string[] = [];

  loadingProgress: number = 0;
  recognition: any;

  private stream: MediaStream | null = null;
  private mediaRecorder!: MediaRecorder;
  private recordedBlobs: Blob[] = [];
  videoBlobs: Record<string, Blob> = {};
  fullRecordingBlobs: Blob[] = [];
  fullInterviewBlob!: Blob;

  private timerSub!: Subscription;
  private faceCaptureInterval!: any;
  private silenceTimeoutId: any;
  private destroy$ = new Subject<void>();

  readonly MAX_LOOKAWAY_COUNT = 1;
  readonly MAX_GAZE_WARNINGS = 1000;
  readonly MAX_TAB_WARNINGS = 2;
  readonly SILENCE_TIMEOUT_MS = 20000;
  readonly GAZE_CHECK_INTERVAL_MS = 2000;
  readonly FACE_CAPTURE_INTERVAL_MS = 2000;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private audioDataArray: Uint8Array | null = null;
  private speechActivityTimer: any;
  private lastSpeechActivityTime: number = 0;
  private hasSpeechActivityBeenDetected: boolean = false;

  readonly MIN_SPEECH_ACTIVITY_VOLUME_THRESHOLD = 20;
  readonly INACTIVITY_THRESHOLD_MS = 10000;

  canvasContext: CanvasRenderingContext2D | null = null;
  prevFrameData: ImageData | null = null;
  motionDetectionInterval: any;
  readonly MOTION_PIXEL_CHANGE_THRESHOLD = 50;
  readonly MOTION_DETECTION_INTERVAL_MS = 500;
  motionWarnings: number = 0;
  readonly MAX_MOTION_WARNINGS = 5;
  motionWarningTimer: any;

  windowFocusWarnings: number = 0;
  MAX_WINDOW_FOCUS_WARNINGS = 3;
  windowFocusTimeout: any;
  WINDOW_FOCUS_DEBOUNCE_MS = 1000;

  isAiSpeaking: boolean = false;
  tabSwitchCount: number = 0;
  outOfWindowFocusCount: number = 0;
  copyPasteAttempts: number = 0;
  audioInputLostCount: number = 0;
  videoInputLostCount: number = 0;

  answeredSet = new Set<string>();
  facialMonitorInterval: any;
  silenceMessage: string = 'Prolonged Silence';
  private faceMesh: FaceMesh | null = null;
  private camera: Camera | null = null;

  formattedInterviewTime = '00:00:00';

  private metrics = {
    windowFocusLost: 0,
    audioDrop: 0,
    videoDrop: 0,
    interviewDuration: 0,
    gazingOutTime: 0
  };
  private videoFile: string = '';

  constructor(
    private ai: AiInterviewService,
    public snack: MatSnackBar,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef
  ) { }

  async ngOnInit() {
   
    this.monitorAudioInputLoss();
    this.introduceAI();
  }

  ngAfterViewInit(): void {
    this.requestMedia();
    this.initFaceMeshTracking();
     this.fetchQuestions();
    this.startInterviewTimer();
    this.setupTabRestriction();
    this.loadModels();
    this.initializeSpeechRecognition();
  }

  loadModels(): void {
    this.setupTabRestriction();
    this.setupWindowFocusMonitoring();
    this.startMotionDetection();
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.snack.open('Speech recognition not supported in this browser.', 'OK');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[event.resultIndex][0].transcript.trim();
      this.ngZone.run(() => {
        this.currentLiveTranscript = transcript;
        this.fullChatHistory.push({ sender: 'user', text: transcript, timestamp: new Date() });
        this.handleCandidateSpeech(transcript);
        this.resetSilenceTimer();
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        if (this.isListening) {
          this.recognition.start();
        }
      }
      this.ngZone.run(() => { });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        console.log('Speech recognition ended.');
        this.isListening = false;
        if (this.isAnswering && !this.answeredSet.has(this.currentQuestionId)) {
          this.stopRecordingAndProcessAnswer();
        }
      });
    };
  }

  introduceAI(): void {
    const message = "Hello! I'm your AI interviewer. I'm here to make this interview engaging and insightful. Let's start with a brief introduction from you. Could you tell me about yourself?";
    this.fullChatHistory.push({ sender: 'ai', text: message, timestamp: new Date() });
    this.speak(message, () => {
      this.startListening();
      this.startFullRecording();
    });
  }

  startListening(): void {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        console.log('Speech recognition started.');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        this.snack.open('Could not start speech recognition.', 'OK');
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log('Speech recognition stopped.');
    }
  }

  async handleCandidateSpeech(transcript: string): Promise<void> {
    transcript = transcript.trim();
    if (!transcript) {
      console.log('Ignoring empty speech transcript.');
      return;
    }

    if (!this.candidateIntroCaptured) {
      this.candidateIntro = transcript;
      this.candidateIntroCaptured = true;
      this.fullChatHistory.push({ sender: 'user', text: transcript, timestamp: new Date() });
      console.log('Candidate intro captured:', this.candidateIntro);
      await this.processCandidateResponse(transcript, true);
      return;
    }

    if (this.isAnswering && this.currentQuestionId) {
      this.answers[this.currentQuestionId] = transcript;
      this.fullChatHistory.push({ sender: 'user', text: transcript, timestamp: new Date() });
      console.log(`Answer captured for Question ${this.currentQuestionId}:`, transcript);
      await this.processCandidateResponse(transcript, false);
    }
  }

//   async processCandidateResponse(transcript: string, isIntro: boolean): Promise<void> {
//   this.isLoadingSession = true;
//   const prompt = isIntro
//     ? `Candidate intro: "${transcript}". Evaluate the introduction for completeness and relevance to a software engineering role. Return a JSON object with { "isSatisfactory": boolean, "response": string } where "response" is a friendly message confirming readiness to ask the first question.`
//     : `Evaluate the candidate's answer: "${transcript}" for the question: "${this.currentQuestion?.questionName}". Determine if the answer is satisfactory based on correctness, completeness, and relevance to a software engineering role. Return a JSON object with { "isSatisfactory": boolean, "response": string, "nestedQuestion": string | null } where "response" is a confidence-boosting message if satisfactory or a prompt for a nested question if not, and "nestedQuestion" is the follow-up question ID if applicable.`;

//   try {
//     console.log('Processing response for question:', this.currentQuestion?.questionName, 'Index:', this.currentQuestionIndex, 'IsIntro:', isIntro);
//     const response = await this.ai.queryAi(prompt);
//     let evaluation: { isSatisfactory: boolean; response: string; nestedQuestion?: string | null };
//     try {
//       evaluation = JSON.parse(response);
//     } catch (e) {
//       console.error('Failed to parse AI evaluation:', response, e);
//       evaluation = {
//         isSatisfactory: false,
//         response: isIntro ? 'Great intro! Let’s move to the first question.' : 'Let’s dive deeper into your answer.',
//         nestedQuestion: isIntro ? null : this.currentQuestion?.nestedQuestion?.[0]?.questionId || null
//       };
//     }

//     this.fullChatHistory.push({ sender: 'ai', text: evaluation.response, timestamp: new Date() });
//     this.speak(evaluation.response, async () => {
//       if (isIntro) {
//         if (this.allQuestions.length === 0) {
//           console.error('No questions available after intro. Retrying fetchQuestions.');
//           await this.fetchQuestions();
//           return;
//         }
//         this.currentQuestionIndex = 0;
//         await this.askNext();
//       } else if (!this.currentQuestion) {
//         console.warn('No current question available. Checking for next question.');
//         if (this.currentQuestionIndex < this.allQuestions.length) {
//           await this.askNext();
//         } else {
//           console.log('No more questions. Submitting responses.');
//           await this.submitResponses();
//         }
//       } else {
//         if (!evaluation.isSatisfactory && evaluation.nestedQuestion && this.currentQuestion.nestedQuestion?.length > 0) {
//           const nestedQuestion = this.currentQuestion.nestedQuestion.find(q => q.questionId === evaluation.nestedQuestion) || this.currentQuestion.nestedQuestion[0];
//           console.log('Asking nested question:', nestedQuestion.questionName);
//           this.currentQuestion = { ...nestedQuestion, dept: this.currentQuestion.dept, nestedOf: this.currentQuestion.questionId, isMaster: false };
//           this.currentQuestionId = nestedQuestion.questionId.toString();
//           this.fullChatHistory.push({ sender: 'ai', text: nestedQuestion.questionName, timestamp: new Date() });
//           this.cd.detectChanges(); // Update UI
//           this.speak(nestedQuestion.questionName, () => {
//             this.startQuestionRecording(this.currentQuestionId);
//             this.startListening();
//             this.resetSilenceTimer();
//             this.isAnswering = true;
//           });
//         } else {
//           this.answeredSet.add(this.currentQuestionId);
//           if (this.currentQuestionIndex + 1 >= this.allQuestions.length) {
//             console.log('All questions answered. Moving to closing statement.');
//             await this.submitResponses();
//           } else {
//             console.log('Moving to next question. Current index:', this.currentQuestionIndex);
//             this.nextQuestion();
//           }
//         }
//       }
//       this.isLoadingSession = false;
//       this.cd.detectChanges(); // Ensure UI updates
//     });
//   } catch (error) {
//     console.error('Error processing candidate response:', error);
//     this.snack.open('Error processing your response. Please try again.', 'OK', { duration: 5000 });
//     this.isLoadingSession = false;
//     if (isIntro && this.allQuestions.length === 0) {
//       console.warn('Retrying fetchQuestions after intro failure.');
//       await this.fetchQuestions();
//     }
//   }
// }
async processCandidateResponse(transcript: string, isIntro: boolean): Promise<void> {
  this.isLoadingSession = true;
  this.isAnswering = false; // Reset answering state
  const prompt = isIntro
    ? `Candidate intro: "${transcript}". Evaluate the introduction for completeness and relevance to a software engineering role. Return a JSON object with { "isSatisfactory": boolean, "response": string } where "response" is a friendly message confirming readiness to ask the first question.`
    : `Evaluate the candidate's answer: "${transcript}" for the question: "${this.currentQuestion?.questionName}". Determine if the answer is complete, correct, and relevant to a software engineering role. If the answer contains phrases like "skip", "not able to answer", or "move to next section", set "isSatisfactory" to false, "response" to a polite acknowledgment (e.g., "No problem, let's move to the next section."), and "nestedQuestion" to null to skip the current department. Otherwise, assess the answer's quality. Return a JSON object with { "isSatisfactory": boolean, "response": string, "nestedQuestion": string | null } where "response" is a confidence-boosting message if satisfactory, a prompt for a nested question if not, or a skip acknowledgment, and "nestedQuestion" is the follow-up question ID if applicable.`;

  try {
    console.log('Processing response for question:', this.currentQuestion?.questionName, 'Index:', this.currentQuestionIndex, 'IsIntro:', isIntro, 'Transcript:', transcript);
    const response = await this.ai.queryAi(prompt);
    let evaluation: { isSatisfactory: boolean; response: string; nestedQuestion?: string | null };
    try {
      evaluation = JSON.parse(response);
    } catch (e) {
      console.error('Failed to parse AI evaluation:', response, e);
      evaluation = {
        isSatisfactory: false,
        response: isIntro ? 'Great intro! Let’s move to the first question.' : 'Let’s dive deeper into your answer.',
        nestedQuestion: isIntro ? null : this.currentQuestion?.nestedQuestion?.[0]?.questionId || null
      };
    }

    this.fullChatHistory.push({ sender: 'ai', text: evaluation.response, timestamp: new Date() });
    this.speak(evaluation.response, async () => {
      if (isIntro) {
        if (this.allQuestions.length === 0) {
          console.error('No questions available after intro. Retrying fetchQuestions.');
          await this.fetchQuestions();
          return;
        }
        this.currentQuestionIndex = 0;
        await this.askNext();
      } else if (!this.currentQuestion) {
        console.warn('No current question available. Checking for next question.');
        if (this.currentQuestionIndex < this.allQuestions.length) {
          await this.askNext();
        } else {
          console.log('No more questions. Starting Q&A session.');
          await this.handleCandidateQuestions();
        }
      } else {
        if (!evaluation.isSatisfactory && evaluation.nestedQuestion && this.currentQuestion.nestedQuestion?.length > 0) {
          const nestedQuestion = this.currentQuestion.nestedQuestion.find(q => q.questionId === evaluation.nestedQuestion) || this.currentQuestion.nestedQuestion[0];
          console.log('Asking nested question:', nestedQuestion.questionName);
          this.currentQuestion = { ...nestedQuestion, dept: this.currentQuestion.dept, nestedOf: this.currentQuestion.questionId, isMaster: false };
          this.currentQuestionId = nestedQuestion.questionId.toString();
          this.fullChatHistory.push({ sender: 'ai', text: nestedQuestion.questionName, timestamp: new Date() });
          this.cd.detectChanges(); // Update UI
          this.speak(nestedQuestion.questionName, () => {
            this.startQuestionRecording(this.currentQuestionId);
            this.startListening();
            this.isAnswering = true;
          });
        } else {
          this.answeredSet.add(this.currentQuestionId);
          // Skip to next department's master question if skip requested
          if (!evaluation.isSatisfactory && evaluation.nestedQuestion === null) {
            console.log('Skip requested, moving to next department.');
            const currentDept = this.currentQuestion.dept;
            const nextDeptIndex = this.allQuestions.findIndex((q, i) => i > this.currentQuestionIndex && q.dept !== currentDept && q.isMaster);
            this.currentQuestionIndex = nextDeptIndex !== -1 ? nextDeptIndex : this.allQuestions.length;
          } else {
            this.currentQuestionIndex++;
          }
          if (this.currentQuestionIndex < this.allQuestions.length) {
            console.log('Moving to next question. Current index:', this.currentQuestionIndex);
            await this.nextQuestion();
          } else {
            console.log('All questions answered. Starting Q&A session.');
            await this.handleCandidateQuestions();
          }
        }
      }
      this.isLoadingSession = false;
      this.cd.detectChanges(); // Ensure UI updates
    });
  } catch (error) {
    console.error('Error processing candidate response:', error);
    this.snack.open('Error processing your response. Please try again or use Submit Answer.', 'OK', { duration: 5000 });
    this.isLoadingSession = false;
    if (isIntro && this.allQuestions.length === 0) {
      console.warn('Retrying fetchQuestions after intro failure.');
      await this.fetchQuestions();
    }
  }
}

async handleCandidateQuestions(): Promise<void> {
  const qaPrompt = `The candidate has completed all interview questions. Ask if they have any doubts or questions about the job, tech stack, their improvement areas, or the company. If the candidate responds with a question, provide a concise, professional answer based on a typical software engineering role at a tech company (e.g., Java-based tech stack, opportunities for growth, collaborative culture). If the candidate says "no" or similar, return a JSON object with { "hasQuestions": false, "response": string } where "response" is a polite acknowledgment (e.g., "Thank you for your time!"). If a question is asked, return { "hasQuestions": true, "response": string } where "response" is the answer to their question.`;

  this.isLoadingSession = true;
  this.fullChatHistory.push({ sender: 'ai', text: 'Do you have any doubts or questions for me?', timestamp: new Date() });
  this.cd.detectChanges();
  this.speak('Do you have any doubts or questions for me?', () => {
    this.startListening();
    this.isAnswering = true;
  });

  // Wait for candidate response
  const transcript = await new Promise<string>(resolve => {
    const checkTranscript = () => {
      if (this.currentLiveTranscript) {
        console.log('Q&A transcript received:', this.currentLiveTranscript);
        resolve(this.currentLiveTranscript);
      } else {
        setTimeout(checkTranscript, 100);
      }
    };
    checkTranscript();
  });

  try {
    console.log('Processing Q&A response:', transcript);
    const response = await this.ai.queryAi(qaPrompt.replace('The candidate has completed all interview questions.', `Candidate response: "${transcript}".`));
    let evaluation: { hasQuestions: boolean; response: string };
    try {
      evaluation = JSON.parse(response);
    } catch (e) {
      console.error('Failed to parse Q&A evaluation:', response, e);
      evaluation = {
        hasQuestions: false,
        response: 'Thank you for your time!'
      };
    }

    this.fullChatHistory.push({ sender: 'ai', text: evaluation.response, timestamp: new Date() });
    this.speak(evaluation.response, async () => {
      if (evaluation.hasQuestions) {
        // Allow another question
        await this.handleCandidateQuestions();
      } else {
        // Proceed to closing statement
        console.log('No more candidate questions. Submitting responses.');
        await this.submitResponses();
      }
      this.isLoadingSession = false;
      this.cd.detectChanges();
    });
  } catch (error) {
    console.error('Error processing Q&A response:', error);
    this.snack.open('Error processing your question. Moving to closing statement.', 'OK', { duration: 5000 });
    this.isLoadingSession = false;
    await this.submitResponses();
    this.cd.detectChanges();
  }
}

resetSilenceTimer(): void {
  clearTimeout(this.silenceTimeoutId);
  this.silenceTimeoutId = setTimeout(() => {
    if (this.isAiSpeaking) {
      console.log('Silence timer ignored: AI is still speaking.');
      return;
    }
    this.ngZone.run(() => {
      console.log('Silence detected. Moving to next question.');
      this.snack.open('No response detected. Moving on…', '', { duration: 15000 });
      this.stopRecordingAndProcessAnswer();
      this.nextQuestion();
      this.silenceWarning = true;
      this.showGlobalWarning = true;
    });
  }, this.SILENCE_TIMEOUT_MS);
}

//   async processCandidateResponse(transcript: string, isIntro: boolean): Promise<void> {
//   this.isLoadingSession = true;
//   const prompt = isIntro
//     ? `Candidate intro: "${transcript}". Provide a friendly response and confirm readiness to ask the first question.`
//     : `Evaluate the candidate's answer: "${transcript}" for the question: "${this.currentQuestion?.questionName}". If the answer is insufficient, suggest a nested follow-up question. If sufficient, acknowledge and confirm readiness to move to the next question.`;

//   try {
//     console.log('Processing response for question:', this.currentQuestion?.questionName, 'Index:', this.currentQuestionIndex, 'IsIntro:', isIntro);
//     const response = await this.ai.queryAi(prompt);
//     this.fullChatHistory.push({ sender: 'ai', text: response, timestamp: new Date() });
//     this.speak(response, async () => {
//       if (isIntro) {
//         if (this.allQuestions.length === 0) {
//           console.error('No questions available after intro. Retrying fetchQuestions.');
//           await this.fetchQuestions();
//           return;
//         }
//         this.currentQuestionIndex = 0;
//         await this.askNext();
//       } else if (!this.currentQuestion) {
//         console.warn('No current question available. Checking for next question.');
//         if (this.currentQuestionIndex < this.allQuestions.length) {
//           await this.askNext();
//         } else {
//           console.log('No more questions. Submitting responses.');
//           await this.submitResponses();
//         }
//       } else {
//         const isAnswerSufficient = !response.toLowerCase().includes('follow-up');
//         if (!isAnswerSufficient && this.currentQuestion.nestedQuestion?.length > 0) {
//           const nestedQuestion = this.currentQuestion.nestedQuestion[0];
//           console.log('Asking nested question:', nestedQuestion.questionName);
//           this.currentQuestion = { ...nestedQuestion, dept: this.currentQuestion.dept, nestedOf: this.currentQuestion.questionId, isMaster: false };
//           this.currentQuestionId = nestedQuestion.questionId.toString();
//           this.fullChatHistory.push({ sender: 'ai', text: nestedQuestion.questionName, timestamp: new Date() });
//           this.cd.detectChanges(); // Update UI
//           this.speak(nestedQuestion.questionName, () => {
//             this.startQuestionRecording(this.currentQuestionId);
//             this.startListening();
//             this.resetSilenceTimer();
//             this.isAnswering = true;
//           });
//         } else {
//           this.answeredSet.add(this.currentQuestionId);
//           if (this.currentQuestionIndex + 1 >= this.allQuestions.length) {
//             console.log('All questions answered. Moving to closing statement.');
//             await this.submitResponses();
//           } else {
//             console.log('Moving to next question. Current index:', this.currentQuestionIndex);
//             this.nextQuestion();
//           }
//         }
//       }
//       this.isLoadingSession = false;
//       this.cd.detectChanges(); // Ensure UI updates
//     });
//   } catch (error) {
//     console.error('Error processing candidate response:', error);
//     this.snack.open('Error processing your response. Please try again.', 'OK', { duration: 5000 });
//     this.isLoadingSession = false;
//     if (isIntro && this.allQuestions.length === 0) {
//       console.warn('Retrying fetchQuestions after intro failure.');
//       await this.fetchQuestions();
//     }
//   }
// }

async askNext(): Promise<void> {
  if (this.allQuestions.length === 0) {
    console.error('No questions loaded in askNext. Retrying fetchQuestions.');
    await this.fetchQuestions();
    return;
  }
  if (this.currentQuestionIndex >= this.allQuestions.length) {
    console.log('askNext: No more questions, ending interview.');
    await this.endInterview();
    return;
  }
  this.currentQuestion = this.allQuestions[this.currentQuestionIndex];
  this.currentQuestionId = this.currentQuestion.questionId.toString();
  console.log('askNext: Setting currentQuestion:', this.currentQuestion.questionName);
  this.fullChatHistory.push({ sender: 'ai', text: this.currentQuestion.questionName, timestamp: new Date() });
  this.cd.detectChanges(); // Update UI
  this.speak(this.currentQuestion.questionName, () => {
    this.startQuestionRecording(this.currentQuestionId);
    this.startListening();
    this.resetSilenceTimer();
    this.showMotivation();
    this.isAnswering = true;
  });
}

async nextQuestion(): Promise<void> {
  if (this.isAiSpeaking) {
    console.log('nextQuestion: AI is still speaking, delaying progression.');
    return;
  }
  this.currentQuestionIndex++;
  console.log('nextQuestion: index=', this.currentQuestionIndex, 'total=', this.allQuestions.length, 'answeredSet=', [...this.answeredSet]);
  if (this.currentQuestionIndex < this.allQuestions.length) {
    this.currentQuestion = this.allQuestions[this.currentQuestionIndex];
    this.currentQuestionId = this.currentQuestion.questionId.toString();
    console.log('Setting currentQuestion:', this.currentQuestion.questionName);
    this.fullChatHistory.push({ sender: 'ai', text: this.currentQuestion.questionName, timestamp: new Date() });
    this.cd.detectChanges(); // Update UI
    this.speak(this.currentQuestion.questionName, () => {
      this.startQuestionRecording(this.currentQuestionId);
      this.startListening();
      this.resetSilenceTimer();
      this.isAnswering = true;
    });
  } else {
    console.log('No more questions available. Moving to closing statement.');
    await this.submitResponses();
  }
}

speak(text: string, callback?: () => void): void {
  this.lastQuestionSpoken = text;
  this.ngZone.run(() => {
    this.isAiSpeaking = true;
    console.log('Speaking:', text);
  });
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.onend = () => {
    console.log('Speech completed:', text);
    this.ngZone.run(() => {
      this.isAiSpeaking = false;
      if (callback) callback();
    });
  };
  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event.error);
    this.ngZone.run(() => {
      this.isAiSpeaking = false;
      if (callback) callback();
    });
  };
  window.speechSynthesis.speak(utterance); // Removed cancel() to prevent interruption
}
  async requestMedia(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.videoPlayerRef.nativeElement.srcObject = this.mediaStream;
      this.videoPlayerRef.nativeElement.play();
      this.videoReady = true;
      this.isLoadingSession = false;
    } catch (error) {
      console.error('Error accessing camera and microphone:', error);
      this.snack.open('Camera & microphone access is required. Please refresh and allow permissions.', 'OK');
      this.isLoadingSession = false;
    }
  }

  fetchQuestions(): Promise<void> {
  return new Promise((resolve, reject) => {
    const candId = localStorage.getItem('candidateId') || '2';
    const compId = localStorage.getItem('companyId') || '2';
    this.ai.getQuestions(candId, compId, this.roundName).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: { deptQuestions: { department: string; masterQuestion: Question[] }[] }) => {
        this.allQuestions = this.flattenQuestions(res.deptQuestions);
        console.log('Questions fetched:', this.allQuestions);
        if (this.allQuestions.length === 0) {
          console.error('No questions fetched. Ending interview.');
          this.snack.open('No questions found for this interview.', 'OK');
          this.endInterview();
          reject(new Error('No questions found'));
          return;
        }
        this.currentQuestionIndex = 0; // Reset index
        console.log('fetchQuestions: Questions loaded, ready to proceed.');
        resolve();
      },
      error: (error: any) => {
        console.error('Failed to load questions:', error);
        this.snack.open('Failed to load questions. Please try again.', 'Retry');
        this.endInterview();
        reject(error);
      }
    });
  });
}

  flattenQuestions(depts: { department: string; masterQuestion: Question[] }[]): Question[] {
    const all: Question[] = [];
    depts.forEach(d => {
      d.masterQuestion.forEach(mq => {
        all.push({ ...mq, dept: d.department, isMaster: true, isMandatory: mq.isMandatory ?? true });
        (mq.nestedQuestion || []).forEach(nq => all.push({ ...nq, dept: d.department, nestedOf: mq.questionId, isMaster: false, isMandatory: nq.isMandatory ?? true }));
      });
    });
    return all;
  }

  private async getVideoBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || ''); // Remove data URL prefix
      };
      reader.onerror = () => reject(new Error('Failed to convert video to base64'));
      reader.readAsDataURL(blob);
    });
  }

  private startInterviewTimer(): void {
  this.timerSub = interval(1000).pipe(
    takeUntil(this.destroy$)
  ).subscribe(() => {
    this.interviewTimer += 1000;

    const totalSeconds = Math.floor(this.interviewTimer / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Store raw duration (in seconds)
    this.metrics.interviewDuration = totalSeconds;

    // Store formatted string (hh:mm:ss)
    this.formattedInterviewTime = 
      `${this.padZero(hours)}:${this.padZero(minutes)}:${this.padZero(seconds)}`;
  });
}

private padZero(num: number): string {
  return num < 10 ? '0' + num : num.toString();
}


  async endInterview(): Promise<void> {
    this.timerSub.unsubscribe();
    this.stopRecording();
    this.stopFaceCapture();
    this.stopListening();
    const closingMessage = "Thank you for participating in this interview! We appreciate your time and effort. We will get back to you soon with the next steps.";

    this.speak(closingMessage, async () => {
      this.snack.open('Interview completed! Submitting your responses...', '', { duration: 3000 });
      await this.submitResponses();
    });
    this.fullChatHistory.push({ sender: 'ai', text: closingMessage, timestamp: new Date() });

  }

  startQuestionRecording(questionId: string): void {
    if (!this.videoReady) {
      this.snack.open('Camera is not ready. Cannot record.', 'OK');
      return;
    }
    this.currentQuestionId = questionId;
    this.recordedBlobs = [];
    const stream = this.videoPlayerRef.nativeElement.srcObject as MediaStream;

    if (!stream) {
      console.error('No media stream available for recording.');
      return;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          this.recordedBlobs.push(e.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        this.ngZone.run(() => {
          this.videoBlobs[questionId] = new Blob(this.recordedBlobs, { type: 'video/webm' });
          console.log(`Recorded video for question ${questionId}`);
          this.recordedBlobs = [];
        });
      };
      this.mediaRecorder.start(1000);
      this.microphoneOn = true;
      console.log(`Recording started for question ${questionId}`);
    } catch (error) {
      console.error('Error starting media recorder:', error);
      this.snack.open('Failed to start recording your answer.', 'OK');
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.microphoneOn = false;
      console.log('Recording stopped.');
    }
    clearTimeout(this.silenceTimeoutId);
  }

  stopRecordingAndProcessAnswer(): void {
    this.stopRecording();
    this.answeredSet.add(this.currentQuestionId);
  }

  setupTabRestriction(): void {
    window.addEventListener('blur', () => {
      this.ngZone.run(() => {
        this.outOfWindowFocusCount++;
        this.metrics.windowFocusLost = this.outOfWindowFocusCount;
        this.globalWarningMessage = `Please stay on this tab! (${this.outOfWindowFocusCount}/${this.MAX_TAB_WARNINGS})`;
        this.showGlobalWarning = true;
        this.snack.open(this.globalWarningMessage, '', { duration: 3000 });
        // if (this.outOfWindowFocusCount >= this.MAX_TAB_WARNINGS) {
        //   this.endInterview();
        // }
      });
    });
  }


  showMotivation(): void {
    const msgs = [
      "You're doing fantastic! Keep it up!",
      "Great insights! Let's dive deeper.",
      "You're on the right track, stay focused!",
      "Love your enthusiasm! Keep going.",
      "You're bringing great energy to this!"
    ];
    this.motivationalNudge = msgs[Math.floor(Math.random() * msgs.length)];
    this.snack.open(this.motivationalNudge, '', { duration: 2500, panelClass: ['nudge-snackbar'] });
  }

  

  submitAnswer(questionId: any): void {
    this.stopRecordingAndProcessAnswer();
    this.nextQuestion();
  }

  skipQuestion(questionId: any): void {
    this.stopRecording();
    this.answers[questionId] = '';
    this.answeredSet.add(questionId);
    this.nextQuestion();
  }

  toggleCamera(): void {
    this.cameraOn = !this.cameraOn;
    const stream = this.videoPlayerRef.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => (track.enabled = this.cameraOn));
      if (!this.cameraOn) this.videoInputLostCount++;
      this.metrics.videoDrop = this.videoInputLostCount;
    }
    this.snack.open(`Camera ${this.cameraOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  toggleAudio(): void {
    this.microphoneOn = !this.microphoneOn;
    const stream = this.videoPlayerRef.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = this.microphoneOn));
      if (!this.microphoneOn) this.audioInputLostCount++;
      this.metrics.audioDrop = this.audioInputLostCount;
    }
    this.snack.open(`Microphone ${this.microphoneOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  startFaceCapture(): void {
    if (!this.videoPlayerRef?.nativeElement) {
      console.warn('Video element not available for face capture.');
      return;
    }
    this.stopFaceCapture();

    this.faceCaptureInterval = setInterval(async () => {
      if (this.videoPlayerRef.nativeElement.readyState < 2) return;

      const detection = await faceapi
        .detectSingleFace(this.videoPlayerRef.nativeElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      this.ngZone.run(() => {
        if (detection && detection.expressions) {
          const maxValue = Math.max(...Object.values(detection.expressions));
          const dominantExpression = Object.keys(detection.expressions).find(
            (key) => detection.expressions[key as keyof typeof detection.expressions] === maxValue
          );
          this.currentExpression = dominantExpression || '';
          this.expressionTimeline.push({ time: Date.now(), expression: this.currentExpression });
        } else {
          this.currentExpression = 'No Face Detected';
        }
      });
    }, this.FACE_CAPTURE_INTERVAL_MS);
    console.log('Face expression capture started.');
  }

  stopFaceCapture(): void {
    if (this.faceCaptureInterval) {
      clearInterval(this.faceCaptureInterval);
      this.faceCaptureInterval = null;
      console.log('Face expression capture stopped.');
    }
  }

  startFullRecording(): void {
    if (!this.videoReady) {
      console.warn('Cannot start full recording: video not ready.');
      return;
    }
    const stream = this.videoPlayerRef.nativeElement.srcObject as MediaStream;
    if (!stream) {
      console.error('No media stream available for full recording.');
      return;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
      this.fullRecordingBlobs = [];
      this.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this.fullRecordingBlobs.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        this.ngZone.run(async () => {
          this.fullInterviewBlob = new Blob(this.fullRecordingBlobs, { type: 'video/webm' });
          this.videoFile = await this.getVideoBase64(this.fullInterviewBlob);
          console.log('Full interview video recorded, base64 length:', this.videoFile.length);
        });
      };
      this.mediaRecorder.start(1000);
      console.log('Full interview recording started.');
    } catch (error) {
      console.error('Error starting full interview recorder:', error);
      this.snack.open('Failed to start full interview recording.', 'OK');
    }
  }

  async buildFinalInterviewJson(): Promise<InterviewResponse> {
  const deptMap: { [dept: string]: InterviewResponse['deptQuestions'][0] } = {};
  const scoreCache: Record<string, number> = {};

  async function computeScore(question: string, answer: string, ai: AiInterviewService): Promise<number> {
    const cacheKey = `${question}:${answer}`;
    if (scoreCache[cacheKey]) {
      return scoreCache[cacheKey];
    }
    try {
      const prompt = `Evaluate the accuracy and relevance of the answer: "${answer}" for the question: "${question}". Provide a score from 0 to 100 based on correctness, completeness, and relevance to a software engineering role. Return only the numerical score.`;
      const response = await ai.queryAi(prompt);
      const score = parseFloat(response.trim()) || 0; // Fallback to 80 if parsing fails
      scoreCache[cacheKey] = Math.max(0, Math.min(100, score)); // Clamp to 0-100
      return scoreCache[cacheKey];
    } catch (error) {
      console.error(`Error computing score for question "${question}":`, error);
      return 0; // Fallback score
    }
  }

  for (const q of this.allQuestions) {
    if (!deptMap[q.dept]) {
      deptMap[q.dept] = { department: q.dept, masterQuestion: [] };
    }
    if (q.isMaster) {
      const answer = this.answers[q.questionId] || 'No answer provided';
      const masterQuestion = {
        questionName: q.questionName,
        isMandatory: q.isMandatory ?? true,
        questionId: parseInt(q.questionId, 10),
        answer,
        relevantScore: await computeScore(q.questionName, answer, this.ai),
        nestedQuestion: await Promise.all(
          this.allQuestions
            .filter(nq => nq.nestedOf === q.questionId)
            .map(async nq => ({
              questionName: nq.questionName,
              isMandatory: nq.isMandatory ?? true,
              questionId: parseInt(nq.questionId, 10),
              answer: this.answers[nq.questionId] || 'No answer provided',
              relevantScore: await computeScore(nq.questionName, this.answers[nq.questionId] || 'No answer provided', this.ai)
            }))
        )
      };
      deptMap[q.dept].masterQuestion.push(masterQuestion);
    }
  }

  return {
    roundName: this.roundName,
    shceduledDate: Date.now(),
    candidateId: parseInt(localStorage.getItem('candidateId') || '2', 10),
    companyId: parseInt(localStorage.getItem('companyId') || '2', 10),
    files: {
      file: this.videoFile || 'base64-converted-string',
      type: 'VIDEO',
      extension: '.webm'
    },
    metris: {
      windowFocusLost: this.outOfWindowFocusCount,
      audioDrop: this.audioInputLostCount,
      videoDrop: this.videoInputLostCount,
      interviewDuration: Math.floor(this.interviewTimer / 1000),
      gazingOutTime: this.gazeWarnings
    },
    deptQuestions: Object.values(deptMap)
  };
}

  async submitResponses(): Promise<void> {
    const interviewResponse = await this.buildFinalInterviewJson();
    this.ai.saveInterviewResponse(interviewResponse).then(
      () => {
        console.log('Interview response saved successfully');
        this.snack.open('Interview submitted successfully!', '', { duration: 5000 });
      },
      (error) => {
        console.error('Interview submission failed:', error);
        this.snack.open('Interview submission failed. Please try again.', '', { duration: 5000 });
      }
    );
  }

  openChatHistory(): void {
    this.snack.open('Chat history is displayed in the AI panel.', 'OK', { duration: 3000 });
  }

  openAiAssistantChat(): void {
    this.snack.open('AI assistant chat is available via the input field.', 'OK', { duration: 3000 });
  }

  clearCurrentAnswer(): void {
    if (this.currentQuestionId && this.answers[this.currentQuestionId]) {
      this.answers[this.currentQuestionId] = '';
      this.snack.open('Current answer cleared.', 'OK', { duration: 1500 });
    }
    console.log('Clear current answer');
  }

  toggleRealtimeFeedback(): void {
    this.showRealtimeFeedback = !this.showRealtimeFeedback;
    this.snack.open(`Real-time feedback ${this.showRealtimeFeedback ? 'shown' : 'hidden'}`, 'OK', { duration: 1500 });
    console.log('Toggle real-time feedback');
  }

  dismissGlobalWarning(): void {
    this.showGlobalWarning = false;
    this.globalWarningMessage = '';
    console.log('Dismiss global warning');
  }

  async initCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.videoPlayerRef.nativeElement.srcObject = stream;
      this.videoPlayerRef.nativeElement.play();
      this.stream = stream;
      this.startAudioMonitoring(stream);
      console.log('Camera initialized successfully with video and audio.');
    } catch (err) {
      console.error('Error accessing camera and microphone:', err);
      this.snack.open('Error accessing camera and microphone. Please allow access.', '', { duration: 5000 });
    }
  }

  private startAudioMonitoring(stream: MediaStream): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (!this.microphone) {
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
    }

    this.speechActivityTimer = setInterval(() => {
      if (this.analyser && this.audioDataArray) {
        this.analyser.getByteFrequencyData(this.audioDataArray);
        let sum = 0;
        for (let i = 0; i < this.audioDataArray.length; i++) {
          sum += this.audioDataArray[i];
        }
        const averageVolume = sum / this.audioDataArray.length;

        if (averageVolume > this.MIN_SPEECH_ACTIVITY_VOLUME_THRESHOLD) {
          this.lastSpeechActivityTime = Date.now();
          this.hasSpeechActivityBeenDetected = true;
        } else {
          if (this.hasSpeechActivityBeenDetected && (Date.now() - this.lastSpeechActivityTime > this.INACTIVITY_THRESHOLD_MS)) {
            this.handleWarning('No speech detected for a prolonged period.');
            this.lastSpeechActivityTime = Date.now();
          }
        }
      }
    }, 500);
  }

  private startMotionDetection(): void {
    if (!this.hiddenCanvasRef || !this.videoPlayerRef) {
      console.error('Canvas or video player element not found for motion detection.');
      return;
    }

    const video = this.videoPlayerRef.nativeElement;
    const canvas = this.hiddenCanvasRef.nativeElement;
    this.canvasContext = canvas.getContext('2d');

    if (!this.canvasContext) {
      console.error('Could not get 2D context for canvas.');
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    this.motionDetectionInterval = setInterval(() => {
      if (!this.canvasContext || !video.srcObject) {
        return;
      }

      this.canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrameData = this.canvasContext.getImageData(0, 0, canvas.width, canvas.height);

      if (this.prevFrameData) {
        let changedPixels = 0;
        const pixelStep = 10;
        for (let i = 0; i < currentFrameData.data.length; i += 4 * pixelStep) {
          if (
            Math.abs(currentFrameData.data[i] - this.prevFrameData.data[i]) > 20 ||
            Math.abs(currentFrameData.data[i + 1] - this.prevFrameData.data[i + 1]) > 20 ||
            Math.abs(currentFrameData.data[i + 2] - this.prevFrameData.data[i + 2]) > 20
          ) {
            changedPixels++;
          }
        }

        if (changedPixels < this.MOTION_PIXEL_CHANGE_THRESHOLD) {
          this.motionWarnings++;
          if (this.motionWarnings >= this.MAX_MOTION_WARNINGS) {
            if (!this.motionWarningTimer) {
              this.motionWarningTimer = setTimeout(() => {
                this.handleWarning('No significant motion detected from candidate.');
                this.motionWarnings = 0;
                this.motionWarningTimer = null;
              }, 2000);
            }
          } else {
            clearTimeout(this.motionWarningTimer);
            this.motionWarningTimer = null;
          }
        } else {
          this.motionWarnings = 0;
          clearTimeout(this.motionWarningTimer);
          this.motionWarningTimer = null;
        }
      }
      this.prevFrameData = currentFrameData;
    }, this.MOTION_DETECTION_INTERVAL_MS);
  }

  private setupWindowFocusMonitoring(): void {
    window.addEventListener('blur', this.handleWindowBlurDebounced);
    window.addEventListener('focus', this.handleWindowFocusDebounced);
  }

  private handleWarning(message: string): void {
    console.warn('Monitoring Warning:', message);
    this.snack.open(message, 'Dismiss', { duration: 5000 });
  }

  ngOnDestroy(): void {
    if (this.speechActivityTimer) {
      clearInterval(this.speechActivityTimer);
    }
    if (this.microphone) {
      this.microphone.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.motionDetectionInterval) {
      clearInterval(this.motionDetectionInterval);
    }
    if (this.motionWarningTimer) {
      clearTimeout(this.motionWarningTimer);
    }

    if (this.windowFocusTimeout) {
      clearTimeout(this.windowFocusTimeout);
    }
    window.removeEventListener('blur', this.handleWindowBlurDebounced);
    window.removeEventListener('focus', this.handleWindowFocusDebounced);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.facialMonitorInterval) {
      clearInterval(this.facialMonitorInterval);
    }

    this.destroy$.next();
    this.destroy$.complete();
    this.timerSub?.unsubscribe();
    this.stopFaceCapture();
    clearTimeout(this.silenceTimeoutId);
    this.stopRecording();
    this.currentLiveTranscript = '';
    this.fullTranscriptEntries = [];
  }

  private handleWindowBlurDebounced = () => {
    if (this.windowFocusTimeout) {
      clearTimeout(this.windowFocusTimeout);
    }
    this.windowFocusTimeout = setTimeout(() => {
      console.warn('Window lost focus!');
      this.windowFocusWarnings++;
      this.metrics.windowFocusLost = this.windowFocusWarnings;
      this.handleWarning('Interview window lost focus!');
      // if (this.windowFocusWarnings >= this.MAX_WINDOW_FOCUS_WARNINGS) {
      //   this.endInterview();
      // }
    }, this.WINDOW_FOCUS_DEBOUNCE_MS);
  };

  private handleWindowFocusDebounced = () => {
    if (this.windowFocusTimeout) {
      clearTimeout(this.windowFocusTimeout);
      this.windowFocusTimeout = null;
    }
    console.log('Window regained focus.');
  };

  private initFaceMeshTracking(): void {
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const leftEyeCenterX = (landmarks[33].x + landmarks[133].x) / 2;
        const rightEyeCenterX = (landmarks[362].x + landmarks[263].x) / 2;
        const eyeCenterX = (leftEyeCenterX + rightEyeCenterX) / 2;
        const noseX = landmarks[1].x;
        const upperLip = landmarks[13].y;
        const lowerLip = landmarks[14].y;

        const gazeOffset = eyeCenterX - noseX;
        const mouthOpen = Math.abs(upperLip - lowerLip);

        if (Math.abs(gazeOffset) > 0.045) {
          this.ngZone.run(() => {
            this.gazeWarnings++;
            this.metrics.gazingOutTime = this.gazeWarnings;
            this.cd.detectChanges();
          });
        }

        this.ngZone.run(() => {
          this.silenceWarning = mouthOpen < 0.02;
          this.cd.detectChanges();
        });
      }
    });

    const videoElement = this.videoPlayerRef?.nativeElement;
    if (videoElement) {
      this.camera = new Camera(videoElement, {
        onFrame: async () => {
          if (this.faceMesh) {
            await this.faceMesh.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480,
      });
      this.camera.start();
    } else {
      console.warn('Video element not available for face tracking.');
    }

    window.addEventListener('blur', () => {
      this.ngZone.run(() => {
        this.outOfWindowFocusCount++;
        this.metrics.windowFocusLost = this.outOfWindowFocusCount;
        this.cd.detectChanges();
      });
    });

    window.addEventListener('focus', () => {
      this.ngZone.run(() => {
        this.cd.detectChanges();
      });
    });
  }

  private monitorAudioInputLoss(): void {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const audioTrack = stream.getAudioTracks()[0];
        audioTrack.onended = () => {
          this.ngZone.run(() => {
            this.audioInputLostCount++;
            this.metrics.audioDrop = this.audioInputLostCount;
            this.cd.detectChanges();
          });
        };
      })
      .catch((err) => {
        console.error('Failed to access audio input:', err);
      });
  }
}