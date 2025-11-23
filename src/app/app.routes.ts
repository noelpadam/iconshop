import { Routes } from '@angular/router';
import { WebglViewerComponent } from './webgl-scene/webgl-viewer.component';
import { AboutUsComponent } from './about-us/about-us.component';

export const routes: Routes = [
     { path: '', component: WebglViewerComponent },
     { path: 'about-us', component: AboutUsComponent },
];
