import * as THREE from "three";
import { portraitFrame, type PortraitPose } from "./portrait-animation";

// Coordinates are in each 627px atlas cell. Feature edits are sampled ONLY
// inside feathered eyes/mouth masks: generated clothing/background is never used.
const landmarks = [
  { mouth: [313, 269], editedMouth: [311, 280], eyes: [278, 187, 356, 194], editedEyes: [278, 192, 360, 201] },
  { mouth: [363, 273], editedMouth: [357, 281], eyes: [322, 188, 404, 197], editedEyes: [324, 194, 403, 204] },
  { mouth: [325, 255], editedMouth: [320, 267], eyes: [277, 183, 351, 177], editedEyes: [273, 188, 354, 184] },
  { mouth: [365, 256], editedMouth: [366, 268], eyes: [327, 182, 407, 185], editedEyes: [328, 188, 405, 191] },
];

const fragmentShader = `
precision highp float;
uniform sampler2D base;
uniform sampler2D features;
uniform float aspect, row, hand, tilt, breath, blink, mouthOpen, mouthWidth, brow, smile;
uniform vec2 mouth0, mouth1, editMouth0, editMouth1;
uniform vec4 eyes0, eyes1, editEyes0, editEyes1;
varying vec2 portraitUv;
float mask(vec2 p, vec2 center, vec2 radius) {
  return 1. - smoothstep(.68, 1., length((p-center)/radius));
}
vec4 atlas(sampler2D tex, vec2 p, float col) {
  // Clamp to this cell, not the full atlas: adjacent characters can never bleed.
  p = clamp(p, vec2(.0008), vec2(.9992));
  return texture2D(tex, vec2((p.x+col)*.5, 1.-(p.y+row)*.5));
}
vec3 pose(vec2 p, float col, vec2 mouth, vec2 editedMouth, vec4 eyes, vec4 editedEyes) {
  vec2 center = vec2(mouth.x, .30);
  // Register faces between the two photographic poses before blending.
  float head = mask(p, vec2(mix(mouth0.x,mouth1.x,hand),.30), vec2(.27,.38));
  p.x += (mouth.x-mix(mouth0.x,mouth1.x,hand))*head;
  vec2 d = p-center;
  p += vec2(-d.y,d.x)*tilt*head;
  p.y += breath * mask(p,vec2(.5,.65),vec2(.65,.65));
  vec2 q=p;
  // Local brow and mouth-corner deformations keep the original skin texture.
  q.y -= brow * (mask(p,eyes.xy-vec2(0.,.039),vec2(.056,.028)) + mask(p,eyes.zw-vec2(0.,.039),vec2(.056,.028)));
  q.y += smile * (mask(p,mouth-vec2(.046,0.),vec2(.036,.028)) + mask(p,mouth+vec2(.046,0.),vec2(.036,.028)));
  // Keep the backing-lip compression inside skin around the mouth. An
  // unrestricted inverse scale on U/O can sample beyond the jaw into backdrop.
  if(mouthOpen > .01) q.x += clamp((p.x-mouth.x)*(1./mouthWidth-1.),-.012,.012)*mask(p,mouth,vec2(.083,.031));
  vec3 color=atlas(base,q,col).rgb;
  if(blink > .001) {
    float eyeMask1=mask(p,eyes.xy,vec2(.043,.024));
    float eyeMask2=mask(p,eyes.zw,vec2(.043,.024));
    vec4 eye1=atlas(features,p-eyes.xy+editedEyes.xy,col);
    vec4 eye2=atlas(features,p-eyes.zw+editedEyes.zw,col);
    float close=smoothstep(.05,.65,blink);
    color=mix(color,eye1.rgb,eyeMask1*close*eye1.a);
    color=mix(color,eye2.rgb,eyeMask2*close*eye2.a);
  }
  if(mouthOpen > .01) {
    vec2 delta=p-mouth;
    vec2 scale=vec2(mouthWidth, .30+.70*mouthOpen);
    vec2 m=delta/scale;
    vec4 speech=atlas(features,editedMouth+m,col);
    float lipMask=mask(m,vec2(0.),vec2(.078,.047));
    color=mix(color,speech.rgb,lipMask*speech.a);
  }
  return color;
}
void main() {
  vec2 p=vec2(portraitUv.x,1.-portraitUv.y);
  if(aspect>1.) p.x=(p.x-.5)*aspect+.5;
  else p.y=(p.y-.5)/aspect+.5;
  if(p.x<0. || p.x>1. || p.y<0. || p.y>1.) { gl_FragColor=vec4(.9843,.9608,.9176,1.); return; }
  if(hand <= 0.) gl_FragColor=vec4(pose(p,0.,mouth0,editMouth0,eyes0,editEyes0),1.);
  else if(hand >= 1.) gl_FragColor=vec4(pose(p,1.,mouth1,editMouth1,eyes1,editEyes1),1.);
  else gl_FragColor=vec4(mix(pose(p,0.,mouth0,editMouth0,eyes0,editEyes0),pose(p,1.,mouth1,editMouth1,eyes1,editEyes1),hand),1.);
}`;

export function createPortraitRenderer(element: HTMLElement, images: HTMLImageElement[],
  female: boolean, getPose: () => PortraitPose) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power", preserveDrawingBuffer: true });
  const textures = images.map(image => {
    const t = new THREE.Texture(image); t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.NoToneMapping;
  const [a,b] = landmarks.slice(female ? 2 : 0, female ? 4 : 2);
  const v2 = (v: number[]) => new THREE.Vector2(v[0]/627,v[1]/627);
  const v4 = (v: number[]) => new THREE.Vector4(v[0]/627,v[1]/627,v[2]/627,v[3]/627);
  const uniforms = {
    base:{value:textures[0]}, features:{value:textures[1]}, aspect:{value:1}, row:{value:female ? 1 : 0},
    hand:{value:getPose().gesture === "hand_raise" ? 1 : 0}, tilt:{value:0}, breath:{value:0}, blink:{value:0},
    mouthOpen:{value:0}, mouthWidth:{value:1}, brow:{value:0}, smile:{value:0},
    mouth0:{value:v2(a.mouth)}, mouth1:{value:v2(b.mouth)}, editMouth0:{value:v2(a.editedMouth)}, editMouth1:{value:v2(b.editedMouth)},
    eyes0:{value:v4(a.eyes)}, eyes1:{value:v4(b.eyes)}, editEyes0:{value:v4(a.editedEyes)}, editEyes1:{value:v4(b.editedEyes)},
  };
  const material = new THREE.ShaderMaterial({ uniforms, fragmentShader,
    vertexShader:"varying vec2 portraitUv; void main(){ portraitUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }" });
  const geometry = new THREE.PlaneGeometry(2,2);
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry,material));
  const camera = new THREE.Camera();
  const disposeGpu = () => {
    geometry.dispose(); material.dispose(); textures.forEach(t=>t.dispose()); renderer.dispose();
    if(!renderer.getContext().isContextLost()) renderer.forceContextLoss();
  };
  let shaderFailed=false;
  renderer.debug.onShaderError=()=>{ shaderFailed=true; };
  // Compile/draw once inside the caller's promise so failure selects the visible
  // fallback instead of reporting a blank canvas as a ready renderer.
  try {
    renderer.setSize(1,1,false); renderer.render(scene,camera);
    if(shaderFailed) throw new Error("Portrait shader unavailable");
  } catch(error) { disposeGpu(); throw error; }
  const canvas = renderer.domElement; canvas.setAttribute("aria-hidden","true"); element.append(canvas);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const resize = () => {
    const {width,height}=element.getBoundingClientRect();
    if(width && height) { uniforms.aspect.value=width/height; renderer.setSize(width,height,false); }
  };
  const observer = new ResizeObserver(resize); observer.observe(element); resize();
  let last=0;
  renderer.setAnimationLoop((ms: number) => {
    if(document.hidden) { last=0; return; }
    const pose=getPose(); const frame=portraitFrame(pose,ms/1000,motion.matches);
    for (const key of ["mouthOpen","mouthWidth","blink","tilt","breath","brow","smile"] as const) uniforms[key].value=frame[key];
    const target=pose.gesture === "hand_raise" ? 1 : 0;
    const dt=last ? Math.min((ms-last)/1000,.1) : 0; last=ms;
    const step=dt/.28;
    uniforms.hand.value=motion.matches ? target : target>uniforms.hand.value ? Math.min(target,uniforms.hand.value+step) : Math.max(target,uniforms.hand.value-step);
    renderer.render(scene,camera);
    element.dataset.rendererReady="true";
    element.dataset.renderedViseme=frame.mouthOpen ? pose.viseme : "rest";
    element.dataset.mouthOpen=String(frame.mouthOpen);
    element.dataset.blink=frame.blink.toFixed(3);
    element.dataset.handRaised=String(uniforms.hand.value === 1);
    element.dataset.reducedMotion=String(motion.matches);
    element.dataset.headTilt=frame.tilt.toFixed(5);
  });
  return () => {
    observer.disconnect(); renderer.setAnimationLoop(null);
    disposeGpu();
    canvas.remove();
  };
}
