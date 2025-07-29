import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewSchedule } from './interview-schedule';

describe('InterviewSchedule', () => {
  let component: InterviewSchedule;
  let fixture: ComponentFixture<InterviewSchedule>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewSchedule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewSchedule);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
