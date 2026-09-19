import * as THREE from "three";
import { portraitFrame, type PortraitPose } from "./portrait-animation";
import { portraitIdleFrame, portraitIdleOffset } from "./portrait-idle";
import { advancePortraitExpression, advancePortraitGesture, advancePortraitMouth, advancePortraitPosture, initialPortraitPosture, portraitArmPoint, portraitBodyFrame, portraitBodyOffset } from "./portrait-motion";

// Coordinates are in each 627px atlas cell. Feature edits are sampled ONLY
// inside feathered eyes/mouth masks: generated clothing/background is never used.
const landmarks = [
  { mouth: [313, 269], editedMouth: [313, 269], cavity: 16, lip: [34, 2, -4, 31], featureSlope: 0, eyes: [278, 187, 356, 194], editedEyes: [278, 191, 356, 197] },
  { mouth: [325, 255], editedMouth: [323, 253], cavity: 14, lip: [33, -4.5, -6, 29], featureSlope: -3, eyes: [277, 183, 351, 177], editedEyes: [277, 188, 351, 184] },
];

const fragmentShader = `
precision highp float;
uniform sampler2D base;
uniform sampler2D features;
uniform float aspect, row, tilt, blink, mouthOpen, mouthWidth, brow, smile, speechActivity;
uniform vec3 bodyMotion, idleMotion;
uniform vec2 mouth0, editMouth0;
uniform float mouthCavity, featureSlope;
uniform vec4 lipShape;
uniform vec4 eyes0, editEyes0;
varying vec2 portraitUv;
float mask(vec2 p, vec2 center, vec2 radius) {
  return 1. - smoothstep(.68, 1., length((p-center)/radius));
}
vec4 atlas(sampler2D tex, vec2 p, float col) {
  // Clamp to this cell, not the full atlas: adjacent characters can never bleed.
  p = clamp(p, vec2(.0008), vec2(.9992));
  return texture2D(tex, vec2((p.x+col)*.5, 1.-(p.y+row)*.5));
}
vec2 bodyOffset(vec2 p) {
  // Same forward field as portraitBodyOffset: no movement above the neck or
  // at the waist crop, and no separate pose/face to blend into the portrait.
  float weight=smoothstep(.55,.73,p.y)*(1.-smoothstep(.78,1.,p.y));
  vec2 shoulderDistance=(p-vec2(.22,.65))/vec2(.34,.32);
  float shoulder=exp(-dot(shoulderDistance,shoulderDistance));
  return vec2(-(p.y-.97)*bodyMotion.x+(p.x-.5)*bodyMotion.z*1.4,
    (p.x-.5)*bodyMotion.x-bodyMotion.y*shoulder-bodyMotion.z)*weight;
}
vec2 idleOffset(vec2 p) {
  float weight=1.-smoothstep(.50,.64,p.y);
  vec2 d=p-vec2(.5,.55);
  float c=cos(idleMotion.z), s=sin(idleMotion.z);
  return (idleMotion.xy+vec2(d.x*(c-1.)-d.y*s,d.x*s+d.y*(c-1.)))*weight;
}
vec3 pose(vec2 p, float col, vec2 mouth, vec2 editedMouth, vec4 eyes, vec4 editedEyes) {
  vec2 center = vec2(mouth.x, .30);
  // One stable face for the entire gesture, with only local idle movement.
  float head = mask(p, vec2(mouth.x,.30), vec2(.24,.31));
  vec2 d = p-center;
  p += vec2(-d.y,d.x)*tilt*head;
  vec2 q=p;
  // Local brow and mouth-corner deformations keep the original skin texture.
  q.y -= brow * (mask(p,eyes.xy-vec2(0.,.039),vec2(.056,.028)) + mask(p,eyes.zw-vec2(0.,.039),vec2(.056,.028)));
  // Keep the listening expression, but relax its smile during a phrase.
  // Activity follows voice energy, so closed consonants do not grin again.
  float speakingSmile=mix(smile,min(smile,-.001),speechActivity);
  q.y += speakingSmile * (mask(p,mouth-vec2(.046,0.),vec2(.036,.028)) + mask(p,mouth+vec2(.046,0.),vec2(.036,.028)));
  float lipT=0., lipDistance=0., gap=0.;
  if(mouthOpen > .01) {
    // Apply the restrained width adjustment to lips AND corners, with a
    // bounded monotonic return to the cheek. Clamping displacement separately
    // leaves a second smile; unrestricted scaling can sample the backdrop.
    float x=q.x-mouth.x;
    float widthWeight=(1.-smoothstep(.024,.065,abs(q.y-mouth.y)))*smoothstep(-.023,-.011,q.y-mouth.y);
    float width=mix(1.,mouthWidth,widthWeight);
    float inner=.064*width, outer=.083;
    float sourceX=abs(x)<inner ? abs(x)/width
      : mix(.064,outer,clamp((abs(x)-inner)/(outer-inner),0.,1.));
    if(abs(x)<outer) q.x=mouth.x+sign(x)*sourceX;
    // Separate the upper lip, lower lip and broad jaw response. The mouth
    // opens around its existing seam rather than dropping one painted flap.
    lipT=clamp((q.x-mouth.x)/lipShape.x,-1.,1.);
    float seam=mouth.y+lipShape.y*lipT+lipShape.z*lipT*lipT;
    // Round the aperture around the centre, not by dragging the corners
    // inward. O/U share the conservative surface width of the resting lips.
    float rounding=clamp((1.-mouthWidth)/.10,0.,1.);
    float aperture=pow(max(0.,1.-lipT*lipT),mix(1.15,2.15,rounding));
    gap=mouthCavity*.80*mouthOpen*aperture;
    float upperLift=min(gap*.34,mouthOpen*(.0035+.0030*rounding)*aperture);
    float lowerDrop=max(0.,gap-upperLift);
    float upperEdge=seam-upperLift;
    float lowerEdge=seam+lowerDrop;
    lipDistance=q.y-upperEdge;
    if(q.y<upperEdge) {
      // This influence ends below the nose. Preserve the original upper lip
      // texture and let the short philtrum tissue take up its small travel.
      q.y+=upperLift*smoothstep(-.022,-.008,q.y-mouth.y);
    } else if(q.y>lowerEdge) {
      float distance=q.y-lowerEdge;
      float jaw=mouthOpen*.007*mask(p,mouth+vec2(0.,.067),vec2(.115,.09));
      q.y-=mix(lowerDrop,jaw,smoothstep(.006,.075,distance));
    } else {
      q.y=seam;
    }
  }
  vec3 color=atlas(base,q,col).rgb;
  if(blink > .001) {
    // A descending upper lid hides the iris; cross-fading entire eyes leaves
    // a translucent pupil visible through the closed eyelid mid-blink.
    vec2 eyeCenters[2]; eyeCenters[0]=eyes.xy; eyeCenters[1]=eyes.zw;
    vec2 edits[2]; edits[0]=editedEyes.xy; edits[1]=editedEyes.zw;
    for(int i=0;i<2;i++) {
      vec2 local=p-eyeCenters[i];
      float arc=pow(clamp(local.x/.038,-1.,1.),2.)*.009*(1.-blink);
      float edge=mix(-.024,.042,blink)+arc;
      float lid=1.-smoothstep(edge-.0015,edge+.0015,local.y);
      vec4 closed=atlas(features,local+edits[i],col);
      float eyeMask=mask(p,eyeCenters[i],vec2(.043,.024));
      color=mix(color,closed.rgb,eyeMask*lid*closed.a);
    }
  }
  if(gap > .0001) {
    // Sample only teeth and the oral cavity from the speaking texture. Skin
    // and lip colour come entirely from the resting portrait, avoiding a
    // rectangular pasted-on patch or inflated lower lip on quiet syllables.
    float height=p.y-mouth.y;
    float innerY=.0016+min(height,.005)*1.4+max(0.,height-.005)*.8+featureSlope*lipT;
    vec2 uv=editedMouth+vec2(lipT*lipShape.w,clamp(innerY,.0016,mouthCavity-.0008));
    vec4 speech=atlas(features,uv,col);
    vec3 shadow=atlas(features,editedMouth+vec2(lipT*lipShape.w,.010),col).rgb;
    // The upper lip first uncovers the cavity, then the registered teeth.
    // A tiny opening must not flash a full bright dental strip. Teeth remain
    // attached to the upper jaw instead of stretching with the lower lip.
    float reveal=smoothstep(.0015,.007,gap)*(1.-smoothstep(.50,.95,abs(lipT)));
    speech.rgb=mix(shadow,speech.rgb,reveal*smoothstep(0.,.002,innerY));
    speech.rgb*=mix(.65,1.,smoothstep(0.,.004,lipDistance));
    float feather=.0009;
    float cavityMask=smoothstep(-feather,feather,lipDistance)
      *(1.-smoothstep(gap-feather,gap+feather,lipDistance))
      *smoothstep(0.,.002,gap);
    color=mix(color,speech.rgb,cavityMask*speech.a);
  }
  return color;
}
void main() {
  vec2 p=vec2(portraitUv.x,1.-portraitUv.y);
  if(aspect>1.) p.x=(p.x-.5)*aspect+.5;
  else p.y=(p.y-.5)/aspect+.5;
  if(p.x<0. || p.x>1. || p.y<0. || p.y>1.) { gl_FragColor=vec4(.9843,.9608,.9176,1.); return; }
  // Invert the bounded forward skin field to sample the stable base atlas.
  vec2 source=p;
  for(int i=0;i<5;i++) source=p-bodyOffset(source)-idleOffset(source);
  gl_FragColor=vec4(pose(source,0.,mouth0,editMouth0,eyes0,editEyes0),1.);
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
  const a = landmarks[female ? 1 : 0];
  const v2 = (v: number[]) => new THREE.Vector2(v[0]/627,v[1]/627);
  const v4 = (v: number[]) => new THREE.Vector4(v[0]/627,v[1]/627,v[2]/627,v[3]/627);
  const uniforms = {
    base:{value:textures[0]}, features:{value:textures[1]}, armArt:{value:textures[2]}, aspect:{value:1}, row:{value:female ? 1 : 0},
    hand:{value:getPose().gesture === "hand_raise" ? 1 : 0}, tilt:{value:0}, blink:{value:0},
    mouthOpen:{value:0}, mouthWidth:{value:1}, brow:{value:0}, smile:{value:0}, speechActivity:{value:0},
    bodyMotion:{value:new THREE.Vector3()}, idleMotion:{value:new THREE.Vector3()}, armOffset:{value:new THREE.Vector2()}, armLean:{value:0}, armPivot:{value:new THREE.Vector2()},
    mouth0:{value:v2(a.mouth)}, editMouth0:{value:v2(a.editedMouth)},
    mouthCavity:{value:a.cavity/627}, lipShape:{value:v4(a.lip)}, featureSlope:{value:a.featureSlope/627},
    eyes0:{value:v4(a.eyes)}, editEyes0:{value:v4(a.editedEyes)},
  };
  const material = new THREE.ShaderMaterial({ uniforms, fragmentShader,
    vertexShader:"varying vec2 portraitUv; void main(){ portraitUv=position.xy*.5+.5; gl_Position=vec4(position.xy,0.,1.); }" });
  const geometry = new THREE.PlaneGeometry(2,2);
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry,material));
  const camera = new THREE.Camera();
  // A dense planar skin carries the actual sleeve, cuff and hand pixels along
  // an elbow trajectory. Alpha remains fully opaque inside the moving arm.
  const armGeometry=new THREE.PlaneGeometry(270,480,36,64);
  const source=Float32Array.from(armGeometry.attributes.position.array);
  for(let i=0;i<source.length;i+=3) { source[i]+=175; source[i+1]=340-source[i+1]; }
  const uv=armGeometry.attributes.uv;
  for(let i=0;i<uv.count;i++) uv.setXY(i,source[i*3]/627,1-source[i*3+1]/627);
  const armMaterial=new THREE.ShaderMaterial({
    uniforms, transparent:true, depthTest:false, side:THREE.DoubleSide,
    vertexShader:`varying vec2 sourceUv, portraitPosition; uniform float aspect, armLean; uniform vec2 armOffset, armPivot;
      void main(){ sourceUv=uv; vec2 d=position.xy-armPivot;
        vec2 p=armPivot+mat2(cos(armLean),sin(armLean),-sin(armLean),cos(armLean))*d+armOffset;
        portraitPosition=p; if(aspect>1.)p.x/=aspect;else p.y*=aspect;gl_Position=vec4(p,0.,1.); }`,
    fragmentShader:`precision highp float; varying vec2 sourceUv, portraitPosition; uniform sampler2D armArt; uniform float row;
      void main(){ if(abs(portraitPosition.x)>1. || abs(portraitPosition.y)>1.) discard; vec2 p=vec2(sourceUv.x,1.-sourceUv.y);
        vec4 color=texture2D(armArt,vec2((p.x+1.)*.5,1.-(p.y+row)*.5));
        float alpha=color.a;
        if(alpha<.005)discard;gl_FragColor=vec4(color.rgb,alpha);
      }`,
  });
  const armMesh=new THREE.Mesh(armGeometry,armMaterial);armMesh.frustumCulled=false;armMesh.renderOrder=1;scene.add(armMesh);
  const updateArm=(raised:number)=>{
    const position=armGeometry.attributes.position;
    for(let i=0;i<position.count;i++) {
      const [x,y]=portraitArmPoint(source[i*3],source[i*3+1],raised,female);
      position.setXYZ(i,x/627*2-1,1-y/627*2,0);
    }
    position.needsUpdate=true;
  };
  updateArm(uniforms.hand.value);
  const disposeGpu = () => {
    armGeometry.dispose(); armMaterial.dispose();
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
  let animationSeconds=0;
  // Browsers can suspend RAF entirely while hidden. Reset on the visibility
  // event as well, without relying on a final hidden animation callback.
  const resetClock=()=>{ last=0; };
  document.addEventListener("visibilitychange",resetClock);
  let gestureMotion={position:uniforms.hand.value,velocity:0};
  let posture=initialPortraitPosture(uniforms.hand.value);
  let mouthMotion={open:0,width:1};
  let speechActivity=0;
  const initialFrame=portraitFrame(getPose(),0,motion.matches);
  let expression={brow:initialFrame.brow,smile:initialFrame.smile};
  renderer.setAnimationLoop((ms: number) => {
    if(document.hidden) { last=0; return; }
    // Advance visible time only, so returning to a hidden tab does not jump
    // to another posture (or replay all the movements missed in the meantime).
    const dt=last ? Math.max(0,Math.min((ms-last)/1000,.1)) : 0; last=ms;
    animationSeconds+=dt;
    const pose=getPose(); const frame=portraitFrame(pose,animationSeconds,motion.matches);
    for (const key of ["blink","tilt"] as const) uniforms[key].value=frame[key];
    expression=advancePortraitExpression(expression,frame,dt,motion.matches);
    uniforms.brow.value=expression.brow;
    uniforms.smile.value=expression.smile;
    const target=pose.gesture === "hand_raise" ? 1 : 0;
    gestureMotion=advancePortraitGesture(gestureMotion,target,dt,motion.matches);
    posture=advancePortraitPosture(posture,target,pose.voiceLevel,dt,motion.matches);
    const body=portraitBodyFrame(posture,animationSeconds,frame.breath,motion.matches);
    const idle=portraitIdleFrame(animationSeconds,Math.max(posture.speech,posture.shoulder.position,posture.torso.position),motion.matches);
    body.shoulder+=idle.shoulder;
    uniforms.bodyMotion.value.set(body.lean,body.shoulder,body.breath);
    uniforms.idleMotion.value.set(idle.x,idle.y,idle.roll);
    // Carry the whole forearm from its deformed elbow attachment. This also
    // keeps the sleeve connected when breathing or settling at a fixed pose.
    const elbow=portraitArmPoint(female ? 142 : 143,502,gestureMotion.position,female);
    const offset=portraitBodyOffset(elbow[0]/627,elbow[1]/627,body);
    const idleAnchor=portraitIdleOffset(elbow[0]/627,elbow[1]/627,idle);
    uniforms.armPivot.value.set(elbow[0]/627*2-1,1-elbow[1]/627*2);
    uniforms.armOffset.value.set((offset[0]+idleAnchor[0])*2,-(offset[1]+idleAnchor[1])*2);
    uniforms.armLean.value=-body.lean*.35;
    if (uniforms.hand.value !== gestureMotion.position) updateArm(gestureMotion.position);
    uniforms.hand.value=gestureMotion.position;
    mouthMotion=advancePortraitMouth(mouthMotion,frame,dt);
    uniforms.mouthOpen.value=mouthMotion.open;
    uniforms.mouthWidth.value=mouthMotion.width;
    speechActivity=frame.speechActivity === 0 ? 0 : speechActivity+(frame.speechActivity-speechActivity)*(1-Math.exp(-dt/.045));
    uniforms.speechActivity.value=speechActivity;
    renderer.render(scene,camera);
    element.dataset.rendererReady="true";
    element.dataset.renderedViseme=frame.mouthOpen ? pose.viseme : "rest";
    element.dataset.mouthOpen=String(frame.mouthOpen);
    element.dataset.renderedMouthOpen=mouthMotion.open.toFixed(4);
    element.dataset.handProgress=gestureMotion.position.toFixed(5);
    element.dataset.handVelocity=gestureMotion.velocity.toFixed(5);
    element.dataset.handAnimation="articulated";
    element.dataset.blink=frame.blink.toFixed(3);
    element.dataset.expressionBrow=expression.brow.toFixed(6);
    element.dataset.expressionSmile=expression.smile.toFixed(6);
    element.dataset.handRaised=String(uniforms.hand.value === 1);
    element.dataset.reducedMotion=String(motion.matches);
    element.dataset.headTilt=frame.tilt.toFixed(5);
    element.dataset.shoulderLift=body.shoulder.toFixed(5);
    element.dataset.bodyLean=body.lean.toFixed(5);
    element.dataset.chestBreath=body.breath.toFixed(5);
    element.dataset.idleShiftX=idle.x.toFixed(5);
    element.dataset.idleShiftY=idle.y.toFixed(5);
    element.dataset.idleRoll=idle.roll.toFixed(5);
    element.dataset.idleShoulder=idle.shoulder.toFixed(5);
    element.dataset.animationSeconds=animationSeconds.toFixed(3);
  });
  return () => {
    document.removeEventListener("visibilitychange",resetClock);
    observer.disconnect(); renderer.setAnimationLoop(null);
    disposeGpu();
    canvas.remove();
  };
}
