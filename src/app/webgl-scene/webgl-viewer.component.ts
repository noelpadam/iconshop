import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChildren, QueryList, ChangeDetectionStrategy, afterNextRender, ChangeDetectorRef } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// --- 1. Define Model Config Interface (Source of Truth) ---
interface ModelConfig {
  index: number;
  displayName: string;
  offer: string;
  scale: [number, number, number];
  pos: [number, number, number];
}

// NOTE: Declaring global types to access Three.js objects without local module imports.
// declare const THREE: any;
// declare const GLTFLoader: any;
// declare const OrbitControls: any;

/**
 * Encapsulates the complete logic for a single Three.js viewer instance.
 * This pattern isolates resources and improves component clarity.
 */
/**
 * Encapsulates the complete logic for a single Three.js viewer instance.
 */
class ThreeViewer {
  private config: ModelConfig;
  public renderer: any; // THREE.WebGLRenderer
  private camera: any; // THREE.PerspectiveCamera
  private scene: any; // THREE.Scene
  public controls: any; // OrbitControls
  public model: any | null = null; // THREE.Object3D
  private container: HTMLElement;

  constructor(config: ModelConfig, container: HTMLElement) {
    this.config = config;
    this.container = container;

    // Guard against running Three.js setup before scripts are loaded
    if (typeof THREE === 'undefined') {
        console.error("THREE.js is not available in the global scope.");
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF3F3F3); 

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement); 

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 2.5; // Adjusted camera position for the new model

    // 2. Controls (Only initialize if OrbitControls is available)
    if (typeof OrbitControls !== 'undefined') {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0); 
    }

    // 3. Lighting (Optimized for PBR models)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2); 
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  /**
   * Optimization: Clones the pre-loaded model (geometry/materials) to reuse resources
   * and adds it to this viewer's scene.
   * @param loadedModel The scene object loaded from the GLB file.
   */
  public addModel(loadedModel: any): void { // THREE.Object3D
    if (!loadedModel) return;
    this.model = loadedModel.clone();
    
    // Apply configuration
    this.model.scale.set(...this.config.scale);
    this.model.position.set(...this.config.pos); 

    this.scene.add(this.model);
  }

  /**
   * Performs the animation and render step.
   */
  public update(): void {
    if (this.controls) {
      this.controls.update();
    }
    
    // Automatic Model Rotation
    if (this.model) {
      this.model.rotation.y += 0.007; 
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handles resizing of the container for responsiveness.
   */
  public handleResize(): void {
    if (!this.container || !this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Cleans up Three.js resources to prevent memory leaks.
   */
  public dispose(): void {
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

@Component({
  selector: 'app-webgl-viewer',
  templateUrl: './webgl-viewer.component.html',
  standalone: true,
   // Using OnPush for performance improvement since modelData is static after initialization
  changeDetection: ChangeDetectionStrategy.OnPush, 
  imports: [CommonModule],
  styleUrls: ['./webgl-viewer.component.css']
})
export class WebglViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('rendererContainer') rendererContainers!: QueryList<ElementRef>;

  // FIX: Updated the model path to a reliable, publicly hosted GLB asset (Duck)
  private readonly GLB_MODEL_PATH = '/glbfiles/googlelogo.glb';

  // Generating a larger set of data (15 instances)
  public modelData: ModelConfig[] = Array.from({ length: 15 }, (_, i) => ({
    index: i,
    displayName: `G logo ${i + 1}`,
    offer: `${30 - i}% Discount`,
    // FIX: Adjusted scale and position for the new Duck model for better visibility
    scale: [2, 2, 2], 
    pos: [0, 0, 0],
  }));

  // State
  private viewers: ThreeViewer[] = [];
  private animateId: number = 0;
  public isLoaded: boolean = false;

  private resizeListener = this.onResize.bind(this);

  // Inject logic that requires DOM stability using afterNextRender in the constructor
  constructor(private cdr: ChangeDetectorRef) {
    afterNextRender(() => {
        // FIX: Check if window is defined before accessing it, preventing SSR crash.
        if (typeof window !== 'undefined') {
            // Add global resize listener for responsiveness. 
            window.addEventListener('resize', this.resizeListener);
        }
    });
  }

  ngAfterViewInit(): void {
    // We must ensure the global THREE object exists before proceeding.
    this.checkThreeJsLoaded().then(() => {
        if (!this.rendererContainers.length) return; 
        
        // --- Key Optimization: Load model once and clone it for all viewers ---
        this.loadMasterModel().then(loadedModel => {
            // Initialize all viewers only after the model is loaded
              this.viewers = this.modelData.map((config, index) => {
              const container = this.rendererContainers.toArray()[index].nativeElement;
              const viewer = new ThreeViewer(config, container);
              // Pass the single loaded model to be cloned
              viewer.addModel(loadedModel);
              return viewer;
            });

            this.isLoaded = true;
            // IMPORTANT: Manually trigger change detection to hide the spinner
            this.cdr.markForCheck();
            this.animate();
        });
    });
  }

  /**
   * Helper function to wait for global Three.js objects to be defined (due to CDN loading).
   */
  private checkThreeJsLoaded(): Promise<void> {
    return new Promise(resolve => {
        const check = () => {
            // Check if all necessary globals (THREE, GLTFLoader, OrbitControls) are available
            if (typeof THREE !== 'undefined' && typeof GLTFLoader !== 'undefined' && typeof OrbitControls !== 'undefined') {
                resolve();
            } else {
                // Wait 50ms and check again
                setTimeout(check, 50);
            }
        };
        check();
    });
  }

  /**
   * 💡 Optimization: Loads the GLB file once and returns a promise for the 3D object.
   */
  private loadMasterModel(): Promise<any> { // returns Promise<THREE.Object3D>
    
    return new Promise((resolve, reject) => {
      // Access GLTFLoader via the global scope
      const loader = new GLTFLoader();

      loader.load(this.GLB_MODEL_PATH, (gltf: { scene: any }) => { // { scene: THREE.Object3D }
        // Resolve with the scene object which will be cloned later
        resolve(gltf.scene);
      }, undefined, (error: any) => {
        console.error('Error loading GLB model:', error);
        
        // Fallback for missing model: create a simple placeholder box
        const geometry = new THREE.BoxGeometry(20, 20, 20);
        const material = new THREE.MeshNormalMaterial();
        const fallbackMesh = new THREE.Mesh(geometry, material);
        resolve(fallbackMesh);
      });
    });
  }

  /**
   * Handles window resize event, propagating it to all viewers.
   */
  private onResize(): void {
    this.viewers.forEach(viewer => viewer.handleResize());
  }

  /**
   * The single requestAnimationFrame loop driving all viewers' updates.
   */
  animate = () => {
    this.animateId = requestAnimationFrame(this.animate);

    this.viewers.forEach(viewer => {
      viewer.update();
    });
  }

  /**
   * Cleanup: Essential for performance and preventing memory leaks.
   */
  ngOnDestroy(): void {
    if (this.animateId) {
      cancelAnimationFrame(this.animateId);
    }
    // Dispose of all viewer resources (renderers, controls)
    this.viewers.forEach(viewer => viewer.dispose());
    // Only attempt to remove the listener if window is defined (i.e., we are in the browser)
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.resizeListener);
    }
  }
}