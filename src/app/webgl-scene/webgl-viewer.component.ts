import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChildren, QueryList, ChangeDetectionStrategy, afterNextRender, ChangeDetectorRef } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RouterLinkWithHref } from "@angular/router";

// --- 1. Define Model Config Interface (Source of Truth) ---
interface ModelConfig {
  index: number;
  displayName: string;
  offer: string;
  scale: [number, number, number];
  pos: [number, number, number];
  modelPath: string; // Added to generalize the model loading
}

/**
 * Encapsulates the complete logic for a single Three.js viewer instance.
 */
class ThreeViewer {
  private config: ModelConfig;
  // Use specific types for better safety and IntelliSense
  public renderer: THREE.WebGLRenderer; 
  private camera: THREE.PerspectiveCamera; 
  private scene: THREE.Scene; 
  public controls!: OrbitControls; 
  public model: THREE.Object3D | null = null; 
  private container: HTMLElement;

  constructor(config: ModelConfig, container: HTMLElement) {
    this.config = config;
    this.container = container;

    if (typeof THREE === 'undefined') {
      console.error("THREE.js is not available in the global scope.");
      // Throwing an error here prevents further Three.js initialization
      throw new Error("Three.js not loaded.");
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
    this.camera.position.z = 2.5;

    // 2. Controls
    if (typeof OrbitControls !== 'undefined') {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.set(0, 0, 0);
    }

    // 3. Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  /**
   * Clones the pre-loaded model to reuse resources.
   * @param loadedModel The scene object loaded from the GLB file.
   */
  public addModel(loadedModel: THREE.Object3D): void { 
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
    // Dispose of the renderer and remove its canvas from the DOM
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    // Note: Scene and Geometry/Materials are usually handled by the renderer and garbage collector,
    // but complex scenes might require explicit disposal of materials/geometries.
  }
}


@Component({
  selector: 'app-webgl-viewer',
  templateUrl: './webgl-viewer.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, 
  imports: [CommonModule, RouterLinkWithHref],
  styleUrls: ['./webgl-viewer.component.css']
})
export class WebglViewerComponent implements AfterViewInit, OnDestroy {
  // Combine all containers into one QueryList for simpler processing
  @ViewChildren('rendererContainer, rendererContainer1') allRendererContainers!: QueryList<ElementRef>;
  
  // Use constants for paths
  private readonly GLB_MODEL_PATH_G = '/glbfiles/googlelogo.glb';
  private readonly GLB_MODEL_PATH_EDGE = '/glbfiles/edge.glb';
  private readonly GLB_MODEL_PATH_OPER = '/glbfiles/opera.glb';

  // State
  private viewers: ThreeViewer[] = [];
  private animateId: number = 0;
  public isLoaded: boolean = false;

  // Combine model data into a single, cohesive array for simpler iteration
  public allModelConfigs: ModelConfig[] = [
    // Google Logo Models (10 instances)
    ...Array.from({ length: 6 }, (_, i) => ({
      index: 1 + i,
      displayName: `G logo ${i + 1}`,
      offer: `${30 - i}% Discount`,
      scale: [2, 2, 2] as [number, number, number], 
      pos: [0, 0, 0] as [number, number, number],
      modelPath: this.GLB_MODEL_PATH_G,
    })),
    // Edge Logo Models (10 instances)
    ...Array.from({ length: 6 }, (_, i) => ({
      index: 6 + i,
      displayName: `Edge logo ${7 + i}`,
      offer: `${10 + i}% Off`,
      scale: [2, 2, 2] as [number, number, number], 
      pos: [0, 0, 0] as [number, number, number],
      modelPath: this.GLB_MODEL_PATH_EDGE,
    })),
    // Opera Logo Models (1 instances)
    ...Array.from({ length: 4 }, (_, i) => ({
      index: 12 + i,
      displayName: `Opera ${13 + i}`,
      offer: `${10 + i}% Off`,
      scale: [1, 1, 1] as [number, number, number], 
      pos: [0, 0, 0] as [number, number, number],
      modelPath: this.GLB_MODEL_PATH_OPER,
    })),
  ];

  private resizeListener = this.onResize.bind(this);

  constructor(private cdr: ChangeDetectorRef) {
    afterNextRender(() => {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this.resizeListener);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      // 1. Wait for Three.js to be fully loaded
      await this.checkThreeJsLoaded();

      // 2. Map model paths to a Set of unique paths
      const uniqueModelPaths = Array.from(new Set(this.allModelConfigs.map(c => c.modelPath)));
      
      // 3. Load all unique master models concurrently
      const modelPromises = uniqueModelPaths.map(path => this.loadModel(path));
      const loadedModels = await Promise.all(modelPromises);
      
      // Map the loaded models back to their paths for quick access
      const masterModels = new Map<string, THREE.Object3D>();
      uniqueModelPaths.forEach((path, index) => {
        masterModels.set(path, loadedModels[index]);
      });

      const containerElements = this.allRendererContainers.toArray().map(el => el.nativeElement);

      // Guard: Ensure we have enough containers for all configs
      if (containerElements.length < this.allModelConfigs.length) {
          console.error(`Missing ${this.allModelConfigs.length - containerElements.length} DOM containers for models.`);
          return;
      }

      // 4. Initialize all viewers using the loaded master models
      this.viewers = this.allModelConfigs.map((config, index) => {
        const container = containerElements[index];
        const masterModel = masterModels.get(config.modelPath);
        
        const viewer = new ThreeViewer(config, container);
        // Add the cloned model
        if (masterModel) {
            viewer.addModel(masterModel);
        }
        return viewer;
      });

      // 5. Start animation and update state
      this.isLoaded = true;
      this.cdr.markForCheck(); // IMPORTANT: Trigger change detection
      this.animate();

    } catch (error) {
      console.error("Initialization failed:", error);
    }
  }

  /**
   * Helper function to wait for global Three.js objects to be defined.
   */
  private checkThreeJsLoaded(): Promise<void> {
    return new Promise(resolve => {
        const check = () => {
            if (typeof THREE !== 'undefined' && typeof GLTFLoader !== 'undefined' && typeof OrbitControls !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
  }

  /**
   * 💡 Optimized: Loads any GLB file once and returns a promise for the 3D object.
   */
  private loadModel(path: string): Promise<THREE.Object3D> { 
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();

      loader.load(path, (gltf) => {
        resolve(gltf.scene);
      }, undefined, (error) => {
        console.warn(`Error loading GLB model at ${path}:`, error);
        
        // Fallback: create a small placeholder box
        const geometry = new THREE.BoxGeometry(1, 1, 1);
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
    this.viewers.forEach(viewer => viewer.dispose());
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}