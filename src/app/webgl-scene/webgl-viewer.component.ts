// src/app/webgl-viewer/webgl-viewer.component.ts
import { Component, ViewChildren, QueryList, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CommonModule } from '@angular/common'; // Needed for structural directives (e.g., *ngFor or @for)
import {RouterLink, RouterLinkWithHref, RouterOutlet} from '@angular/router';

// --- 1. Define Model Config Interface (Source of Truth) ---
interface ModelConfig {
  index: number;
  displayName: string;
  offer: string;
  scale: [number, number, number];
  path: string;
  pos: [number, number, number];
}

// --- 2. Define Viewer State Interface (Runtime State) ---
interface ViewerState {
  config: ModelConfig; // Hold the configuration
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  controls: OrbitControls;
  model: THREE.Object3D | null; // Model is initially null
  container: ElementRef;
}

@Component({
  selector: 'app-webgl-viewer',
  templateUrl: './webgl-viewer.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./webgl-viewer.component.css']
})
export class WebglViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('rendererContainer') rendererContainers!: QueryList<ElementRef>;

  // Use const for paths
  private readonly GLB_MODEL_PATH = '/glbfiles/googlelogo.glb';


  // Strongly typed configuration data
  public modelData: ModelConfig[] = [
    { index: 0, displayName: 'Icon 1', offer: '30% 500', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 1, displayName: 'Icon 2', offer: '20% 200', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 2, displayName: 'Icon 3', offer: '20% 100', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 3, displayName: 'Icon 4', offer: '20% 100', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 4, displayName: 'Icon 5', offer: '20% 100', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 5, displayName: 'Icon 6', offer: '20% 100', scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 6, displayName: 'Icon 7', offer: '20% 100',  scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 7, displayName: 'Icon 8', offer: '20% 100',  scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
    { index: 8, displayName: 'Icon 9', offer: '20% 100',  scale: [80, 80, 80], pos: [0, -22, 0], path: this.GLB_MODEL_PATH },
  ];

  // Initialize as empty array, replacing all separate arrays
  private viewerStates: ViewerState[] = [];
  
  private animateId: number = 0; // Better initialization

  ngAfterViewInit(): void {
    // Ensure all containers are rendered and available
    if (!this.rendererContainers.length) return; 

    // Combine config and DOM references and initialize all viewers
    this.viewerStates = this.modelData.map((config, index) => {
      const container = this.rendererContainers.toArray()[index];
      return this.initViewer(config, container);
    });

    this.animate();
  }

  /**
   * 💡 Simplified Setup: Initializes one Three.js viewer and returns the state object.
   * @returns ViewerState with initialized THREE objects.
   */
  initViewer(config: ModelConfig, container: ElementRef): ViewerState {
    const width = container.nativeElement.clientWidth;
    const height = container.nativeElement.clientHeight;

    // --- 1. Scene, Camera, Renderer Setup (With Anti-aliasing) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF); // D6CDC5 Softer off-white background

    const renderer = new THREE.WebGLRenderer({ antialias: true }); // ✅ Performance/Visualization Improvement: Anti-aliasing
    renderer.setSize(width, height);
    container.nativeElement.appendChild(renderer.domElement); 

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 50;

    // --- 2. Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0); // Focus controls on the center

    // --- 3. Lighting (More effective lighting for 3D models) ---
    // Ambient Light: Soft overall illumination
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    // Directional Light: Defines clear shadows and highlights (better visualization)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3); 
    directionalLight.position.set(5, 10, 7.5); // Light from top-front-right
    scene.add(directionalLight);
    
    // --- 4. Create the state object and load the model ---
    const state: ViewerState = { config, renderer, camera, scene, controls, container, model: null };
    this.loadGlbModel(state);
    
    return state;
  }

  /**
   * Dedicated method for asynchronous GLB loading.
   */
  private loadGlbModel(state: ViewerState): void {
    const loader = new GLTFLoader();

    loader.load(state.config.path, (gltf) => {
      state.model = gltf.scene;
      
      // Apply configuration
      state.model.scale.set(...state.config.scale); // Spread operator for cleaner array assignment
      state.model.position.set(...state.config.pos); 

      state.scene.add(state.model);
    });
  }

  /**
   * 3. The animation loop
   */
  animate = () => {
    this.animateId = requestAnimationFrame(this.animate);

    this.viewerStates.forEach(state => {
      // Always update controls if damping is enabled
      state.controls.update();

      // Automatic Model Rotation
      if (state.model) {
        state.model.rotation.y += 0.007; 
      }

      // Render the Scene
      state.renderer.render(state.scene, state.camera);
    });
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    if (this.animateId) {
      cancelAnimationFrame(this.animateId);
    }
    // Optional: Dispose of Three.js resources for memory cleanup
    this.viewerStates.forEach(state => {
        state.renderer.dispose();
    });
  }
}