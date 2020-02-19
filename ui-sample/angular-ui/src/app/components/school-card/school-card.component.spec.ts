import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolCardComponent } from './school-card.component';

describe('SchoolCardComponent', () => {
  let component: SchoolCardComponent;
  let fixture: ComponentFixture<SchoolCardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SchoolCardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
