import {
  OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, NgZone
} from '@angular/core';
import { Component } from '@angular/core';

import { Subscription, interval, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
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
import { from } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';
import type { Face, Keypoint } from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import * as faceDetection from '@tensorflow-models/face-detection';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    };
  }

  interface SpeechRecognition extends EventTarget {
    grammars: SpeechGrammarList;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI: string;

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

    start(): void;
    stop(): void;
    abort(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionError;
    readonly message: string;
  }

  interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
  }

  type SpeechRecognitionError =
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";

  interface SpeechGrammarList {
    new(): SpeechGrammarList;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    item(index: number): SpeechGrammar;
    readonly length: number;
    [index: number]: SpeechGrammar;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
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
    MatButtonToggleModule, MatChipsModule,
    MatProgressBarModule
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
  tabWarnings = 0;
  globalWarningMessage: string = '';
  motivationalNudge: string = '';
  currentExpression: string = '';
  expressionTimeline: { time: number; expression: string }[] = [];

  currentLiveTranscript: string = '';
  fullTranscriptEntries: { type: 'candidate' | 'ai'; text: string }[] = [];
  private mediaStream: MediaStream | null = null;

  candidateAvatarUrl: string = 'https://picsum.photos/200';
  isUserOnline: boolean = true;
  showRealtimeFeedback: boolean = false;
  speakingRateFeedback: string = '';
  fillerWordFeedback: string = '';
  showGazeOverlay: boolean = false;
  silenceWarning: boolean = false;
  showGlobalWarning: boolean = false;

  // Interview Data
  candidateName = localStorage.getItem('candidateName') || 'Candidate';
  companyName = localStorage.getItem('companyName') || 'Company';
  roundName = localStorage.getItem('roundName') || 'Round';
  allQuestions: any[] = [];
  currentQuestionIndex = 0;
  currentQuestion: any = {};
  answers: Record<string, string> = {};
  currentQuestionId = '';
  lastQuestionSpoken = '';
  candidateIntroCaptured = false;
  candidateIntro = '';
  assistantMessages: string[] = [];
  userQuery = '';

  private stream: MediaStream | null = null;

  // Media & Recognition
  private recognition!: SpeechRecognition;
  private mediaRecorder!: MediaRecorder;
  private recordedBlobs: Blob[] = [];
  videoBlobs: Record<string, Blob> = {};
  fullRecordingBlobs: Blob[] = [];
  fullInterviewBlob!: Blob;

  // Timers & Subscriptions
  private timerSub!: Subscription;
  private gazeMonitoringInterval!: any;
  private faceCaptureInterval!: any;
  private silenceTimeoutId: any;
  private destroy$ = new Subject<void>();

  // Configuration Constants
  readonly MAX_LOOKAWAY_COUNT = 1;
  readonly MAX_GAZE_WARNINGS = 1;
  readonly MAX_TAB_WARNINGS = 2;
  readonly SILENCE_TIMEOUT_MS = 5000;
  readonly GAZE_CHECK_INTERVAL_MS = 2000;
  readonly FACE_CAPTURE_INTERVAL_MS = 2000;
  readonly MODEL_URL = '/models';

  // Audio Monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private audioDataArray: Uint8Array | null = null;
  private speechActivityTimer: any;
  private lastSpeechActivityTime: number = 0;
  private hasSpeechActivityBeenDetected: boolean = false;

  readonly MIN_SPEECH_ACTIVITY_VOLUME_THRESHOLD = 20;
  readonly INACTIVITY_THRESHOLD_MS = 10000;

  // Motion Detection
  canvasContext: CanvasRenderingContext2D | null = null;
  prevFrameData: ImageData | null = null;
  motionDetectionInterval: any;
  readonly MOTION_PIXEL_CHANGE_THRESHOLD = 50;
  readonly MOTION_DETECTION_INTERVAL_MS = 500;
  motionWarnings: number = 0;
  readonly MAX_MOTION_WARNINGS = 5;
  motionWarningTimer: any;

  // Window Focus Monitoring
  windowFocusWarnings: number = 0;
  MAX_WINDOW_FOCUS_WARNINGS = 3;
  windowFocusTimeout: any;
  WINDOW_FOCUS_DEBOUNCE_MS = 1000;

  isAiSpeaking: boolean = false;
  fullChatHistory: ChatMessage[] = [];
  tabSwitchCount: number = 0;
  outOfWindowFocusCount: number = 0;
  copyPasteAttempts: number = 0;
  audioInputLostCount: number = 0;
  videoInputLostCount: number = 0;

  answeredSet = new Set<string>();


  facialMonitorInterval: any;
  silenceMessage: string = 'Prolonged Silence';
  private modelLoaded = false;
  private faceDetector!: faceDetection.FaceDetector;

  private faceMesh: FaceMesh | null = null;
  private camera: Camera | null = null;




  constructor(
    private ai: AiInterviewService,
    public snack: MatSnackBar,
    private ngZone: NgZone,
  ) { }

  async ngOnInit() {
    

    this.fetchQuestions();
    

  }

  ngAfterViewInit(): void {
    this.requestMedia();
    this.initFaceMeshTracking();

    this.startInterviewTimer();
    this.setupTabRestriction();
    this.loadModels();
    this.initializeSpeechRecognition();
    this.introduceAI();
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
      console.error('Speech Recognition API not supported.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.resultIndex][0].transcript.trim();
      this.ngZone.run(() => {
        this.assistantMessages.push(`Candidate: ${transcript}`);
        this.handleCandidateSpeech(transcript);
        this.resetSilenceTimer();
      });
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        console.warn('No speech detected. Recognition might have stopped.');
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
    const message = "Hello! I'm your AI interviewer. I’ll be guiding you through this session today. We’ll begin shortly, but first, could you please introduce yourself? Also, feel free to ask me for help at any time — either by speaking or clicking the help button.";
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

  handleCandidateSpeech(transcript: string): void {
    transcript = transcript.trim();
    if (!transcript) {
      console.log('Ignoring empty speech transcript.');
      return;
    }

    if (!this.candidateIntroCaptured) {
      this.candidateIntro = transcript;
      this.candidateIntroCaptured = true;
      console.log('Candidate intro captured:', this.candidateIntro);
      this.assistantMessages.push(`You (Intro): ${transcript}`);
      from(this.ai.queryAi(`Candidate intro: ${transcript}`))
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingSession = false)
        )
        .subscribe({
          next: (response: string) => {
            this.assistantMessages.push(`AI: ${response}`);
            this.speak(response, () => {
              this.askNext();
            });
          },
          error: (error: any) => {
            console.error('Error processing candidate intro:', error);
            this.snack.open('Error processing your introduction. Please try again.', 'OK', {
              duration: 5000
            });
          }
        });
      return;
    }

    if (this.isAnswering && this.currentQuestionId !== null && this.currentQuestionId !== undefined) {
      this.answers[this.currentQuestionId] = transcript;
      this.assistantMessages.push(`You (Answer to Q${this.currentQuestionId}): ${transcript}`);
      console.log(`Answer captured for Question ${this.currentQuestionId}:`, transcript);
    }
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
  fetchQuestions(): void {
    const candId = localStorage.getItem('candidateId') || '';
    const compId = localStorage.getItem('companyId') || '';
    this.ai.getQuestions(candId, compId, this.roundName).pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
      this.allQuestions = this.flattenQuestions(res.deptQuestions);
      if (this.allQuestions.length > 0) {
      } else {
        this.snack.open('No questions found for this interview.', 'OK');
      }
    }, (error: any) => {
      console.error('Failed to load questions:', error);
      this.snack.open('Failed to load questions. Please try again.', 'Retry');
    });
  }

  flattenQuestions(depts: any[]): any[] {
    const all: any[] = [];
    depts.forEach(d => {
      d.masterQuestion.forEach((mq: any) => {
        all.push({ ...mq, dept: d.department, isMaster: true });
        (mq.nestedQuestion || []).forEach((nq: any) => all.push({ ...nq, nestedOf: mq.questionId, isMaster: false }));
      });
    });
    return all;
  }

  private startInterviewTimer(): void {
    this.timerSub = interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => this.interviewTimer += 1000);
  }

  resetSilenceTimer(): void {
    clearTimeout(this.silenceTimeoutId);
    this.silenceTimeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        console.log('Silence detected. Moving to next question.');
        this.snack.open('No response detected. Moving on…', '', { duration: 2000 });
        this.stopRecordingAndProcessAnswer();
        this.nextQuestion();
        this.silenceWarning = true;
        this.showGlobalWarning = true;
      });
    }, this.SILENCE_TIMEOUT_MS);
  }

  async askNext(): Promise<void> {
    if (this.currentQuestionIndex >= this.allQuestions.length) {
      this.endInterview();
      return;
    }
    this.currentQuestion = this.allQuestions[this.currentQuestionIndex];
    this.currentQuestionId = this.currentQuestion.questionId.toString();
    this.assistantMessages.push(`AI: ${this.currentQuestion.questionName}`);
    this.speak(this.currentQuestion.questionName, () => {
      this.startQuestionRecording(this.currentQuestionId);
      this.startListening();
      this.resetSilenceTimer();
      this.showMotivation();
      this.isAnswering = true;
    });
  }

  nextQuestion(): void {
    this.isAnswering = false;
    this.stopListening();
    this.currentQuestionIndex++;
    this.askNext();
  }

  endInterview(): void {
    this.timerSub.unsubscribe();
    this.stopRecording();
  
    this.stopFaceCapture();
    this.stopListening();
    this.snack.open('Interview completed! Submitting your responses...', '', { duration: 3000 });
    this.submitResponses();
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
    if (this.currentQuestionId && this.answers[this.currentQuestionId]) {
      this.ai.recordAnswer({ id: this.currentQuestionId, answer: this.answers[this.currentQuestionId] })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => console.log('Answer recorded successfully.'),
          error: (err: any) => console.error('Failed to record answer:', err)
        });
    }
    this.answeredSet.add(this.currentQuestionId);
  }

  handleVoiceCommands(text: string): void {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('repeat')) {
      this.getHelp('repeat');
    } else if (lowerText.includes('tip') || lowerText.includes('hint')) {
      this.getHelp('tip');
    } else if (lowerText.includes('meaning') || lowerText.includes('explain')) {
      this.getHelp('meaning');
    } else if (lowerText.includes('help')) {
      this.getHelp('general', text);
    }
  }

  async getHelp(type: 'repeat' | 'tip' | 'meaning' | 'general', userQ?: string): Promise<void> {
    let prompt = '';
    switch (type) {
      case 'repeat':
        if (this.lastQuestionSpoken) {
          this.speak(this.lastQuestionSpoken);
          return;
        } else {
          prompt = `Please repeat the last question.`;
        }
        break;
      case 'tip':
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `Provide a tip for the question: "${this.currentQuestion.questionName}"`;
        } else {
          console.warn('Cannot provide tip: current question not available.');
          this.snack.open('Current question not available for a tip.', 'OK', { duration: 3000 });
          return;
        }
        break;
      case 'meaning':
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `Explain the meaning of the question: "${this.currentQuestion.questionName}"`;
        } else {
          console.warn('Cannot explain meaning: current question not available.');
          this.snack.open('Current question not available for meaning explanation.', 'OK', { duration: 3000 });
          return;
        }
        break;
      case 'general':
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `User asked for help: "${userQ}". Current question: "${this.currentQuestion.questionName}"`;
        } else {
          prompt = `User asked for help: "${userQ}". No specific question context available.`;
        }
        break;
      default:
        console.warn('Unknown help type requested:', type);
        this.snack.open('Invalid help request.', 'OK', { duration: 3000 });
        return;
    }

    if (prompt) {
      this.isLoadingSession = true;
      from(this.ai.queryAi(prompt))
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingSession = false)
        )
        .subscribe({
          next: (reply: string) => {
            this.assistantMessages.push(`AI (Help): ${reply}`);
            this.speak(reply);
          },
          error: (error: any) => {
            console.error('Error getting AI help:', error);
            this.snack.open('Could not get help at this time.', 'OK', { duration: 5000 });
          }
        });
    }
  }



  setupTabRestriction(): void {
    window.addEventListener('blur', () => {
      this.ngZone.run(() => {
        this.tabWarnings++;
        this.globalWarningMessage = `Please stay on this tab! (${this.tabWarnings}/${this.MAX_TAB_WARNINGS})`;
        this.showGlobalWarning = true;
        this.snack.open(this.globalWarningMessage, '', { duration: 3000 });
        if (this.tabWarnings >= this.MAX_TAB_WARNINGS) {
          this.endInterview();
        }
      });
    });
  }

  speak(text: string, callback?: () => void): void {
    this.lastQuestionSpoken = text;
    this.ngZone.run(() => {
      this.isAiSpeaking = true; // Set speaking state for animation
    });
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    if (callback) {
      utterance.onend = () => this.ngZone.run(() => {
        this.isAiSpeaking = false; // Reset speaking state
        callback();
      });
    } else {
      utterance.onend = () => this.ngZone.run(() => {
        this.isAiSpeaking = false; // Reset speaking state
      });
    }
  }

  showMotivation(): void {
    const msgs = [
      "You're doing great! Keep going.",
      "That's a thoughtful answer!",
      "Take your time, you've got this.",
      "Your insights are valuable.",
      "Stay confident!"
    ];
    this.motivationalNudge = msgs[Math.floor(Math.random() * msgs.length)];
    this.snack.open(this.motivationalNudge, '', { duration: 2500, panelClass: ['nudge-snackbar'] });
  }

  askAssistant(): void {
    if (!this.userQuery.trim()) return;
    const input = this.userQuery.trim();
    this.assistantMessages.push(`You: ${input}`);
    this.userQuery = '';
    this.isLoadingSession = true;

    from(this.ai.queryAi(input))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingSession = false)
      )
      .subscribe({
        next: (response: string) => {
          this.assistantMessages.push(`AI: ${response}`);
          this.speak(response);
        },
        error: (error: any) => {
          console.error('Error querying AI assistant:', error);
          this.snack.open('AI assistant is unavailable. Please try again later.', 'OK', {
            duration: 5000
          });
        }
      });
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
    }
    this.snack.open(`Camera ${this.cameraOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  toggleAudio(): void {
    this.microphoneOn = !this.microphoneOn;
    const stream = this.videoPlayerRef.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = this.microphoneOn));
    }
    this.snack.open(`Microphone ${this.microphoneOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  warnCandidateVoice(): void {
    const utter = new SpeechSynthesisUtterance('Please stay focused and look at the screen.');
    window.speechSynthesis.speak(utter);
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
        this.ngZone.run(() => {
          this.fullInterviewBlob = new Blob(this.fullRecordingBlobs, { type: 'video/webm' });
          console.log('Full interview video recorded.');
        });
      };
      this.mediaRecorder.start(1000);
      console.log('Full interview recording started.');
    } catch (error) {
      console.error('Error starting full interview recorder:', error);
      this.snack.open('Failed to start full interview recording.', 'OK');
    }
  }

  buildFinalInterviewJson(): any {
    const deptQuestions = this.allQuestions.filter(q => q.isMaster).map((mq: any) => ({
      department: mq.dept,
      masterQuestion: {
        questionName: mq.questionName,
        isMandatory: mq.isMandatory,
        questionId: mq.questionId,
        answer: this.answers[mq.questionId] || '',
        nestedQuestion: this.allQuestions.filter(nq => nq.nestedOf === mq.questionId).map((nq: any) => ({
          questionName: nq.questionName,
          isMandatory: nq.isMandatory,
          questionId: nq.questionId,
          answer: this.answers[nq.questionId] || ''
        }))
      }
    }));

    return {
      candidateName: this.candidateName,
      companyName: this.companyName,
      roundName: this.roundName,
      candidateIntro: this.candidateIntro,
      interviewDuration: this.interviewTimer,
      gazeWarningsCount: this.gazeWarnings,
      tabWarningsCount: this.tabWarnings,
      expressionTimeline: this.expressionTimeline,
      questions: deptQuestions
    };
  }

  submitResponses(): void {
    const formData = new FormData();
    formData.append('roundName', this.roundName);
    formData.append('scheduledDate', Date.now().toString());
    formData.append('candidateId', localStorage.getItem('candidateId') || '2');
    formData.append('companyId', localStorage.getItem('companyId') || '2');
    formData.append('interviewData', new Blob([JSON.stringify(this.buildFinalInterviewJson())], { type: 'application/json' }));

    if (this.fullInterviewBlob) {
      formData.append('interviewVideo', this.fullInterviewBlob, 'interview_video.webm');
    }

    this.ai.saveInterviewResponse(formData).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        console.log('Interview submitted successfully!');
        this.snack.open('Interview submitted successfully!', '', { duration: 5000 });
      },
      error: (err: any) => {
        console.error('Interview submission failed:', err);
        this.snack.open('Interview submission failed. Please try again.', '', { duration: 5000 });
      }
    });
  }

  openChatHistory(): void {
    this.snack.open('Chat history feature not yet implemented.', 'OK', { duration: 3000 });
    console.log('Open chat history');
  }

  openAiAssistantChat(): void {
    this.snack.open('AI assistant chat not yet implemented.', 'OK', { duration: 3000 });
    console.log('Open AI Assistant Chat');
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
      this.handleWarning('Interview window lost focus!');
      if (this.windowFocusWarnings >= this.MAX_WINDOW_FOCUS_WARNINGS) {
        this.endInterview();
      }
    }, this.WINDOW_FOCUS_DEBOUNCE_MS);
  };

  private handleWindowFocusDebounced = () => {
    if (this.windowFocusTimeout) {
      clearTimeout(this.windowFocusTimeout);
      this.windowFocusTimeout = null;
    }
    console.log('Window regained focus.');
  };

  private getAIResponseForAnswer(candidateAnswer: string): void {
    this.isLoadingSession = true;
    console.log("Getting AI response for:", candidateAnswer);

    setTimeout(() => {
      let aiResponseText = "Thank you for your response. Let's move to the next question.";
      if (candidateAnswer.toLowerCase().includes('challenge')) {
        aiResponseText = "That's an interesting point about challenges. Could you elaborate on how you overcome them?";
      } else if (candidateAnswer.toLowerCase().includes('teamwork')) {
        aiResponseText = "Teamwork is crucial. Can you give an example of a successful team project you contributed to?";
      }

      this.fullTranscriptEntries.push({ type: 'ai', text: aiResponseText });
      this.assistantMessages.push(aiResponseText);
      this.isLoadingSession = false;
    }, 2000);
  }



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

        const gazeOffset = eyeCenterX - noseX;

        // If the eyes are significantly off-center, likely looking away
        if (Math.abs(gazeOffset) > 0.01) {
          this.ngZone.run(() => {
            this.gazeWarnings++;
            console.warn('👁️ Gaze warning: eyes are not facing center. Count:', this.gazeWarnings);
          });
        }


        console.log('🎯 Expressions:', {  eyeCenterX });
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
    console.warn('🚫 Video element not available for face tracking.');
  }
}




}