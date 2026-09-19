import * as THREE from 'three';

/** Treat the shipped CC0 maps as authored surfaces, with restrained highlights. */
export function finishRiggedMaterial(material: THREE.MeshStandardMaterial, female: boolean, chest: { value: number }) {
  const skin = material.name.endsWith('body');
  const hair = /short0|ponytail|bob0/u.test(material.name);
  const eyes = material.name.includes('high-poly');
  const brows = /eyebrow/u.test(material.name);
  const fabric = /^(Blazer|IvoryShirt|Tie)(?:\.\d+)?$/u.test(material.name);
  const blazer = /^Blazer(?:\.\d+)?$/u.test(material.name);
  material.roughness = skin ? .74 : eyes ? .38 : hair ? 1 : .94;
  material.envMapIntensity = eyes ? .16 : hair ? .035 : .13;
  if (skin) {
    material.color.set('#f5e5d7');
    // Preserve texture registration: its fine luminance variations provide
    // restrained surface relief instead of adding arbitrary skin-colour noise.
    material.bumpMap = material.map; material.bumpScale = .0022;
  }
  if (eyes) material.color.set('#f0ece2');
  if (/teeth/u.test(material.name)) material.color.set('#d4c9b7');
  if (hair) {
    material.color.set('#ffffff'); material.alphaTest = female ? .12 : .1;
    // Partial MSAA coverage across overlapping hair cards creates bright pinholes
    // where the scalp/background leaks through. Keep the filtered alpha cutout
    // but make surviving fibres opaque; their colour remains dark and textured.
    material.alphaToCoverage = false;
  }
  if (/glasses/u.test(material.name)) {
    material.map = null; material.color.set('#11171a');
    material.metalness = 0; material.roughness = .94; material.envMapIntensity = .02;
  }
  if (/eyebrow/u.test(material.name)) {
    material.color.set('#ffffff'); material.alphaTest = .06; material.alphaToCoverage = false;
    material.transparent = true; material.opacity = female ? .92 : .85; material.depthWrite = false;
  }
  if (blazer) material.color.set(female ? '#58413c' : '#1d3040');
  if (/^IvoryShirt(?:\.\d+)?$/u.test(material.name)) material.color.set('#cdc6b9');
  if (/^Tie(?:\.\d+)?$/u.test(material.name)) material.color.set('#2a3437');
  if (!skin && !hair && !fabric && !brows && !eyes) return;
  material.onBeforeCompile = shader => {
    shader.uniforms.conclaviaChestExpansion = chest;
    shader.vertexShader = 'uniform float conclaviaChestExpansion;\nvarying vec3 conclaviaSurface;\n' + shader.vertexShader;
    shader.fragmentShader = 'varying vec3 conclaviaSurface;\n' + shader.fragmentShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      conclaviaSurface = position;
      float chest = smoothstep(1.10, 1.24, position.y) * (1.0 - smoothstep(1.36, 1.45, position.y));
      chest *= (1.0 - smoothstep(0.15, 0.25, abs(position.x))) * smoothstep(-0.015, 0.04, position.z);
      transformed.z += chest * conclaviaChestExpansion;`);
    if (hair) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(.0001)), vec3(.72)) * ${female ? 'vec3(.5,.33,.20)' : 'vec3(.26,.20,.15)'};`);
      // The source is a layered card groom, not a continuous scalp. Strong
      // card-normal lighting turns each polygon into a visible tile; retain
      // its photographic strand variation while softening that facet contrast.
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        outgoingLight = mix(diffuseColor.rgb * 1.2, outgoingLight, .28);
        #include <opaque_fragment>`);
    }
    if (brows) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = vec3(.024,.016,.010);`);
    if (eyes) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float iris = 1.0 - smoothstep(.12,.43,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      diffuseColor.rgb *= 1.0 - iris * .22;`);
    if (fabric) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 threadPosition = conclaviaSurface * 1120.0;
      float footprint = max(length(dFdx(threadPosition)), length(dFdy(threadPosition)));
      float weave = sin(threadPosition.x * 1.35 + threadPosition.y * .7) * sin(threadPosition.y);
      diffuseColor.rgb *= 0.97 + 0.016 * weave * (1.0 - smoothstep(.7, 2.2, footprint));`);
  };
  material.customProgramCacheKey = () => `conclavia-surface-v4-${skin ? 'skin' : hair ? female ? 'hair-female' : 'hair-male' : brows ? 'brows' : eyes ? 'eyes' : 'fabric'}`;
}
