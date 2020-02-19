import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SchoolDirectoryComponent } from './school-directory.component';

describe('SchoolDirectoryComponent', () => {
  let component: SchoolDirectoryComponent;
  let fixture: ComponentFixture<SchoolDirectoryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SchoolDirectoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SchoolDirectoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
