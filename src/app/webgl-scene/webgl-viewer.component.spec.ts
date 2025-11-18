import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebglViewerComponent } from './webgl-viewer.component';

describe('RoomSceneComponent', () => {
  let component: WebglViewerComponent;
  let fixture: ComponentFixture<WebglViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebglViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebglViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
