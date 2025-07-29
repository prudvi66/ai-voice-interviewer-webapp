import {
  OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, NgZone
} from '@angular/core';
import { Component } from '@angular/core';
import { Subscription, interval, Subject } from 'rxjs'; // Import Subject
import { takeUntil, finalize } from 'rxjs/operators'; // Import takeUntil operator
import { MatSnackBar } from '@angular/material/snack-bar';
import * as faceapi from 'face-api.js';
import { AiInterviewService } from './interview.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; // Add ReactiveFormsModule for form control
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
import { map, catchError } from 'rxjs/operators';
import { NgModule } from '@angular/core';
// Removed: BrowserModule and BrowserAnimationsModule as they should be imported at the root level
// import { BrowserModule } from '@angular/platform-browser';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatProgressBarModule } from '@angular/material/progress-bar';


declare global {
  interface Window {
    // Add these lines to explicitly declare the SpeechRecognition types
    SpeechRecognition: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    };
  }

  // Also declare the SpeechRecognition interface if it's not globally available
  // This provides the properties and methods like 'start', 'stop', 'onresult', etc.
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

  // You might also need these if not provided by your 'lib' settings
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
    // Add other properties if your usage requires them
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

  type SpeechRecognitionError =
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";

  // If you are using SpeechGrammarList or SpeechGrammar
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
    CommonModule, FormsModule, ReactiveFormsModule, // Add ReactiveFormsModule
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatDatepickerModule, MatNativeDateModule, MatSelectModule, MatMenuModule,
    MatToolbarModule, MatDividerModule, MatInputModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatStepperModule, MatExpansionModule, MatSidenavModule,
    MatButtonToggleModule, MatChipsModule,
    MatProgressBarModule // Ensure MatProgressBarModule is imported
    // Removed: BrowserModule, BrowserAnimationsModule
  ],
  templateUrl: './interview.html',
  styleUrls: ['./interview.scss']
})
export class Interview implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('candidateVideo') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoPlayer') videoPlayerRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('hiddenCanvas') hiddenCanvasRef!: ElementRef<HTMLCanvasElement>;
  // State Variables
  isLoadingSession = true; // Renamed from isLoading
  videoReady = false;
  isListening = false;
  isAnswering = false;
  cameraOn = true; // Initial state: camera is on
  microphoneOn = true; // Initial state: microphone is on (renamed from 'recording' for clarity)
  showWarning = false;
  interviewTimer = 0;
  lookAwayCounter = 0;
  gazeWarnings = 0;
  tabWarnings = 0;
  globalWarningMessage: string = ''; // Renamed from warningMessage
  motivationalNudge: string = '';
  currentExpression: string = '';
  expressionTimeline: { time: number; expression: string }[] = [];

  // New properties from errors
  candidateAvatarUrl: string = 'https://picsum.photos/200'; // Placeholder URL
  isUserOnline: boolean = true;
  showRealtimeFeedback: boolean = false;
  speakingRateFeedback: string = ''; // Placeholder for speaking rate
  fillerWordFeedback: string = ''; // Placeholder for filler word count
  showGazeOverlay: boolean = false; // To control the gaze overlay visibility
  silenceWarning: string = ''; // Placeholder for silence warning message/state
  showGlobalWarning: boolean = false; // To control global warning banner

  // Interview Data
  candidateName = localStorage.getItem('candidateName') || 'Candidate';
  companyName = localStorage.getItem('companyName') || 'Company';
  roundName = localStorage.getItem('roundName') || 'Round';
  allQuestions: any[] = [];
  currentQuestionIndex = 0; // Renamed from currentIndex
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
  private destroy$ = new Subject<void>(); // Used for managing subscriptions

  // Configuration Constants
  readonly MAX_LOOKAWAY_COUNT = 3;
  readonly MAX_GAZE_WARNINGS = 3;
  readonly MAX_TAB_WARNINGS = 2;
  readonly SILENCE_TIMEOUT_MS = 20000; // 20 seconds
  readonly GAZE_CHECK_INTERVAL_MS = 2000; // 2 seconds
  readonly FACE_CAPTURE_INTERVAL_MS = 2000; // 2 seconds
  readonly MODEL_URL = '/models'; // Local path for Face-API models


  // --- For Audio Monitoring ---
private audioContext: AudioContext | null = null;
private analyser: AnalyserNode | null = null;
private microphone: MediaStreamAudioSourceNode  | null = null;
private audioDataArray: Uint8Array | null = null;
private speechActivityTimer: any;
private lastSpeechActivityTime: number = 0;
private hasSpeechActivityBeenDetected: boolean = false; // To track initial speech presence

readonly MIN_SPEECH_ACTIVITY_VOLUME_THRESHOLD = 20; // Volume threshold to consider as speech (0-255)
readonly INACTIVITY_THRESHOLD_MS = 10000; // 10 seconds of inactivity before warning

// --- For Motion Detection ---
 // You'll need to add this canvas to your template
private canvasContext: CanvasRenderingContext2D | null = null;
private prevFrameData: ImageData | null = null;
private motionDetectionInterval: any;

readonly MOTION_PIXEL_CHANGE_THRESHOLD = 50; // Number of pixels that must change to detect motion
readonly MOTION_DETECTION_INTERVAL_MS = 500; // Check for motion every 500ms
private motionWarnings: number = 0;
readonly MAX_MOTION_WARNINGS = 5;
private motionWarningTimer: any; // Timer for consecutive motion warnings

// --- For Window Focus Monitoring ---
private windowFocusWarnings: number = 0;
readonly MAX_WINDOW_FOCUS_WARNINGS = 3; // Max times window can lose focus
private windowFocusTimeout: any; // Timer to debounce multiple focus/blur events
readonly WINDOW_FOCUS_DEBOUNCE_MS = 1000; // Debounce period

  answeredSet = new Set<string>();

  constructor(
    private ai: AiInterviewService,
    private snack: MatSnackBar,
    private ngZone: NgZone,
  ) { }

  ngOnInit(): void {
    this.initializeSpeechRecognition();
    this.introduceAI();
  }

  ngAfterViewInit(): void {
    this.requestMedia();
    this.loadModels(); // Load models after view init
    this.fetchQuestions();
    this.startInterviewTimer();
    this.setupTabRestriction();
  }

  loadModels(): void {
    // Ensure the video element is available before initializing camera
    if (this.videoPlayerRef && this.videoPlayerRef.nativeElement) {
      this.initCamera();
    } else {
      console.error('Video player element not found!');
    }

    // Call the new monitoring setups here
    this.setupTabRestriction(); // Keep your existing tab restriction
    this.setupWindowFocusMonitoring(); // New: Window focus monitoring
    // this.startAudioMonitoring() is called inside initCamera now after stream is ready
    this.startMotionDetection(); // New: Motion detection
  }

 

  /**
   * Initializes the Web Speech API Recognition.
   */
  private initializeSpeechRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.snack.open('Speech recognition not supported in this browser.', 'OK');
      console.error('Speech Recognition API not supported.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false; // Set to false for single utterances, true for continuous
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.resultIndex][0].transcript.trim();
      this.ngZone.run(() => { // Ensure Angular change detection runs
        this.assistantMessages.push(`Candidate: ${transcript}`);
        this.handleCandidateSpeech(transcript);
        this.resetSilenceTimer(); // Reset timer on speech input
      });
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        console.warn('No speech detected. Recognition might have stopped.');
        // Optionally, restart recognition if it's expected to be continuous
        // if (this.isListening) {
        //   this.recognition.start();
        // }
      }
      this.ngZone.run(() => {
        // Handle error message for user
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        console.log('Speech recognition ended.');
        this.isListening = false;
        // Logic to automatically stop recording or move to next question if continuous
        if (this.isAnswering && !this.answeredSet.has(this.currentQuestionId)) {
          this.stopRecordingAndProcessAnswer();
        }
      });
    };
  }

  /**
   * Introduces the AI interviewer and starts listening for the candidate's introduction.
   */
  introduceAI(): void {
    const message = "Hello! I'm your AI interviewer. I’ll be guiding you through this session today. We’ll begin shortly, but first, could you please introduce yourself? Also, feel free to ask me for help at any time — either by speaking or clicking the help button.";
    this.speak(message, () => {
      this.startListening();
      this.startFullRecording(); // Start recording the entire interview from the beginning
    });
  }

  /**
   * Starts speech recognition.
   */
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

  /**
   * Stops speech recognition.
   */
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


      this.isLoadingSession = true; // Using isLoadingSession
      this.assistantMessages.push(`You (Intro): ${transcript}`);


      from(this.ai.queryAi(`Candidate intro: ${transcript}`))
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingSession = false) // Using isLoadingSession
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


  /**
   * Loads Face-API models.
   */
  // async loadModels(): Promise<void> {
  //   try {
  //     this.isLoadingSession = true; // Using isLoadingSession
  //     await Promise.all([
  //       faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
  //       faceapi.nets.faceExpressionNet.loadFromUri(this.MODEL_URL),
  //       faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
  //       // faceapi.nets.faceLandmark68TinyNet.loadFromUri(this.MODEL_URL), // Only one landmark model is needed
  //       // faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL), // Only if you need face recognition
  //     ]);
  //     console.log('Face-API Models loaded successfully');
  //     this.isLoadingSession = false; // Using isLoadingSession
  //     this.startGazeMonitoring();
  //     this.startFaceCapture();
  //   } catch (error) {
  //     console.error('Error loading Face-API models:', error);
  //     this.snack.open('Failed to load face detection models. Please refresh.', 'OK');
  //     this.isLoadingSession = false; // Using isLoadingSession
  //   }
  // }

  /**
   * Requests camera and microphone access.
   */
  async requestMedia(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.videoEl.nativeElement.srcObject = stream;
      this.videoReady = true;
      this.isLoadingSession = false; // Using isLoadingSession
    } catch (error) {
      console.error('Error accessing camera and microphone:', error);
      this.snack.open('Camera & microphone access is required. Please refresh and allow permissions.', 'OK');
      this.isLoadingSession = false; // Using isLoadingSession
    }
  }

  /**
   * Fetches interview questions from the service.
   */
  fetchQuestions(): void {
    const candId = localStorage.getItem('candidateId') || '';
    const compId = localStorage.getItem('companyId') || '';
    this.ai.getQuestions(candId, compId, this.roundName).pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.allQuestions = this.flattenQuestions(res.deptQuestions);
      if (this.allQuestions.length > 0) {
        // Do not call askNext here, it's called after intro is captured
      } else {
        this.snack.open('No questions found for this interview.', 'OK');
      }
    }, error => {
      console.error('Failed to load questions:', error);
      this.snack.open('Failed to load questions. Please try again.', 'Retry');
    });
  }

  /**
   * Flattens the nested question structure into a single array.
   * @param depts The array of department questions.
   * @returns A flattened array of all questions.
   */
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

  /**
   * Starts the main interview timer.
   */
  private startInterviewTimer(): void {
    this.timerSub = interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => this.interviewTimer += 1000);
  }

  /**
   * Resets the silence timeout. If no speech is detected within the timeout,
   * the application moves to the next question.
   */
  resetSilenceTimer(): void {
    clearTimeout(this.silenceTimeoutId);
    this.silenceTimeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        console.log('Silence detected. Moving to next question.');
        this.snack.open('No response detected. Moving on…', '', { duration: 2000 });
        this.stopRecordingAndProcessAnswer(); // Process the answer on silence
        this.nextQuestion();
        this.silenceWarning = 'Silence detected! Please respond.'; // Set silence warning
        this.showGlobalWarning = true; // Show global warning
      });
    }, this.SILENCE_TIMEOUT_MS);
  }

  /**
   * Asks the next question in the queue.
   */
  async askNext(): Promise<void> {
    if (this.currentQuestionIndex >= this.allQuestions.length) {
      this.endInterview(); // Renamed from finishInterview
      return;
    }
    this.currentQuestion = this.allQuestions[this.currentQuestionIndex];
    this.currentQuestionId = this.currentQuestion.questionId.toString();

    this.assistantMessages.push(`AI: ${this.currentQuestion.questionName}`);
    this.speak(this.currentQuestion.questionName, () => {
      this.startQuestionRecording(this.currentQuestionId);
      this.startListening(); // Re-enable listening for the answer
      this.resetSilenceTimer();
      this.showMotivation();
      this.isAnswering = true; // Indicate that the AI is waiting for an answer
    });
  }

  /**
   * Moves to the next question.
   */
  nextQuestion(): void {
    this.isAnswering = false; // Candidate is no longer answering the previous question
    this.stopListening();
    this.currentQuestionIndex++; // Renamed from currentIndex
    this.askNext();
  }

  /**
   * Ends the interview process.
   */
  endInterview(): void { // Renamed from finishInterview
    this.timerSub.unsubscribe();
    this.stopRecording(); // Stop all recordings
    this.stopGazeMonitoring();
    this.stopFaceCapture();
    this.stopListening();
    this.snack.open('Interview completed! Submitting your responses...', '', { duration: 3000 });
    this.submitResponses(); // Submit all collected data
  }

  /**
   * Starts recording the candidate's answer for a specific question.
   * @param questionId The ID of the current question.
   */
  startQuestionRecording(questionId: string): void {
    if (!this.videoReady) {
      this.snack.open('Camera is not ready. Cannot record.', 'OK');
      return;
    }
    this.currentQuestionId = questionId;
    this.recordedBlobs = [];
    const stream = this.videoEl.nativeElement.srcObject as MediaStream;

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
          this.recordedBlobs = []; // Clear for next recording
        });
      };
      this.mediaRecorder.start(1000); // Record in 1-second chunks
      this.microphoneOn = true; // Indicate that microphone is actively recording
      console.log(`Recording started for question ${questionId}`);
    } catch (error) {
      console.error('Error starting media recorder:', error);
      this.snack.open('Failed to start recording your answer.', 'OK');
    }
  }

  /**
   * Stops the current question's recording.
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.microphoneOn = false;
      console.log('Recording stopped.');
    }
    clearTimeout(this.silenceTimeoutId);
  }

  /**
   * Stops the current recording and processes the answer.
   * This is called when an answer is explicitly submitted or silence is detected.
   */
  stopRecordingAndProcessAnswer(): void {
    this.stopRecording();
    if (this.currentQuestionId && this.answers[this.currentQuestionId]) {
      this.ai.recordAnswer({ id: this.currentQuestionId, answer: this.answers[this.currentQuestionId] })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => console.log('Answer recorded successfully.'),
          error: (err) => console.error('Failed to record answer:', err)
        });
    }
    this.answeredSet.add(this.currentQuestionId); // Mark as answered
  }

  /**
   * Handles voice commands from the candidate.
   * @param text The transcribed voice command.
   */
  handleVoiceCommands(text: string): void {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('repeat')) {
      this.getHelp('repeat');
    } else if (lowerText.includes('tip') || lowerText.includes('hint')) {
      this.getHelp('tip');
    } else if (lowerText.includes('meaning') || lowerText.includes('explain')) {
      this.getHelp('meaning');
    } else if (lowerText.includes('help')) { // General help command
      this.getHelp('general', text);
    }
  }

  async getHelp(type: 'repeat' | 'tip' | 'meaning' | 'general', userQ?: string): Promise<void> {
    let prompt = '';
    switch (type) {
      case 'repeat':
        if (this.lastQuestionSpoken) {
          this.speak(this.lastQuestionSpoken);
          return; // Exit if we can just repeat the last spoken question
        } else {
          // If lastQuestionSpoken is not available, ask AI to generate a repeat prompt
          prompt = `Please repeat the last question.`;
        }
        break;
      case 'tip':
        // Ensure currentQuestion and questionName exist before forming the prompt
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `Provide a tip for the question: "${this.currentQuestion.questionName}"`;
        } else {
          console.warn('Cannot provide tip: current question not available.');
          this.snack.open('Current question not available for a tip.', 'OK', { duration: 3000 });
          return;
        }
        break;
      case 'meaning':
        // Ensure currentQuestion and questionName exist before forming the prompt
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `Explain the meaning of the question: "${this.currentQuestion.questionName}"`;
        } else {
          console.warn('Cannot explain meaning: current question not available.');
          this.snack.open('Current question not available for meaning explanation.', 'OK', { duration: 3000 });
          return;
        }
        break;
      case 'general':
        // Ensure currentQuestion and questionName exist before forming the prompt
        if (this.currentQuestion && this.currentQuestion.questionName) {
          prompt = `User asked for help: "${userQ}". Current question: "${this.currentQuestion.questionName}"`;
        } else {
          prompt = `User asked for help: "${userQ}". No specific question context available.`;
        }
        break;
      default:
        console.warn('Unknown help type requested:', type);
        this.snack.open('Invalid help request.', 'OK', { duration: 3000 });
        return; // Exit for unknown types
    }

    if (prompt) {
      this.isLoadingSession = true; // Set loading state
      // FIX: Convert the Promise returned by queryAi to an Observable using 'from()'
      from(this.ai.queryAi(prompt))
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoadingSession = false) // Ensure loading state is reset
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

  /**
   * Starts monitoring candidate's gaze using Face-API.
   */
  startGazeMonitoring(): void {
    if (!this.videoEl?.nativeElement) {
      console.warn('Video element not available for gaze monitoring.');
      return;
    }

    this.stopGazeMonitoring(); // Ensure no duplicate intervals

    this.gazeMonitoringInterval = setInterval(async () => {
      if (this.videoEl.nativeElement.readyState < 2) return;

      const detection = await faceapi
        .detectSingleFace(this.videoEl.nativeElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true);

      if (!detection || !detection.landmarks) {
        // No face or landmarks detected, assume looking away
        this.lookAwayCounter++;
      } else {
        const nose = detection.landmarks.getNose();
        const leftEye = detection.landmarks.getLeftEye();
        const rightEye = detection.landmarks.getRightEye();

        if (nose?.length && leftEye?.length && rightEye?.length) {
          const noseX = nose[3].x; // Approx center of nose
          const avgEyeX = (leftEye[0].x + rightEye[3].x) / 2; // Approx center of eyes

          const gazeDiff = Math.abs(noseX - avgEyeX);
          //const headRotationY = detection.angle.yaw; // Yaw rotation for horizontal gaze
          const headRotationY = (detection as any).angle.yaw;
          // Thresholds can be fine-tuned
          const isLookingAway = gazeDiff > 25 || Math.abs(headRotationY) > 20; // Combine position and rotation
          if (isLookingAway) {
            this.lookAwayCounter++;
          } else {
            this.lookAwayCounter = 0; // Reset counter if looking straight
          }
        } else {
          this.lookAwayCounter++; // Incomplete landmarks, treat as looking away
        }
      }

      this.ngZone.run(() => { // Update UI safely within Angular's zone
        if (this.lookAwayCounter >= this.MAX_LOOKAWAY_COUNT) {
          this.gazeWarnings++;
          this.globalWarningMessage = `Please stay focused on the interview. (${this.gazeWarnings}/${this.MAX_GAZE_WARNINGS})`; // Using globalWarningMessage
          this.showGlobalWarning = true; // Show global warning
          this.snack.open(this.globalWarningMessage, '', { duration: 3000 });
          this.warnCandidateVoice(); // Provide voice warning
          this.lookAwayCounter = 0; // Reset counter after warning
          if (this.gazeWarnings >= this.MAX_GAZE_WARNINGS) {
            this.endInterview(); // Renamed from finishInterview
          }
        } else {
          this.globalWarningMessage = ''; // Clear warning if focus returns
          this.showGlobalWarning = false; // Hide global warning
        }
      });
    }, this.GAZE_CHECK_INTERVAL_MS);
    console.log('Gaze monitoring started.');
  }

  /**
   * Stops gaze monitoring.
   */
  stopGazeMonitoring(): void {
    if (this.gazeMonitoringInterval) {
      clearInterval(this.gazeMonitoringInterval);
      this.gazeMonitoringInterval = null;
      console.log('Gaze monitoring stopped.');
    }
  }

  /**
   * Sets up a listener for tab changes to detect if the user leaves the interview tab.
   */
  setupTabRestriction(): void {
    window.addEventListener('blur', () => {
      this.ngZone.run(() => {
        this.tabWarnings++;
        this.globalWarningMessage = `Please stay on this tab! (${this.tabWarnings}/${this.MAX_TAB_WARNINGS})`; // Using globalWarningMessage
        this.showGlobalWarning = true; // Show global warning
        this.snack.open(this.globalWarningMessage, '', { duration: 3000 });
        if (this.tabWarnings >= this.MAX_TAB_WARNINGS) {
          this.endInterview(); // Renamed from finishInterview
        }
      });
    });
  }

  /**
   * Speaks the given text using the Web Speech API.
   * @param text The text to speak.
   * @param callback Optional callback function to execute after speech ends.
   */
  speak(text: string, callback?: () => void): void {
    this.lastQuestionSpoken = text; // Store the last spoken question
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel(); // Stop any ongoing speech
    window.speechSynthesis.speak(utterance);

    if (callback) {
      utterance.onend = () => this.ngZone.run(() => callback()); // Ensure callback runs in Angular zone
    }
  }

  /**
   * Displays a motivational nudge to the candidate.
   */
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

    this.isLoadingSession = true; // Using isLoadingSession


    from(this.ai.queryAi(input))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingSession = false) // Using isLoadingSession
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

  /**
   * Skips the current question and moves to the next.
   * @param questionId The ID of the question being skipped.
   */
  skipQuestion(questionId: any): void {
    this.stopRecording(); // Stop recording for the skipped question
    this.answers[questionId] = ''; // Mark answer as empty for skipped questions
    this.answeredSet.add(questionId);
    this.nextQuestion();
  }

  /**
   * Toggles the camera on/off.
   */
  toggleCamera(): void {
    this.cameraOn = !this.cameraOn;
    const stream = this.videoEl.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => (track.enabled = this.cameraOn));
    }
    this.snack.open(`Camera ${this.cameraOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  /**
   * Toggles the microphone on/off.
   */
  toggleAudio(): void {
    this.microphoneOn = !this.microphoneOn;
    const stream = this.videoEl.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = this.microphoneOn));
    }
    this.snack.open(`Microphone ${this.microphoneOn ? 'ON' : 'OFF'}`, '', { duration: 1500 });
  }

  /**
   * Provides a voice warning to the candidate.
   */
  warnCandidateVoice(): void {
    const utter = new SpeechSynthesisUtterance('Please stay focused and look at the screen.');
    window.speechSynthesis.speak(utter);
  }

  /**
   * Starts capturing facial expressions using Face-API.
   */
  startFaceCapture(): void {
    if (!this.videoEl?.nativeElement) {
      console.warn('Video element not available for face capture.');
      return;
    }
    this.stopFaceCapture(); // Ensure no duplicate intervals

    this.faceCaptureInterval = setInterval(async () => {
      if (this.videoEl.nativeElement.readyState < 2) return;

      const detection = await faceapi
        .detectSingleFace(this.videoEl.nativeElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      this.ngZone.run(() => { // Update UI safely within Angular's zone
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

  /**
   * Stops facial expression capture.
   */
  stopFaceCapture(): void {
    if (this.faceCaptureInterval) {
      clearInterval(this.faceCaptureInterval);
      this.faceCaptureInterval = null;
      console.log('Face expression capture stopped.');
    }
  }

  /**
   * Starts recording the full interview video from the beginning.
   */
  startFullRecording(): void {
    if (!this.videoReady) {
      console.warn('Cannot start full recording: video not ready.');
      return;
    }
    const stream = this.videoEl.nativeElement.srcObject as MediaStream;
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
      this.mediaRecorder.start(1000); // Record in 1-second chunks
      console.log('Full interview recording started.');
    } catch (error) {
      console.error('Error starting full interview recorder:', error);
      this.snack.open('Failed to start full interview recording.', 'OK');
    }
  }

  /**
   * Builds the final JSON structure for interview responses.
   * @returns The structured interview data.
   */
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
      expressionTimeline: this.expressionTimeline, // Include expressions
      questions: deptQuestions // Changed to 'questions' for clarity
    };
  }

  /**
   * Submits all interview responses and recordings to the backend.
   */
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

  // New Methods added to resolve errors from interview.html
  openChatHistory(): void {
    this.snack.open('Chat history feature not yet implemented.', 'OK', { duration: 3000 });
    console.log('Open chat history');
    // Implement navigation or dialog to show full chat history
  }

  openAiAssistantChat(): void {
    this.snack.open('AI assistant chat not yet implemented.', 'OK', { duration: 3000 });
    console.log('Open AI Assistant Chat');
    // Implement logic to open AI assistant chat interface
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
      // Ensure both video and audio are requested for the stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.videoPlayerRef.nativeElement.srcObject = stream;
      this.stream = stream; // Store the stream for MediaRecorder and audio context

      // Initialize audio monitoring after stream is available
      this.startAudioMonitoring(stream);


      console.log('Camera initialized successfully with video and audio.');
    } catch (err) {
      console.error('Error accessing camera and microphone:', err);
      this.snack.open('Error accessing camera and microphone. Please allow access.', '', { duration: 5000 });
    }
  }

  /**
   * Initializes and starts monitoring the audio stream for speech activity.
   * @param stream The MediaStream containing the audio track.
   */
  private startAudioMonitoring(stream: MediaStream): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048; // Fast Fourier Transform size
      this.audioDataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (!this.microphone) {
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      // Analyser not connected to speakers, so audio is not played back (muted)
    }

    // Start checking for speech activity periodically
    this.speechActivityTimer = setInterval(() => {
      if (this.analyser && this.audioDataArray) {
        this.analyser.getByteFrequencyData(this.audioDataArray);
        let sum = 0;
        for (let i = 0; i < this.audioDataArray.length; i++) {
          sum += this.audioDataArray[i];
        }
        const averageVolume = sum / this.audioDataArray.length;

        if (averageVolume > this.MIN_SPEECH_ACTIVITY_VOLUME_THRESHOLD) {
          // Speech activity detected
          this.lastSpeechActivityTime = Date.now();
          this.hasSpeechActivityBeenDetected = true; // Mark that speech has occurred
          // console.log('Speech activity detected, average volume:', averageVolume);
        } else {
          // No speech activity, check for prolonged inactivity
          if (this.hasSpeechActivityBeenDetected && (Date.now() - this.lastSpeechActivityTime > this.INACTIVITY_THRESHOLD_MS)) {
            this.handleWarning('No speech detected for a prolonged period.');
            this.lastSpeechActivityTime = Date.now(); // Reset timer to avoid continuous warnings
          }
        }
      }
    }, 500); // Check every 500ms
  }


  /**
 * Initializes and starts monitoring the video stream for general motion.
 */
private startMotionDetection(): void {
    // Ensure canvas and video elements are ready
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

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640; // Default if not yet loaded
    canvas.height = video.videoHeight || 480;

    // Start motion detection loop
    this.motionDetectionInterval = setInterval(() => {
        if (!this.canvasContext || !video.srcObject) {
            return;
        }

        // Draw current video frame to canvas
        this.canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        const currentFrameData = this.canvasContext.getImageData(0, 0, canvas.width, canvas.height);

        if (this.prevFrameData) {
            let changedPixels = 0;
            // Compare pixel data. Only check a subset for performance
            // Iterating by 4 for RGBA, and then skipping some pixels for performance.
            const pixelStep = 10; // Check every 10th pixel (adjust as needed for performance/accuracy)
            for (let i = 0; i < currentFrameData.data.length; i += 4 * pixelStep) {
                // Simple difference check for R, G, B channels
                if (
                    Math.abs(currentFrameData.data[i] - this.prevFrameData.data[i]) > 20 || // R
                    Math.abs(currentFrameData.data[i + 1] - this.prevFrameData.data[i + 1]) > 20 || // G
                    Math.abs(currentFrameData.data[i + 2] - this.prevFrameData.data[i + 2]) > 20    // B
                ) {
                    changedPixels++;
                }
            }

            // If too few pixels changed, consider it a lack of motion
            if (changedPixels < this.MOTION_PIXEL_CHANGE_THRESHOLD) {
                this.motionWarnings++;
                // console.log('Low motion detected, warnings:', this.motionWarnings);
                if (this.motionWarnings >= this.MAX_MOTION_WARNINGS) {
                    if (!this.motionWarningTimer) { // Start timer only if not already running
                        this.motionWarningTimer = setTimeout(() => {
                            this.handleWarning('No significant motion detected from candidate.');
                            this.motionWarnings = 0; // Reset warnings after giving one
                            this.motionWarningTimer = null; // Clear timer
                        }, 2000); // Wait 2 seconds of continuous low motion before warning
                    }
                } else {
                    // Reset timer if motion is detected before threshold
                    clearTimeout(this.motionWarningTimer);
                    this.motionWarningTimer = null;
                }
            } else {
                this.motionWarnings = 0; // Reset warnings if motion is detected
                clearTimeout(this.motionWarningTimer);
                this.motionWarningTimer = null;
            }
        }
        this.prevFrameData = currentFrameData; // Store current frame for next comparison
    }, this.MOTION_DETECTION_INTERVAL_MS);
}


/**
 * Sets up event listeners to monitor if the interview window loses focus.
 */
private setupWindowFocusMonitoring(): void {
    window.addEventListener('blur', () => {
        // Debounce to avoid multiple rapid blur/focus events
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
    });

    window.addEventListener('focus', () => {
        if (this.windowFocusTimeout) {
            clearTimeout(this.windowFocusTimeout);
            this.windowFocusTimeout = null;
        }
        // Optionally reset warnings if focus is quickly restored
        // this.windowFocusWarnings = 0;
        console.log('Window regained focus.');
    });
}


private handleWarning(message: string): void {
    console.warn('Monitoring Warning:', message);
    this.snack.open(message, 'Dismiss', { duration: 5000 }); // Display warning to candidate
    // Optionally, you could increment a general warning counter here,
    // or log it to an internal state for review later.
    // Example: this.totalWarnings++;
    // if (this.totalWarnings >= this.MAX_TOTAL_WARNINGS) {
    //   this.endInterview('Too many warnings accumulated.');
    // }
}

// Inside your InterviewComponent class

ngOnDestroy(): void {
    // --- Audio Monitoring Cleanup ---
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

    // --- Motion Detection Cleanup ---
    if (this.motionDetectionInterval) {
        clearInterval(this.motionDetectionInterval);
    }
    if (this.motionWarningTimer) {
        clearTimeout(this.motionWarningTimer);
    }

    // --- Window Focus Monitoring Cleanup ---
    if (this.windowFocusTimeout) {
        clearTimeout(this.windowFocusTimeout);
    }
    // Remove event listeners added to `window`
    window.removeEventListener('blur', this.handleWindowBlurDebounced); // You'll need to define a debounced handler
    window.removeEventListener('focus', this.handleWindowFocusDebounced); // You'll need to define a debounced handler

    // --- Existing cleanup (ensure these are still present) ---
    
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
    }
   
    // Don't forget to call next on your Subject to complete observables
    this.destroy$.next();
    this.destroy$.complete(); this.timerSub?.unsubscribe();
    this.destroy$.next(); // Emit a value to complete ongoing subscriptions
    this.destroy$.complete(); // Complete the subject
    this.stopGazeMonitoring();
    this.stopFaceCapture();
    clearTimeout(this.silenceTimeoutId);
    this.stopRecording(); // Ensure all recording is stopped
    

}

// --- Add these debounced handlers for window focus/blur for proper cleanup ---
// (Place these alongside your other private methods)
private handleWindowBlurDebounced = () => {
    // This is the debounced logic you put in setupWindowFocusMonitoring()
    // It's defined here so you can refer to it to remove the listener in ngOnDestroy
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
    // This is the debounced logic you put in setupWindowFocusMonitoring()
    // It's defined here so you can refer to it to remove the listener in ngOnDestroy
    if (this.windowFocusTimeout) {
        clearTimeout(this.windowFocusTimeout);
        this.windowFocusTimeout = null;
    }
    console.log('Window regained focus.');
};

}