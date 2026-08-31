/**
 * three-stdlib FBXLoader crashes on orphaned AnimationCurve nodes
 * (`Cannot read properties of undefined (reading 'curves')`).
 * Re-apply after npm install. Safe to run multiple times.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'node_modules/three-stdlib/loaders/FBXLoader.js',
  'node_modules/three-stdlib/loaders/FBXLoader.cjs',
  'node_modules/three/examples/jsm/loaders/FBXLoader.js',
];

function patchSource(src) {
  let out = src;
  let changed = false;

  const replacers = [
    [
      /if \(animationCurveRelationship\.match\(\/X\/\)\) \{\s*curveNodesMap\.get\(animationCurveID\)\.curves\["x"\]/g,
      'if (animationCurveRelationship.match(/X/) && curveNodesMap.has(animationCurveID)) {\n          curveNodesMap.get(animationCurveID).curves["x"]',
    ],
    [
      /if \(animationCurveRelationship\.match\(\/Y\/\)\) \{\s*curveNodesMap\.get\(animationCurveID\)\.curves\["y"\]/g,
      'if (animationCurveRelationship.match(/Y/) && curveNodesMap.has(animationCurveID)) {\n          curveNodesMap.get(animationCurveID).curves["y"]',
    ],
    [
      /if \(animationCurveRelationship\.match\(\/Z\/\)\) \{\s*curveNodesMap\.get\(animationCurveID\)\.curves\["z"\]/g,
      'if (animationCurveRelationship.match(/Z/) && curveNodesMap.has(animationCurveID)) {\n          curveNodesMap.get(animationCurveID).curves["z"]',
    ],
    // ESM three.js style with spaces
    [
      /if \( animationCurveRelationship\.match\( \/X\/ \) \) \{\s*curveNodesMap\.get\( animationCurveID \)\.curves\[ 'x' \] = animationCurve;/g,
      "if ( animationCurveRelationship.match( /X/ ) && curveNodesMap.has( animationCurveID ) ) {\n\n\t\t\t\t\tcurveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;",
    ],
    [
      /if \( animationCurveRelationship\.match\( \/Y\/ \) \) \{\s*curveNodesMap\.get\( animationCurveID \)\.curves\[ 'y' \] = animationCurve;/g,
      "if ( animationCurveRelationship.match( /Y/ ) && curveNodesMap.has( animationCurveID ) ) {\n\n\t\t\t\t\tcurveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;",
    ],
    [
      /if \( animationCurveRelationship\.match\( \/Z\/ \) \) \{\s*curveNodesMap\.get\( animationCurveID \)\.curves\[ 'z' \] = animationCurve;/g,
      "if ( animationCurveRelationship.match( /Z/ ) && curveNodesMap.has( animationCurveID ) ) {\n\n\t\t\t\t\tcurveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;",
    ],
  ];

  for (const [re, to] of replacers) {
    if (re.test(out)) {
      out = out.replace(re, to);
      changed = true;
    }
  }

  // Marker so we know patched version is active
  if (changed && !out.includes('AS_FBX_CURVES_GUARD')) {
    out = `/* AS_FBX_CURVES_GUARD */\n${out}`;
  }

  return { out, changed: changed || out.includes('AS_FBX_CURVES_GUARD') };
}

let patched = 0;
for (const rel of targets) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('AS_FBX_CURVES_GUARD') && src.includes('curveNodesMap.has(animationCurveID)')) {
    console.log(`[patch-fbx-loader] already patched: ${rel}`);
    continue;
  }
  const { out, changed } = patchSource(src);
  if (!changed && !src.includes('curveNodesMap.has(animationCurveID)')) {
    // Manual fallback for three-stdlib minified style already partially patched
    if (src.includes('match(/X/) && curveNodesMap.has')) {
      console.log(`[patch-fbx-loader] already guarded: ${rel}`);
      continue;
    }
    console.warn(`[patch-fbx-loader] pattern not found: ${rel}`);
    continue;
  }
  fs.writeFileSync(file, out.includes('AS_FBX_CURVES_GUARD') ? out : `/* AS_FBX_CURVES_GUARD */\n${out}`);
  patched += 1;
  console.log(`[patch-fbx-loader] patched: ${rel}`);
}

console.log(`[patch-fbx-loader] done (${patched} file(s) updated)`);
