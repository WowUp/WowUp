import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { DownloadCountPipe } from './download-count.pipe';

describe('DownloadCountPipe', () => {
  let directive: DownloadCountPipe;
  let fixture: ComponentFixture<DownloadCountPipe>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DownloadCountPipe ]
    })
      .compileComponents();
  }));
  
  it('should create an instance', () => {
    fixture = TestBed.createComponent(DownloadCountPipe);
    directive = fixture.componentInstance;
    expect(directive).toBeTruthy();
  });
});
