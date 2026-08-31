var pf = Object.defineProperty;
var mf = (n, t, e) => t in n ? pf(n, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[t] = e;
var G = (n, t, e) => mf(n, typeof t != "symbol" ? t + "" : t, e);
function gf(n, t) {
  for (var e = 0; e < t.length; e++) {
    const s = t[e];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const r in s)
        if (r !== "default" && !(r in n)) {
          const o = Object.getOwnPropertyDescriptor(s, r);
          o && Object.defineProperty(n, r, o.get ? o : {
            enumerable: !0,
            get: () => s[r]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
class bf {
  constructor() {
    G(this, "dims", []);
    G(this, "paddedDims", []);
    G(this, "layout", "x");
    G(this, "dataType", "Float32");
  }
  getByteSize() {
    let t = 1;
    for (const e of this.paddedDims)
      t *= e;
    return this.dataType === "Float32" ? t *= 4 : this.dataType === "Float16" && (t *= 2), t;
  }
}
class yf {
  constructor(t, e) {
    this.desc = t, this.data = e;
  }
}
class wf {
  constructor(t) {
    G(this, "offset", 0);
    this._view = t;
  }
  read(t) {
    const e = this._view, s = this.offset;
    switch (this.offset += t, t) {
      case 1:
        return e.getUint8(s);
      case 2:
        return e.getUint16(s, !0);
      case 4:
        return e.getUint32(s, !0);
      case 8:
        return Number(e.getBigUint64(s, !0));
      default:
        throw new Error("unsupported read size");
    }
  }
}
function xf(n) {
  const t = new Uint8Array(n), e = new wf(new DataView(n));
  if (e.read(2) !== 16855)
    throw new Error("invalid or corrupted weights blob");
  const r = e.read(1);
  if (e.read(1), r !== 2)
    throw new Error("unsupported weights blob version");
  const o = e.read(8);
  e.offset = o;
  const i = e.read(4), a = /* @__PURE__ */ new Map();
  for (let l = 0; l < i; ++l) {
    const u = new bf(), c = e.read(2), h = new TextDecoder().decode(
      t.subarray(e.offset, e.offset + c)
    );
    e.offset += c;
    const f = e.read(1);
    for (let b = 0; b < f; ++b)
      u.dims.push(e.read(4));
    u.paddedDims = [...u.dims], new TextDecoder().decode(
      t.subarray(e.offset, e.offset + f)
    ) === "oihw" && (u.layout = "oihw"), e.offset += f;
    const p = String.fromCharCode(e.read(1));
    if (p === "f")
      u.dataType = "Float32";
    else if (p === "h")
      u.dataType = "Float16";
    else
      throw new Error("invalid tensor data type");
    const g = e.read(8), m = t.slice(
      g,
      g + u.getByteSize()
    );
    a.set(h, new yf(u, m));
  }
  return a;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Sf = 1e-7, vf = 1e-4;
class If {
  constructor(t, e) {
    this.backend = t, this.dataMover = e, this.data = /* @__PURE__ */ new WeakMap(), this.dataIdsCount = 0;
  }
  get(t) {
    return this.data.has(t) || this.dataMover.moveData(this.backend, t), this.data.get(t);
  }
  set(t, e) {
    this.dataIdsCount++, this.data.set(t, e);
  }
  has(t) {
    return this.data.has(t);
  }
  delete(t) {
    return this.dataIdsCount--, this.data.delete(t);
  }
  numDataIds() {
    return this.dataIdsCount;
  }
}
class Bl {
  refCount(t) {
    return Bt("refCount");
  }
  incRef(t) {
    return Bt("incRef");
  }
  timerAvailable() {
    return !0;
  }
  time(t) {
    return Bt("time");
  }
  read(t) {
    return Bt("read");
  }
  readSync(t) {
    return Bt("readSync");
  }
  readToGPU(t, e) {
    return Bt("readToGPU");
  }
  numDataIds() {
    return Bt("numDataIds");
  }
  disposeData(t, e) {
    return Bt("disposeData");
  }
  write(t, e, s) {
    return Bt("write");
  }
  move(t, e, s, r, o) {
    return Bt("move");
  }
  createTensorFromGPUData(t, e, s) {
    return Bt("createTensorFromGPUData");
  }
  memory() {
    return Bt("memory");
  }
  /** Returns the highest precision for floats in bits (e.g. 16 or 32) */
  floatPrecision() {
    return Bt("floatPrecision");
  }
  /** Returns the smallest representable number.  */
  epsilon() {
    return this.floatPrecision() === 32 ? Sf : vf;
  }
  dispose() {
    return Bt("dispose");
  }
}
function Bt(n) {
  throw new Error(`'${n}' not yet implemented or not found in the registry. This kernel may not be supported by the tfjs backend you have chosen`);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $f(n) {
  let t = n.length, e = 0;
  for (; t > 0; )
    e = Math.random() * t | 0, t--, En(n, t, e);
}
function En(n, t, e) {
  const s = n[t];
  n[t] = n[e], n[e] = s;
}
function Af(n) {
  let t = 0;
  for (let e = 0; e < n.length; e++)
    t += n[e];
  return t;
}
function w(n, t) {
  if (!n)
    throw new Error(typeof t == "string" ? t : t());
}
function Ef(n, t, e = "") {
  w(oe(n, t), () => e + ` Shapes ${n} and ${t} must match`);
}
function Fl(n) {
  w(n != null, () => "The input to the tensor constructor must be a non-null value.");
}
function z(n) {
  if (n.length === 0)
    return 1;
  let t = n[0];
  for (let e = 1; e < n.length; e++)
    t *= n[e];
  return t;
}
function oe(n, t) {
  if (n === t)
    return !0;
  if (n == null || t == null || n.length !== t.length)
    return !1;
  for (let e = 0; e < n.length; e++)
    if (n[e] !== t[e])
      return !1;
  return !0;
}
function Eo(n) {
  return n % 1 === 0;
}
function tr(n, t) {
  return t <= n.length ? n : n + " ".repeat(t - n.length);
}
function _f(n, t) {
  let e = 1, s = -1;
  for (let o = 0; o < n.length; ++o)
    if (n[o] >= 0)
      e *= n[o];
    else if (n[o] === -1) {
      if (s !== -1)
        throw Error(`Shapes can only have 1 implicit size. Found -1 at dim ${s} and dim ${o}`);
      s = o;
    } else if (n[o] < 0)
      throw Error(`Shapes can not be < 0. Found ${n[o]} at dim ${o}`);
  if (s === -1) {
    if (t > 0 && t !== e)
      throw Error(`Size(${t}) must match the product of shape ${n}`);
    return n;
  }
  if (e === 0)
    throw Error(`Cannot infer the missing size in [${n}] when there are 0 elements`);
  if (t % e !== 0)
    throw Error(`The implicit shape can't be a fractional number. Got ${t} / ${e}`);
  const r = n.slice();
  return r[s] = t / e, r;
}
function _s(n, t) {
  const e = t.length;
  return n = n == null ? t.map((s, r) => r) : [].concat(n), w(n.every((s) => s >= -e && s < e), () => `All values in axis param must be in range [-${e}, ${e}) but got axis ${n}`), w(n.every((s) => Eo(s)), () => `All values in axis param must be integers but got axis ${n}`), n.map((s) => s < 0 ? e + s : s);
}
function Cf(n, t) {
  const e = [], s = [], r = t != null && Array.isArray(t) && t.length === 0, o = t == null || r ? null : _s(t, n).sort();
  let i = 0;
  for (let a = 0; a < n.length; ++a) {
    if (o != null) {
      if (o[i] === a && n[a] !== 1)
        throw new Error(`Can't squeeze axis ${a} since its dim '${n[a]}' is not 1`);
      (o[i] == null || o[i] > a) && n[a] === 1 && (e.push(n[a]), s.push(a)), o[i] <= a && i++;
    }
    n[a] !== 1 && (e.push(n[a]), s.push(a));
  }
  return { newShape: e, keptDims: s };
}
function Rn(n, t) {
  return yt(n, t);
}
function yt(n, t) {
  let e = null;
  if (n == null || n === "float32")
    e = new Float32Array(t);
  else if (n === "int32")
    e = new Int32Array(t);
  else if (n === "bool")
    e = new Uint8Array(t);
  else if (n === "string")
    e = new Array(t);
  else
    throw new Error(`Unknown data type ${n}`);
  return e;
}
function kf(n, t) {
  for (let e = 0; e < n.length; e++) {
    const s = n[e];
    if (isNaN(s) || !isFinite(s))
      throw Error(`A tensor of type ${t} being uploaded contains ${s}.`);
  }
}
function Tf(n) {
  return n === "bool" || n === "complex64" || n === "float32" || n === "int32" || n === "string";
}
function _o(n) {
  if (n === "float32" || n === "int32")
    return 4;
  if (n === "complex64")
    return 8;
  if (n === "bool")
    return 1;
  throw new Error(`Unknown dtype ${n}`);
}
function Nf(n) {
  if (n == null)
    return 0;
  let t = 0;
  return n.forEach((e) => t += e.length), t;
}
function Fr(n) {
  return typeof n == "string" || n instanceof String;
}
function Df(n) {
  return typeof n == "boolean";
}
function Co(n) {
  return typeof n == "number";
}
function Cs(n) {
  return Array.isArray(n) ? Cs(n[0]) : n instanceof Float32Array ? "float32" : n instanceof Int32Array || n instanceof Uint8Array || n instanceof Uint8ClampedArray ? "int32" : Co(n) ? "float32" : Fr(n) ? "string" : Df(n) ? "bool" : "float32";
}
function ko(n) {
  return !!(n && n.constructor && n.call && n.apply);
}
function Kt(n) {
  const t = n.length;
  if (t < 2)
    return [];
  const e = new Array(t - 1);
  e[t - 2] = n[t - 1];
  for (let s = t - 3; s >= 0; --s)
    e[s] = e[s + 1] * n[s + 1];
  return e;
}
function zl(n, t, e, s = !1) {
  const r = new Array();
  if (t.length === 1) {
    const o = t[0] * (s ? 2 : 1);
    for (let i = 0; i < o; i++)
      r[i] = e[n + i];
  } else {
    const o = t[0], i = t.slice(1), a = i.reduce((l, u) => l * u) * (s ? 2 : 1);
    for (let l = 0; l < o; l++)
      r[l] = zl(n + l * a, i, e, s);
  }
  return r;
}
function pa(n, t, e = !1) {
  if (n.length === 0)
    return t[0];
  const s = n.reduce((r, o) => r * o) * (e ? 2 : 1);
  if (s === 0)
    return [];
  if (s !== t.length)
    throw new Error(`[${n}] does not match the input size ${t.length}${e ? " for a complex tensor" : ""}.`);
  return zl(0, n, t, e);
}
function ro(n, t) {
  if (Array.isArray(n))
    return n;
  if (t === "float32")
    return n instanceof Float32Array ? n : new Float32Array(n);
  if (t === "int32")
    return n instanceof Int32Array ? n : new Int32Array(n);
  if (t === "bool" || t === "string")
    return Uint8Array.from(new Int32Array(n));
  throw new Error(`Unknown dtype ${t}`);
}
function Ul(n, t) {
  const e = je(n, t);
  for (let s = 0; s < e.length; s++)
    e[s] = 1;
  return e;
}
function je(n, t) {
  if (t == null || t === "float32" || t === "complex64")
    return new Float32Array(n);
  if (t === "int32")
    return new Int32Array(n);
  if (t === "bool")
    return new Uint8Array(n);
  throw new Error(`Unknown data type ${t}`);
}
function Me(n) {
  n.forEach((t) => {
    w(Number.isInteger(t) && t >= 0, () => `Tensor must have a shape comprised of positive integers but got shape [${n}].`);
  });
}
function To(n, t, e) {
  if (t === 0)
    return 0;
  if (t === 1)
    return n[0];
  let s = n[n.length - 1];
  for (let r = 0; r < n.length - 1; ++r)
    s += e[r] * n[r];
  return s;
}
function oi(n, t, e) {
  if (t === 0)
    return [];
  if (t === 1)
    return [n];
  const s = new Array(t);
  for (let r = 0; r < s.length - 1; ++r)
    s[r] = Math.floor(n / e[r]), n -= s[r] * e[r];
  return s[s.length - 1] = n, s;
}
function ii(n) {
  return n && n.then && typeof n.then == "function";
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ma = "tfjsflags";
class Pf {
  // tslint:disable-next-line: no-any
  constructor(t) {
    this.global = t, this.flags = {}, this.flagRegistry = {}, this.urlFlags = {}, this.getQueryParams = Rf, this.populateURLFlags();
  }
  setPlatform(t, e) {
    this.platform != null && (V().getBool("IS_TEST") || V().getBool("PROD") || console.warn(`Platform ${this.platformName} has already been set. Overwriting the platform with ${t}.`)), this.platformName = t, this.platform = e;
  }
  registerFlag(t, e, s) {
    if (this.flagRegistry[t] = { evaluationFn: e, setHook: s }, this.urlFlags[t] != null) {
      const r = this.urlFlags[t];
      V().getBool("IS_TEST") || V().getBool("PROD") || console.warn(`Setting feature override from URL ${t}: ${r}.`), this.set(t, r);
    }
  }
  async getAsync(t) {
    return t in this.flags ? this.flags[t] : (this.flags[t] = await this.evaluateFlag(t), this.flags[t]);
  }
  get(t) {
    if (t in this.flags)
      return this.flags[t];
    const e = this.evaluateFlag(t);
    if (ii(e))
      throw new Error(`Flag ${t} cannot be synchronously evaluated. Please use getAsync() instead.`);
    return this.flags[t] = e, this.flags[t];
  }
  getNumber(t) {
    return this.get(t);
  }
  getBool(t) {
    return this.get(t);
  }
  getString(t) {
    return this.get(t);
  }
  getFlags() {
    return this.flags;
  }
  // For backwards compatibility.
  get features() {
    return this.flags;
  }
  set(t, e) {
    if (this.flagRegistry[t] == null)
      throw new Error(`Cannot set flag ${t} as it has not been registered.`);
    this.flags[t] = e, this.flagRegistry[t].setHook != null && this.flagRegistry[t].setHook(e);
  }
  evaluateFlag(t) {
    if (this.flagRegistry[t] == null)
      throw new Error(`Cannot evaluate flag '${t}': no evaluation function found.`);
    return this.flagRegistry[t].evaluationFn();
  }
  setFlags(t) {
    this.flags = Object.assign({}, t);
  }
  reset() {
    this.flags = {}, this.urlFlags = {}, this.populateURLFlags();
  }
  populateURLFlags() {
    if (typeof this.global > "u" || typeof this.global.location > "u" || typeof this.global.location.search > "u")
      return;
    const t = this.getQueryParams(this.global.location.search);
    ma in t && t[ma].split(",").forEach((s) => {
      const [r, o] = s.split(":");
      this.urlFlags[r] = Of(r, o);
    });
  }
}
function Rf(n) {
  const t = {};
  return n.replace(/[?&]([^=?&]+)(?:=([^&]*))?/g, (e, ...s) => (Lf(t, s[0], s[1]), s.join("="))), t;
}
function Lf(n, t, e) {
  n[decodeURIComponent(t)] = decodeURIComponent(e || "");
}
function Of(n, t) {
  const e = t.toLowerCase();
  return e === "true" || e === "false" ? e === "true" : `${+e}` === e ? +e : t;
}
function V() {
  return Wl;
}
let Wl = null;
function Mf(n) {
  Wl = n;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
let oo;
function Gl() {
  if (oo == null) {
    let n;
    if (typeof window < "u")
      n = window;
    else if (typeof global < "u")
      n = global;
    else if (typeof process < "u")
      n = process;
    else if (typeof self < "u")
      n = self;
    else
      throw new Error("Could not find a global object");
    oo = n;
  }
  return oo;
}
function Bf() {
  const n = Gl();
  return n._tfGlobals == null && (n._tfGlobals = /* @__PURE__ */ new Map()), n._tfGlobals;
}
function ai(n, t) {
  const e = Bf();
  if (e.has(n))
    return e.get(n);
  {
    const s = t();
    return e.set(n, s), e.get(n);
  }
}
const Ff = "Abs", Vl = "Add", zf = "All", Uf = "ArgMax", Wf = "AvgPool", Gf = "AvgPool3D", Vf = "BatchMatMul", qf = "Bincount", ql = "Cast", jf = "ClipByValue", Hf = "Complex", Kf = "ComplexAbs", jl = "Concat", Yf = "Conv2D", Xf = "Conv2DBackpropFilter", Jf = "Conv2DBackpropInput", Zf = "Conv3D", Qf = "Conv3DBackpropInputV2", td = "CropAndResize", ed = "DepthwiseConv2dNative", nd = "RealDiv", sd = "Einsum", rd = "Elu", od = "Erf", id = "Equal", ad = "Exp", ld = "ExpandDims", ud = "Fill", cd = "FlipLeftRight", hd = "Floor", fd = "FloorDiv", dd = "GatherV2", pd = "Greater", md = "GreaterEqual", li = "Identity", gd = "Imag", bd = "LeakyRelu", yd = "Less", wd = "LessEqual", xd = "Log", Sd = "Log1p", vd = "LogicalAnd", Id = "Max", $d = "Maximum", Hl = "MaxPool", Ad = "MaxPool3D", Ed = "Mean", _d = "Min", Cd = "Minimum", kd = "MirrorPad", Td = "Multiply", Nd = "Neg", Dd = "NonMaxSuppressionV3", Pd = "NonMaxSuppressionV4", Rd = "NonMaxSuppressionV5", Ld = "OnesLike", Od = "OneHot", Md = "Pack", Kl = "PadV2", Bd = "Pow", Fd = "Prelu", zd = "Range", Ud = "Real", Wd = "Relu", Gd = "Reshape", Yl = "ResizeNearestNeighbor", Vd = "ResizeBilinear", qd = "Relu6", jd = "Round", Hd = "Select", Kd = "Selu", Xl = "Slice", Yd = "Sigmoid", Xd = "Softplus", Jd = "Sqrt", Zd = "Sum", Qd = "SplitV", tp = "Softmax", ep = "Sub", np = "Tanh", Jl = "Tile", sp = "Transform", io = "Transpose", rp = "Unpack", op = "ZerosLike", ip = "Step", ap = "RotateWithOffset", No = "FusedConv2D";
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function _n(...n) {
  V().getBool("IS_TEST") || V().getBool("PROD") || console.warn(...n);
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ir = ai("kernelRegistry", () => /* @__PURE__ */ new Map()), lp = ai("gradRegistry", () => /* @__PURE__ */ new Map());
function ga(n, t) {
  const e = Zl(n, t);
  return ir.get(e);
}
function ba(n) {
  return lp.get(n);
}
function ya(n) {
  const t = ir.entries(), e = [];
  for (; ; ) {
    const { done: s, value: r } = t.next();
    if (s)
      break;
    const [o, i] = r, [a] = o.split("_");
    a === n && e.push(i);
  }
  return e;
}
function up(n) {
  const { kernelName: t, backendName: e } = n, s = Zl(t, e);
  ir.has(s) && _n(`The kernel '${t}' for backend '${e}' is already registered`), ir.set(s, n);
}
function Zl(n, t) {
  return `${t}_${n}`;
}
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ql(n) {
  return n instanceof Float32Array || n instanceof Int32Array || n instanceof Uint8Array || n instanceof Uint8ClampedArray;
}
var wn = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function cp(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
function hp(n) {
  if (n.__esModule) return n;
  var t = n.default;
  if (typeof t == "function") {
    var e = function s() {
      return this instanceof s ? Reflect.construct(t, arguments, this.constructor) : t.apply(this, arguments);
    };
    e.prototype = t.prototype;
  } else e = {};
  return Object.defineProperty(e, "__esModule", { value: !0 }), Object.keys(n).forEach(function(s) {
    var r = Object.getOwnPropertyDescriptor(n, s);
    Object.defineProperty(e, s, r.get ? r : {
      enumerable: !0,
      get: function() {
        return n[s];
      }
    });
  }), e;
}
var tu = at, ee = null;
try {
  ee = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    13,
    2,
    96,
    0,
    1,
    127,
    96,
    4,
    127,
    127,
    127,
    127,
    1,
    127,
    3,
    7,
    6,
    0,
    1,
    1,
    1,
    1,
    1,
    6,
    6,
    1,
    127,
    1,
    65,
    0,
    11,
    7,
    50,
    6,
    3,
    109,
    117,
    108,
    0,
    1,
    5,
    100,
    105,
    118,
    95,
    115,
    0,
    2,
    5,
    100,
    105,
    118,
    95,
    117,
    0,
    3,
    5,
    114,
    101,
    109,
    95,
    115,
    0,
    4,
    5,
    114,
    101,
    109,
    95,
    117,
    0,
    5,
    8,
    103,
    101,
    116,
    95,
    104,
    105,
    103,
    104,
    0,
    0,
    10,
    191,
    1,
    6,
    4,
    0,
    35,
    0,
    11,
    36,
    1,
    1,
    126,
    32,
    0,
    173,
    32,
    1,
    173,
    66,
    32,
    134,
    132,
    32,
    2,
    173,
    32,
    3,
    173,
    66,
    32,
    134,
    132,
    126,
    34,
    4,
    66,
    32,
    135,
    167,
    36,
    0,
    32,
    4,
    167,
    11,
    36,
    1,
    1,
    126,
    32,
    0,
    173,
    32,
    1,
    173,
    66,
    32,
    134,
    132,
    32,
    2,
    173,
    32,
    3,
    173,
    66,
    32,
    134,
    132,
    127,
    34,
    4,
    66,
    32,
    135,
    167,
    36,
    0,
    32,
    4,
    167,
    11,
    36,
    1,
    1,
    126,
    32,
    0,
    173,
    32,
    1,
    173,
    66,
    32,
    134,
    132,
    32,
    2,
    173,
    32,
    3,
    173,
    66,
    32,
    134,
    132,
    128,
    34,
    4,
    66,
    32,
    135,
    167,
    36,
    0,
    32,
    4,
    167,
    11,
    36,
    1,
    1,
    126,
    32,
    0,
    173,
    32,
    1,
    173,
    66,
    32,
    134,
    132,
    32,
    2,
    173,
    32,
    3,
    173,
    66,
    32,
    134,
    132,
    129,
    34,
    4,
    66,
    32,
    135,
    167,
    36,
    0,
    32,
    4,
    167,
    11,
    36,
    1,
    1,
    126,
    32,
    0,
    173,
    32,
    1,
    173,
    66,
    32,
    134,
    132,
    32,
    2,
    173,
    32,
    3,
    173,
    66,
    32,
    134,
    132,
    130,
    34,
    4,
    66,
    32,
    135,
    167,
    36,
    0,
    32,
    4,
    167,
    11
  ])), {}).exports;
} catch {
}
function at(n, t, e) {
  this.low = n | 0, this.high = t | 0, this.unsigned = !!e;
}
at.prototype.__isLong__;
Object.defineProperty(at.prototype, "__isLong__", { value: !0 });
function qt(n) {
  return (n && n.__isLong__) === !0;
}
at.isLong = qt;
var wa = {}, xa = {};
function xn(n, t) {
  var e, s, r;
  return t ? (n >>>= 0, (r = 0 <= n && n < 256) && (s = xa[n], s) ? s : (e = lt(n, (n | 0) < 0 ? -1 : 0, !0), r && (xa[n] = e), e)) : (n |= 0, (r = -128 <= n && n < 128) && (s = wa[n], s) ? s : (e = lt(n, n < 0 ? -1 : 0, !1), r && (wa[n] = e), e));
}
at.fromInt = xn;
function ne(n, t) {
  if (isNaN(n))
    return t ? tn : se;
  if (t) {
    if (n < 0)
      return tn;
    if (n >= eu)
      return ru;
  } else {
    if (n <= -9223372036854776e3)
      return Ut;
    if (n + 1 >= dp)
      return su;
  }
  return n < 0 ? ne(-n, t).neg() : lt(n % Ln | 0, n / Ln | 0, t);
}
at.fromNumber = ne;
function lt(n, t, e) {
  return new at(n, t, e);
}
at.fromBits = lt;
var ar = Math.pow;
function ui(n, t, e) {
  if (n.length === 0)
    throw Error("empty string");
  if (n === "NaN" || n === "Infinity" || n === "+Infinity" || n === "-Infinity")
    return se;
  if (typeof t == "number" ? (e = t, t = !1) : t = !!t, e = e || 10, e < 2 || 36 < e)
    throw RangeError("radix");
  var s;
  if ((s = n.indexOf("-")) > 0)
    throw Error("interior hyphen");
  if (s === 0)
    return ui(n.substring(1), t, e).neg();
  for (var r = ne(ar(e, 8)), o = se, i = 0; i < n.length; i += 8) {
    var a = Math.min(8, n.length - i), l = parseInt(n.substring(i, i + a), e);
    if (a < 8) {
      var u = ne(ar(e, a));
      o = o.mul(u).add(ne(l));
    } else
      o = o.mul(r), o = o.add(ne(l));
  }
  return o.unsigned = t, o;
}
at.fromString = ui;
function be(n, t) {
  return typeof n == "number" ? ne(n, t) : typeof n == "string" ? ui(n, t) : lt(n.low, n.high, typeof t == "boolean" ? t : n.unsigned);
}
at.fromValue = be;
var Sa = 65536, fp = 1 << 24, Ln = Sa * Sa, eu = Ln * Ln, dp = eu / 2, va = xn(fp), se = xn(0);
at.ZERO = se;
var tn = xn(0, !0);
at.UZERO = tn;
var Nn = xn(1);
at.ONE = Nn;
var nu = xn(1, !0);
at.UONE = nu;
var Do = xn(-1);
at.NEG_ONE = Do;
var su = lt(-1, 2147483647, !1);
at.MAX_VALUE = su;
var ru = lt(-1, -1, !0);
at.MAX_UNSIGNED_VALUE = ru;
var Ut = lt(0, -2147483648, !1);
at.MIN_VALUE = Ut;
var P = at.prototype;
P.toInt = function() {
  return this.unsigned ? this.low >>> 0 : this.low;
};
P.toNumber = function() {
  return this.unsigned ? (this.high >>> 0) * Ln + (this.low >>> 0) : this.high * Ln + (this.low >>> 0);
};
P.toString = function(t) {
  if (t = t || 10, t < 2 || 36 < t)
    throw RangeError("radix");
  if (this.isZero())
    return "0";
  if (this.isNegative())
    if (this.eq(Ut)) {
      var e = ne(t), s = this.div(e), r = s.mul(e).sub(this);
      return s.toString(t) + r.toInt().toString(t);
    } else
      return "-" + this.neg().toString(t);
  for (var o = ne(ar(t, 6), this.unsigned), i = this, a = ""; ; ) {
    var l = i.div(o), u = i.sub(l.mul(o)).toInt() >>> 0, c = u.toString(t);
    if (i = l, i.isZero())
      return c + a;
    for (; c.length < 6; )
      c = "0" + c;
    a = "" + c + a;
  }
};
P.getHighBits = function() {
  return this.high;
};
P.getHighBitsUnsigned = function() {
  return this.high >>> 0;
};
P.getLowBits = function() {
  return this.low;
};
P.getLowBitsUnsigned = function() {
  return this.low >>> 0;
};
P.getNumBitsAbs = function() {
  if (this.isNegative())
    return this.eq(Ut) ? 64 : this.neg().getNumBitsAbs();
  for (var t = this.high != 0 ? this.high : this.low, e = 31; e > 0 && !(t & 1 << e); e--)
    ;
  return this.high != 0 ? e + 33 : e + 1;
};
P.isZero = function() {
  return this.high === 0 && this.low === 0;
};
P.eqz = P.isZero;
P.isNegative = function() {
  return !this.unsigned && this.high < 0;
};
P.isPositive = function() {
  return this.unsigned || this.high >= 0;
};
P.isOdd = function() {
  return (this.low & 1) === 1;
};
P.isEven = function() {
  return (this.low & 1) === 0;
};
P.equals = function(t) {
  return qt(t) || (t = be(t)), this.unsigned !== t.unsigned && this.high >>> 31 === 1 && t.high >>> 31 === 1 ? !1 : this.high === t.high && this.low === t.low;
};
P.eq = P.equals;
P.notEquals = function(t) {
  return !this.eq(
    /* validates */
    t
  );
};
P.neq = P.notEquals;
P.ne = P.notEquals;
P.lessThan = function(t) {
  return this.comp(
    /* validates */
    t
  ) < 0;
};
P.lt = P.lessThan;
P.lessThanOrEqual = function(t) {
  return this.comp(
    /* validates */
    t
  ) <= 0;
};
P.lte = P.lessThanOrEqual;
P.le = P.lessThanOrEqual;
P.greaterThan = function(t) {
  return this.comp(
    /* validates */
    t
  ) > 0;
};
P.gt = P.greaterThan;
P.greaterThanOrEqual = function(t) {
  return this.comp(
    /* validates */
    t
  ) >= 0;
};
P.gte = P.greaterThanOrEqual;
P.ge = P.greaterThanOrEqual;
P.compare = function(t) {
  if (qt(t) || (t = be(t)), this.eq(t))
    return 0;
  var e = this.isNegative(), s = t.isNegative();
  return e && !s ? -1 : !e && s ? 1 : this.unsigned ? t.high >>> 0 > this.high >>> 0 || t.high === this.high && t.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(t).isNegative() ? -1 : 1;
};
P.comp = P.compare;
P.negate = function() {
  return !this.unsigned && this.eq(Ut) ? Ut : this.not().add(Nn);
};
P.neg = P.negate;
P.add = function(t) {
  qt(t) || (t = be(t));
  var e = this.high >>> 16, s = this.high & 65535, r = this.low >>> 16, o = this.low & 65535, i = t.high >>> 16, a = t.high & 65535, l = t.low >>> 16, u = t.low & 65535, c = 0, h = 0, f = 0, d = 0;
  return d += o + u, f += d >>> 16, d &= 65535, f += r + l, h += f >>> 16, f &= 65535, h += s + a, c += h >>> 16, h &= 65535, c += e + i, c &= 65535, lt(f << 16 | d, c << 16 | h, this.unsigned);
};
P.subtract = function(t) {
  return qt(t) || (t = be(t)), this.add(t.neg());
};
P.sub = P.subtract;
P.multiply = function(t) {
  if (this.isZero())
    return se;
  if (qt(t) || (t = be(t)), ee) {
    var e = ee.mul(
      this.low,
      this.high,
      t.low,
      t.high
    );
    return lt(e, ee.get_high(), this.unsigned);
  }
  if (t.isZero())
    return se;
  if (this.eq(Ut))
    return t.isOdd() ? Ut : se;
  if (t.eq(Ut))
    return this.isOdd() ? Ut : se;
  if (this.isNegative())
    return t.isNegative() ? this.neg().mul(t.neg()) : this.neg().mul(t).neg();
  if (t.isNegative())
    return this.mul(t.neg()).neg();
  if (this.lt(va) && t.lt(va))
    return ne(this.toNumber() * t.toNumber(), this.unsigned);
  var s = this.high >>> 16, r = this.high & 65535, o = this.low >>> 16, i = this.low & 65535, a = t.high >>> 16, l = t.high & 65535, u = t.low >>> 16, c = t.low & 65535, h = 0, f = 0, d = 0, p = 0;
  return p += i * c, d += p >>> 16, p &= 65535, d += o * c, f += d >>> 16, d &= 65535, d += i * u, f += d >>> 16, d &= 65535, f += r * c, h += f >>> 16, f &= 65535, f += o * u, h += f >>> 16, f &= 65535, f += i * l, h += f >>> 16, f &= 65535, h += s * c + r * u + o * l + i * a, h &= 65535, lt(d << 16 | p, h << 16 | f, this.unsigned);
};
P.mul = P.multiply;
P.divide = function(t) {
  if (qt(t) || (t = be(t)), t.isZero())
    throw Error("division by zero");
  if (ee) {
    if (!this.unsigned && this.high === -2147483648 && t.low === -1 && t.high === -1)
      return this;
    var e = (this.unsigned ? ee.div_u : ee.div_s)(
      this.low,
      this.high,
      t.low,
      t.high
    );
    return lt(e, ee.get_high(), this.unsigned);
  }
  if (this.isZero())
    return this.unsigned ? tn : se;
  var s, r, o;
  if (this.unsigned) {
    if (t.unsigned || (t = t.toUnsigned()), t.gt(this))
      return tn;
    if (t.gt(this.shru(1)))
      return nu;
    o = tn;
  } else {
    if (this.eq(Ut)) {
      if (t.eq(Nn) || t.eq(Do))
        return Ut;
      if (t.eq(Ut))
        return Nn;
      var i = this.shr(1);
      return s = i.div(t).shl(1), s.eq(se) ? t.isNegative() ? Nn : Do : (r = this.sub(t.mul(s)), o = s.add(r.div(t)), o);
    } else if (t.eq(Ut))
      return this.unsigned ? tn : se;
    if (this.isNegative())
      return t.isNegative() ? this.neg().div(t.neg()) : this.neg().div(t).neg();
    if (t.isNegative())
      return this.div(t.neg()).neg();
    o = se;
  }
  for (r = this; r.gte(t); ) {
    s = Math.max(1, Math.floor(r.toNumber() / t.toNumber()));
    for (var a = Math.ceil(Math.log(s) / Math.LN2), l = a <= 48 ? 1 : ar(2, a - 48), u = ne(s), c = u.mul(t); c.isNegative() || c.gt(r); )
      s -= l, u = ne(s, this.unsigned), c = u.mul(t);
    u.isZero() && (u = Nn), o = o.add(u), r = r.sub(c);
  }
  return o;
};
P.div = P.divide;
P.modulo = function(t) {
  if (qt(t) || (t = be(t)), ee) {
    var e = (this.unsigned ? ee.rem_u : ee.rem_s)(
      this.low,
      this.high,
      t.low,
      t.high
    );
    return lt(e, ee.get_high(), this.unsigned);
  }
  return this.sub(this.div(t).mul(t));
};
P.mod = P.modulo;
P.rem = P.modulo;
P.not = function() {
  return lt(~this.low, ~this.high, this.unsigned);
};
P.and = function(t) {
  return qt(t) || (t = be(t)), lt(this.low & t.low, this.high & t.high, this.unsigned);
};
P.or = function(t) {
  return qt(t) || (t = be(t)), lt(this.low | t.low, this.high | t.high, this.unsigned);
};
P.xor = function(t) {
  return qt(t) || (t = be(t)), lt(this.low ^ t.low, this.high ^ t.high, this.unsigned);
};
P.shiftLeft = function(t) {
  return qt(t) && (t = t.toInt()), (t &= 63) === 0 ? this : t < 32 ? lt(this.low << t, this.high << t | this.low >>> 32 - t, this.unsigned) : lt(0, this.low << t - 32, this.unsigned);
};
P.shl = P.shiftLeft;
P.shiftRight = function(t) {
  return qt(t) && (t = t.toInt()), (t &= 63) === 0 ? this : t < 32 ? lt(this.low >>> t | this.high << 32 - t, this.high >> t, this.unsigned) : lt(this.high >> t - 32, this.high >= 0 ? 0 : -1, this.unsigned);
};
P.shr = P.shiftRight;
P.shiftRightUnsigned = function(t) {
  if (qt(t) && (t = t.toInt()), t &= 63, t === 0)
    return this;
  var e = this.high;
  if (t < 32) {
    var s = this.low;
    return lt(s >>> t | e << 32 - t, e >>> t, this.unsigned);
  } else return t === 32 ? lt(e, 0, this.unsigned) : lt(e >>> t - 32, 0, this.unsigned);
};
P.shru = P.shiftRightUnsigned;
P.shr_u = P.shiftRightUnsigned;
P.toSigned = function() {
  return this.unsigned ? lt(this.low, this.high, !1) : this;
};
P.toUnsigned = function() {
  return this.unsigned ? this : lt(this.low, this.high, !0);
};
P.toBytes = function(t) {
  return t ? this.toBytesLE() : this.toBytesBE();
};
P.toBytesLE = function() {
  var t = this.high, e = this.low;
  return [
    e & 255,
    e >>> 8 & 255,
    e >>> 16 & 255,
    e >>> 24,
    t & 255,
    t >>> 8 & 255,
    t >>> 16 & 255,
    t >>> 24
  ];
};
P.toBytesBE = function() {
  var t = this.high, e = this.low;
  return [
    t >>> 24,
    t >>> 16 & 255,
    t >>> 8 & 255,
    t & 255,
    e >>> 24,
    e >>> 16 & 255,
    e >>> 8 & 255,
    e & 255
  ];
};
at.fromBytes = function(t, e, s) {
  return s ? at.fromBytesLE(t, e) : at.fromBytesBE(t, e);
};
at.fromBytesLE = function(t, e) {
  return new at(
    t[0] | t[1] << 8 | t[2] << 16 | t[3] << 24,
    t[4] | t[5] << 8 | t[6] << 16 | t[7] << 24,
    e
  );
};
at.fromBytesBE = function(t, e) {
  return new at(
    t[4] << 24 | t[5] << 16 | t[6] << 8 | t[7],
    t[0] << 24 | t[1] << 16 | t[2] << 8 | t[3],
    e
  );
};
const ou = /* @__PURE__ */ cp(tu), pp = /* @__PURE__ */ gf({
  __proto__: null,
  default: ou
}, [tu]);
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Ze = (
  // tslint:disable-next-line
  ou || pp
);
function zr(n) {
  return Ze.fromString(n, !0, 16);
}
const iu = zr("c3a5c85c97cb3127"), Je = zr("b492b66fbe98f273"), kt = zr("9ae16a3b2f90404f");
function Po(n) {
  return n.xor(n.shru(47));
}
function au(n, t, e) {
  const s = n.slice(t, t + e);
  return Ze.fromBytes(Array.from(s), !0, !0);
}
function rt(n, t) {
  return au(n, t, 8);
}
function Ia(n, t) {
  return au(n, t, 4);
}
function bt(n, t) {
  return t === 0 ? n : n.shru(t).or(n.shl(64 - t));
}
function We(n, t, e = zr("9ddfea08eb382d69")) {
  let s = n.xor(t).mul(e);
  s = s.xor(s.shru(47));
  let r = t.xor(s).mul(e);
  return r = r.xor(r.shru(47)), r = r.mul(e), r;
}
function mp(n, t, e, s, r, o) {
  r = r.add(n), o = bt(o.add(r).add(s), 21);
  const i = r;
  return r = r.add(t), r = r.add(e), o = o.add(bt(r, 44)), [r.add(s), o.add(i)];
}
function zs(n, t, e, s) {
  return mp(rt(n, t), rt(n, t + 8), rt(n, t + 16), rt(n, t + 24), e, s);
}
function gp(n, t = n.length) {
  if (t >= 8) {
    const e = kt.add(t * 2), s = rt(n, 0).add(kt), r = rt(n, t - 8), o = bt(r, 37).mul(e).add(s), i = bt(s, 25).add(r).mul(e);
    return We(o, i, e);
  }
  if (t >= 4) {
    const e = kt.add(t * 2), s = Ia(n, 0);
    return We(s.shl(3).add(t), Ia(n, t - 4), e);
  }
  if (t > 0) {
    const e = n[0], s = n[t >> 1], r = n[t - 1], o = e + (s << 8), i = t + (r << 2);
    return Po(kt.mul(o).xor(iu.mul(i))).mul(kt);
  }
  return kt;
}
function bp(n, t = n.length) {
  const e = kt.add(t * 2), s = rt(n, 0).mul(Je), r = rt(n, 8), o = rt(n, t - 8).mul(e), i = rt(n, t - 16).mul(kt);
  return We(bt(s.add(r), 43).add(bt(o, 30)).add(i), s.add(bt(r.add(kt), 18)).add(o), e);
}
function yp(n, t = n.length) {
  const e = kt.add(t * 2), s = rt(n, 0).mul(kt), r = rt(n, 8), o = rt(n, t - 8).mul(e), i = rt(n, t - 16).mul(kt), a = bt(s.add(r), 43).add(bt(o, 30)).add(i), l = We(a, s.add(bt(r.add(kt), 18)).add(o), e), u = rt(n, 16).mul(e), c = rt(n, 24), h = a.add(rt(n, t - 32)).mul(e), f = l.add(rt(n, t - 24)).mul(e);
  return We(bt(u.add(c), 43).add(bt(h, 30)).add(f), u.add(bt(c.add(s), 18)).add(h), e);
}
function wp(n, t = n.length) {
  const e = Ze.fromNumber(81, !0);
  if (t <= 32)
    return t <= 16 ? gp(n, t) : bp(n, t);
  if (t <= 64)
    return yp(n, t);
  let s = e, r = e.mul(Je).add(113), o = Po(r.mul(kt).add(113)).mul(kt), i = [Ze.UZERO, Ze.UZERO], a = [Ze.UZERO, Ze.UZERO];
  s = s.mul(kt).add(rt(n, 0));
  let l = 0;
  const u = (t - 1 >> 6) * 64, c = u + (t - 1 & 63) - 63;
  do
    s = bt(s.add(r).add(i[0]).add(rt(n, l + 8)), 37).mul(Je), r = bt(r.add(i[1]).add(rt(n, l + 48)), 42).mul(Je), s = s.xor(a[1]), r = r.add(i[0]).add(rt(n, l + 40)), o = bt(o.add(a[0]), 33).mul(Je), i = zs(n, l, i[1].mul(Je), s.add(a[0])), a = zs(n, l + 32, o.add(a[1]), r.add(rt(n, l + 16))), [o, s] = [s, o], l += 64;
  while (l !== u);
  const h = Je.add(o.and(255).shl(1));
  return l = c, a[0] = a[0].add(t - 1 & 63), i[0] = i[0].add(a[0]), a[0] = a[0].add(i[0]), s = bt(s.add(r).add(i[0]).add(rt(n, l + 8)), 37).mul(h), r = bt(r.add(i[1]).add(rt(n, l + 48)), 42).mul(h), s = s.xor(a[1].mul(9)), r = r.add(i[0].mul(9).add(rt(n, l + 40))), o = bt(o.add(a[0]), 33).mul(h), i = zs(n, l, i[1].mul(h), s.add(a[0])), a = zs(n, l + 32, o.add(a[1]), r.add(rt(n, l + 16))), [o, s] = [s, o], We(We(i[0], a[0], h).add(Po(r).mul(iu)).add(o), We(i[1], a[1], h).add(s), h);
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xp(n, t) {
  return t === "string" ? nn(n) : Ur([n], t);
}
function Sp(n, t) {
  return n instanceof Float32Array && t === "float32" || n instanceof Int32Array && t === "int32" || n instanceof Uint8Array && t === "bool";
}
function Ur(n, t) {
  if (t === "string")
    throw new Error("Cannot convert a string[] to a TypedArray");
  if (Array.isArray(n) && (n = fn(n)), V().getBool("DEBUG") && kf(n, t), Sp(n, t))
    return n;
  if (t == null || t === "float32" || t === "complex64")
    return new Float32Array(n);
  if (t === "int32")
    return new Int32Array(n);
  if (t === "bool") {
    const e = new Uint8Array(n.length);
    for (let s = 0; s < e.length; ++s)
      Math.round(n[s]) !== 0 && (e[s] = 1);
    return e;
  } else
    throw new Error(`Unknown data type ${t}`);
}
function On() {
  return V().platform.now();
}
function nn(n, t = "utf-8") {
  return t = t || "utf-8", V().platform.encode(n, t);
}
function lr(n, t = "utf-8") {
  return t = t || "utf-8", V().platform.decode(n, t);
}
function re(n) {
  return V().platform.isTypedArray != null ? V().platform.isTypedArray(n) : Ql(n);
}
function fn(n, t = [], e = !1) {
  if (t == null && (t = []), typeof n == "boolean" || typeof n == "number" || typeof n == "string" || ii(n) || n == null || re(n) && e)
    t.push(n);
  else if (Array.isArray(n) || re(n))
    for (let s = 0; s < n.length; ++s)
      fn(n[s], t, e);
  else {
    let s = -1;
    for (const r of Object.keys(n))
      /^([1-9]+[0-9]*|0)$/.test(r) && (s = Math.max(s, Number(r)));
    for (let r = 0; r <= s; r++)
      fn(n[r], t, e);
  }
  return t;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class vp {
  constructor(t, e) {
    this.backendTimer = t, this.logger = e, e == null && (this.logger = new $p());
  }
  profileKernel(t, e, s) {
    let r;
    const o = () => {
      r = s();
    };
    let i;
    const a = On();
    if (this.backendTimer.timerAvailable())
      i = this.backendTimer.time(o);
    else {
      o();
      for (const u of r)
        u.dataSync();
      i = Promise.resolve({ kernelMs: On() - a });
    }
    if (V().getBool("CHECK_COMPUTATION_FOR_ERRORS"))
      for (let u = 0; u < r.length; u++) {
        const c = r[u];
        c.data().then((h) => {
          Ip(h, c.dtype, t);
        });
      }
    return {
      kernelName: t,
      outputs: r,
      inputs: e,
      timeMs: i.then((u) => u.kernelMs),
      extraInfo: i.then((u) => u.getExtraProfileInfo != null ? u.getExtraProfileInfo() : "")
    };
  }
  logKernelProfile(t) {
    const { kernelName: e, outputs: s, timeMs: r, inputs: o, extraInfo: i } = t;
    s.forEach((a) => {
      Promise.all([a.data(), r, i]).then((l) => {
        this.logger.logKernelProfile(e, a, l[0], l[1], o, l[2]);
      });
    });
  }
}
function Ip(n, t, e) {
  if (t !== "float32")
    return !1;
  for (let s = 0; s < n.length; s++) {
    const r = n[s];
    if (isNaN(r) || !isFinite(r))
      return console.warn(`Found ${r} in the result of '${e}'`), !0;
  }
  return !1;
}
class $p {
  logKernelProfile(t, e, s, r, o, i) {
    const a = typeof r == "number" ? tr(`${r}ms`, 9) : r.error, l = tr(t, 25), u = e.rank, c = e.size, h = tr(e.shape.toString(), 14);
    let f = "";
    for (const d in o) {
      const p = o[d];
      if (p != null) {
        const g = p.shape || e.shape, m = g.length;
        f += `${d}: ${m}D ${m > 0 ? g : ""} `;
      }
    }
    console.log(`%c${l}	%c${a}	%c${u}D ${h}	%c${c}	%c${f}	%c${i}`, "font-weight:bold", "color:red", "color:blue", "color: orange", "color: green", "color: steelblue");
  }
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ap(n, t, e) {
  const s = {}, r = {};
  for (let l = 0; l < t.length; l++)
    s[t[l].id] = !0;
  for (let l = 0; l < n.length; l++) {
    const u = n[l], c = u.inputs;
    for (const h in c) {
      const f = c[h];
      let d = !1;
      for (let p = 0; p < t.length; p++)
        if (s[f.id]) {
          u.outputs.forEach((g) => s[g.id] = !0), d = !0, r[u.id] = !0;
          break;
        }
      if (d)
        break;
    }
  }
  const o = {};
  o[e.id] = !0;
  const i = {};
  for (let l = n.length - 1; l >= 0; l--) {
    const u = n[l], c = u.inputs;
    for (let h = 0; h < u.outputs.length; h++)
      if (o[u.outputs[h].id]) {
        for (const f in c)
          o[c[f].id] = !0, i[u.id] = !0;
        break;
      }
  }
  const a = [];
  for (let l = 0; l < n.length; l++) {
    const u = n[l];
    if (r[u.id] && i[u.id]) {
      const c = {};
      for (const f in u.inputs) {
        const d = u.inputs[f];
        s[d.id] && (c[f] = d);
      }
      const h = Object.assign({}, u);
      h.inputs = c, h.outputs = u.outputs, a.push(h);
    }
  }
  return a;
}
function Ep(n, t, e, s) {
  for (let r = t.length - 1; r >= 0; r--) {
    const o = t[r], i = [];
    if (o.outputs.forEach((l) => {
      const u = n[l.id];
      u != null ? i.push(u) : i.push(null);
    }), o.gradient == null)
      throw new Error(`Cannot compute gradient: gradient function not found for ${o.kernelName}.`);
    const a = o.gradient(i);
    for (const l in o.inputs) {
      if (!(l in a))
        throw new Error(`Cannot backprop through input ${l}. Available gradients found: ${Object.keys(a)}.`);
      const u = e(() => a[l]());
      if (u.dtype !== "float32")
        throw new Error(`Error in gradient for op ${o.kernelName}. The gradient of input ${l} must have 'float32' dtype, but has '${u.dtype}'`);
      const c = o.inputs[l];
      if (!oe(u.shape, c.shape))
        throw new Error(`Error in gradient for op ${o.kernelName}. The gradient of input '${l}' has shape '${u.shape}', which does not match the shape of the input '${c.shape}'`);
      if (n[c.id] == null)
        n[c.id] = u;
      else {
        const h = n[c.id];
        n[c.id] = s(h, u), h.dispose();
      }
    }
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const $a = 20, ss = 3, ao = 7;
function _p(n, t, e, s) {
  const r = Kt(t), o = Cp(n, t, e, r), i = t.length, a = er(n, t, e, r, o), l = ["Tensor"];
  return s && (l.push(`  dtype: ${e}`), l.push(`  rank: ${i}`), l.push(`  shape: [${t}]`), l.push("  values:")), l.push(a.map((u) => "    " + u).join(`
`)), l.join(`
`);
}
function Cp(n, t, e, s) {
  const r = z(t), o = s[s.length - 1], i = new Array(o).fill(0), a = t.length, l = e === "complex64" ? us(n) : n;
  if (a > 1)
    for (let u = 0; u < r / o; u++) {
      const c = u * o;
      for (let h = 0; h < o; h++)
        i[h] = Math.max(i[h], ls(l[c + h], 0, e).length);
    }
  return i;
}
function ls(n, t, e) {
  let s;
  return Array.isArray(n) ? s = `${parseFloat(n[0].toFixed(ao))} + ${parseFloat(n[1].toFixed(ao))}j` : Fr(n) ? s = `'${n}'` : e === "bool" ? s = lu(n) : s = parseFloat(n.toFixed(ao)).toString(), tr(s, t);
}
function lu(n) {
  return n === 0 ? "false" : "true";
}
function er(n, t, e, s, r, o = !0) {
  const i = e === "complex64" ? 2 : 1, a = t[0], l = t.length;
  if (l === 0) {
    if (e === "complex64") {
      const g = us(n);
      return [ls(g[0], 0, e)];
    }
    return e === "bool" ? [lu(n[0])] : [n[0].toString()];
  }
  if (l === 1) {
    if (a > $a) {
      const m = ss * i;
      let b = Array.from(n.slice(0, m)), y = Array.from(n.slice((a - ss) * i, a * i));
      return e === "complex64" && (b = us(b), y = us(y)), [
        "[" + b.map((S, x) => ls(S, r[x], e)).join(", ") + ", ..., " + y.map((S, x) => ls(S, r[a - ss + x], e)).join(", ") + "]"
      ];
    }
    return [
      "[" + (e === "complex64" ? us(n) : Array.from(n)).map((m, b) => ls(m, r[b], e)).join(", ") + "]"
    ];
  }
  const u = t.slice(1), c = s.slice(1), h = s[0] * i, f = [];
  if (a > $a) {
    for (let g = 0; g < ss; g++) {
      const m = g * h, b = m + h;
      f.push(...er(
        n.slice(m, b),
        u,
        e,
        c,
        r,
        !1
        /* isLast */
      ));
    }
    f.push("...");
    for (let g = a - ss; g < a; g++) {
      const m = g * h, b = m + h;
      f.push(...er(
        n.slice(m, b),
        u,
        e,
        c,
        r,
        g === a - 1
        /* isLast */
      ));
    }
  } else
    for (let g = 0; g < a; g++) {
      const m = g * h, b = m + h;
      f.push(...er(
        n.slice(m, b),
        u,
        e,
        c,
        r,
        g === a - 1
        /* isLast */
      ));
    }
  const d = l === 2 ? "," : "";
  f[0] = "[" + (a > 0 ? f[0] + d : "");
  for (let g = 1; g < f.length - 1; g++)
    f[g] = " " + f[g] + d;
  let p = `,
`;
  for (let g = 2; g < l; g++)
    p += `
`;
  return f[f.length - 1] = " " + f[f.length - 1] + "]" + (o ? "" : p), f;
}
function us(n) {
  const t = [];
  for (let e = 0; e < n.length; e += 2)
    t.push([n[e], n[e + 1]]);
  return t;
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ur {
  constructor(t, e, s) {
    if (this.dtype = e, this.shape = t.slice(), this.size = z(t), s != null) {
      const r = s.length;
      w(r === this.size, () => `Length of values '${r}' does not match the size inferred by the shape '${this.size}'.`);
    }
    if (e === "complex64")
      throw new Error("complex64 dtype TensorBuffers are not supported. Please create a TensorBuffer for the real and imaginary parts separately and call tf.complex(real, imag).");
    this.values = s || yt(e, this.size), this.strides = Kt(t);
  }
  /**
   * Sets a value in the buffer at a given location.
   *
   * @param value The value to set.
   * @param locs  The location indices.
   *
   * @doc {heading: 'Tensors', subheading: 'Creation'}
   */
  set(t, ...e) {
    e.length === 0 && (e = [0]), w(e.length === this.rank, () => `The number of provided coordinates (${e.length}) must match the rank (${this.rank})`);
    const s = this.locToIndex(e);
    this.values[s] = t;
  }
  /**
   * Returns the value in the buffer at the provided location.
   *
   * @param locs The location indices.
   *
   * @doc {heading: 'Tensors', subheading: 'Creation'}
   */
  get(...t) {
    t.length === 0 && (t = [0]);
    let e = 0;
    for (const r of t) {
      if (r < 0 || r >= this.shape[e]) {
        const o = `Requested out of range element at ${t}.   Buffer shape=${this.shape}`;
        throw new Error(o);
      }
      e++;
    }
    let s = t[t.length - 1];
    for (let r = 0; r < t.length - 1; ++r)
      s += this.strides[r] * t[r];
    return this.values[s];
  }
  locToIndex(t) {
    if (this.rank === 0)
      return 0;
    if (this.rank === 1)
      return t[0];
    let e = t[t.length - 1];
    for (let s = 0; s < t.length - 1; ++s)
      e += this.strides[s] * t[s];
    return e;
  }
  indexToLoc(t) {
    if (this.rank === 0)
      return [];
    if (this.rank === 1)
      return [t];
    const e = new Array(this.shape.length);
    for (let s = 0; s < e.length - 1; ++s)
      e[s] = Math.floor(t / this.strides[s]), t -= e[s] * this.strides[s];
    return e[e.length - 1] = t, e;
  }
  get rank() {
    return this.shape.length;
  }
  /**
   * Creates an immutable `tf.Tensor` object from the buffer.
   *
   * @doc {heading: 'Tensors', subheading: 'Creation'}
   */
  toTensor() {
    return de().makeTensor(this.values, this.shape, this.dtype);
  }
}
let de = null, Cn = null;
function kp(n) {
  de = n;
}
function Tp(n) {
  Cn = n;
}
class Et {
  constructor(t, e, s, r) {
    this.kept = !1, this.isDisposedInternal = !1, this.shape = t.slice(), this.dtype = e || "float32", this.size = z(t), this.strides = Kt(t), this.dataId = s, this.id = r, this.rankType = this.rank < 5 ? this.rank.toString() : "higher";
  }
  get rank() {
    return this.shape.length;
  }
  /**
   * Returns a promise of `tf.TensorBuffer` that holds the underlying data.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  async buffer() {
    const t = await this.data();
    return Cn.buffer(this.shape, this.dtype, t);
  }
  /**
   * Returns a `tf.TensorBuffer` that holds the underlying data.
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  bufferSync() {
    return Cn.buffer(this.shape, this.dtype, this.dataSync());
  }
  /**
   * Returns the tensor data as a nested array. The transfer of data is done
   * asynchronously.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  async array() {
    const t = await this.data();
    return pa(this.shape, t, this.dtype === "complex64");
  }
  /**
   * Returns the tensor data as a nested array. The transfer of data is done
   * synchronously.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  arraySync() {
    return pa(this.shape, this.dataSync(), this.dtype === "complex64");
  }
  /**
   * Asynchronously downloads the values from the `tf.Tensor`. Returns a
   * promise of `TypedArray` that resolves when the computation has finished.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  async data() {
    this.throwIfDisposed();
    const t = de().read(this.dataId);
    if (this.dtype === "string") {
      const e = await t;
      try {
        return e.map((s) => lr(s));
      } catch {
        throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().");
      }
    }
    return t;
  }
  /**
   * Copy the tensor's data to a new GPU resource. Comparing to the `dataSync()`
   * and `data()`, this method prevents data from being downloaded to CPU.
   *
   * For WebGL backend, the data will be stored on a densely packed texture.
   * This means that the texture will use the RGBA channels to store value.
   *
   * For WebGPU backend, the data will be stored on a buffer. There is no
   * parameter, so can not use a user-defined size to create the buffer.
   *
   * @param options:
   *     For WebGL,
   *         - customTexShape: Optional. If set, will use the user defined
   *     texture shape to create the texture.
   *
   * @returns For WebGL backend, a GPUData contains the new texture and
   *     its information.
   *     {
   *        tensorRef: The tensor that is associated with this texture,
   *        texture: WebGLTexture,
   *        texShape: [number, number] // [height, width]
   *     }
   *
   *     For WebGPU backend, a GPUData contains the new buffer.
   *     {
   *        tensorRef: The tensor that is associated with this buffer,
   *        buffer: GPUBuffer,
   *     }
   *
   *     Remember to dispose the GPUData after it is used by
   *     `res.tensorRef.dispose()`.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  dataToGPU(t) {
    return this.throwIfDisposed(), de().readToGPU(this.dataId, t);
  }
  /**
   * Synchronously downloads the values from the `tf.Tensor`. This blocks the
   * UI thread until the values are ready, which can cause performance issues.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  dataSync() {
    this.throwIfDisposed();
    const t = de().readSync(this.dataId);
    if (this.dtype === "string")
      try {
        return t.map((e) => lr(e));
      } catch {
        throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().");
      }
    return t;
  }
  /** Returns the underlying bytes of the tensor's data. */
  async bytes() {
    this.throwIfDisposed();
    const t = await de().read(this.dataId);
    return this.dtype === "string" ? t : new Uint8Array(t.buffer);
  }
  /**
   * Disposes `tf.Tensor` from memory.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  dispose() {
    this.isDisposed || (this.kerasMask && this.kerasMask.dispose(), de().disposeTensor(this), this.isDisposedInternal = !0);
  }
  get isDisposed() {
    return this.isDisposedInternal;
  }
  throwIfDisposed() {
    if (this.isDisposed)
      throw new Error("Tensor is disposed.");
  }
  /**
   * Prints the `tf.Tensor`. See `tf.print` for details.
   *
   * @param verbose Whether to print verbose information about the tensor,
   *    including dtype and size.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  print(t = !1) {
    return Cn.print(this, t);
  }
  /**
   * Returns a copy of the tensor. See `tf.clone` for details.
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  clone() {
    return this.throwIfDisposed(), Cn.clone(this);
  }
  /**
   * Returns a human-readable description of the tensor. Useful for logging.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  toString(t = !1) {
    const e = this.dataSync();
    return _p(e, this.shape, this.dtype, t);
  }
  cast(t) {
    return this.throwIfDisposed(), Cn.cast(this, t);
  }
  variable(t = !0, e, s) {
    return this.throwIfDisposed(), de().makeVariable(this, t, e, s);
  }
}
Object.defineProperty(Et, Symbol.hasInstance, {
  value: (n) => !!n && n.data != null && n.dataSync != null && n.throwIfDisposed != null
});
function uu() {
  return ai("Tensor", () => Et);
}
uu();
class cr extends Et {
  constructor(t, e, s, r) {
    super(t.shape, t.dtype, t.dataId, r), this.trainable = e, this.name = s;
  }
  /**
   * Assign a new `tf.Tensor` to this variable. The new `tf.Tensor` must have
   * the same shape and dtype as the old `tf.Tensor`.
   *
   * @param newValue New tensor to be assigned to this variable.
   *
   * @doc {heading: 'Tensors', subheading: 'Classes'}
   */
  assign(t) {
    if (t.dtype !== this.dtype)
      throw new Error(`dtype of the new value (${t.dtype}) and previous value (${this.dtype}) must match`);
    if (!oe(t.shape, this.shape))
      throw new Error(`shape of the new value (${t.shape}) and previous value (${this.shape}) must match`);
    de().disposeTensor(this), this.dataId = t.dataId, de().incRef(
      this,
      null
      /* backend */
    );
  }
  dispose() {
    de().disposeVariable(this), this.isDisposedInternal = !0;
  }
}
Object.defineProperty(cr, Symbol.hasInstance, {
  value: (n) => n instanceof Et && n.assign != null && n.assign instanceof Function
});
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var Aa;
(function(n) {
  n.R0 = "R0", n.R1 = "R1", n.R2 = "R2", n.R3 = "R3", n.R4 = "R4", n.R5 = "R5", n.R6 = "R6";
})(Aa || (Aa = {}));
var Ro;
(function(n) {
  n.float32 = "float32", n.int32 = "int32", n.bool = "int32", n.complex64 = "complex64";
})(Ro || (Ro = {}));
var Lo;
(function(n) {
  n.float32 = "float32", n.int32 = "int32", n.bool = "bool", n.complex64 = "complex64";
})(Lo || (Lo = {}));
var Oo;
(function(n) {
  n.float32 = "float32", n.int32 = "float32", n.bool = "float32", n.complex64 = "complex64";
})(Oo || (Oo = {}));
var Mo;
(function(n) {
  n.float32 = "complex64", n.int32 = "complex64", n.bool = "complex64", n.complex64 = "complex64";
})(Mo || (Mo = {}));
const Np = {
  float32: Oo,
  int32: Ro,
  bool: Lo,
  complex64: Mo
};
function ci(n, t) {
  if (n === "string" || t === "string") {
    if (n === "string" && t === "string")
      return "string";
    throw new Error(`Can not upcast ${n} with ${t}`);
  }
  return Np[n][t];
}
function Dp(n) {
  return ci(n, "int32");
}
function cu(n) {
  return n != null && typeof n == "object" && "texture" in n && n.texture instanceof WebGLTexture;
}
function hu(n) {
  return typeof GPUBuffer < "u" && n != null && typeof n == "object" && "buffer" in n && n.buffer instanceof GPUBuffer;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Rt(n, t) {
  if (n.dtype === t.dtype)
    return [n, t];
  const e = ci(n.dtype, t.dtype);
  return [n.cast(e), t.cast(e)];
}
function fu(n) {
  const t = [];
  return du(n, t, /* @__PURE__ */ new Set()), t;
}
function du(n, t, e) {
  if (n == null)
    return;
  if (n instanceof Et) {
    t.push(n);
    return;
  }
  if (!Pp(n))
    return;
  const s = n;
  for (const r in s) {
    const o = s[r];
    e.has(o) || (e.add(o), du(o, t, e));
  }
}
function Pp(n) {
  return Array.isArray(n) || typeof n == "object";
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function lo(n) {
  return n.kernelName != null;
}
class Ea {
  constructor() {
    this.registeredVariables = {}, this.nextTapeNodeId = 0, this.numBytes = 0, this.numTensors = 0, this.numStringTensors = 0, this.numDataBuffers = 0, this.gradientDepth = 0, this.kernelDepth = 0, this.scopeStack = [], this.numDataMovesStack = [], this.nextScopeId = 0, this.tensorInfo = /* @__PURE__ */ new WeakMap(), this.profiling = !1, this.activeProfile = {
      newBytes: 0,
      newTensors: 0,
      peakBytes: 0,
      kernels: [],
      result: null,
      get kernelNames() {
        return Array.from(new Set(this.kernels.map((t) => t.name)));
      }
    };
  }
  dispose() {
    for (const t in this.registeredVariables)
      this.registeredVariables[t].dispose();
  }
}
class Mn {
  constructor(t) {
    this.ENV = t, this.registry = {}, this.registryFactory = {}, this.pendingBackendInitId = 0, this.state = new Ea();
  }
  async ready() {
    if (this.pendingBackendInit != null)
      return this.pendingBackendInit.then(() => {
      });
    if (this.backendInstance != null)
      return;
    const t = this.getSortedBackends();
    for (let e = 0; e < t.length; e++) {
      const s = t[e];
      if (await this.initializeBackend(s).success) {
        await this.setBackend(s);
        return;
      }
    }
    throw new Error("Could not initialize any backends, all backend initializations failed.");
  }
  get backend() {
    if (this.pendingBackendInit != null)
      throw new Error(`Backend '${this.backendName}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);
    if (this.backendInstance == null) {
      const { name: t, asyncInit: e } = this.initializeBackendsAndReturnBest();
      if (e)
        throw new Error(`The highest priority backend '${t}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);
      this.setBackend(t);
    }
    return this.backendInstance;
  }
  backendNames() {
    return Object.keys(this.registryFactory);
  }
  findBackend(t) {
    if (!(t in this.registry))
      if (t in this.registryFactory) {
        const { asyncInit: e } = this.initializeBackend(t);
        if (e)
          return null;
      } else
        return null;
    return this.registry[t];
  }
  findBackendFactory(t) {
    return t in this.registryFactory ? this.registryFactory[t].factory : null;
  }
  registerBackend(t, e, s = 1) {
    return t in this.registryFactory ? (_n(`${t} backend was already registered. Reusing existing backend factory.`), !1) : (this.registryFactory[t] = { factory: e, priority: s }, !0);
  }
  async setBackend(t) {
    if (this.registryFactory[t] == null)
      throw new Error(`Backend name '${t}' not found in registry`);
    if (this.backendName = t, this.registry[t] == null) {
      this.backendInstance = null;
      const { success: e, asyncInit: s } = this.initializeBackend(t);
      if (!(s ? await e : e))
        return !1;
    }
    return this.backendInstance = this.registry[t], this.setupRegisteredKernels(), this.profiler = new vp(this.backendInstance), !0;
  }
  setupRegisteredKernels() {
    ya(this.backendName).forEach((e) => {
      e.setupFunc != null && e.setupFunc(this.backendInstance);
    });
  }
  disposeRegisteredKernels(t) {
    ya(t).forEach((s) => {
      s.disposeFunc != null && s.disposeFunc(this.registry[t]);
    });
  }
  /**
   * Initializes a backend by looking up the backend name in the factory
   * registry and calling the factory method. Returns a boolean representing
   * whether the initialization of the backend suceeded. Throws an error if
   * there is no backend in the factory registry.
   */
  initializeBackend(t) {
    const e = this.registryFactory[t];
    if (e == null)
      throw new Error(`Cannot initialize backend ${t}, no registration found.`);
    try {
      const s = e.factory();
      if (s && !(s instanceof Bl) && typeof s.then == "function") {
        const r = ++this.pendingBackendInitId, o = s.then((i) => r < this.pendingBackendInitId ? !1 : (this.registry[t] = i, this.pendingBackendInit = null, !0)).catch((i) => (r < this.pendingBackendInitId || (this.pendingBackendInit = null, _n(`Initialization of backend ${t} failed`), _n(i.stack || i.message)), !1));
        return this.pendingBackendInit = o, { success: o, asyncInit: !0 };
      } else
        return this.registry[t] = s, { success: !0, asyncInit: !1 };
    } catch (s) {
      return _n(`Initialization of backend ${t} failed`), _n(s.stack || s.message), { success: !1, asyncInit: !1 };
    }
  }
  removeBackend(t) {
    if (!(t in this.registryFactory))
      throw new Error(`${t} backend not found in registry`);
    this.backendName === t && this.pendingBackendInit != null && this.pendingBackendInitId++, t in this.registry && (this.disposeRegisteredKernels(t), this.registry[t].dispose(), delete this.registry[t]), delete this.registryFactory[t], this.backendName === t && (this.pendingBackendInit = null, this.backendName = null, this.backendInstance = null);
  }
  getSortedBackends() {
    if (Object.keys(this.registryFactory).length === 0)
      throw new Error("No backend found in registry.");
    return Object.keys(this.registryFactory).sort((t, e) => this.registryFactory[e].priority - this.registryFactory[t].priority);
  }
  initializeBackendsAndReturnBest() {
    const t = this.getSortedBackends();
    for (let e = 0; e < t.length; e++) {
      const s = t[e], { success: r, asyncInit: o } = this.initializeBackend(s);
      if (o || r)
        return { name: s, asyncInit: o };
    }
    throw new Error("Could not initialize any backends, all backend initializations failed.");
  }
  moveData(t, e) {
    const s = this.state.tensorInfo.get(e), r = s.backend, o = this.readSync(e), i = r.refCount(e);
    r.disposeData(e, !0), s.backend = t, t.move(e, o, s.shape, s.dtype, i), this.shouldCheckForMemLeaks() && this.state.numDataMovesStack[this.state.numDataMovesStack.length - 1]++;
  }
  tidy(t, e) {
    let s = null;
    if (e == null) {
      if (typeof t != "function")
        throw new Error("Please provide a function to tidy()");
      e = t;
    } else {
      if (typeof t != "string" && !(t instanceof String))
        throw new Error("When calling with two arguments, the first argument to tidy() must be a string");
      if (typeof e != "function")
        throw new Error("When calling with two arguments, the 2nd argument to tidy() must be a function");
      s = t;
    }
    let r;
    return this.scopedRun(() => this.startScope(s), () => this.endScope(r), () => (r = e(), r instanceof Promise && console.error("Cannot return a Promise inside of tidy."), r));
  }
  scopedRun(t, e, s) {
    t();
    try {
      const r = s();
      return e(), r;
    } catch (r) {
      throw e(), r;
    }
  }
  nextTensorId() {
    return Mn.nextTensorId++;
  }
  nextVariableId() {
    return Mn.nextVariableId++;
  }
  /**
   * This method is called instead of the public-facing tensor.clone() when
   * saving a tensor for backwards pass. It makes sure to add the clone
   * operation to the tape regardless of being called inside a kernel
   * execution.
   */
  clone(t) {
    const e = A.runKernel(li, { x: t }), s = { x: t }, r = (i) => ({
      x: () => {
        const a = "float32", l = { x: i }, u = { dtype: a };
        return A.runKernel(
          ql,
          l,
          // tslint:disable-next-line: no-unnecessary-type-assertion
          u
        );
      }
    }), o = [];
    return this.addTapeNode(this.state.activeScope.name, s, [e], r, o, {}), e;
  }
  /**
   * Execute a kernel with the given name and return the output tensor.
   *
   * @param kernelName The name of the kernel to execute.
   * @param inputs A map of input names to tensors.
   * @param attrs A map of attribute names to their values. An attribute is a
   *     primitive (non-tensor) input to the kernel.
   * @param inputsToSave A list of tensors, inputs to save for the backprop
   *     computation.
   * @param outputsToSave A list of booleans, specifying which output to save
   *     for the backprop computation. These are booleans since the output
   * tensors are not visible to the user.
   */
  runKernel(t, e, s) {
    if (this.backendName == null && this.backend, !(ga(t, this.backendName) != null))
      throw new Error(`Kernel '${t}' not registered for backend '${this.backendName}'`);
    return this.runKernelFunc({ kernelName: t, inputs: e, attrs: s });
  }
  shouldCheckForMemLeaks() {
    return this.ENV.getBool("IS_TEST");
  }
  checkKernelForMemLeak(t, e, s) {
    const r = this.backend.numDataIds();
    let o = 0;
    s.forEach((l) => {
      o += l.dtype === "complex64" ? 3 : 1;
    });
    const i = this.state.numDataMovesStack[this.state.numDataMovesStack.length - 1], a = r - e - o - i;
    if (a > 0)
      throw new Error(`Backend '${this.backendName}' has an internal memory leak (${a} data ids) after running '${t}'`);
  }
  /**
   * Internal helper method to execute a kernel Func
   *
   * Use `runKernel` to execute kernels from outside of engine.
   */
  runKernelFunc(t) {
    let e, s = [];
    const r = this.isTapeOn(), o = this.state.numBytes, i = this.state.numTensors;
    this.shouldCheckForMemLeaks() && this.state.numDataMovesStack.push(0);
    let a;
    this.backendName == null && this.backend;
    let l;
    const u = lo(t) ? t.kernelName : this.state.activeScope != null ? this.state.activeScope.name : "";
    if (lo(t)) {
      const { kernelName: p, inputs: g, attrs: m } = t;
      this.backendName == null && this.backend;
      const b = ga(p, this.backendName);
      w(b != null, () => `Cannot find registered kernel '${p}' for backend '${this.backendName}'`), a = () => {
        const y = this.backend.numDataIds();
        l = b.kernelFunc({ inputs: g, attrs: m, backend: this.backend });
        const S = Array.isArray(l) ? l : [l];
        this.shouldCheckForMemLeaks() && this.checkKernelForMemLeak(p, y, S);
        const x = S.map((v) => v.rank != null ? v : this.makeTensorFromTensorInfo(v));
        if (r) {
          const v = this.getTensorsForGradient(p, g, x);
          s = this.saveTensorsForBackwardMode(v);
        }
        return x;
      };
    } else {
      const { forwardFunc: p } = t, g = (m) => {
        r && (s = m.map((b) => this.keep(this.clone(b))));
      };
      a = () => {
        const m = this.backend.numDataIds();
        l = this.tidy(() => p(this.backend, g));
        const b = Array.isArray(l) ? l : [l];
        return this.shouldCheckForMemLeaks() && this.checkKernelForMemLeak(u, m, b), b;
      };
    }
    const { inputs: c, attrs: h } = t, f = lo(t) ? null : t.backwardsFunc;
    let d;
    return this.scopedRun(
      // Stop recording to a tape when running a kernel.
      () => this.state.kernelDepth++,
      () => this.state.kernelDepth--,
      () => {
        !this.ENV.getBool("DEBUG") && !this.state.profiling ? e = a() : (d = this.profiler.profileKernel(u, c, () => a()), this.ENV.getBool("DEBUG") && this.profiler.logKernelProfile(d), e = d.outputs);
      }
    ), r && this.addTapeNode(u, c, e, f, s, h), this.state.profiling && this.state.activeProfile.kernels.push({
      name: u,
      bytesAdded: this.state.numBytes - o,
      totalBytesSnapshot: this.state.numBytes,
      tensorsAdded: this.state.numTensors - i,
      totalTensorsSnapshot: this.state.numTensors,
      inputShapes: Object.keys(c).map((p) => c[p] != null ? c[p].shape : null),
      outputShapes: e.map((p) => p.shape),
      kernelTimeMs: d.timeMs,
      extraInfo: d.extraInfo
    }), Array.isArray(l) ? e : e[0];
  }
  /**
   * Saves tensors used in forward mode for use in backward mode.
   *
   * @param tensors the list of tensors to save.
   */
  saveTensorsForBackwardMode(t) {
    return t.map((s) => this.keep(this.clone(s)));
  }
  /**
   * Returns a list of tensors to save for a given gradient calculation.
   *
   * @param kernelName name of kernel to look up gradient for.
   * @param inputs a map of input tensors.
   * @param outputs an array of output tensors from forward mode of kernel.
   */
  getTensorsForGradient(t, e, s) {
    const r = ba(t);
    if (r != null) {
      const o = r.inputsToSave || [], i = r.outputsToSave || [];
      let a;
      r.saveAllInputs ? (w(Array.isArray(e), () => "saveAllInputs is true, expected inputs to be an array."), a = Object.keys(e).map((u) => e[u])) : a = o.map((u) => e[u]);
      const l = s.filter((u, c) => i[c]);
      return a.concat(l);
    }
    return [];
  }
  /**
   * Internal method used by public APIs for tensor creation. Makes a new
   * tensor with the provided shape, dtype and values. It always
   * creates a new data id and writes the values to the underlying backend.
   */
  makeTensor(t, e, s, r) {
    if (t == null)
      throw new Error("Values passed to engine.makeTensor() are null");
    s = s || "float32", r = r || this.backend;
    let o = t;
    s === "string" && Fr(t[0]) && (o = t.map((l) => nn(l)));
    const i = r.write(o, e, s), a = new Et(e, s, i, this.nextTensorId());
    if (this.trackTensor(a, r), s === "string") {
      const l = this.state.tensorInfo.get(i), u = Nf(o);
      this.state.numBytes += u - l.bytes, l.bytes = u;
    }
    return a;
  }
  /**
   * Internal method used by backends. Makes a new tensor
   * that is a wrapper around an existing data id. It doesn't create
   * a new data id, only increments the ref count used in memory tracking.
   * @deprecated
   */
  makeTensorFromDataId(t, e, s, r) {
    s = s || "float32";
    const o = { dataId: t, shape: e, dtype: s };
    return this.makeTensorFromTensorInfo(o, r);
  }
  /**
   * Internal method used by backends. Makes a new tensor that is a wrapper
   * around an existing data id in TensorInfo. It doesn't create a new data id,
   * only increments the ref count used in memory tracking.
   */
  makeTensorFromTensorInfo(t, e) {
    const { dataId: s, shape: r, dtype: o } = t, i = new Et(r, o, s, this.nextTensorId());
    return this.trackTensor(i, e), i;
  }
  makeVariable(t, e = !0, s, r) {
    s = s || this.nextVariableId().toString(), r != null && r !== t.dtype && (t = t.cast(r));
    const o = new cr(t, e, s, this.nextTensorId());
    if (this.state.registeredVariables[o.name] != null)
      throw new Error(`Variable with name ${o.name} was already registered`);
    return this.state.registeredVariables[o.name] = o, this.incRef(o, this.backend), o;
  }
  trackTensor(t, e) {
    this.state.numTensors++, t.dtype === "string" && this.state.numStringTensors++;
    let s = 0;
    t.dtype !== "complex64" && t.dtype !== "string" && (s = t.size * _o(t.dtype)), this.state.numBytes += s, this.state.tensorInfo.has(t.dataId) || (this.state.numDataBuffers++, this.state.tensorInfo.set(t.dataId, {
      backend: e || this.backend,
      dtype: t.dtype,
      shape: t.shape,
      bytes: s
    })), t instanceof cr || this.track(t);
  }
  // Track the tensor by dataId and increase the refCount for the dataId in the
  // backend.
  // TODO(pyu10055): This is currently used by makeVariable method, to increase
  // refCount on the backend for the dataId. It can potentially be replaced with
  // Identity op indead of calling backend directly.
  incRef(t, e) {
    this.trackTensor(t, e), this.backend.incRef(t.dataId);
  }
  removeDataId(t, e) {
    this.state.tensorInfo.has(t) && this.state.tensorInfo.get(t).backend === e && (this.state.tensorInfo.delete(t), this.state.numDataBuffers--);
  }
  disposeTensor(t) {
    if (!this.state.tensorInfo.has(t.dataId))
      return;
    const e = this.state.tensorInfo.get(t.dataId);
    if (this.state.numTensors--, t.dtype === "string" && (this.state.numStringTensors--, this.state.numBytes -= e.bytes), t.dtype !== "complex64" && t.dtype !== "string") {
      const s = t.size * _o(t.dtype);
      this.state.numBytes -= s;
    }
    e.backend.disposeData(t.dataId) && this.removeDataId(t.dataId, e.backend);
  }
  disposeVariables() {
    for (const t in this.state.registeredVariables) {
      const e = this.state.registeredVariables[t];
      this.disposeVariable(e);
    }
  }
  disposeVariable(t) {
    this.disposeTensor(t), this.state.registeredVariables[t.name] != null && delete this.state.registeredVariables[t.name];
  }
  memory() {
    const t = this.backend.memory();
    return t.numTensors = this.state.numTensors, t.numDataBuffers = this.state.numDataBuffers, t.numBytes = this.state.numBytes, this.state.numStringTensors > 0 && (t.unreliable = !0, t.reasons == null && (t.reasons = []), t.reasons.push("Memory usage by string tensors is approximate (2 bytes per character)")), t;
  }
  async profile(t) {
    this.state.profiling = !0;
    const e = this.state.numBytes, s = this.state.numTensors;
    this.state.activeProfile.kernels = [], this.state.activeProfile.result = await t(), this.state.profiling = !1, this.state.activeProfile.peakBytes = Math.max(...this.state.activeProfile.kernels.map((r) => r.totalBytesSnapshot)), this.state.activeProfile.newBytes = this.state.numBytes - e, this.state.activeProfile.newTensors = this.state.numTensors - s;
    for (const r of this.state.activeProfile.kernels)
      r.kernelTimeMs = await r.kernelTimeMs, r.extraInfo = await r.extraInfo;
    return this.state.activeProfile;
  }
  isTapeOn() {
    return this.state.gradientDepth > 0 && this.state.kernelDepth === 0;
  }
  addTapeNode(t, e, s, r, o, i) {
    const a = { id: this.state.nextTapeNodeId++, kernelName: t, inputs: e, outputs: s, saved: o }, l = ba(t);
    l != null && (r = l.gradFunc), r != null && (a.gradient = (u) => (u = u.map((c, h) => {
      if (c == null) {
        const f = s[h], d = je(f.size, f.dtype);
        return this.makeTensor(d, f.shape, f.dtype);
      }
      return c;
    }), r(u.length > 1 ? u : u[0], o, i))), this.state.activeTape.push(a);
  }
  keep(t) {
    return t.kept = !0, t;
  }
  startTape() {
    this.state.gradientDepth === 0 && (this.state.activeTape = []), this.state.gradientDepth++;
  }
  endTape() {
    this.state.gradientDepth--;
  }
  /**
   * Start a scope. Use this with endScope() to achieve the same functionality
   * as scope() without the need for a function closure.
   */
  startScope(t) {
    const e = {
      track: [],
      name: "unnamed scope",
      id: this.state.nextScopeId++
    };
    t && (e.name = t), this.state.scopeStack.push(e), this.state.activeScope = e;
  }
  /**
   * End a scope. Use this with startScope() to achieve the same functionality
   * as scope() without the need for a function closure.
   */
  endScope(t) {
    const e = fu(t), s = new Set(e.map((o) => o.id));
    for (let o = 0; o < this.state.activeScope.track.length; o++) {
      const i = this.state.activeScope.track[o];
      !i.kept && !s.has(i.id) && i.dispose();
    }
    const r = this.state.scopeStack.pop();
    this.state.activeScope = this.state.scopeStack.length === 0 ? null : this.state.scopeStack[this.state.scopeStack.length - 1], e.forEach((o) => {
      !o.kept && o.scopeId === r.id && this.track(o);
    });
  }
  /**
   * Returns gradients of `f` with respect to each of the `xs`. The gradients
   * returned are of the same length as `xs`, but some might be null if `f`
   * was not a function of that `x`. It also takes optional dy to multiply the
   * gradient, which defaults to `1`.
   */
  gradients(t, e, s, r = !1) {
    if (w(e.length > 0, () => "gradients() received an empty list of xs."), s != null && s.dtype !== "float32")
      throw new Error(`dy must have 'float32' dtype, but has '${s.dtype}'`);
    const o = this.scopedRun(() => this.startTape(), () => this.endTape(), () => this.tidy("forward", t));
    w(o instanceof Et, () => "The result y returned by f() must be a tensor.");
    const i = Ap(this.state.activeTape, e, o);
    if (!r && i.length === 0 && e.length > 0)
      throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that the f you passed encloses all operations that lead from x to y.");
    return this.tidy("backward", () => {
      const a = {};
      a[o.id] = s ?? Rp(o.shape), Ep(
        a,
        i,
        // Pass the tidy function to avoid circular dep with `tape.ts`.
        (u) => this.tidy(u),
        // Pass an add function to avoide a circular dep with `tape.ts`.
        Lp
      );
      const l = e.map((u) => a[u.id]);
      return this.state.gradientDepth === 0 && (this.state.activeTape.forEach((u) => {
        for (const c of u.saved)
          c.dispose();
      }), this.state.activeTape = null), { value: o, grads: l };
    });
  }
  customGrad(t) {
    return w(ko(t), () => "The f passed in customGrad(f) must be a function."), (...e) => {
      w(e.every((a) => a instanceof Et), () => "The args passed in customGrad(f)(x1, x2,...) must all be tensors");
      let s;
      const r = {};
      e.forEach((a, l) => {
        r[l] = a;
      });
      const o = (a, l) => (s = t(...e, l), w(s.value instanceof Et, () => "The function f passed in customGrad(f) must return an object where `obj.value` is a tensor"), w(ko(s.gradFunc), () => "The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function."), s.value), i = (a, l) => {
        const u = s.gradFunc(a, l), c = Array.isArray(u) ? u : [u];
        w(c.length === e.length, () => "The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns the same number of tensors as inputs passed to f(...)."), w(c.every((f) => f instanceof Et), () => "The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns a list of only tensors.");
        const h = {};
        return c.forEach((f, d) => {
          h[d] = () => f;
        }), h;
      };
      return this.runKernelFunc({
        forwardFunc: o,
        backwardsFunc: i,
        inputs: r
      });
    };
  }
  readSync(t) {
    return this.state.tensorInfo.get(t).backend.readSync(t);
  }
  read(t) {
    return this.state.tensorInfo.get(t).backend.read(t);
  }
  readToGPU(t, e) {
    return this.state.tensorInfo.get(t).backend.readToGPU(t, e);
  }
  async time(t) {
    const e = On(), s = await this.backend.time(t);
    return s.wallMs = On() - e, s;
  }
  /**
   * Tracks a Tensor in the current scope to be automatically cleaned up
   * when the current scope ends, and returns the value.
   *
   * @param result The Tensor to track in the current scope.
   */
  track(t) {
    return this.state.activeScope != null && (t.scopeId = this.state.activeScope.id, this.state.activeScope.track.push(t)), t;
  }
  get registeredVariables() {
    return this.state.registeredVariables;
  }
  /**
   * Resets the engine state. Removes all backends but does not remove
   * registered backend factories.
   */
  reset() {
    this.pendingBackendInitId++, this.state.dispose(), this.ENV.reset(), this.state = new Ea();
    for (const t in this.registry)
      this.disposeRegisteredKernels(t), this.registry[t].dispose(), delete this.registry[t];
    this.backendName = null, this.backendInstance = null, this.pendingBackendInit = null;
  }
}
Mn.nextTensorId = 0;
Mn.nextVariableId = 0;
function Rp(n) {
  const t = Ul(z(n), "float32");
  return A.makeTensor(t, n, "float32");
}
function pu() {
  const n = Gl();
  if (n._tfengine == null) {
    const t = new Pf(n);
    n._tfengine = new Mn(t);
  }
  return Mf(n._tfengine.ENV), kp(() => n._tfengine), n._tfengine;
}
const A = pu();
function Lp(n, t) {
  const e = { a: n, b: t };
  return A.runKernel(Vl, e);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wr(n, t) {
  let e = n;
  if (re(n))
    return t === "string" ? [] : [n.length];
  if (cu(n)) {
    const r = n.channels || "RGBA";
    return [n.height, n.width * r.length];
  } else if (hu(n))
    return [n.buffer.size / (t == null ? 4 : _o(t))];
  if (!Array.isArray(n))
    return [];
  const s = [];
  for (; Array.isArray(e) || re(e) && t !== "string"; )
    s.push(e.length), e = e[0];
  return Array.isArray(n) && V().getBool("TENSORLIKE_CHECK_SHAPE_CONSISTENCY") && mu(n, s, []), s;
}
function mu(n, t, e) {
  if (e = e || [], !Array.isArray(n) && !re(n)) {
    w(t.length === 0, () => `Element arr[${e.join("][")}] is a primitive, but should be an array/TypedArray of ${t[0]} elements`);
    return;
  }
  w(t.length > 0, () => `Element arr[${e.join("][")}] should be a primitive, but is an array of ${n.length} elements`), w(n.length === t[0], () => `Element arr[${e.join("][")}] should have ${t[0]} elements, but has ${n.length} elements`);
  const s = t.slice(1);
  for (let r = 0; r < n.length; ++r)
    mu(n[r], s, e.concat(r));
}
function _a(n, t, e, s) {
  if (n !== "string_or_numeric") {
    if (n == null)
      throw new Error("Expected dtype cannot be null.");
    if (n !== "numeric" && n !== t || n === "numeric" && t === "string")
      throw new Error(`Argument '${e}' passed to '${s}' must be ${n} tensor, but got ${t} tensor`);
  }
}
function $(n, t, e, s = "numeric") {
  if (n instanceof uu())
    return _a(s, n.dtype, t, e), n;
  let r = Cs(n);
  if (r !== "string" && ["bool", "int32", "float32"].indexOf(s) >= 0 && (r = s), _a(s, r, t, e), n == null || !re(n) && !Array.isArray(n) && typeof n != "number" && typeof n != "boolean" && typeof n != "string") {
    const l = n == null ? "null" : n.constructor.name;
    throw new Error(`Argument '${t}' passed to '${e}' must be a Tensor or TensorLike, but got '${l}'`);
  }
  const o = Wr(n, r);
  !re(n) && !Array.isArray(n) && (n = [n]);
  const a = r !== "string" ? Ur(n, r) : fn(n, [], !0);
  return A.makeTensor(a, o, r);
}
function gu(n, t, e, s = "numeric") {
  if (!Array.isArray(n))
    throw new Error(`Argument ${t} passed to ${e} must be a \`Tensor[]\` or \`TensorLike[]\``);
  return n.map((o, i) => $(o, `${t}[${i}]`, e, s));
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Gr(n, t, e, s) {
  if (s == null)
    s = Cs(n);
  else if (s === "complex64")
    throw new Error("Cannot construct a complex64 tensor directly. Please use tf.complex(real, imag).");
  if (hu(n) || cu(n)) {
    if (s !== "float32" && s !== "int32")
      throw new Error(`Creating tensor from GPU data only supports 'float32'|'int32' dtype, while the dtype is ${s}.`);
    return A.backend.createTensorFromGPUData(n, t || e, s);
  }
  if (!re(n) && !Array.isArray(n) && typeof n != "number" && typeof n != "boolean" && typeof n != "string")
    throw new Error("values passed to tensor(values) must be a number/boolean/string or an array of numbers/booleans/strings, or a TypedArray");
  if (t != null) {
    Me(t);
    const r = z(t), o = z(e);
    w(r === o, () => `Based on the provided shape, [${t}], the tensor should have ${r} values but has ${o}`);
    for (let i = 0; i < e.length; ++i) {
      const a = e[i], l = i === e.length - 1 ? a !== z(t.slice(i)) : !0;
      w(e[i] === t[i] || !l, () => `Error creating a new Tensor. Inferred shape (${e}) does not match the provided shape (${t}). `);
    }
  }
  return !re(n) && !Array.isArray(n) && (n = [n]), t = t || e, n = s !== "string" ? Ur(n, s) : fn(n, [], !0), A.makeTensor(n, t, s);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function nr(n, t, e) {
  const s = Wr(n, e);
  return Gr(n, t, s, e);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Dt(n, t) {
  Fl(n);
  const e = Wr(n, t);
  if (e.length !== 1)
    throw new Error("tensor1d() requires values to be a flat/TypedArray");
  return Gr(n, null, e, t);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Op = "__op";
function C(n) {
  const t = Object.keys(n);
  if (t.length !== 1)
    throw new Error(`Please provide an object with a single key (operation name) mapping to a function. Got an object with ${t.length} keys.`);
  let e = t[0];
  const s = n[e];
  e.endsWith("_") && (e = e.substring(0, e.length - 1)), e = e + Op;
  const r = (...o) => {
    A.startScope(e);
    try {
      const i = s(...o);
      return ii(i) && console.error("Cannot return a Promise inside of tidy."), A.endScope(i), i;
    } catch (i) {
      throw A.endScope(null), i;
    }
  };
  return Object.defineProperty(r, "name", { value: e, configurable: !0 }), r;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Mp(n, t, e = 0) {
  const s = $(n, "x", "pad");
  if (s.rank === 0)
    throw new Error("pad(scalar) is not defined. Pass non-scalar to pad");
  const r = { paddings: t, constantValue: e }, o = { x: s };
  return A.runKernel(Kl, o, r);
}
const Bp = /* @__PURE__ */ C({ pad_: Mp });
function Fp(n, t, e = 0) {
  return w(t.length === 4 && t[0].length === 2 && t[1].length === 2 && t[2].length === 2 && t[3].length === 2, () => "Invalid number of paddings. Must be length of 2 each."), Bp(n, t, e);
}
const zp = /* @__PURE__ */ C({ pad4d_: Fp });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Up(n, t, e) {
  const s = $(n, "x", "slice", "string_or_numeric");
  if (s.rank === 0)
    throw new Error("Slicing scalar is not possible");
  const r = { x: s }, o = { begin: t, size: e };
  return A.runKernel(Xl, r, o);
}
const At = /* @__PURE__ */ C({ slice_: Up });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wp(n, t, e) {
  const s = $(n, "x", "slice4d");
  return w(s.rank === 4, () => `slice4d expects a rank-4 tensor, but got a rank-${s.rank} tensor`), At(s, t, e);
}
const ws = /* @__PURE__ */ C({ slice4d_: Wp });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Gp(n) {
  const e = { x: $(n, "x", "clone", "string_or_numeric") };
  return A.runKernel(li, e);
}
const sn = /* @__PURE__ */ C({ clone_: Gp });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vp(n, t = 0) {
  w(n.length >= 1, () => "Pass at least one tensor to concat");
  const e = gu(n, "tensors", "concat", "string_or_numeric");
  if (e[0].dtype === "complex64" && e.forEach((o) => {
    if (o.dtype !== "complex64")
      throw new Error(`Cannot concatenate complex64 tensors with a tensor
          with dtype ${o.dtype}. `);
  }), e.length === 1)
    return sn(e[0]);
  const s = e, r = { axis: t };
  return A.runKernel(jl, s, r);
}
const rn = /* @__PURE__ */ C({ concat_: Vp });
function qp(n, t) {
  return rn(n, t);
}
const jp = /* @__PURE__ */ C({ concat4d_: qp });
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hp() {
  return typeof window < "u" && window.document != null || //@ts-ignore
  typeof WorkerGlobalScope < "u";
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Pt = V();
Pt.registerFlag("DEBUG", () => !1, (n) => {
  n && console.warn("Debugging mode is ON. The output of every math call will be downloaded to CPU and checked for NaNs. This significantly impacts performance.");
});
Pt.registerFlag("IS_BROWSER", () => Hp());
Pt.registerFlag("IS_NODE", () => typeof process < "u" && typeof process.versions < "u" && typeof process.versions.node < "u");
Pt.registerFlag("IS_CHROME", () => typeof navigator < "u" && navigator != null && navigator.userAgent != null && /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor));
Pt.registerFlag("IS_SAFARI", () => typeof navigator < "u" && navigator != null && navigator.userAgent != null && /Safari/.test(navigator.userAgent) && /Apple/.test(navigator.vendor));
Pt.registerFlag("PROD", () => !1);
Pt.registerFlag("TENSORLIKE_CHECK_SHAPE_CONSISTENCY", () => Pt.getBool("DEBUG"));
Pt.registerFlag("DEPRECATION_WARNINGS_ENABLED", () => !0);
Pt.registerFlag("IS_TEST", () => !1);
Pt.registerFlag("CHECK_COMPUTATION_FOR_ERRORS", () => Pt.getBool("DEBUG"));
Pt.registerFlag("WRAP_TO_IMAGEBITMAP", () => !1);
Pt.registerFlag("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU", () => !1);
Pt.registerFlag("USE_SETTIMEOUTCUSTOM", () => !1);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Kp(n, t) {
  const e = $(n, "real", "complex"), s = $(t, "imag", "complex");
  Ef(e.shape, s.shape, `real and imag shapes, ${e.shape} and ${s.shape}, must match in call to tf.complex().`);
  const r = { real: e, imag: s };
  return A.runKernel(Hf, r);
}
const hi = /* @__PURE__ */ C({ complex_: Kp });
class Gn {
  /**
   * Concatenate a number of ArrayBuffers into one.
   *
   * @param buffers An array of ArrayBuffers to concatenate, or a single
   *     ArrayBuffer.
   * @returns Result of concatenating `buffers` in order.
   */
  static join(t) {
    return new Gn(t).slice();
  }
  constructor(t) {
    if (this.shards = [], this.previousShardIndex = 0, t == null || (t instanceof Array || (t = [t]), t = t.map((s) => re(s) ? s.buffer : s), t.length === 0))
      return;
    this.bufferUniformSize = t[0].byteLength;
    let e = 0;
    for (let s = 0; s < t.length; s++) {
      const r = t[s];
      s !== t.length - 1 && r.byteLength !== this.bufferUniformSize && (this.bufferUniformSize = void 0);
      const o = e + r.byteLength;
      this.shards.push({ buffer: r, start: e, end: o }), e = o;
    }
    this.shards.length === 0 && (this.byteLength = 0), this.byteLength = this.shards[this.shards.length - 1].end;
  }
  slice(t = 0, e = this.byteLength) {
    if (this.shards.length === 0)
      return new ArrayBuffer(0);
    if (t = isNaN(Number(t)) ? 0 : t, e = isNaN(Number(e)) ? 0 : e, t = Math.max(0, t), e = Math.min(this.byteLength, e), e <= t)
      return new ArrayBuffer(0);
    const s = this.findShardForByte(t);
    if (s === -1)
      throw new Error(`Could not find start shard for byte ${t}`);
    const r = e - t, o = new ArrayBuffer(r), i = new Uint8Array(o);
    let a = 0;
    for (let l = s; l < this.shards.length; l++) {
      const u = this.shards[l], h = t + a - u.start, f = a, p = Math.min(e, u.end) - u.start, g = new Uint8Array(u.buffer, h, p - h);
      if (i.set(g, f), a += g.length, e < u.end)
        break;
    }
    return o;
  }
  /**
   * Get the index of the shard that contains the byte at `byteIndex`.
   */
  findShardForByte(t) {
    if (this.shards.length === 0 || t < 0 || t >= this.byteLength)
      return -1;
    if (this.bufferUniformSize != null)
      return this.previousShardIndex = Math.floor(t / this.bufferUniformSize), this.previousShardIndex;
    function e(r) {
      return t < r.start ? -1 : t >= r.end ? 1 : 0;
    }
    if (e(this.shards[this.previousShardIndex]) === 0)
      return this.previousShardIndex;
    const s = Yp(this.shards, e);
    return s === -1 ? -1 : (this.previousShardIndex = s, this.previousShardIndex);
  }
}
function Yp(n, t) {
  let e = 0, s = n.length;
  for (; e <= s; ) {
    const r = Math.floor((s - e) / 2) + e, o = t(n[r]);
    if (o === 0)
      return r;
    o < 0 ? s = r : e = r + 1;
  }
  return -1;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function uo() {
  return A;
}
function Ca() {
  return A.memory();
}
function _(n, t) {
  return A.tidy(n, t);
}
function ut(n) {
  fu(n).forEach((e) => e.dispose());
}
function Pn(n) {
  return A.keep(n);
}
function Xp(n, t, e = 1) {
  return A.registerBackend(n, t, e);
}
function Jp() {
  return A.backend;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ka = 4;
async function Ta(n, t) {
  const e = [], s = [], r = Array.isArray(n) ? n.map((i) => i.name) : Object.keys(n);
  for (let i = 0; i < r.length; ++i) {
    const a = r[i], l = Array.isArray(n) ? n[i].tensor : n[a];
    if (l.dtype !== "float32" && l.dtype !== "int32" && l.dtype !== "bool" && l.dtype !== "string" && l.dtype !== "complex64")
      throw new Error(`Unsupported dtype in weight '${a}': ${l.dtype}`);
    const u = { name: a, shape: l.shape, dtype: l.dtype };
    if (l.dtype === "string") {
      const c = new Promise(async (h) => {
        const f = await l.bytes(), d = f.reduce((m, b) => m + b.length, 0) + ka * f.length, p = new Uint8Array(d);
        let g = 0;
        for (let m = 0; m < f.length; m++) {
          const b = f[m], y = new Uint8Array(new Uint32Array([b.length]).buffer);
          p.set(y, g), g += ka, p.set(b, g), g += b.length;
        }
        h(p);
      });
      s.push(c);
    } else
      s.push(l.data());
    t != null && (u.group = t), e.push(u);
  }
  const o = await Promise.all(s);
  return { data: Zp(o), specs: e };
}
function Zp(n) {
  if (n === null)
    throw new Error(`Invalid input value: ${JSON.stringify(n)}`);
  let t = 0;
  const e = [];
  n.forEach((o) => {
    if (t += o.byteLength, e.push(o.byteLength === o.buffer.byteLength ? o : new o.constructor(o)), !(o instanceof Float32Array || o instanceof Int32Array || o instanceof Uint8Array))
      throw new Error(`Unsupported TypedArray subtype: ${o.constructor.name}`);
  });
  const s = new Uint8Array(t);
  let r = 0;
  return e.forEach((o) => {
    s.set(new Uint8Array(o.buffer), r), r += o.byteLength;
  }), s.buffer;
}
const fi = typeof Buffer < "u" && (typeof Blob > "u" || typeof atob > "u" || typeof btoa > "u");
function Na(n) {
  return fi ? Buffer.byteLength(n, "utf8") : new Blob([n]).size;
}
function Qp(n) {
  if (fi)
    return Buffer.from(n).toString("base64");
  const t = new Uint8Array(n);
  let e = "";
  for (let s = 0, r = t.length; s < r; s++)
    e += String.fromCharCode(t[s]);
  return btoa(e);
}
function tm(n) {
  if (fi) {
    const s = Buffer.from(n, "base64");
    return s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength);
  }
  const t = atob(n), e = new Uint8Array(t.length);
  for (let s = 0; s < t.length; ++s)
    e.set([t.charCodeAt(s)], s);
  return e.buffer;
}
function em(n) {
  return Gn.join(n);
}
function bu(n) {
  if (n.modelTopology instanceof ArrayBuffer)
    throw new Error("Expected JSON model topology, received ArrayBuffer.");
  return {
    dateSaved: /* @__PURE__ */ new Date(),
    modelTopologyType: "JSON",
    modelTopologyBytes: n.modelTopology == null ? 0 : Na(JSON.stringify(n.modelTopology)),
    weightSpecsBytes: n.weightSpecs == null ? 0 : Na(JSON.stringify(n.weightSpecs)),
    weightDataBytes: n.weightData == null ? 0 : new Gn(n.weightData).byteLength
  };
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Ct {
  constructor() {
    this.saveRouters = [], this.loadRouters = [];
  }
  static getInstance() {
    return Ct.instance == null && (Ct.instance = new Ct()), Ct.instance;
  }
  /**
   * Register a save-handler router.
   *
   * @param saveRouter A function that maps a URL-like string onto an instance
   * of `IOHandler` with the `save` method defined or `null`.
   */
  static registerSaveRouter(t) {
    Ct.getInstance().saveRouters.push(t);
  }
  /**
   * Register a load-handler router.
   *
   * @param loadRouter A function that maps a URL-like string onto an instance
   * of `IOHandler` with the `load` method defined or `null`.
   */
  static registerLoadRouter(t) {
    Ct.getInstance().loadRouters.push(t);
  }
  /**
   * Look up IOHandler for saving, given a URL-like string.
   *
   * @param url
   * @returns If only one match is found, an instance of IOHandler with the
   * `save` method defined. If no match is found, `null`.
   * @throws Error, if more than one match is found.
   */
  static getSaveHandlers(t) {
    return Ct.getHandlers(t, "save");
  }
  /**
   * Look up IOHandler for loading, given a URL-like string.
   *
   * @param url
   * @param loadOptions Optional, custom load options.
   * @returns All valid handlers for `url`, given the currently registered
   *   handler routers.
   */
  static getLoadHandlers(t, e) {
    return Ct.getHandlers(t, "load", e);
  }
  static getHandlers(t, e, s) {
    const r = [];
    return (e === "load" ? Ct.getInstance().loadRouters : Ct.getInstance().saveRouters).forEach((i) => {
      const a = i(t, s);
      a !== null && r.push(a);
    }), r;
  }
}
const nm = (n) => Ct.getSaveHandlers(n);
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Bo = "tensorflowjs", Fo = 1, en = "models_store", ze = "model_info_store";
function yu() {
  if (!V().getBool("IS_BROWSER"))
    throw new Error("Failed to obtain IndexedDB factory because the current environmentis not a web browser.");
  const n = typeof window > "u" ? self : window, t = n.indexedDB || n.mozIndexedDB || n.webkitIndexedDB || n.msIndexedDB || n.shimIndexedDB;
  if (t == null)
    throw new Error("The current browser does not appear to support IndexedDB.");
  return t;
}
function zo(n) {
  const t = n.result;
  t.createObjectStore(en, { keyPath: "modelPath" }), t.createObjectStore(ze, { keyPath: "modelPath" });
}
class dn {
  constructor(t) {
    if (this.indexedDB = yu(), t == null || !t)
      throw new Error("For IndexedDB, modelPath must not be null, undefined or empty.");
    this.modelPath = t;
  }
  async save(t) {
    if (t.modelTopology instanceof ArrayBuffer)
      throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");
    return this.databaseAction(this.modelPath, t);
  }
  async load() {
    return this.databaseAction(this.modelPath);
  }
  /**
   * Perform database action to put model artifacts into or read model artifacts
   * from IndexedDB object store.
   *
   * Whether the action is put or get depends on whether `modelArtifacts` is
   * specified. If it is specified, the action will be put; otherwise the action
   * will be get.
   *
   * @param modelPath A unique string path for the model.
   * @param modelArtifacts If specified, it will be the model artifacts to be
   *   stored in IndexedDB.
   * @returns A `Promise` of `SaveResult`, if the action is put, or a `Promise`
   *   of `ModelArtifacts`, if the action is get.
   */
  databaseAction(t, e) {
    return new Promise((s, r) => {
      const o = this.indexedDB.open(Bo, Fo);
      o.onupgradeneeded = () => zo(o), o.onsuccess = () => {
        const i = o.result;
        if (e == null) {
          const a = i.transaction(en, "readonly"), u = a.objectStore(en).get(this.modelPath);
          u.onsuccess = () => {
            if (u.result == null)
              return i.close(), r(new Error(`Cannot find model with path '${this.modelPath}' in IndexedDB.`));
            s(u.result.modelArtifacts);
          }, u.onerror = (c) => (i.close(), r(u.error)), a.oncomplete = () => i.close();
        } else {
          e.weightData = Gn.join(e.weightData);
          const a = bu(e), l = i.transaction(ze, "readwrite");
          let u = l.objectStore(ze), c;
          try {
            c = u.put({ modelPath: this.modelPath, modelArtifactsInfo: a });
          } catch (f) {
            return r(f);
          }
          let h;
          c.onsuccess = () => {
            h = i.transaction(en, "readwrite");
            const f = h.objectStore(en);
            let d;
            try {
              d = f.put({
                modelPath: this.modelPath,
                modelArtifacts: e,
                modelArtifactsInfo: a
              });
            } catch (p) {
              return r(p);
            }
            d.onsuccess = () => s({ modelArtifactsInfo: a }), d.onerror = (p) => {
              u = l.objectStore(ze);
              const g = u.delete(this.modelPath);
              g.onsuccess = () => (i.close(), r(d.error)), g.onerror = (m) => (i.close(), r(d.error));
            };
          }, c.onerror = (f) => (i.close(), r(c.error)), l.oncomplete = () => {
            h == null ? i.close() : h.oncomplete = () => i.close();
          };
        }
      }, o.onerror = (i) => r(o.error);
    });
  }
}
dn.URL_SCHEME = "indexeddb://";
const wu = (n) => V().getBool("IS_BROWSER") && !Array.isArray(n) && n.startsWith(dn.URL_SCHEME) ? sm(n.slice(dn.URL_SCHEME.length)) : null;
Ct.registerSaveRouter(wu);
Ct.registerLoadRouter(wu);
function sm(n) {
  return new dn(n);
}
function rm(n) {
  return n.startsWith(dn.URL_SCHEME) ? n.slice(dn.URL_SCHEME.length) : n;
}
class om {
  constructor() {
    this.indexedDB = yu();
  }
  async listModels() {
    return new Promise((t, e) => {
      const s = this.indexedDB.open(Bo, Fo);
      s.onupgradeneeded = () => zo(s), s.onsuccess = () => {
        const r = s.result, o = r.transaction(ze, "readonly"), a = o.objectStore(ze).getAll();
        a.onsuccess = () => {
          const l = {};
          for (const u of a.result)
            l[u.modelPath] = u.modelArtifactsInfo;
          t(l);
        }, a.onerror = (l) => (r.close(), e(a.error)), o.oncomplete = () => r.close();
      }, s.onerror = (r) => e(s.error);
    });
  }
  async removeModel(t) {
    return t = rm(t), new Promise((e, s) => {
      const r = this.indexedDB.open(Bo, Fo);
      r.onupgradeneeded = () => zo(r), r.onsuccess = () => {
        const o = r.result, i = o.transaction(ze, "readwrite"), a = i.objectStore(ze), l = a.get(t);
        let u;
        l.onsuccess = () => {
          if (l.result == null)
            return o.close(), s(new Error(`Cannot find model with path '${t}' in IndexedDB.`));
          {
            const c = a.delete(t), h = () => {
              u = o.transaction(en, "readwrite");
              const d = u.objectStore(en).delete(t);
              d.onsuccess = () => e(l.result.modelArtifactsInfo), d.onerror = (p) => s(l.error);
            };
            c.onsuccess = h, c.onerror = (f) => (h(), o.close(), s(l.error));
          }
        }, l.onerror = (c) => (o.close(), s(l.error)), i.oncomplete = () => {
          u == null ? o.close() : u.oncomplete = () => o.close();
        };
      }, r.onerror = (o) => s(r.error);
    });
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Re = "/", kn = "tensorflowjs_models", xu = "info", im = "model_topology", am = "weight_specs", lm = "weight_data", um = "model_metadata";
function Su(n) {
  return {
    info: [kn, n, xu].join(Re),
    topology: [kn, n, im].join(Re),
    weightSpecs: [kn, n, am].join(Re),
    weightData: [kn, n, lm].join(Re),
    modelMetadata: [kn, n, um].join(Re)
  };
}
function vu(n) {
  for (const t of Object.values(n))
    window.localStorage.removeItem(t);
}
function cm(n) {
  const t = n.split(Re);
  if (t.length < 3)
    throw new Error(`Invalid key format: ${n}`);
  return t.slice(1, t.length - 1).join(Re);
}
function hm(n) {
  return n.startsWith(pn.URL_SCHEME) ? n.slice(pn.URL_SCHEME.length) : n;
}
class pn {
  constructor(t) {
    if (!V().getBool("IS_BROWSER") || typeof window > "u" || typeof window.localStorage > "u")
      throw new Error("The current environment does not support local storage.");
    if (this.LS = window.localStorage, t == null || !t)
      throw new Error("For local storage, modelPath must not be null, undefined or empty.");
    this.modelPath = t, this.keys = Su(this.modelPath);
  }
  /**
   * Save model artifacts to browser local storage.
   *
   * See the documentation to `browserLocalStorage` for details on the saved
   * artifacts.
   *
   * @param modelArtifacts The model artifacts to be stored.
   * @returns An instance of SaveResult.
   */
  async save(t) {
    if (t.modelTopology instanceof ArrayBuffer)
      throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");
    {
      const e = JSON.stringify(t.modelTopology), s = JSON.stringify(t.weightSpecs), r = bu(t), o = Gn.join(t.weightData);
      try {
        this.LS.setItem(this.keys.info, JSON.stringify(r)), this.LS.setItem(this.keys.topology, e), this.LS.setItem(this.keys.weightSpecs, s), this.LS.setItem(this.keys.weightData, Qp(o));
        const i = {
          format: t.format,
          generatedBy: t.generatedBy,
          convertedBy: t.convertedBy,
          signature: t.signature != null ? t.signature : void 0,
          userDefinedMetadata: t.userDefinedMetadata != null ? t.userDefinedMetadata : void 0,
          modelInitializer: t.modelInitializer != null ? t.modelInitializer : void 0,
          initializerSignature: t.initializerSignature != null ? t.initializerSignature : void 0,
          trainingConfig: t.trainingConfig != null ? t.trainingConfig : void 0
        };
        return this.LS.setItem(this.keys.modelMetadata, JSON.stringify(i)), { modelArtifactsInfo: r };
      } catch {
        throw vu(this.keys), new Error(`Failed to save model '${this.modelPath}' to local storage: size quota being exceeded is a possible cause of this failure: modelTopologyBytes=${r.modelTopologyBytes}, weightSpecsBytes=${r.weightSpecsBytes}, weightDataBytes=${r.weightDataBytes}.`);
      }
    }
  }
  /**
   * Load a model from local storage.
   *
   * See the documentation to `browserLocalStorage` for details on the saved
   * artifacts.
   *
   * @returns The loaded model (if loading succeeds).
   */
  async load() {
    const t = JSON.parse(this.LS.getItem(this.keys.info));
    if (t == null)
      throw new Error(`In local storage, there is no model with name '${this.modelPath}'`);
    if (t.modelTopologyType !== "JSON")
      throw new Error("BrowserLocalStorage does not support loading non-JSON model topology yet.");
    const e = {}, s = JSON.parse(this.LS.getItem(this.keys.topology));
    if (s == null)
      throw new Error(`In local storage, the topology of model '${this.modelPath}' is missing.`);
    e.modelTopology = s;
    const r = JSON.parse(this.LS.getItem(this.keys.weightSpecs));
    if (r == null)
      throw new Error(`In local storage, the weight specs of model '${this.modelPath}' are missing.`);
    e.weightSpecs = r;
    const o = this.LS.getItem(this.keys.modelMetadata);
    if (o != null) {
      const a = JSON.parse(o);
      e.format = a.format, e.generatedBy = a.generatedBy, e.convertedBy = a.convertedBy, a.signature != null && (e.signature = a.signature), a.userDefinedMetadata != null && (e.userDefinedMetadata = a.userDefinedMetadata), a.modelInitializer != null && (e.modelInitializer = a.modelInitializer), a.initializerSignature != null && (e.initializerSignature = a.initializerSignature), a.trainingConfig != null && (e.trainingConfig = a.trainingConfig);
    }
    const i = this.LS.getItem(this.keys.weightData);
    if (i == null)
      throw new Error(`In local storage, the binary weight values of model '${this.modelPath}' are missing.`);
    return e.weightData = tm(i), e;
  }
}
pn.URL_SCHEME = "localstorage://";
const Iu = (n) => V().getBool("IS_BROWSER") && !Array.isArray(n) && n.startsWith(pn.URL_SCHEME) ? fm(n.slice(pn.URL_SCHEME.length)) : null;
Ct.registerSaveRouter(Iu);
Ct.registerLoadRouter(Iu);
function fm(n) {
  return new pn(n);
}
class dm {
  constructor() {
    w(V().getBool("IS_BROWSER"), () => "Current environment is not a web browser"), w(typeof window > "u" || typeof window.localStorage < "u", () => "Current browser does not appear to support localStorage"), this.LS = window.localStorage;
  }
  async listModels() {
    const t = {}, e = kn + Re, s = Re + xu;
    for (let r = 0; r < this.LS.length; ++r) {
      const o = this.LS.key(r);
      if (o.startsWith(e) && o.endsWith(s)) {
        const i = cm(o);
        t[i] = JSON.parse(this.LS.getItem(o));
      }
    }
    return t;
  }
  async removeModel(t) {
    t = hm(t);
    const e = Su(t);
    if (this.LS.getItem(e.info) == null)
      throw new Error(`Cannot find model at path '${t}'`);
    const s = JSON.parse(this.LS.getItem(e.info));
    return vu(e), s;
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Da = "://";
class ve {
  constructor() {
    this.managers = {};
  }
  static getInstance() {
    return ve.instance == null && (ve.instance = new ve()), ve.instance;
  }
  /**
   * Register a save-handler router.
   *
   * @param saveRouter A function that maps a URL-like string onto an instance
   * of `IOHandler` with the `save` method defined or `null`.
   */
  static registerManager(t, e) {
    w(t != null, () => "scheme must not be undefined or null."), t.endsWith(Da) && (t = t.slice(0, t.indexOf(Da))), w(t.length > 0, () => "scheme must not be an empty string.");
    const s = ve.getInstance();
    w(s.managers[t] == null, () => `A model store manager is already registered for scheme '${t}'.`), s.managers[t] = e;
  }
  static getManager(t) {
    const e = ve.getInstance().managers[t];
    if (e == null)
      throw new Error(`Cannot find model manager for scheme '${t}'`);
    return e;
  }
  static getSchemes() {
    return Object.keys(ve.getInstance().managers);
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class pm {
  constructor() {
    this.messageName = "setTimeoutCustom", this.functionRefs = [], this.handledMessageCount = 0, this.hasEventListener = !1;
  }
  fetch(t, e) {
    return fetch(t, e);
  }
  now() {
    return performance.now();
  }
  encode(t, e) {
    if (e !== "utf-8" && e !== "utf8")
      throw new Error(`Browser's encoder only supports utf-8, but got ${e}`);
    return this.textEncoder == null && (this.textEncoder = new TextEncoder()), this.textEncoder.encode(t);
  }
  decode(t, e) {
    return new TextDecoder(e).decode(t);
  }
  // If the setTimeout nesting level is greater than 5 and timeout is less
  // than 4ms, timeout will be clamped to 4ms, which hurts the perf.
  // Interleaving window.postMessage and setTimeout will trick the browser and
  // avoid the clamp.
  setTimeoutCustom(t, e) {
    if (typeof window > "u" || !V().getBool("USE_SETTIMEOUTCUSTOM")) {
      setTimeout(t, e);
      return;
    }
    this.functionRefs.push(t), setTimeout(() => {
      window.postMessage({ name: this.messageName, index: this.functionRefs.length - 1 }, "*");
    }, e), this.hasEventListener || (this.hasEventListener = !0, window.addEventListener("message", (s) => {
      if (s.source === window && s.data.name === this.messageName) {
        s.stopPropagation();
        const r = this.functionRefs[s.data.index];
        r(), this.handledMessageCount++, this.handledMessageCount === this.functionRefs.length && (this.functionRefs = [], this.handledMessageCount = 0);
      }
    }, !0));
  }
  isTypedArray(t) {
    return Ql(t);
  }
}
if (V().get("IS_BROWSER")) {
  V().setPlatform("browser", new pm());
  try {
    ve.registerManager(pn.URL_SCHEME, new dm());
  } catch {
  }
  try {
    ve.registerManager(dn.URL_SCHEME, new om());
  } catch {
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const mm = {
  // tslint:disable-next-line:no-require-imports
  importFetch: () => require("node-fetch")
};
let co;
class gm {
  constructor() {
    this.util = require("util"), this.textEncoder = new this.util.TextEncoder();
  }
  fetch(t, e) {
    return V().global.fetch != null ? V().global.fetch(t, e) : (co == null && (co = mm.importFetch()), co(t, e));
  }
  now() {
    const t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  }
  encode(t, e) {
    if (e !== "utf-8" && e !== "utf8")
      throw new Error(`Node built-in encoder only supports utf-8, but got ${e}`);
    return this.textEncoder.encode(t);
  }
  decode(t, e) {
    return t.length === 0 ? "" : new this.util.TextDecoder(e).decode(t);
  }
  isTypedArray(t) {
    return this.util.types.isFloat32Array(t) || this.util.types.isInt32Array(t) || this.util.types.isUint8Array(t) || this.util.types.isUint8ClampedArray(t);
  }
}
V().get("IS_NODE") && !V().get("IS_BROWSER") && V().setPlatform("node", new gm());
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function vt(n, t = "float32", e) {
  return t = t || "float32", Me(n), new ur(n, t, e);
}
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function bm(n, t) {
  const e = $(n, "x", "cast");
  if (!Tf(t))
    throw new Error(`Failed to cast to unknown dtype ${t}`);
  if (t === "string" && e.dtype !== "string" || t !== "string" && e.dtype === "string")
    throw new Error("Only strings can be casted to strings");
  const s = { x: e }, r = { dtype: t };
  return A.runKernel(ql, s, r);
}
const ot = /* @__PURE__ */ C({ cast_: bm });
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ym(n, t = !1) {
  console.log(n.toString(t));
}
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
pu();
const wm = {
  buffer: vt,
  cast: ot,
  clone: sn,
  print: ym
};
Tp(wm);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xm(n, t) {
  let e = $(n, "a", "add"), s = $(t, "b", "add");
  [e, s] = Rt(e, s);
  const r = { a: e, b: s };
  return A.runKernel(Vl, r);
}
const M = /* @__PURE__ */ C({ add_: xm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Sm(n, t) {
  let e = $(n, "a", "floorDiv"), s = $(t, "b", "floorDiv");
  [e, s] = Rt(e, s);
  const r = { a: e, b: s };
  return A.runKernel(fd, r);
}
const vm = /* @__PURE__ */ C({ floorDiv_: Sm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Im(n, t) {
  let e = $(n, "a", "div"), s = $(t, "b", "div");
  if ([e, s] = Rt(e, s), e.dtype === "int32" && s.dtype === "int32")
    return vm(e, s);
  const r = { a: e, b: s }, o = {};
  return A.runKernel(nd, r, o);
}
const Y = /* @__PURE__ */ C({ div_: Im });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $m(n, t) {
  let e = $(n, "a", "mul"), s = $(t, "b", "mul");
  [e, s] = Rt(e, s);
  const r = { a: e, b: s };
  return A.runKernel(Td, r);
}
const N = /* @__PURE__ */ C({ mul_: $m });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Am(n) {
  const t = $(n, "x", "abs");
  if (t.dtype === "complex64") {
    const e = { x: t };
    return A.runKernel(Kf, e);
  } else {
    const e = { x: t };
    return A.runKernel(Ff, e);
  }
}
const Nt = /* @__PURE__ */ C({ abs_: Am });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Em(n, t = null, e = !1) {
  const r = { x: $(n, "x", "all", "bool") }, o = { axis: t, keepDims: e };
  return A.runKernel(zf, r, o);
}
const _m = /* @__PURE__ */ C({ all_: Em });
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Cm(n, t = 0) {
  const s = { x: $(n, "x", "argMax") }, r = { axis: t };
  return A.runKernel(Uf, s, r);
}
const hr = /* @__PURE__ */ C({ argMax_: Cm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function km(n, t, e, s, r, o, i = "channelsLast") {
  const [a, l] = xs(t);
  let u;
  if (i === "channelsLast")
    u = [a, l, n[3], n[3]];
  else if (i === "channelsFirst")
    u = [a, l, n[1], n[1]];
  else
    throw new Error(`Unknown dataFormat ${i}`);
  return di(n, u, e, s, r, o, !1, i);
}
function di(n, t, e, s, r, o, i = !1, a = "channelsLast") {
  let [l, u, c, h] = [-1, -1, -1, -1];
  if (a === "channelsLast")
    [l, u, c, h] = n;
  else if (a === "channelsFirst")
    [l, h, u, c] = n;
  else
    throw new Error(`Unknown dataFormat ${a}`);
  const [f, d, , p] = t, [g, m] = xs(e), [b, y] = xs(s), S = Uo(f, b), x = Uo(d, y), { padInfo: v, outHeight: E, outWidth: D } = Dm(r, u, c, g, m, S, x, o, a), k = i ? p * h : p;
  let T;
  return a === "channelsFirst" ? T = [l, k, E, D] : a === "channelsLast" && (T = [l, E, D, k]), {
    batchSize: l,
    dataFormat: a,
    inHeight: u,
    inWidth: c,
    inChannels: h,
    outHeight: E,
    outWidth: D,
    outChannels: k,
    padInfo: v,
    strideHeight: g,
    strideWidth: m,
    filterHeight: f,
    filterWidth: d,
    effectiveFilterHeight: S,
    effectiveFilterWidth: x,
    dilationHeight: b,
    dilationWidth: y,
    inShape: n,
    outShape: T,
    filterShape: t
  };
}
function Tm(n, t, e, s, r) {
  s == null && (s = Nm(n, t, e));
  const o = n[0], i = n[1], a = fr((o - t + 2 * s) / e + 1, r), l = fr((i - t + 2 * s) / e + 1, r);
  return [a, l];
}
function Nm(n, t, e, s = 1) {
  const r = Uo(t, s);
  return Math.floor((n[0] * (e - 1) - e + r) / 2);
}
function xs(n) {
  return typeof n == "number" ? [n, n, n] : n.length === 2 ? [n[0], n[1], 1] : n;
}
function Uo(n, t) {
  return t <= 1 ? n : n + (n - 1) * (t - 1);
}
function Dm(n, t, e, s, r, o, i, a, l) {
  let u, c, h;
  if (typeof n == "number") {
    u = { top: n, bottom: n, left: n, right: n, type: n === 0 ? "VALID" : "NUMBER" };
    const d = Tm([t, e], o, s, n, a);
    c = d[0], h = d[1];
  } else if (n === "same") {
    c = Math.ceil(t / s), h = Math.ceil(e / r);
    const f = Math.max(0, (c - 1) * s + o - t), d = Math.max(0, (h - 1) * r + i - e), p = Math.floor(f / 2), g = f - p, m = Math.floor(d / 2), b = d - m;
    u = { top: p, bottom: g, left: m, right: b, type: "SAME" };
  } else if (n === "valid")
    u = { top: 0, bottom: 0, left: 0, right: 0, type: "VALID" }, c = Math.ceil((t - o + 1) / s), h = Math.ceil((e - i + 1) / r);
  else if (typeof n == "object") {
    const f = l === "channelsLast" ? n[1][0] : n[2][0], d = l === "channelsLast" ? n[1][1] : n[2][1], p = l === "channelsLast" ? n[2][0] : n[3][0], g = l === "channelsLast" ? n[2][1] : n[3][1];
    u = { top: f, bottom: d, left: p, right: g, type: f === 0 && d === 0 && p === 0 && g === 0 ? "VALID" : "EXPLICIT" }, c = fr((t - o + f + d) / s + 1, a), h = fr((e - i + p + g) / r + 1, a);
  } else
    throw Error(`Unknown padding parameter: ${n}`);
  return { padInfo: u, outHeight: c, outWidth: h };
}
function fr(n, t) {
  if (!t)
    return Math.trunc(n);
  switch (t) {
    case "round":
      return Math.round(n);
    case "ceil":
      return Math.ceil(n);
    case "floor":
      return Math.floor(n);
    default:
      throw new Error(`Unknown roundingMode ${t}`);
  }
}
function Wo(n) {
  const [t, e, s] = xs(n);
  return t === 1 && e === 1 && s === 1;
}
function Vn(n, t) {
  return Wo(n) || Wo(t);
}
function Bn(n) {
  return xs(n).every((t) => t > 0);
}
function Pm(n) {
  if (n === "NHWC")
    return "channelsLast";
  if (n === "NCHW")
    return "channelsFirst";
  throw new Error(`Unknown dataFormat ${n}`);
}
function Te(n, t, e) {
  if (e != null) {
    if (typeof t == "string")
      throw Error(`Error in ${n}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);
    if (typeof t == "number")
      w(Eo(t), () => `Error in ${n}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);
    else if (typeof t == "object")
      t.forEach((s) => {
        s.forEach((r) => {
          w(Eo(r), () => `Error in ${n}: pad must be an integer when using dimRoundingMode ${e} but got pad ${r}.`);
        });
      });
    else
      throw Error(`Error in ${n}: Unknown padding parameter: ${t}`);
  }
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Rm(n, t) {
  const s = { x: $(n, "x", "reshape", "string_or_numeric") }, r = { shape: t };
  return A.runKernel(Gd, s, r);
}
const L = /* @__PURE__ */ C({ reshape_: Rm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Lm(n, t, e, s, r) {
  const o = $(n, "x", "avgPool", "float32"), i = 1;
  w(Vn(e, i), () => `Error in avgPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${i}'`);
  let a = o, l = !1;
  o.rank === 3 && (l = !0, a = L(o, [1, o.shape[0], o.shape[1], o.shape[2]])), w(a.rank === 4, () => `Error in avgPool: x must be rank 4 but got rank ${a.rank}.`), Te("avgPool", s, r);
  const u = { x: a }, c = { filterSize: t, strides: e, pad: s, dimRoundingMode: r };
  let h = A.runKernel(Wf, u, c);
  return h = ot(h, o.dtype), l ? L(h, [h.shape[1], h.shape[2], h.shape[3]]) : h;
}
const Om = /* @__PURE__ */ C({ avgPool_: Lm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Mm(n, t, e, s, r, o = "NDHWC") {
  const i = $(n, "x", "avgPool3d", "float32");
  let a = i, l = !1;
  i.rank === 4 && (l = !0, a = L(i, [1, i.shape[0], i.shape[1], i.shape[2], i.shape[3]])), w(a.rank === 5, () => `Error in avgPool3d: x must be rank 5 but got rank ${a.rank}.`), w(o === "NDHWC", () => `Error in avgPool3d: Only NDHWC is currently supported, but got dataFormat of ${o}`), w(typeof e == "number" && e > 0 || Array.isArray(e) && e[0] > 0 && e[1] > 0 && e[2] > 0, () => `Error in avgPool3d: Stride must be > 0, but got '${e}'`), Te("avgPool3d", s, r);
  const u = { x: a }, c = { filterSize: t, strides: e, pad: s, dimRoundingMode: r, dataFormat: o };
  let h = A.runKernel(Gf, u, c);
  return h = ot(h, a.dtype), l ? L(h, [h.shape[1], h.shape[2], h.shape[3], h.shape[4]]) : h;
}
const Bm = /* @__PURE__ */ C({ avgPool3d_: Mm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Fm(n, t, e = !1, s = !1) {
  let r = $(n, "a", "matMul"), o = $(t, "b", "matMul");
  [r, o] = Rt(r, o);
  const i = { a: r, b: o }, a = { transposeA: e, transposeB: s };
  return A.runKernel(Vf, i, a);
}
const we = /* @__PURE__ */ C({ matMul_: Fm });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zm(n) {
  const e = { x: $(n, "x", "sigmoid", "float32") };
  return A.runKernel(Yd, e);
}
const pi = /* @__PURE__ */ C({ sigmoid_: zm });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Um(n) {
  const e = { x: $(n, "x", "tanh", "float32") };
  return A.runKernel(np, e);
}
const mi = /* @__PURE__ */ C({ tanh_: Um });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wm(n, t, e) {
  const s = $(n, "x", "bincount"), r = $(t, "weights", "bincount");
  w(s.dtype === "int32", () => `Error in bincount: input dtype must be int32, but got ${s.dtype}`), w(e >= 0, () => `size must be non-negative, but got ${e}.`), w(r.size === s.size || r.size === 0, () => `Error in bincount: weights must have the same size as input or0-length, but got input shape: ${s.shape}, weights shape: ${r.shape}.`);
  const o = { x: s, weights: r }, i = { size: e };
  return A.runKernel(qf, o, i);
}
const Gm = /* @__PURE__ */ C({ bincount_: Wm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vm(n, t) {
  let e = $(n, "broadcastTo", "x");
  const s = e.shape;
  if (Me(t), t.length < e.rank)
    throw new Error(`broadcastTo(): shape.length=${t.length} < input.rank=${e.rank}.`);
  if (t.length > e.rank) {
    const u = e.shape.slice();
    for (; u.length < t.length; )
      u.unshift(1);
    e = L(e, u);
  }
  const r = e.shape, o = Array.from(t);
  for (let u = t.length - 1; u >= 0; u--)
    if (r[u] === t[u])
      o[u] = 1;
    else if (e.shape[u] !== 1)
      throw new Error(`broadcastTo(): [${s}] cannot be broadcast to [${t}].`);
  if (o.map((u, c) => u > 1 ? c : -1).filter((u) => u >= 0).length === 0)
    return sn(e);
  const a = { x: e }, l = { reps: o };
  return A.runKernel(Jl, a, l);
}
const sr = /* @__PURE__ */ C({ broadcastTo_: Vm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vr(n, t, e) {
  Me(n), e = e || Cs(t);
  const s = { shape: n, value: t, dtype: e };
  return A.runKernel(ud, {}, s);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qm(n, t, e) {
  const s = $(n, "x", "clipByValue");
  if (w(t <= e, () => `Error in clip: min (${t}) must be less than or equal to max (${e}).`), t === e)
    return Vr(s.shape, t, s.dtype);
  const r = { x: s }, o = { clipValueMin: t, clipValueMax: e };
  return A.runKernel(jf, r, o);
}
const pe = /* @__PURE__ */ C({ clipByValue_: qm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function jm(n, t, e, s, r = "NHWC", o = [1, 1], i) {
  const a = $(n, "x", "conv2d", "float32"), l = $(t, "filter", "conv2d", "float32");
  let u = a, c = !1;
  a.rank === 3 && (c = !0, u = L(a, [1, a.shape[0], a.shape[1], a.shape[2]])), w(u.rank === 4, () => `Error in conv2d: input must be rank 4, but got rank ${u.rank}.`), w(l.rank === 4, () => `Error in conv2d: filter must be rank 4, but got rank ${l.rank}.`), Te("conv2d", s, i);
  const h = r === "NHWC" ? u.shape[3] : u.shape[1];
  w(h === l.shape[2], () => `Error in conv2d: depth of input (${h}) must match input depth for filter ${l.shape[2]}.`), w(Vn(e, o), () => `Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${o}'`), w(Bn(o), () => "Error in conv2D: Dilated rates should be larger than 0."), w(Bn(e), () => "Error in conv2D: Strides should be larger than 0.");
  const f = { x: u, filter: l }, d = { strides: e, pad: s, dataFormat: r, dilations: o, dimRoundingMode: i }, p = A.runKernel(Yf, f, d);
  return c ? L(p, [p.shape[1], p.shape[2], p.shape[3]]) : p;
}
const gi = /* @__PURE__ */ C({ conv2d_: jm });
function Hm(n, t, e, s, r = "NWC", o = 1, i) {
  const a = $(n, "x", "conv1d"), l = $(t, "filter", "conv1d");
  let u = a, c = !1;
  a.rank === 2 && (c = !0, u = L(a, [1, a.shape[0], a.shape[1]])), w(u.rank === 3, () => `Error in conv1d: input must be rank 3, but got rank ${u.rank}.`), w(l.rank === 3, () => `Error in conv1d: filter must be rank 3, but got rank ${l.rank}.`), Te("conv1d", s, i), w(u.shape[2] === l.shape[1], () => `Error in conv1d: depth of input (${u.shape[2]}) must match input depth for filter ${l.shape[1]}.`), w(Vn(e, o), () => `Error in conv1D: Either stride or dilation must be 1. Got stride ${e} and dilation '${o}'`), w(Bn(o), () => "Error in conv1D: Dilated rates should be larger than 0."), w(Bn(e), () => "Error in conv1D: Stride should be larger than 0."), w(r === "NWC", () => `Error in conv1d: got dataFormat of ${r} but only NWC is currently supported.`);
  const h = L(l, [1, l.shape[0], l.shape[1], l.shape[2]]), f = L(u, [u.shape[0], 1, u.shape[1], u.shape[2]]), m = gi(f, h, [1, e], s, "NHWC", [1, o], i);
  return c ? L(m, [m.shape[2], m.shape[3]]) : L(m, [m.shape[0], m.shape[2], m.shape[3]]);
}
const Km = /* @__PURE__ */ C({ conv1d_: Hm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ym(n, t, e, s, r, o = "NHWC", i) {
  w(n.length === t.rank, () => `Length of inShape (${n.length}) and rank of dy (${t.rank}) must match`);
  let a = n, l = t, u = !1;
  t.rank === 3 && (u = !0, l = L(t, [1, t.shape[0], t.shape[1], t.shape[2]]), a = [1, n[0], n[1], n[2]]), w(a.length === 4, () => `Error in conv2dDerInput: inShape must be length 4, but got length ${a.length}.`), w(l.rank === 4, () => `Error in conv2dDerInput: dy must be rank 4, but got rank ${l.rank}`), w(e.rank === 4, () => `Error in conv2dDerInput: filter must be rank 4, but got rank ${e.rank}`);
  const c = o === "NHWC" ? a[3] : a[1], h = o === "NHWC" ? l.shape[3] : l.shape[1];
  w(c === e.shape[2], () => `Error in conv2dDerInput: depth of input (${c}) must match input depth for filter ${e.shape[2]}.`), w(h === e.shape[3], () => `Error in conv2dDerInput: depth of output (${h}) must match output depth for filter ${e.shape[3]}.`), Te("conv2dDerInput", r, i);
  const f = { dy: l, filter: e }, d = { strides: s, pad: r, dataFormat: o, dimRoundingMode: i, inputShape: a }, p = A.runKernel(Jf, f, d);
  return u ? L(p, [p.shape[1], p.shape[2], p.shape[3]]) : p;
}
const $u = /* @__PURE__ */ C({ conv2DBackpropInput_: Ym });
function Xm(n, t, e, s, r, o) {
  const i = $(n, "x", "conv2dTranspose"), a = $(t, "filter", "conv2dTranspose");
  return $u(e, i, a, s, r, "NHWC", o);
}
const Jm = /* @__PURE__ */ C({ conv2dTranspose_: Xm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Zm(n, t, e, s, r = "NDHWC", o = [1, 1, 1]) {
  const i = $(n, "x", "conv3d"), a = $(t, "filter", "conv3d");
  let l = i, u = !1;
  i.rank === 4 && (u = !0, l = L(i, [1, i.shape[0], i.shape[1], i.shape[2], i.shape[3]])), w(l.rank === 5, () => `Error in conv3d: input must be rank 5, but got rank ${l.rank}.`), w(a.rank === 5, () => `Error in conv3d: filter must be rank 5, but got rank ${a.rank}.`), w(l.shape[4] === a.shape[3], () => `Error in conv3d: depth of input (${l.shape[4]}) must match input depth for filter ${a.shape[3]}.`), w(Vn(e, o), () => `Error in conv3D: Either strides or dilations must be 1. Got strides ${e} and dilations '${o}'`), w(r === "NDHWC", () => `Error in conv3d: got dataFormat of ${r} but only NDHWC is currently supported.`), w(Bn(o), () => "Error in conv3D: Dilated rates should be larger than 0."), w(Bn(e), () => "Error in conv3D: Strides should be larger than 0.");
  const c = { x: l, filter: a }, h = { strides: e, pad: s, dataFormat: r, dilations: o }, f = A.runKernel(Zf, c, h);
  return u ? L(f, [f.shape[1], f.shape[2], f.shape[3], f.shape[4]]) : f;
}
const Qm = /* @__PURE__ */ C({ conv3d_: Zm });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function tg(n, t, e, s, r) {
  w(n.length === t.rank, () => `Length of inShape (${n.length}) and rank of dy (${t.rank}) must match`);
  let o = n, i = t, a = !1;
  t.rank === 4 && (a = !0, i = L(t, [1, t.shape[0], t.shape[1], t.shape[2], t.shape[3]]), o = [1, n[0], n[1], n[2], n[3]]);
  const l = o[4], u = i.shape[4];
  w(o.length === 5, () => `Error in conv3dDerInput: inShape must be length 5, but got length ${o.length}.`), w(i.rank === 5, () => `Error in conv3dDerInput: dy must be rank 5, but got rank ${i.rank}`), w(e.rank === 5, () => `Error in conv3dDerInput: filter must be rank 5, but got rank ${e.rank}`), w(l === e.shape[3], () => `Error in conv3dDerInput: depth of input (${l}) must match input depth for filter ${e.shape[3]}.`), w(u === e.shape[4], () => `Error in conv3dDerInput: depth of output (${u}) must match output depth for filter ${e.shape[4]}.`);
  const c = { dy: i, filter: e }, h = { pad: r, strides: s, inputShape: o }, f = A.runKernel(Qf, c, h);
  return a ? L(f, [f.shape[1], f.shape[2], f.shape[3], f.shape[4]]) : f;
}
const eg = /* @__PURE__ */ C({ conv3DBackpropInput_: tg });
function ng(n, t, e, s, r) {
  const o = $(n, "x", "conv3dTranspose"), i = $(t, "filter", "conv3dTranspose");
  return eg(e, o, i, s, r);
}
const sg = /* @__PURE__ */ C({ conv3dTranspose_: ng });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function rg(n, t, e, s, r = "NHWC", o = [1, 1], i) {
  const a = $(n, "x", "depthwiseConv2d", "float32"), l = $(t, "filter", "depthwiseConv2d", "float32");
  let u = a, c = !1;
  a.rank === 3 && (c = !0, u = L(a, [1, a.shape[0], a.shape[1], a.shape[2]])), w(u.rank === 4, () => `Error in depthwiseConv2d: input must be rank 4, but got rank ${u.rank}.`), w(l.rank === 4, () => `Error in depthwiseConv2d: filter must be rank 4, but got rank ${l.rank}.`);
  const h = r === "NHWC" ? u.shape[3] : u.shape[1];
  w(h === l.shape[2], () => `Error in depthwiseConv2d: number of input channels (${h}) must match the inChannels dimension in filter ${l.shape[2]}.`), Te("depthwiseConv2d", s, i);
  const f = { x: u, filter: l }, d = { strides: e, pad: s, dataFormat: r, dilations: o, dimRoundingMode: i }, p = A.runKernel(ed, f, d);
  return c ? L(p, [p.shape[1], p.shape[2], p.shape[3]]) : p;
}
const og = /* @__PURE__ */ C({ depthwiseConv2d_: rg });
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function dr(n, t) {
  const e = n.length, s = [];
  for (let r = 0; r < e; r++) {
    const o = e - 1 - r, i = n[o] || 1;
    (t[t.length - 1 - r] || 1) > 1 && i === 1 && s.unshift(o);
  }
  return s;
}
function ig(n, t) {
  const e = [];
  for (let s = 0; s < t.length; s++) {
    const r = n[n.length - s - 1], o = t.length - s - 1, i = t[o];
    (r == null || r === 1 && i > 1) && e.unshift(o);
  }
  return e;
}
function Wt(n, t) {
  const e = Math.max(n.length, t.length), s = new Array(e);
  for (let r = 0; r < e; r++) {
    let o = n[n.length - r - 1];
    o == null && (o = 1);
    let i = t[t.length - r - 1];
    if (i == null && (i = 1), o === 1)
      s[e - r - 1] = i;
    else if (i === 1)
      s[e - r - 1] = o;
    else if (o !== i) {
      const a = `Operands could not be broadcast together with shapes ${n} and ${t}.`;
      throw Error(a);
    } else
      s[e - r - 1] = o;
  }
  return s;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ag(n, t) {
  let e = $(n, "a", "equal", "string_or_numeric"), s = $(t, "b", "equal", "string_or_numeric");
  [e, s] = Rt(e, s), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(id, r);
}
const mn = /* @__PURE__ */ C({ equal_: ag });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function lg(n, t, e) {
  const s = $(t, "a", "where"), r = $(e, "b", "where"), o = $(n, "condition", "where", "bool"), i = Wt(Wt(o.shape, s.shape), r.shape), a = sr(o, i), l = sr(s, i), u = sr(r, i), c = {
    condition: a,
    t: l,
    e: u
  };
  return A.runKernel(Hd, c);
}
const on = /* @__PURE__ */ C({ where_: lg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ug(n) {
  const e = { x: $(n, "x", "zerosLike") };
  return A.runKernel(op, e);
}
const _e = /* @__PURE__ */ C({ zerosLike_: ug });
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cg(n, ...t) {
  const e = t.map((r, o) => $(r, `tensors${o}`, "einsum")), s = { equation: n };
  return A.runKernel(sd, e, s);
}
const rs = /* @__PURE__ */ C({ einsum_: cg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function hg(n) {
  const e = { x: $(n, "x", "elu", "float32") };
  return A.runKernel(rd, e);
}
const Au = /* @__PURE__ */ C({ elu_: hg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function fg(n) {
  let t = $(n, "x", "erf");
  w(t.dtype === "int32" || t.dtype === "float32", () => "Input dtype must be `int32` or `float32`."), t.dtype === "int32" && (t = ot(t, "float32"));
  const e = { x: t };
  return A.runKernel(od, e);
}
const dg = /* @__PURE__ */ C({ erf_: fg });
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Eu(n, t) {
  for (let e = 0; e < n.length; ++e)
    if (n[n.length - e - 1] !== t - 1 - e)
      return !1;
  return !0;
}
function pg(n, t, e) {
  const s = n.length + t.length, r = [];
  let o = 0, i = 0;
  for (let a = 0; a < s; a++)
    e.indexOf(a) === -1 ? r.push(n[o++]) : r.push(t[i++]);
  return r;
}
function bi(n, t) {
  const e = [], s = n.length;
  for (let o = 0; o < s; o++)
    t.indexOf(o) === -1 && e.push(n[o]);
  const r = t.map((o) => n[o]);
  return [e, r];
}
function _u(n, t) {
  const e = t.map((s) => 1);
  return pg(n, e, t);
}
function mg(n, t, e) {
  w(Eu(t, e), () => `${n} supports only inner-most axes for now. Got axes ${t} and rank-${e} input.`);
}
function gg(n, t) {
  if (Eu(n, t))
    return null;
  const e = [];
  for (let s = 0; s < t; ++s)
    n.indexOf(s) === -1 && e.push(s);
  return n.forEach((s) => e.push(s)), e;
}
function bg(n, t) {
  const e = [];
  for (let s = t - n; s < t; ++s)
    e.push(s);
  return e;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function yg(n, t = null, e = !1) {
  const r = { x: $(n, "x", "max") }, o = { reductionIndices: t, keepDims: e };
  return A.runKernel(Id, r, o);
}
const Ge = /* @__PURE__ */ C({ max_: yg });
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function wg(n, t = null, e = !1) {
  const r = { x: $(n, "x", "min") }, o = { axis: t, keepDims: e };
  return A.runKernel(_d, r, o);
}
const Pa = /* @__PURE__ */ C({ min_: wg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xg(n, t) {
  let e = $(n, "base", "pow"), s = $(t, "exp", "pow");
  [e, s] = Rt(e, s);
  const r = { a: e, b: s };
  return A.runKernel(Bd, r);
}
const pr = /* @__PURE__ */ C({ pow_: xg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Yt(n, t) {
  if ((re(n) && t !== "string" || Array.isArray(n)) && t !== "complex64")
    throw new Error("Error creating a new Scalar: value must be a primitive (number|boolean|string)");
  if (t === "string" && re(n) && !(n instanceof Uint8Array))
    throw new Error("When making a scalar from encoded string, the value must be `Uint8Array`.");
  return Gr(n, [], [], t);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Sg(n) {
  const e = { x: $(n, "x", "sqrt", "float32") };
  return A.runKernel(Jd, e);
}
const me = /* @__PURE__ */ C({ sqrt_: Sg });
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function vg(n) {
  const t = $(n, "x", "square"), e = {};
  return A.runKernel("Square", { x: t }, e);
}
const Ve = /* @__PURE__ */ C({ square_: vg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ig(n, t = null, e = !1) {
  let s = $(n, "x", "sum");
  s.dtype === "bool" && (s = ot(s, "int32"));
  const r = { x: s }, o = { axis: t, keepDims: e };
  return A.runKernel(Zd, r, o);
}
const et = /* @__PURE__ */ C({ sum_: Ig });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $g(n, t = "euclidean", e = null, s = !1) {
  n = $(n, "x", "norm");
  const r = Cu(n, t, e);
  let o = r.shape;
  if (s) {
    const i = _s(e, n.shape);
    o = _u(r.shape, i);
  }
  return L(r, o);
}
function Cu(n, t, e = null) {
  if (n.rank === 0)
    return Nt(n);
  if (n.rank !== 1 && e === null)
    return Cu(L(n, [-1]), t, e);
  if (n.rank === 1 || typeof e == "number" || Array.isArray(e) && e.length === 1) {
    if (t === 1)
      return et(Nt(n), e);
    if (t === 1 / 0)
      return Ge(Nt(n), e);
    if (t === -1 / 0)
      return Pa(Nt(n), e);
    if (t === "euclidean" || t === 2)
      return me(et(pr(Nt(n), Yt(2, "int32")), e));
    throw new Error(`Error in norm: invalid ord value: ${t}`);
  }
  if (Array.isArray(e) && e.length === 2) {
    if (t === 1)
      return Ge(et(Nt(n), e[0]), e[1] - 1);
    if (t === 1 / 0)
      return Ge(et(Nt(n), e[1]), e[0]);
    if (t === -1 / 0)
      return Pa(et(Nt(n), e[1]), e[0]);
    if (t === "fro" || t === "euclidean")
      return me(et(Ve(n), e));
    throw new Error(`Error in norm: invalid ord value: ${t}`);
  }
  throw new Error(`Error in norm: invalid axis: ${e}`);
}
const ku = /* @__PURE__ */ C({ norm_: $g });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ag(n) {
  const e = { x: $(n, "x", "exp") };
  return A.runKernel(ad, e);
}
const Go = /* @__PURE__ */ C({ exp_: Ag });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Eg(n, t = 0) {
  const e = $(n, "x", "expandDims", "string_or_numeric");
  w(t <= e.rank, () => "Axis must be <= rank of the tensor");
  const s = { input: e }, r = { dim: t };
  return A.runKernel(ld, s, r);
}
const Ie = /* @__PURE__ */ C({ expandDims_: Eg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function _g(n, t) {
  const e = $(n, "x", "tile", "string_or_numeric");
  w(e.rank === t.length, () => `Error in transpose: rank of input ${e.rank} must match length of reps ${t}.`);
  const s = { x: e }, r = { reps: t };
  return A.runKernel(Jl, s, r);
}
const rr = /* @__PURE__ */ C({ tile_: _g });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Cg(n, t, e, s = "float32") {
  t == null && (t = n);
  const r = vt([n, t], s), o = n <= t ? n : t;
  for (let a = 0; a < o; ++a)
    r.set(1, a, a);
  const i = L(r.toTensor(), [n, t]);
  if (e == null)
    return i;
  if (e.length === 1)
    return rr(Ie(i, 0), [e[0], 1, 1]);
  if (e.length === 2)
    return rr(Ie(Ie(i, 0), 0), [e[0], e[1], 1, 1]);
  if (e.length === 3)
    return rr(Ie(Ie(Ie(i, 0), 0), 0), [
      e[0],
      e[1],
      e[2],
      1,
      1
    ]);
  throw new Error(`eye() currently supports only 1D and 2D batchShapes, but received ${e.length}D.`);
}
const Tu = /* @__PURE__ */ C({ eye_: Cg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function kg(n) {
  const e = { x: $(n, "x", "floor", "float32") };
  return A.runKernel(hd, e);
}
const Tg = /* @__PURE__ */ C({ floor_: kg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ng(n, t, e = 0, s = 0) {
  const r = $(n, "x", "gather"), o = $(t, "indices", "gather", "int32"), i = { x: r, indices: o }, a = { axis: e, batchDims: s };
  return A.runKernel(dd, i, a);
}
const Dg = /* @__PURE__ */ C({ gather_: Ng });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Pg(n, t) {
  let e = $(n, "a", "greater", "string_or_numeric"), s = $(t, "b", "greater", "string_or_numeric");
  [e, s] = Rt(e, s), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(pd, r);
}
const ks = /* @__PURE__ */ C({ greater_: Pg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Rg(n, t) {
  let e = $(n, "a", "greaterEqual", "string_or_numeric"), s = $(t, "b", "greaterEqual", "string_or_numeric");
  [e, s] = Rt(e, s), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(md, r);
}
const Lg = /* @__PURE__ */ C({ greaterEqual_: Rg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Og(n) {
  const e = { input: $(n, "input", "imag") };
  return A.runKernel(gd, e);
}
const Mg = /* @__PURE__ */ C({ imag_: Og });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Bg(n, t = 0.2) {
  const s = { x: $(n, "x", "leakyRelu") }, r = { alpha: t };
  return A.runKernel(bd, s, r);
}
const Fg = /* @__PURE__ */ C({ leakyRelu_: Bg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zg(n, t) {
  let e = $(n, "a", "less", "string_or_numeric"), s = $(t, "b", "less", "string_or_numeric");
  [e, s] = Rt(e, s), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(yd, r);
}
const Ra = /* @__PURE__ */ C({ less_: zg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ug(n, t) {
  let e = $(n, "a", "lessEqual", "string_or_numeric"), s = $(t, "b", "lessEqual", "string_or_numeric");
  [e, s] = Rt(e, s), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(wd, r);
}
const Nu = /* @__PURE__ */ C({ lessEqual_: Ug });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wg(n) {
  const e = { x: $(n, "x", "log", "float32") };
  return A.runKernel(xd, e);
}
const gn = /* @__PURE__ */ C({ log_: Wg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Gg(n) {
  const e = { x: $(n, "x", "log1p") };
  return A.runKernel(Sd, e);
}
const Vg = /* @__PURE__ */ C({ log1p_: Gg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qg(n, t) {
  w(ko(n), () => "The f passed in variableGrads(f) must be a function"), w(t == null || Array.isArray(t) && t.every((u) => u instanceof cr), () => "The varList passed in variableGrads(f, varList) must be an array of variables");
  const e = t != null;
  if (!e) {
    t = [];
    for (const u in A.registeredVariables)
      t.push(A.registeredVariables[u]);
  }
  const s = e ? t.filter((u) => !u.trainable) : null, r = t.length;
  t = t.filter((u) => u.trainable), w(t.length > 0, () => `variableGrads() expects at least one of the input variables to be trainable, but none of the ${r} variables is trainable.`);
  const o = !0, { value: i, grads: a } = A.gradients(n, t, null, o);
  w(a.some((u) => u != null), () => "Cannot find a connection between any variable and the result of the loss function y=f(x). Please make sure the operations that use variables are inside the function f passed to minimize()."), w(i.rank === 0, () => `The f passed in variableGrads(f) must return a scalar, but it returned a rank-${i.rank} tensor`);
  const l = {};
  return t.forEach((u, c) => {
    a[c] != null && (l[u.name] = a[c]);
  }), s != null && s.forEach((u) => l[u.name] = null), { value: i, grads: l };
}
function Vo(n) {
  return A.customGrad(n);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function jg(n) {
  const e = { x: $(n, "x", "neg") };
  return A.runKernel(Nd, e);
}
const qn = /* @__PURE__ */ C({ neg_: jg });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hg(n) {
  const e = { x: $(n, "x", "softplus") };
  return A.runKernel(Xd, e);
}
const yi = /* @__PURE__ */ C({ softplus_: Hg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Kg(n, t) {
  let e = $(n, "a", "sub"), s = $(t, "b", "sub");
  [e, s] = Rt(e, s);
  const r = { a: e, b: s };
  return A.runKernel(ep, r);
}
const Z = /* @__PURE__ */ C({ sub_: Kg });
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Yg(n, t = -1) {
  const e = $(n, "logits", "logSoftmax");
  if (t === -1 && (t = e.rank - 1), t !== e.rank - 1)
    throw Error(`Log Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and axis was ${t}`);
  return Vo((r, o) => {
    const a = Ge(r, t, !0), l = Z(r, a), u = Z(ot(l, "float32"), gn(et(Go(l), t, !0)));
    return o([u]), { value: u, gradFunc: (h, f) => {
      const [d] = f, p = !0, g = Go(d);
      return Z(h, N(et(h, t, p), g));
    } };
  })(e);
}
const Xg = /* @__PURE__ */ C({ logSoftmax_: Yg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Jg(n, t) {
  const e = $(n, "a", "logicalAnd", "bool"), s = $(t, "b", "logicalAnd", "bool");
  Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(vd, r);
}
const qr = /* @__PURE__ */ C({ logicalAnd_: Jg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Zg(n, t, e, s, r) {
  const o = $(n, "x", "maxPool"), i = 1;
  let a = o, l = !1;
  o.rank === 3 && (l = !0, a = L(o, [1, o.shape[0], o.shape[1], o.shape[2]])), w(a.rank === 4, () => `Error in maxPool: input must be rank 4 but got rank ${a.rank}.`), w(Vn(e, i), () => `Error in maxPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${i}'`), Te("maxPool", s, r);
  const u = { x: a }, c = { filterSize: t, strides: e, pad: s, dimRoundingMode: r }, h = A.runKernel(Hl, u, c);
  return l ? L(h, [h.shape[1], h.shape[2], h.shape[3]]) : h;
}
const Qg = /* @__PURE__ */ C({ maxPool_: Zg });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function t0(n, t = [1, 1, 1], e, s, r, o = "NDHWC") {
  const i = $(n, "x", "maxPool3d");
  let a = i, l = !1;
  i.rank === 4 && (l = !0, a = L(i, [1, i.shape[0], i.shape[1], i.shape[2], i.shape[3]])), w(a.rank === 5, () => `Error in maxPool3d: x must be rank 5 but got rank ${a.rank}.`), w(o === "NDHWC", () => `Error in maxPool3d: Only NDHWC is currently supported, but got dataFormat of ${o}`), Te("maxPool3d", s, r);
  const u = { x: a }, c = { filterSize: t, strides: e, pad: s, dimRoundingMode: r, dataFormat: o }, h = A.runKernel(Ad, u, c);
  return l ? L(h, [h.shape[1], h.shape[2], h.shape[3], h.shape[4]]) : h;
}
const e0 = /* @__PURE__ */ C({ maxPool3d_: t0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function n0(n, t) {
  let e = $(n, "a", "maximum"), s = $(t, "b", "maximum");
  [e, s] = Rt(e, s), e.dtype === "bool" && (e = ot(e, "int32"), s = ot(s, "int32")), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel($d, r);
}
const jn = /* @__PURE__ */ C({ maximum_: n0 });
/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function s0(n, t = null, e = !1) {
  const r = { x: $(n, "x", "mean") }, o = { axis: t, keepDims: e };
  return A.runKernel(Ed, r, o);
}
const St = /* @__PURE__ */ C({ mean_: s0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Fn(n, t = "float32") {
  if (Me(n), t === "complex64") {
    const s = Fn(n, "float32"), r = Fn(n, "float32");
    return hi(s, r);
  }
  const e = je(z(n), t);
  return A.makeTensor(e, n, t);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function wi(n, t = "float32") {
  if (Me(n), t === "complex64") {
    const s = wi(n, "float32"), r = Fn(n, "float32");
    return hi(s, r);
  }
  const e = Ul(z(n), t);
  return A.makeTensor(e, n, t);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function r0(n, t) {
  let e = $(n, "a", "minimum"), s = $(t, "b", "minimum");
  [e, s] = Rt(e, s), e.dtype === "bool" && (e = ot(e, "int32"), s = ot(s, "int32")), Wt(e.shape, s.shape);
  const r = { a: e, b: s };
  return A.runKernel(Cd, r);
}
const mr = /* @__PURE__ */ C({ minimum_: r0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function o0(n, t, e = 1, s = 0, r = "int32") {
  if (t < 2)
    throw new Error(`Error in oneHot: depth must be >=2, but it is ${t}`);
  const i = { indices: $(n, "indices", "oneHot", "int32") }, a = { dtype: r, depth: t, onValue: e, offValue: s };
  return A.runKernel(Od, i, a);
}
const i0 = /* @__PURE__ */ C({ oneHot_: o0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function a0(n) {
  const e = { x: $(n, "x", "onesLike") };
  return A.runKernel(Ld, e);
}
const Du = /* @__PURE__ */ C({ onesLike_: a0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function l0(n, t) {
  const e = $(n, "x", "prelu"), s = $(t, "alpha", "prelu"), r = { x: e, alpha: s };
  return A.runKernel(Fd, r);
}
const u0 = /* @__PURE__ */ C({ prelu_: l0 });
var xi = { exports: {} };
xi.exports;
(function(n) {
  (function(t, e, s) {
    function r(l) {
      var u = this, c = a();
      u.next = function() {
        var h = 2091639 * u.s0 + u.c * 23283064365386963e-26;
        return u.s0 = u.s1, u.s1 = u.s2, u.s2 = h - (u.c = h | 0);
      }, u.c = 1, u.s0 = c(" "), u.s1 = c(" "), u.s2 = c(" "), u.s0 -= c(l), u.s0 < 0 && (u.s0 += 1), u.s1 -= c(l), u.s1 < 0 && (u.s1 += 1), u.s2 -= c(l), u.s2 < 0 && (u.s2 += 1), c = null;
    }
    function o(l, u) {
      return u.c = l.c, u.s0 = l.s0, u.s1 = l.s1, u.s2 = l.s2, u;
    }
    function i(l, u) {
      var c = new r(l), h = u && u.state, f = c.next;
      return f.int32 = function() {
        return c.next() * 4294967296 | 0;
      }, f.double = function() {
        return f() + (f() * 2097152 | 0) * 11102230246251565e-32;
      }, f.quick = f, h && (typeof h == "object" && o(h, c), f.state = function() {
        return o(c, {});
      }), f;
    }
    function a() {
      var l = 4022871197, u = function(c) {
        c = String(c);
        for (var h = 0; h < c.length; h++) {
          l += c.charCodeAt(h);
          var f = 0.02519603282416938 * l;
          l = f >>> 0, f -= l, f *= l, l = f >>> 0, f -= l, l += f * 4294967296;
        }
        return (l >>> 0) * 23283064365386963e-26;
      };
      return u;
    }
    e.exports ? e.exports = i : this.alea = i;
  })(
    wn,
    n
  );
})(xi);
var c0 = xi.exports, Si = { exports: {} };
Si.exports;
(function(n) {
  (function(t, e, s) {
    function r(a) {
      var l = this, u = "";
      l.x = 0, l.y = 0, l.z = 0, l.w = 0, l.next = function() {
        var h = l.x ^ l.x << 11;
        return l.x = l.y, l.y = l.z, l.z = l.w, l.w ^= l.w >>> 19 ^ h ^ h >>> 8;
      }, a === (a | 0) ? l.x = a : u += a;
      for (var c = 0; c < u.length + 64; c++)
        l.x ^= u.charCodeAt(c) | 0, l.next();
    }
    function o(a, l) {
      return l.x = a.x, l.y = a.y, l.z = a.z, l.w = a.w, l;
    }
    function i(a, l) {
      var u = new r(a), c = l && l.state, h = function() {
        return (u.next() >>> 0) / 4294967296;
      };
      return h.double = function() {
        do
          var f = u.next() >>> 11, d = (u.next() >>> 0) / 4294967296, p = (f + d) / (1 << 21);
        while (p === 0);
        return p;
      }, h.int32 = u.next, h.quick = h, c && (typeof c == "object" && o(c, u), h.state = function() {
        return o(u, {});
      }), h;
    }
    e.exports ? e.exports = i : this.xor128 = i;
  })(
    wn,
    n
  );
})(Si);
var h0 = Si.exports, vi = { exports: {} };
vi.exports;
(function(n) {
  (function(t, e, s) {
    function r(a) {
      var l = this, u = "";
      l.next = function() {
        var h = l.x ^ l.x >>> 2;
        return l.x = l.y, l.y = l.z, l.z = l.w, l.w = l.v, (l.d = l.d + 362437 | 0) + (l.v = l.v ^ l.v << 4 ^ (h ^ h << 1)) | 0;
      }, l.x = 0, l.y = 0, l.z = 0, l.w = 0, l.v = 0, a === (a | 0) ? l.x = a : u += a;
      for (var c = 0; c < u.length + 64; c++)
        l.x ^= u.charCodeAt(c) | 0, c == u.length && (l.d = l.x << 10 ^ l.x >>> 4), l.next();
    }
    function o(a, l) {
      return l.x = a.x, l.y = a.y, l.z = a.z, l.w = a.w, l.v = a.v, l.d = a.d, l;
    }
    function i(a, l) {
      var u = new r(a), c = l && l.state, h = function() {
        return (u.next() >>> 0) / 4294967296;
      };
      return h.double = function() {
        do
          var f = u.next() >>> 11, d = (u.next() >>> 0) / 4294967296, p = (f + d) / (1 << 21);
        while (p === 0);
        return p;
      }, h.int32 = u.next, h.quick = h, c && (typeof c == "object" && o(c, u), h.state = function() {
        return o(u, {});
      }), h;
    }
    e.exports ? e.exports = i : this.xorwow = i;
  })(
    wn,
    n
  );
})(vi);
var f0 = vi.exports, Ii = { exports: {} };
Ii.exports;
(function(n) {
  (function(t, e, s) {
    function r(a) {
      var l = this;
      l.next = function() {
        var c = l.x, h = l.i, f, d;
        return f = c[h], f ^= f >>> 7, d = f ^ f << 24, f = c[h + 1 & 7], d ^= f ^ f >>> 10, f = c[h + 3 & 7], d ^= f ^ f >>> 3, f = c[h + 4 & 7], d ^= f ^ f << 7, f = c[h + 7 & 7], f = f ^ f << 13, d ^= f ^ f << 9, c[h] = d, l.i = h + 1 & 7, d;
      };
      function u(c, h) {
        var f, d = [];
        if (h === (h | 0))
          d[0] = h;
        else
          for (h = "" + h, f = 0; f < h.length; ++f)
            d[f & 7] = d[f & 7] << 15 ^ h.charCodeAt(f) + d[f + 1 & 7] << 13;
        for (; d.length < 8; ) d.push(0);
        for (f = 0; f < 8 && d[f] === 0; ++f) ;
        for (f == 8 ? d[7] = -1 : d[f], c.x = d, c.i = 0, f = 256; f > 0; --f)
          c.next();
      }
      u(l, a);
    }
    function o(a, l) {
      return l.x = a.x.slice(), l.i = a.i, l;
    }
    function i(a, l) {
      a == null && (a = +/* @__PURE__ */ new Date());
      var u = new r(a), c = l && l.state, h = function() {
        return (u.next() >>> 0) / 4294967296;
      };
      return h.double = function() {
        do
          var f = u.next() >>> 11, d = (u.next() >>> 0) / 4294967296, p = (f + d) / (1 << 21);
        while (p === 0);
        return p;
      }, h.int32 = u.next, h.quick = h, c && (c.x && o(c, u), h.state = function() {
        return o(u, {});
      }), h;
    }
    e.exports ? e.exports = i : this.xorshift7 = i;
  })(
    wn,
    n
  );
})(Ii);
var d0 = Ii.exports, $i = { exports: {} };
$i.exports;
(function(n) {
  (function(t, e, s) {
    function r(a) {
      var l = this;
      l.next = function() {
        var c = l.w, h = l.X, f = l.i, d, p;
        return l.w = c = c + 1640531527 | 0, p = h[f + 34 & 127], d = h[f = f + 1 & 127], p ^= p << 13, d ^= d << 17, p ^= p >>> 15, d ^= d >>> 12, p = h[f] = p ^ d, l.i = f, p + (c ^ c >>> 16) | 0;
      };
      function u(c, h) {
        var f, d, p, g, m, b = [], y = 128;
        for (h === (h | 0) ? (d = h, h = null) : (h = h + "\0", d = 0, y = Math.max(y, h.length)), p = 0, g = -32; g < y; ++g)
          h && (d ^= h.charCodeAt((g + 32) % h.length)), g === 0 && (m = d), d ^= d << 10, d ^= d >>> 15, d ^= d << 4, d ^= d >>> 13, g >= 0 && (m = m + 1640531527 | 0, f = b[g & 127] ^= d + m, p = f == 0 ? p + 1 : 0);
        for (p >= 128 && (b[(h && h.length || 0) & 127] = -1), p = 127, g = 4 * 128; g > 0; --g)
          d = b[p + 34 & 127], f = b[p = p + 1 & 127], d ^= d << 13, f ^= f << 17, d ^= d >>> 15, f ^= f >>> 12, b[p] = d ^ f;
        c.w = m, c.X = b, c.i = p;
      }
      u(l, a);
    }
    function o(a, l) {
      return l.i = a.i, l.w = a.w, l.X = a.X.slice(), l;
    }
    function i(a, l) {
      a == null && (a = +/* @__PURE__ */ new Date());
      var u = new r(a), c = l && l.state, h = function() {
        return (u.next() >>> 0) / 4294967296;
      };
      return h.double = function() {
        do
          var f = u.next() >>> 11, d = (u.next() >>> 0) / 4294967296, p = (f + d) / (1 << 21);
        while (p === 0);
        return p;
      }, h.int32 = u.next, h.quick = h, c && (c.X && o(c, u), h.state = function() {
        return o(u, {});
      }), h;
    }
    e.exports ? e.exports = i : this.xor4096 = i;
  })(
    wn,
    // window object or global
    n
  );
})($i);
var p0 = $i.exports, Ai = { exports: {} };
Ai.exports;
(function(n) {
  (function(t, e, s) {
    function r(a) {
      var l = this, u = "";
      l.next = function() {
        var h = l.b, f = l.c, d = l.d, p = l.a;
        return h = h << 25 ^ h >>> 7 ^ f, f = f - d | 0, d = d << 24 ^ d >>> 8 ^ p, p = p - h | 0, l.b = h = h << 20 ^ h >>> 12 ^ f, l.c = f = f - d | 0, l.d = d << 16 ^ f >>> 16 ^ p, l.a = p - h | 0;
      }, l.a = 0, l.b = 0, l.c = -1640531527, l.d = 1367130551, a === Math.floor(a) ? (l.a = a / 4294967296 | 0, l.b = a | 0) : u += a;
      for (var c = 0; c < u.length + 20; c++)
        l.b ^= u.charCodeAt(c) | 0, l.next();
    }
    function o(a, l) {
      return l.a = a.a, l.b = a.b, l.c = a.c, l.d = a.d, l;
    }
    function i(a, l) {
      var u = new r(a), c = l && l.state, h = function() {
        return (u.next() >>> 0) / 4294967296;
      };
      return h.double = function() {
        do
          var f = u.next() >>> 11, d = (u.next() >>> 0) / 4294967296, p = (f + d) / (1 << 21);
        while (p === 0);
        return p;
      }, h.int32 = u.next, h.quick = h, c && (typeof c == "object" && o(c, u), h.state = function() {
        return o(u, {});
      }), h;
    }
    e.exports ? e.exports = i : this.tychei = i;
  })(
    wn,
    n
  );
})(Ai);
var m0 = Ai.exports, Pu = { exports: {} };
const g0 = {}, b0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: g0
}, Symbol.toStringTag, { value: "Module" })), y0 = /* @__PURE__ */ hp(b0);
(function(n) {
  (function(t, e, s) {
    var r = 256, o = 6, i = 52, a = "random", l = s.pow(r, o), u = s.pow(2, i), c = u * 2, h = r - 1, f;
    function d(x, v, E) {
      var D = [];
      v = v == !0 ? { entropy: !0 } : v || {};
      var k = b(m(
        v.entropy ? [x, S(e)] : x ?? y(),
        3
      ), D), T = new p(D), R = function() {
        for (var B = T.g(o), H = l, X = 0; B < u; )
          B = (B + X) * r, H *= r, X = T.g(1);
        for (; B >= c; )
          B /= 2, H /= 2, X >>>= 1;
        return (B + X) / H;
      };
      return R.int32 = function() {
        return T.g(4) | 0;
      }, R.quick = function() {
        return T.g(4) / 4294967296;
      }, R.double = R, b(S(T.S), e), (v.pass || E || function(B, H, X, W) {
        return W && (W.S && g(W, T), B.state = function() {
          return g(T, {});
        }), X ? (s[a] = B, H) : B;
      })(
        R,
        k,
        "global" in v ? v.global : this == s,
        v.state
      );
    }
    function p(x) {
      var v, E = x.length, D = this, k = 0, T = D.i = D.j = 0, R = D.S = [];
      for (E || (x = [E++]); k < r; )
        R[k] = k++;
      for (k = 0; k < r; k++)
        R[k] = R[T = h & T + x[k % E] + (v = R[k])], R[T] = v;
      (D.g = function(B) {
        for (var H, X = 0, W = D.i, U = D.j, j = D.S; B--; )
          H = j[W = h & W + 1], X = X * r + j[h & (j[W] = j[U = h & U + H]) + (j[U] = H)];
        return D.i = W, D.j = U, X;
      })(r);
    }
    function g(x, v) {
      return v.i = x.i, v.j = x.j, v.S = x.S.slice(), v;
    }
    function m(x, v) {
      var E = [], D = typeof x, k;
      if (v && D == "object")
        for (k in x)
          try {
            E.push(m(x[k], v - 1));
          } catch {
          }
      return E.length ? E : D == "string" ? x : x + "\0";
    }
    function b(x, v) {
      for (var E = x + "", D, k = 0; k < E.length; )
        v[h & k] = h & (D ^= v[h & k] * 19) + E.charCodeAt(k++);
      return S(v);
    }
    function y() {
      try {
        var x;
        return f && (x = f.randomBytes) ? x = x(r) : (x = new Uint8Array(r), (t.crypto || t.msCrypto).getRandomValues(x)), S(x);
      } catch {
        var v = t.navigator, E = v && v.plugins;
        return [+/* @__PURE__ */ new Date(), t, E, t.screen, S(e)];
      }
    }
    function S(x) {
      return String.fromCharCode.apply(0, x);
    }
    if (b(s.random(), e), n.exports) {
      n.exports = d;
      try {
        f = y0;
      } catch {
      }
    } else
      s["seed" + a] = d;
  })(
    // global: `self` in browsers (including strict mode and web workers),
    // otherwise `this` in Node and other environments
    typeof self < "u" ? self : wn,
    [],
    // pool: entropy pool starts empty
    Math
    // math: package containing random, pow, and seedrandom
  );
})(Pu);
var w0 = Pu.exports, x0 = c0, S0 = h0, v0 = f0, I0 = d0, $0 = p0, A0 = m0, Sn = w0;
Sn.alea = x0;
Sn.xor128 = S0;
Sn.xorwow = v0;
Sn.xorshift7 = I0;
Sn.xor4096 = $0;
Sn.tychei = A0;
var Ru = Sn;
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Lu {
  constructor(t, e, s, r, o) {
    this.mean = t, this.stdDev = e, this.dtype = s, this.nextVal = NaN, this.truncated = r, this.truncated && (this.upper = this.mean + this.stdDev * 2, this.lower = this.mean - this.stdDev * 2);
    const i = o || Math.random();
    this.random = Ru.alea(i.toString());
  }
  /** Returns next sample from a Gaussian distribution. */
  nextValue() {
    if (!isNaN(this.nextVal)) {
      const r = this.nextVal;
      return this.nextVal = NaN, r;
    }
    let t, e, s = !1;
    for (; !s; ) {
      let r, o, i;
      do
        r = 2 * this.random() - 1, o = 2 * this.random() - 1, i = r * r + o * o;
      while (i >= 1 || i === 0);
      const a = Math.sqrt(-2 * Math.log(i) / i);
      t = this.mean + this.stdDev * r * a, e = this.mean + this.stdDev * o * a, (!this.truncated || this.isValidTruncated(t)) && (s = !0);
    }
    return (!this.truncated || this.isValidTruncated(e)) && (this.nextVal = this.convertValue(e)), this.convertValue(t);
  }
  /** Handles proper rounding for non-floating-point numbers. */
  convertValue(t) {
    return this.dtype == null || this.dtype === "float32" ? t : Math.round(t);
  }
  /** Returns true if less than 2-standard-deviations from the mean. */
  isValidTruncated(t) {
    return t <= this.upper && t >= this.lower;
  }
}
class E0 {
  constructor(t = 0, e = 1, s, r) {
    if (this.canReturnFloat = () => this.dtype == null || this.dtype === "float32", this.min = t, this.range = e - t, this.dtype = s, r == null && (r = Math.random()), typeof r == "number" && (r = r.toString()), !this.canReturnFloat() && this.range <= 1)
      throw new Error(`The difference between ${t} - ${e} <= 1 and dtype is not float`);
    this.random = Ru.alea(r);
  }
  convertValue(t) {
    return this.canReturnFloat() ? t : Math.round(t);
  }
  nextValue() {
    return this.convertValue(this.min + this.range * this.random());
  }
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function _0(n, t = 0, e = 1, s, r) {
  if (Me(n), s != null && s === "bool")
    throw new Error(`Unsupported data type ${s}`);
  const o = new Lu(t, e, s, !1, r), i = vt(n, s);
  for (let a = 0; a < i.values.length; a++)
    i.values[a] = o.nextValue();
  return i.toTensor();
}
const C0 = /* @__PURE__ */ C({ randomNormal_: _0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function k0(n, t = 0, e = 1, s = "float32", r) {
  Me(n);
  const o = vt(n, s), i = new E0(t, e, null, r);
  for (let a = 0; a < o.values.length; a++)
    o.values[a] = i.nextValue();
  return o.toTensor();
}
const Ou = /* @__PURE__ */ C({ randomUniform_: k0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function gr(n, t, e = 1, s = "float32") {
  if (e === 0)
    throw new Error("Cannot have a step of zero");
  const r = { start: n, stop: t, step: e, dtype: s };
  return A.runKernel(zd, {}, r);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function T0(n) {
  const e = { input: $(n, "input", "real") };
  return A.runKernel(Ud, e);
}
const N0 = /* @__PURE__ */ C({ real_: T0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function D0(n) {
  const e = { x: $(n, "x", "relu") };
  return A.runKernel(Wd, e);
}
const Ts = /* @__PURE__ */ C({ relu_: D0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function P0(n) {
  const e = { x: $(n, "x", "relu6") };
  return A.runKernel(qd, e);
}
const R0 = /* @__PURE__ */ C({ relu6_: P0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function L0(n) {
  const e = { x: $(n, "x", "round") };
  return A.runKernel(jd, e);
}
const O0 = /* @__PURE__ */ C({ round_: L0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function M0(n) {
  const e = { x: $(n, "x", "selu") };
  return A.runKernel(Kd, e);
}
const B0 = /* @__PURE__ */ C({ selu_: M0 });
function F0(n, t, e, s, r, o = [1, 1], i = "NHWC") {
  const a = $(n, "x", "separableConv2d"), l = $(t, "depthwiseFilter", "separableConv2d"), u = $(e, "pointwiseFilter", "separableConv2d");
  let c = a, h = !1;
  if (a.rank === 3 && (h = !0, c = L(a, [1, a.shape[0], a.shape[1], a.shape[2]])), i === "NCHW")
    throw new Error("separableConv2d currently does not support dataFormat NCHW; only NHWC is supported");
  w(c.rank === 4, () => `Error in separableConv2d: input must be rank 4, but got rank ${c.rank}.`), w(l.rank === 4, () => `Error in separableConv2d: depthwise filter must be rank 4, but got rank ${l.rank}.`), w(u.rank === 4, () => `Error in separableConv2d: pointwise filter must be rank 4, but got rank ${l.rank}.`), w(u.shape[0] === 1, () => `Error in separableConv2d: the first dimension of pointwise filter  must be 1, but got ${u.shape[0]}.`), w(u.shape[1] === 1, () => `Error in separableConv2d: the second dimension of pointwise filter must be 1, but got ${u.shape[1]}.`);
  const f = l.shape[2], d = l.shape[3];
  w(u.shape[2] === f * d, () => `Error in separableConv2d: the third dimension of pointwise filter must be ${f * d}, but got ${u.shape[2]}.`);
  const p = og(c, l, s, r, i, o), m = gi(p, u, 1, "valid", i);
  return h ? L(m, [m.shape[1], m.shape[2], m.shape[3]]) : m;
}
const z0 = /* @__PURE__ */ C({ separableConv2d_: F0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function U0(n, t, e) {
  const s = $(n, "x", "slice1d");
  return w(s.rank === 1, () => `slice1d expects a rank-1 tensor, but got a rank-${s.rank} tensor`), At(s, [t], [e]);
}
const Ei = /* @__PURE__ */ C({ slice1d_: U0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function W0(n, t, e) {
  const s = $(n, "x", "slice2d");
  return w(s.rank === 2, () => `slice2d expects a rank-2 tensor, but got a rank-${s.rank} tensor`), At(s, t, e);
}
const Mu = /* @__PURE__ */ C({ slice2d_: W0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function G0(n, t, e) {
  const s = $(n, "x", "slice3d");
  return w(s.rank === 3, () => `slice3d expects a rank-3 tensor, but got a rank-${s.rank} tensor`), At(s, t, e);
}
const _i = /* @__PURE__ */ C({ slice3d_: G0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function V0(n, t = -1) {
  const e = $(n, "logits", "softmax", "float32");
  if (t === -1 && (t = e.rank - 1), t !== e.rank - 1)
    throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and dim was ${t}`);
  const s = { logits: e }, r = { dim: t };
  return A.runKernel(tp, s, r);
}
const Bu = /* @__PURE__ */ C({ softmax_: V0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function q0(n, t, e = 0) {
  const r = { x: $(n, "x", "split") }, o = { numOrSizeSplits: t, axis: e };
  return A.runKernel(Qd, r, o);
}
const Fu = /* @__PURE__ */ C({ split_: q0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function j0(n, t) {
  const e = $(n, "x", "squeeze", "string_or_numeric");
  return L(e, Cf(e.shape, t).newShape);
}
const jr = /* @__PURE__ */ C({ squeeze_: j0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function H0(n, t = 0) {
  const e = gu(n, "tensors", "stack", "string_or_numeric");
  w(e.length >= 1, () => "Pass at least one tensor to tf.stack"), e.length > 0 && w(t <= e[0].rank, () => "Axis must be <= rank of the tensor");
  const s = e, r = { axis: t };
  return A.runKernel(Md, s, r);
}
const br = /* @__PURE__ */ C({ stack_: H0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function K0(n, t = 0) {
  const s = { x: $(n, "x", "step") }, r = { alpha: t };
  return A.runKernel(ip, s, r);
}
const Y0 = /* @__PURE__ */ C({ step_: K0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ho(n, t, e) {
  if (Fl(n), t != null && t.length !== 2)
    throw new Error("tensor2d() requires shape to have two numbers");
  const s = Wr(n, e);
  if (s.length !== 2 && s.length !== 1)
    throw new Error("tensor2d() requires values to be number[][] or flat/TypedArray");
  if (s.length === 1 && t == null)
    throw new Error("tensor2d() requires shape to be provided when `values` are a flat/TypedArray");
  return Gr(n, t, s, e);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function X0(n, t = 0, e = 1, s, r) {
  if (Me(n), s != null && s === "bool")
    throw new Error("Unsupported data type $ { dtype }");
  const o = new Lu(t, e, s, !0, r), i = vt(n, s);
  for (let a = 0; a < i.values.length; a++)
    i.values[a] = o.nextValue();
  return i.toTensor();
}
const zu = /* @__PURE__ */ C({ truncatedNormal_: X0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function J0(n, t = 0) {
  const e = $(n, "x", "unstack", "string_or_numeric");
  w(t >= -e.shape.length && t < e.shape.length, () => `Axis = ${t} is not in [-${e.shape.length}, ${e.shape.length})`);
  const s = { value: e }, r = { axis: t };
  return A.runKernel(rp, s, r);
}
const Uu = /* @__PURE__ */ C({ unstack_: J0 });
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Z0(n, t = !0, e, s) {
  return A.makeVariable(n, t, e, s);
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Q0(n, t, e) {
  const s = $(n, "x", "transpose");
  if (t == null && (t = s.shape.map((i, a) => a).reverse()), w(s.rank === t.length, () => `Error in transpose: rank of input ${s.rank} must match length of perm ${t}.`), t.forEach((i) => {
    w(i >= 0 && i < s.rank, () => `All entries in 'perm' must be between 0 and ${s.rank - 1} but got ${t}`);
  }), s.rank <= 1)
    return s.clone();
  const r = { x: s }, o = { perm: t };
  return s.dtype === "complex64" ? _(() => {
    let i = N0(s), a = Mg(s);
    return i = A.runKernel(io, { x: i }, o), a = A.runKernel(io, { x: a }, o), e && (a = qn(a)), hi(i, a);
  }) : A.runKernel(io, r, o);
}
const pt = /* @__PURE__ */ C({ transpose_: Q0 });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function tb(n, t, e, s, r, o = "NHWC", i) {
  let a = n;
  n.rank === 3 && (a = L(n, [1, n.shape[0], n.shape[1], n.shape[2]]));
  let l = t;
  l.rank === 3 && (l = L(t, [1, t.shape[0], t.shape[1], t.shape[2]])), w(a.rank === 4, () => `Error in conv2dDerFilter: input must be rank 4, but got shape ${a.shape}.`), w(l.rank === 4, () => `Error in conv2dDerFilter: dy must be rank 4, but got shape ${l.shape}.`), w(e.length === 4, () => `Error in conv2dDerFilter: filterShape must be length 4, but got ${e}.`);
  const u = o === "NHWC" ? a.shape[3] : a.shape[1], c = o === "NHWC" ? l.shape[3] : l.shape[1];
  w(u === e[2], () => `Error in conv2dDerFilter: depth of input ${u}) must match input depth in filter (${e[2]}.`), w(c === e[3], () => `Error in conv2dDerFilter: depth of dy (${c}) must match output depth for filter (${e[3]}).`), Te("conv2dDerFilter", r, i);
  const h = { x: a, dy: l }, f = { strides: s, pad: r, dataFormat: o, dimRoundingMode: i, filterShape: e };
  return A.runKernel(Xf, h, f);
}
const eb = /* @__PURE__ */ C({ conv2DBackpropFilter_: tb });
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function nb(n, t, e) {
  if (e == null || e === "linear")
    return n;
  if (e === "relu")
    return N(n, Y0(t));
  throw new Error(`Cannot compute gradient for fused activation ${e}.`);
}
function sb(n, t) {
  let e = t;
  const s = ig(n.shape, t.shape);
  return s.length > 0 && (e = et(e, s)), L(e, n.shape);
}
function rb(n, t, e, s) {
  if (t === "linear")
    return n;
  if (t === "relu")
    return Ts(n);
  if (t === "elu")
    return Au(n);
  if (t === "relu6")
    return R0(n);
  if (t === "prelu")
    return u0(n, e);
  if (t === "leakyrelu")
    return Fg(n, s);
  if (t === "sigmoid")
    return pi(n);
  throw new Error(`Unknown fused activation ${t}.`);
}
const ob = (n, t) => !(n > 0) || t === "linear";
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ib({ x: n, filter: t, strides: e, pad: s, dataFormat: r = "NHWC", dilations: o = [1, 1], dimRoundingMode: i, bias: a, activation: l = "linear", preluActivationWeights: u, leakyreluAlpha: c }) {
  if (l = l || "linear", ob(A.state.gradientDepth, l) === !1) {
    w(r === "NHWC", () => `Error in fused conv2d: got dataFormat of ${r} but only NHWC is currently supported for the case of gradient depth is 0 and the activation is not linear.`);
    let E = gi(n, t, e, s, r, o, i);
    return a != null && (E = M(E, a)), rb(E, l, u, c);
  }
  const h = $(n, "x", "conv2d", "float32"), f = $(t, "filter", "conv2d", "float32");
  let d = h, p = !1;
  h.rank === 3 && (p = !0, d = L(h, [1, h.shape[0], h.shape[1], h.shape[2]])), w(d.rank === 4, () => `Error in fused conv2d: input must be rank 4, but got rank ${d.rank}.`), w(f.rank === 4, () => `Error in fused conv2d: filter must be rank 4, but got rank ${f.rank}.`), Te("fused conv2d", s, i);
  const g = r === "NHWC" ? d.shape[3] : d.shape[1];
  w(f.shape[2] === g, () => `Error in conv2d: depth of input (${g}) must match input depth for filter ${f.shape[2]}.`), w(Vn(e, o), () => `Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${o}'`);
  const m = di(d.shape, f.shape, e, o, s, i);
  let b;
  a != null && (b = $(a, "bias", "fused conv2d"), [b] = Rt(b, h), r === "NHWC" ? Wt(m.outShape, b.shape) : (w(b.shape.length <= 1, () => `Error in fused conv2d: only supports scalar or 1-D Tensor bias for NCHW format but got the bias of rank-${b.shape.length}.`), w(b.shape.length === 0 || b.shape[0] === m.outChannels || b.shape[0] === 1, () => `Error in fused conv2d: bias shape (${b.shape}) is not compatible with the number of output channels (${m.outChannels})`)));
  let y;
  if (u != null) {
    const E = u.shape;
    if (w(E.length <= 1 || E.length === 3, () => `Error in fused conv2d: only supports scalar, 1-D Tensor or 3-D Tensor PReLU activation weights but got a tensor of rank-${E.length}.`), E.length === 1)
      w(E[0] === 1 || E[0] === m.outChannels, () => `Error in fused conv2d: PReLU activation weights (${E}) is not compatible with the number of output channels (${m.outChannels}).`);
    else if (E.length === 3)
      try {
        Wt(E, m.outShape);
      } catch {
        const k = `Error in fused conv2d: PReLU activation weights (${E}) is not compatible with the output shape of the conv2d (${m.outShape}).`;
        throw Error(k);
      }
    y = $(u, "prelu weights", "fused conv2d");
  }
  const S = (E, D) => {
    w(r === "NHWC", () => `Error in gradient of fused conv2D: got dataFormat of ${r} but only NHWC is currently supported.`);
    const [k, T, R, B] = D, H = nb(E, R, l);
    w(Wo(o), () => `Error in gradient of fused conv2D: dilation rates greater than 1 are not yet supported in gradients. Got dilations '${o}'`);
    const X = $u(T.shape, H, k, e, s), W = eb(T, H, k.shape, e, s), U = [X, W];
    if (B != null) {
      const j = sb(B, H);
      U.push(j);
    }
    return U;
  }, x = {
    x: d,
    filter: f,
    bias: b,
    preluActivationWeights: y
  }, v = {
    strides: e,
    pad: s,
    dataFormat: r,
    dilations: o,
    dimRoundingMode: i,
    activation: l,
    leakyreluAlpha: c
  };
  return a == null ? Vo((D, k, T) => {
    let R = (
      // tslint:disable-next-line: no-unnecessary-type-assertion
      A.runKernel(No, x, v)
    );
    return T([k, D, R]), p && (R = L(R, [R.shape[1], R.shape[2], R.shape[3]])), { value: R, gradFunc: S };
  })(d, f) : Vo((D, k, T, R) => {
    let B = A.runKernel(No, x, v);
    return R([k, D, B, T]), p && (B = L(B, [B.shape[1], B.shape[2], B.shape[3]])), { value: B, gradFunc: S };
  })(d, f, b);
}
const ab = /* @__PURE__ */ C({ fusedConv2d_: ib });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function lb(n, t, e, s, r = "bilinear", o = 0) {
  const i = $(n, "image", "cropAndResize"), a = $(t, "boxes", "cropAndResize", "float32"), l = $(e, "boxInd", "cropAndResize", "int32"), u = a.shape[0];
  w(i.rank === 4, () => `Error in cropAndResize: image must be rank 4,but got rank ${i.rank}.`), w(a.rank === 2 && a.shape[1] === 4, () => `Error in cropAndResize: boxes must be have size [${u},4] but had shape ${a.shape}.`), w(l.rank === 1 && l.shape[0] === u, () => `Error in cropAndResize: boxInd must be have size [${u}] but had shape ${a.shape}.`), w(s.length === 2, () => `Error in cropAndResize: cropSize must be of length 2, but got length ${s.length}.`), w(s[0] >= 1 && s[1] >= 1, () => `cropSize must be atleast [1,1], but was ${s}`), w(r === "bilinear" || r === "nearest", () => `method must be bilinear or nearest, but was ${r}`);
  const c = { image: i, boxes: a, boxInd: l }, h = { method: r, extrapolationValue: o, cropSize: s };
  return A.runKernel(td, c, h);
}
const ub = /* @__PURE__ */ C({ cropAndResize_: lb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cb(n) {
  const t = $(n, "image", "flipLeftRight", "float32");
  w(t.rank === 4, () => `Error in flipLeftRight: image must be rank 4,but got rank ${t.rank}.`);
  const e = { image: t };
  return A.runKernel(cd, e, {});
}
const hb = /* @__PURE__ */ C({ flipLeftRight_: cb });
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function fb(n) {
  const t = $(n, "image", "grayscaleToRGB"), e = t.rank - 1, s = t.shape[e];
  w(t.rank >= 2, () => `Error in grayscaleToRGB: images must be at least rank 2, but got rank ${t.rank}.`), w(s === 1, () => `Error in grayscaleToRGB: last dimension of a grayscale image should be size 1, but got size ${s}.`);
  const r = new Array(t.rank);
  return r.fill(1, 0, e), r[e] = 3, rr(t, r);
}
const db = /* @__PURE__ */ C({ grayscaleToRGB_: fb });
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function pb(n) {
  const t = $(n, "image", "RGBToGrayscale"), e = t.rank - 1, s = t.shape[e];
  w(t.rank >= 2, () => `Error in RGBToGrayscale: images must be at least rank 2, but got rank ${t.rank}.`), w(s === 3, () => `Error in RGBToGrayscale: last dimension of an RGB image should be size 3, but got size ${s}.`);
  const r = t.dtype, o = ot(t, "float32"), i = Dt([0.2989, 0.587, 0.114]);
  let a;
  switch (t.rank) {
    case 2:
      a = rs("ij,j->i", o, i);
      break;
    case 3:
      a = rs("ijk,k->ij", o, i);
      break;
    case 4:
      a = rs("ijkl,l->ijk", o, i);
      break;
    case 5:
      a = rs("ijklm,m->ijkl", o, i);
      break;
    case 6:
      a = rs("ijklmn,n->ijklm", o, i);
      break;
    default:
      throw new Error("Not a valid tensor rank.");
  }
  return a = Ie(a, -1), ot(a, r);
}
const mb = /* @__PURE__ */ C({ rgbToGrayscale_: pb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function gb(n, t, e = 0, s = 0.5) {
  const r = $(n, "image", "rotateWithOffset", "float32");
  w(r.rank === 4, () => `Error in rotateWithOffset: image must be rank 4,but got rank ${r.rank}.`);
  const o = { image: r }, i = { radians: t, fillValue: e, center: s };
  return A.runKernel(ap, o, i);
}
const bb = /* @__PURE__ */ C({ rotateWithOffset_: gb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hn(n, t, e, s, r, o) {
  s == null && (s = 0.5), r == null && (r = Number.NEGATIVE_INFINITY), o == null && (o = 0);
  const i = n.shape[0];
  return e = Math.min(e, i), w(0 <= s && s <= 1, () => `iouThreshold must be in [0, 1], but was '${s}'`), w(n.rank === 2, () => `boxes must be a 2D tensor, but was of rank '${n.rank}'`), w(n.shape[1] === 4, () => `boxes must have 4 columns, but 2nd dimension was ${n.shape[1]}`), w(t.rank === 1, () => "scores must be a 1D tensor"), w(t.shape[0] === i, () => `scores has incompatible shape with boxes. Expected ${i}, but was ${t.shape[0]}`), w(0 <= o && o <= 1, () => `softNmsSigma must be in [0, 1], but was '${o}'`), { maxOutputSize: e, iouThreshold: s, scoreThreshold: r, softNmsSigma: o };
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function yb(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY) {
  const o = $(n, "boxes", "nonMaxSuppression", "float32"), i = $(t, "scores", "nonMaxSuppression", "float32"), a = Hn(o, i, e, s, r);
  e = a.maxOutputSize, s = a.iouThreshold, r = a.scoreThreshold;
  const l = { maxOutputSize: e, iouThreshold: s, scoreThreshold: r };
  return A.runKernel(Dd, { boxes: o, scores: i }, l);
}
const wb = /* @__PURE__ */ C({ nonMaxSuppression_: yb });
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xb(n, t, e) {
  const s = Sb(n, t, e), r = s < 0 ? -(s + 1) : s;
  n.splice(r, 0, t);
}
function Sb(n, t, e) {
  return vb(n, t, e);
}
function vb(n, t, e) {
  let s = 0, r = n.length, o = 0, i = !1;
  for (; s < r; ) {
    o = s + (r - s >>> 1);
    const a = e(t, n[o]);
    a > 0 ? s = o + 1 : (r = o, i = !a);
  }
  return i ? s : -s - 1;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ib(n, t, e, s, r) {
  return Ci(
    n,
    t,
    e,
    s,
    r,
    0
    /* softNmsSigma */
  );
}
function $b(n, t, e, s, r, o) {
  return Ci(
    n,
    t,
    e,
    s,
    r,
    0,
    !1,
    o,
    !0
    /* returnValidOutputs */
  );
}
function Ab(n, t, e, s, r, o) {
  return Ci(
    n,
    t,
    e,
    s,
    r,
    o,
    !0
    /* returnScoresTensor */
  );
}
function Ci(n, t, e, s, r, o, i = !1, a = !1, l = !1) {
  const u = [];
  for (let m = 0; m < t.length; m++)
    t[m] > r && u.push({ score: t[m], boxIndex: m, suppressBeginIndex: 0 });
  u.sort(La);
  const c = o > 0 ? -0.5 / o : 0, h = [], f = [];
  for (; h.length < e && u.length > 0; ) {
    const m = u.pop(), { score: b, boxIndex: y, suppressBeginIndex: S } = m;
    if (b < r)
      break;
    let x = !1;
    for (let v = h.length - 1; v >= S; --v) {
      const E = Eb(n, y, h[v]);
      if (E >= s) {
        x = !0;
        break;
      }
      if (m.score = m.score * _b(s, c, E), m.score <= r)
        break;
    }
    m.suppressBeginIndex = h.length, x || (m.score === b ? (h.push(y), f.push(m.score)) : m.score > r && xb(u, m, La));
  }
  const d = h.length, p = e - d;
  a && p > 0 && (h.push(...new Array(p).fill(0)), f.push(...new Array(p).fill(0)));
  const g = { selectedIndices: h };
  return i && (g.selectedScores = f), l && (g.validOutputs = d), g;
}
function Eb(n, t, e) {
  const s = n.subarray(t * 4, t * 4 + 4), r = n.subarray(e * 4, e * 4 + 4), o = Math.min(s[0], s[2]), i = Math.min(s[1], s[3]), a = Math.max(s[0], s[2]), l = Math.max(s[1], s[3]), u = Math.min(r[0], r[2]), c = Math.min(r[1], r[3]), h = Math.max(r[0], r[2]), f = Math.max(r[1], r[3]), d = (a - o) * (l - i), p = (h - u) * (f - c);
  if (d <= 0 || p <= 0)
    return 0;
  const g = Math.max(o, u), m = Math.max(i, c), b = Math.min(a, h), y = Math.min(l, f), S = Math.max(b - g, 0) * Math.max(y - m, 0);
  return S / (d + p - S);
}
function _b(n, t, e) {
  const s = Math.exp(t * e * e);
  return e <= n ? s : 0;
}
function La(n, t) {
  return n.score - t.score || n.score === t.score && t.boxIndex - n.boxIndex;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function Cb(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY) {
  const o = $(n, "boxes", "nonMaxSuppressionAsync"), i = $(t, "scores", "nonMaxSuppressionAsync"), a = Hn(o, i, e, s, r);
  e = a.maxOutputSize, s = a.iouThreshold, r = a.scoreThreshold;
  const l = await Promise.all([o.data(), i.data()]), u = l[0], c = l[1], { selectedIndices: h } = Ib(u, c, e, s, r);
  return o !== n && o.dispose(), i !== t && i.dispose(), Dt(h, "int32");
}
const kb = Cb;
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Tb(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY, o = 0) {
  const i = $(n, "boxes", "nonMaxSuppression"), a = $(t, "scores", "nonMaxSuppression"), l = Hn(i, a, e, s, r, o);
  e = l.maxOutputSize, s = l.iouThreshold, r = l.scoreThreshold, o = l.softNmsSigma;
  const u = { boxes: i, scores: a }, c = { maxOutputSize: e, iouThreshold: s, scoreThreshold: r, softNmsSigma: o }, h = A.runKernel(Rd, u, c);
  return { selectedIndices: h[0], selectedScores: h[1] };
}
const Nb = /* @__PURE__ */ C({ nonMaxSuppressionWithScore_: Tb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function Db(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY, o = 0) {
  const i = $(n, "boxes", "nonMaxSuppressionAsync"), a = $(t, "scores", "nonMaxSuppressionAsync"), l = Hn(i, a, e, s, r, o);
  e = l.maxOutputSize, s = l.iouThreshold, r = l.scoreThreshold, o = l.softNmsSigma;
  const u = await Promise.all([i.data(), a.data()]), c = u[0], h = u[1], { selectedIndices: f, selectedScores: d } = Ab(c, h, e, s, r, o);
  return i !== n && i.dispose(), a !== t && a.dispose(), {
    selectedIndices: Dt(f, "int32"),
    selectedScores: Dt(d)
  };
}
const Pb = Db;
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Rb(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY, o = !1) {
  const i = $(n, "boxes", "nonMaxSuppression"), a = $(t, "scores", "nonMaxSuppression"), l = Hn(
    i,
    a,
    e,
    s,
    r,
    null
    /* softNmsSigma */
  ), u = l.maxOutputSize, c = l.iouThreshold, h = l.scoreThreshold, f = { boxes: i, scores: a }, d = {
    maxOutputSize: u,
    iouThreshold: c,
    scoreThreshold: h,
    padToMaxOutputSize: o
  }, p = A.runKernel(Pd, f, d);
  return { selectedIndices: p[0], validOutputs: p[1] };
}
const Lb = /* @__PURE__ */ C({ nonMaxSuppressionPadded_: Rb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
async function Ob(n, t, e, s = 0.5, r = Number.NEGATIVE_INFINITY, o = !1) {
  const i = $(n, "boxes", "nonMaxSuppressionAsync"), a = $(t, "scores", "nonMaxSuppressionAsync"), l = Hn(
    i,
    a,
    e,
    s,
    r,
    null
    /* softNmsSigma */
  ), u = l.maxOutputSize, c = l.iouThreshold, h = l.scoreThreshold, [f, d] = await Promise.all([i.data(), a.data()]), { selectedIndices: p, validOutputs: g } = $b(f, d, u, c, h, o);
  return i !== n && i.dispose(), a !== t && a.dispose(), {
    selectedIndices: Dt(p, "int32"),
    validOutputs: Yt(g, "int32")
  };
}
const Mb = Ob;
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Bb(n, t, e = !1, s = !1) {
  const r = $(n, "images", "resizeBilinear");
  w(r.rank === 3 || r.rank === 4, () => `Error in resizeBilinear: x must be rank 3 or 4, but got rank ${r.rank}.`), w(t.length === 2, () => `Error in resizeBilinear: new shape must 2D, but got shape ${t}.`), w(s === !1 || e === !1, () => "Error in resizeBilinear: If halfPixelCenters is true, alignCorners must be false.");
  let o = r, i = !1;
  r.rank === 3 && (i = !0, o = L(r, [1, r.shape[0], r.shape[1], r.shape[2]]));
  const a = { images: o }, l = { alignCorners: e, halfPixelCenters: s, size: t }, u = A.runKernel(Vd, a, l);
  return i ? L(u, [u.shape[1], u.shape[2], u.shape[3]]) : u;
}
const Fb = /* @__PURE__ */ C({ resizeBilinear_: Bb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zb(n, t, e = !1, s = !1) {
  const r = $(n, "images", "resizeNearestNeighbor");
  w(r.rank === 3 || r.rank === 4, () => `Error in resizeNearestNeighbor: x must be rank 3 or 4, but got rank ${r.rank}.`), w(t.length === 2, () => `Error in resizeNearestNeighbor: new shape must 2D, but got shape ${t}.`), w(r.dtype === "float32" || r.dtype === "int32", () => "`images` must have `int32` or `float32` as dtype"), w(s === !1 || e === !1, () => "Error in resizeNearestNeighbor: If halfPixelCenters is true, alignCorners must be false.");
  let o = r, i = !1;
  r.rank === 3 && (i = !0, o = L(r, [1, r.shape[0], r.shape[1], r.shape[2]]));
  const a = { images: o }, l = { alignCorners: e, halfPixelCenters: s, size: t }, u = A.runKernel(Yl, a, l);
  return i ? L(u, [u.shape[1], u.shape[2], u.shape[3]]) : u;
}
const Ub = /* @__PURE__ */ C({ resizeNearestNeighbor_: zb });
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wb(n, t = "binary", e = !1, s = 0.5) {
  const r = $(n, "image", "threshold"), o = 0.2989, i = 0.587, a = 0.114, l = r.shape[0] * r.shape[1];
  let u = N(Dt([s]), 255), c, h, f, d;
  if (w(r.rank === 3, () => `Error in threshold: image must be rank 3,but got rank ${r.rank}.`), w(r.shape[2] === 3 || r.shape[2] === 1, () => `Error in threshold: image color channel must be equal to 3 or 1but got ${r.shape[2]}.`), w(r.dtype === "int32" || r.dtype === "float32", () => `Error in dtype: image dtype must be int32 or float32,but got dtype ${r.dtype}.`), w(t === "otsu" || t === "binary", () => `Method must be binary or otsu, but was ${t}`), r.shape[2] === 3) {
    [c, h, f] = Fu(r, [1, 1, 1], -1);
    const m = N(c, o), b = N(h, i), y = N(f, a);
    d = M(M(m, b), y);
  } else
    d = n;
  if (t === "otsu") {
    const m = Gm(ot(O0(d), "int32"), nr([]), 256);
    u = Gb(m, l);
  }
  const p = e ? Nu(d, u) : ks(d, u);
  return ot(N(p, 255), "int32");
}
function Gb(n, t) {
  let e = Dt([-1]), s = Dt([0]), r = Dt([0]), o, i, a, l, u, c;
  for (let h = 0; h < n.size - 1; h++) {
    o = At(n, 0, h + 1), i = At(n, h + 1), u = Y(et(o), t), c = Y(et(i), t);
    const f = et(N(o, gr(0, o.size)));
    a = Y(f, et(o));
    const d = Vr(i.shape, o.size), p = M(gr(0, i.size), d), g = N(i, p);
    l = Y(et(g), et(i));
    const m = Z(a, l), b = Z(a, l), y = N(u, c);
    r = N(N(y, m), b);
    const S = ks(r, s);
    s = on(S, r, s), e = on(S, Dt([h]), e);
  }
  return e;
}
const Vb = /* @__PURE__ */ C({ threshold_: Wb });
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qb(n, t, e = "nearest", s = "constant", r = 0, o) {
  const i = $(n, "image", "transform", "float32"), a = $(t, "transforms", "transform", "float32");
  w(i.rank === 4, () => `Error in transform: image must be rank 4,but got rank ${i.rank}.`), w(a.rank === 2 && (a.shape[0] === i.shape[0] || a.shape[0] === 1) && a.shape[1] === 8, () => "Error in transform: Input transform should be batch x 8 or 1 x 8"), w(o == null || o.length === 2, () => `Error in transform: outputShape must be [height, width] or null, but got ${o}.`);
  const l = { image: i, transforms: a }, u = { interpolation: e, fillMode: s, fillValue: r, outputShape: o };
  return A.runKernel(sp, l, u);
}
const jb = /* @__PURE__ */ C({ transform_: qb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Hb(n, t, e) {
  const s = $(n, "a", "bandPart");
  w(s.rank >= 2, () => `bandPart(): Rank must be at least 2, got ${s.rank}.`);
  const r = s.shape, [o, i] = s.shape.slice(-2);
  let a, l;
  typeof t == "number" ? (w(t % 1 === 0, () => `bandPart(): numLower must be an integer, got ${t}.`), w(t <= o, () => `bandPart(): numLower (${t}) must not be greater than the number of rows (${o}).`), a = $(t < 0 ? o : t, "numLower", "bandPart")) : (w(t.dtype === "int32", () => "bandPart(): numLower's dtype must be an int32."), a = on(Ra(t, 0), o, mr(t, o))), typeof e == "number" ? (w(e % 1 === 0, () => `bandPart(): numUpper must be an integer, got ${e}.`), w(e <= i, () => `bandPart(): numUpper (${e}) must not be greater than the number of columns (${i}).`), l = $(e < 0 ? i : e, "numUpper", "bandPart")) : (w(e.dtype === "int32", () => "bandPart(): numUpper's dtype must be an int32."), l = on(Ra(e, 0), i, mr(e, i)));
  const u = L(gr(0, o, 1, "int32"), [-1, 1]), c = gr(0, i, 1, "int32"), h = Z(u, c), f = qr(Nu(h, a), Lg(h, qn(l))), d = Fn([o, i], s.dtype);
  return L(br(Uu(L(s, [-1, o, i])).map((p) => on(f, p, d))), r);
}
const Kb = /* @__PURE__ */ C({ bandPart_: Hb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Yb(n) {
  let t;
  if (Array.isArray(n)) {
    t = !1, w(n != null && n.length > 0, () => "Gram-Schmidt process: input must not be null, undefined, or empty");
    const r = n[0].shape[0];
    for (let o = 1; o < n.length; ++o)
      w(n[o].shape[0] === r, () => `Gram-Schmidt: Non-unique lengths found in the input vectors: (${n[o].shape[0]} vs. ${r})`);
  } else
    t = !0, n = Fu(n, n.shape[0], 0).map((r) => jr(r, [0]));
  w(n.length <= n[0].shape[0], () => `Gram-Schmidt: Number of vectors (${n.length}) exceeds number of dimensions (${n[0].shape[0]}).`);
  const e = [], s = n;
  for (let r = 0; r < n.length; ++r)
    e.push(A.tidy(() => {
      let o = s[r];
      if (r > 0)
        for (let i = 0; i < r; ++i) {
          const a = N(et(N(e[i], o)), e[i]);
          o = Z(o, a);
        }
      return Y(o, ku(o, "euclidean"));
    }));
  return t ? br(e, 0) : e;
}
const Xb = /* @__PURE__ */ C({ gramSchmidt_: Yb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Jb(n, t = !1) {
  if (w(n.rank >= 2, () => `qr() requires input tensor to have a rank >= 2, but got rank ${n.rank}`), n.rank === 2)
    return Oa(n, t);
  {
    const e = n.shape.slice(0, n.shape.length - 2).reduce((l, u) => l * u), s = Uu(L(n, [
      e,
      n.shape[n.shape.length - 2],
      n.shape[n.shape.length - 1]
    ]), 0), r = [], o = [];
    s.forEach((l) => {
      const [u, c] = Oa(l, t);
      r.push(u), o.push(c);
    });
    const i = L(br(r, 0), n.shape), a = L(br(o, 0), n.shape);
    return [i, a];
  }
}
function Oa(n, t = !1) {
  return A.tidy(() => {
    w(n.shape.length === 2, () => `qr2d() requires a 2D Tensor, but got a ${n.shape.length}D Tensor.`);
    const e = n.shape[0], s = n.shape[1];
    let r = Tu(e), o = sn(n);
    const i = ho([[1]], [1, 1]);
    let a = sn(i);
    const l = e >= s ? s : e;
    for (let u = 0; u < l; ++u) {
      const c = o, h = a, f = r;
      [a, o, r] = A.tidy(() => {
        const d = At(o, [u, u], [e - u, 1]), p = ku(d), g = At(o, [u, u], [1, 1]), m = on(ks(g, 0), ho([[-1]]), ho([[1]])), b = Z(g, N(m, p)), y = Y(d, b);
        y.shape[0] === 1 ? a = sn(i) : a = rn([
          i,
          At(y, [1, 0], [y.shape[0] - 1, y.shape[1]])
        ], 0);
        const S = qn(Y(we(m, b), p)), x = At(o, [u, 0], [e - u, s]), v = N(S, a), E = pt(a);
        if (u === 0)
          o = Z(x, we(v, we(E, x)));
        else {
          const T = Z(x, we(v, we(E, x)));
          o = rn([At(o, [0, 0], [u, s]), T], 0);
        }
        const D = pt(v), k = At(r, [0, u], [e, r.shape[1] - u]);
        if (u === 0)
          r = Z(k, we(we(k, a), D));
        else {
          const T = Z(k, we(we(k, a), D));
          r = rn([At(r, [0, 0], [e, u]), T], 1);
        }
        return [a, o, r];
      }), ut([c, h, f]);
    }
    return !t && e > s && (r = At(r, [0, 0], [e, s]), o = At(o, [0, 0], [s, s])), [r, o];
  });
}
const Zb = /* @__PURE__ */ C({ qr_: Jb });
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Us = {
  flipLeftRight: hb,
  grayscaleToRGB: db,
  resizeNearestNeighbor: Ub,
  resizeBilinear: Fb,
  rgbToGrayscale: mb,
  rotateWithOffset: bb,
  cropAndResize: ub,
  nonMaxSuppression: wb,
  nonMaxSuppressionAsync: kb,
  nonMaxSuppressionWithScore: Nb,
  nonMaxSuppressionWithScoreAsync: Pb,
  nonMaxSuppressionPadded: Lb,
  nonMaxSuppressionPaddedAsync: Mb,
  threshold: Vb,
  transform: jb
}, Qb = {
  bandPart: Kb,
  gramSchmidt: Xb,
  qr: Zb
};
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ty = /* @__PURE__ */ new Map(), ey = /* @__PURE__ */ new Map();
class Kn {
  /**
   * Return the class name for this class to use in serialization contexts.
   *
   * Generally speaking this will be the same thing that constructor.name
   * would have returned.  However, the class name needs to be robust
   * against minification for serialization/deserialization to work properly.
   *
   * There's also places such as initializers.VarianceScaling, where
   * implementation details between different languages led to different
   * class hierarchies and a non-leaf node is used for serialization purposes.
   */
  getClassName() {
    return this.constructor.className;
  }
  /**
   * Creates an instance of T from a ConfigDict.
   *
   * This works for most descendants of serializable.  A few need to
   * provide special handling.
   * @param cls A Constructor for the class to instantiate.
   * @param config The Configuration for the object.
   */
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e);
  }
}
class te {
  constructor() {
    this.classNameMap = {};
  }
  /**
   * Returns the singleton instance of the map.
   */
  static getMap() {
    return te.instance == null && (te.instance = new te()), te.instance;
  }
  /**
   * Registers the class as serializable.
   */
  static register(t) {
    te.getMap().classNameMap[t.className] = [t, t.fromConfig];
  }
}
function O(n, t, e) {
  w(n.className != null, () => "Class being registered does not have the static className property defined."), w(typeof n.className == "string", () => "className is required to be a string, but got type " + typeof n.className), w(n.className.length > 0, () => "Class being registered has an empty-string as its className, which is disallowed."), typeof t > "u" && (t = "Custom"), typeof e > "u" && (e = n.className);
  const s = e, r = t + ">" + s;
  return te.register(n), ty.set(r, n), ey.set(n, r), n;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Ke extends Kn {
  /**
   * Executes `f()` and minimizes the scalar output of `f()` by computing
   * gradients of y with respect to the list of trainable variables provided by
   * `varList`. If no list is provided, it defaults to all trainable variables.
   *
   * @param f The function to execute and whose output to minimize.
   * @param returnCost Whether to return the scalar cost value produced by
   * executing `f()`.
   * @param varList An optional list of variables to update. If specified, only
   * the trainable variables in varList will be updated by minimize. Defaults to
   * all trainable variables.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers'}
   */
  minimize(t, e = !1, s) {
    const { value: r, grads: o } = this.computeGradients(t, s);
    if (s != null) {
      const i = s.map((a) => ({ name: a.name, tensor: o[a.name] }));
      this.applyGradients(i);
    } else
      this.applyGradients(o);
    return ut(o), e ? r : (r.dispose(), null);
  }
  /**
   * The number of iterations that this optimizer instance has been invoked for.
   */
  get iterations() {
    return this.iterations_ == null && (this.iterations_ = 0), this.iterations_;
  }
  incrementIterations() {
    this.iterations_ = this.iterations + 1;
  }
  /**
   * Executes f() and computes the gradient of the scalar output of f() with
   * respect to the list of trainable variables provided by `varList`. If no
   * list is provided, it defaults to all trainable variables.
   *
   * @param f The function to execute and whose output to use for computing
   * gradients with respect to variables.
   * @param varList An optional list of variables to compute gradients with
   * respect to. If specified, only the trainable variables in varList will have
   * gradients computed with respect to. Defaults to all trainable variables.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers'}
   */
  computeGradients(t, e) {
    return qg(t, e);
  }
  /**
   * Dispose the variables (if any) owned by this optimizer instance.
   */
  dispose() {
    this.iterations_ != null && ut(this.iterations_);
  }
  async saveIterations() {
    return this.iterations_ == null && (this.iterations_ = 0), {
      name: "iter",
      // TODO(cais): Use 'int64' type when available.
      tensor: Yt(this.iterations_, "int32")
    };
  }
  async getWeights() {
    throw new Error("getWeights() is not implemented for this optimizer yet.");
  }
  async setWeights(t) {
    throw new Error(`setWeights() is not implemented for this optimizer class ${this.getClassName()}`);
  }
  /**
   * Extract the first element of the weight values and set it
   * as the iterations counter variable of this instance of optimizer.
   *
   * @param weightValues
   * @returns Weight values with the first element consumed and excluded.
   */
  async extractIterations(t) {
    return this.iterations_ = (await t[0].tensor.data())[0], t.slice(1);
  }
}
Object.defineProperty(Ke, Symbol.hasInstance, {
  value: (n) => n.minimize != null && n.computeGradients != null && n.applyGradients != null
});
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Wu extends Ke {
  /** @nocollapse */
  static get className() {
    return "Adadelta";
  }
  constructor(t, e, s = null) {
    super(), this.learningRate = t, this.rho = e, this.epsilon = s, this.accumulatedGrads = [], this.accumulatedUpdates = [], s == null && (this.epsilon = A.backend.epsilon());
  }
  applyGradients(t) {
    (Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t)).forEach((s, r) => {
      const o = A.registeredVariables[s], i = !1;
      this.accumulatedGrads[r] == null && (this.accumulatedGrads[r] = {
        originalName: `${s}/accum_grad`,
        variable: _(() => _e(o).variable(i))
      }), this.accumulatedUpdates[r] == null && (this.accumulatedUpdates[r] = {
        originalName: `${s}/accum_var`,
        variable: _(() => _e(o).variable(i))
      });
      const a = Array.isArray(t) ? t[r].tensor : t[s];
      if (a == null)
        return;
      const l = this.accumulatedGrads[r].variable, u = this.accumulatedUpdates[r].variable;
      _(() => {
        const c = M(N(l, this.rho), N(Ve(a), 1 - this.rho)), h = N(Y(me(M(u, this.epsilon)), me(M(l, this.epsilon))), a), f = M(N(u, this.rho), N(Ve(h), 1 - this.rho));
        l.assign(c), u.assign(f);
        const d = M(N(h, -this.learningRate), o);
        o.assign(d);
      });
    }), this.incrementIterations();
  }
  dispose() {
    this.accumulatedUpdates != null && (ut(this.accumulatedGrads.map((t) => t.variable)), ut(this.accumulatedUpdates.map((t) => t.variable)));
  }
  async getWeights() {
    const t = [...this.accumulatedGrads, ...this.accumulatedUpdates];
    return [await this.saveIterations()].concat(t.map((e) => ({ name: e.originalName, tensor: e.variable })));
  }
  async setWeights(t) {
    t = await this.extractIterations(t);
    const e = t.length / 2, s = !1;
    this.accumulatedGrads = t.slice(0, e).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    })), this.accumulatedUpdates = t.slice(e, e * 2).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    }));
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      rho: this.rho,
      epsilon: this.epsilon
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.rho, e.epsilon);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Gu extends Ke {
  /** @nocollapse */
  static get className() {
    return "Adagrad";
  }
  constructor(t, e = 0.1) {
    super(), this.learningRate = t, this.initialAccumulatorValue = e, this.accumulatedGrads = [];
  }
  applyGradients(t) {
    (Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t)).forEach((s, r) => {
      const o = A.registeredVariables[s];
      this.accumulatedGrads[r] == null && (this.accumulatedGrads[r] = {
        originalName: `${s}/accumulator`,
        variable: _(() => Vr(o.shape, this.initialAccumulatorValue).variable(!1))
      });
      const i = Array.isArray(t) ? t[r].tensor : t[s];
      if (i == null)
        return;
      const a = this.accumulatedGrads[r].variable;
      _(() => {
        const l = M(a, Ve(i));
        a.assign(l);
        const u = M(N(Y(i, me(M(l, A.backend.epsilon()))), -this.learningRate), o);
        o.assign(u);
      });
    }), this.incrementIterations();
  }
  dispose() {
    this.accumulatedGrads != null && ut(this.accumulatedGrads.map((t) => t.variable));
  }
  async getWeights() {
    return [await this.saveIterations()].concat(this.accumulatedGrads.map((t) => ({ name: t.originalName, tensor: t.variable })));
  }
  async setWeights(t) {
    t = await this.extractIterations(t);
    const e = !1;
    this.accumulatedGrads = t.map((s) => ({ originalName: s.name, variable: s.tensor.variable(e) }));
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      initialAccumulatorValue: this.initialAccumulatorValue
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.initialAccumulatorValue);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Vu extends Ke {
  /** @nocollapse */
  static get className() {
    return "Adam";
  }
  constructor(t, e, s, r = null) {
    super(), this.learningRate = t, this.beta1 = e, this.beta2 = s, this.epsilon = r, this.accumulatedFirstMoment = [], this.accumulatedSecondMoment = [], _(() => {
      this.accBeta1 = Yt(e).variable(), this.accBeta2 = Yt(s).variable();
    }), r == null && (this.epsilon = A.backend.epsilon());
  }
  applyGradients(t) {
    const e = Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t);
    _(() => {
      const s = Z(1, this.accBeta1), r = Z(1, this.accBeta2);
      e.forEach((o, i) => {
        const a = A.registeredVariables[o], l = !1;
        this.accumulatedFirstMoment[i] == null && (this.accumulatedFirstMoment[i] = {
          originalName: `${o}/m`,
          variable: _(() => _e(a).variable(l))
        }), this.accumulatedSecondMoment[i] == null && (this.accumulatedSecondMoment[i] = {
          originalName: `${o}/v`,
          variable: _(() => _e(a).variable(l))
        });
        const u = Array.isArray(t) ? t[i].tensor : t[o];
        if (u == null)
          return;
        const c = this.accumulatedFirstMoment[i].variable, h = this.accumulatedSecondMoment[i].variable, f = M(N(c, this.beta1), N(u, 1 - this.beta1)), d = M(N(h, this.beta2), N(Ve(u), 1 - this.beta2)), p = Y(f, s), g = Y(d, r);
        c.assign(f), h.assign(d);
        const m = M(N(Y(p, M(me(g), this.epsilon)), -this.learningRate), a);
        a.assign(m);
      }), this.accBeta1.assign(N(this.accBeta1, this.beta1)), this.accBeta2.assign(N(this.accBeta2, this.beta2));
    }), this.incrementIterations();
  }
  dispose() {
    this.accBeta1.dispose(), this.accBeta2.dispose(), this.accumulatedFirstMoment != null && ut(this.accumulatedFirstMoment.map((t) => t.variable)), this.accumulatedSecondMoment != null && ut(this.accumulatedSecondMoment.map((t) => t.variable));
  }
  async getWeights() {
    const t = [...this.accumulatedFirstMoment, ...this.accumulatedSecondMoment];
    return [await this.saveIterations()].concat(t.map((e) => ({ name: e.originalName, tensor: e.variable })));
  }
  async setWeights(t) {
    t = await this.extractIterations(t), _(() => {
      this.accBeta1.assign(pr(this.beta1, this.iterations_ + 1)), this.accBeta2.assign(pr(this.beta2, this.iterations_ + 1));
    });
    const e = t.length / 2, s = !1;
    this.accumulatedFirstMoment = t.slice(0, e).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    })), this.accumulatedSecondMoment = t.slice(e, e * 2).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    }));
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      beta1: this.beta1,
      beta2: this.beta2,
      epsilon: this.epsilon
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.beta1, e.beta2, e.epsilon);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class qu extends Ke {
  /** @nocollapse */
  static get className() {
    return "Adamax";
  }
  constructor(t, e, s, r = null, o = 0) {
    super(), this.learningRate = t, this.beta1 = e, this.beta2 = s, this.epsilon = r, this.decay = o, this.accumulatedFirstMoment = [], this.accumulatedWeightedInfNorm = [], _(() => {
      this.iteration = Yt(0).variable(), this.accBeta1 = Yt(e).variable();
    }), r == null && (this.epsilon = A.backend.epsilon());
  }
  applyGradients(t) {
    const e = Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t);
    _(() => {
      const s = Z(1, this.accBeta1), r = Y(-this.learningRate, M(N(this.iteration, this.decay), 1));
      e.forEach((o, i) => {
        const a = A.registeredVariables[o], l = !1;
        this.accumulatedFirstMoment[i] == null && (this.accumulatedFirstMoment[i] = {
          originalName: `${o}/m`,
          variable: _e(a).variable(l)
        }), this.accumulatedWeightedInfNorm[i] == null && (this.accumulatedWeightedInfNorm[i] = {
          originalName: `${o}/v`,
          variable: _e(a).variable(l)
        });
        const u = Array.isArray(t) ? t[i].tensor : t[o];
        if (u == null)
          return;
        const c = this.accumulatedFirstMoment[i].variable, h = this.accumulatedWeightedInfNorm[i].variable, f = M(N(c, this.beta1), N(u, 1 - this.beta1)), d = N(h, this.beta2), p = Nt(u), g = jn(d, p);
        c.assign(f), h.assign(g);
        const m = M(N(Y(r, s), Y(f, M(g, this.epsilon))), a);
        a.assign(m);
      }), this.iteration.assign(M(this.iteration, 1)), this.accBeta1.assign(N(this.accBeta1, this.beta1));
    }), this.incrementIterations();
  }
  dispose() {
    this.accBeta1.dispose(), this.iteration.dispose(), this.accumulatedFirstMoment != null && ut(this.accumulatedFirstMoment.map((t) => t.variable)), this.accumulatedWeightedInfNorm != null && ut(this.accumulatedWeightedInfNorm.map((t) => t.variable));
  }
  async getWeights() {
    throw new Error("getWeights() is not implemented for Adamax yet.");
  }
  async setWeights(t) {
    throw new Error("setWeights() is not implemented for Adamax yet.");
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      beta1: this.beta1,
      beta2: this.beta2,
      epsilon: this.epsilon,
      decay: this.decay
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.beta1, e.beta2, e.epsilon, e.decay);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ki extends Ke {
  /** @nocollapse */
  static get className() {
    return "SGD";
  }
  constructor(t) {
    super(), this.learningRate = t, this.setLearningRate(t);
  }
  applyGradients(t) {
    (Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t)).forEach((s, r) => {
      const o = Array.isArray(t) ? t[r].tensor : t[s];
      if (o == null)
        return;
      const i = A.registeredVariables[s];
      _(() => {
        const a = M(N(this.c, o), i);
        i.assign(a);
      });
    }), this.incrementIterations();
  }
  /**
   * Sets the learning rate of the optimizer.
   */
  setLearningRate(t) {
    this.learningRate = t, this.c != null && this.c.dispose(), this.c = Pn(Yt(-t));
  }
  dispose() {
    this.c.dispose();
  }
  async getWeights() {
    return [await this.saveIterations()];
  }
  async setWeights(t) {
    if (t = await this.extractIterations(t), t.length !== 0)
      throw new Error("SGD optimizer does not have settable weights.");
  }
  getConfig() {
    return { learningRate: this.learningRate };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ju extends ki {
  /** @nocollapse */
  // Name matters for Python compatibility.
  static get className() {
    return "Momentum";
  }
  constructor(t, e, s = !1) {
    super(t), this.learningRate = t, this.momentum = e, this.useNesterov = s, this.accumulations = [], this.m = Yt(this.momentum);
  }
  applyGradients(t) {
    (Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t)).forEach((s, r) => {
      const o = A.registeredVariables[s];
      this.accumulations[r] == null && (this.accumulations[r] = {
        originalName: `${s}/momentum`,
        variable: _(() => _e(o).variable(!1))
      });
      const i = this.accumulations[r].variable, a = Array.isArray(t) ? t[r].tensor : t[s];
      a != null && _(() => {
        let l;
        const u = M(N(this.m, i), a);
        this.useNesterov ? l = M(N(this.c, M(a, N(u, this.m))), o) : l = M(N(this.c, u), o), i.assign(u), o.assign(l);
      });
    }), this.incrementIterations();
  }
  dispose() {
    this.m.dispose(), this.accumulations != null && ut(this.accumulations.map((t) => t.variable));
  }
  /**
   * Sets the momentum of the optimizer.
   *
   * @param momentum
   */
  setMomentum(t) {
    this.momentum = t;
  }
  async getWeights() {
    return [await this.saveIterations()].concat(this.accumulations.map((t) => ({ name: t.originalName, tensor: t.variable })));
  }
  async setWeights(t) {
    t = await this.extractIterations(t);
    const e = !1;
    this.accumulations = t.map((s) => ({ originalName: s.name, variable: s.tensor.variable(e) }));
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      momentum: this.momentum,
      useNesterov: this.useNesterov
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.momentum, e.useNesterov);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Hu extends Ke {
  /** @nocollapse */
  static get className() {
    return "RMSProp";
  }
  constructor(t, e = 0.9, s = 0, r = null, o = !1) {
    if (super(), this.learningRate = t, this.decay = e, this.momentum = s, this.epsilon = r, this.accumulatedMeanSquares = [], this.accumulatedMoments = [], this.accumulatedMeanGrads = [], this.centered = o, r == null && (this.epsilon = A.backend.epsilon()), t == null)
      throw new Error("learningRate for RMSPropOptimizer must be defined.");
  }
  applyGradients(t) {
    (Array.isArray(t) ? t.map((s) => s.name) : Object.keys(t)).forEach((s, r) => {
      const o = A.registeredVariables[s], i = !1;
      this.accumulatedMeanSquares[r] == null && (this.accumulatedMeanSquares[r] = {
        originalName: `${s}/rms`,
        variable: _(() => _e(o).variable(i))
      }), this.accumulatedMoments[r] == null && (this.accumulatedMoments[r] = {
        originalName: `${s}/momentum`,
        variable: _(() => _e(o).variable(i))
      }), this.accumulatedMeanGrads[r] == null && this.centered && (this.accumulatedMeanGrads[r] = {
        originalName: `${s}/mg`,
        variable: _(() => _e(o).variable(i))
      });
      const a = Array.isArray(t) ? t[r].tensor : t[s];
      if (a == null)
        return;
      const l = this.accumulatedMeanSquares[r].variable, u = this.accumulatedMoments[r].variable;
      _(() => {
        const c = M(N(l, this.decay), N(Ve(a), 1 - this.decay));
        if (this.centered) {
          const h = this.accumulatedMeanGrads[r].variable, f = M(N(h, this.decay), N(a, 1 - this.decay)), d = Y(N(a, this.learningRate), me(Z(c, M(Ve(f), this.epsilon)))), p = M(N(u, this.momentum), d);
          l.assign(c), h.assign(f), u.assign(p);
          const g = Z(o, p);
          o.assign(g);
        } else {
          const h = M(N(l, this.decay), N(Ve(a), 1 - this.decay)), f = M(N(u, this.momentum), Y(N(a, this.learningRate), me(M(h, this.epsilon))));
          l.assign(h), u.assign(f);
          const d = Z(o, f);
          o.assign(d);
        }
      });
    }), this.incrementIterations();
  }
  dispose() {
    this.accumulatedMeanSquares != null && ut(this.accumulatedMeanSquares.map((t) => t.variable)), this.accumulatedMeanGrads != null && this.centered && ut(this.accumulatedMeanGrads.map((t) => t.variable)), this.accumulatedMoments != null && ut(this.accumulatedMoments.map((t) => t.variable));
  }
  async getWeights() {
    const t = [...this.accumulatedMeanSquares, ...this.accumulatedMoments];
    return this.centered && t.push(...this.accumulatedMeanGrads), [await this.saveIterations()].concat(t.map((e) => ({ name: e.originalName, tensor: e.variable })));
  }
  async setWeights(t) {
    t = await this.extractIterations(t);
    const e = this.centered ? t.length / 3 : t.length / 2, s = !1;
    this.accumulatedMeanSquares = t.slice(0, e).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    })), this.accumulatedMoments = t.slice(e, e * 2).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    })), this.centered && (this.accumulatedMeanGrads = t.slice(e * 2, e * 3).map((r) => ({
      originalName: r.name,
      variable: r.tensor.variable(s)
    })));
  }
  getConfig() {
    return {
      learningRate: this.learningRate,
      decay: this.decay,
      momentum: this.momentum,
      epsilon: this.epsilon,
      centered: this.centered
    };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t(e.learningRate, e.decay, e.momentum, e.epsilon, e.centered);
  }
}
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const ny = [
  Wu,
  Gu,
  Vu,
  qu,
  ju,
  Hu,
  ki
];
function sy() {
  for (const n of ny)
    O(n);
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ry(n, t, e) {
  const s = n.shape.length;
  w(s === t.length, () => `Error in slice${s}D: Length of begin ${t} must match the rank of the array (${s}).`), w(s === e.length, () => `Error in slice${s}D: Length of size ${e} must match the rank of the array (${s}).`);
  for (let r = 0; r < s; ++r)
    w(t[r] + e[r] <= n.shape[r], () => `Error in slice${s}D: begin[${r}] + size[${r}] (${t[r] + e[r]}) would overflow input.shape[${r}] (${n.shape[r]})`);
}
function oy(n, t, e) {
  let s = e.length;
  for (let r = 0; r < e.length; r++)
    if (e[r] > 1) {
      s = r;
      break;
    }
  for (let r = s + 1; r < e.length; r++)
    if (t[r] > 0 || e[r] !== n[r])
      return !1;
  return !0;
}
function iy(n, t) {
  let e = n.length > 0 ? n[n.length - 1] : 1;
  for (let s = 0; s < n.length - 1; s++)
    e += n[s] * t[s];
  return e;
}
function ay(n, t, e) {
  let s;
  const r = n.shape.length;
  typeof t == "number" ? s = [t, ...new Array(r - 1).fill(0)] : t.length < r ? s = t.concat(new Array(r - t.length).fill(0)) : s = t.slice(), s.forEach((i) => {
    w(i !== -1, () => "slice() does not support negative begin indexing.");
  });
  let o;
  return e == null ? o = new Array(r).fill(-1) : typeof e == "number" ? o = [e, ...new Array(r - 1).fill(-1)] : e.length < r ? o = e.concat(new Array(r - e.length).fill(-1)) : o = e, o = o.map((i, a) => i >= 0 ? i : (w(i === -1, () => `Negative size values should be exactly -1 but got ${i} for the slice() size at index ${a}.`), n.shape[a] - s[a])), [s, o];
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class ly {
  /**
   * Constructs a `tf.SGDOptimizer` that uses stochastic gradient descent.
   *
   * ```js
   * // Fit a quadratic function by learning the coefficients a, b, c.
   * const xs = tf.tensor1d([0, 1, 2, 3]);
   * const ys = tf.tensor1d([1.1, 5.9, 16.8, 33.9]);
   *
   * const a = tf.scalar(Math.random()).variable();
   * const b = tf.scalar(Math.random()).variable();
   * const c = tf.scalar(Math.random()).variable();
   *
   * // y = a * x^2 + b * x + c.
   * const f = x => a.mul(x.square()).add(b.mul(x)).add(c);
   * const loss = (pred, label) => pred.sub(label).square().mean();
   *
   * const learningRate = 0.01;
   * const optimizer = tf.train.sgd(learningRate);
   *
   * // Train the model.
   * for (let i = 0; i < 10; i++) {
   *   optimizer.minimize(() => loss(f(xs), ys));
   * }
   *
   * // Make predictions.
   * console.log(
   *     `a: ${a.dataSync()}, b: ${b.dataSync()}, c: ${c.dataSync()}`);
   * const preds = f(xs).dataSync();
   * preds.forEach((pred, i) => {
   *   console.log(`x: ${i}, pred: ${pred}`);
   * });
   * ```
   *
   * @param learningRate The learning rate to use for the SGD algorithm.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static sgd(t) {
    return new ki(t);
  }
  /**
   * Constructs a `tf.MomentumOptimizer` that uses momentum gradient
   * descent.
   *
   * See
   * [http://proceedings.mlr.press/v28/sutskever13.pdf](
   * http://proceedings.mlr.press/v28/sutskever13.pdf)
   *
   * @param learningRate The learning rate to use for the Momentum gradient
   * descent algorithm.
   * @param momentum The momentum to use for the momentum gradient descent
   * algorithm.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static momentum(t, e, s = !1) {
    return new ju(t, e, s);
  }
  /**
   * Constructs a `tf.RMSPropOptimizer` that uses RMSProp gradient
   * descent. This implementation uses plain momentum and is not centered
   * version of RMSProp.
   *
   * See
   * [http://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf](
   * http://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf)
   *
   * @param learningRate The learning rate to use for the RMSProp gradient
   * descent algorithm.
   * @param decay The discounting factor for the history/coming gradient.
   * @param momentum The momentum to use for the RMSProp gradient descent
   * algorithm.
   * @param epsilon Small value to avoid zero denominator.
   * @param centered If true, gradients are normalized by the estimated
   * variance of the gradient.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static rmsprop(t, e = 0.9, s = 0, r = null, o = !1) {
    return new Hu(t, e, s, r, o);
  }
  /**
   * Constructs a `tf.AdamOptimizer` that uses the Adam algorithm.
   * See [https://arxiv.org/abs/1412.6980](https://arxiv.org/abs/1412.6980)
   *
   * @param learningRate The learning rate to use for the Adam gradient
   * descent algorithm.
   * @param beta1 The exponential decay rate for the 1st moment estimates.
   * @param beta2 The exponential decay rate for the 2nd moment estimates.
   * @param epsilon A small constant for numerical stability.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static adam(t = 1e-3, e = 0.9, s = 0.999, r = null) {
    return new Vu(t, e, s, r);
  }
  /**
   * Constructs a `tf.AdadeltaOptimizer` that uses the Adadelta algorithm.
   * See [https://arxiv.org/abs/1212.5701](https://arxiv.org/abs/1212.5701)
   *
   * @param learningRate The learning rate to use for the Adadelta gradient
   * descent algorithm.
   * @param rho The learning rate decay over each update.
   * @param epsilon A constant epsilon used to better condition the grad
   * update.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static adadelta(t = 1e-3, e = 0.95, s = null) {
    return new Wu(t, e, s);
  }
  /**
   * Constructs a `tf.AdamaxOptimizer` that uses the Adamax algorithm.
   * See [https://arxiv.org/abs/1412.6980](https://arxiv.org/abs/1412.6980)
   *
   * @param learningRate The learning rate to use for the Adamax gradient
   * descent algorithm.
   * @param beta1 The exponential decay rate for the 1st moment estimates.
   * @param beta2 The exponential decay rate for the 2nd moment estimates.
   * @param epsilon A small constant for numerical stability.
   * @param decay The learning rate decay over each update.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static adamax(t = 2e-3, e = 0.9, s = 0.999, r = null, o = 0) {
    return new qu(t, e, s, r, o);
  }
  /**
   * Constructs a `tf.AdagradOptimizer` that uses the Adagrad algorithm.
   * See
   * [http://www.jmlr.org/papers/volume12/duchi11a/duchi11a.pdf](
   * http://www.jmlr.org/papers/volume12/duchi11a/duchi11a.pdf)
   * or
   * [http://ruder.io/optimizing-gradient-descent/index.html#adagrad](
   * http://ruder.io/optimizing-gradient-descent/index.html#adagrad)
   *
   * @param learningRate The learning rate to use for the Adagrad gradient
   * descent algorithm.
   * @param initialAccumulatorValue Starting value for the accumulators, must be
   * positive.
   *
   * @doc {heading: 'Training', subheading: 'Optimizers', namespace: 'train'}
   */
  static adagrad(t, e = 0.1) {
    return new Gu(t, e);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const In = ly;
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const uy = typeof requestAnimationFrame < "u" ? requestAnimationFrame : typeof setImmediate < "u" ? setImmediate : (n) => n();
function cy() {
  return new Promise((n) => uy(() => n()));
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function hy(n, t) {
  const e = n[0].length;
  n.forEach((r, o) => {
    w(r.length === e, () => `Error in concat${e}D: rank of tensors[${o}] must be the same as the rank of the rest (${e})`);
  }), w(t >= 0 && t < e, () => `Error in concat${e}D: axis must be between 0 and ${e - 1}.`);
  const s = n[0];
  n.forEach((r, o) => {
    for (let i = 0; i < e; i++)
      w(i === t || r[i] === s[i], () => `Error in concat${e}D: Shape of tensors[${o}] (${r}) does not match the shape of the rest (${s}) along the non-concatenated axis ${o}.`);
  });
}
function Ss(n, t) {
  const e = n[0].slice();
  for (let s = 1; s < n.length; s++)
    e[t] += n[s][t];
  return e;
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var $e;
(function(n) {
  n[n.FIRST_DIM_SIZE = 0] = "FIRST_DIM_SIZE", n[n.VALUE_ROWIDS = 1] = "VALUE_ROWIDS", n[n.ROW_LENGTHS = 2] = "ROW_LENGTHS", n[n.ROW_SPLITS = 3] = "ROW_SPLITS", n[n.ROW_LIMITS = 4] = "ROW_LIMITS", n[n.ROW_STARTS = 5] = "ROW_STARTS";
})($e || ($e = {}));
function fy(n, t, e) {
  let s = new Array();
  if (e == null && t == null)
    return s;
  if (t == null)
    for (; s.length < n + e.length; )
      s.push(-1);
  else
    s = t.slice();
  if (e == null)
    return s;
  if (n + e.length !== s.length)
    throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.rank = ${n + e.length}, but shape.rank = ${s.length}`);
  for (let r = 1; r < e.length; ++r) {
    const o = e[r], i = s[s.length - e.length + r], a = s[i];
    if (o >= 0)
      if (a >= 0) {
        if (a !== o)
          throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.shape[${r + n}] = ${o} but shape[${r + n}] = ${a}`);
      } else
        s[i] = o;
  }
  return s;
}
function dy(n) {
  const t = {
    FIRST_DIM_SIZE: $e.FIRST_DIM_SIZE,
    VALUE_ROWIDS: $e.VALUE_ROWIDS,
    ROW_LENGTHS: $e.ROW_LENGTHS,
    ROW_SPLITS: $e.ROW_SPLITS,
    ROW_LIMITS: $e.ROW_LIMITS,
    ROW_STARTS: $e.ROW_STARTS
  }, e = [];
  for (const s of n)
    if (s in t)
      e.push(t[s]);
    else
      break;
  return e;
}
function py(n) {
  return n.length === 0 ? 0 : n[0] === $e.FIRST_DIM_SIZE ? n.length - 1 : n.length;
}
function my(n, t) {
  if (n == null || t == null)
    return;
  const e = n.length, s = t.length;
  if (e >= s)
    throw new Error(`defaultValue.shape=${n} and ragged tensor flatValues.shape=${t}, are incompatible: defaultValue.rank = ${e} must be less than ragged tensor input flatValues.rank = ${s})`);
  for (let r = 0; r < Math.min(e, s - 1); ++r) {
    const o = n[r], i = t[r + 1];
    if (o >= 0 && i >= 0 && o !== 1 && o !== i)
      throw new Error(`defaultValue.shape=${n}, and ragged tensor input flatValues.shape=${t} are incompatible: defaultValue.shape[${r - n.length}] = ${o} but ragged tensor input.flatValues.shape[${r - n.length}] = ${i}`);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const gy = 1.7580993408473768, by = 1.0507009873554805;
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const yy = 0.3275911, wy = 0.254829592, xy = -0.284496736, Sy = 1.421413741, vy = -1.453152027, Iy = 1.061405429;
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ma(n, t) {
  if (n.length !== t.length)
    throw new Error(`Cannot merge real and imag arrays of different lengths. real:${n.length}, imag: ${t.length}.`);
  const e = new Float32Array(n.length * 2);
  for (let s = 0; s < e.length; s += 2)
    e[s] = n[s / 2], e[s + 1] = t[s / 2];
  return e;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $y(n) {
  return `Received SparseTensor with denseShape[0] = 0 but
  indices.shape[0] = ${n}`;
}
function Ay(n, t) {
  return `indices(${n}, 0) is invalid: ${t} < 0`;
}
function Ey(n, t, e) {
  return `indices(${n}, 0) is invalid: ${t} >= ${e}`;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function _y(n, t) {
  return `only one output dimension may be -1, not both ${n} and ${t}`;
}
function Cy(n, t) {
  return `size ${n} must be non-negative, not ${t}`;
}
function ky() {
  return "reshape cannot infer the missing input size for an empty tensor unless all specified input sizes are non-zero";
}
function Ty(n, t) {
  const e = z(n), s = z(t);
  return `Input to reshape is a SparseTensor with ${e}
  dense values, but the requested shape requires a multiple of ${s}. inputShape=${n} outputShape= ${t}`;
}
function Ny(n, t) {
  const e = z(n), s = z(t);
  return `Input to reshape is a tensor with ${e} dense values, but the requested shape has ${s}. inputShape=${n} outputShape=${t}`;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ba() {
  return "segment ids must be >= 0";
}
function Dy() {
  return "segment ids are not increasing";
}
function Py(n, t) {
  return `Segment id ${n} out of range [0, ${t}), possibly because segmentIds input is not sorted.`;
}
function Ry(n, t, e) {
  return `Bad: indices[${n}] == ${t} out of range [0, ${e})`;
}
/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Ku(n) {
  try {
    return n.map((t) => lr(t));
  } catch (t) {
    throw new Error(`Failed to decode encoded string bytes into utf-8, error: ${t}`);
  }
}
function Ly(n) {
  return n.map((t) => nn(t));
}
/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
sy();
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const Oy = ["channelsFirst", "channelsLast"], My = ["nearest", "bilinear"], By = ["valid", "same", "causal"], Fy = ["max", "avg"];
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class Fe extends Error {
  constructor(t) {
    super(t), Object.setPrototypeOf(this, Fe.prototype);
  }
}
class qe extends Error {
  constructor(t) {
    super(t), Object.setPrototypeOf(this, qe.prototype);
  }
}
class I extends Error {
  constructor(t) {
    super(t), Object.setPrototypeOf(this, I.prototype);
  }
}
class J extends Error {
  constructor(t) {
    super(t), Object.setPrototypeOf(this, J.prototype);
  }
}
class Ti extends Error {
  constructor(t) {
    super(t), Object.setPrototypeOf(this, Ti.prototype);
  }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function yr(n, t) {
  if (Array.isArray(n)) {
    let e = [];
    for (let s = 0; s < t; s++)
      e = e.concat(n);
    return e;
  } else {
    const e = new Array(t);
    return e.fill(n), e;
  }
}
function Ae(n, t) {
  if (!n)
    throw new Ti(t);
}
function Fa(n, t) {
  let e = 0;
  for (const s of n)
    s === t && e++;
  return e;
}
function zt(n) {
  return n.length === 1 ? n[0] : n;
}
function st(n) {
  return Array.isArray(n) ? n : [n];
}
function Pe(n) {
  const e = n.replace(/(.)([A-Z][a-z0-9]+)/g, "$1_$2").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  return e[0] !== "_" ? e : "private" + e;
}
function Qe(n) {
  return n.length <= 1 || n.indexOf("_") === -1 ? n : n.replace(/[_]+(\w|$)/g, (t, e) => e.toUpperCase());
}
let Jt = {};
function Ni(n) {
  if (n == null)
    return null;
  const t = {};
  return t.className = n.getClassName(), t.config = n.getConfig(), t;
}
function qo(n) {
  if (!(n == null || typeof n != "object"))
    if (Array.isArray(n))
      n.forEach((t) => qo(t));
    else {
      const t = Object.keys(n);
      for (const e of t) {
        const s = n[e];
        s != null && typeof s == "object" && (!Array.isArray(s) && s.type === "ndarray" && typeof s.value == "number" ? n[e] = s.value : qo(s));
      }
    }
}
function Ns(n, t = {}, e = {}, s = "object", r = !1) {
  if (typeof n == "string") {
    const o = n;
    let i;
    if (o in e)
      i = e[o];
    else if (o in Jt)
      i = Jt[o];
    else if (i = t[o], i == null)
      throw new I(`Unknown ${s}: ${n}. This may be due to one of the following reasons:
1. The ${s} is defined in Python, in which case it needs to be ported to TensorFlow.js or your JavaScript code.
2. The custom ${s} is defined in JavaScript, but is not registered properly with tf.serialization.registerClass().`);
    return i;
  } else {
    const o = n;
    if (o.className == null || o.config == null)
      throw new I(`${s}: Improper config format: ${JSON.stringify(o)}.
'className' and 'config' must set.`);
    const i = o.className;
    let a, l;
    if (i in e ? [a, l] = e[i] : i in Jt ? [a, l] = Jt.className : i in t && ([a, l] = t[i]), a == null)
      throw new I(`Unknown ${s}: ${i}. This may be due to one of the following reasons:
1. The ${s} is defined in Python, in which case it needs to be ported to TensorFlow.js or your JavaScript code.
2. The custom ${s} is defined in JavaScript, but is not registered properly with tf.serialization.registerClass().`);
    if (l != null) {
      const u = {};
      for (const d of Object.keys(Jt))
        u[d] = Jt[d];
      for (const d of Object.keys(e))
        u[d] = e[d];
      const c = o.config;
      c.customObjects = u;
      const h = Object.assign({}, Jt);
      for (const d of Object.keys(e))
        Jt[d] = e[d];
      qo(o.config);
      const f = l(a, o.config, e, r);
      return Jt = Object.assign({}, h), f;
    } else {
      const u = Object.assign({}, Jt);
      for (const h of Object.keys(e))
        Jt[h] = e[h];
      const c = new a(o.config);
      return Jt = Object.assign({}, u), c;
    }
  }
}
function zy(n, t) {
  return n < t ? -1 : n > t ? 1 : 0;
}
function Ws(n, t) {
  return -1 * zy(n, t);
}
function an(n) {
  if (n == null)
    return n;
  const t = [];
  for (const e of n)
    t.indexOf(e) === -1 && t.push(e);
  return t;
}
function Uy(n) {
  if (n == null)
    throw new I(`Invalid value in obj: ${JSON.stringify(n)}`);
  for (const t in n)
    if (n.hasOwnProperty(t))
      return !1;
  return !0;
}
function Yn(n, t, e) {
  if (e != null && n.indexOf(e) < 0)
    throw new I(`${e} is not a valid ${t}.  Valid values are ${n} or null/undefined.`);
}
function Di(n, t, e = 0, s = 1 / 0) {
  return Ae(e >= 0), Ae(s >= e), Array.isArray(n) && n.length >= e && n.length <= s && n.every((r) => typeof r === t);
}
function Oe(n, t) {
  Array.isArray(n) ? (w(n.length > 0, () => `${t} is unexpectedly an empty array.`), n.forEach((e, s) => Oe(e, `element ${s + 1} of ${t}`))) : w(Number.isInteger(n) && n > 0, () => `Expected ${t} to be a positive integer, but got ${Yu(n)}.`);
}
function Yu(n) {
  return n === null ? "null" : Array.isArray(n) ? "[" + n.map((t) => Yu(t)).join(",") + "]" : typeof n == "string" ? `"${n}"` : `${n}`;
}
function Wy(n, t, e) {
  let s = e != null ? e() : On(), r;
  return (...i) => {
    const a = e != null ? e() : On();
    return a - s < t || (s = a, r = n(...i)), r;
  };
}
function Gy(n) {
  return n === "relu" ? "relu" : n === "linear" ? "linear" : n === "elu" ? "elu" : null;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const $n = /* @__PURE__ */ new Map();
function gt(n) {
  Yn(Oy, "DataFormat", n);
}
function Vy(n) {
  Yn(My, "InterpolationFormat", n);
}
function ie(n) {
  Yn(By, "PaddingMode", n);
}
function Xu(n) {
  Yn(Fy, "PoolMode", n);
}
const ps = [], za = "/";
function or(n, t) {
  ps.push(n);
  try {
    const e = t();
    return ps.pop(), e;
  } catch (e) {
    throw ps.pop(), e;
  }
}
function qy() {
  return ps.length === 0 ? "" : ps.join(za) + za;
}
function Ju(n) {
  if (!Qu(n))
    throw new Error("Not a valid tensor name: '" + n + "'");
  return qy() + n;
}
function Zu(n) {
  if (!Qu(n))
    throw new Error("Not a valid tensor name: '" + n + "'");
  $n.has(n) || $n.set(n, 0);
  const t = $n.get(n);
  if ($n.set(n, $n.get(n) + 1), t > 0) {
    const e = `${n}_${t}`;
    return $n.set(e, 1), e;
  } else
    return n;
}
const jy = new RegExp(/^[A-Za-z0-9][-A-Za-z0-9\._\/]*$/);
function Qu(n) {
  return !!n.match(jy);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Hy(n) {
  return n === parseInt(n.toString(), 10);
}
function ms(n, t, e) {
  t == null && (t = 0), e == null && (e = n.length);
  let s = 1;
  for (let r = t; r < e; ++r)
    s *= n[r];
  return s;
}
function tc(n) {
  if (n.length === 0)
    return Number.NaN;
  let t = Number.NEGATIVE_INFINITY;
  for (let e = 0; e < n.length; e++) {
    const s = n[e];
    s > t && (t = s);
  }
  return t;
}
function wr(n, t) {
  if (t < n)
    throw new I(`end (${t}) < begin (${n}) is forbidden.`);
  const e = [];
  for (let s = n; s < t; ++s)
    e.push(s);
  return e;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
let fo;
function mt() {
  return fo == null && (fo = Jp().epsilon()), fo;
}
function Xn() {
  return "channelsLast";
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function ec(n, t) {
  return ot(n, t);
}
function Pi(n, t = -1) {
  const e = n.shape.slice();
  return t < 0 && (t = e.length + t + 1), e.splice(t, 0, 1), L(n, e);
}
function Ky(n) {
  const t = [ms(n.shape)];
  return L(n, t);
}
function ln(n, t, e) {
  return _(() => {
    switch (n.rank) {
      case 1:
        return Ei(n, t, e);
      case 2:
        return Mu(n, [t, 0], [e, n.shape[1]]);
      case 3:
        return _i(n, [t, 0, 0], [e, n.shape[1], n.shape[2]]);
      case 4:
        return ws(n, [t, 0, 0, 0], [e, n.shape[1], n.shape[2], n.shape[3]]);
      case 5:
        return At(n, [t, 0, 0, 0, 0], [
          e,
          n.shape[1],
          n.shape[2],
          n.shape[3],
          n.shape[4]
        ]);
      case 6:
        return At(n, [t, 0, 0, 0, 0, 0], [
          e,
          n.shape[1],
          n.shape[2],
          n.shape[3],
          n.shape[4],
          n.shape[5]
        ]);
      default:
        throw new I(`sliceAlongFirstAxis() received an unsupported tensor rank: ${n.rank}`);
    }
  });
}
function po(n, t, e) {
  return _(() => {
    switch (n.rank) {
      case 1:
        return Ei(n, t, e);
      case 2:
        return Mu(n, [0, t], [n.shape[0], e]);
      case 3:
        return _i(n, [0, 0, t], [n.shape[0], n.shape[1], e]);
      case 4:
        return ws(n, [0, 0, 0, t], [n.shape[0], n.shape[1], n.shape[2], e]);
      default:
        throw new I(`sliceAlongLastAxis() received an unsupported tensor rank: ${n.rank}`);
    }
  });
}
function Gs(n, t, e, s) {
  return _(() => {
    switch (n.rank) {
      case 1:
        return Ei(n, t, e);
      case 2:
        switch (s) {
          case 1:
            return ln(n, t, e);
          case 2:
            return po(n, t, e);
          default:
            throw new I(`The axis is not within the rank of the tensor ${s}`);
        }
      case 3:
        switch (s) {
          case 1:
            return ln(n, t, e);
          case 2:
            return _i(n, [0, t, 0], [n.shape[0], e, n.shape[2]]);
          case 3:
            return po(n, t, e);
          default:
            throw new I(`The axis is not within the rank of the tensor ${s}`);
        }
      case 4:
        switch (s) {
          case 1:
            return ln(n, t, e);
          case 2:
            return ws(n, [0, t, 0, 0], [n.shape[0], e, n.shape[2], n.shape[3]]);
          case 3:
            return ws(n, [0, 0, t, 0], [n.shape[0], n.shape[1], e, n.shape[3]]);
          case 4:
            return po(n, t, e);
          default:
            throw new I(`The axis is not within the rank of the tensor ${s}`);
        }
      default:
        throw new I(`sliceAlongLastAxis() received an unsupported tensor rank: ${n.rank}`);
    }
  });
}
function Yy(n, t = -1) {
  let e;
  return t < 0 && (e = n[0].rank, e !== 0 ? t = e : t = 0), t === n[0].rank && (t = -1), rn(n, t);
}
function nc(n, t = 0, e = 1, s, r) {
  return C0(n, t, e, s, r);
}
function Xy(n, t, e) {
  return _(() => (Array.isArray(t) ? t = Dt(t, "int32") : t = ot(t, "int32"), Dg(n, t, e)));
}
function Ds(n) {
  return N(n, n);
}
function Jy(n, t, e) {
  const s = t.shape;
  if (t.rank !== 1 && t.rank !== n)
    throw new I(`Unexpected bias dimensions: ${t.rank}; expected it to be 1 or ${n}`);
  if (n === 5) {
    if (e === "channelsFirst")
      return s.length === 1 ? L(t, [1, s[0], 1, 1, 1]) : L(t, [1, s[3], s[0], s[1], s[2]]);
    if (e === "channelsLast")
      return s.length === 1 ? L(t, [1, 1, 1, 1, s[0]]) : L(t, [1].concat(s));
  } else if (n === 4) {
    if (e === "channelsFirst")
      return s.length === 1 ? L(t, [1, s[0], 1, 1]) : L(t, [1, s[2], s[0], s[1]]);
    if (e === "channelsLast")
      return s.length === 1 ? L(t, [1, 1, 1, s[0]]) : L(t, [1].concat(s));
  } else if (n === 3) {
    if (e === "channelsFirst")
      return s.length === 1 ? L(t, [1, s[0], 1]) : L(t, [1, s[1], s[0]]);
    if (e === "channelsLast")
      return s.length === 1 ? L(t, [1, 1, s[0]]) : L(t, [1].concat(s));
  } else if (n < 3)
    return t;
  throw new I(`Unsupported input rank by biasAdd: ${t.rank}`);
}
function Ps(n, t, e) {
  return _(() => (e == null && (e = Xn()), gt(e), M(n, Jy(n.rank, t, e))));
}
function Zy(n, t = 1) {
  if (t !== 1)
    throw new J(`Support for alpha values other than 1 (${t}) is not implemented yet.`);
  return Au(n);
}
function Qy(n) {
  return _(() => Y(n, M(Nt(n), 1)));
}
function tw(n) {
  return _(() => {
    const t = M(0.5, N(0.2, n));
    return pe(t, 0, 1);
  });
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class _t extends Kn {
  getConfig() {
    return {};
  }
}
class sc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x: Input.
   * @param alpha: Scaling factor the negative section.
   * @return Output of the ELU activation.
   */
  apply(t, e = 1) {
    return Zy(t, e);
  }
}
sc.className = "elu";
O(sc);
class rc extends _t {
  apply(t) {
    return B0(t);
  }
}
rc.className = "selu";
O(rc);
class oc extends _t {
  apply(t) {
    return Ts(t);
  }
}
oc.className = "relu";
O(oc);
class ic extends _t {
  apply(t) {
    return _(() => mr(6, Ts(t)));
  }
}
ic.className = "relu6";
O(ic);
class ac extends _t {
  apply(t) {
    return t;
  }
}
ac.className = "linear";
O(ac);
class lc extends _t {
  apply(t) {
    return pi(t);
  }
}
lc.className = "sigmoid";
O(lc);
class uc extends _t {
  apply(t) {
    return tw(t);
  }
}
uc.className = "hardSigmoid";
O(uc);
class cc extends _t {
  apply(t) {
    return yi(t);
  }
}
cc.className = "softplus";
O(cc);
class hc extends _t {
  apply(t) {
    return Qy(t);
  }
}
hc.className = "softsign";
O(hc);
class fc extends _t {
  apply(t) {
    return mi(t);
  }
}
fc.className = "tanh";
O(fc);
class dc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x Tensor.
   * @param axis Integer, axis along which the softmax normalization is applied.
   * Invalid if < 2, as softmax across 1 (the batch dimension) is assumed to be
   * an error.
   *
   * @returns a Tensor of the same shape as x
   *
   * @throws ValueError: In case `dim(x) < 2`.
   */
  apply(t, e = -1) {
    return Bu(t, e);
  }
}
dc.className = "softmax";
O(dc);
class pc extends _t {
  /**
   * Calculate the activation function of log softmax:
   * log( exp(x_i) / sum(exp(x)) )
   *
   * @param x Tensor.
   * @param axis Integer, axis along which the softmax normalization is applied.
   * Invalid if < 2, as softmax across 1 (the batch dimension) is assumed to be
   * an error.
   *
   * @returns a Tensor of the same shape as x
   *
   * @throws ValueError: In case `dim(x) < 2`.
   */
  apply(t, e = -1) {
    return Xg(t, e);
  }
}
pc.className = "logSoftmax";
O(pc);
class mc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x Tensor.
   * @returns a Tensor of the same shape as x
   */
  apply(t) {
    return _(() => _(() => {
      const e = Math.sqrt(2), s = N(0.5, M(1, dg(Y(t, e))));
      return N(t, s);
    }));
  }
}
mc.className = "gelu";
O(mc);
class gc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x Tensor.
   * @returns a Tensor of the same shape as x
   */
  apply(t) {
    return _(() => N(0.5, N(t, M(1, mi(N(me(Y(2, Math.PI)), M(t, N(0.044715, pr(t, 3)))))))));
  }
}
gc.className = "gelu_new";
O(gc);
class bc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x Tensor.
   * @returns a Tensor of the same shape as x
   */
  apply(t) {
    return _(() => N(t, mi(yi(t))));
  }
}
bc.className = "mish";
O(bc);
class yc extends _t {
  /**
   * Calculate the activation function.
   *
   * @param x Tensor.
   * @param alpha Scaling factor for the sigmoid function.
   * @returns a Tensor of the same shape as x
   */
  apply(t, e = 1) {
    return _(() => N(pi(N(t, e)), t));
  }
}
yc.className = "swish";
O(yc);
function ew(n) {
  return n.getClassName();
}
function mo(n, t = {}) {
  return Ns(n, te.getMap().classNameMap, t, "activation");
}
function nw(n) {
  if (n == null) {
    const t = {};
    return t.className = "linear", t.config = {}, mo(t);
  }
  if (typeof n == "string") {
    const t = {};
    return t.className = n, t.config = {}, mo(t);
  } else return n instanceof _t ? n : mo(n);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Ri(n, t) {
  return _(() => me(et(N(n, n), t, !0)));
}
class Rs extends Kn {
  getConfig() {
    return {};
  }
}
class wc extends Rs {
  constructor(t) {
    super(), this.defaultMaxValue = 2, this.defaultAxis = 0, this.maxValue = t.maxValue != null ? t.maxValue : this.defaultMaxValue, this.axis = t.axis != null ? t.axis : this.defaultAxis;
  }
  apply(t) {
    return _(() => {
      const e = Ri(t, this.axis), s = pe(e, 0, this.maxValue);
      return N(t, Y(s, M(mt(), e)));
    });
  }
  getConfig() {
    return { maxValue: this.maxValue, axis: this.axis };
  }
}
wc.className = "MaxNorm";
O(wc);
class xc extends Rs {
  constructor(t) {
    super(), this.defaultAxis = 0, this.axis = t.axis != null ? t.axis : this.defaultAxis;
  }
  apply(t) {
    return _(() => Y(t, M(mt(), Ri(t, this.axis))));
  }
  getConfig() {
    return { axis: this.axis };
  }
}
xc.className = "UnitNorm";
O(xc);
class Sc extends Rs {
  apply(t) {
    return Ts(t);
  }
}
Sc.className = "NonNeg";
O(Sc);
class vc extends Rs {
  constructor(t) {
    super(), this.defaultMinValue = 0, this.defaultMaxValue = 1, this.defaultRate = 1, this.defaultAxis = 0, this.minValue = t.minValue != null ? t.minValue : this.defaultMinValue, this.maxValue = t.maxValue != null ? t.maxValue : this.defaultMaxValue, this.rate = t.rate != null ? t.rate : this.defaultRate, this.axis = t.axis != null ? t.axis : this.defaultAxis;
  }
  apply(t) {
    return _(() => {
      const e = Ri(t, this.axis), s = M(N(this.rate, pe(e, this.minValue, this.maxValue)), N(1 - this.rate, e));
      return N(t, Y(s, M(mt(), e)));
    });
  }
  getConfig() {
    return {
      minValue: this.minValue,
      maxValue: this.maxValue,
      rate: this.rate,
      axis: this.axis
    };
  }
}
vc.className = "MinMaxNorm";
O(vc);
const Ua = {
  maxNorm: "MaxNorm",
  minMaxNorm: "MinMaxNorm",
  nonNeg: "NonNeg",
  unitNorm: "UnitNorm"
};
function xr(n) {
  return Ni(n);
}
function Wa(n, t = {}) {
  return Ns(n, te.getMap().classNameMap, t, "constraint");
}
function Sr(n) {
  if (n == null)
    return null;
  if (typeof n == "string") {
    const e = { className: n in Ua ? Ua[n] : n, config: {} };
    return Wa(e);
  } else return n instanceof Rs ? n : Wa(n);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
let sw = 0;
function Ic() {
  return sw++;
}
const Vs = {};
function Li(n = "") {
  return n in Vs || (Vs[n] = 0), Vs[n] += 1, n + Vs[n].toString();
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const rw = ["fanIn", "fanOut", "fanAvg"], ow = ["normal", "uniform", "truncatedNormal"];
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function iw(n) {
  Yn(rw, "FanMode", n);
}
function aw(n) {
  Yn(ow, "Distribution", n);
}
class Ne extends Kn {
  fromConfigUsesCustomObjects() {
    return !1;
  }
  getConfig() {
    return {};
  }
}
class $c extends Ne {
  apply(t, e) {
    return Fn(t, e);
  }
}
$c.className = "Zeros";
O($c);
class Ac extends Ne {
  apply(t, e) {
    return wi(t, e);
  }
}
Ac.className = "Ones";
O(Ac);
class Ec extends Ne {
  constructor(t) {
    if (super(), typeof t != "object")
      throw new I(`Expected argument of type ConstantConfig but got ${t}`);
    if (t.value === void 0)
      throw new I(`config must have value set but got ${t}`);
    this.value = t.value;
  }
  apply(t, e) {
    return _(() => N(Yt(this.value), wi(t, e)));
  }
  getConfig() {
    return {
      value: this.value
    };
  }
}
Ec.className = "Constant";
O(Ec);
class _c extends Ne {
  constructor(t) {
    super(), this.DEFAULT_MINVAL = -0.05, this.DEFAULT_MAXVAL = 0.05, this.minval = t.minval || this.DEFAULT_MINVAL, this.maxval = t.maxval || this.DEFAULT_MAXVAL, this.seed = t.seed;
  }
  apply(t, e) {
    return Ou(t, this.minval, this.maxval, e, this.seed);
  }
  getConfig() {
    return { minval: this.minval, maxval: this.maxval, seed: this.seed };
  }
}
_c.className = "RandomUniform";
O(_c);
class Cc extends Ne {
  constructor(t) {
    super(), this.DEFAULT_MEAN = 0, this.DEFAULT_STDDEV = 0.05, this.mean = t.mean || this.DEFAULT_MEAN, this.stddev = t.stddev || this.DEFAULT_STDDEV, this.seed = t.seed;
  }
  apply(t, e) {
    if (e = e || "float32", e !== "float32" && e !== "int32")
      throw new J(`randomNormal does not support dType ${e}.`);
    return nc(t, this.mean, this.stddev, e, this.seed);
  }
  getConfig() {
    return { mean: this.mean, stddev: this.stddev, seed: this.seed };
  }
}
Cc.className = "RandomNormal";
O(Cc);
class kc extends Ne {
  constructor(t) {
    super(), this.DEFAULT_MEAN = 0, this.DEFAULT_STDDEV = 0.05, this.mean = t.mean || this.DEFAULT_MEAN, this.stddev = t.stddev || this.DEFAULT_STDDEV, this.seed = t.seed;
  }
  apply(t, e) {
    if (e = e || "float32", e !== "float32" && e !== "int32")
      throw new J(`truncatedNormal does not support dType ${e}.`);
    return zu(t, this.mean, this.stddev, e, this.seed);
  }
  getConfig() {
    return { mean: this.mean, stddev: this.stddev, seed: this.seed };
  }
}
kc.className = "TruncatedNormal";
O(kc);
class Tc extends Ne {
  constructor(t) {
    super(), this.gain = t.gain != null ? t.gain : 1;
  }
  apply(t, e) {
    return _(() => {
      if (t.length !== 2 || t[0] !== t[1])
        throw new I("Identity matrix initializer can only be used for 2D square matrices.");
      return N(this.gain, Tu(t[0]));
    });
  }
  getConfig() {
    return { gain: this.gain };
  }
}
Tc.className = "Identity";
O(Tc);
function lw(n, t = "channelsLast") {
  let e, s;
  if (gt(t), n.length === 2)
    e = n[0], s = n[1];
  else if ([3, 4, 5].indexOf(n.length) !== -1) {
    if (t === "channelsFirst") {
      const r = ms(n, 2);
      e = n[1] * r, s = n[0] * r;
    } else if (t === "channelsLast") {
      const r = ms(n, 0, n.length - 2);
      e = n[n.length - 2] * r, s = n[n.length - 1] * r;
    }
  } else {
    const r = ms(n);
    e = Math.sqrt(r), s = Math.sqrt(r);
  }
  return [e, s];
}
class Gt extends Ne {
  /**
   * Constructor of VarianceScaling.
   * @throws ValueError for invalid value in scale.
   */
  constructor(t) {
    if (super(), t.scale < 0)
      throw new I(`scale must be a positive float. Got: ${t.scale}`);
    this.scale = t.scale == null ? 1 : t.scale, this.mode = t.mode == null ? "fanIn" : t.mode, iw(this.mode), this.distribution = t.distribution == null ? "normal" : t.distribution, aw(this.distribution), this.seed = t.seed;
  }
  apply(t, e) {
    const s = lw(t), r = s[0], o = s[1];
    let i = this.scale;
    if (this.mode === "fanIn" ? i /= Math.max(1, r) : this.mode === "fanOut" ? i /= Math.max(1, o) : i /= Math.max(1, (r + o) / 2), this.distribution === "normal") {
      const a = Math.sqrt(i);
      if (e = e || "float32", e !== "float32" && e !== "int32")
        throw new J(`${this.getClassName()} does not support dType ${e}.`);
      return zu(t, 0, a, e, this.seed);
    } else {
      const a = Math.sqrt(3 * i);
      return Ou(t, -a, a, e, this.seed);
    }
  }
  getConfig() {
    return {
      scale: this.scale,
      mode: this.mode,
      distribution: this.distribution,
      seed: this.seed
    };
  }
}
Gt.className = "VarianceScaling";
O(Gt);
class Oi extends Gt {
  /**
   * Constructor of GlorotUniform
   * @param scale
   * @param mode
   * @param distribution
   * @param seed
   */
  constructor(t) {
    super({
      scale: 1,
      mode: "fanAvg",
      distribution: "uniform",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
Oi.className = "GlorotUniform";
O(Oi);
class Mi extends Gt {
  /**
   * Constructor of GlorotNormal.
   * @param scale
   * @param mode
   * @param distribution
   * @param seed
   */
  constructor(t) {
    super({
      scale: 1,
      mode: "fanAvg",
      distribution: "normal",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
Mi.className = "GlorotNormal";
O(Mi);
class Bi extends Gt {
  constructor(t) {
    super({
      scale: 2,
      mode: "fanIn",
      distribution: "normal",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
Bi.className = "HeNormal";
O(Bi);
class Fi extends Gt {
  constructor(t) {
    super({
      scale: 2,
      mode: "fanIn",
      distribution: "uniform",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
Fi.className = "HeUniform";
O(Fi);
class zi extends Gt {
  constructor(t) {
    super({
      scale: 1,
      mode: "fanIn",
      distribution: "normal",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
zi.className = "LeCunNormal";
O(zi);
class Ui extends Gt {
  constructor(t) {
    super({
      scale: 1,
      mode: "fanIn",
      distribution: "uniform",
      seed: t == null ? null : t.seed
    });
  }
  getClassName() {
    return Gt.className;
  }
}
Ui.className = "LeCunUniform";
O(Ui);
class Nc extends Ne {
  constructor(t) {
    super(), this.DEFAULT_GAIN = 1, this.ELEMENTS_WARN_SLOW = 2e3, this.gain = t.gain == null ? this.DEFAULT_GAIN : t.gain, this.seed = t.seed;
  }
  apply(t, e) {
    return _(() => {
      if (t.length < 2)
        throw new J("Shape must be at least 2D.");
      if (e !== "int32" && e !== "float32" && e !== void 0)
        throw new TypeError(`Unsupported data type ${e}.`);
      e = e;
      const s = z(t.slice(0, -1)), r = t[t.length - 1], o = s * r;
      o > this.ELEMENTS_WARN_SLOW && console.warn(`Orthogonal initializer is being called on a matrix with more than ${this.ELEMENTS_WARN_SLOW} (${o}) elements: Slowness may result.`);
      const i = [Math.max(r, s), Math.min(r, s)], a = nc(i, 0, 1, e, this.seed), l = Qb.qr(a, !1);
      let u = l[0];
      const h = l[1].flatten().stridedSlice([0], [Math.min(r, s) * Math.min(r, s)], [Math.min(r, s) + 1]);
      return u = N(u, h.sign()), s < r && (u = u.transpose()), N(Yt(this.gain), u.reshape(t));
    });
  }
  getConfig() {
    return {
      gain: this.gain,
      seed: this.seed
    };
  }
}
Nc.className = "Orthogonal";
O(Nc);
const Ga = {
  constant: "Constant",
  glorotNormal: "GlorotNormal",
  glorotUniform: "GlorotUniform",
  heNormal: "HeNormal",
  heUniform: "HeUniform",
  identity: "Identity",
  leCunNormal: "LeCunNormal",
  leCunUniform: "LeCunUniform",
  ones: "Ones",
  orthogonal: "Orthogonal",
  randomNormal: "RandomNormal",
  randomUniform: "RandomUniform",
  truncatedNormal: "TruncatedNormal",
  varianceScaling: "VarianceScaling",
  zeros: "Zeros"
};
function Va(n, t = {}) {
  return Ns(n, te.getMap().classNameMap, t, "initializer");
}
function vr(n) {
  return Ni(n);
}
function vs(n) {
  if (typeof n == "string") {
    const t = n in Ga ? Ga[n] : n;
    if (t === "GlorotNormal")
      return new Mi();
    if (t === "GlorotUniform")
      return new Oi();
    if (t === "HeNormal")
      return new Bi();
    if (t === "HeUniform")
      return new Fi();
    if (t === "LeCunNormal")
      return new zi();
    if (t === "LeCunUniform")
      return new Ui();
    {
      const e = {};
      return e.className = t, e.config = {}, Va(e);
    }
  } else return n instanceof Ne ? n : Va(n);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Ir(n) {
  return n.length === 0 ? [] : Array.isArray(n[0]) ? n : [n];
}
function Vt(n) {
  let t;
  if (Array.isArray(n)) {
    if (n.length !== 1)
      throw new I(`Expected Tensor length to be 1; got ${n.length}`);
    t = n[0];
  } else
    t = n;
  return t;
}
function ge(n) {
  if (Array.isArray(n) && Array.isArray(n[0])) {
    if (n.length === 1)
      return n = n, n[0];
    throw new I(`Expected exactly 1 Shape; got ${n.length}`);
  } else
    return n;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function $r(n) {
  let t = 0;
  for (const e of n)
    e.shape.length === 0 ? t += 1 : t += e.shape.reduce((s, r) => s * r);
  return t;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const qa = "Variable";
class uw {
  /**
   * Construct Variable from a `tf.Tensor`.
   *
   * If not explicitly named, the Variable will be given a name with the
   * prefix 'Variable'. Variable names are unique. In the case of name
   * collision, suffixies '_<num>' will be added to the name.
   *
   * @param val Initial value of the Variable.
   * @param name Name of the variable. If `null` or `undefined` is provided, it
   *   will default a name with the prefix 'Variable'.
   * @param constraint Optional, projection function to be applied to the
   * variable after optimize updates
   * @throws ValueError if `name` is `null` or `undefined`.
   */
  constructor(t, e = "float32", s = qa, r = !0, o = null) {
    this.dtype = e ?? "float32", this.shape = t.shape, this.id = Ic(), s = s ?? qa, this.originalName = Ju(s), this.name = Zu(this.originalName), this.trainable_ = r, this.constraint = o, this.val = Z0(t, this.trainable_, this.name, this.dtype);
  }
  /**
   * Get a snapshot of the Variable's value.
   *
   * The returned value is a snapshot of the Variable's value at the time of
   * the invocation. Future mutations in the value of the tensor will only
   * be reflected by future calls to this method.
   */
  read() {
    return this.assertNotDisposed(), this.val;
  }
  /**
   * Update the value of the Variable.
   *
   * @param newVal: The new value to update to. Must be consistent with the
   *   dtype and shape of the Variable.
   * @return This Variable.
   */
  write(t) {
    return this.assertNotDisposed(), cw(this.val, t), this.val.id !== t.id && (this.val.assign(t), this.constraint != null && this.val.assign(this.constraint.apply(this.val))), this;
  }
  /**
   * Dispose this LayersVariable instance from memory.
   */
  dispose() {
    this.assertNotDisposed(), this.val.dispose();
  }
  assertNotDisposed() {
    if (this.val.isDisposed)
      throw new Error(`LayersVariable ${this.name} is already disposed.`);
  }
  get trainable() {
    return this.trainable_;
  }
  set trainable(t) {
    this.trainable_ = t, this.val.trainable = t;
  }
}
function cw(n, t) {
  if (n.shape.toString() !== t.shape.toString())
    throw new Error("Shape mismatch: " + JSON.stringify(n.shape) + " vs. " + JSON.stringify(t.shape));
}
function ja(n) {
  return n.map((t) => t.read());
}
function Dc(n) {
  n.forEach((t) => {
    t[0].write(t[1]);
  });
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class Ce {
  constructor(t) {
    this.dtype = t.dtype, this.shape = t.shape, t.shape != null ? this.ndim = t.shape.length : this.ndim = t.ndim, this.maxNDim = t.maxNDim, this.minNDim = t.minNDim, this.axes = t.axes || {};
  }
}
class bn {
  /**
   *
   * @param dtype
   * @param shape
   * @param sourceLayer The Layer that produced this symbolic tensor.
   * @param inputs The inputs passed to sourceLayer's __call__() method.
   * @param nodeIndex
   * @param tensorIndex
   * @param callArgs The keyword arguments passed to the __call__() method.
   * @param name
   * @param outputTensorIndex The index of this tensor in the list of outputs
   *   returned by apply().
   */
  constructor(t, e, s, r, o, i, a) {
    this.dtype = t, this.shape = e, this.sourceLayer = s, this.inputs = r, this.callArgs = o, this.outputTensorIndex = a, this.id = Ic(), i != null && (this.originalName = Ju(i), this.name = Zu(this.originalName)), this.rank = e.length;
  }
}
let hw = 0;
class Wi {
  constructor(t, e) {
    this.callArgs = e, this.id = hw++, this.outboundLayer = t.outboundLayer, this.inboundLayers = t.inboundLayers, this.nodeIndices = t.nodeIndices, this.tensorIndices = t.tensorIndices, this.inputTensors = t.inputTensors, this.outputTensors = t.outputTensors, this.inputMasks = t.inputMasks, this.outputMasks = t.outputMasks, this.inputShapes = t.inputShapes, this.outputShapes = t.outputShapes;
    for (const s of t.inboundLayers)
      s != null && s.outboundNodes.push(this);
    t.outboundLayer.inboundNodes.push(this);
  }
  getConfig() {
    const t = [];
    for (const e of this.inboundLayers)
      e != null ? t.push(e.name) : t.push(null);
    return {
      outboundLayer: this.outboundLayer ? this.outboundLayer.name : null,
      inboundLayers: t,
      nodeIndices: this.nodeIndices,
      tensorIndices: this.tensorIndices
    };
  }
}
let fw = 0;
class ye extends Kn {
  constructor(t = {}) {
    super(), this._callHook = null, this._addedWeightNames = [], this._stateful = !1, this.id = fw++, this.activityRegularizer = null, this.inputSpec = null, this.supportsMasking = !1, this._trainableWeights = [], this._nonTrainableWeights = [], this._losses = [], this._updates = [], this._built = !1, this.inboundNodes = [], this.outboundNodes = [];
    let e = t.name;
    if (!e) {
      const s = this.getClassName();
      e = Pe(s) + "_" + Li(s);
    }
    if (this.name = e, this.trainable_ = t.trainable == null ? !0 : t.trainable, t.inputShape != null || t.batchInputShape != null) {
      let s;
      if (t.batchInputShape != null)
        s = t.batchInputShape;
      else if (t.inputShape != null) {
        let o = null;
        t.batchSize != null && (o = t.batchSize), s = [o].concat(t.inputShape);
      }
      this.batchInputShape = s;
      let r = t.dtype;
      r == null && (r = t.inputDType), r == null && (r = "float32"), this.dtype = r;
    }
    t.weights != null ? this.initialWeights = t.weights : this.initialWeights = null, this._refCount = null, this.fastWeightInitDuringBuild = !1;
  }
  /**
   * Converts a layer and its index to a unique (immutable type) name.
   * This function is used internally with `this.containerNodes`.
   * @param layer The layer.
   * @param nodeIndex The layer's position (e.g. via enumerate) in a list of
   *   nodes.
   *
   * @returns The unique name.
   */
  static nodeKey(t, e) {
    return t.name + "_ib-" + e.toString();
  }
  /**
   * Returns this.inboundNode at index nodeIndex.
   *
   * Porting note: This is a replacement for _get_node_attribute_at_index()
   * @param nodeIndex
   * @param attrName The name of the attribute related to request for this node.
   */
  getNodeAtIndex(t, e) {
    if (this.inboundNodes.length === 0)
      throw new qe(`The layer has never been called and thus has no defined ${e}.`);
    if (this.inboundNodes.length <= t)
      throw new I(`Asked to get ${e} at node ${t}, but the layer has only ${this.inboundNodes.length} inbound nodes.`);
    return this.inboundNodes[t];
  }
  /**
   * Retrieves the input tensor(s) of a layer at a given node.
   *
   * @param nodeIndex Integer, index of the node from which to retrieve the
   *   attribute. E.g. `nodeIndex=0` will correspond to the first time the layer
   *   was called.
   *
   * @return A tensor (or list of tensors if the layer has multiple inputs).
   */
  getInputAt(t) {
    return zt(this.getNodeAtIndex(t, "input").inputTensors);
  }
  /**
   * Retrieves the output tensor(s) of a layer at a given node.
   *
   * @param nodeIndex Integer, index of the node from which to retrieve the
   *   attribute. E.g. `nodeIndex=0` will correspond to the first time the layer
   *   was called.
   *
   * @return A tensor (or list of tensors if the layer has multiple outputs).
   */
  getOutputAt(t) {
    return zt(this.getNodeAtIndex(t, "output").outputTensors);
  }
  // Properties
  /**
   * Retrieves the input tensor(s) of a layer.
   *
   * Only applicable if the layer has exactly one inbound node,
   * i.e. if it is connected to one incoming layer.
   *
   * @return Input tensor or list of input tensors.
   *
   * @exception AttributeError if the layer is connected to more than one
   *   incoming layers.
   */
  get input() {
    if (this.inboundNodes.length > 1)
      throw new Fe(`Layer ${this.name} has multiple inbound nodes, hence the notion of "layer input" is ill-defined. Use \`getInputAt(nodeIndex)\` instead.`);
    if (this.inboundNodes.length === 0)
      throw new Fe(`Layer ${this.name} is not connected, no input to return.`);
    return zt(this.getNodeAtIndex(0, "input").inputTensors);
  }
  /**
   * Retrieves the output tensor(s) of a layer.
   *
   * Only applicable if the layer has exactly one inbound node,
   * i.e. if it is connected to one incoming layer.
   *
   * @return Output tensor or list of output tensors.
   *
   * @exception AttributeError if the layer is connected to more than one
   *   incoming layers.
   */
  get output() {
    if (this.inboundNodes.length === 0)
      throw new Fe(`Layer ${this.name} has no inbound nodes.`);
    if (this.inboundNodes.length > 1)
      throw new Fe(`Layer ${this.name} has multiple inbound nodes, hence the notion of "layer output" is ill-defined. Use \`getOutputAt(nodeIndex)\` instead.`);
    return zt(this.getNodeAtIndex(0, "output").outputTensors);
  }
  get losses() {
    return this._losses;
  }
  /**
   * Retrieves the Layer's current loss values.
   *
   * Used for regularizers during training.
   */
  calculateLosses() {
    return this.losses.map((t) => t());
  }
  get updates() {
    return this._updates;
  }
  get built() {
    return this._built;
  }
  set built(t) {
    this._built = t;
  }
  get trainable() {
    return this.trainable_;
  }
  set trainable(t) {
    this._trainableWeights.forEach((e) => e.trainable = t), this.trainable_ = t;
  }
  get trainableWeights() {
    return this.trainable_ ? this._trainableWeights.filter((t) => t.trainable) : [];
  }
  set trainableWeights(t) {
    this._trainableWeights = t;
  }
  get nonTrainableWeights() {
    return this.trainable ? this._trainableWeights.filter((t) => !t.trainable).concat(this._nonTrainableWeights) : this._trainableWeights.concat(this._nonTrainableWeights);
  }
  set nonTrainableWeights(t) {
    this._nonTrainableWeights = t;
  }
  /**
   * The concatenation of the lists trainableWeights and nonTrainableWeights
   * (in this order).
   */
  get weights() {
    return this.trainableWeights.concat(this.nonTrainableWeights);
  }
  get stateful() {
    return this._stateful;
  }
  /**
   * Reset the states of the layer.
   *
   * This method of the base Layer class is essentially a no-op.
   * Subclasses that are stateful (e.g., stateful RNNs) should override this
   * method.
   */
  resetStates() {
    if (!this.stateful)
      throw new Error("Cannot call the resetStates() method of a non-stateful Layer object.");
  }
  /**
   * Checks compatibility between the layer and provided inputs.
   *
   * This checks that the tensor(s) `input`
   * verify the input assumptions of the layer
   * (if any). If not, exceptions are raised.
   *
   * @param inputs Input tensor or list of input tensors.
   *
   * @exception ValueError in case of mismatch between
   *   the provided inputs and the expectations of the layer.
   */
  assertInputCompatibility(t) {
    const e = st(t);
    if (this.inputSpec == null || this.inputSpec.length === 0)
      return;
    const s = st(this.inputSpec);
    if (e.length !== s.length)
      throw new I(`Layer ${this.name} expects ${s.length} inputs, but it received ${e.length} input tensors. Input received: ${t}`);
    for (let r = 0; r < e.length; r++) {
      const o = e[r], i = s[r];
      if (i == null)
        continue;
      const a = o.rank;
      if (i.ndim != null && a !== i.ndim)
        throw new I(`Input ${r} is incompatible with layer ${this.name}: expected ndim=${i.ndim}, found ndim=${a}`);
      if (i.maxNDim != null && a > i.maxNDim)
        throw new I(`Input ${r} is incompatible with layer ${this.name}: expected max_ndim=${i.maxNDim}, found ndim=${a}`);
      if (i.minNDim != null && a < i.minNDim)
        throw new I(`Input ${r} is incompatible with layer ${this.name}: expected min_ndim=${i.minNDim}, found ndim=${a}.`);
      if (i.dtype != null && o.dtype !== i.dtype)
        throw new I(`Input ${r} is incompatible with layer ${this.name} : expected dtype=${i.dtype}, found dtype=${o.dtype}.`);
      if (i.axes) {
        const l = o.shape;
        for (const u in i.axes) {
          const c = Number(u), h = i.axes[u], f = c >= 0 ? l[c] : l[l.length + c];
          if (h != null && [h, null].indexOf(f) === -1)
            throw new I(`Input ${r} is incompatible with layer ${this.name}: expected axis ${c} of input shape to have value ${h} but got shape ${l}.`);
        }
      }
      if (i.shape != null)
        for (let l = 0; l < i.shape.length; ++l) {
          const u = i.shape[l], c = o.shape[l];
          if (u != null && c != null && u !== c)
            throw new I(`Input ${r} is incompatible with layer ${this.name}: expected shape=${i.shape}, found shape=${o.shape}.`);
        }
    }
  }
  /**
   * This is where the layer's logic lives.
   *
   * @param inputs Input tensor, or list/tuple of input tensors.
   * @param kwargs Additional keyword arguments.
   *
   * @return A tensor or list/tuple of tensors.
   */
  call(t, e) {
    return t;
  }
  invokeCallHook(t, e) {
    this._callHook != null && this._callHook(t, e);
  }
  /**
   * Set call hook.
   * This is currently used for testing only.
   * @param callHook
   */
  setCallHook(t) {
    this._callHook = t;
  }
  /**
   * Clear call hook.
   * This is currently used for testing only.
   */
  clearCallHook() {
    this._callHook = null;
  }
  /**
   * Builds or executes a `Layer`'s logic.
   *
   * When called with `tf.Tensor`(s), execute the `Layer`'s computation and
   * return Tensor(s). For example:
   *
   * ```js
   * const denseLayer = tf.layers.dense({
   *   units: 1,
   *   kernelInitializer: 'zeros',
   *   useBias: false
   * });
   *
   * // Invoke the layer's apply() method with a `tf.Tensor` (with concrete
   * // numeric values).
   * const input = tf.ones([2, 2]);
   * const output = denseLayer.apply(input);
   *
   * // The output's value is expected to be [[0], [0]], due to the fact that
   * // the dense layer has a kernel initialized to all-zeros and does not have
   * // a bias.
   * output.print();
   * ```
   *
   * When called with `tf.SymbolicTensor`(s), this will prepare the layer for
   * future execution.  This entails internal book-keeping on shapes of
   * expected Tensors, wiring layers together, and initializing weights.
   *
   * Calling `apply` with `tf.SymbolicTensor`s are typically used during the
   * building of non-`tf.Sequential` models. For example:
   *
   * ```js
   * const flattenLayer = tf.layers.flatten();
   * const denseLayer = tf.layers.dense({units: 1});
   *
   * // Use tf.layers.input() to obtain a SymbolicTensor as input to apply().
   * const input = tf.input({shape: [2, 2]});
   * const output1 = flattenLayer.apply(input);
   *
   * // output1.shape is [null, 4]. The first dimension is the undetermined
   * // batch size. The second dimension comes from flattening the [2, 2]
   * // shape.
   * console.log(JSON.stringify(output1.shape));
   *
   * // The output SymbolicTensor of the flatten layer can be used to call
   * // the apply() of the dense layer:
   * const output2 = denseLayer.apply(output1);
   *
   * // output2.shape is [null, 1]. The first dimension is the undetermined
   * // batch size. The second dimension matches the number of units of the
   * // dense layer.
   * console.log(JSON.stringify(output2.shape));
   *
   * // The input and output can be used to construct a model that consists
   * // of the flatten and dense layers.
   * const model = tf.model({inputs: input, outputs: output2});
   * ```
   *
   * @param inputs a `tf.Tensor` or `tf.SymbolicTensor` or an Array of them.
   * @param kwargs Additional keyword arguments to be passed to `call()`.
   *
   * @return Output of the layer's `call` method.
   *
   * @exception ValueError error in case the layer is missing shape information
   *   for its `build` call.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  // Porting Note: This is a replacement for __call__() in Python.
  apply(t, e) {
    e = e || {}, this.assertNotDisposed();
    const s = st(t), r = mw(t), o = gw(t);
    if (r === o)
      throw new I("Arguments to apply() must be all SymbolicTensors or all Tensors");
    return or(this.name, () => {
      if (!this.built) {
        this.assertInputCompatibility(t);
        const i = [];
        for (const a of st(t))
          i.push(a.shape);
        this.build(zt(i)), this.built = !0, this.initialWeights && this.setWeights(this.initialWeights), this._refCount === null && o && (this._refCount = 1);
      }
      if (this.assertInputCompatibility(t), o) {
        let i = this.call(t, e);
        this.supportsMasking && this.setMaskMetadata(t, i);
        const a = st(i), l = [];
        for (let u of a)
          s.indexOf(u) !== -1 && (u = u.clone()), l.push(u);
        if (i = zt(l), this.activityRegularizer != null)
          throw new J("Layer invocation in the presence of activity regularizer(s) is not supported yet.");
        return i;
      } else {
        const i = dw(t), a = this.computeOutputShape(i);
        let l;
        const u = pw(t);
        if (this.warnOnIncompatibleInputShape(Array.isArray(t) ? i[0] : i), a != null && a.length > 0 && Array.isArray(a[0]) ? l = a.map((c, h) => new bn(u, c, this, st(t), e, this.name, h)) : l = new bn(u, a, this, st(t), e, this.name), this.addInboundNode(t, l, null, null, i, a, e), this._refCount++, this.activityRegularizer != null)
          throw new J("Layer invocation in the presence of activity regularizer(s) is not supported yet.");
        return l;
      }
    });
  }
  /**
   * Check compatibility between input shape and this layer's batchInputShape.
   *
   * Print warning if any incompatibility is found.
   *
   * @param inputShape Input shape to be checked.
   */
  warnOnIncompatibleInputShape(t) {
    if (this.batchInputShape != null)
      if (t.length !== this.batchInputShape.length)
        console.warn(`The rank of the input tensor provided (shape: ${JSON.stringify(t)}) does not match that of the batchInputShape (${JSON.stringify(this.batchInputShape)}) of the layer ${this.name}`);
      else {
        let e = !1;
        this.batchInputShape.forEach((s, r) => {
          s != null && t[r] != null && t[r] !== s && (e = !0);
        }), e && console.warn(`The shape of the input tensor (${JSON.stringify(t)}) does not match the expectation of layer ${this.name}: ${JSON.stringify(this.batchInputShape)}`);
      }
  }
  /**
   * Retrieves the output shape(s) of a layer.
   *
   * Only applicable if the layer has only one inbound node, or if all inbound
   * nodes have the same output shape.
   *
   * @returns Output shape or shapes.
   * @throws AttributeError: if the layer is connected to more than one incoming
   *   nodes.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  get outputShape() {
    if (this.inboundNodes == null || this.inboundNodes.length === 0)
      throw new Fe(`The layer ${this.name} has never been called and thus has no defined output shape.`);
    const t = [];
    for (const e of this.inboundNodes) {
      const s = JSON.stringify(e.outputShapes);
      t.indexOf(s) === -1 && t.push(s);
    }
    if (t.length === 1) {
      const e = this.inboundNodes[0].outputShapes;
      return Array.isArray(e) && Array.isArray(e[0]) && e.length === 1 ? e[0] : e;
    } else
      throw new Fe(`The layer ${this.name} has multiple inbound nodes with different output shapes. Hence the notion of "output shape" is ill-defined for the layer.`);
  }
  /**
   * Counts the total number of numbers (e.g., float32, int32) in the
   * weights.
   *
   * @returns An integer count.
   * @throws RuntimeError: If the layer is not built yet (in which case its
   *   weights are not defined yet.)
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  countParams() {
    if (!this.built)
      throw new qe(`You tried to call countParams() on ${this.name}, but the layer is not built yet. Build it first by calling build(batchInputShape).`);
    return $r(this.weights);
  }
  /**
   * Creates the layer weights.
   *
   * Must be implemented on all layers that have weights.
   *
   * Called when apply() is called to construct the weights.
   *
   * @param inputShape A `Shape` or array of `Shape` (unused).
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  build(t) {
    this.built = !0;
  }
  /**
   * Returns the current values of the weights of the layer.
   *
   * @param trainableOnly Whether to get the values of only trainable weights.
   * @returns Weight values as an `Array` of `tf.Tensor`s.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  getWeights(t = !1) {
    return ja(t ? this.trainableWeights : this.weights);
  }
  /**
   * Sets the weights of the layer, from Tensors.
   *
   * @param weights a list of Tensors. The number of arrays and their shape
   *   must match number of the dimensions of the weights of the layer (i.e.
   *   it should match the output of `getWeights`).
   *
   * @exception ValueError If the provided weights list does not match the
   *   layer's specifications.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  setWeights(t) {
    _(() => {
      const e = this.weights;
      if (e.length !== t.length)
        throw new I(`You called setWeights(weights) on layer "${this.name}" with a weight list of length ${t.length}, but the layer was expecting ${e.length} weights. Provided weights: ${t}...`);
      if (e.length === 0)
        return;
      const s = [], r = ja(e);
      for (let o = 0; o < r.length; ++o) {
        const i = r[o], a = e[o], l = t[o];
        if (!oe(i.shape, l.shape))
          throw new I(`Layer weight shape ${i.shape} not compatible with provided weight shape ${l.shape}`);
        s.push([a, l]);
      }
      Dc(s);
    });
  }
  /**
   * Adds a weight variable to the layer.
   *
   * @param name Name of the new weight variable.
   * @param shape The shape of the weight.
   * @param dtype The dtype of the weight.
   * @param initializer An initializer instance.
   * @param regularizer A regularizer instance.
   * @param trainable Whether the weight should be trained via backprop or not
   *   (assuming that the layer itself is also trainable).
   * @param constraint An optional trainable.
   * @return The created weight variable.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  addWeight(t, e, s, r, o, i, a, l) {
    if (this._addedWeightNames.indexOf(t) !== -1)
      throw new I(`Duplicate weight name ${t} for layer ${this.name}`);
    this._addedWeightNames.push(t), s == null && (s = "float32"), this.fastWeightInitDuringBuild && (r = l != null ? l() : vs("zeros"));
    const u = r.apply(e, s), c = new uw(u, s, t, i, a);
    return u.dispose(), o != null && this.addLoss(() => o.apply(c.read())), i == null && (i = !0), i ? this._trainableWeights.push(c) : this._nonTrainableWeights.push(c), c;
  }
  /**
   * Set the fast-weight-initialization flag.
   *
   * In cases where the initialized weight values will be immediately
   * overwritten by loaded weight values during model loading, setting
   * the flag to `true` saves unnecessary calls to potentially expensive
   * initializers and speeds up the loading process.
   *
   * @param value Target value of the flag.
   */
  setFastWeightInitDuringBuild(t) {
    this.fastWeightInitDuringBuild = t;
  }
  /**
   * Add losses to the layer.
   *
   * The loss may potentially be conditional on some inputs tensors,
   * for instance activity losses are conditional on the layer's inputs.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  addLoss(t) {
    t == null || Array.isArray(t) && t.length === 0 || (t = st(t), this._losses !== void 0 && this._losses !== null && this.losses.push(...t));
  }
  /**
   * Computes the output shape of the layer.
   *
   * Assumes that the layer will be built to match that input shape provided.
   *
   * @param inputShape A shape (tuple of integers) or a list of shape tuples
   *   (one per output tensor of the layer). Shape tuples can include null for
   *   free dimensions, instead of an integer.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  computeOutputShape(t) {
    return t;
  }
  /**
   * Computes an output mask tensor.
   *
   * @param inputs Tensor or list of tensors.
   * @param mask Tensor or list of tensors.
   *
   * @return null or a tensor (or list of tensors, one per output tensor of the
   * layer).
   */
  computeMask(t, e) {
    if (!this.supportsMasking) {
      if (e != null)
        if (Array.isArray(e))
          e.forEach((s) => {
            if (s != null)
              throw new TypeError(`Layer ${this.name} does not support masking, but was passed an inputMask.`);
          });
        else
          throw new TypeError(`Layer ${this.name} does not support masking, but was passed an inputMask.`);
      return null;
    }
    return e;
  }
  setMaskMetadata(t, e, s) {
    if (!this.supportsMasking)
      return;
    const r = this.computeMask(t, s), o = st(e), i = st(r);
    if (o.length !== i.length)
      throw new Error(`${this.name} outputs ${o.length} tensors but ${o.length} masks for those tensors`);
    for (let a = 0; a < o.length; a++)
      o[a].kerasMask = i[a];
  }
  /**
   * Internal method to create an inbound node for the layer.
   *
   * @param inputTensors List of input tensors.
   * @param outputTensors List of output tensors.
   * @param inputMasks List of input masks (a mask can be a tensor, or null).
   * @param outputMasks List of output masks (a mask can be a tensor, or null).
   * @param inputShapes List of input shape tuples.
   * @param outputShapes List of output shape tuples.
   * @param kwargs Dictionary of keyword arguments that were passed to the
   *   `call` method of the layer at the call that created the node.
   */
  addInboundNode(t, e, s, r, o, i, a = null) {
    const l = st(t);
    e = st(e), s = st(s), r = st(r), o = Ir(o), i = Ir(i);
    const u = [], c = [], h = [];
    for (const f of l)
      u.push(f.sourceLayer), c.push(f.nodeIndex), h.push(f.tensorIndex);
    new Wi({
      outboundLayer: this,
      inboundLayers: u,
      nodeIndices: c,
      tensorIndices: h,
      inputTensors: l,
      outputTensors: e,
      inputMasks: s,
      outputMasks: r,
      inputShapes: o,
      outputShapes: i
    }, a);
    for (let f = 0; f < e.length; f++)
      e[f].sourceLayer = this, e[f].nodeIndex = this.inboundNodes.length - 1, e[f].tensorIndex = f;
  }
  /**
   * Returns the config of the layer.
   *
   * A layer config is a TS dictionary (serializable)
   * containing the configuration of a layer.
   * The same layer can be reinstantiated later
   * (without its trained weights) from this configuration.
   *
   * The config of a layer does not include connectivity
   * information, nor the layer class name.  These are handled
   * by 'Container' (one layer of abstraction above).
   *
   * Porting Note: The TS dictionary follows TS naming standards for
   * keys, and uses tfjs-layers type-safe Enums.  Serialization methods
   * should use a helper function to convert to the pythonic storage
   * standard. (see serialization_utils.convertTsToPythonic)
   *
   * @returns TS dictionary of configuration.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  getConfig() {
    const t = { name: this.name, trainable: this.trainable };
    return this.batchInputShape != null && (t.batchInputShape = this.batchInputShape), this.dtype != null && (t.dtype = this.dtype), t;
  }
  /**
   * Dispose the weight variables that this Layer instance holds.
   *
   * @returns {number} Number of disposed variables.
   */
  disposeWeights() {
    return this.weights.forEach((t) => t.dispose()), this.weights.length;
  }
  assertNotDisposed() {
    if (this._refCount === 0)
      throw new Error(`Layer '${this.name}' is already disposed.`);
  }
  /**
   * Attempt to dispose layer's weights.
   *
   * This method decreases the reference count of the Layer object by 1.
   *
   * A Layer is reference-counted. Its reference count is incremented by 1
   * the first item its `apply()` method is called and when it becomes a part
   * of a new `Node` (through calling the `apply()` method on a
   * `tf.SymbolicTensor`).
   *
   * If the reference count of a Layer becomes 0, all the weights will be
   * disposed and the underlying memory (e.g., the textures allocated in WebGL)
   * will be freed.
   *
   * Note: If the reference count is greater than 0 after the decrement, the
   * weights of the Layer will *not* be disposed.
   *
   * After a Layer is disposed, it cannot be used in calls such as `apply()`,
   * `getWeights()` or `setWeights()` anymore.
   *
   * @returns A DisposeResult Object with the following fields:
   *   - refCountAfterDispose: The reference count of the Container after this
   *     `dispose()` call.
   *   - numDisposedVariables: Number of `tf.Variable`s (i.e., weights) disposed
   *     during this `dispose()` call.
   * @throws {Error} If the layer is not built yet, or if the layer has already
   *   been disposed.
   *
   * @doc {heading: 'Models', 'subheading': 'Classes'}
   */
  dispose() {
    if (!this.built)
      throw new Error(`Cannot dispose Layer ${this.name} because it has not been built yet.`);
    if (this._refCount === null)
      throw new Error(`Cannot dispose Layer ${this.name} because it has not been used yet.`);
    this.assertNotDisposed();
    let t = 0;
    return --this._refCount === 0 && (t = this.disposeWeights()), { refCountAfterDispose: this._refCount, numDisposedVariables: t };
  }
}
function dw(n) {
  n = st(n);
  const t = [];
  for (const e of n)
    t.push(e.shape);
  return zt(t);
}
function pw(n) {
  return "float32";
}
function mw(n) {
  let t = !0;
  for (const e of st(n))
    if (!(e instanceof bn)) {
      t = !1;
      break;
    }
  return t;
}
function gw(n) {
  let t = !0;
  for (const e of st(n))
    if (e instanceof bn) {
      t = !1;
      break;
    }
  return t;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function bw(n) {
  if (n != null && typeof n != "object")
    throw new Error(`Argument to L1L2 regularizer's constructor is expected to be an object, but received: ${n}`);
}
class Pc extends Kn {
}
class Rc extends Pc {
  constructor(t) {
    super(), bw(t), this.l1 = t == null || t.l1 == null ? 0.01 : t.l1, this.l2 = t == null || t.l2 == null ? 0.01 : t.l2, this.hasL1 = this.l1 !== 0, this.hasL2 = this.l2 !== 0;
  }
  /**
   * Porting note: Renamed from __call__.
   * @param x Variable of which to calculate the regularization score.
   */
  apply(t) {
    return _(() => {
      let e = Fn([1]);
      return this.hasL1 && (e = M(e, et(N(this.l1, Nt(t))))), this.hasL2 && (e = M(e, et(N(this.l2, Ds(t))))), L(e, []);
    });
  }
  getConfig() {
    return { l1: this.l1, l2: this.l2 };
  }
  /** @nocollapse */
  static fromConfig(t, e) {
    return new t({ l1: e.l1, l2: e.l2 });
  }
}
Rc.className = "L1L2";
O(Rc);
const Ha = {
  l1l2: "L1L2"
};
function Is(n) {
  return Ni(n);
}
function Ka(n, t = {}) {
  return Ns(n, te.getMap().classNameMap, t, "regularizer");
}
function $s(n) {
  if (n == null)
    return null;
  if (typeof n == "string") {
    const e = { className: n in Ha ? Ha[n] : n, config: {} };
    return Ka(e);
  } else return n instanceof Pc ? n : Ka(n);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function go(n, t, e) {
  if (typeof n == "number")
    return yr(n, t);
  if (n.length !== t)
    throw new I(`The ${e} argument must be an integer or tuple of ${t} integers. Received: ${n.length} elements.`);
  for (let s = 0; s < t; ++s) {
    const r = n[s];
    if (!Hy(r))
      throw new I(`The ${e} argument must be an integer or tuple of ${t} integers. Received: ${JSON.stringify(n)} including a non-integer number ${r}`);
  }
  return n;
}
function un(n, t, e, s, r = 1) {
  if (n == null)
    return n;
  const o = t + (t - 1) * (r - 1);
  let i;
  return e === "same" ? i = n : i = n - o + 1, Math.floor((i + s - 1) / s);
}
function Ee(n, t, e, s) {
  if (n == null)
    return null;
  if (s === "valid")
    n = n * t + tc([e - t, 0]);
  else if (s === "same")
    n = n * t;
  else
    throw new I(`Unsupport padding mode: ${s}.`);
  return n;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Lc(n, t) {
  return _(() => (gt(t), t === "channelsFirst" ? pt(n, [0, 2, 3, 1]) : n));
}
function Oc(n, t) {
  return _(() => (gt(t), t === "channelsFirst" ? pt(n, [0, 2, 3, 4, 1]) : n));
}
function yw(n, t, e, s = 1, r = "valid", o, i = 1) {
  return _(() => {
    if (o == null && (o = Xn()), gt(o), n.shape.length !== 3)
      throw new I(`The input of a conv1dWithBias operation should be 3, but is ${n.shape.length} instead.`);
    if (t.shape.length !== 3)
      throw new I(`The kernel for a conv1dWithBias operation should be 3, but is ${t.shape.length} instead`);
    if (e != null && e.shape.length !== 1)
      throw new I(`The bias for a conv1dWithBias operation should be 1, but is ${e.shape.length} instead`);
    if (o === "channelsFirst" && (n = pt(n, [0, 2, 1])), r === "causal")
      throw new J("The support for CAUSAL padding mode in conv1dWithBias is not implemented yet.");
    let a = Km(n, t, s, r === "same" ? "same" : "valid", "NWC", i);
    return e != null && (a = Ps(a, e)), a;
  });
}
function Ya(n, t, e, s = [1, 1], r = "valid", o, i, a = null) {
  return _(() => {
    if (o == null && (o = Xn()), gt(o), n.rank !== 3 && n.rank !== 4)
      throw new I(`conv2dWithBiasActivation expects input to be of rank 3 or 4, but received ${n.rank}.`);
    if (t.rank !== 3 && t.rank !== 4)
      throw new I(`conv2dWithBiasActivation expects kernel to be of rank 3 or 4, but received ${n.rank}.`);
    let l = Lc(n, o);
    if (r === "causal")
      throw new J("The support for CAUSAL padding mode in conv1dWithBias is not implemented yet.");
    return l = ab({
      x: l,
      filter: t,
      strides: s,
      pad: r === "same" ? "same" : "valid",
      dilations: i,
      dataFormat: "NHWC",
      bias: e,
      activation: a
    }), o === "channelsFirst" && (l = pt(l, [0, 3, 1, 2])), l;
  });
}
function ww(n, t, e, s = [1, 1, 1], r = "valid", o, i) {
  return _(() => {
    if (o == null && (o = Xn()), gt(o), n.rank !== 4 && n.rank !== 5)
      throw new I(`conv3dWithBias expects input to be of rank 4 or 5, but received ${n.rank}.`);
    if (t.rank !== 4 && t.rank !== 5)
      throw new I(`conv3dWithBias expects kernel to be of rank 4 or 5, but received ${n.rank}.`);
    let a = Oc(n, o);
    if (r === "causal")
      throw new J("The support for CAUSAL padding mode in conv3dWithBias is not implemented yet.");
    return a = Qm(a, t, s, r === "same" ? "same" : "valid", "NDHWC", i), e != null && (a = Ps(a, e)), o === "channelsFirst" && (a = pt(a, [0, 4, 1, 2, 3])), a;
  });
}
class Gi extends ye {
  constructor(t, e) {
    if (super(e), this.bias = null, this.DEFAULT_KERNEL_INITIALIZER = "glorotNormal", this.DEFAULT_BIAS_INITIALIZER = "zeros", Gi.verifyArgs(e), this.rank = t, Oe(this.rank, "rank"), this.rank !== 1 && this.rank !== 2 && this.rank !== 3)
      throw new J(`Convolution layer for rank other than 1, 2, or 3 (${this.rank}) is not implemented yet.`);
    if (this.kernelSize = go(e.kernelSize, t, "kernelSize"), this.strides = go(e.strides == null ? 1 : e.strides, t, "strides"), this.padding = e.padding == null ? "valid" : e.padding, ie(this.padding), this.dataFormat = e.dataFormat == null ? "channelsLast" : e.dataFormat, gt(this.dataFormat), this.activation = nw(e.activation), this.useBias = e.useBias == null ? !0 : e.useBias, this.biasInitializer = vs(e.biasInitializer || this.DEFAULT_BIAS_INITIALIZER), this.biasConstraint = Sr(e.biasConstraint), this.biasRegularizer = $s(e.biasRegularizer), this.activityRegularizer = $s(e.activityRegularizer), this.dilationRate = go(e.dilationRate == null ? 1 : e.dilationRate, t, "dilationRate"), this.rank === 1 && Array.isArray(this.dilationRate) && this.dilationRate.length !== 1)
      throw new I(`dilationRate must be a number or an array of a single number for 1D convolution, but received ${JSON.stringify(this.dilationRate)}`);
    if (this.rank === 2) {
      if (typeof this.dilationRate == "number")
        this.dilationRate = [this.dilationRate, this.dilationRate];
      else if (this.dilationRate.length !== 2)
        throw new I(`dilationRate must be a number or array of two numbers for 2D convolution, but received ${JSON.stringify(this.dilationRate)}`);
    } else if (this.rank === 3) {
      if (typeof this.dilationRate == "number")
        this.dilationRate = [this.dilationRate, this.dilationRate, this.dilationRate];
      else if (this.dilationRate.length !== 3)
        throw new I(`dilationRate must be a number or array of three numbers for 3D convolution, but received ${JSON.stringify(this.dilationRate)}`);
    }
  }
  static verifyArgs(t) {
    if (Ae("kernelSize" in t, "required key 'kernelSize' not in config"), typeof t.kernelSize != "number" && !Di(t.kernelSize, "number", 1, 3))
      throw new I(`BaseConv expects config.kernelSize to be number or number[] with length 1, 2, or 3, but received ${JSON.stringify(t.kernelSize)}.`);
  }
  getConfig() {
    const t = {
      kernelSize: this.kernelSize,
      strides: this.strides,
      padding: this.padding,
      dataFormat: this.dataFormat,
      dilationRate: this.dilationRate,
      activation: ew(this.activation),
      useBias: this.useBias,
      biasInitializer: vr(this.biasInitializer),
      biasRegularizer: Is(this.biasRegularizer),
      activityRegularizer: Is(this.activityRegularizer),
      biasConstraint: xr(this.biasConstraint)
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
class Jn extends Gi {
  constructor(t, e) {
    super(t, e), this.kernel = null, Jn.verifyArgs(e), this.filters = e.filters, Oe(this.filters, "filters"), this.kernelInitializer = vs(e.kernelInitializer || this.DEFAULT_KERNEL_INITIALIZER), this.kernelConstraint = Sr(e.kernelConstraint), this.kernelRegularizer = $s(e.kernelRegularizer);
  }
  build(t) {
    t = ge(t);
    const e = this.dataFormat === "channelsFirst" ? 1 : t.length - 1;
    if (t[e] == null)
      throw new I(`The channel dimension of the input should be defined. Found ${t[e]}`);
    const s = t[e], r = this.kernelSize.concat([s, this.filters]);
    this.kernel = this.addWeight("kernel", r, null, this.kernelInitializer, this.kernelRegularizer, !0, this.kernelConstraint), this.useBias && (this.bias = this.addWeight("bias", [this.filters], null, this.biasInitializer, this.biasRegularizer, !0, this.biasConstraint)), this.inputSpec = [{ ndim: this.rank + 2, axes: { [e]: s } }], this.built = !0;
  }
  call(t, e) {
    return _(() => {
      t = Vt(t);
      let s;
      const r = this.bias == null ? null : this.bias.read(), o = Gy(this.activation.getClassName());
      if (o != null && this.rank === 2)
        s = Ya(t, this.kernel.read(), r, this.strides, this.padding, this.dataFormat, this.dilationRate, o);
      else {
        if (this.rank === 1)
          s = yw(t, this.kernel.read(), r, this.strides[0], this.padding, this.dataFormat, this.dilationRate[0]);
        else if (this.rank === 2)
          s = Ya(t, this.kernel.read(), r, this.strides, this.padding, this.dataFormat, this.dilationRate);
        else if (this.rank === 3)
          s = ww(t, this.kernel.read(), r, this.strides, this.padding, this.dataFormat, this.dilationRate);
        else
          throw new J("convolutions greater than 3D are not implemented yet.");
        this.activation != null && (s = this.activation.apply(s));
      }
      return s;
    });
  }
  computeOutputShape(t) {
    t = ge(t);
    const e = [], s = this.dataFormat === "channelsLast" ? t.slice(1, t.length - 1) : t.slice(2);
    for (let o = 0; o < s.length; ++o) {
      const i = un(s[o], this.kernelSize[o], this.padding, this.strides[o], typeof this.dilationRate == "number" ? this.dilationRate : this.dilationRate[o]);
      e.push(i);
    }
    let r = [t[0]];
    return this.dataFormat === "channelsLast" ? (r = r.concat(e), r.push(this.filters)) : (r.push(this.filters), r = r.concat(e)), r;
  }
  getConfig() {
    const t = {
      filters: this.filters,
      kernelInitializer: vr(this.kernelInitializer),
      kernelRegularizer: Is(this.kernelRegularizer),
      kernelConstraint: xr(this.kernelConstraint)
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
  static verifyArgs(t) {
    if (!("filters" in t) || typeof t.filters != "number" || t.filters < 1)
      throw new I(`Convolution layer expected config.filters to be a 'number' > 0 but got ${JSON.stringify(t.filters)}`);
  }
}
class Zn extends Jn {
  constructor(t) {
    super(2, t), Zn.verifyArgs(t);
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.rank, t;
  }
  static verifyArgs(t) {
    if (typeof t.kernelSize != "number" && !Di(t.kernelSize, "number", 1, 2))
      throw new I(`Conv2D expects config.kernelSize to be number or number[] with length 1 or 2, but received ${JSON.stringify(t.kernelSize)}.`);
  }
}
Zn.className = "Conv2D";
O(Zn);
class Ls extends Jn {
  constructor(t) {
    super(3, t), Ls.verifyArgs(t);
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.rank, t;
  }
  static verifyArgs(t) {
    if (typeof t.kernelSize != "number" && !(Array.isArray(t.kernelSize) && (t.kernelSize.length === 1 || t.kernelSize.length === 3)))
      throw new I(`Conv3D expects config.kernelSize to be number or [number, number, number], but received ${JSON.stringify(t.kernelSize)}.`);
  }
}
Ls.className = "Conv3D";
O(Ls);
class Mc extends Zn {
  constructor(t) {
    if (super(t), this.inputSpec = [new Ce({ ndim: 4 })], this.padding !== "same" && this.padding !== "valid")
      throw new I(`Conv2DTranspose currently supports only padding modes 'same' and 'valid', but received padding mode ${this.padding}`);
  }
  build(t) {
    if (t = ge(t), t.length !== 4)
      throw new I("Input should have rank 4; Received input shape: " + JSON.stringify(t));
    const e = this.dataFormat === "channelsFirst" ? 1 : t.length - 1;
    if (t[e] == null)
      throw new I("The channel dimension of the inputs should be defined. Found `None`.");
    const s = t[e], r = this.kernelSize.concat([this.filters, s]);
    this.kernel = this.addWeight("kernel", r, "float32", this.kernelInitializer, this.kernelRegularizer, !0, this.kernelConstraint), this.useBias && (this.bias = this.addWeight("bias", [this.filters], "float32", this.biasInitializer, this.biasRegularizer, !0, this.biasConstraint)), this.inputSpec = [new Ce({ ndim: 4, axes: { [e]: s } })], this.built = !0;
  }
  call(t, e) {
    return _(() => {
      let s = Vt(t);
      if (s.shape.length !== 4)
        throw new I(`Conv2DTranspose.call() expects input tensor to be rank-4, but received a tensor of rank-${s.shape.length}`);
      const r = s.shape, o = r[0];
      let i, a;
      this.dataFormat === "channelsFirst" ? (i = 2, a = 3) : (i = 1, a = 2);
      const l = r[i], u = r[a], c = this.kernelSize[0], h = this.kernelSize[1], f = this.strides[0], d = this.strides[1], p = Ee(l, f, c, this.padding), g = Ee(u, d, h, this.padding), m = [o, p, g, this.filters];
      this.dataFormat !== "channelsLast" && (s = pt(s, [0, 2, 3, 1]));
      let b = Jm(s, this.kernel.read(), m, this.strides, this.padding);
      return this.dataFormat !== "channelsLast" && (b = pt(b, [0, 3, 1, 2])), this.bias != null && (b = Ps(b, this.bias.read(), this.dataFormat)), this.activation != null && (b = this.activation.apply(b)), b;
    });
  }
  computeOutputShape(t) {
    t = ge(t);
    const e = t.slice();
    let s, r, o;
    this.dataFormat === "channelsFirst" ? (s = 1, r = 2, o = 3) : (s = 3, r = 1, o = 2);
    const i = this.kernelSize[0], a = this.kernelSize[1], l = this.strides[0], u = this.strides[1];
    return e[s] = this.filters, e[r] = Ee(e[r], l, i, this.padding), e[o] = Ee(e[o], u, a, this.padding), e;
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.dilationRate, t;
  }
}
Mc.className = "Conv2DTranspose";
O(Mc);
class Bc extends Ls {
  constructor(t) {
    if (super(t), this.inputSpec = [new Ce({ ndim: 5 })], this.padding !== "same" && this.padding !== "valid")
      throw new I(`Conv3DTranspose currently supports only padding modes 'same' and 'valid', but received padding mode ${this.padding}`);
  }
  build(t) {
    if (t = ge(t), t.length !== 5)
      throw new I("Input should have rank 5; Received input shape: " + JSON.stringify(t));
    const e = this.dataFormat === "channelsFirst" ? 1 : t.length - 1;
    if (t[e] == null)
      throw new I("The channel dimension of the inputs should be defined. Found `None`.");
    const s = t[e], r = this.kernelSize.concat([this.filters, s]);
    this.kernel = this.addWeight("kernel", r, "float32", this.kernelInitializer, this.kernelRegularizer, !0, this.kernelConstraint), this.useBias && (this.bias = this.addWeight("bias", [this.filters], "float32", this.biasInitializer, this.biasRegularizer, !0, this.biasConstraint)), this.inputSpec = [new Ce({ ndim: 5, axes: { [e]: s } })], this.built = !0;
  }
  call(t, e) {
    return _(() => {
      let s = Vt(t);
      if (s.shape.length !== 5)
        throw new I(`Conv3DTranspose.call() expects input tensor to be rank-4, but received a tensor of rank-${s.shape.length}`);
      const r = s.shape, o = r[0];
      let i, a, l;
      this.dataFormat === "channelsFirst" ? (l = 2, i = 3, a = 4) : (l = 1, i = 2, a = 3);
      const u = r[l], c = r[i], h = r[a], f = this.kernelSize[0], d = this.kernelSize[1], p = this.kernelSize[2], g = this.strides[0], m = this.strides[1], b = this.strides[2], y = Ee(u, g, f, this.padding), S = Ee(c, m, d, this.padding), x = Ee(h, b, p, this.padding), v = [o, y, S, x, this.filters];
      this.dataFormat !== "channelsLast" && (s = pt(s, [0, 2, 3, 4, 1]));
      let E = sg(s, this.kernel.read(), v, this.strides, this.padding);
      return this.dataFormat !== "channelsLast" && (E = pt(E, [0, 4, 1, 2, 3])), this.bias !== null && (E = Ps(E, this.bias.read(), this.dataFormat)), this.activation !== null && (E = this.activation.apply(E)), E;
    });
  }
  computeOutputShape(t) {
    t = ge(t);
    const e = t.slice();
    let s, r, o, i;
    this.dataFormat === "channelsFirst" ? (s = 1, r = 2, o = 3, i = 4) : (s = 4, r = 1, o = 2, i = 3);
    const a = this.kernelSize[0], l = this.kernelSize[1], u = this.kernelSize[2], c = this.strides[0], h = this.strides[1], f = this.strides[2];
    return e[s] = this.filters, e[r] = Ee(e[r], c, a, this.padding), e[o] = Ee(e[o], h, l, this.padding), e[i] = Ee(e[i], f, u, this.padding), e;
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.dilationRate, t;
  }
}
Bc.className = "Conv3DTranspose";
O(Bc);
class Fc extends Jn {
  constructor(t, e) {
    if (super(t, e), this.DEFAULT_DEPTHWISE_INITIALIZER = "glorotUniform", this.DEFAULT_POINTWISE_INITIALIZER = "glorotUniform", this.depthwiseKernel = null, this.pointwiseKernel = null, e.filters == null)
      throw new I("The `filters` configuration field is required by SeparableConv, but is unspecified.");
    if (e.kernelInitializer != null || e.kernelRegularizer != null || e.kernelConstraint != null)
      throw new I("Fields kernelInitializer, kernelRegularizer and kernelConstraint are invalid for SeparableConv2D. Use depthwiseInitializer, depthwiseRegularizer, depthwiseConstraint, pointwiseInitializer, pointwiseRegularizer and pointwiseConstraint instead.");
    if (e.padding != null && e.padding !== "same" && e.padding !== "valid")
      throw new I(`SeparableConv${this.rank}D supports only padding modes: 'same' and 'valid', but received ${JSON.stringify(e.padding)}`);
    this.depthMultiplier = e.depthMultiplier == null ? 1 : e.depthMultiplier, this.depthwiseInitializer = vs(e.depthwiseInitializer || this.DEFAULT_DEPTHWISE_INITIALIZER), this.depthwiseRegularizer = $s(e.depthwiseRegularizer), this.depthwiseConstraint = Sr(e.depthwiseConstraint), this.pointwiseInitializer = vs(e.depthwiseInitializer || this.DEFAULT_POINTWISE_INITIALIZER), this.pointwiseRegularizer = $s(e.pointwiseRegularizer), this.pointwiseConstraint = Sr(e.pointwiseConstraint);
  }
  build(t) {
    if (t = ge(t), t.length < this.rank + 2)
      throw new I(`Inputs to SeparableConv${this.rank}D should have rank ${this.rank + 2}, but received input shape: ${JSON.stringify(t)}`);
    const e = this.dataFormat === "channelsFirst" ? 1 : t.length - 1;
    if (t[e] == null || t[e] < 0)
      throw new I(`The channel dimension of the inputs should be defined, but found ${JSON.stringify(t[e])}`);
    const s = t[e], r = this.kernelSize.concat([s, this.depthMultiplier]), o = [];
    for (let a = 0; a < this.rank; ++a)
      o.push(1);
    o.push(s * this.depthMultiplier, this.filters);
    const i = !0;
    this.depthwiseKernel = this.addWeight("depthwise_kernel", r, "float32", this.depthwiseInitializer, this.depthwiseRegularizer, i, this.depthwiseConstraint), this.pointwiseKernel = this.addWeight("pointwise_kernel", o, "float32", this.pointwiseInitializer, this.pointwiseRegularizer, i, this.pointwiseConstraint), this.useBias ? this.bias = this.addWeight("bias", [this.filters], "float32", this.biasInitializer, this.biasRegularizer, i, this.biasConstraint) : this.bias = null, this.inputSpec = [new Ce({ ndim: this.rank + 2, axes: { [e]: s } })], this.built = !0;
  }
  call(t, e) {
    return _(() => {
      t = Vt(t);
      let s;
      if (this.rank === 1)
        throw new J("1D separable convolution is not implemented yet.");
      return this.rank === 2 && (this.dataFormat === "channelsFirst" && (t = pt(t, [0, 2, 3, 1])), s = z0(t, this.depthwiseKernel.read(), this.pointwiseKernel.read(), this.strides, this.padding, this.dilationRate, "NHWC")), this.useBias && (s = Ps(s, this.bias.read(), this.dataFormat)), this.activation != null && (s = this.activation.apply(s)), this.dataFormat === "channelsFirst" && (s = pt(s, [0, 3, 1, 2])), s;
    });
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.rank, delete t.kernelInitializer, delete t.kernelRegularizer, delete t.kernelConstraint, t.depthwiseInitializer = vr(this.depthwiseInitializer), t.pointwiseInitializer = vr(this.pointwiseInitializer), t.depthwiseRegularizer = Is(this.depthwiseRegularizer), t.pointwiseRegularizer = Is(this.pointwiseRegularizer), t.depthwiseConstraint = xr(this.depthwiseConstraint), t.pointwiseConstraint = xr(this.pointwiseConstraint), t;
  }
}
Fc.className = "SeparableConv";
class zc extends Fc {
  constructor(t) {
    super(2, t);
  }
}
zc.className = "SeparableConv2D";
O(zc);
class Hr extends Jn {
  constructor(t) {
    super(1, t), Hr.verifyArgs(t), this.inputSpec = [{ ndim: 3 }];
  }
  getConfig() {
    const t = super.getConfig();
    return delete t.rank, delete t.dataFormat, t;
  }
  static verifyArgs(t) {
    if (typeof t.kernelSize != "number" && !Di(t.kernelSize, "number", 1, 1))
      throw new I(`Conv1D expects config.kernelSize to be number or number[] with length 1, but received ${JSON.stringify(t.kernelSize)}.`);
  }
}
Hr.className = "Conv1D";
O(Hr);
class Uc extends ye {
  constructor(t) {
    super(t), typeof t.cropping == "number" ? this.cropping = [[t.cropping, t.cropping], [t.cropping, t.cropping]] : typeof t.cropping[0] == "number" ? this.cropping = [
      [t.cropping[0], t.cropping[0]],
      [t.cropping[1], t.cropping[1]]
    ] : this.cropping = t.cropping, this.dataFormat = t.dataFormat === void 0 ? "channelsLast" : t.dataFormat, this.inputSpec = [{ ndim: 4 }];
  }
  computeOutputShape(t) {
    return this.dataFormat === "channelsFirst" ? [
      t[0],
      t[1],
      t[2] - this.cropping[0][0] - this.cropping[0][1],
      t[3] - this.cropping[1][0] - this.cropping[1][1]
    ] : [
      t[0],
      t[1] - this.cropping[0][0] - this.cropping[0][1],
      t[2] - this.cropping[1][0] - this.cropping[1][1],
      t[3]
    ];
  }
  call(t, e) {
    return _(() => {
      if (t = Vt(t), this.dataFormat === "channelsLast") {
        const s = Gs(t, this.cropping[0][0], t.shape[1] - this.cropping[0][0] - this.cropping[0][1], 2);
        return Gs(s, this.cropping[1][0], t.shape[2] - this.cropping[1][1] - this.cropping[1][0], 3);
      } else {
        const s = Gs(t, this.cropping[0][0], t.shape[2] - this.cropping[0][0] - this.cropping[0][1], 3);
        return Gs(s, this.cropping[1][0], t.shape[3] - this.cropping[1][1] - this.cropping[1][0], 4);
      }
    });
  }
  getConfig() {
    const t = { cropping: this.cropping, dataFormat: this.dataFormat }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
Uc.className = "Cropping2D";
O(Uc);
class Vi extends ye {
  constructor(t) {
    super(t), this.DEFAULT_SIZE = [2, 2], this.inputSpec = [{ ndim: 4 }], this.size = t.size == null ? this.DEFAULT_SIZE : t.size, this.dataFormat = t.dataFormat == null ? "channelsLast" : t.dataFormat, gt(this.dataFormat), this.interpolation = t.interpolation == null ? "nearest" : t.interpolation, Vy(this.interpolation);
  }
  computeOutputShape(t) {
    if (this.dataFormat === "channelsFirst") {
      const e = t[2] == null ? null : this.size[0] * t[2], s = t[3] == null ? null : this.size[1] * t[3];
      return [t[0], t[1], e, s];
    } else {
      const e = t[1] == null ? null : this.size[0] * t[1], s = t[2] == null ? null : this.size[1] * t[2];
      return [t[0], e, s, t[3]];
    }
  }
  call(t, e) {
    return _(() => {
      let s = Vt(t);
      const r = s.shape;
      if (this.dataFormat === "channelsFirst") {
        s = pt(s, [0, 2, 3, 1]);
        const o = this.size[0] * r[2], i = this.size[1] * r[3], a = this.interpolation === "nearest" ? Us.resizeNearestNeighbor(s, [o, i]) : Us.resizeBilinear(s, [o, i]);
        return pt(a, [0, 3, 1, 2]);
      } else {
        const o = this.size[0] * r[1], i = this.size[1] * r[2];
        return this.interpolation === "nearest" ? Us.resizeNearestNeighbor(s, [o, i]) : Us.resizeBilinear(s, [o, i]);
      }
    });
  }
  getConfig() {
    const t = {
      size: this.size,
      dataFormat: this.dataFormat,
      interpolation: this.interpolation
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
Vi.className = "UpSampling2D";
O(Vi);
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Kr(n, t, e, s, r, o) {
  return _(() => {
    gt(r), Xu(o), ie(s), e == null && (e = [1, 1]), s == null && (s = "valid"), r == null && (r = Xn()), o == null && (o = "max"), n = Lc(n, r);
    let i;
    const a = s === "same" ? "same" : "valid";
    return o === "max" ? i = Qg(n, t, e, a) : i = Om(
      // TODO(cais): Rank check?
      n,
      t,
      e,
      a
    ), r === "channelsFirst" && (i = pt(i, [0, 3, 1, 2])), i;
  });
}
function Wc(n, t, e, s, r, o) {
  return _(() => {
    gt(r), Xu(o), ie(s), e == null && (e = [1, 1, 1]), s == null && (s = "valid"), r == null && (r = Xn()), o == null && (o = "max"), n = Oc(n, r);
    let i;
    const a = s === "same" ? "same" : "valid";
    return o === "max" ? i = e0(n, t, e, a) : i = Bm(n, t, e, a), r === "channelsFirst" && (i = pt(i, [0, 4, 1, 2, 3])), i;
  });
}
class Gc extends ye {
  /**
   *
   * @param args Parameters for the Pooling layer.
   *
   * config.poolSize defaults to 2.
   */
  constructor(t) {
    if (t.poolSize == null && (t.poolSize = 2), super(t), typeof t.poolSize == "number")
      this.poolSize = [t.poolSize];
    else if (Array.isArray(t.poolSize) && t.poolSize.length === 1 && typeof t.poolSize[0] == "number")
      this.poolSize = t.poolSize;
    else
      throw new I(`poolSize for 1D convolutional layer must be a number or an Array of a single number, but received ${JSON.stringify(t.poolSize)}`);
    if (Oe(this.poolSize, "poolSize"), t.strides == null)
      this.strides = this.poolSize;
    else if (typeof t.strides == "number")
      this.strides = [t.strides];
    else if (Array.isArray(t.strides) && t.strides.length === 1 && typeof t.strides[0] == "number")
      this.strides = t.strides;
    else
      throw new I(`strides for 1D convolutional layer must be a number or an Array of a single number, but received ${JSON.stringify(t.strides)}`);
    Oe(this.strides, "strides"), this.padding = t.padding == null ? "valid" : t.padding, ie(this.padding), this.inputSpec = [new Ce({ ndim: 3 })];
  }
  computeOutputShape(t) {
    t = ge(t);
    const e = un(t[1], this.poolSize[0], this.padding, this.strides[0]);
    return [t[0], e, t[2]];
  }
  call(t, e) {
    return _(() => {
      this.invokeCallHook(t, e), t = Pi(Vt(t), 2);
      const s = this.poolingFunction(Vt(t), [this.poolSize[0], 1], [this.strides[0], 1], this.padding, "channelsLast");
      return jr(s, [2]);
    });
  }
  getConfig() {
    const t = {
      poolSize: this.poolSize,
      padding: this.padding,
      strides: this.strides
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
class Vc extends Gc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Kr(t, e, s, r, o, "max");
  }
}
Vc.className = "MaxPooling1D";
O(Vc);
class qc extends Gc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Kr(t, e, s, r, o, "avg");
  }
}
qc.className = "AveragePooling1D";
O(qc);
class jc extends ye {
  constructor(t) {
    if (t.poolSize == null && (t.poolSize = [2, 2]), super(t), this.poolSize = Array.isArray(t.poolSize) ? t.poolSize : [t.poolSize, t.poolSize], t.strides == null)
      this.strides = this.poolSize;
    else if (Array.isArray(t.strides)) {
      if (t.strides.length !== 2)
        throw new I(`If the strides property of a 2D pooling layer is an Array, it is expected to have a length of 2, but received length ${t.strides.length}.`);
      this.strides = t.strides;
    } else
      this.strides = [t.strides, t.strides];
    Oe(this.poolSize, "poolSize"), Oe(this.strides, "strides"), this.padding = t.padding == null ? "valid" : t.padding, this.dataFormat = t.dataFormat == null ? "channelsLast" : t.dataFormat, gt(this.dataFormat), ie(this.padding), this.inputSpec = [new Ce({ ndim: 4 })];
  }
  computeOutputShape(t) {
    t = ge(t);
    let e = this.dataFormat === "channelsFirst" ? t[2] : t[1], s = this.dataFormat === "channelsFirst" ? t[3] : t[2];
    return e = un(e, this.poolSize[0], this.padding, this.strides[0]), s = un(s, this.poolSize[1], this.padding, this.strides[1]), this.dataFormat === "channelsFirst" ? [t[0], t[1], e, s] : [t[0], e, s, t[3]];
  }
  call(t, e) {
    return _(() => (this.invokeCallHook(t, e), this.poolingFunction(Vt(t), this.poolSize, this.strides, this.padding, this.dataFormat)));
  }
  getConfig() {
    const t = {
      poolSize: this.poolSize,
      padding: this.padding,
      strides: this.strides,
      dataFormat: this.dataFormat
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
class qi extends jc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Kr(t, e, s, r, o, "max");
  }
}
qi.className = "MaxPooling2D";
O(qi);
class Hc extends jc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Kr(t, e, s, r, o, "avg");
  }
}
Hc.className = "AveragePooling2D";
O(Hc);
class Kc extends ye {
  constructor(t) {
    if (t.poolSize == null && (t.poolSize = [2, 2, 2]), super(t), this.poolSize = Array.isArray(t.poolSize) ? t.poolSize : [t.poolSize, t.poolSize, t.poolSize], t.strides == null)
      this.strides = this.poolSize;
    else if (Array.isArray(t.strides)) {
      if (t.strides.length !== 3)
        throw new I(`If the strides property of a 3D pooling layer is an Array, it is expected to have a length of 3, but received length ${t.strides.length}.`);
      this.strides = t.strides;
    } else
      this.strides = [t.strides, t.strides, t.strides];
    Oe(this.poolSize, "poolSize"), Oe(this.strides, "strides"), this.padding = t.padding == null ? "valid" : t.padding, this.dataFormat = t.dataFormat == null ? "channelsLast" : t.dataFormat, gt(this.dataFormat), ie(this.padding), this.inputSpec = [new Ce({ ndim: 5 })];
  }
  computeOutputShape(t) {
    t = ge(t);
    let e = this.dataFormat === "channelsFirst" ? t[2] : t[1], s = this.dataFormat === "channelsFirst" ? t[3] : t[2], r = this.dataFormat === "channelsFirst" ? t[4] : t[3];
    return e = un(e, this.poolSize[0], this.padding, this.strides[0]), s = un(s, this.poolSize[1], this.padding, this.strides[1]), r = un(r, this.poolSize[2], this.padding, this.strides[2]), this.dataFormat === "channelsFirst" ? [t[0], t[1], e, s, r] : [t[0], e, s, r, t[4]];
  }
  call(t, e) {
    return _(() => (this.invokeCallHook(t, e), this.poolingFunction(Vt(t), this.poolSize, this.strides, this.padding, this.dataFormat)));
  }
  getConfig() {
    const t = {
      poolSize: this.poolSize,
      padding: this.padding,
      strides: this.strides,
      dataFormat: this.dataFormat
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
class Yc extends Kc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Wc(t, e, s, r, o, "max");
  }
}
Yc.className = "MaxPooling3D";
O(Yc);
class Xc extends Kc {
  constructor(t) {
    super(t);
  }
  poolingFunction(t, e, s, r, o) {
    return gt(o), ie(r), Wc(t, e, s, r, o, "avg");
  }
}
Xc.className = "AveragePooling3D";
O(Xc);
class Jc extends ye {
  constructor(t) {
    super(t), this.inputSpec = [new Ce({ ndim: 3 })];
  }
  computeOutputShape(t) {
    return [t[0], t[2]];
  }
  call(t, e) {
    throw new J();
  }
}
class Zc extends Jc {
  constructor(t) {
    super(t || {});
  }
  call(t, e) {
    return _(() => {
      const s = Vt(t);
      return St(s, 1);
    });
  }
}
Zc.className = "GlobalAveragePooling1D";
O(Zc);
class Qc extends Jc {
  constructor(t) {
    super(t || {});
  }
  call(t, e) {
    return _(() => {
      const s = Vt(t);
      return Ge(s, 1);
    });
  }
}
Qc.className = "GlobalMaxPooling1D";
O(Qc);
class th extends ye {
  constructor(t) {
    super(t), this.dataFormat = t.dataFormat == null ? "channelsLast" : t.dataFormat, gt(this.dataFormat), this.inputSpec = [new Ce({ ndim: 4 })];
  }
  computeOutputShape(t) {
    return t = t, this.dataFormat === "channelsLast" ? [t[0], t[3]] : [t[0], t[1]];
  }
  call(t, e) {
    throw new J();
  }
  getConfig() {
    const t = { dataFormat: this.dataFormat }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
class eh extends th {
  call(t, e) {
    return _(() => {
      const s = Vt(t);
      return this.dataFormat === "channelsLast" ? St(s, [1, 2]) : St(s, [2, 3]);
    });
  }
}
eh.className = "GlobalAveragePooling2D";
O(eh);
class nh extends th {
  call(t, e) {
    return _(() => {
      const s = Vt(t);
      return this.dataFormat === "channelsLast" ? Ge(s, [1, 2]) : Ge(s, [2, 3]);
    });
  }
}
nh.className = "GlobalMaxPooling2D";
O(nh);
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Ar(n, t) {
  return _(() => {
    n.dtype !== "float32" && (n = ot(n, "float32"));
    const e = et(Ds(n), t, !0), s = Vr(e.shape, mt()), r = me(jn(e, s));
    return Y(n, r);
  });
}
function Yr(n, t) {
  return _(() => St(Ds(Z(t, n)), -1));
}
function ji(n, t) {
  return _(() => St(Nt(Z(t, n)), -1));
}
function Hi(n, t) {
  return _(() => {
    const e = Z(n, t), s = pe(Nt(n), mt(), Number.MAX_VALUE), r = Nt(Y(e, s));
    return N(100, St(r, -1));
  });
}
function xw(n, t) {
  return _(() => {
    const e = pe(t, mt(), Number.MAX_VALUE), s = gn(M(1, e)), r = pe(n, mt(), Number.MAX_VALUE), o = gn(M(1, r));
    return St(Ds(Z(s, o)), -1);
  });
}
function Sw(n, t) {
  return _(() => {
    const e = jn(0, Z(1, N(n, t)));
    return St(Ds(e), -1);
  });
}
function vw(n, t) {
  return _(() => {
    const e = jn(0, Z(1, N(n, t)));
    return St(e, -1);
  });
}
function Iw(n, t) {
  return _(() => {
    const e = et(N(n, t), -1), s = Ge(N(Z(1, n), t), -1);
    return jn(0, M(1, Z(s, e)));
  });
}
function $w(n, t) {
  return _(() => {
    const e = Math.log(2), s = Z(t, n), r = Z(M(s, yi(N(-2, s))), e);
    return St(r, -1);
  });
}
function As(n, t, e = !1) {
  return _(() => {
    if (e)
      t = Bu(t);
    else {
      const s = et(t, t.shape.length - 1, !0);
      t = Y(t, s);
    }
    return t = pe(t, mt(), 1 - mt()), qn(et(N(ot(n, "float32"), gn(t)), t.shape.length - 1));
  });
}
function Er(n, t, e = !1) {
  return _(() => {
    const s = ot(Tg(Ky(n)), "int32");
    t = pe(t, mt(), 1 - mt());
    const r = t.shape, o = L(i0(s, r[r.length - 1]), r);
    return As(o, t, e);
  });
}
function Aw(n, t) {
  if (!oe(n.shape, t.shape))
    throw new I(`logits and labels must have the same shape, but got shapes ${JSON.stringify(n.shape)} and ${JSON.stringify(t.shape)}`);
  return _(() => {
    const e = Ts(t), s = qn(Nt(t));
    return M(Z(e, N(t, n)), Vg(Go(s)));
  });
}
function Xr(n, t) {
  return _(() => {
    let e;
    return e = pe(t, mt(), 1 - mt()), e = gn(Y(e, Z(1, e))), St(Aw(n, e), -1);
  });
}
function Ew(n, t) {
  return _(() => {
    const e = pe(n, mt(), 1), s = pe(t, mt(), 1);
    return et(N(n, gn(Y(e, s))), -1);
  });
}
function _w(n, t) {
  return _(() => {
    const e = gn(M(mt(), t));
    return St(Z(t, N(n, e)), -1);
  });
}
function sh(n, t) {
  return _(() => {
    const e = Ar(n, -1), s = Ar(t, -1), r = N(e, s);
    return qn(et(r, -1));
  });
}
const _r = {
  meanSquaredError: Yr,
  meanAbsoluteError: ji,
  meanAbsolutePercentageError: Hi,
  meanSquaredLogarithmicError: xw,
  squaredHinge: Sw,
  hinge: vw,
  categoricalHinge: Iw,
  logcosh: $w,
  categoricalCrossentropy: As,
  sparseCategoricalCrossentropy: Er,
  binaryCrossentropy: Xr,
  kullbackLeiblerDivergence: Ew,
  poisson: _w,
  cosineProximity: sh
};
function bo(n) {
  if (typeof n == "string") {
    if (n in _r)
      return _r[n];
    let t = `Unknown loss ${n}`;
    throw n.toLowerCase().includes("softmaxcrossentropy") && (t = `Unknown loss ${n}. Use "categoricalCrossentropy" as the string name for tf.losses.softmaxCrossEntropy`), new I(t);
  } else
    return n;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class vn extends ye {
  constructor(t) {
    super(t || {}), this.supportsMasking = !0;
  }
  /**
   * Logic for merging multiple tensors, to be overridden by subclasses.
   * @param inputs
   */
  mergeFunction(t) {
    throw new J();
  }
  /**
   * Computes the shape of the result of an elementwise operation.
   *
   * @param shape1: Shape of the first tensor.
   * @param shape2: Shape of the second tensor.
   * @returns Expected output shape when an elementwise operation is carried
   *   out on 2 tensors with shapes `shape1` and `shape2`.
   * @throws ValueError: If `shape1` and `shape2` are not compatible for
   *   element-wise operations.
   */
  computeElementwiseOpOutputShape(t, e) {
    if (t == null || e == null)
      return null;
    if (t.length < e.length)
      return this.computeElementwiseOpOutputShape(e, t);
    if (e.length === 0)
      return t;
    const s = t.slice(0, t.length - e.length);
    for (let r = 0; r < e.length; ++r) {
      const o = t[t.length - e.length + r], i = e[r];
      if (o == null || i == null || o < 0 || i < 0)
        s.push(null);
      else if (o === 1)
        s.push(i);
      else if (i === 1)
        s.push(o);
      else {
        if (o !== i)
          throw new I("Operands could not be broadcast together with shapes " + JSON.stringify(t) + " " + JSON.stringify(e));
        s.push(o);
      }
    }
    return s;
  }
  build(t) {
    if (Array.isArray(t) && !Array.isArray(t[0]) && (t = [ge(t)]), t = t, t.length < 2)
      throw new I(`A merge layer should be called on an Array of at least 2 inputs. Got ${t.length} input(s).`);
    let e = [];
    for (const o of t)
      o != null && o[0] !== null && e.push(o[0]);
    if (e = an(e), e.length > 1)
      throw new I(`Can not merge tensors with different batch sizes. Got tensors with shapes: ${JSON.stringify(t)}.`);
    let s = t[0] == null ? null : t[0].slice(1);
    for (let o = 1; o < t.length; ++o) {
      const i = t[o] == null ? null : t[o].slice(1);
      s = this.computeElementwiseOpOutputShape(s, i);
    }
    const r = t.map((o) => o.length);
    t.indexOf(null) === -1 && an(r).length === 1 ? this.reshapeRequired = !1 : this.reshapeRequired = !0;
  }
  call(t, e) {
    return _(() => {
      if (t = t, this.reshapeRequired) {
        const s = [], r = t.map((o) => o.rank);
        if (r.indexOf(null) === -1) {
          const o = tc(r);
          for (let i of t) {
            const a = i.rank;
            for (let l = 0; l < o - a; ++l)
              i = Pi(i, 1);
            s.push(i);
          }
          return this.mergeFunction(s);
        } else {
          let o = !1;
          for (const l of t) {
            const u = l.rank;
            if (u == null) {
              const c = l.shape, h = c[0], f = c.slice(1).concat([h]);
              let d = L(l, [h].concat(ms(c.slice(1))));
              d = pt(d, [1, 0]), d = L(d, f), s.push(d), o = !0;
            } else if (u > 1) {
              const c = wr(1, u).concat([0]);
              s.push(pt(l, c)), o = !0;
            } else
              s.push(l);
          }
          let i = this.mergeFunction(s);
          const a = i.rank;
          if (o) {
            if (a == null) {
              const l = i.shape, u = l.length, c = l[u - 1], h = [c].concat(l.slice(0, l.length - 1));
              i = L(pt(L(i, [-1, c]), [1, 0]), h);
            } else if (a > 1) {
              const l = [a - 1].concat(wr(0, a - 1));
              i = pt(i, l);
            }
          }
          return i;
        }
      } else
        return this.mergeFunction(t);
    });
  }
  computeOutputShape(t) {
    t = t;
    let e;
    t[0] == null ? e = null : e = t[0].slice(1);
    for (let r = 1; r < t.length; ++r) {
      const o = t[r] == null ? null : t[r].slice(1);
      e = this.computeElementwiseOpOutputShape(e, o);
    }
    let s = [];
    for (const r of t)
      r != null && r[0] !== null && s.push(r[0]);
    return s = an(s), s.length === 1 ? e = s.concat(e) : e = [null].concat(e), e;
  }
  computeMask(t, e) {
    return _(() => {
      if (e == null)
        return null;
      if (!Array.isArray(e))
        throw new I("`mask` should be an Array");
      if (!Array.isArray(t))
        throw new I("`inputs` should be an Array");
      if (e.length !== t.length)
        throw new I(`The Array 'inputs' and 'mask' are expected to have the same length, but have different lengths (${t.length} vs ${e.length})`);
      if (e.every((r) => r == null))
        return null;
      e = e.map((r) => r == null ? r : Ie(r, 0));
      let s = e[0];
      for (let r = 1; r < e.length - 1; ++r)
        s = qr(s, e[r]);
      return s;
    });
  }
}
class rh extends vn {
  constructor(t) {
    super(t);
  }
  mergeFunction(t) {
    return _(() => {
      let e = t[0].clone();
      for (let s = 1; s < t.length; ++s)
        e = M(e, t[s]);
      return e;
    });
  }
}
rh.className = "Add";
O(rh);
class oh extends vn {
  constructor(t) {
    super(t);
  }
  mergeFunction(t) {
    return _(() => {
      let e = t[0].clone();
      for (let s = 1; s < t.length; ++s)
        e = N(e, t[s]);
      return e;
    });
  }
}
oh.className = "Multiply";
O(oh);
class ih extends vn {
  constructor(t) {
    super(t);
  }
  mergeFunction(t) {
    return _(() => {
      let e = t[0].clone();
      for (let s = 1; s < t.length; ++s)
        e = M(e, t[s]);
      return N(1 / t.length, e);
    });
  }
}
ih.className = "Average";
O(ih);
class ah extends vn {
  constructor(t) {
    super(t);
  }
  mergeFunction(t) {
    return _(() => {
      let e = t[0];
      for (let s = 1; s < t.length; ++s)
        e = jn(e, t[s]);
      return e;
    });
  }
}
ah.className = "Maximum";
O(ah);
class lh extends vn {
  constructor(t) {
    super(t);
  }
  mergeFunction(t) {
    return _(() => {
      let e = t[0];
      for (let s = 1; s < t.length; ++s)
        e = mr(e, t[s]);
      return e;
    });
  }
}
lh.className = "Minimum";
O(lh);
class Ki extends vn {
  constructor(t) {
    super(t), this.DEFAULT_AXIS = -1, t == null && (t = {}), this.axis = t.axis == null ? this.DEFAULT_AXIS : t.axis, this.supportsMasking = !0, this.reshapeRequired = !1;
  }
  build(t) {
    if (!(Array.isArray(t) && Array.isArray(t[0])) || t.length === 1)
      throw new I("A `Concatenate` layer should be called on a list of at least 2 inputs");
    t = t;
    let e = !0;
    for (const r of t)
      if (r != null) {
        e = !1;
        break;
      }
    if (e)
      return;
    const s = [];
    for (let r = 0; r < t.length; ++r) {
      const o = t[r].slice();
      o.splice(this.axis, 1);
      let i = !1;
      for (const a of s)
        if (oe(a, o)) {
          i = !0;
          break;
        }
      i || s.push(o);
    }
    if (s.length > 1)
      throw new I("A `Concatenate` layer requires inputs with matching shapes except for the concat axis. Got input shapes: " + JSON.stringify(t));
  }
  mergeFunction(t) {
    return _(() => Yy(t, this.axis));
  }
  computeOutputShape(t) {
    if (!(Array.isArray(t) && Array.isArray(t[0])))
      throw new I("A `Concatenate` layer should be called on a list of inputs.");
    const e = t, s = e[0].slice(), r = this.axis < 0 ? s.length + this.axis : this.axis;
    for (const o of e.slice(1)) {
      if (s[r] == null || o[r] == null) {
        s[r] = null;
        break;
      }
      s[r] += o[r];
    }
    return s;
  }
  computeMask(t, e) {
    if (e == null)
      return null;
    if (!Array.isArray(e))
      throw new I("`mask` should be an array for Concatenate");
    if (!Array.isArray(t))
      throw new I("`inputs` should be an array for Concatenate");
    if (e.length !== t.length)
      throw new I(`Mismatch in the length of mask (${e.length}) and the legnth of inputs (${t.length})`);
    return _(() => {
      let s = !0;
      if (e.forEach((i) => {
        if (i != null) {
          s = !1;
          return;
        }
      }), s)
        return null;
      const r = [];
      for (let i = 0; i < t.length; ++i)
        e[i] == null ? r.push(ot(Du(t[i]), "bool")) : e[i].rank < t[i].rank ? r.push(Ie(e[i], -1)) : r.push(e[i]);
      const o = rn(r, this.axis);
      return _m(o, -1, !1);
    });
  }
  getConfig() {
    const t = {
      axis: this.axis
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
Ki.className = "Concatenate";
O(Ki);
function os(n, t) {
  for (; n < 0; )
    n += t;
  return n;
}
function Cw(n, t, e) {
  if (n.shape.length > 3 || t.shape.length > 3)
    throw new J("batchDot is not implemented for tensors of 4D or higher rank yet");
  if (w(n.shape.length >= 2, () => `batchDot requires the rank of x to be >= 2, but got ${n.shape.length}`), w(n.shape.length >= 2, () => `batchDot requires the rank of y to be >= 2, but got ${t.shape.length}`), typeof e == "number" && (e = [e, e]), n.dtype === "complex64" || t.dtype === "complex64")
    throw new J("batchDot is not implemented for complex64-type Tensors yet.");
  const s = n.shape.length, r = t.shape.length;
  e == null && (e = [s - 1, r - 2]);
  const o = e;
  return _(() => {
    let i;
    if (s > r) {
      i = s - r;
      const l = [];
      for (let u = 0; u < i; ++u)
        l.push(1);
      t = L(t, t.shape.concat(l));
    } else if (r > s) {
      i = r - s;
      const l = [];
      for (let u = 0; u < i; ++u)
        l.push(1);
      n = L(n, n.shape.concat(l));
    } else
      i = 0;
    let a;
    if (n.shape.length === 2 && t.shape.length === 2)
      o[0] === o[1] ? a = et(N(n, t), o[0]) : a = et(N(pt(n, [1, 0]), t), o[1]);
    else {
      const l = o[0] !== n.shape.length - 1, u = o[1] === t.shape.length - 1;
      a = we(n, t, l, u);
    }
    if (i > 0) {
      let l;
      s > r ? l = s + r - 3 : l = s - 1;
      const u = [];
      for (let c = l; c < l + i; ++c)
        u.push(c);
      a = jr(a, u);
    }
    return a.shape.length === 1 && (a = Ie(a, 1)), a;
  });
}
class uh extends vn {
  constructor(t) {
    super(t), this.axes = t.axes, this.normalize = t.normalize == null ? !1 : t.normalize, this.supportsMasking = !0, this.reshapeRequired = !1;
  }
  build(t) {
    w(Array.isArray(t) && t.length === 2 && Array.isArray(t[0]) && Array.isArray(t[1]), () => "A `Dot` layer should be called on a list of exactly 2 inputs.");
    const e = t[0], s = t[1];
    if (e.length > 3 || s.length > 3)
      throw new J("Dot layer does not support tensors of 4D or higher rank yet.");
    const r = this.interpretAxes(e, s);
    if (e[r[0]] !== s[r[1]])
      throw new I(`Dimension incompatibility: ${e[r[0]]} !== ${s[r[1]]}`);
  }
  mergeFunction(t) {
    if (t.length !== 2)
      throw new I(`A \`Dot\` layer must be called on exactly 2 inputs, but received ${t.length} input(s).`);
    let e = t[0], s = t[1], r;
    return Array.isArray(this.axes) ? r = this.axes.map((o, i) => os(o, t[i].shape.length)) : r = [
      os(this.axes, e.shape.length),
      os(this.axes, s.shape.length)
    ], this.normalize && (e = Ar(e, r[0]), s = Ar(s, r[1])), Cw(e, s, r);
  }
  interpretAxes(t, e) {
    let s;
    return Array.isArray(this.axes) ? s = this.axes : s = [
      os(this.axes, t.length),
      os(this.axes, e.length)
    ], s;
  }
  computeOutputShape(t) {
    w(Array.isArray(t) && t.length === 2 && Array.isArray(t[0]) && Array.isArray(t[1]), () => "A `Dot` layer should be called on a list of exactly 2 inputs.");
    const e = t[0].slice(), s = t[1].slice();
    if (e.length > 3 || s.length > 3)
      throw new J("Dot layer does not support tensors of 4D or higher rank yet.");
    const r = this.interpretAxes(e, s);
    e.splice(r[0], 1), s.splice(r[1], 1), s.splice(0, 1);
    const o = e.concat(s);
    return o.length === 1 && o.push(1), o;
  }
  computeMask(t, e) {
    return null;
  }
  getConfig() {
    const t = {
      axes: this.axes,
      normalize: this.normalize
    }, e = super.getConfig();
    return Object.assign(t, e), t;
  }
}
uh.className = "Dot";
O(uh);
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
async function Ye(n) {
  if (n == null)
    return;
  const t = [], e = [], s = [];
  for (const r in n) {
    const o = n[r];
    if (typeof o != "number") {
      const i = o;
      t.push(i.data()), e.push(r), s.push(i);
    }
  }
  if (t.length > 0) {
    const r = await Promise.all(t);
    for (let o = 0; o < r.length; ++o)
      n[e[o]] = r[o][0];
    ut(s);
  }
}
function ch(n) {
  if (n != null)
    for (const t in n) {
      const e = n[t];
      typeof e != "number" && e.dispose();
    }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
var Xa;
(function(n) {
  n[n.SILENT = 0] = "SILENT", n[n.VERBOSE = 1] = "VERBOSE";
})(Xa || (Xa = {}));
const kw = 125;
class Es {
  constructor() {
    this.validationData = null;
  }
  setParams(t) {
    this.params = t;
  }
  async onEpochBegin(t, e) {
  }
  async onEpochEnd(t, e) {
  }
  async onBatchBegin(t, e) {
  }
  async onBatchEnd(t, e) {
  }
  async onTrainBegin(t) {
  }
  async onTrainEnd(t) {
  }
  // LayersModel needs to call Callback.setModel(), but cannot actually depend
  // on Callback because that creates a cyclic dependency.  Providing this no-op
  // method on BaseCallback breaks the cycle: this way LayersModel can depend on
  // BaseCallback but not on Callback.  The argument is typed as `Container`
  // (the superclass of LayersModel) to avoid recapitulating the cycle. Callback
  // overrides this method and enforces that the argument is really a
  // LayersModel.
  setModel(t) {
  }
}
class Tw {
  // TODO(cais): When the need arises, uncomment the following lines and
  // implement the queue for time values.
  // private deltaTBatch: number;
  // private deltaTsBatchBegin: Array<number>;
  // private deltaTsBatchEnd: Array<number>;
  /**
   * Constructor of CallbackList.
   * @param callbacks Array of `Callback` instances.
   * @param queueLength Queue length for keeping running statistics over
   *   callback execution time.
   */
  constructor(t, e = 10) {
    t == null && (t = []), this.callbacks = t, this.queueLength = e;
  }
  append(t) {
    this.callbacks.push(t);
  }
  setParams(t) {
    for (const e of this.callbacks)
      e.setParams(t);
  }
  setModel(t) {
    for (const e of this.callbacks)
      e.setModel(t);
  }
  /**
   * Called at the start of an epoch.
   * @param epoch Index of epoch.
   * @param logs Dictionary of logs.
   */
  async onEpochBegin(t, e) {
    e == null && (e = {});
    for (const s of this.callbacks)
      await s.onEpochBegin(t, e);
  }
  /**
   * Called at the end of an epoch.
   * @param epoch Index of epoch.
   * @param logs Dictionary of logs.
   */
  async onEpochEnd(t, e) {
    e == null && (e = {});
    for (const s of this.callbacks)
      await s.onEpochEnd(t, e);
  }
  /**
   * Called  right before processing a batch.
   * @param batch Index of batch within the current epoch.
   * @param logs Dictionary of logs.
   */
  async onBatchBegin(t, e) {
    e == null && (e = {});
    for (const s of this.callbacks)
      await s.onBatchBegin(t, e);
  }
  /**
   * Called at the end of a batch.
   * @param batch Index of batch within the current epoch.
   * @param logs Dictionary of logs.
   */
  async onBatchEnd(t, e) {
    e == null && (e = {});
    for (const s of this.callbacks)
      await s.onBatchEnd(t, e);
  }
  /**
   * Called at the beginning of training.
   * @param logs Dictionary of logs.
   */
  async onTrainBegin(t) {
    t == null && (t = {});
    for (const e of this.callbacks)
      await e.onTrainBegin(t);
  }
  /**
   * Called at the end of training.
   * @param logs Dictionary of logs.
   */
  async onTrainEnd(t) {
    t == null && (t = {});
    for (const e of this.callbacks)
      await e.onTrainEnd(t);
  }
}
class Nw extends Es {
  constructor() {
    super();
  }
  async onEpochBegin(t) {
    this.seen = 0, this.totals = {};
  }
  async onBatchEnd(t, e) {
    e == null && (e = {});
    const s = e.size == null ? 0 : e.size;
    this.seen += s;
    for (const r in e) {
      const o = e[r];
      if (typeof o == "number")
        this.totals.hasOwnProperty(r) || (this.totals[r] = 0), this.totals[r] = this.totals[r] + o * s;
      else {
        let i;
        r in this.totals ? i = this.totals[r] : this.totals[r] = 0;
        const a = _(() => M(this.totals[r], N(o, s)));
        this.totals[r] = a, i != null && i.dispose();
      }
    }
  }
  async onEpochEnd(t, e) {
    if (e != null)
      for (const s of this.params.metrics)
        this.totals[s] != null && (typeof this.totals[s] == "number" ? e[s] = this.totals[s] / this.seen : _(() => {
          const r = N(Y(1, this.seen), this.totals[s]);
          e[s] = r, this.totals[s].dispose(), Pn(e[s]);
        }));
  }
}
class Dw extends Es {
  async onTrainBegin(t) {
    this.epoch = [], this.history = {};
  }
  async onEpochEnd(t, e) {
    e == null && (e = {}), this.epoch.push(t);
    for (const s in e)
      this.history[s] == null && (this.history[s] = []), this.history[s].push(e[s]);
  }
  /**
   * Await the values of all losses and metrics.
   */
  async syncData() {
    const t = [], e = [], s = [];
    for (const o in this.history) {
      const i = this.history[o];
      for (let a = 0; a < i.length; ++a)
        if (typeof i[a] != "number") {
          const l = i[a];
          t.push(l.data()), e.push(o), s.push(a);
        }
    }
    const r = await Promise.all(t);
    for (let o = 0; o < r.length; ++o)
      this.history[e[o]][s[o]].dispose(), this.history[e[o]][s[o]] = r[o][0];
  }
}
class Pw extends Es {
  constructor(t, e) {
    if (super(), this.currentEpoch = 0, this.nowFunc = t.nowFunc, this.nextFrameFunc = t.nextFrameFunc || cy, this.yieldEvery = e || "auto", this.yieldEvery === "auto" && (this.yieldEvery = kw), this.yieldEvery === "never" && t.onYield != null)
      throw new Error("yieldEvery is `never` but you provided an `onYield` callback. Either change `yieldEvery` or remove the callback");
    Co(this.yieldEvery) && (this.maybeWait = Wy(this.maybeWait.bind(this), this.yieldEvery, this.nowFunc)), this.trainBegin = t.onTrainBegin, this.trainEnd = t.onTrainEnd, this.epochBegin = t.onEpochBegin, this.epochEnd = t.onEpochEnd, this.batchBegin = t.onBatchBegin, this.batchEnd = t.onBatchEnd, this.yield = t.onYield;
  }
  async maybeWait(t, e, s) {
    const r = [];
    this.yield != null && (await Ye(s), r.push(this.yield(t, e, s))), r.push(this.nextFrameFunc()), await Promise.all(r);
  }
  async onEpochBegin(t, e) {
    this.currentEpoch = t, this.epochBegin != null && (await Ye(e), await this.epochBegin(t, e));
  }
  async onEpochEnd(t, e) {
    const s = [];
    this.epochEnd != null && (await Ye(e), s.push(this.epochEnd(t, e))), this.yieldEvery === "epoch" && s.push(this.nextFrameFunc()), await Promise.all(s);
  }
  async onBatchBegin(t, e) {
    this.batchBegin != null && (await Ye(e), await this.batchBegin(t, e));
  }
  async onBatchEnd(t, e) {
    const s = [];
    this.batchEnd != null && (await Ye(e), s.push(this.batchEnd(t, e))), this.yieldEvery === "batch" ? s.push(this.nextFrameFunc()) : Co(this.yieldEvery) && s.push(this.maybeWait(this.currentEpoch, t, e)), await Promise.all(s);
  }
  async onTrainBegin(t) {
    this.trainBegin != null && (await Ye(t), await this.trainBegin(t));
  }
  async onTrainEnd(t) {
    this.trainEnd != null && (await Ye(t), await this.trainEnd(t));
  }
}
function hh(n, t) {
  return n == null && (n = {}), n instanceof Es ? [n] : Array.isArray(n) && n[0] instanceof Es ? n : st(n).map((s) => new Pw(s, t));
}
class Qt {
  /**
   * Blocks public access to constructor.
   */
  constructor() {
  }
  /**
   * Register a tf.LayersModel.fit() callback constructor.
   *
   * The registered callback constructor will be used to instantiate
   * callbacks for every tf.LayersModel.fit() call afterwards.
   *
   * @param verbosityLevel Level of verbosity at which the `callbackConstructor`
   *   is to be reigstered.
   * @param callbackConstructor A no-arg constructor for `tf.Callback`.
   * @throws Error, if the same callbackConstructor has been registered before,
   *   either at the same or a different `verbosityLevel`.
   */
  static registerCallbackConstructor(t, e) {
    w(t >= 0 && Number.isInteger(t), () => `Verbosity level is expected to be an integer >= 0, but got ${t}`), Qt.checkForDuplicate(e), Qt.constructors[t] == null && (Qt.constructors[t] = []), Qt.constructors[t].push(e);
  }
  static checkForDuplicate(t) {
    for (const e in Qt.constructors)
      Qt.constructors[+e].forEach((r) => {
        if (r === t)
          throw new I("Duplicate callback constructor.");
      });
  }
  /**
   * Clear all registered callback constructors.
   */
  static clear() {
    Qt.constructors = {};
  }
  /**
   * Create callbacks using the registered callback constructors.
   *
   * Given `verbosityLevel`, all constructors registered at that level or above
   * will be called and the instantiated callbacks will be used.
   *
   * @param verbosityLevel: Level of verbosity.
   */
  static createCallbacks(t) {
    const e = [];
    for (const s in Qt.constructors) {
      const r = +s;
      t >= r && e.push(...Qt.constructors[r]);
    }
    return e.map((s) => new s());
  }
}
Qt.constructors = {};
function fh(n, t, e, s, r, o, i, a, l) {
  const u = new Dw(), c = [
    new Nw(),
    ...Qt.createCallbacks(t)
  ];
  n != null && c.push(...n), c.push(u);
  const h = new Tw(c);
  return h.setParams({
    epochs: e,
    initialEpoch: s,
    samples: r,
    steps: o,
    batchSize: i,
    verbose: t,
    doValidation: a,
    metrics: l
  }), { callbackList: h, history: u };
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function dh(n, t = {}, e = !1) {
  return Ns(n, te.getMap().classNameMap, t, "layer", e);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function ph(n, t) {
  return _(() => {
    const e = N(0.5, Du(t)), s = ec(ks(t, e), n.dtype);
    return St(mn(n, s), -1);
  });
}
function mh(n, t) {
  return _(() => ec(mn(hr(n, -1), hr(t, -1)), "float32"));
}
function Rw(n, t) {
  return _(() => ot(et(qr(mn(n, 1), mn(t, 1))), "float32"));
}
function Lw(n, t) {
  return _(() => ot(et(qr(mn(n, 0), mn(t, 1))), "float32"));
}
function Ow(n, t) {
  return _(() => {
    const e = Rw(n, t), s = Lw(n, t), r = M(e, s);
    return ot(on(ks(r, 0), Y(e, r), 0), "float32");
  });
}
function Mw(n, t) {
  return Xr(n, t);
}
function Bw(n, t) {
  return n.rank === t.rank && (n = jr(n, [n.rank - 1])), t = hr(t, -1), t.dtype !== n.dtype && (t = ot(t, n.dtype)), ot(mn(n, t), "float32");
}
const Fw = Yr, zw = Yr, Uw = ji, Ww = ji, Gw = Hi, Vw = Hi, gh = As, qw = sh, bh = Er, Cr = {
  binaryAccuracy: ph,
  categoricalAccuracy: mh,
  precision: Ow,
  categoricalCrossentropy: gh,
  sparseCategoricalCrossentropy: bh,
  mse: Fw,
  MSE: zw,
  mae: Uw,
  MAE: Ww,
  mape: Gw,
  MAPE: Vw,
  cosine: qw
};
function jw(n) {
  if (typeof n == "string" && n in Cr)
    return Cr[n];
  if (typeof n != "string" && n != null)
    return n;
  throw new I(`Unknown metric ${n}`);
}
function qs(n) {
  if (Ae(n !== null, `Unknown LossOrMetricFn ${n}`), typeof n == "string")
    return n;
  {
    let t;
    for (const e of Object.keys(_r))
      if (_r[e] === n) {
        t = e;
        break;
      }
    if (t !== void 0)
      return t;
    for (const e of Object.keys(Cr))
      if (Cr[e] === n) {
        t = e;
        break;
      }
    return t !== void 0 ? t : n.name;
  }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Hw(n) {
  const t = {
    Adagrad: () => In.adagrad(0.01),
    Adadelta: () => In.adadelta(1, 0.95, mt()),
    Adam: () => In.adam(1e-3, 0.9, 0.999, mt()),
    Adamax: () => In.adamax(2e-3, 0.9, 0.999, mt(), 0),
    RMSProp: () => In.rmsprop(1e-3, 0.9, 0, mt()),
    SGD: () => In.sgd(0.01)
  };
  if (t.adagrad = t.Adagrad, t.adadelta = t.Adadelta, t.adam = t.Adam, t.adamax = t.Adamax, t.rmsprop = t.RMSProp, t.sgd = t.SGD, n in t)
    return t[n]();
  throw new I(`Unknown Optimizer ${n}`);
}
/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const Ja = 1 * 1024 * 1024;
function Za(n, t, e = !1) {
  if (n == null || typeof n != "object" || Object.getPrototypeOf(n) !== Object.prototype || !jo(n))
    throw new Error("User-defined metadata is expected to be a JSON object, but is not.");
  if (e) {
    const s = JSON.stringify(n);
    s.length > Ja && console.warn(`User-defined metadata of model "${t}" is too large in size (length=${s.length} when serialized). It is not recommended to store such large objects in user-defined metadata. Please make sure its serialized length is <= ${Ja}.`);
  }
}
function jo(n) {
  if (n === null)
    return !0;
  if (typeof n == "object")
    if (Object.getPrototypeOf(n) === Object.prototype) {
      const t = Object.keys(n);
      for (const e of t)
        if (typeof e != "string" || !jo(n[e]))
          return !1;
      return !0;
    } else if (Array.isArray(n)) {
      for (const t of n)
        if (!jo(t))
          return !1;
      return !0;
    } else
      return !1;
  else {
    const t = typeof n;
    return t === "string" || t === "number" || t === "boolean";
  }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function Kw(n, t, e, s = console.log) {
  const r = Xw(n), o = ["Layer (type)", "Input Shape", "Output shape", "Param #"];
  r ? (t = t || 90, e = e || [0.32, 0.61, 0.89, 1]) : (t = t || 115, e = e || [0.24, 0.48, 0.7, 0.8, 1]), e[e.length - 1] <= 1 && (e = e.map((c) => Math.floor(t * c)));
  let i;
  if (!r) {
    o.push("Receives inputs"), i = [];
    for (const c in n.nodesByDepth)
      i.push(...n.nodesByDepth[c]);
  }
  s("_".repeat(t)), kr(o, e, s), s("=".repeat(t));
  const a = n.layers;
  for (let c = 0; c < a.length; ++c)
    r ? Jw(a[c], e, s) : Zw(a[c], e, i, s), s((c === a.length - 1 ? "=" : "_").repeat(t));
  n.checkTrainableWeightsConsistency();
  const l = Yw(n), u = $r(n.nonTrainableWeights);
  s(`Total params: ${l + u}`), s(`Trainable params: ${l}`), s(`Non-trainable params: ${u}`), s("_".repeat(t));
}
function Yw(n) {
  let t;
  return n.collectedTrainableWeights != null ? t = $r(n.collectedTrainableWeights) : t = $r(n.trainableWeights), t;
}
function Xw(n) {
  let t = !0;
  const e = [], s = [];
  for (const r in n.nodesByDepth)
    e.push(n.nodesByDepth[r]);
  for (const r of e) {
    if (r.length > 1 || r.length === 1 && r[0].inboundLayers.length > 1) {
      t = !1;
      break;
    }
    s.push(...r);
  }
  if (t)
    for (const r of n.layers) {
      let o = !1;
      for (const i of r.inboundNodes)
        if (s.indexOf(i) !== -1)
          if (o) {
            t = !1;
            break;
          } else
            o = !0;
      if (!t)
        break;
    }
  return t;
}
function kr(n, t, e = console.log) {
  let s = "";
  for (let r = 0; r < n.length; ++r)
    r > 0 && (s = s.slice(0, s.length - 1) + " "), s += n[r], s = s.slice(0, t[r]), s += " ".repeat(t[r] - s.length);
  e(s);
}
function Jw(n, t, e) {
  let s, r;
  try {
    r = n.inboundNodes.map((l) => JSON.stringify(l.inputShapes)).join(",");
  } catch {
    r = "multiple";
  }
  try {
    s = JSON.stringify(n.outputShape);
  } catch {
    s = "multiple";
  }
  const o = n.name, i = n.getClassName(), a = [
    `${o} (${i})`,
    r,
    s,
    n.countParams().toString()
  ];
  kr(a, t, e);
}
function Zw(n, t, e, s) {
  let r, o;
  try {
    o = n.inboundNodes.map((h) => JSON.stringify(h.inputShapes)).join(",");
  } catch {
    o = "multiple";
  }
  try {
    r = JSON.stringify(n.outputShape);
  } catch {
    r = "multiple";
  }
  const i = [];
  for (const h of n.inboundNodes)
    if (!(e != null && e.length > 0 && e.indexOf(h) === -1))
      for (let f = 0; f < h.inboundLayers.length; ++f) {
        const d = h.inboundLayers[f].name, p = h.nodeIndices[f], g = h.tensorIndices[f];
        i.push(`${d}[${p}][${g}]`);
      }
  const a = n.name, l = n.getClassName(), u = i.length === 0 ? "" : i[0], c = [
    `${a} (${l})`,
    o,
    r,
    n.countParams().toString(),
    u
  ];
  kr(c, t, s);
  for (let h = 1; h < i.length; ++h)
    kr(["", "", "", "", i[h]], t, s);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function yh(n, t, e) {
  return (n === "inboundNodes" || n === "outputLayers" || n === "inputLayers") && t === 0 && typeof e == "string";
}
function Ho(n, t) {
  if (n === null)
    return null;
  if (typeof n == "string")
    return Qe(n);
  if (typeof n == "number" || typeof n == "boolean")
    return n;
  if (n instanceof Array) {
    const e = [], s = n.length;
    for (let r = 0; r < s; ++r) {
      const o = n[r];
      yh(t, r, o) ? e.push(o) : e.push(Ho(o, t));
    }
    return e;
  } else {
    const e = {};
    for (const s of Object.keys(n)) {
      const r = n[s];
      if (s === "name" && typeof r == "string")
        e[s] = r;
      else {
        const o = Qe(s);
        e[o] = Ho(r, o);
      }
    }
    return e;
  }
}
function Ko(n, t) {
  if (n == null)
    return null;
  if (typeof n == "string")
    return Pe(n);
  if (typeof n == "number" || typeof n == "boolean")
    return n;
  if (n instanceof Array) {
    const e = [], s = n.length;
    for (let r = 0; r < s; ++r) {
      const o = n[r];
      yh(t, r, o) ? e.push(o) : e.push(Ko(o, t));
    }
    return e;
  } else {
    const e = {};
    for (const s of Object.keys(n)) {
      const r = n[s], o = Pe(s);
      (s === "name" || s === "className") && typeof r == "string" ? e[o] = r : e[o] = Ko(r, s);
    }
    return e;
  }
}
/** @license See the LICENSE file. */
const wh = "4.20.0";
/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class xh {
  constructor(t) {
    this.maxEntries = t || 100, this.cache = /* @__PURE__ */ new Map();
  }
  /**
   * Get the entry for the key and mark it as used recently.
   */
  get(t) {
    let e;
    return this.cache.has(t) && (e = this.cache.get(t), this.cache.delete(t), this.cache.set(t, e)), e;
  }
  /**
   * Put the entry into the cache. If the key already existed, mark the key as
   * used recently.
   */
  put(t, e) {
    if (this.cache.has(t))
      this.cache.delete(t);
    else if (this.cache.size >= this.maxEntries) {
      const s = this.cache.keys().next().value;
      this.cache.delete(s);
    }
    this.cache.set(t, e);
  }
  /**
   * Get the MaxEntries of the cache.
   */
  getMaxEntries() {
    return this.maxEntries;
  }
  /**
   * Set the MaxEntries of the cache. If the maxEntries is decreased, reduce
   * entries in the cache.
   */
  setMaxEntries(t) {
    if (t < 0)
      throw new Error(`The maxEntries of LRU caches must be at least 0, but got ${t}.`);
    if (this.maxEntries > t)
      for (let e = 0; e < this.maxEntries - t; e++) {
        const s = this.cache.keys().next().value;
        this.cache.delete(s);
      }
    this.maxEntries = t;
  }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
class Os extends ye {
  constructor(t) {
    if (super({
      dtype: t.dtype,
      name: t.name != null ? t.name : Li("input").toString()
    }), t.batchSize == null && (t.batchSize = null), t.sparse == null && (t.sparse = !1), this.trainable = !1, this.built = !0, this.sparse = t.sparse, t.inputShape != null && t.batchInputShape != null)
      throw new I("Only provide the inputShape OR batchInputShape argument to inputLayer, not both at the same time.");
    let e = t.batchInputShape;
    if (e == null) {
      if (t.inputShape == null)
        throw new I("An InputLayer should be passed either a `batchInputShape` or an `inputShape`.");
      e = [t.batchSize].concat(t.inputShape);
    } else if (t.batchSize != null)
      throw new I("Cannot specify batchSize if batchInputShape is specified when creating an InputLayer.");
    const s = t.dtype || "float32";
    this.batchInputShape = e, this.dtype = s, this.inputSpec = [{ shape: e }];
    const r = new bn(this.dtype, this.batchInputShape, this, [], {}, this.name);
    r.nodeIndex = 0, r.tensorIndex = 0, new Wi({
      outboundLayer: this,
      inboundLayers: [],
      nodeIndices: [],
      tensorIndices: [],
      inputTensors: [r],
      outputTensors: [r],
      inputMasks: [null],
      outputMasks: [null],
      inputShapes: [e],
      outputShapes: [e]
    });
  }
  apply(t, e) {
    throw new I(`Cannot pass any input to an InputLayer's apply() method. InputLayer name: ${this.name}`);
  }
  dispose() {
    return { refCountAfterDispose: this._refCount, numDisposedVariables: 0 };
  }
  getConfig() {
    return {
      batchInputShape: this.batchInputShape,
      dtype: this.dtype,
      sparse: this.sparse,
      name: this.name
    };
  }
}
Os.className = "InputLayer";
O(Os);
function Qw(n) {
  if (n.batchShape == null && n.shape == null)
    throw new Error("Please provide to Input either a `shape` or a `batchShape` argument. Note that `shape` does not include the batch dimension.");
  if (n.batchShape != null && n.shape != null)
    throw new I("Please provide either a `shape` or `batchShape` argument to Input, but not both.");
  let t = n.batchShape;
  n.shape != null && t == null && (t = [null].concat(n.shape));
  let e = n.dtype;
  return e == null && (e = "float32"), new Os({
    batchInputShape: t,
    name: n.name,
    dtype: e,
    sparse: n.sparse
  }).inboundNodes[0].outputTensors[0];
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function t1(n, t) {
  if (n.dtype == null || n.dtype === t.dtype)
    return t;
  try {
    return ot(t, n.dtype);
  } catch {
    throw new I(`The dtype of the feed (${t.dtype}) can not be cast to the dtype of the key '${n.name}' (${n.dtype}).`);
  }
}
class Ue {
  /**
   * Constructor, optionally does copy-construction.
   * @param feeds An Array of `Feed`s, or another `FeedDict`, in which case
   *   copy-construction will be performed.
   */
  constructor(t) {
    if (this.id2Value = {}, this.id2Mask = {}, this.name2Id = {}, t instanceof Ue)
      for (const e in t.id2Value)
        this.id2Value[e] = t.id2Value[e], e in t.id2Mask && (this.id2Mask[e] = t.id2Mask[e]);
    else {
      if (t == null)
        return;
      for (const e of t)
        this.add(e.key, e.value);
    }
  }
  /**
   * Add a key-value pair to the FeedDict.
   *
   * @param key The key of the feed.
   * @param value The value of the tensor feed.
   * @param mask The value of the mask feed (optional).
   * @returns This `FeedDict`.
   * @throws ValueError: If the key `SymbolicTensor` already exists in the
   *   `FeedDict`.
   */
  add(t, e, s) {
    if (this.id2Value[t.id] == null)
      this.id2Value[t.id] = t1(t, e), this.name2Id[t.name] = t.id, s != null && (this.id2Mask[t.id] = s);
    else
      throw new I(`Duplicate key: name=${t.name}, id=${t.id}`);
    return this;
  }
  /**
   * Add a Feed to the FeedDict.
   * @param feed The new `Feed` to add.
   * @returns This `FeedDict`.
   */
  addFeed(t) {
    this.add(t.key, t.value);
  }
  /**
   * Probe whether a key already exists in the FeedDict.
   * @param key
   */
  hasKey(t) {
    return this.id2Value[t.id] != null;
  }
  /**
   * Get all the SymbolicTensor available in this FeedDict.
   */
  names() {
    return Object.keys(this.name2Id);
  }
  /**
   * Get the feed value for given key.
   * @param key The SymbolicTensor, or its name (as a string), of which the
   *     value is sought.
   * @returns If `key` exists, the corresponding feed value.
   * @throws ValueError: If `key` does not exist in this `FeedDict`.
   */
  getValue(t) {
    if (t instanceof bn) {
      if (this.id2Value[t.id] == null)
        throw new I(`Nonexistent key: ${t.name}`);
      return this.id2Value[t.id];
    } else {
      const e = this.name2Id[t];
      if (e == null)
        throw new I(`Feed dict has no SymbolicTensor name: ${t}`);
      return this.id2Value[e];
    }
  }
  /**
   * Get the feed mask for given key.
   * @param key The SymbolicTensor, or its name (as a string), of which the
   *     value is sought.
   * @returns If `key` exists, the corresponding feed mask.
   * @throws ValueError: If `key` does not exist in this `FeedDict`.
   */
  getMask(t) {
    if (t instanceof bn) {
      if (this.id2Value[t.id] == null)
        throw new I(`Nonexistent key: ${t.name}`);
      return this.id2Mask[t.id];
    } else {
      const e = this.name2Id[t];
      if (e == null)
        throw new I(`Feed dict has no SymbolicTensor name: ${t}`);
      return this.id2Mask[e];
    }
  }
  /** Dispose all mask Tensors held by this object. */
  disposeMasks() {
    this.id2Mask != null && ut(this.id2Mask);
  }
}
const Qa = new xh(), tl = new xh();
function cs(n, t, e, s) {
  const r = e == null ? !1 : e.training, o = Array.isArray(n), i = o ? n : [n], a = i.map((p) => p.name), l = [], u = t.names();
  for (const p of a)
    u.indexOf(p) !== -1 ? l.push(t.getValue(p)) : l.push(null);
  const c = a.join(",") + "|" + t.names().sort().join(",");
  let h = Qa.get(c), f;
  if (h == null) {
    const p = e1(i, t);
    h = p.sorted, f = p.recipientCounts, Qa.put(c, h), tl.put(c, f);
  }
  f = {}, r || Object.assign(f, tl.get(c));
  const d = new Ue(t);
  for (let p = 0; p < h.length; ++p) {
    const g = h[p], m = g.sourceLayer;
    if (m instanceof Os)
      continue;
    const b = [], y = [], S = [];
    let x = !1;
    for (const T of g.inputs) {
      const R = d.getValue(T), B = d.getMask(T);
      b.push(R), y.push(B), B != null && (x = !0), r || (f[T.name]--, f[T.name] === 0 && !t.hasKey(T) && a.indexOf(T.name) === -1 && !R.isDisposed && T.sourceLayer.stateful !== !0 && S.push(R));
    }
    x && (e = e || {}, e.mask = y[0]);
    const v = st(m.apply(b, e));
    let E = null;
    m.supportsMasking && (E = m.computeMask(b, y));
    const D = s1(g), k = Array.isArray(D) ? D : [D];
    for (let T = 0; T < k.length; ++T) {
      d.hasKey(k[T]) || d.add(k[T], v[T], Array.isArray(E) ? E[0] : E);
      const R = a.indexOf(k[T].name);
      R !== -1 && (l[R] = v[T]);
    }
    r || ut(S);
  }
  return d.disposeMasks(), o ? l : l[0];
}
function e1(n, t) {
  w(n != null && n.length > 0, () => "Expected at least one fetch, got none");
  let e = [], s = {};
  if (n.length === 1) {
    const r = el(n[0], t);
    e = r.sorted, s = r.recipientMap;
  } else {
    const r = /* @__PURE__ */ new Set();
    for (const o of n) {
      const { sorted: i, recipientMap: a } = el(o, t);
      for (const l of i)
        r.has(l.name) || (e.push(l), r.add(l.name));
      for (const l in a)
        s[l] == null && (s[l] = /* @__PURE__ */ new Set()), a[l].forEach((u) => s[l].add(u));
    }
  }
  return {
    sorted: e,
    recipientCounts: n1(s)
  };
}
function n1(n) {
  const t = {};
  for (const e in n)
    t[e] = n[e].size;
  return t;
}
function el(n, t) {
  const e = /* @__PURE__ */ new Set(), s = [], r = {};
  for (const a of t.names())
    e.add(a);
  const o = [], i = [];
  for (o.push(n); o.length > 0; ) {
    const a = o[o.length - 1];
    if (e.has(a.name)) {
      o.pop();
      continue;
    }
    const l = i[i.length - 1] === o.length - 1;
    if (a.inputs.length === 0 || l)
      o.pop(), s.push(a), e.add(a.name), l && i.pop();
    else {
      i.push(o.length - 1);
      for (const u of a.inputs)
        r[u.name] == null && (r[u.name] = /* @__PURE__ */ new Set()), r[u.name].add(a.name), !e.has(u.name) && o.push(u);
    }
  }
  return { sorted: s, recipientMap: r };
}
function s1(n) {
  let t;
  if (n.sourceLayer.inboundNodes.length === 1)
    t = n.sourceLayer.output;
  else {
    let e = null;
    for (let s = 0; s < n.sourceLayer.inboundNodes.length; ++s)
      for (const r of n.sourceLayer.inboundNodes[s].outputTensors)
        if (r.id === n.id) {
          e = s;
          break;
        }
    t = n.sourceLayer.getOutputAt(e);
  }
  return t;
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const r1 = (n) => {
  const t = Object.keys(n);
  if (t.length === 0)
    return !1;
  const e = t[0].split("/");
  return !isNaN(parseInt(e[e.length - 1], 10));
};
class fe extends ye {
  constructor(t) {
    if (super({}), this.containerNodes = /* @__PURE__ */ new Set(), this.name = t.name, this.name == null) {
      const y = this.getClassName().toLowerCase();
      this.name = Li(y);
    }
    if (this.supportsMasking = !1, this.trainable_ = !0, Array.isArray(t.inputs) ? this.inputs = t.inputs.slice() : this.inputs = [t.inputs], Array.isArray(t.outputs) ? this.outputs = t.outputs.slice() : this.outputs = [t.outputs], an(this.inputs).length !== this.inputs.length)
      throw new I(`The list of inputs passed to the model is redundant. All inputs should only appear once. Found: ${this.inputs.map((y) => y.name)}`);
    an(this.outputs).length !== this.outputs.length && console.warn(`The list of outputs passed to the model is redundant. All outputs should only appear once. Found: ${this.outputs.map((y) => y.name)}`), this.inputLayers = [], this.inputLayersNodeIndices = [], this.inputLayersTensorIndices = [], this.outputLayers = [], this.outputLayersNodeIndices = [], this.outputLayersTensorIndices = [], this.layers = [], this.internalContainerRefs = [];
    for (const y of this.outputs) {
      const S = y.sourceLayer, x = y.nodeIndex, v = y.tensorIndex;
      this.outputLayers.push(S), this.outputLayersNodeIndices.push(x), this.outputLayersTensorIndices.push(v);
    }
    for (const y of this.inputs) {
      const S = y.sourceLayer, x = y.nodeIndex, v = y.tensorIndex;
      Ae(x === 0, "input layer has >1 nodes"), Ae(v === 0, "input layer has >1 tensors"), this.inputLayers.push(S), this.inputLayersNodeIndices.push(x), this.inputLayersTensorIndices.push(v);
    }
    this.inputNames = [], this.outputNames = [], this.feedInputShapes = [], this.feedInputNames = [], this.feedOutputNames = [];
    for (let y = 0; y < this.inputLayers.length; y++) {
      const S = this.inputLayers[y];
      if (!(S instanceof Os))
        throw new TypeError(`Input layers to a LayersModel must be InputLayer objects. Received inputs: ${t.inputs}. Input ${y} (0-based) originates from layer type ${S.getClassName()}.`);
      this.inputNames.push(S.name), this.feedInputShapes.push(S.batchInputShape), this.feedInputNames.push(S.name);
    }
    for (const y of this.outputLayers)
      this.outputNames.push(y.name);
    this.internalInputShapes = this.inputs.map((y) => y.shape), this.internalOutputShapes = this.outputs.map((y) => y.shape);
    const e = {}, s = {}, r = {}, o = {}, i = {}, a = [], l = (y, S, x, v, E, D) => {
      (v == null || E == null || D == null) && (v = y.sourceLayer, E = y.nodeIndex, D = y.tensorIndex);
      const k = v.inboundNodes[E];
      if (x.indexOf(k) !== -1)
        throw new qe(`The tensor ${y.name} at layer "${v.name}" is part of a cycle.`);
      if (S.indexOf(k) !== -1)
        return;
      this.containerNodes.add(fe.nodeKey(v, E)), v.id in i || (i[v.id] = Object.keys(i).length), x.indexOf(k) === -1 && x.push(k);
      const T = k.inboundLayers.length;
      for (let R = 0; R < T; R++) {
        const B = k.inputTensors[R], H = k.inboundLayers[R], X = k.nodeIndices[R], W = k.tensorIndices[R];
        l(B, S, x, H, X, W);
      }
      for (S.push(k); x.indexOf(k) >= 0; )
        x.splice(x.indexOf(k), 1);
      a.push(k);
    }, u = [], c = [];
    for (const y of this.outputs)
      l(y, u, c);
    const h = a.slice().reverse();
    for (const y of h) {
      s[y.id] = y, y.id in e || (e[y.id] = 0);
      let S = e[y.id];
      const x = r[y.outboundLayer.id] == null ? 0 : r[y.outboundLayer.id];
      S = Math.max(S, x), r[y.outboundLayer.id] = S, o[y.outboundLayer.id] = y.outboundLayer, e[y.id] = S;
      for (let v = 0; v < y.inboundLayers.length; v++) {
        const E = y.inboundLayers[v], D = y.nodeIndices[v], k = E.inboundNodes[D], T = e[k.id] == null ? 0 : e[k.id];
        e[k.id] = Math.max(S + 1, T), s[k.id] = k;
      }
    }
    const f = {};
    for (const y in e) {
      const S = e[y];
      S in f || (f[S] = []), f[S].push(s[y]);
    }
    const d = {};
    for (const y in r) {
      const S = r[y];
      S in d || (d[S] = []), d[S].push(o[y]);
    }
    let p = Object.keys(d).map((y) => parseInt(y, 10)).sort(Ws);
    this.layers = [];
    for (const y of p) {
      const S = d[y];
      S.sort((x, v) => {
        const E = i[x.id], D = i[v.id];
        return E < D ? -1 : E > D ? 1 : 0;
      });
      for (const x of S)
        x instanceof fe && this.internalContainerRefs.push(x), this.layers.push(x);
    }
    this.layersByDepth = d, p = Object.keys(f).map((y) => parseInt(y, 10)).sort(Ws);
    const g = this.inputs.slice(), m = [];
    for (const y of p)
      for (const S of f[y]) {
        const x = S.outboundLayer;
        if (x != null) {
          for (const v of S.inputTensors)
            if (g.indexOf(v) === -1)
              throw new qe(`Graph disconnected: cannot obtain value for tensor ${v} at layer "${x.name}". The following previous layers were accessed without issue: ${m}`);
          for (const v of S.outputTensors)
            g.push(v);
          m.push(x.name);
        }
      }
    this.nodesByDepth = f;
    const b = this.layers.map((y) => y.name);
    for (const y of b) {
      const S = b.filter((x) => x === y).length;
      if (S !== 1)
        throw new qe(`The name "${y}" is used ${S} times in the model. All layer names should be unique. Layer names: ` + JSON.stringify(b));
    }
    this.outboundNodes = [], this.inboundNodes = [], new Wi({
      outboundLayer: this,
      inboundLayers: [],
      nodeIndices: [],
      tensorIndices: [],
      inputTensors: this.inputs,
      outputTensors: this.outputs,
      inputMasks: this.inputs.map((y) => null),
      outputMasks: this.outputs.map((y) => null),
      inputShapes: this.inputs.map((y) => y.shape),
      outputShapes: this.outputs.map((y) => y.shape)
    }), this.built = !0, this._refCount = 1;
  }
  assertNotDisposed() {
    if (this._refCount === 0)
      throw new Error(`Container '${this.name}' is already disposed.`);
  }
  /**
   * Attempt to dispose a LayersModel's weights.
   *
   * This method decrease the reference count of the LayersModel object by 1.
   *
   * A LayersModel is reference-counted. Its reference count is incremented by 1
   * when it is first constructed and when it is used as a Layer of another
   * LayersModel.
   *
   * If the reference count of a LayersModel becomes 0, the `dispose` method of
   * all its constituent `Layer`s will be called.
   *
   * Note: If the reference count is greater than 0 after the decrement, the
   * `dispose` method of its constituent `Layer`s will *not* be called.
   *
   * After a LayersModel is disposed, it cannot be used in calls such as
   * 'predict`, `evaluate` or `fit` anymore.
   *
   * @returns A DisposeResult Object with the following fields:
   *   - refCountAfterDispose: The reference count of the LayersModel after this
   *     `dispose()` call.
   *   - numDisposedVariables: Number of `tf.Variable`s (i.e., weights) disposed
   *     during this `dispose()` call.
   * @throws {Error} If the layer is not built yet, or if the LayersModel has
   *   already been disposed.
   */
  dispose() {
    this.assertNotDisposed();
    const t = { refCountAfterDispose: null, numDisposedVariables: 0 };
    if (--this._refCount === 0) {
      for (const e of this.layers)
        t.numDisposedVariables += e.dispose().numDisposedVariables;
      for (const e of this.internalContainerRefs)
        t.numDisposedVariables += e.dispose().numDisposedVariables;
    }
    return t.refCountAfterDispose = this._refCount, t;
  }
  get trainable() {
    return this.trainable_;
  }
  set trainable(t) {
    this.layers.forEach((e) => {
      e._trainableWeights.forEach((s) => s.trainable = t);
    }), this.trainable_ = t;
  }
  get trainableWeights() {
    if (this._trainableWeights.length > 0)
      throw new I("Container instance unexpectedly contains _trainableWeights.The trainable weights of a Container are a union of the trainable weights of its consituent Layers. Its own _trainableWeights must remain an empty Array.");
    if (!this.trainable)
      return [];
    let t = [];
    for (const e of this.layers)
      t = t.concat(e.trainableWeights);
    return t;
  }
  get nonTrainableWeights() {
    const t = [];
    for (const e of this.layers)
      t.push(...e.nonTrainableWeights);
    if (!this.trainable) {
      const e = [];
      for (const s of this.layers)
        e.push(...s.trainableWeights);
      return e.concat(t);
    }
    return t;
  }
  get weights() {
    return this.trainableWeights.concat(this.nonTrainableWeights);
  }
  /**
   * Loads all layer weights from a JSON object.
   *
   * Porting Note: HDF5 weight files cannot be directly loaded in JavaScript /
   *   TypeScript. The utility script at `scripts/pykeras.py` offers means
   *   to convert them into JSON strings compatible with this method.
   * Porting Note: TensorFlow.js Layers supports only loading by name currently.
   *
   * @param weights A JSON mapping weight names to weight values as nested
   *   arrays of numbers, or a `NamedTensorMap`, i.e., a JSON mapping weight
   *   names to `tf.Tensor` objects.
   * @param strict Require that the provided weights exactly match those
   *   required by the container.  Default: `true`.  Passing `false` means that
   *   extra weights and missing weights will be silently ignored.
   */
  loadWeights(t, e = !0) {
    const s = {};
    let r = 0;
    const o = r1(t);
    o && this.parseWeights(t);
    for (const a of this.layers)
      for (const [l, u] of a.weights.entries()) {
        const c = o ? `${u.name.split("/").slice(0, -1).join("/") + "/"}${l}` : u.originalName;
        if (s[c] != null)
          throw new I(`Duplicate weight name: ${c}`);
        s[c] = u, r++;
      }
    const i = [];
    for (const a in t) {
      let l = a;
      if (s[a] == null) {
        const u = a.split("/");
        l = u.slice(0, -2).concat([u[u.length - 1]]).join("/");
      }
      if (s[l] != null)
        i.push([s[l], t[a]]);
      else if (e)
        throw new I(`Provided weight data has no target variable: ${a}`);
      delete s[l];
    }
    if (e) {
      const a = [];
      for (const l in s)
        a.push(l);
      if (a.length > 0)
        throw new I(`${a.length} of ${r} weights are not set: ${a}`);
    }
    Dc(i);
  }
  parseWeights(t) {
    for (const e in Object.keys(t)) {
      const s = e.split("/"), r = ["vars", "layer_checkpoint_dependencies"], o = s.map((i) => i.startsWith("_") ? i.slice(1) : i).filter((i) => !r.includes(i)).join("/");
      o !== e && (t[o] = t[e], delete t[e]);
    }
  }
  /**
   * Util shared between different serialization methods.
   * @returns LayersModel config with Keras version information added.
   */
  updatedConfig() {
    const t = this.getConfig(), e = {};
    return e.className = this.getClassName(), e.config = t, e.kerasVersion = `tfjs-layers ${wh}`, e.backend = "TensorFlow.js", e;
  }
  /**
   * Returns a JSON string containing the network configuration.
   *
   * To load a network from a JSON save file, use
   * models.modelFromJSON(jsonString);
   * @param extraJsonArgs Unused in tfjs-layers, maintained for PyKeras
   * @param returnString Whether the return value should be stringified
   *    (default: `true`).
   * @returns a JSON string if `returnString` (default), or a JSON object if
   *   `!returnString`.
   */
  // tslint:disable-next-line:no-any
  toJSON(t, e = !0) {
    const s = Ko(this.updatedConfig());
    return e ? JSON.stringify(s) : s;
  }
  /**
   * Call the model on new inputs.
   *
   * In this case `call` just reapplies all ops in the graph to the new inputs
   * (e.g. build a new computational graph from the provided inputs).
   *
   * @param inputs A tensor or list of tensors.
   * @param mask A mask or list of masks. A mask can be either a tensor or null
   *   (no mask).
   *
   * @return A tensor if there is a single output, or a list of tensors if there
   *   are more than one outputs.
   */
  call(t, e) {
    return _(() => {
      t = st(t);
      const s = new Ue();
      for (let r = 0; r < this.inputs.length; ++r)
        s.add(this.inputs[r], t[r]);
      return cs(this.outputs, s, e);
    });
  }
  /**
   * Computes an output mask tensor.
   *
   * @param inputs Tensor or list of tensors.
   * @param mask Tensor or list of tensors.
   *
   * @return null or a tensor (or list of tensors, one per output tensor of the
   * layer).
   */
  computeMask(t, e) {
    return _(() => {
      t = st(t);
      let s;
      return e == null ? s = yr(null, t.length) : s = st(e), this.runInternalGraph(t, s)[1];
    });
  }
  /**
   * Computes the output shape of the layer.
   *
   * Assumes that the layer will be built to match that input shape provided.
   *
   * @param inputShape A shape (tuple of integers) or a list of shape tuples
   *   (one per output tensor of the layer). Shape tuples can include null for
   *   free dimensions, instead of an integer.
   */
  computeOutputShape(t) {
    const e = Ir(t);
    if (e.length !== this.inputLayers.length)
      throw new I(`Invalid inputShape argument ${t}: model has ${this.inputLayers.length} tensor inputs.`);
    const s = {};
    for (let a = 0; a < e.length; a++) {
      const l = this.inputLayers[a], u = e[a], c = l.name + "_0_0";
      s[c] = u;
    }
    const r = Object.keys(this.nodesByDepth).map((a) => parseInt(a, 10)).sort(Ws);
    if (r.length > 1)
      for (const a of r) {
        const l = this.nodesByDepth[a];
        for (const u of l) {
          const c = u.outboundLayer;
          if (this.inputLayers.map((g) => g.id).indexOf(c.id) !== -1)
            continue;
          const h = [];
          for (let g = 0; g < u.inboundLayers.length; g++) {
            const m = u.inboundLayers[g], b = u.nodeIndices[g], y = u.tensorIndices[g], S = `${m.name}_${b}_${y}`, x = s[S];
            h.push(x);
          }
          const f = c.computeOutputShape(zt(h)), d = Ir(f), p = c.inboundNodes.indexOf(u);
          for (let g = 0; g < d.length; g++) {
            const m = `${c.name}_${p}_${g}`;
            s[m] = d[g];
          }
        }
      }
    const o = [], i = [];
    for (let a = 0; a < this.outputLayers.length; a++) {
      const l = this.outputLayers[a], u = this.outputLayersNodeIndices[a], c = this.outputLayersTensorIndices[a], h = `${l.name}_${u}_${c}`;
      i.push(h);
    }
    for (let a = 0; a < i.length; a++) {
      const l = i[a];
      Ae(l in s), o.push(s[l]);
    }
    return zt(o);
  }
  /**
   * Computes output tensors for new inputs.
   *
   * Note:
   *   - Expects `inputs` to be a list (potentially with 1 element).
   *
   * @param inputs List of tensors
   * @param masks List of masks (tensors or null).
   * @return Three lists: outputTensors, outputMasks, outputShapes
   */
  runInternalGraph(t, e) {
    e == null && (e = yr(null, t.length));
    const s = {};
    for (let l = 0; l < this.inputs.length; ++l) {
      const u = this.inputs[l], c = t[l], h = e[l];
      s[u.id] = [c, h];
    }
    const r = Object.keys(this.nodesByDepth).map((l) => parseInt(l, 10)).sort(Ws);
    for (const l of r) {
      const u = this.nodesByDepth[l];
      for (const c of u) {
        const h = c.outboundLayer, f = c.inputTensors, d = c.outputTensors, p = new Array();
        for (const g of f)
          g.id in s && p.push(s[g.id]);
        if (p.length === f.length) {
          let g = {}, m, b, y, S;
          if (c.callArgs != null && (g = c.callArgs), p.length === 1) {
            const [x, v] = p[0];
            g.mask == null && (g.mask = v), y = st(h.call(x, g)), S = st(h.computeMask(x, v)), m = [x], b = [v];
          } else
            m = p.map((x) => x[0]), b = p.map((x) => x[1]), g.mask == null && (g.mask = b), y = st(h.call(m, g)), S = st(h.computeMask(m, b));
          if (h.activityRegularizer)
            throw new J("LayersModel invocation with concrete Tensor value(s) in the presence of activity regularizer(s) is not supported yet.");
          for (let x = 0; x < d.length; ++x) {
            const v = d[x], E = y[x], D = S[x];
            s[v.id] = [E, D];
          }
        }
      }
    }
    const o = [], i = [], a = [];
    for (const l of this.outputs) {
      Ae(l.id in s, `Could not compute output ${l.name} : ${l.id}`);
      const [u, c] = s[l.id];
      a.push(u.shape), o.push(u), i.push(c);
    }
    return [o, i, a];
  }
  /**
   * Builds a map of internal node keys to node ordering.
   * Used in serializaion a node orderings may change as unused nodes are
   * dropped. Porting Note:  This helper method was pulled out of getConfig to
   * improve readability.
   * @param layers An array of Layers in the model.
   * @returns Map of Node Keys to index order within the layer.
   */
  buildNodeConversionMap(t) {
    const e = {};
    let s;
    for (const r of this.layers) {
      s = r instanceof fe ? 1 : 0;
      for (let o = 0; o < r.inboundNodes.length; o++) {
        const i = fe.nodeKey(r, o);
        this.containerNodes.has(i) && (e[i] = s, s += 1);
      }
    }
    return e;
  }
  getLayer(t, e) {
    if (e != null)
      return this.findLayer(e);
    if (t == null)
      throw new I("Provide either a layer name or layer index");
    if (typeof t == "number")
      return this.findLayer(t);
    for (const s of this.layers)
      if (s.name === t)
        return s;
    throw new I(`No such layer: ${t}`);
  }
  findLayer(t) {
    if (this.layers.length <= t)
      throw new I(`Was asked to retrieve layer at index ${t}, but model only has ${this.layers.length} layer(s).`);
    return this.layers[t];
  }
  /**
   * Retrieves the Container's current loss values.
   *
   * Used for regularizers during training.
   */
  calculateLosses() {
    return _(() => {
      const t = [];
      for (const e of this.layers)
        for (let s = 0; s < e.inboundNodes.length; ++s) {
          const r = fe.nodeKey(e, s);
          this.containerNodes.has(r) && t.push(...e.calculateLosses());
        }
      return t;
    });
  }
  getConfig() {
    const t = { name: this.name }, e = this.buildNodeConversionMap(this.layers), s = [];
    for (const i of this.layers) {
      const a = i.getClassName(), l = i.getConfig(), u = [];
      for (let h = 0; h < i.inboundNodes.length; h++) {
        const f = i.inboundNodes[h], d = fe.nodeKey(i, h);
        let p = {};
        if (this.containerNodes.has(d)) {
          if (f.callArgs)
            try {
              JSON.stringify(f.callArgs), p = f.callArgs;
            } catch {
              console.warn(`Layer ${i.name} was passed non-serializable keyword arguments: ${f.callArgs}. They will not be included in the serialized model (and thus will be missing at deserialization time).`), p = {};
            }
          if (f.inboundLayers.length > 0) {
            const g = [];
            for (let m = 0; m < f.inboundLayers.length; m++) {
              const b = f.inboundLayers[m], y = f.nodeIndices[m], S = f.tensorIndices[m], x = fe.nodeKey(b, y);
              let v = e[x];
              v == null && (v = 0), g.push([b.name, v, S, p]);
            }
            u.push(g);
          }
        }
      }
      const c = {};
      c.name = i.name, c.className = a, c.config = l, c.inboundNodes = u, s.push(c);
    }
    t.layers = s;
    const r = [];
    for (let i = 0; i < this.inputLayers.length; i++) {
      const a = this.inputLayers[i], l = this.inputLayersNodeIndices[i], u = fe.nodeKey(a, l);
      if (!this.containerNodes.has(u))
        continue;
      let c = e[u];
      c == null && (c = 0);
      const h = this.inputLayersTensorIndices[i];
      r.push([a.name, c, h]);
    }
    t.inputLayers = r;
    const o = [];
    for (let i = 0; i < this.outputLayers.length; i++) {
      const a = this.outputLayers[i], l = this.outputLayersNodeIndices[i], u = fe.nodeKey(a, l);
      if (!this.containerNodes.has(u))
        continue;
      let c = e[u];
      c == null && (c = 0);
      const h = this.outputLayersTensorIndices[i];
      o.push([a.name, c, h]);
    }
    return t.outputLayers = o, t;
  }
  /**
   * Instantiates a LayersModel from its config (output of `get_config()`).
   * @param cls the class to create
   * @param config LayersModel config dictionary.
   * @param customObjects An optional dictionary of custom objects.
   * @param fastWeightInit Optional flag to use fast weight initialization
   *   during deserialization. This is applicable to cases in which
   *   the initialization will be immediately overwritten by loaded weight
   *   values. Default: `false`.
   * @returns A LayersModel instance.
   * @throws ValueError: In case of improperly formatted config dict.
   */
  /** @nocollapse */
  static fromConfig(t, e, s = {}, r = !1) {
    const o = {}, i = {};
    function a(m, b) {
      m.name in i ? i[m.name].push(b) : i[m.name] = [b];
    }
    function l(m, b) {
      const y = [];
      let S;
      for (const x of b) {
        const v = x[0], E = x[1], D = x[2];
        if (S = x[3] == null ? {} : x[3], !(v in o)) {
          a(m, b);
          return;
        }
        const k = o[v];
        if (k.inboundNodes.length <= E) {
          a(m, b);
          return;
        }
        const T = k.inboundNodes[E];
        y.push(T.outputTensors[D]);
      }
      y.length > 0 && m.apply(zt(y), S);
    }
    function u(m) {
      const b = m.name, y = dh(m, e.customObjects != null ? e.customObjects : {});
      y.setFastWeightInitDuringBuild(r), o[b] = y, m.inboundNodes.forEach((x) => {
        if (!(x instanceof Array))
          throw new I(`Corrupted configuration, expected array for nodeData: ${x}`);
        a(y, x);
      });
    }
    const c = e.name, h = e.layers;
    for (const m of h)
      u(m);
    for (; !Uy(i); )
      for (const m of h) {
        const b = o[m.name];
        if (b.name in i) {
          const y = i[b.name];
          delete i[b.name];
          for (const S of y)
            l(b, S);
        }
      }
    const f = [], d = [], p = e.inputLayers;
    for (const m of p) {
      const b = m[0], y = m[1], S = m[2];
      Ae(b in o);
      const v = o[b].inboundNodes[y].outputTensors;
      f.push(v[S]);
    }
    const g = e.outputLayers;
    for (const m of g) {
      const b = m[0], y = m[1], S = m[2];
      Ae(b in o);
      const v = o[b].inboundNodes[y].outputTensors;
      d.push(v[S]);
    }
    return new t({ inputs: f, outputs: d, name: c });
  }
  /**
   * Determine whether the container is stateful.
   *
   * Porting Note: this is the equivalent of the stateful @property of
   *   the Container class in PyKeras.
   */
  get stateful() {
    if (this._stateful)
      throw new I("Container instance unexpectedly has _stateful = true. The statefulness of a Container is determined by the Layers it contains. Its _stateful property must remain the default false.");
    for (const t of this.layers)
      if (t.stateful)
        return !0;
    return !1;
  }
  /**
   * Reset the state of all stateful constituent layers (if any).
   *
   * Examples of stateful layers include RNN layers whose `stateful` property
   * is set as `true`.
   */
  resetStates() {
    _(() => {
      this.layers.forEach((t) => {
        t.stateful && t.resetStates();
      });
    });
  }
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function o1(n, t, e) {
  const s = t.length;
  if (n == null || Array.isArray(n) && n.length === 0)
    return t.map((r) => null);
  if (s === 1)
    return Array.isArray(n) && n.length === 1 ? n : typeof n == "object" && t[0] in n ? [n[t[0]]] : [n];
  if (Array.isArray(n)) {
    if (n.length !== s)
      throw new Error(`Provided ${e} is an array of ${n.length} element(s), but the model has ${s} outputs. Make sure a set of weights is provided for each model output.`);
    return n;
  } else if (typeof n == "object" && Object.keys(n).length > 0 && typeof n[Object.keys(n)[0]] == "object") {
    const r = [];
    return t.forEach((o) => {
      o in n ? r.push(n[o]) : r.push(null);
    }), r;
  } else
    throw new Error(`The model has multiple (${s}) outputs, so ${e} must be either an array with ${s} elements or an object with ${t} keys. Provided ${e} not understood: ${JSON.stringify(n)}`);
}
function Sh(n, t) {
  return o1(n, t, "classWeight");
}
async function vh(n, t, e, s) {
  if (e != null) {
    const r = _(() => {
      if (n.shape.length === 1)
        return sn(n);
      if (n.shape.length === 2) {
        if (n.shape[1] > 1)
          return hr(n, 1);
        if (n.shape[1] === 1)
          return L(n, [n.shape[0]]);
        throw new Error(`Encountered unexpected last-dimension size (${n.shape[1]}) during handling of class weights. The size is expected to be >= 1.`);
      } else
        throw new Error(`Unexpected rank of target (y) tensor (${n.rank}) during handling of class weights. The rank is expected to be 1 or 2.`);
    }), o = Array.from(await r.data());
    ut(r);
    const i = [];
    return o.forEach((a) => {
      if (e[a] == null)
        throw new Error(`classWeight must contain all classes in the training data. The class ${a} exists in the data but not in classWeight`);
      i.push(e[a]);
    }), Dt(i, "float32");
  } else
    return null;
}
function i1(n, t) {
  return N(n, t);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
const a1 = 32;
function Ih(n, t) {
  let e, s;
  const r = t;
  e = r.xs, s = r.ys, w(e != null && s != null, () => `A Dataset iterator for fitDataset() is expected to generate objects of the form \`{xs: xVal, ys: yVal}\`, where the two values may be \`tf.Tensor\`, an array of Tensors, or a map of string to Tensor.  The provided Dataset instead generates ${t}`);
  const o = nl("input", n.inputNames, e), i = nl("output", n.outputNames, s), a = o[0].shape[0];
  w(o.length === n.inputs.length, () => `LayersModel has ${n.inputs.length} inputs, but the dataset provides ${o.length} inputs.  (Expected input keys: ${JSON.stringify(n.inputNames)})`), w(i.length === n.outputs.length, () => `LayersModel has ${n.outputs.length} outputs, but the dataset provides ${i.length} outputs.  (Expected output keys: ${JSON.stringify(n.outputNames)})`);
  for (let l = 0; l < o.length; l++)
    w(o[l].shape[0] === a, () => `Batch size mismatch: input ${n.inputNames[l]} has ${o[l].shape[0]}; expected  ${a} based on input ${n.inputNames[0]}.`);
  for (let l = 0; l < i.length; l++)
    w(i[l].shape[0] === a, () => `Batch size mismatch: output ${n.outputNames[l]} has ${i[l].shape[0]}; expected  ${a} based on input ${n.inputNames[0]}.`);
  return { xs: o, ys: i };
}
function nl(n, t, e) {
  if (e instanceof Et)
    return [e];
  if (Array.isArray(e))
    return w(e.length === t.length, () => `Received an array of ${e.length} Tensors, but expected ${t.length} to match the ${n} keys ${t}.`), e;
  {
    const s = [];
    for (const r of t) {
      if (e[r] == null)
        throw new I(`The feature data generated by the dataset lacks the required ${n} key '${r}'.`);
      s.push(e[r]);
    }
    return s;
  }
}
function l1(n) {
  if (n.length === 3)
    throw new J("Validation with sample weights is not implemented yet.");
  return { xs: n[0], ys: n[1] };
}
async function u1(n, t, e) {
  const s = e.batchesPerEpoch != null;
  if (w(n.optimizer != null, () => "You must compile a model before training/testing. Use LayersModel.compile(modelCompileConfig)."), w(e != null, () => "For fitDataset(), the 2nd argument (config) is required, but it is not provided in this call."), w(e.epochs != null && e.epochs > 0 && Number.isInteger(e.epochs), () => `For fitDataset(), config.epochs is expected to be a positive integer, but got ${e.epochs}`), w(!s || e.batchesPerEpoch > 0 && Number.isInteger(e.batchesPerEpoch), () => `For fitDataset(), config.batchesPerEpoch is expected to be a positive integer if specified, but got ${e.batchesPerEpoch}`), w(
    // tslint:disable-next-line:no-any
    e.validationSplit == null,
    () => "`validationSplit` is not supported by `fitDataset()`. Use validationData instead."
  ), n.isTraining)
    throw new Error("Cannot start training because another fit() call is ongoing.");
  n.isTraining = !0;
  try {
    const r = e.validationData != null;
    let o, i;
    if (r)
      if (sl(e.validationData))
        w(e.validationBatches == null || e.validationBatches > 0 && Number.isInteger(e.validationBatches), () => `For fitDataset() with dataset-based validation, config.validationBatches is expected not to be provided, or to be a positive integer, but got ${e.validationBatches}`);
      else {
        const m = l1(e.validationData);
        o = m.xs, i = m.ys;
      }
    const a = n.makeTrainFunction(), l = n.getDedupedMetricsNames();
    let u;
    r ? u = l.slice().concat(l.map((m) => "val_" + m)) : u = l.slice();
    const c = hh(e.callbacks, e.yieldEvery), h = e.verbose == null ? 1 : e.verbose, { callbackList: f, history: d } = fh(
      c,
      h,
      e.epochs,
      null,
      null,
      c1(t, e),
      null,
      // Batch size determined by the dataset itself.
      r,
      u
    );
    f.setModel(n), n.history = d, await f.onTrainBegin(), n.stopTraining_ = !1;
    let p = e.initialEpoch == null ? 0 : e.initialEpoch, g = await t.iterator();
    for (; p < e.epochs; ) {
      const m = {};
      await f.onEpochBegin(p);
      let b = 0, y = 0;
      for (s || (g = await t.iterator()); !s || b < e.batchesPerEpoch; ) {
        const S = await g.next();
        if (s && S.done) {
          console.warn(`You provided \`batchesPerEpoch\` as ${e.batchesPerEpoch}, but your dataset iterator ran out of data after ${b} batches; interrupting training. Make sure that your dataset can generate at least \`batchesPerEpoch * epochs\` batches (in this case, ${e.batchesPerEpoch * e.epochs} batches). You may need to use the repeat() function when building your dataset.`);
          break;
        }
        if (S.value != null) {
          const { xs: x, ys: v } = Ih(n, S.value), E = {};
          E.batch = y, E.size = x[0].shape[0], await f.onBatchBegin(y, E);
          const D = [];
          if (e.classWeight != null) {
            const R = Sh(e.classWeight, n.outputNames);
            for (let B = 0; B < R.length; ++B)
              D.push(await vh(v[B], null, R[B]));
          }
          const k = x.concat(v).concat(D), T = a(k);
          ut(k);
          for (let R = 0; R < l.length; ++R) {
            const B = l[R], H = T[R];
            E[B] = H, Pn(H);
          }
          await f.onBatchEnd(y, E), ch(E), y++, b++;
        }
        if (s ? b >= e.batchesPerEpoch : S.done) {
          if (r) {
            let x;
            sl(e.validationData) ? x = st(await n.evaluateDataset(e.validationData, { batches: e.validationBatches })) : x = st(n.evaluate(o, i, {
              batchSize: e.validationBatchSize == null ? a1 : e.validationBatchSize,
              verbose: 0
            }));
            for (let v = 0; v < n.metricsNames.length; ++v)
              m[`val_${n.metricsNames[v]}`] = x[v];
          }
          break;
        }
        if (n.stopTraining_)
          break;
      }
      if (await f.onEpochEnd(p, m), p++, n.stopTraining_)
        break;
    }
    return await f.onTrainEnd(), await n.history.syncData(), n.history;
  } finally {
    n.isTraining = !1;
  }
}
function c1(n, t) {
  let e = null;
  return t.batchesPerEpoch != null ? e = t.batchesPerEpoch : Number.isFinite(n.size) && (e = n.size), e;
}
function sl(n) {
  return typeof n.iterator == "function";
}
function h1(n) {
  return typeof n.next == "function";
}
async function f1(n, t, e) {
  e = e || {};
  const s = e.batches != null, r = n.testFunction;
  let o = [];
  if (e.verbose > 0)
    throw new J("Verbose mode is not implemented yet.");
  w(!s || e.batches > 0 && Number.isInteger(e.batches), () => `Test loop expects \`batches\` to be a positive integer, but received ${JSON.stringify(e.batches)}`);
  const i = h1(t) ? t : await t.iterator();
  let a = 0, l = 0;
  for (; !s || l < e.batches; ) {
    const u = await i.next();
    if (o = _(() => {
      if (u.value) {
        const { xs: c, ys: h } = Ih(n, u.value), f = c.concat(h), d = _(() => r(f));
        if (ut(f), l === 0)
          for (let g = 0; g < d.length; ++g)
            o.push(Yt(0));
        const p = f[0].shape[0];
        for (let g = 0; g < d.length; ++g) {
          const m = d[g], b = o[g];
          o[g] = _(() => M(o[g], N(p, m))), l > 0 && ut(b);
        }
        ut(d), a += p, ++l;
      }
      return o;
    }), u.done) {
      s && console.warn(`Your dataset iterator ran out of data during evaluateDataset(). Interrupting evalution. Make sure that your dataset can generate at least \`batches\` batches (in this case, ${e.batches} batches). You may need to use the repeat() function when building your dataset.`);
      break;
    }
  }
  for (let u = 0; u < o.length; ++u) {
    const c = o[u];
    o[u] = Y(o[u], a), ut(c);
  }
  return zt(o);
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function yo(n) {
  w(n > 0 && Number.isInteger(n), () => `batchSize is required to be a positive integer, but got ${n}`);
}
function is(n, t, e) {
  return n == null ? [null] : Array.isArray(n) ? n.map((s) => ln(s, t, e - t)) : ln(n, t, e - t);
}
function Yo(n, t) {
  return _(() => n == null ? null : Array.isArray(n) ? n.map((e) => Yo(e, t)) : Xy(n, t.dtype === "int32" ? t : ot(t, "int32")));
}
function wo(n, t) {
  const e = [];
  let s = 0, r = null;
  for (; s < n; )
    r = s + t, r >= n && (r = n), e.push([s, r]), s = r;
  return e;
}
function $h(n) {
  const t = [];
  n instanceof Et && (n = [n]);
  for (let e = 0; e < n.length; ++e) {
    const s = n[e];
    if (s.rank === 1)
      t.push(Pi(s, 1));
    else {
      if (s.rank === 0)
        throw new Error("Expected tensor to be at least 1D, but received a 0D tensor (scalar).");
      t.push(s);
    }
  }
  return t;
}
function ue(n, t) {
  if (n == null)
    return;
  const e = [];
  if (t instanceof Et)
    e.push(t.id);
  else if (Array.isArray(t))
    t.forEach((r) => e.push(r.id));
  else if (t != null)
    for (const r in t) {
      const o = t[r];
      e.push(o.id);
    }
  const s = [];
  if (n instanceof Et)
    e.indexOf(n.id) === -1 && s.push(n);
  else if (Array.isArray(n))
    n.forEach((r) => {
      e.indexOf(r.id) === -1 && s.push(r);
    });
  else if (n != null)
    for (const r in n) {
      const o = n[r];
      e.indexOf(o.id) === -1 && s.push(o);
    }
  s.forEach((r) => {
    r.isDisposed || r.dispose();
  });
}
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 * =============================================================================
 */
function d1(n) {
  return n instanceof Et;
}
function Xo(n) {
  return Array.isArray(n);
}
function rl(n) {
  return !d1(n) && !Xo(n);
}
function ol(n, t, e, s = !0, r = "") {
  if (t == null || t.length === 0) {
    if (n != null) {
      let i = !1;
      if (Xo(n) && n.length > 0)
        i = !0;
      else if (rl(n)) {
        for (const a in n)
          if (n.hasOwnProperty(a)) {
            i = !0;
            break;
          }
      } else
        i = !0;
      if (i)
        throw new I(`Error when checking model ${r} expected no data, but got ${n}`);
    }
    return [];
  }
  if (n == null)
    return t.map((i) => null);
  let o;
  if (rl(n)) {
    n = n, o = [];
    for (const i of t) {
      if (n[i] == null)
        throw new I(`No data provided for "${i}". Need data for each key in: ${t}`);
      o.push(n[i]);
    }
  } else if (Xo(n)) {
    if (n = n, n.length !== t.length)
      throw new I(`Error when checking model ${r}: the Array of Tensors that you are passing to your model is not the size the model expected. Expected to see ${t.length} Tensor(s), but instead got the following list of Tensor(s): ${n}`);
    o = n;
  } else {
    if (n = n, t.length > 1)
      throw new I(`The model ${r} expects ${t.length} Tensor(s), but only received one Tensor. Found: Tensor with shape ${n.shape}`);
    o = [n];
  }
  if (o = $h(o), e != null)
    for (let i = 0; i < t.length; ++i) {
      if (e[i] == null)
        continue;
      const a = o[i];
      if (a.shape.length !== e[i].length)
        throw new I(`Error when checking ${r}: expected ${t[i]} to have ${e[i].length} dimension(s). but got array with shape ${a.shape}`);
      for (let l = 0; l < e[i].length; ++l) {
        if (l === 0 && !s)
          continue;
        const u = a.shape[l], c = e[i][l];
        if (c != null && c >= 0 && u !== c)
          throw new I(`${r} expected a batch of elements where each example has shape [${e[i].slice(1, e[i].length)}] (i.e.,tensor shape [*,${e[i].slice(1, e[i].length)}]) but the ${r} received an input with ${a.shape[0]} examples, each with shape [${a.shape.slice(1, a.shape.length)}] (tensor shape [${a.shape}])`);
      }
    }
  return o;
}
function p1(n, t, e) {
  const s = an(n.map((o) => o.shape[0]));
  s.sort();
  const r = an(t.map((o) => o.shape[0]));
  if (r.sort(), s.length > 1)
    throw new I(`All input Tensors (x) should have the same number of samples. Got array shapes: ${JSON.stringify(n.map((o) => o.shape))}`);
  if (r.length > 1)
    throw new I(`All target Tensors (y) should have the same number of samples. Got array shapes: ${JSON.stringify(t.map((o) => o.shape))}`);
  if (s.length > 0 && r.length > 0 && !oe(s, r))
    throw new I(`Input Tensors should have the same number of samples as target Tensors. Found ${s[0]} input sample(s) and ${r[0]} target sample(s).`);
}
function m1(n, t, e) {
  const s = [
    Yr,
    Xr,
    As
  ];
  for (let r = 0; r < n.length; ++r) {
    const o = n[r], i = t[r], a = e[r];
    if (i != null) {
      if (i === As && o.shape[o.shape.length - 1] === 1)
        throw new I(`You are passing a target array of shape ${o.shape} while using a loss 'categorical_crossentropy'. 'categorical_crossentropy'expects targets to be binary matrices (1s and 0s) of shape [samples, classes].`);
      if (s.indexOf(i) !== -1) {
        const l = o.shape.slice(1), u = a.slice(1);
        for (let c = 0; c < l.length; ++c) {
          const h = l[c], f = u[c];
          if (f != null && h !== f)
            throw new I(`A target Tensor with shape ${o.shape} was passed for an output of shape ${a}, while using a loss function that expects targets to have the same shape as the output.`);
        }
      }
    }
  }
}
function il(n, t, e, s = !0, r = "") {
  let o;
  if (Array.isArray(n)) {
    if (n.length !== t.length)
      throw new I(`Error when checking model ${r}: the Array of Tensors that you are passing to your model is not the size the the model expected. Expected to see ${t.length} Tensor(s), but instead got ${n.length} Tensors(s).`);
    o = n;
  } else {
    if (t.length > 1)
      throw new I(`The model expects ${t.length} ${r} Tensors, but only received one Tensor. Found: array with shape ${JSON.stringify(n.shape)}.`);
    o = [n];
  }
  if (e != null)
    for (let i = 0; i < t.length; ++i) {
      if (e[i] == null)
        continue;
      const a = o[i];
      if (a.shape.length !== e[i].length)
        throw new I(`Error when checking ${r}: expected ${t[i]} to have ${e[i].length} dimension(s), but got array with shape ${JSON.stringify(a.shape)}`);
      for (let l = 0; l < e[i].length; ++l) {
        if (l === 0 && !s)
          continue;
        const u = a.shape[l], c = e[i][l];
        if (c != null && c !== u)
          throw new I(`Error when checking ${r}: expected ${t[i]} to have shape ${JSON.stringify(e[i])} but got array with shape ${JSON.stringify(a.shape)}.`);
      }
    }
}
function g1(n, t) {
  if (n == null || Array.isArray(n) && n.length === 0)
    return t.map((s) => []);
  let e;
  if (typeof n == "string" || typeof n == "function")
    e = [n];
  else if (Array.isArray(n) || typeof n == "object")
    e = n;
  else
    throw new TypeError(`Type of metrics argument not understood. Expected an string,function, Array, or Object, found: ${n}`);
  if (Array.isArray(e))
    return t.map((s) => e);
  {
    const s = [];
    for (const r of t) {
      let o = e.hasOwnProperty(r) ? e[r] : [];
      Array.isArray(o) || (o = [o]), s.push(o);
    }
    return s;
  }
}
const b1 = "layers-model";
class Jr extends fe {
  constructor(t) {
    super(t), this.isTraining = !1;
  }
  /**
   * Print a text summary of the model's layers.
   *
   * The summary includes
   * - Name and type of all layers that comprise the model.
   * - Output shape(s) of the layers
   * - Number of weight parameters of each layer
   * - If the model has non-sequential-like topology, the inputs each layer
   *   receives
   * - The total number of trainable and non-trainable parameters of the model.
   *
   * ```js
   * const input1 = tf.input({shape: [10]});
   * const input2 = tf.input({shape: [20]});
   * const dense1 = tf.layers.dense({units: 4}).apply(input1);
   * const dense2 = tf.layers.dense({units: 8}).apply(input2);
   * const concat = tf.layers.concatenate().apply([dense1, dense2]);
   * const output =
   *     tf.layers.dense({units: 3, activation: 'softmax'}).apply(concat);
   *
   * const model = tf.model({inputs: [input1, input2], outputs: output});
   * model.summary();
   * ```
   *
   * @param lineLength Custom line length, in number of characters.
   * @param positions Custom widths of each of the columns, as either
   *   fractions of `lineLength` (e.g., `[0.5, 0.75, 1]`) or absolute number
   *   of characters (e.g., `[30, 50, 65]`). Each number corresponds to
   *   right-most (i.e., ending) position of a column.
   * @param printFn Custom print function. Can be used to replace the default
   *   `console.log`. For example, you can use `x => {}` to mute the printed
   *   messages in the console.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  summary(t, e, s = console.log) {
    if (!this.built)
      throw new I("This model has never been called, thus its weights have not been created yet. So no summary can be displayed. Build the model first (e.g., by calling it on some test data).");
    Kw(this, t, e, s);
  }
  /**
   * Configures and prepares the model for training and evaluation.  Compiling
   * outfits the model with an optimizer, loss, and/or metrics.  Calling `fit`
   * or `evaluate` on an un-compiled model will throw an error.
   *
   * @param args a `ModelCompileArgs` specifying the loss, optimizer, and
   * metrics to be used for fitting and evaluating this model.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  compile(t) {
    if (t.loss == null && (t.loss = []), this.loss = t.loss, typeof t.optimizer == "string")
      this.optimizer_ = Hw(t.optimizer), this.isOptimizerOwned = !0;
    else {
      if (!(t.optimizer instanceof Ke))
        throw new I("User-defined optimizer must be an instance of tf.Optimizer.");
      this.optimizer_ = t.optimizer, this.isOptimizerOwned = !1;
    }
    let e = [];
    if (!Array.isArray(t.loss) && typeof t.loss != "string" && typeof t.loss != "function") {
      t.loss = t.loss;
      for (const i in t.loss)
        if (this.outputNames.indexOf(i) === -1)
          throw new I(`Unknown entry in loss dictionary: "${i}". Only expected the following keys: ${this.outputNames}`);
      for (const i of this.outputNames)
        t.loss[i] == null && console.warn(`Output "${i}" is missing from loss dictionary. We assume this was done on purpose, and we will not be expecting data to be passed to ${i} during training`), e.push(bo(t.loss[i]));
    } else if (Array.isArray(t.loss)) {
      if (t.loss.length !== this.outputs.length)
        throw new I(`When passing an Array as loss, it should have one entry per model output. The model has ${this.outputs.length} output(s), but you passed loss=${t.loss}.`);
      e = t.loss.map((a) => bo(a));
    } else {
      const i = bo(t.loss);
      this.outputs.forEach((a) => {
        e.push(i);
      });
    }
    this.lossFunctions = e, this.feedOutputNames = [], this.feedOutputShapes = [], this.feedLossFns = [];
    for (let i = 0; i < this.outputs.length; ++i) {
      const a = this.internalOutputShapes[i], l = this.outputNames[i];
      this.feedOutputNames.push(l), this.feedOutputShapes.push(a), this.feedLossFns.push(this.lossFunctions[i]);
    }
    const s = [];
    this.metrics = t.metrics, this.metricsNames = ["loss"], this.metricsTensors = [], or("loss", () => {
      for (let i = 0; i < this.outputs.length; ++i) {
        if (s.indexOf(i) !== -1)
          continue;
        const a = this.lossFunctions[i];
        this.outputs.length > 1 && (this.metricsTensors.push([a, i]), this.metricsNames.push(this.outputNames[i] + "_loss"));
      }
    });
    const r = g1(t.metrics, this.outputNames), o = (i, a, l) => {
      this.outputNames.length > 1 && (a = this.outputNames[i] + "_" + a), this.metricsNames.push(a), this.metricsTensors.push([l, i]);
    };
    or("metric", () => {
      for (let i = 0; i < this.outputs.length; ++i) {
        if (s.indexOf(i) !== -1)
          continue;
        const a = r[i];
        ((u) => {
          const c = "";
          let h, f, d;
          for (const p of u) {
            if (typeof p == "string" && ["accuracy", "acc", "crossentropy", "ce"].indexOf(p) !== -1) {
              const m = this.internalOutputShapes[i];
              m[m.length - 1] === 1 || this.lossFunctions[i] === Xr ? ["accuracy", "acc"].indexOf(p) !== -1 ? f = ph : ["crossentropy", "ce"].indexOf(p) !== -1 && (f = Mw) : this.lossFunctions[i] === Er ? ["accuracy", "acc"].indexOf(p) !== -1 ? f = Bw : ["crossentropy", "ce"].indexOf(p) !== -1 && (f = bh) : ["accuracy", "acc"].indexOf(p) !== -1 ? f = mh : ["crossentropy", "ce"].indexOf(p) !== -1 && (f = gh);
              let b;
              ["accuracy", "acc"].indexOf(p) !== -1 ? b = "acc" : ["crossentropy", "ce"].indexOf(p) !== -1 && (b = "ce"), d = f, h = c + b;
            } else
              d = jw(p), h = c + qs(p);
            let g;
            or(h, () => {
              g = d;
            }), o(i, h, g);
          }
        })(a);
      }
    }), this.collectedTrainableWeights = this.trainableWeights;
  }
  /**
   * Check trainable weights count consistency.
   *
   * This will raise a warning if `this.trainableWeights` and
   * `this.collectedTrainableWeights` are inconsistent (i.e., have different
   * numbers of parameters).
   * Inconsistency will typically arise when one modifies `model.trainable`
   * without calling `model.compile()` again.
   */
  checkTrainableWeightsConsistency() {
    this.collectedTrainableWeights != null && this.trainableWeights.length !== this.collectedTrainableWeights.length && console.warn("Discrepancy between trainableweights and collected trainable weights. Did you set `model.trainable` without calling `model.compile()` afterwards?");
  }
  /**
   * Returns the loss value & metrics values for the model in test mode.
   *
   * Loss and metrics are specified during `compile()`, which needs to happen
   * before calls to `evaluate()`.
   *
   * Computation is done in batches.
   *
   * ```js
   * const model = tf.sequential({
   *   layers: [tf.layers.dense({units: 1, inputShape: [10]})]
   * });
   * model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
   * const result = model.evaluate(
   *     tf.ones([8, 10]), tf.ones([8, 1]), {batchSize: 4});
   * result.print();
   * ```
   *
   * @param x `tf.Tensor` of test data, or an `Array` of `tf.Tensor`s if the
   * model has multiple inputs.
   * @param y `tf.Tensor` of target data, or an `Array` of `tf.Tensor`s if the
   * model has multiple outputs.
   * @param args A `ModelEvaluateArgs`, containing optional fields.
   *
   * @return `Scalar` test loss (if the model has a single output and no
   *   metrics) or `Array` of `Scalar`s (if the model has multiple outputs
   *   and/or metrics). The attribute `model.metricsNames`
   *   will give you the display labels for the scalar outputs.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  evaluate(t, e, s = {}) {
    const r = s.batchSize == null ? 32 : s.batchSize;
    yo(r);
    const i = this.standardizeUserDataXY(t, e, !0, r);
    try {
      const a = i[0].concat(i[1]);
      this.makeTestFunction();
      const l = this.testFunction, u = this.testLoop(l, a, r, s.verbose, s.steps);
      return zt(u);
    } finally {
      ue(i[0], t), ue(i[1], e);
    }
  }
  // TODO(cais): Add code snippet below once real dataset objects are
  //   available.
  /**
   * Evaluate model using a dataset object.
   *
   * Note: Unlike `evaluate()`, this method is asynchronous (`async`).
   *
   * @param dataset A dataset object. Its `iterator()` method is expected
   *   to generate a dataset iterator object, the `next()` method of which
   *   is expected to produce data batches for evaluation. The return value
   *   of the `next()` call ought to contain a boolean `done` field and a
   *   `value` field. The `value` field is expected to be an array of two
   *   `tf.Tensor`s or an array of two nested `tf.Tensor` structures. The former
   *   case is for models with exactly one input and one output (e.g.
   *   a sequential model). The latter case is for models with multiple
   *   inputs and/or multiple outputs. Of the two items in the array, the
   *   first is the input feature(s) and the second is the output target(s).
   * @param args A configuration object for the dataset-based evaluation.
   * @returns Loss and metric values as an Array of `Scalar` objects.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  async evaluateDataset(t, e) {
    return this.makeTestFunction(), f1(this, t, e);
  }
  /**
   * Get number of samples provided for training, evaluation or prediction.
   *
   * @param ins Input `tf.Tensor`.
   * @param batchSize Integer batch size, optional.
   * @param steps Total number of steps (batches of samples) before
   * declaring loop finished. Optional.
   * @param stepsName The public API's parameter name for `steps`.
   * @returns Number of samples provided.
   */
  checkNumSamples(t, e, s, r = "steps") {
    let o;
    if (s != null) {
      if (o = null, e != null)
        throw new I(`If ${r} is set, batchSize must be null or undefined.Got batchSize = ${e}`);
    } else if (t != null)
      Array.isArray(t) ? o = t[0].shape[0] : o = t.shape[0];
    else
      throw new I(`Either the input data should have a defined shape, or ${r} shoud be specified.`);
    return o;
  }
  /**
   * Execute internal tensors of the model with input data feed.
   * @param inputs Input data feed. Must match the inputs of the model.
   * @param outputs Names of the output tensors to be fetched. Must match
   *   names of the SymbolicTensors that belong to the graph.
   * @returns Fetched values for `outputs`.
   */
  execute(t, e) {
    if (Array.isArray(e) && e.length === 0)
      throw new I("`outputs` is an empty Array, which is not allowed.");
    const s = Array.isArray(e), r = s ? e : [e], o = this.retrieveSymbolicTensors(r), i = new Ue();
    if (t instanceof Et && (t = [t]), Array.isArray(t)) {
      if (t.length !== this.inputs.length)
        throw new I(`The number of inputs provided (${t.length}) does not match the number of inputs of this model (${this.inputs.length}).`);
      for (let l = 0; l < this.inputs.length; ++l)
        i.add(this.inputs[l], t[l]);
    } else
      for (const l of this.inputs) {
        const u = t[l.name];
        if (u == null)
          throw new I(`No value is provided for the model's input ${l.name}`);
        i.add(l, u);
      }
    const a = cs(o, i);
    return s ? a : a[0];
  }
  /**
   * Retrieve the model's internal symbolic tensors from symbolic-tensor names.
   */
  retrieveSymbolicTensors(t) {
    const e = yr(null, t.length);
    let s = t.length;
    for (const r of this.layers) {
      const o = Array.isArray(r.output) ? r.output : [r.output], i = o.map((a) => a.name);
      for (let a = 0; a < t.length; ++a) {
        const l = i.indexOf(t[a]);
        if (l !== -1 && (e[a] = o[l], s--), s === 0)
          break;
      }
      if (s === 0)
        break;
    }
    if (s > 0) {
      const r = [];
      throw e.forEach((o, i) => {
        o == null && r.push(t[i]);
      }), new I(`Cannot find SymbolicTensors for output name(s): ${JSON.stringify(r)}`);
    }
    return e;
  }
  /**
   * Helper method to loop over some data in batches.
   *
   * Porting Note: Not using the functional approach in the Python equivalent
   *   due to the imperative backend.
   * Porting Note: Does not support step mode currently.
   *
   * @param ins: input data
   * @param batchSize: integer batch size.
   * @param verbose: verbosity model
   * @returns: Predictions as `tf.Tensor` (if a single output) or an `Array` of
   *   `tf.Tensor` (if multipe outputs).
   */
  predictLoop(t, e = 32, s = !1) {
    return _(() => {
      const r = this.checkNumSamples(t);
      if (s)
        throw new J("Verbose predictLoop() is not implemented yet.");
      const o = wo(r, e), i = this.outputs.map((a) => []);
      for (let a = 0; a < o.length; ++a)
        _(() => {
          const u = o[a][0], c = o[a][1], h = is(t, u, c), f = [];
          if (Array.isArray(h))
            for (let p = 0; p < h.length; ++p)
              f.push({ key: this.inputs[p], value: h[p] });
          else
            f.push({ key: this.inputs[0], value: h });
          const d = new Ue(f);
          return cs(this.outputs, d);
        }).forEach((u, c) => i[c].push(u));
      return zt(i.map((a) => rn(a, 0)));
    });
  }
  /**
   * Generates output predictions for the input samples.
   *
   * Computation is done in batches.
   *
   * Note: the "step" mode of predict() is currently not supported.
   *   This is because the TensorFlow.js core backend is imperative only.
   *
   * ```js
   * const model = tf.sequential({
   *   layers: [tf.layers.dense({units: 1, inputShape: [10]})]
   * });
   * model.predict(tf.ones([8, 10]), {batchSize: 4}).print();
   * ```
   *
   * @param x The input data, as a Tensor, or an `Array` of `tf.Tensor`s if
   *   the model has multiple inputs.
   * @param args A `ModelPredictArgs` object containing optional fields.
   *
   * @return Prediction results as a `tf.Tensor`(s).
   *
   * @exception ValueError In case of mismatch between the provided input data
   *   and the model's expectations, or in case a stateful model receives a
   *   number of samples that is not a multiple of the batch size.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  predict(t, e = {}) {
    const s = $h(t);
    il(s, this.inputNames, this.feedInputShapes, !1);
    try {
      const r = e.batchSize == null ? 32 : e.batchSize;
      return yo(r), this.predictLoop(s, r);
    } finally {
      ue(s, t);
    }
  }
  /**
   * Returns predictions for a single batch of samples.
   *
   * ```js
   * const model = tf.sequential({
   *   layers: [tf.layers.dense({units: 1, inputShape: [10]})]
   * });
   * model.predictOnBatch(tf.ones([8, 10])).print();
   * ```
   * @param x: Input samples, as a Tensor (for models with exactly one
   *   input) or an array of Tensors (for models with more than one input).
   * @return Tensor(s) of predictions
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  predictOnBatch(t) {
    il(t, this.inputNames, this.feedInputShapes, !0);
    const e = (Array.isArray(t) ? t[0] : t).shape[0];
    return this.predictLoop(t, e);
  }
  standardizeUserDataXY(t, e, s = !0, r) {
    if (this.optimizer_ == null)
      throw new qe("You must compile a model before training/testing. Use LayersModel.compile(modelCompileArgs).");
    const o = [];
    for (let i = 0; i < this.feedOutputShapes.length; ++i) {
      const a = this.feedOutputShapes[i];
      this.feedLossFns[i] === Er ? o.push(a.slice(0, a.length - 1).concat([1])) : o.push(a);
    }
    if (t = ol(t, this.feedInputNames, this.feedInputShapes, !1, "input"), e = ol(e, this.feedOutputNames, o, !1, "target"), p1(t, e), m1(e, this.feedLossFns, this.feedOutputShapes), this.stateful && r != null && r > 0 && t[0].shape[0] % r !== 0)
      throw new I(`In a stateful network, you should only pass inputs with a number of samples that is divisible by the batch size ${r}. Found: ${t[0].shape[0]} sample(s).`);
    return [t, e];
  }
  async standardizeUserData(t, e, s, r, o = !0, i) {
    const [a, l] = this.standardizeUserDataXY(t, e, o, i);
    if (s != null)
      throw new Error("sample weight is not supported yet.");
    let u = null;
    if (r != null) {
      const c = Sh(r, this.outputNames);
      u = [];
      for (let h = 0; h < c.length; ++h)
        u.push(await vh(l[h], null, c[h]));
    }
    return [a, l, u];
  }
  /**
   * Loop over some test data in batches.
   * @param f A Function returning a list of tensors.
   * @param ins Array of tensors to be fed to `f`.
   * @param batchSize Integer batch size or `null` / `undefined`.
   * @param verbose verbosity mode.
   * @param steps Total number of steps (batches of samples) before
   * declaring test finished. Ignored with the default value of `null` /
   * `undefined`.
   * @returns Array of Scalars.
   */
  testLoop(t, e, s, r = 0, o) {
    return _(() => {
      const i = this.checkNumSamples(e, s, o, "steps"), a = [];
      if (r > 0)
        throw new J("Verbose mode is not implemented yet.");
      if (o != null)
        throw new J("steps mode in testLoop() is not implemented yet");
      {
        const l = wo(i, s), u = Dt(wr(0, i));
        for (let c = 0; c < l.length; ++c) {
          const h = l[c][0], f = l[c][1], d = ln(u, h, f - h), p = Yo(e, d), g = t(p);
          if (c === 0)
            for (let m = 0; m < g.length; ++m)
              a.push(Yt(0));
          for (let m = 0; m < g.length; ++m) {
            const b = g[m];
            a[m] = M(a[m], N(f - h, b));
          }
        }
        for (let c = 0; c < a.length; ++c)
          a[c] = Y(a[c], i);
      }
      return a;
    });
  }
  getDedupedMetricsNames() {
    const t = this.metricsNames, e = [];
    for (let s = 0; s < t.length; ++s) {
      const r = t[s];
      let o = r;
      if (Fa(t, r) > 1) {
        const i = Fa(t.slice(0, s), r);
        o += `_${i}`;
      }
      e.push(o);
    }
    return e;
  }
  /**
   * Creates a function that performs the following actions:
   *
   * 1. computes the losses
   * 2. sums them to get the total loss
   * 3. call the optimizer computes the gradients of the LayersModel's
   *    trainable weights w.r.t. the total loss and update the variables
   * 4. calculates the metrics
   * 5. returns the values of the losses and metrics.
   */
  makeTrainFunction() {
    return (t) => {
      const e = [], s = t.slice(0, this.inputs.length), r = t.slice(this.inputs.length, this.inputs.length + this.outputs.length), o = t.slice(this.inputs.length + this.outputs.length, this.inputs.length + this.outputs.length * 2), i = [], a = () => {
        const h = [];
        for (let g = 0; g < this.inputs.length; ++g)
          h.push({ key: this.inputs[g], value: s[g] });
        const f = new Ue(h), d = cs(this.outputs, f, { training: !0 });
        let p;
        for (let g = 0; g < this.lossFunctions.length; ++g) {
          const m = this.lossFunctions[g];
          let b = m(r[g], d[g]);
          o[g] != null && (b = i1(b, o[g]));
          const y = St(b);
          e.push(y), g === 0 ? p = b : p = M(p, b);
        }
        for (let g = 0; g < this.metricsTensors.length; ++g) {
          let m;
          if (this.outputs.length > 1 && g < this.outputs.length)
            m = e[g];
          else {
            const b = this.metricsTensors[g][0], y = this.metricsTensors[g][1];
            m = St(b(r[y], d[y]));
          }
          Pn(m), i.push(m);
        }
        return p = St(p), this.calculateLosses().forEach((g) => {
          p = M(p, g);
        }), p;
      }, l = this.collectedTrainableWeights.map((h) => h.read());
      return [this.optimizer_.minimize(a, !0, l)].concat(i);
    };
  }
  /**
   * Create a function which, when invoked with an array of `tf.Tensor`s as a
   * batch of inputs, returns the prespecified loss and metrics of the model
   * under the batch of input data.
   */
  makeTestFunction() {
    this.testFunction = (t) => _(() => {
      const e = [];
      let s;
      const r = t.slice(0, this.inputs.length), o = t.slice(this.inputs.length, this.inputs.length + this.outputs.length), i = [];
      for (let u = 0; u < this.inputs.length; ++u)
        i.push({ key: this.inputs[u], value: r[u] });
      const a = new Ue(i), l = cs(this.outputs, a);
      for (let u = 0; u < this.lossFunctions.length; ++u) {
        const c = this.lossFunctions[u], h = St(c(o[u], l[u]));
        u === 0 ? s = h : s = M(s, h), e.push(s);
      }
      for (let u = 0; u < this.metricsTensors.length; ++u) {
        const c = this.metricsTensors[u][0], h = this.metricsTensors[u][1], f = St(c(o[h], l[h]));
        e.push(f);
      }
      return e;
    });
  }
  /**
   * Trains the model for a fixed number of epochs (iterations on a
   * dataset).
   *
   * ```js
   * const model = tf.sequential({
   *     layers: [tf.layers.dense({units: 1, inputShape: [10]})]
   * });
   * model.compile({optimizer: 'sgd', loss: 'meanSquaredError'});
   * for (let i = 1; i < 5 ; ++i) {
   *   const h = await model.fit(tf.ones([8, 10]), tf.ones([8, 1]), {
   *       batchSize: 4,
   *       epochs: 3
   *   });
   *   console.log("Loss after Epoch " + i + " : " + h.history.loss[0]);
   * }
   * ```
   *
   * @param x `tf.Tensor` of training data, or an array of `tf.Tensor`s if the
   * model has multiple inputs. If all inputs in the model are named, you
   * can also pass a dictionary mapping input names to `tf.Tensor`s.
   * @param y `tf.Tensor` of target (label) data, or an array of `tf.Tensor`s if
   * the model has multiple outputs. If all outputs in the model are named,
   * you can also pass a dictionary mapping output names to `tf.Tensor`s.
   * @param args A `ModelFitArgs`, containing optional fields.
   *
   * @return A `History` instance. Its `history` attribute contains all
   *   information collected during training.
   *
   * @exception ValueError In case of mismatch between the provided input
   * data and what the model expects.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  async fit(t, e, s = {}) {
    if (this.isTraining)
      throw new Error("Cannot start training because another fit() call is ongoing.");
    this.isTraining = !0;
    let r, o, i, a, l, u, c, h, f;
    try {
      const d = s.batchSize == null ? 32 : s.batchSize;
      yo(d);
      const g = await this.standardizeUserData(t, e, s.sampleWeight, s.classWeight, !1, d);
      r = g[0], o = g[1], f = g[2];
      let m = !1, b;
      if (s.validationData != null && s.validationData.length > 0) {
        if (m = !0, s.validationData.length === 2)
          l = s.validationData[0], u = s.validationData[1];
        else throw s.validationData.length === 3 ? new J("validationData including sample weights is not supported yet.") : new I(`When passing validation data, it must contain 2 (valX, valY) or 3 (valX, valY, valSampleWeight) items; ${s.validationData} is invalid.`);
        const R = await this.standardizeUserData(
          l,
          u,
          null,
          /** Unused sample weights. */
          null,
          !0,
          d
        );
        c = R[0], h = R[1], b = c.concat(h);
      } else if (s.validationSplit != null && s.validationSplit > 0 && s.validationSplit < 1) {
        m = !0;
        const T = Math.floor(r[0].shape[0] * (1 - s.validationSplit)), R = r[0].shape[0];
        c = is(r, T, R), i = r, r = is(r, 0, T), h = is(o, T, R), a = o, o = is(o, 0, T), b = c.concat(h);
      } else s.validationSteps != null && (m = !0);
      const y = r.concat(o).concat(f);
      this.checkTrainableWeightsConsistency();
      const S = this.makeTrainFunction(), x = this.getDedupedMetricsNames();
      let v, E;
      m ? (this.makeTestFunction(), v = this.testFunction, E = x.slice().concat(x.map((T) => "val_" + T))) : (v = null, b = [], E = x.slice());
      const D = hh(s.callbacks, s.yieldEvery);
      return await this.fitLoop(S, y, x, d, s.epochs, s.verbose, D, v, b, s.shuffle, E, s.initialEpoch, null, null);
    } finally {
      this.isTraining = !1, ue(r, t), ue(o, e), ue(i, t), ue(a, e), ue(c, l), ue(h, u), f != null && ut(f);
    }
  }
  /**
   * Abstract fit function for `f(ins)`.
   * @param f A Function returning a list of tensors. For training, this
   *   function is expected to perform the updates to the variables.
   * @param ins List of tensors to be fed to `f`.
   * @param outLabels List of strings, display names of the outputs of `f`.
   * @param batchSize Integer batch size or `== null` if unknown. Default : 32.
   * @param epochs Number of times to iterate over the data. Default : 1.
   * @param verbose Verbosity mode: 0, 1, or 2. Default: 1.
   * @param callbacks List of callbacks to be called during training.
   * @param valF Function to call for validation.
   * @param valIns List of tensors to be fed to `valF`.
   * @param shuffle Whether to shuffle the data at the beginning of every
   * epoch. Default : true.
   * @param callbackMetrics List of strings, the display names of the metrics
   *   passed to the callbacks. They should be the concatenation of the
   *   display names of the outputs of `f` and the list of display names
   *   of the outputs of `valF`.
   * @param initialEpoch Epoch at which to start training (useful for
   *   resuming a previous training run). Default : 0.
   * @param stepsPerEpoch Total number of steps (batches on samples) before
   *   declaring one epoch finished and starting the next epoch. Ignored with
   *   the default value of `undefined` or `null`.
   * @param validationSteps Number of steps to run validation for (only if
   *   doing validation from data tensors). Not applicable for tfjs-layers.
   * @returns A `History` object.
   */
  async fitLoop(t, e, s, r, o, i, a, l, u, c, h, f, d, p) {
    r == null && (r = 32), o == null && (o = 1), c == null && (c = !0), f == null && (f = 0);
    let g = !1;
    if (l != null && u != null && (g = !0), p != null && (g = !0, d == null))
      throw new I("Can only use `validationSteps` when doing step-wise training, i.e., `stepsPerEpoch` must be set.");
    const m = this.checkNumSamples(e, r, d, "steps_per_epoch");
    let b;
    m != null && (b = wr(0, m)), i == null && (i = 1);
    const { callbackList: y, history: S } = fh(a, i, o, f, m, d, r, g, h);
    y.setModel(this), this.history = S, await y.onTrainBegin(), this.stopTraining_ = !1;
    for (let x = f; x < o; ++x) {
      await y.onEpochBegin(x);
      const v = {};
      if (d != null)
        throw new J("stepsPerEpoch mode is not implemented yet.");
      {
        if (c === "batch")
          throw new J("batch shuffling is not implemneted yet");
        c && $f(b);
        const E = Dt(b), D = wo(m, r);
        for (let k = 0; k < D.length; ++k) {
          const T = {};
          if (await y.onBatchBegin(k, T), _(() => {
            const R = D[k][0], B = D[k][1], H = ln(E, R, B - R);
            T.batch = k, T.size = B - R;
            const X = Yo(e, H), W = t(X);
            for (let U = 0; U < s.length; ++U) {
              const j = s[U], jt = W[U];
              T[j] = jt, Pn(jt);
            }
            if (k === D.length - 1 && g) {
              const U = this.testLoop(l, u, r);
              for (let j = 0; j < s.length; ++j) {
                const jt = s[j], Ot = U[j];
                Pn(Ot), v["val_" + jt] = Ot;
              }
            }
          }), await y.onBatchEnd(k, T), ch(T), this.stopTraining_)
            break;
        }
        E.dispose();
      }
      if (await y.onEpochEnd(x, v), this.stopTraining_)
        break;
    }
    return await y.onTrainEnd(), await this.history.syncData(), this.history;
  }
  // TODO(cais): Add code snippet below when it's possible to instantiate
  //   actual dataset objects.
  /**
   * Trains the model using a dataset object.
   *
   * @param dataset A dataset object. Its `iterator()` method is expected
   *   to generate a dataset iterator object, the `next()` method of which
   *   is expected to produce data batches for training. The return value
   *   of the `next()` call ought to contain a boolean `done` field and a
   *   `value` field. The `value` field is expected to be an array of two
   *   `tf.Tensor`s or an array of two nested `tf.Tensor` structures. The former
   *   case is for models with exactly one input and one output (e.g.
   *   a sequential model). The latter case is for models with multiple
   *   inputs and/or multiple outputs.
   *   Of the two items in the array, the first is the input feature(s) and
   *   the second is the output target(s).
   * @param args A `ModelFitDatasetArgs`, containing optional fields.
   *
   * @return A `History` instance. Its `history` attribute contains all
   *   information collected during training.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  async fitDataset(t, e) {
    return u1(this, t, e);
  }
  /**
   * Runs a single gradient update on a single batch of data.
   *
   * This method differs from `fit()` and `fitDataset()` in the following
   * regards:
   *   - It operates on exactly one batch of data.
   *   - It returns only the loss and metric values, instead of
   *     returning the batch-by-batch loss and metric values.
   *   - It doesn't support fine-grained options such as verbosity and
   *     callbacks.
   *
   * @param x Input data. It could be one of the following:
   *   - A `tf.Tensor`, or an Array of `tf.Tensor`s (in case the model has
   *     multiple inputs).
   *   - An Object mapping input names to corresponding `tf.Tensor` (if the
   *     model has named inputs).
   * @param y Target data. It could be either a `tf.Tensor` or multiple
   *   `tf.Tensor`s. It should be consistent with `x`.
   * @returns Training loss or losses (in case the model has
   *   multiple outputs), along with metrics (if any), as numbers.
   *
   * @doc {heading: 'Models', subheading: 'Classes'}
   */
  async trainOnBatch(t, e) {
    const s = await this.standardizeUserData(t, e), r = s[0], o = s[1], a = this.makeTrainFunction()(r.concat(o)), l = [];
    for (const u of a) {
      const c = await u.data();
      l.push(c[0]);
    }
    return ut(a), ue(s[0], t), ue(s[1], e), zt(l);
  }
  /**
   * Extract weight values of the model.
   *
   * @param config: An instance of `io.SaveConfig`, which specifies
   * model-saving options such as whether only trainable weights are to be
   * saved.
   * @returns A `NamedTensorMap` mapping original weight names (i.e.,
   *   non-uniqueified weight names) to their values.
   */
  getNamedWeights(t) {
    const e = [], s = t != null && t.trainableOnly, r = s ? this.trainableWeights : this.weights, o = this.getWeights(s);
    for (let i = 0; i < r.length; ++i)
      s && !r[i].trainable || e.push({ name: r[i].originalName, tensor: o[i] });
    return e;
  }
  /**
   * Setter used for force stopping of LayersModel.fit() (i.e., training).
   *
   * Example:
   *
   * ```js
   * const input = tf.input({shape: [10]});
   * const output = tf.layers.dense({units: 1}).apply(input);
   * const model = tf.model({inputs: [input], outputs: [output]});
   * model.compile({loss: 'meanSquaredError', optimizer: 'sgd'});
   * const xs = tf.ones([8, 10]);
   * const ys = tf.zeros([8, 1]);
   *
   * const history = await model.fit(xs, ys, {
   *   epochs: 10,
   *   callbacks: {
   *     onEpochEnd: async (epoch, logs) => {
   *       if (epoch === 2) {
   *         model.stopTraining = true;
   *       }
   *     }
   *   }
   * });
   *
   * // There should be only 3 values in the loss array, instead of 10
   * values,
   * // due to the stopping after 3 epochs.
   * console.log(history.history.loss);
   * ```
   */
  set stopTraining(t) {
    this.stopTraining_ = t;
  }
  get stopTraining() {
    return this.stopTraining_;
  }
  get optimizer() {
    return this.optimizer_;
  }
  set optimizer(t) {
    this.optimizer_ !== t && (this.optimizer_ = t, this.isOptimizerOwned = !1);
  }
  dispose() {
    const t = super.dispose();
    if (t.refCountAfterDispose === 0 && this.optimizer != null && this.isOptimizerOwned) {
      const e = Ca().numTensors;
      this.optimizer_.dispose(), t.numDisposedVariables += e - Ca().numTensors;
    }
    return t;
  }
  getLossIdentifiers() {
    let t;
    if (typeof this.loss == "string")
      t = Pe(this.loss);
    else if (Array.isArray(this.loss)) {
      for (const e of this.loss)
        if (typeof e != "string")
          throw new Error("Serialization of non-string loss is not supported.");
      t = this.loss.map((e) => Pe(e));
    } else {
      const e = Object.keys(this.loss);
      t = {};
      const s = this.loss;
      for (const r of e)
        if (typeof s[r] == "string")
          t[r] = Pe(s[r]);
        else
          throw new Error("Serialization of non-string loss is not supported.");
    }
    return t;
  }
  getMetricIdentifiers() {
    if (typeof this.metrics == "string" || typeof this.metrics == "function")
      return [Pe(qs(this.metrics))];
    if (Array.isArray(this.metrics))
      return this.metrics.map((t) => Pe(qs(t)));
    {
      const t = {};
      for (const e in this.metrics)
        t[e] = Pe(qs(this.metrics[e]));
      return t;
    }
  }
  getTrainingConfig() {
    return {
      loss: this.getLossIdentifiers(),
      metrics: this.getMetricIdentifiers(),
      optimizer_config: {
        class_name: this.optimizer.getClassName(),
        config: this.optimizer.getConfig()
      }
    };
  }
  loadTrainingConfig(t) {
    if (t.weighted_metrics != null)
      throw new Error("Loading weight_metrics is not supported yet.");
    if (t.loss_weights != null)
      throw new Error("Loading loss_weights is not supported yet.");
    if (t.sample_weight_mode != null)
      throw new Error("Loading sample_weight_mode is not supported yet.");
    const e = Ho(t.optimizer_config), s = dh(e);
    let r;
    if (typeof t.loss == "string")
      r = Qe(t.loss);
    else if (Array.isArray(t.loss))
      r = t.loss.map((i) => Qe(i));
    else if (t.loss != null) {
      r = {};
      for (const i in t.loss)
        r[i] = Qe(t.loss[i]);
    }
    let o;
    if (Array.isArray(t.metrics))
      o = t.metrics.map((i) => Qe(i));
    else if (t.metrics != null) {
      o = {};
      for (const i in t.metrics)
        o[i] = Qe(t.metrics[i]);
    }
    this.compile({ loss: r, metrics: o, optimizer: s });
  }
  /**
   * Save the configuration and/or weights of the LayersModel.
   *
   * An `IOHandler` is an object that has a `save` method of the proper
   * signature defined. The `save` method manages the storing or
   * transmission of serialized data ("artifacts") that represent the
   * model's topology and weights onto or via a specific medium, such as
   * file downloads, local storage, IndexedDB in the web browser and HTTP
   * requests to a server. TensorFlow.js provides `IOHandler`
   * implementations for a number of frequently used saving mediums, such as
   * `tf.io.browserDownloads` and `tf.io.browserLocalStorage`. See `tf.io`
   * for more details.
   *
   * This method also allows you to refer to certain types of `IOHandler`s
   * as URL-like string shortcuts, such as 'localstorage://' and
   * 'indexeddb://'.
   *
   * Example 1: Save `model`'s topology and weights to browser [local
   * storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage);
   * then load it back.
   *
   * ```js
   * const model = tf.sequential(
   *     {layers: [tf.layers.dense({units: 1, inputShape: [3]})]});
   * console.log('Prediction from original model:');
   * model.predict(tf.ones([1, 3])).print();
   *
   * const saveResults = await model.save('localstorage://my-model-1');
   *
   * const loadedModel = await tf.loadLayersModel('localstorage://my-model-1');
   * console.log('Prediction from loaded model:');
   * loadedModel.predict(tf.ones([1, 3])).print();
   * ```
   *
   * Example 2. Saving `model`'s topology and weights to browser
   * [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API);
   * then load it back.
   *
   * ```js
   * const model = tf.sequential(
   *     {layers: [tf.layers.dense({units: 1, inputShape: [3]})]});
   * console.log('Prediction from original model:');
   * model.predict(tf.ones([1, 3])).print();
   *
   * const saveResults = await model.save('indexeddb://my-model-1');
   *
   * const loadedModel = await tf.loadLayersModel('indexeddb://my-model-1');
   * console.log('Prediction from loaded model:');
   * loadedModel.predict(tf.ones([1, 3])).print();
   * ```
   *
   * Example 3. Saving `model`'s topology and weights as two files
   * (`my-model-1.json` and `my-model-1.weights.bin`) downloaded from
   * browser.
   *
   * ```js
   * const model = tf.sequential(
   *     {layers: [tf.layers.dense({units: 1, inputShape: [3]})]});
   * const saveResults = await model.save('downloads://my-model-1');
   * ```
   *
   * Example 4. Send  `model`'s topology and weights to an HTTP server.
   * See the documentation of `tf.io.http` for more details
   * including specifying request parameters and implementation of the
   * server.
   *
   * ```js
   * const model = tf.sequential(
   *     {layers: [tf.layers.dense({units: 1, inputShape: [3]})]});
   * const saveResults = await model.save('http://my-server/model/upload');
   * ```
   *
   * @param handlerOrURL An instance of `IOHandler` or a URL-like,
   * scheme-based string shortcut for `IOHandler`.
   * @param config Options for saving the model.
   * @returns A `Promise` of `SaveResult`, which summarizes the result of
   * the saving, such as byte sizes of the saved artifacts for the model's
   *   topology and weight values.
   *
   * @doc {heading: 'Models', subheading: 'Classes', ignoreCI: true}
   */
  async save(t, e) {
    if (typeof t == "string") {
      const u = nm(t);
      if (u.length === 0)
        throw new I(`Cannot find any save handlers for URL '${t}'`);
      if (u.length > 1)
        throw new I(`Found more than one (${u.length}) save handlers for URL '${t}'`);
      t = u[0];
    }
    if (t.save == null)
      throw new I("LayersModel.save() cannot proceed because the IOHandler provided does not have the `save` attribute defined.");
    const s = await Ta(this.getNamedWeights(e)), a = {
      modelTopology: this.toJSON(null, !1),
      format: b1,
      generatedBy: `TensorFlow.js tfjs-layers v${wh}`,
      convertedBy: null
    };
    if ((e == null ? !1 : e.includeOptimizer) && this.optimizer != null) {
      a.trainingConfig = this.getTrainingConfig();
      const u = "optimizer", { data: c, specs: h } = await Ta(await this.optimizer.getWeights(), u);
      s.specs.push(...h), s.data = em([s.data, c]);
    }
    return this.userDefinedMetadata != null && (Za(this.userDefinedMetadata, this.name, !0), a.userDefinedMetadata = this.userDefinedMetadata), a.weightData = s.data, a.weightSpecs = s.specs, t.save(a);
  }
  /**
   * Set user-defined metadata.
   *
   * The set metadata will be serialized together with the topology
   * and weights of the model during `save()` calls.
   *
   * @param setUserDefinedMetadata
   */
  setUserDefinedMetadata(t) {
    Za(t, this.name), this.userDefinedMetadata = t;
  }
  /**
   * Get user-defined metadata.
   *
   * The metadata is supplied via one of the two routes:
   *   1. By calling `setUserDefinedMetadata()`.
   *   2. Loaded during model loading (if the model is constructed
   *      via `tf.loadLayersModel()`.)
   *
   * If no user-defined metadata is available from either of the
   * two routes, this function will return `undefined`.
   */
  getUserDefinedMetadata() {
    return this.userDefinedMetadata;
  }
}
Jr.className = "Model";
O(Jr);
class Ah extends Jr {
}
Ah.className = "Functional";
O(Ah);
const y1 = "This is not an object", w1 = "This is not a Float16Array object", al = "This constructor is not a subclass of Float16Array", Eh = "The constructor property value is not an object", x1 = "Species constructor didn't return TypedArray object", S1 = "Derived constructor created TypedArray object which was too small length", gs = "Attempting to access detached ArrayBuffer", Jo = "Cannot convert undefined or null to object", Zo = "Cannot mix BigInt and other types, use explicit conversions", ll = "@@iterator property is not callable", ul = "Reduce of empty array with no initial value", v1 = "The comparison function must be either a function or undefined", xo = "Offset is out of bounds";
function ct(n) {
  return (t, ...e) => Ft(n, t, e);
}
function Qn(n, t) {
  return ct(
    zn(
      n,
      t
    ).get
  );
}
const {
  apply: Ft,
  construct: hs,
  defineProperty: cl,
  get: So,
  getOwnPropertyDescriptor: zn,
  getPrototypeOf: Ms,
  has: Qo,
  ownKeys: _h,
  set: hl,
  setPrototypeOf: Ch
} = Reflect, I1 = Proxy, {
  EPSILON: $1,
  MAX_SAFE_INTEGER: fl,
  isFinite: kh,
  isNaN: Un
} = Number, {
  iterator: ke,
  species: A1,
  toStringTag: Yi,
  for: E1
} = Symbol, Wn = Object, {
  create: Zr,
  defineProperty: Bs,
  freeze: _1,
  is: dl
} = Wn, ti = Wn.prototype, C1 = (
  /** @type {any} */
  ti.__lookupGetter__ ? ct(
    /** @type {any} */
    ti.__lookupGetter__
  ) : (n, t) => {
    if (n == null)
      throw ft(
        Jo
      );
    let e = Wn(n);
    do {
      const s = zn(e, t);
      if (s !== void 0)
        return Le(s, "get") ? s.get : void 0;
    } while ((e = Ms(e)) !== null);
  }
), Le = (
  /** @type {any} */
  Wn.hasOwn || ct(ti.hasOwnProperty)
), Th = Array, Nh = Th.isArray, Qr = Th.prototype, k1 = ct(Qr.join), T1 = ct(Qr.push), N1 = ct(
  Qr.toLocaleString
), Xi = Qr[ke], D1 = ct(Xi), {
  abs: P1,
  trunc: Dh
} = Math, to = ArrayBuffer, R1 = to.isView, Ph = to.prototype, L1 = ct(Ph.slice), O1 = Qn(Ph, "byteLength"), ei = typeof SharedArrayBuffer < "u" ? SharedArrayBuffer : null, M1 = ei && Qn(ei.prototype, "byteLength"), Ji = Ms(Uint8Array), B1 = Ji.from, It = Ji.prototype, F1 = It[ke], z1 = ct(It.keys), U1 = ct(
  It.values
), W1 = ct(
  It.entries
), G1 = ct(It.set), pl = ct(
  It.reverse
), V1 = ct(It.fill), q1 = ct(
  It.copyWithin
), ml = ct(It.sort), as = ct(It.slice), j1 = ct(
  It.subarray
), xt = Qn(
  It,
  "buffer"
), Xe = Qn(
  It,
  "byteOffset"
), tt = Qn(
  It,
  "length"
), Rh = Qn(
  It,
  Yi
), H1 = Uint8Array, Ht = Uint16Array, gl = (...n) => Ft(B1, Ht, n), Zi = Uint32Array, K1 = Float32Array, yn = Ms([][ke]()), eo = ct(yn.next), Y1 = ct(function* () {
}().next), X1 = Ms(yn), ft = TypeError, vo = RangeError, Lh = WeakSet, Oh = Lh.prototype, J1 = ct(Oh.add), Z1 = ct(Oh.has), no = WeakMap, Qi = no.prototype, Tr = ct(Qi.get), Q1 = ct(Qi.has), ta = ct(Qi.set), Mh = new no(), tx = Zr(null, {
  next: {
    value: function() {
      const t = Tr(Mh, this);
      return eo(t);
    }
  },
  [ke]: {
    value: function() {
      return this;
    }
  }
});
function js(n) {
  if (n[ke] === Xi && yn.next === eo)
    return n;
  const t = Zr(tx);
  return ta(Mh, t, D1(n)), t;
}
const Bh = new no(), Fh = Zr(X1, {
  next: {
    value: function() {
      const t = Tr(Bh, this);
      return Y1(t);
    },
    writable: !0,
    configurable: !0
  }
});
for (const n of _h(yn))
  n !== "next" && Bs(Fh, n, zn(yn, n));
function bl(n) {
  const t = Zr(Fh);
  return ta(Bh, t, n), t;
}
function Nr(n) {
  return n !== null && typeof n == "object" || typeof n == "function";
}
function yl(n) {
  return n !== null && typeof n == "object";
}
function Dr(n) {
  return Rh(n) !== void 0;
}
function ni(n) {
  const t = Rh(n);
  return t === "BigInt64Array" || t === "BigUint64Array";
}
function ex(n) {
  try {
    return Nh(n) ? !1 : (O1(
      /** @type {any} */
      n
    ), !0);
  } catch {
    return !1;
  }
}
function zh(n) {
  if (ei === null)
    return !1;
  try {
    return M1(
      /** @type {any} */
      n
    ), !0;
  } catch {
    return !1;
  }
}
function nx(n) {
  return ex(n) || zh(n);
}
function wl(n) {
  return Nh(n) ? n[ke] === Xi && yn.next === eo : !1;
}
function sx(n) {
  return Dr(n) ? n[ke] === F1 && yn.next === eo : !1;
}
function Hs(n) {
  if (typeof n != "string")
    return !1;
  const t = +n;
  return n !== t + "" || !kh(t) ? !1 : t === Dh(t);
}
const Pr = E1("__Float16Array__");
function rx(n) {
  if (!yl(n))
    return !1;
  const t = Ms(n);
  if (!yl(t))
    return !1;
  const e = t.constructor;
  if (e === void 0)
    return !1;
  if (!Nr(e))
    throw ft(Eh);
  return Qo(e, Pr);
}
const si = 1 / $1;
function ox(n) {
  return n + si - si;
}
const Uh = 6103515625e-14, ix = 65504, Wh = 9765625e-10, xl = Wh * Uh, ax = Wh * si;
function lx(n) {
  const t = +n;
  if (!kh(t) || t === 0)
    return t;
  const e = t > 0 ? 1 : -1, s = P1(t);
  if (s < Uh)
    return e * ox(s / xl) * xl;
  const r = (1 + ax) * s, o = r - (r - s);
  return o > ix || Un(o) ? e * (1 / 0) : e * o;
}
const Gh = new to(4), Vh = new K1(Gh), qh = new Zi(Gh), ce = new Ht(512), he = new H1(512);
for (let n = 0; n < 256; ++n) {
  const t = n - 127;
  t < -24 ? (ce[n] = 0, ce[n | 256] = 32768, he[n] = 24, he[n | 256] = 24) : t < -14 ? (ce[n] = 1024 >> -t - 14, ce[n | 256] = 1024 >> -t - 14 | 32768, he[n] = -t - 1, he[n | 256] = -t - 1) : t <= 15 ? (ce[n] = t + 15 << 10, ce[n | 256] = t + 15 << 10 | 32768, he[n] = 13, he[n | 256] = 13) : t < 128 ? (ce[n] = 31744, ce[n | 256] = 64512, he[n] = 24, he[n | 256] = 24) : (ce[n] = 31744, ce[n | 256] = 64512, he[n] = 13, he[n | 256] = 13);
}
function xe(n) {
  Vh[0] = lx(n);
  const t = qh[0], e = t >> 23 & 511;
  return ce[e] + ((t & 8388607) >> he[e]);
}
const ea = new Zi(2048);
for (let n = 1; n < 1024; ++n) {
  let t = n << 13, e = 0;
  for (; !(t & 8388608); )
    t <<= 1, e -= 8388608;
  t &= -8388609, e += 947912704, ea[n] = t | e;
}
for (let n = 1024; n < 2048; ++n)
  ea[n] = 939524096 + (n - 1024 << 13);
const ts = new Zi(64);
for (let n = 1; n < 31; ++n)
  ts[n] = n << 23;
ts[31] = 1199570944;
ts[32] = 2147483648;
for (let n = 33; n < 63; ++n)
  ts[n] = 2147483648 + (n - 32 << 23);
ts[63] = 3347054592;
const jh = new Ht(64);
for (let n = 1; n < 64; ++n)
  n !== 32 && (jh[n] = 1024);
function nt(n) {
  const t = n >> 10;
  return qh[0] = ea[jh[t] + (n & 1023)] + ts[t], Vh[0];
}
function De(n) {
  const t = +n;
  return Un(t) || t === 0 ? 0 : Dh(t);
}
function Io(n) {
  const t = De(n);
  return t < 0 ? 0 : t < fl ? t : fl;
}
function Ks(n, t) {
  if (!Nr(n))
    throw ft(y1);
  const e = n.constructor;
  if (e === void 0)
    return t;
  if (!Nr(e))
    throw ft(Eh);
  const s = e[A1];
  return s ?? t;
}
function bs(n) {
  if (zh(n))
    return !1;
  try {
    return L1(n, 0, 0), !1;
  } catch {
  }
  return !0;
}
function Sl(n, t) {
  const e = Un(n), s = Un(t);
  if (e && s)
    return 0;
  if (e)
    return 1;
  if (s || n < t)
    return -1;
  if (n > t)
    return 1;
  if (n === 0 && t === 0) {
    const r = dl(n, 0), o = dl(t, 0);
    if (!r && o)
      return -1;
    if (r && !o)
      return 1;
  }
  return 0;
}
const na = 2, Rr = new no();
function Dn(n) {
  return Q1(Rr, n) || !R1(n) && rx(n);
}
function Q(n) {
  if (!Dn(n))
    throw ft(w1);
}
function Ys(n, t) {
  const e = Dn(n), s = Dr(n);
  if (!e && !s)
    throw ft(x1);
  if (typeof t == "number") {
    let r;
    if (e) {
      const o = q(n);
      r = tt(o);
    } else
      r = tt(n);
    if (r < t)
      throw ft(
        S1
      );
  }
  if (ni(n))
    throw ft(Zo);
}
function q(n) {
  const t = Tr(Rr, n);
  if (t !== void 0) {
    const r = xt(t);
    if (bs(r))
      throw ft(gs);
    return t;
  }
  const e = (
    /** @type {any} */
    n.buffer
  );
  if (bs(e))
    throw ft(gs);
  const s = hs(ht, [
    e,
    /** @type {any} */
    n.byteOffset,
    /** @type {any} */
    n.length
  ], n.constructor);
  return Tr(Rr, s);
}
function vl(n) {
  const t = tt(n), e = [];
  for (let s = 0; s < t; ++s)
    e[s] = nt(n[s]);
  return e;
}
const Hh = new Lh();
for (const n of _h(It)) {
  if (n === Yi)
    continue;
  const t = zn(It, n);
  Le(t, "get") && typeof t.get == "function" && J1(Hh, t.get);
}
const ux = _1(
  /** @type {ProxyHandler<Float16BitsArray>} */
  {
    get(n, t, e) {
      return Hs(t) && Le(n, t) ? nt(So(n, t)) : Z1(Hh, C1(n, t)) ? So(n, t) : So(n, t, e);
    },
    set(n, t, e, s) {
      return Hs(t) && Le(n, t) ? hl(n, t, xe(e)) : hl(n, t, e, s);
    },
    getOwnPropertyDescriptor(n, t) {
      if (Hs(t) && Le(n, t)) {
        const e = zn(n, t);
        return e.value = nt(e.value), e;
      }
      return zn(n, t);
    },
    defineProperty(n, t, e) {
      return Hs(t) && Le(n, t) && Le(e, "value") && (e.value = xe(e.value)), cl(n, t, e);
    }
  }
);
class ht {
  /** @see https://tc39.es/ecma262/#sec-typedarray */
  constructor(t, e, s) {
    let r;
    if (Dn(t))
      r = hs(Ht, [q(t)], new.target);
    else if (Nr(t) && !nx(t)) {
      let i, a;
      if (Dr(t)) {
        i = t, a = tt(t);
        const l = xt(t);
        if (bs(l))
          throw ft(gs);
        if (ni(t))
          throw ft(Zo);
        const u = new to(
          a * na
        );
        r = hs(Ht, [u], new.target);
      } else {
        const l = t[ke];
        if (l != null && typeof l != "function")
          throw ft(ll);
        l != null ? wl(t) ? (i = t, a = t.length) : (i = [.../** @type {Iterable<unknown>} */
        t], a = i.length) : (i = /** @type {ArrayLike<unknown>} */
        t, a = Io(i.length)), r = hs(Ht, [a], new.target);
      }
      for (let l = 0; l < a; ++l)
        r[l] = xe(i[l]);
    } else
      r = hs(Ht, arguments, new.target);
    const o = (
      /** @type {any} */
      new I1(r, ux)
    );
    return ta(Rr, o, r), o;
  }
  /**
   * limitation: `Object.getOwnPropertyNames(Float16Array)` or `Reflect.ownKeys(Float16Array)` include this key
   * @see https://tc39.es/ecma262/#sec-%typedarray%.from
   */
  static from(t, ...e) {
    const s = this;
    if (!Qo(s, Pr))
      throw ft(
        al
      );
    if (s === ht) {
      if (Dn(t) && e.length === 0) {
        const c = q(t), h = new Ht(
          xt(c),
          Xe(c),
          tt(c)
        );
        return new ht(
          xt(as(h))
        );
      }
      if (e.length === 0)
        return new ht(
          xt(
            gl(t, xe)
          )
        );
      const l = e[0], u = e[1];
      return new ht(
        xt(
          gl(t, function(c, ...h) {
            return xe(
              Ft(l, this, [c, ...js(h)])
            );
          }, u)
        )
      );
    }
    let r, o;
    const i = t[ke];
    if (i != null && typeof i != "function")
      throw ft(ll);
    if (i != null)
      wl(t) ? (r = t, o = t.length) : sx(t) ? (r = t, o = tt(t)) : (r = [...t], o = r.length);
    else {
      if (t == null)
        throw ft(
          Jo
        );
      r = Wn(t), o = Io(r.length);
    }
    const a = new s(o);
    if (e.length === 0)
      for (let l = 0; l < o; ++l)
        a[l] = /** @type {number} */
        r[l];
    else {
      const l = e[0], u = e[1];
      for (let c = 0; c < o; ++c)
        a[c] = Ft(l, u, [r[c], c]);
    }
    return a;
  }
  /**
   * limitation: `Object.getOwnPropertyNames(Float16Array)` or `Reflect.ownKeys(Float16Array)` include this key
   * @see https://tc39.es/ecma262/#sec-%typedarray%.of
   */
  static of(...t) {
    const e = this;
    if (!Qo(e, Pr))
      throw ft(
        al
      );
    const s = t.length;
    if (e === ht) {
      const o = new ht(s), i = q(o);
      for (let a = 0; a < s; ++a)
        i[a] = xe(t[a]);
      return o;
    }
    const r = new e(s);
    for (let o = 0; o < s; ++o)
      r[o] = t[o];
    return r;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.keys */
  keys() {
    Q(this);
    const t = q(this);
    return z1(t);
  }
  /**
   * limitation: returns a object whose prototype is not `%ArrayIteratorPrototype%`
   * @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.values
   */
  values() {
    Q(this);
    const t = q(this);
    return bl(function* () {
      for (const e of U1(t))
        yield nt(e);
    }());
  }
  /**
   * limitation: returns a object whose prototype is not `%ArrayIteratorPrototype%`
   * @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.entries
   */
  entries() {
    Q(this);
    const t = q(this);
    return bl(function* () {
      for (const [e, s] of W1(t))
        yield (
          /** @type {[number, number]} */
          [e, nt(s)]
        );
    }());
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.at */
  at(t) {
    Q(this);
    const e = q(this), s = tt(e), r = De(t), o = r >= 0 ? r : s + r;
    if (!(o < 0 || o >= s))
      return nt(e[o]);
  }
  /** @see https://tc39.es/proposal-change-array-by-copy/#sec-%typedarray%.prototype.with */
  with(t, e) {
    Q(this);
    const s = q(this), r = tt(s), o = De(t), i = o >= 0 ? o : r + o, a = +e;
    if (i < 0 || i >= r)
      throw vo(xo);
    const l = new Ht(
      xt(s),
      Xe(s),
      tt(s)
    ), u = new ht(
      xt(
        as(l)
      )
    ), c = q(u);
    return c[i] = xe(a), u;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.map */
  map(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0], i = Ks(s, ht);
    if (i === ht) {
      const l = new ht(r), u = q(l);
      for (let c = 0; c < r; ++c) {
        const h = nt(s[c]);
        u[c] = xe(
          Ft(t, o, [h, c, this])
        );
      }
      return l;
    }
    const a = new i(r);
    Ys(a, r);
    for (let l = 0; l < r; ++l) {
      const u = nt(s[l]);
      a[l] = Ft(t, o, [u, l, this]);
    }
    return (
      /** @type {any} */
      a
    );
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.filter */
  filter(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0], i = [];
    for (let u = 0; u < r; ++u) {
      const c = nt(s[u]);
      Ft(t, o, [c, u, this]) && T1(i, c);
    }
    const a = Ks(s, ht), l = new a(i);
    return Ys(l), /** @type {any} */
    l;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.reduce */
  reduce(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s);
    if (r === 0 && e.length === 0)
      throw ft(ul);
    let o, i;
    e.length === 0 ? (o = nt(s[0]), i = 1) : (o = e[0], i = 0);
    for (let a = i; a < r; ++a)
      o = t(
        o,
        nt(s[a]),
        a,
        this
      );
    return o;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.reduceright */
  reduceRight(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s);
    if (r === 0 && e.length === 0)
      throw ft(ul);
    let o, i;
    e.length === 0 ? (o = nt(s[r - 1]), i = r - 2) : (o = e[0], i = r - 1);
    for (let a = i; a >= 0; --a)
      o = t(
        o,
        nt(s[a]),
        a,
        this
      );
    return o;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.foreach */
  forEach(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = 0; i < r; ++i)
      Ft(t, o, [
        nt(s[i]),
        i,
        this
      ]);
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.find */
  find(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = 0; i < r; ++i) {
      const a = nt(s[i]);
      if (Ft(t, o, [a, i, this]))
        return a;
    }
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.findindex */
  findIndex(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = 0; i < r; ++i) {
      const a = nt(s[i]);
      if (Ft(t, o, [a, i, this]))
        return i;
    }
    return -1;
  }
  /** @see https://tc39.es/proposal-array-find-from-last/index.html#sec-%typedarray%.prototype.findlast */
  findLast(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = r - 1; i >= 0; --i) {
      const a = nt(s[i]);
      if (Ft(t, o, [a, i, this]))
        return a;
    }
  }
  /** @see https://tc39.es/proposal-array-find-from-last/index.html#sec-%typedarray%.prototype.findlastindex */
  findLastIndex(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = r - 1; i >= 0; --i) {
      const a = nt(s[i]);
      if (Ft(t, o, [a, i, this]))
        return i;
    }
    return -1;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.every */
  every(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = 0; i < r; ++i)
      if (!Ft(t, o, [
        nt(s[i]),
        i,
        this
      ]))
        return !1;
    return !0;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.some */
  some(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s), o = e[0];
    for (let i = 0; i < r; ++i)
      if (Ft(t, o, [
        nt(s[i]),
        i,
        this
      ]))
        return !0;
    return !1;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.set */
  set(t, ...e) {
    Q(this);
    const s = q(this), r = De(e[0]);
    if (r < 0)
      throw vo(xo);
    if (t == null)
      throw ft(
        Jo
      );
    if (ni(t))
      throw ft(
        Zo
      );
    if (Dn(t))
      return G1(
        q(this),
        q(t),
        r
      );
    if (Dr(t)) {
      const l = xt(t);
      if (bs(l))
        throw ft(gs);
    }
    const o = tt(s), i = Wn(t), a = Io(i.length);
    if (r === 1 / 0 || a + r > o)
      throw vo(xo);
    for (let l = 0; l < a; ++l)
      s[l + r] = xe(i[l]);
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.reverse */
  reverse() {
    Q(this);
    const t = q(this);
    return pl(t), this;
  }
  /** @see https://tc39.es/proposal-change-array-by-copy/#sec-%typedarray%.prototype.toReversed */
  toReversed() {
    Q(this);
    const t = q(this), e = new Ht(
      xt(t),
      Xe(t),
      tt(t)
    ), s = new ht(
      xt(
        as(e)
      )
    ), r = q(s);
    return pl(r), s;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.fill */
  fill(t, ...e) {
    Q(this);
    const s = q(this);
    return V1(
      s,
      xe(t),
      ...js(e)
    ), this;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.copywithin */
  copyWithin(t, e, ...s) {
    Q(this);
    const r = q(this);
    return q1(r, t, e, ...js(s)), this;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.sort */
  sort(t) {
    Q(this);
    const e = q(this), s = t !== void 0 ? t : Sl;
    return ml(e, (r, o) => s(nt(r), nt(o))), this;
  }
  /** @see https://tc39.es/proposal-change-array-by-copy/#sec-%typedarray%.prototype.toSorted */
  toSorted(t) {
    Q(this);
    const e = q(this);
    if (t !== void 0 && typeof t != "function")
      throw new ft(v1);
    const s = t !== void 0 ? t : Sl, r = new Ht(
      xt(e),
      Xe(e),
      tt(e)
    ), o = new ht(
      xt(
        as(r)
      )
    ), i = q(o);
    return ml(i, (a, l) => s(nt(a), nt(l))), o;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.slice */
  slice(t, e) {
    Q(this);
    const s = q(this), r = Ks(s, ht);
    if (r === ht) {
      const p = new Ht(
        xt(s),
        Xe(s),
        tt(s)
      );
      return new ht(
        xt(
          as(p, t, e)
        )
      );
    }
    const o = tt(s), i = De(t), a = e === void 0 ? o : De(e);
    let l;
    i === -1 / 0 ? l = 0 : i < 0 ? l = o + i > 0 ? o + i : 0 : l = o < i ? o : i;
    let u;
    a === -1 / 0 ? u = 0 : a < 0 ? u = o + a > 0 ? o + a : 0 : u = o < a ? o : a;
    const c = u - l > 0 ? u - l : 0, h = new r(c);
    if (Ys(h, c), c === 0)
      return h;
    const f = xt(s);
    if (bs(f))
      throw ft(gs);
    let d = 0;
    for (; l < u; )
      h[d] = nt(s[l]), ++l, ++d;
    return (
      /** @type {any} */
      h
    );
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.subarray */
  subarray(t, e) {
    Q(this);
    const s = q(this), r = Ks(s, ht), o = new Ht(
      xt(s),
      Xe(s),
      tt(s)
    ), i = j1(o, t, e), a = new r(
      xt(i),
      Xe(i),
      tt(i)
    );
    return Ys(a), /** @type {any} */
    a;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.indexof */
  indexOf(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s);
    let o = De(e[0]);
    if (o === 1 / 0)
      return -1;
    o < 0 && (o += r, o < 0 && (o = 0));
    for (let i = o; i < r; ++i)
      if (Le(s, i) && nt(s[i]) === t)
        return i;
    return -1;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.lastindexof */
  lastIndexOf(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s);
    let o = e.length >= 1 ? De(e[0]) : r - 1;
    if (o === -1 / 0)
      return -1;
    o >= 0 ? o = o < r - 1 ? o : r - 1 : o += r;
    for (let i = o; i >= 0; --i)
      if (Le(s, i) && nt(s[i]) === t)
        return i;
    return -1;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.includes */
  includes(t, ...e) {
    Q(this);
    const s = q(this), r = tt(s);
    let o = De(e[0]);
    if (o === 1 / 0)
      return !1;
    o < 0 && (o += r, o < 0 && (o = 0));
    const i = Un(t);
    for (let a = o; a < r; ++a) {
      const l = nt(s[a]);
      if (i && Un(l) || l === t)
        return !0;
    }
    return !1;
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.join */
  join(t) {
    Q(this);
    const e = q(this), s = vl(e);
    return k1(s, t);
  }
  /** @see https://tc39.es/ecma262/#sec-%typedarray%.prototype.tolocalestring */
  toLocaleString(...t) {
    Q(this);
    const e = q(this), s = vl(e);
    return N1(s, ...js(t));
  }
  /** @see https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-@@tostringtag */
  get [Yi]() {
    if (Dn(this))
      return (
        /** @type {any} */
        "Float16Array"
      );
  }
}
Bs(ht, "BYTES_PER_ELEMENT", {
  value: na
});
Bs(ht, Pr, {});
Ch(ht, Ji);
const Lr = ht.prototype;
Bs(Lr, "BYTES_PER_ELEMENT", {
  value: na
});
Bs(Lr, ke, {
  value: Lr.values,
  writable: !0,
  configurable: !0
});
Ch(Lr, It);
function cx(n, t) {
  return n.channels === t.channels;
}
const Xs = 8;
class Js {
  constructor(t, e, s) {
    G(this, "autoUpdateOutputBuffer", !0);
    G(this, "_label");
    G(this, "_device");
    G(this, "_outputBuffers", {});
    G(this, "_pipeline");
    G(this, "_bindGroups", []);
    G(this, "_needsUpdatePipeline", !0);
    G(this, "_needsResizeBuffer", !0);
    G(this, "_inputs", []);
    G(this, "_outputs", []);
    G(this, "_uniforms", []);
    G(this, "_uniformBuffers", {});
    G(this, "_width", 10);
    G(this, "_height", 10);
    G(this, "_execWidth");
    G(this, "_execHeight");
    G(this, "_csCode", "");
    G(this, "_csMain");
    G(this, "_csDefine");
    G(this, "_groupOffsets", {
      inputs: 0,
      uniforms: 1,
      outputs: 2
    });
    this._label = t, this._device = e, this._csMain = s.csMain, this._csDefine = s.csDefine, this._inputs = s.inputs, this._outputs = s.outputs, this._uniforms = s.uniforms, this.autoUpdateOutputBuffer = s.autoUpdateOutputBuffer ?? !0, s.uniforms.forEach((r) => {
      this._uniformBuffers[r.label] = e.createBuffer({
        label: this._label,
        size: r.data.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      }), this._device.queue.writeBuffer(
        this._uniformBuffers[r.label],
        0,
        r.data
      );
    });
  }
  setCSCode({ csDefine: t, csMain: e }) {
    this._csDefine = t, this._csMain = e, this._needsUpdatePipeline = !0;
  }
  setSize(t, e) {
    t = Math.ceil(t), e = Math.ceil(e);
    const s = t !== this._width || e !== this._height;
    this._width = t, this._height = e, s && (this._needsResizeBuffer = !0, this._needsUpdatePipeline = !0);
  }
  setExecuteSize(t, e) {
    t = Math.ceil(t), e = Math.ceil(e), this._execWidth = t, this._execHeight = e;
  }
  setOutputParams(t) {
    this.autoUpdateOutputBuffer && this._updateOutputBuffers(t), this._needsUpdatePipeline = !0;
  }
  setOutputBuffers(t) {
    this._outputBuffers = Object.keys(t).reduce((e, s) => (e[s] = {
      buffer: t[s],
      params: { channels: 4 }
    }, e), {});
  }
  setUniform(t, e) {
    const s = this._uniformBuffers[t];
    this._device.queue.writeBuffer(s, 0, e);
  }
  getOutput(t) {
    return this._needsResizeBuffer && this.autoUpdateOutputBuffer && (this._resizeOutputBuffers(), this._needsResizeBuffer = !1), this._outputBuffers[t].buffer;
  }
  dispose() {
    Object.keys(this._uniformBuffers).forEach((t) => {
      this._uniformBuffers[t].destroy();
    }), Object.keys(this._outputBuffers).forEach((t) => {
      this._outputBuffers[t].buffer.destroy();
    });
  }
  _createBuffer(t) {
    const e = this._width * this._height * 4 * 4;
    return this._device.createBuffer({
      label: this._label,
      // webgpu needs buffer at least 80 bytes.
      size: Math.max(e, 80),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
  }
  _resizeOutputBuffers() {
    const t = this._outputBuffers;
    for (const e in t) {
      const { buffer: s, params: r } = t[e];
      s.destroy(), t[e].buffer = this._createBuffer(r);
    }
  }
  _updateOutputBuffers(t) {
    var s, r;
    const e = this._outputBuffers;
    for (const o in t) {
      const i = t[o];
      if (!cx(
        i,
        ((s = e[o]) == null ? void 0 : s.params) || {}
      )) {
        (r = e[o]) == null || r.buffer.destroy();
        const a = this._createBuffer(i);
        e[o] = {
          buffer: a,
          params: i
        };
      }
    }
  }
  _updatePipeline(t, e) {
    if (!this._needsUpdatePipeline)
      return;
    this._needsUpdatePipeline = !1;
    const s = this._device, r = this._getFullCs(t, e);
    r !== this._csCode && (this._csCode = r, this._pipeline = s.createComputePipeline({
      label: this._label,
      layout: "auto",
      compute: {
        module: s.createShaderModule({
          label: this._label,
          code: r
        }),
        entryPoint: "main"
      }
    }), this._updateBindGroups());
  }
  _getFullCs(t, e) {
    const s = this._inputs, r = this._uniforms;
    let o = 0;
    const i = this._groupOffsets = {
      inputs: 0,
      uniforms: 0,
      outputs: 0
    };
    return s.length > 0 && o++, r.length > 0 && (i.uniforms = o, o++), i.outputs = o, `
${s.sort().map((l, u) => {
      const c = `@group(${i.inputs}) @binding(${u}) `, h = `in_${l}`;
      return e[l] === "texture" ? `${c} var ${h}: texture_2d<f32>;` : `${c} var<storage, read> ${h}: array<vec${t[l].channels}f>;`;
    }).join(`
`)}
${this._uniforms.map(
      (l, u) => `@group(${i.uniforms}) @binding(${u}) var<uniform> ${l.label}: ${l.type};`
    ).join(`
`)}

${this._outputs.map(
      (l, u) => `@group(${i.outputs}) @binding(${u}) var<storage, read_write> out_${l}: array<vec${this._outputBuffers[l].params.channels}f>;`
    ).join(`
`)}
${this._csDefine ?? ""}
@compute @workgroup_size(${Xs}, ${Xs}, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
${this._csMain}
}
`;
  }
  _updateBindGroups() {
    const t = [], e = this._device, s = this._groupOffsets;
    this._uniforms.length > 0 && (t[s.uniforms] = e.createBindGroup({
      label: this._label,
      layout: this._pipeline.getBindGroupLayout(s.uniforms),
      entries: this._uniforms.map(
        (r, o) => ({
          binding: o,
          resource: {
            buffer: this._uniformBuffers[r.label]
          }
        })
      )
    })), this._bindGroups = t;
  }
  createPass(t, e) {
    this._needsResizeBuffer && this.autoUpdateOutputBuffer && (this._resizeOutputBuffers(), this._needsResizeBuffer = !1);
    const s = this._inputs.reduce((i, a) => (i[a] = e[a].buffer ? "buffer" : "texture", i), {});
    this._updatePipeline(e, s);
    const r = this._groupOffsets;
    this._inputs.length > 0 && (this._bindGroups[r.inputs] = this._device.createBindGroup({
      label: this._label,
      layout: this._pipeline.getBindGroupLayout(r.inputs),
      entries: this._inputs.map((i, a) => ({
        binding: a,
        // TODO
        resource: e[i].buffer ? {
          buffer: e[i].buffer
        } : e[i].texture.createView()
      }))
    })), this._bindGroups[r.outputs] = this._device.createBindGroup({
      label: this._label,
      layout: this._pipeline.getBindGroupLayout(r.outputs),
      entries: this._outputs.map((i, a) => ({
        binding: a,
        resource: {
          buffer: this._outputBuffers[i].buffer
        }
      }))
    });
    const o = t.beginComputePass();
    o.setPipeline(this._pipeline), this._bindGroups.forEach((i, a) => {
      o.setBindGroup(a, i);
    }), o.dispatchWorkgroups(
      Math.ceil((this._execWidth ?? this._width) / Xs),
      Math.ceil((this._execHeight ?? this._height) / Xs),
      1
    ), o.end();
  }
}
const sa = 1412.83765, ra = 1.64593172, oa = 0.431384981, ia = -0.00294139609, aa = 0.192653254, la = 0.00626026094, ua = 0.998620152, Kh = 15794576e-13, Yh = 0.0322087631, Xh = 0.00223151711, Jh = 0.370974749;
function Zh(n) {
  return n <= Kh ? n = sa * n : n <= Yh ? n = ra * Math.pow(n, oa) + ia : n = aa * Math.log(n + la) + ua, n;
}
function hx(n) {
  return n <= Xh ? n = n / sa : n <= Jh ? n = Math.pow((n - ia) / ra, 1 / oa) : n = Math.exp((n - ua) / aa) - la, n;
}
const fx = 65504, Qh = Zh(fx), tf = 1 / Qh, ef = Qh;
class $o {
  constructor(t, e, s, r) {
    this.x = t, this.y = e, this.width = s, this.height = r;
  }
}
function dx({
  data: n,
  channels: t
}) {
  let e = 0;
  for (let i = 0; i < n.length; i += t) {
    const a = n[i], l = n[i + 1], u = n[i + 2], c = 0.212671 * a + 0.71516 * l + 0.072169 * u;
    e += Math.log2(c + 1e-4);
  }
  const s = n.length / t, r = e / s;
  return 0.18 / Math.pow(2, r);
}
function px({
  data: n,
  channels: t,
  inputScale: e
}) {
  const s = new Float32Array(n.length);
  s.set(n);
  for (let r = 0; r < s.length; r += t)
    for (let o = 0; o < 3; o++) {
      let i = s[r + o] * e;
      s[r + o] = Zh(i) * tf;
    }
  return s;
}
function mx({
  data: n,
  channels: t,
  inputScale: e
}) {
  const s = new Float32Array(n.length);
  s.set(n);
  const r = 1 / e;
  for (let o = 0; o < s.length; o += t)
    for (let i = 0; i < 3; i++) {
      let a = s[o + i] * ef;
      s[o + i] = hx(a) * r;
    }
  return s;
}
const Il = `
const a = ${sa};
const b = ${ra};
const c = ${oa};
const d = ${ia};
const e = ${aa};
const f = ${la};
const g = ${ua};
const y0 =${Kh};
const y1 =${Yh};
const x0 =${Xh};
const x1 =${Jh};

const normScale = ${tf};
const rcpNormScale = ${ef};
`;
class gx {
  constructor(t, e) {
    G(this, "_inputPassAux");
    G(this, "_inputPassColor");
    G(this, "_outputPass");
    G(this, "_copyPass");
    G(this, "_isInputTexture");
    this._device = t, this._isHDR = e;
    const s = [
      {
        label: "inputScale",
        type: "f32",
        data: new Float32Array([1])
      },
      {
        label: "inputSize",
        type: "vec2i",
        data: new Int32Array(2)
      },
      {
        label: "outputSize",
        type: "vec2i",
        data: new Int32Array(2)
      },
      {
        label: "inputOffset",
        type: "vec2i",
        data: new Int32Array(2)
      }
    ];
    this._inputPassAux = new Js("inputPassAux", this._device, {
      inputs: ["color", "albedo", "normal"],
      outputs: ["color", "albedo", "normal"],
      uniforms: s,
      csDefine: "",
      csMain: ""
    }), this._inputPassColor = new Js("inputPassColor", this._device, {
      inputs: ["color"],
      outputs: ["color"],
      uniforms: s,
      csDefine: "",
      csMain: ""
    }), this._outputPass = new Js("outputPass", this._device, {
      inputs: ["color", "raw"],
      outputs: ["color"],
      uniforms: [
        {
          label: "inputScale",
          type: "f32",
          data: new Float32Array([1])
        },
        {
          label: "inputSize",
          type: "vec2i",
          data: new Int32Array(2)
        },
        {
          label: "outputSize",
          type: "vec2i",
          data: new Int32Array(2)
        },
        {
          label: "imageSize",
          type: "vec2i",
          data: new Int32Array(2)
        },
        {
          label: "inputOffset",
          type: "vec2i",
          data: new Int32Array(2)
        },
        {
          label: "outputOffset",
          type: "vec2i",
          data: new Int32Array(2)
        }
      ],
      csDefine: "",
      csMain: ""
    }), this._copyPass = new Js("copyPass", this._device, {
      inputs: ["color"],
      outputs: ["color"],
      autoUpdateOutputBuffer: !1,
      uniforms: [
        {
          label: "size",
          type: "vec2i",
          data: new Int32Array(2)
        }
      ],
      csMain: (
        /*wgsl*/
        `
let outIdx = i32(globalId.x + globalId.y * u32(size.x));
out_color[outIdx] = textureLoad(in_color, globalId.xy, 0);
`
      )
    }), this._inputPassAux.setOutputParams({
      color: { channels: 3 },
      albedo: { channels: 3 },
      normal: { channels: 3 }
    }), this._inputPassColor.setOutputParams({
      color: { channels: 3 }
    }), this._outputPass.setOutputParams({
      color: { channels: 4 }
    });
  }
  _updatePasses(t, e = !1) {
    if (this._isInputTexture != null && this._isInputTexture === t)
      return;
    this._isInputTexture = t;
    const s = this._isHDR, r = (
      /* wgsl */
      `
${Il}
fn PUForward(y: f32) -> f32 {
  if (y <= y0) {
    return a * y;
  } else if (y <= y1) {
    return b * pow(y, c) + d;
  } else {
    return e * log(y + f) + g;
  }
}`
    );
    function o(a) {
      return t ? `textureLoad(in_${a}, globalId.xy + vec2u(inputOffset), 0)` : `in_${a}[inIdx]`;
    }
    const i = (
      /* wgsl */
      `
let x = i32(globalId.x);
let y = i32(globalId.y);
let inIdx = (y + inputOffset.y) * inputSize.x + (x + inputOffset.x);
let col = ${o("color")};

let outIdx = y * outputSize.x + x;

if (${e}) {
  // Denoise the inversed alpha. Or the anti aliased edge will be too dark after denoised
  out_color[outIdx] = vec3f(1.0 - col.a);
}
else if (${s}) {
  out_color[outIdx] = vec3f(PUForward(col.r * inputScale), PUForward(col.g * inputScale), PUForward(col.b * inputScale)) * normScale;
}
else {
  out_color[outIdx] = col.rgb;
}
`
    );
    this._inputPassAux.setCSCode({
      csDefine: r,
      csMain: (
        /* wgsl */
        `
${i}
let alb = ${o("albedo")};
let nor = ${o("normal")};
out_normal[outIdx] = nor.rgb;
out_albedo[outIdx] = alb.rgb;
  `
      )
    }), this._inputPassColor.setCSCode({
      csDefine: r,
      csMain: (
        /* wgsl */
        `
${i}
`
      )
    }), this._outputPass.setCSCode({
      csDefine: (
        /* wgsl */
        `
${Il}
fn PUInverse(y: f32) -> f32 {
  if (y <= x0) {
    return y / a;
  } else if (y <= x1) {
    return pow((y - d) / b, 1 / c);
  } else {
    return exp((y - g) / e) - f;
  }
}
`
      ),
      csMain: (
        /* wgsl */
        `
let x = i32(globalId.x);
let y = i32(globalId.y);
if (x >= outputSize.x || y >= outputSize.y) {
  return;
}
let inIdx = (y + inputOffset.y) * inputSize.x + x + inputOffset.x;
let outIdx = (y + outputOffset.y) * imageSize.x + x + outputOffset.x;
let col = in_color[inIdx];
let raw = ${t ? "textureLoad(in_raw, globalId.xy + vec2u(outputOffset), 0)" : "in_raw[outIdx]"};

if (${e}) {
  out_color[outIdx] = vec4f(raw.rgb, 1.0 - col.r);
}
else if (${s}) {
  out_color[outIdx] = vec4f(
    vec3f(PUInverse(col.r * rcpNormScale), PUInverse(col.g * rcpNormScale), PUInverse(col.b * rcpNormScale)) / inputScale,
    // Pick the alpha
    raw.a
  );
}
else {
  out_color[outIdx] = vec4f(col.rgb, raw.a);
}
`
      )
    });
  }
  setImageSize(t, e) {
    this._inputPassAux.setUniform("inputSize", new Int32Array([t, e])), this._inputPassColor.setUniform("inputSize", new Int32Array([t, e])), this._outputPass.setUniform("imageSize", new Int32Array([t, e])), this._outputPass.setSize(t, e), this._copyPass.setSize(t, e), this._copyPass.setUniform("size", new Int32Array([t, e]));
  }
  setInputTile(t) {
    const e = new Int32Array([t.width, t.height]);
    [this._inputPassAux, this._inputPassColor].forEach((s) => {
      s.setUniform("inputOffset", new Int32Array([t.x, t.y])), s.setUniform("outputSize", e), s.setSize(e[0], e[1]);
    }), this._outputPass.setUniform("inputSize", e);
  }
  setOutputTile(t, e) {
    const s = this._outputPass, r = new Int32Array([t.width, t.height]), o = t.x - e.x, i = t.y - e.y;
    s.setUniform("outputSize", r), s.setUniform("inputOffset", new Int32Array([o, i])), s.setUniform(
      "outputOffset",
      new Int32Array([t.x, t.y])
    ), s.setExecuteSize(r[0], r[1]);
  }
  forward(t, e, s, r) {
    const o = t instanceof GPUTexture;
    this._updatePasses(o, r);
    const i = this._inputPassAux, a = this._inputPassColor, l = this._device.createCommandEncoder();
    function u(c) {
      return c instanceof GPUTexture ? {
        texture: c,
        channels: 4
      } : {
        buffer: c,
        channels: 4
      };
    }
    return e && s ? i.createPass(l, {
      color: u(t),
      albedo: u(e),
      normal: u(s)
    }) : a.createPass(l, {
      color: u(t)
    }), this._device.queue.submit([l.finish()]), e && s ? {
      color: i.getOutput("color"),
      albedo: i.getOutput("albedo"),
      normal: i.getOutput("normal")
    } : {
      color: a.getOutput("color")
    };
  }
  inverse(t, e) {
    const r = this._device.createCommandEncoder(), o = this._outputPass;
    return o.createPass(r, {
      color: { buffer: t, channels: 4 },
      raw: e instanceof GPUBuffer ? { buffer: e, channels: 4 } : { texture: e, channels: 4 }
    }), this._device.queue.submit([r.finish()]), o.getOutput("color");
  }
  copyInputDataToOutput(t) {
    const e = this._device.createCommandEncoder(), r = this._outputPass.getOutput("color"), o = this._copyPass;
    t instanceof GPUTexture ? (o.setOutputBuffers({
      color: r
    }), o.createPass(e, {
      color: { texture: t, channels: 4 }
    })) : e.copyBufferToBuffer(
      t,
      0,
      r,
      0,
      r.size
    ), this._device.queue.submit([e.finish()]);
  }
  dispose() {
    this._outputPass.dispose(), this._inputPassAux.dispose();
  }
}
function $l(n, t) {
  const e = n.buffer;
  if (t === "Float32")
    return new Float32Array(n.buffer);
  const s = new ht(e), r = new Float32Array(s.length);
  for (let o = 0; o < r.length; ++o)
    r[o] = s[o];
  return r;
}
function bx(n, t) {
  const [e, s, r, o] = t, i = new Float32Array(n.length);
  for (let a = 0; a < e; ++a)
    for (let l = 0; l < s; ++l)
      for (let u = 0; u < r; ++u)
        for (let c = 0; c < o; ++c) {
          const h = a * s * r * o + l * r * o + u * o + c, f = u * o * s * e + c * s * e + l * e + a;
          i[f] = n[h];
        }
  return i;
}
function ys(n, t) {
  return Math.ceil(n / t) * t;
}
function Zs(n) {
  return n.data instanceof GPUBuffer || n.data instanceof GPUTexture;
}
const yx = 174, wx = 202, nf = 16, Qs = ys(yx / 2, nf), Al = ys(wx / 2, nf);
class xx {
  constructor(t, e, s = {}) {
    G(this, "_tfModel");
    G(this, "_device");
    // TODO calculate the tile size from memory size
    // https://github.com/RenderKit/oidn/blob/713ec7838ba650f99e0a896549c0dca5eeb3652d/core/unet_filter.cpp#L287
    G(this, "_tileWidth", 0);
    G(this, "_tileHeight", 0);
    G(this, "_tileOverlapX", 0);
    G(this, "_tileOverlapY", 0);
    G(this, "_aux");
    G(this, "_hdr");
    G(this, "_dataProcessGPU");
    G(this, "_maxTileSize");
    G(this, "_tensors", /* @__PURE__ */ new Map());
    G(this, "_modelsCache", /* @__PURE__ */ new Map());
    this._hostTensors = t, this._backend = e, this._aux = s.aux || !1, this._hdr = s.hdr || !1, this._maxTileSize = ys(s.maxTileSize ?? 512, 2), this._device = this._backend.device;
  }
  getDevice() {
    return this._device;
  }
  _buildModel(t) {
    const s = 3 + (this._aux ? 6 : 0), r = this._getTileSizeWithOverlap(), o = this._modelsCache, i = [r.width, r.height].join(",");
    if (o.has(i)) {
      this._tfModel = o.get(i);
      return;
    }
    const a = Qw({
      name: "input",
      shape: [r.height, r.width, s],
      dtype: "float32"
    });
    this._tfModel = new Jr({
      inputs: [a],
      outputs: t ? this._addNetLarge(a) : this._addNet(a)
    }), o.set(i, this._tfModel);
  }
  _createConv(t, e, s) {
    const r = t + ".weight", o = t + ".bias", i = this._tensors;
    let a = i.get(r), l = i.get(o);
    const u = this._hostTensors.get(r);
    if (!a) {
      const h = u.desc.dims;
      a = nr(
        bx(
          $l(u.data, u.desc.dataType),
          h
        ),
        [h[2], h[3], h[1], h[0]],
        "float32"
      ), i.set(r, a);
    }
    if (!l) {
      const h = this._hostTensors.get(t + ".bias");
      l = Dt(
        $l(h.data, h.desc.dataType),
        "float32"
      ), i.set(o, l);
    }
    return new Zn({
      name: t,
      filters: u.desc.dims[0],
      kernelSize: u.desc.dims.slice(2, 4),
      useBias: !0,
      activation: s,
      padding: "same",
      weights: [a, l],
      trainable: !1
    }).apply(e);
  }
  _createConcatConv(t, e, s) {
    const r = new Ki({
      name: t + "/concat",
      trainable: !1,
      axis: 3
    });
    return this._createConv(
      t,
      // Concat on the channel
      r.apply([e, s]),
      "relu"
    );
  }
  _createPooling(t) {
    return new qi({
      name: t.name + "/pooling",
      poolSize: [2, 2],
      strides: [2, 2],
      padding: "same",
      trainable: !1
    }).apply(t);
  }
  _addUpsamplingLayer(t) {
    return new Vi({
      name: t.name + "/upsampling",
      size: [2, 2],
      trainable: !1
    }).apply(t);
  }
  _addNet(t) {
    let e = this._createConv("enc_conv0", t, "relu");
    const s = e = this._createPooling(
      this._createConv("enc_conv1", e, "relu")
    ), r = e = this._createPooling(
      this._createConv("enc_conv2", e, "relu")
    ), o = e = this._createPooling(
      this._createConv("enc_conv3", e, "relu")
    ), i = e = this._createPooling(
      this._createConv("enc_conv4", e, "relu")
    );
    return e = this._createConv("enc_conv5a", i, "relu"), e = this._addUpsamplingLayer(this._createConv("enc_conv5b", e, "relu")), e = this._createConcatConv("dec_conv4a", e, o), e = this._addUpsamplingLayer(this._createConv("dec_conv4b", e, "relu")), e = this._createConcatConv("dec_conv3a", e, r), e = this._addUpsamplingLayer(this._createConv("dec_conv3b", e, "relu")), e = this._createConcatConv("dec_conv2a", e, s), e = this._addUpsamplingLayer(this._createConv("dec_conv2b", e, "relu")), e = this._createConcatConv("dec_conv1a", e, t), e = this._createConv("dec_conv1b", e, "relu"), e = this._createConv("dec_conv0", e, "relu"), e;
  }
  _addNetLarge(t) {
    let e = this._createConv("enc_conv1a", t, "relu");
    const s = e = this._createPooling(
      this._createConv("enc_conv1b", e, "relu")
    );
    e = this._createConv("enc_conv2a", e, "relu");
    const r = e = this._createPooling(
      this._createConv("enc_conv2b", e, "relu")
    );
    e = this._createConv("enc_conv3a", e, "relu");
    const o = e = this._createPooling(
      this._createConv("enc_conv3b", e, "relu")
    );
    e = this._createConv("enc_conv4a", e, "relu");
    const i = e = this._createPooling(
      this._createConv("enc_conv4b", e, "relu")
    );
    return e = this._createConv("enc_conv5a", i, "relu"), e = this._addUpsamplingLayer(this._createConv("enc_conv5b", e, "relu")), e = this._createConcatConv("dec_conv4a", e, o), e = this._addUpsamplingLayer(this._createConv("dec_conv4b", e, "relu")), e = this._createConcatConv("dec_conv3a", e, r), e = this._addUpsamplingLayer(this._createConv("dec_conv3b", e, "relu")), e = this._createConcatConv("dec_conv2a", e, s), e = this._addUpsamplingLayer(this._createConv("dec_conv2b", e, "relu")), e = this._createConcatConv("dec_conv1a", e, t), e = this._createConv("dec_conv1b", e, "relu"), e = this._createConv("dec_conv1c", e, "relu"), e;
  }
  _updateModel(t, e) {
    const s = this._hostTensors.has("enc_conv1b.weight"), r = this._maxTileSize;
    let o = r, i = r, a = s ? Al : Qs, l = s ? Al : Qs;
    t < r + Qs * 2 && (o = ys(t, r / 2), t <= r && (a = 0)), e < r + Qs * 2 && (i = ys(e, r / 2), e <= r && (l = 0));
    const u = Math.max(o, i), c = Math.max(a, l);
    o = u, i = u, a = c, l = c, (o !== this._tileWidth || i !== this._tileHeight || a !== this._tileOverlapX || l !== this._tileOverlapY || !this._tfModel) && (this._tileWidth = o, this._tileHeight = i, this._tileOverlapX = a, this._tileOverlapY = l, this._buildModel(s));
  }
  _getTileSizeWithOverlap() {
    return {
      width: this._tileWidth + 2 * this._tileOverlapX,
      height: this._tileHeight + 2 * this._tileOverlapY
    };
  }
  _processImageData(t, e, s, r) {
    const o = t.data, i = o.length / 4, a = this._aux ? 9 : 3, l = new Float32Array(i * a);
    if (e && !s || s && !e)
      throw new Error("Normal map and albedo map are both required");
    if (e && s && (e.width !== s.width || e.height !== s.height || t.width !== e.width || t.height !== e.height))
      throw new Error("Image size mismatch");
    const u = e == null ? void 0 : e.data, c = s == null ? void 0 : s.data;
    for (let h = 0; h < o.length; h += 4) {
      const f = h / 4 * a;
      for (let d = 0; d < 3; d++)
        r ? l[f + d] = o[h + d] : l[f + d] = o[h + d] / 255, u && (l[f + d + 3] = u[h + d] / 255), c && (l[f + d + 6] = c[h + d] / 255);
    }
    return l;
  }
  _readTile(t, e, s, r) {
    const o = new Float32Array(
      s.width * s.height * e
    ), i = Math.max(1, Math.floor(t.length / Math.max(1, r * e)));
    for (let a = 0; a < s.height; a++)
      for (let l = 0; l < s.width; l++) {
        // The UNet works on aligned square tiles (256/512/768), while an RTX
        // frame can be any aspect ratio (for example 603x359). The upstream
        // reader indexed the padded part past the source Float32Array, which
        // injected NaNs and made the complete network output black. Replicate
        // the nearest edge pixel into the padding so every tensor stays finite.
        const u = Math.max(0, Math.min(i - 1, a + s.y)), c = Math.max(0, Math.min(r - 1, l + s.x)), h = (u * r + c) * e, f = (a * s.width + l) * e;
        for (let c = 0; c < e; c++)
          o[f + c] = t[h + c];
      }
    return o;
  }
  _writeTile(t, e, s, r, o, i) {
    const { data: a, width: l } = t, u = s.x - e.x, c = s.y - e.y;
    for (let h = 0; h < s.height; h++)
      for (let f = 0; f < s.width; f++) {
        const d = ((h + c) * o + f + u) * 3, p = ((h + s.y) * l + (f + s.x)) * 4;
        for (let g = 0; g < 3; g++)
          i ? a[p + g] = r[d + g] : a[p + g] = Math.min(
            Math.max(r[d + g] * 255, 0),
            255
          );
        t.data[p + 3] = i ? 1 : 255;
      }
  }
  async _executeTile(t, e, s, r, o, i, a, l, u) {
    const c = this._aux ? 9 : 3, h = this._tileOverlapX, f = this._tileOverlapY;
    let d = this._getTileSizeWithOverlap(), p = { width: this._tileWidth, height: this._tileHeight }, g = r > 0 ? r * p.width - h : 0, m = Math.min(g + d.width, i);
    g = Math.max(m - d.width, 0);
    let b = o > 0 ? o * p.height - f : 0, y = Math.min(b + d.height, a);
    b = Math.max(y - d.height, 0);
    const S = d.width, x = d.height, v = new $o(g, b, S, x);
    let E, D = 1;
    const k = this._device;
    let T = this._dataProcessGPU;
    if (t instanceof Float32Array) {
      let U = this._readTile(t, c, v, i);
      l && (D = dx({
        data: U,
        channels: c
      }), U = px({
        data: U,
        channels: c,
        inputScale: D
      })), E = nr(
        U,
        [1, x, S, c],
        "float32"
      );
    } else {
      T || (T = this._dataProcessGPU = new gx(
        k,
        l
      )), T.setImageSize(i, a), T.setInputTile(v), r === 0 && o === 0 && T.copyInputDataToOutput(t.color);
      const { color: U, albedo: j, normal: jt } = T.forward(
        t.color,
        this._aux ? t.albedo : void 0,
        this._aux ? t.normal : void 0,
        u
      ), Ot = (le) => {
        const Mt = nr({ buffer: le, zeroCopy: !0 }, [
          1,
          x,
          S,
          4
        ]);
        return ws(
          Mt,
          [0, 0, 0, 0],
          [1, x, S, 3]
        );
      };
      if (this._aux) {
        const le = [U, j, jt].map(
          (Mt) => Ot(Mt)
        );
        E = jp(le, 3);
      } else
        E = Ot(U);
    }
    let R;
    const B = this._tfModel.predict(E), H = Math.min(p.width, i), X = Math.min(p.height, a), W = new $o(r * H, o * X, H, X);
    if (W.width = Math.min(W.width, i - W.x), W.height = Math.min(W.height, a - W.y), t instanceof Float32Array) {
      // Avoid Tensor.dataSync(): Chromium warns about the blocking WebGPU to
      // CPU transfer and it can stall the render UI. data() maps the result
      // asynchronously and resolves only after the submitted queue is ready.
      let U = await B.data();
      l && (U = mx({
        data: U,
        channels: 3,
        inputScale: D
      })), this._writeTile(
        s,
        v,
        W,
        U,
        d.width,
        l
      );
      for (let j = 0; j < X; j++)
        for (let jt = 0; jt < H; jt++) {
          const Ot = (j * H + jt) * 4, le = ((j + W.y) * i + (jt + W.x)) * 4;
          for (let Mt = 0; Mt < 4; Mt++)
            e.data[Ot + Mt] = s.data[le + Mt];
        }
    } else {
      T.setOutputTile(W, v);
      const U = zp(B, [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 1]
      ]);
      R = T.inverse(
        U.dataToGPU().buffer,
        t.color
      );
    }
    return R;
  }
  tileExecute({
    color: t,
    albedo: e,
    normal: s,
    done: r,
    progress: o,
    denoiseAlpha: i,
    error: ae
  }) {
    if (this._aux && (!e || !s))
      throw new Error("Normal map and albedo map are both required");
    if (!this._aux && (e || s))
      throw new Error("Normal map and albedo map are not required");
    const a = t.width, l = t.height;
    this._updateModel(a, l);
    const u = this._hdr || !1;
    let c;
    Zs(t) || (c = this._processImageData(
      t,
      e,
      s,
      u
    ));
    const h = this._tileWidth, f = this._tileHeight, d = Math.ceil(l / f), p = Math.ceil(a / h);
    function g(x, v) {
      return u ? {
        data: new Float32Array(x * v * 4),
        width: x,
        height: v
      } : new ImageData(x, v);
    }
    const m = Zs(t) ? void 0 : g(a, l), b = Zs(t) ? void 0 : g(Math.min(h, a), Math.min(f, l));
    let y = !1;
    const S = async (x, v) => {
      if (y)
        return;
      let E;
      try {
        A.startScope(), E = await this._executeTile(
          Zs(t) ? {
            color: t.data,
            albedo: e == null ? void 0 : e.data,
            normal: s == null ? void 0 : s.data
          } : c,
          b,
          m,
          x,
          v,
          a,
          l,
          u,
          i
        );
      } catch (D) {
        y = !0, ae == null || ae(D);
        return;
      } finally {
        A.endScope();
      }
      const D = m || {
        data: E,
        width: a,
        height: l
      };
      o == null || o(
        D,
        // Is undefined if using webgpu buffer
        b,
        new $o(x * h, v * f, h, f),
        x + v * p,
        p * d
      ), x + 1 < p || v + 1 < d ? requestAnimationFrame(() => {
        x + 1 < p ? S(x + 1, v) : v + 1 < d && S(0, v + 1);
      }) : r(D);
    };
    return void S(0, 0), () => {
      y = !0;
    };
  }
  dispose() {
    var t, e;
    (t = this._tfModel) == null || t.dispose(), (e = this._dataProcessGPU) == null || e.dispose(), this._tensors.forEach((s) => s.dispose());
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Xt = V();
Xt.registerFlag("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE", () => 15);
Xt.registerFlag("WEBGPU_CPU_FORWARD", () => !0);
Xt.registerFlag("WEBGPU_MATMUL_PROGRAM_TYPE", () => -1);
Xt.registerFlag("WEBGPU_USE_NAIVE_CONV2D_TRANSPOSE", () => !0);
Xt.registerFlag("WEBGPU_USE_LOW_POWER_GPU", () => !1);
Xt.registerFlag("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD", () => 1e3);
Xt.registerFlag("WEBGPU_USE_PROFILE_TOOL", () => !1);
Xt.registerFlag("WEBGPU_IMPORT_EXTERNAL_TEXTURE", () => !0);
Xt.registerFlag("WEBGPU_USE_NAIVE_CONV2D_DEBUG", () => !1);
Xt.registerFlag("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL", () => -1);
Xt.registerFlag("WEBGPU_CONV_SEPARATE_IM2COL_SHADER", () => !1);
Xt.registerFlag("WEBGPU_PRINT_SHADER", () => "");
Xt.registerFlag("WEBGPU_ENGINE_COMPILE_ONLY", () => !1);
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Sx {
  constructor(t) {
    t && (this.vendor = t.vendor, this.architecture = t.architecture, this.intelGPUGeneration = this.getIntelGPUGeneration());
  }
  getIntelGPUGeneration() {
    if (this.isIntel()) {
      if (this.architecture.startsWith("gen"))
        return Number(this.architecture.match(/\d+/));
      if (this.architecture.startsWith("xe"))
        return 12;
    }
    return 0;
  }
  isIntel() {
    return this.vendor === "intel";
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class vx {
  constructor(t) {
    this.device = t, this.numUsedBuffers = 0, this.numFreeBuffers = 0, this.freeBuffers = /* @__PURE__ */ new Map(), this.usedBuffers = /* @__PURE__ */ new Map(), this.numBytesUsed = 0, this.numBytesAllocated = 0;
  }
  acquireBuffer(t, e, s = !1, r = !0) {
    let o;
    const i = El(t, e);
    return r ? (this.freeBuffers.has(i) || this.freeBuffers.set(i, []), this.freeBuffers.get(i).length > 0 ? (o = this.freeBuffers.get(i).pop(), this.numFreeBuffers--) : (o = this.device.createBuffer({ size: t, usage: e, mappedAtCreation: s }), this.numBytesAllocated += t)) : (o = this.device.createBuffer({ size: t, usage: e, mappedAtCreation: s }), this.numBytesAllocated += t), this.usedBuffers.has(i) || this.usedBuffers.set(i, []), this.usedBuffers.get(i).push(o), this.numUsedBuffers++, this.numBytesUsed += t, o;
  }
  releaseBuffer(t, e = !0) {
    if (this.freeBuffers.size === 0)
      return;
    const s = t.size, r = t.usage, o = El(s, r), i = this.usedBuffers.get(o), a = i.indexOf(t);
    if (a < 0)
      throw new Error("Cannot find the buffer in buffer manager");
    i[a] = i[i.length - 1], i.pop(), this.numUsedBuffers--, this.numBytesUsed -= s, e ? (this.freeBuffers.get(o).push(t), this.numFreeBuffers++) : (t.destroy(), this.numBytesAllocated -= s);
  }
  getNumUsedBuffers() {
    return this.numUsedBuffers;
  }
  getNumFreeBuffers() {
    return this.numFreeBuffers;
  }
  dispose() {
    this.freeBuffers.forEach((t, e) => {
      t.forEach((s) => {
        s.destroy();
      });
    }), this.usedBuffers.forEach((t, e) => {
      t.forEach((s) => {
        s.destroy();
      });
    }), this.freeBuffers = /* @__PURE__ */ new Map(), this.usedBuffers = /* @__PURE__ */ new Map(), this.numUsedBuffers = 0, this.numFreeBuffers = 0, this.numBytesUsed = 0, this.numBytesAllocated = 0;
  }
}
function El(n, t) {
  return `${n}_${t}`;
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Ix {
  constructor(t) {
    this.device = t, this.numUsedTextures = 0, this.numFreeTextures = 0, this.freeTextures = /* @__PURE__ */ new Map(), this.usedTextures = /* @__PURE__ */ new Map(), this.numBytesUsed = 0, this.numBytesAllocated = 0;
  }
  acquireTexture(t, e, s, r) {
    const o = Cl(s), i = t * e * o, a = _l(t, e, s, r);
    if (this.freeTextures.has(a) || this.freeTextures.set(a, []), this.usedTextures.has(a) || this.usedTextures.set(a, []), this.numBytesUsed += i, this.numUsedTextures++, this.freeTextures.get(a).length > 0) {
      this.numFreeTextures--;
      const u = this.freeTextures.get(a).shift();
      return this.usedTextures.get(a).push(u), u;
    }
    this.numBytesAllocated += i;
    const l = this.device.createTexture({
      size: [t, e],
      format: s,
      usage: r
    });
    return this.usedTextures.get(a).push(l), l;
  }
  releaseTexture(t) {
    if (this.freeTextures.size === 0)
      return;
    const e = t.width, s = t.height, r = t.format, o = t.usage, i = _l(e, s, r, o);
    this.freeTextures.has(i) || this.freeTextures.set(i, []), this.freeTextures.get(i).push(t), this.numFreeTextures++, this.numUsedTextures--;
    const a = this.usedTextures.get(i), l = a.indexOf(t);
    if (l < 0)
      throw new Error("Cannot release a texture that was never provided by this texture manager");
    a.splice(l, 1);
    const u = Cl(r), c = e * s * u;
    this.numBytesUsed -= c;
  }
  getNumUsedTextures() {
    return this.numUsedTextures;
  }
  getNumFreeTextures() {
    return this.numFreeTextures;
  }
  dispose() {
    this.freeTextures.forEach((t, e) => {
      t.forEach((s) => {
        s.destroy();
      });
    }), this.usedTextures.forEach((t, e) => {
      t.forEach((s) => {
        s.destroy();
      });
    }), this.freeTextures = /* @__PURE__ */ new Map(), this.usedTextures = /* @__PURE__ */ new Map(), this.numUsedTextures = 0, this.numFreeTextures = 0, this.numBytesUsed = 0, this.numBytesAllocated = 0;
  }
}
function _l(n, t, e, s) {
  return `${n}_${t}_${e}_${s}`;
}
function Cl(n) {
  if (n === "rgba8unorm")
    return 16;
  throw new Error(`${n} is not supported!`);
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $x(n, t) {
  if (Math.max(...n) > 5)
    throw new Error("Cannot symbolically compute strides for rank > 6 tensor.");
  const e = n.length, s = "xyzwuv", r = n.map((i) => `${t}.${s[i]}`), o = new Array(e - 1);
  o[e - 2] = r[e - 1];
  for (let i = e - 3; i >= 0; --i)
    o[i] = `(${o[i + 1]} * ${r[i + 1]})`;
  return o;
}
const Ax = (n, t, e) => `
          {
            var oldValue = 0;
            loop {
              let newValueF32 = bitcast<f32>(oldValue) + (${t});
              let newValue = bitcast<i32>(newValueF32);
              let res = atomicCompareExchangeWeak(${n}, oldValue, newValue);
              if res.exchanged {
                break;
              }
              oldValue = res.old_value;
            }
          }`;
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var Or;
(function(n) {
  n[n.FROM_PIXELS = 0] = "FROM_PIXELS", n[n.DRAW = 1] = "DRAW";
})(Or || (Or = {}));
const Ex = (n, t, e, s, r) => {
  const o = { dtype: s.dtype, shape: s.shape }, i = Cx(e, o, t), a = n.createShaderModule({ code: i, label: t.constructor.name });
  let l = V().get("WEBGPU_PRINT_SHADER");
  if (l !== "") {
    l = l.toLowerCase();
    const u = l.split(",");
    (l === "all" || u.some((c) => t.shaderKey.toLowerCase().includes(c))) && (console.group(t.shaderKey), console.debug(i), console.groupEnd());
  }
  return r ? n.createComputePipelineAsync({
    compute: { module: a, entryPoint: "_start" },
    label: t.constructor.name,
    layout: "auto"
  }) : n.createComputePipeline({
    compute: { module: a, entryPoint: "_start" },
    label: t.constructor.name,
    layout: "auto"
  });
}, K = (n, t = "f32") => {
  switch (n) {
    case 1:
      return `${t}`;
    case 2:
      return `vec2<${t}>`;
    case 3:
      return `vec3<${t}>`;
    case 4:
      return `vec4<${t}>`;
    default:
      throw new Error(`${n}-component ${t} is not supported.`);
  }
};
function Tt(n) {
  if (n <= 1)
    return "i32";
  if (n === 2)
    return "vec2<i32>";
  if (n === 3)
    return "vec3<i32>";
  if (n === 4)
    return "vec4<i32>";
  if (n === 5)
    return "vec5";
  if (n === 6)
    return "vec6";
  throw Error(`GPU for rank ${n} is not yet supported`);
}
function cn(n) {
  if (n === 0)
    return "x";
  if (n === 1)
    return "y";
  if (n === 2)
    return "z";
  if (n === 3)
    return "w";
  if (n === 4)
    return "u";
  if (n === 5)
    return "v";
  throw Error(`Index ${n} is not yet supported`);
}
function wt(...n) {
  let t;
  switch (n.length) {
    case 0:
      t = `
        fn main()
      `;
      break;
    case 1:
      t = `
        fn main(${n[0]} : i32)
      `;
      break;
    default:
      throw Error("Unreachable");
  }
  return t;
}
function kl(n, t) {
  let e;
  return e = `
     ${_x(t)}
      fn _start(@builtin(local_invocation_id) LocalId : vec3<u32>,
                @builtin(global_invocation_id) GlobalId : vec3<u32>,
                @builtin(local_invocation_index) LocalIndex: u32,
                @builtin(workgroup_id) WorkgroupId : vec3<u32>,
                @builtin(num_workgroups) NumWorkgroups : vec3<u32>) {
        localId = LocalId;
        localIndex = LocalIndex;
        globalId = GlobalId;
        numWorkgroups = NumWorkgroups;
        workgroupId = WorkgroupId;
        ${n ? "main(getGlobalIndex());" : "main();"};
      }
    `, e;
}
function _x(n) {
  return `
  @compute @workgroup_size(${n.workgroupSize[0]}, ${n.workgroupSize[1]}, ${n.workgroupSize[2]})
`;
}
function Cx(n, t, e) {
  const s = [], r = e.workgroupSize[0] * e.workgroupSize[1] * e.workgroupSize[2];
  if (e.outputComponent = e.outputComponent ? e.outputComponent : 1, s.push(`

      var<private> localId: vec3<u32>;
      var<private> localIndex: u32;
      var<private> globalId: vec3<u32>;
      var<private> numWorkgroups: vec3<u32>;
      var<private> workgroupId: vec3<u32>;

      // Only used when the y/z dimension of workgroup size is 1.
      fn getGlobalIndex() -> i32 {
        ${sf(e) ? "  return i32(globalId.x);" : `  return i32((workgroupId.z * numWorkgroups.x * numWorkgroups.y +
                workgroupId.y * numWorkgroups.x + workgroupId.x) * ${r}u +
                localIndex);
        `}
      }
    `), e.pixelsOpType != null) {
    const p = e.pixelsOpType === Or.FROM_PIXELS ? `@group(0) @binding(0) var<storage, read_write> result: array<${Tn(t.dtype, e.outputComponent)}>;` : `@group(0) @binding(1) var<storage, read> inBuf : array<${Tn(n[0].dtype, e.outputComponent)}>;`, g = t.shape.length === 3 ? "vec2<i32>" : "i32";
    s.push(`
        struct Uniform {
          outShapeStrides : ${g},
          size            : i32,
          numChannels     : i32,
          alpha           : f32,
        };

        ${p}
        @group(0) @binding(2) var<uniform> uniforms: Uniform;
      `);
    const m = Nl(e);
    return [
      Tl,
      s.join(`
`),
      Ao(t.shape),
      e.getUserCode(),
      kl(m, e)
    ].join(`
`);
  }
  let o, i, a = "struct Uniforms { NAN : f32, INFINITY : f32, ";
  e.variableNames.forEach((p, g) => {
    const m = Tt(n[g].shape.length);
    a += `${p.charAt(0).toLowerCase() + p.slice(1)}Shape : ${m}, `, o = n[g].shape.length - 1, i = Tt(o), a += `${p.charAt(0).toLowerCase() + p.slice(1)}ShapeStrides: ${i}, `;
  });
  const l = Tt(t.shape.length);
  a += `outShape : ${l}, `, o = t.shape.length - 1, i = Tt(o), a += `
         outShapeStrides: ${i}, `, e.size && (a += "size : i32, "), e.uniforms && (a += e.uniforms), a += "};", a = Mx(a), s.push(a), e.atomic ? s.push(`
      @group(0) @binding(0) var<storage, read_write> result: array<atomic<i32>>;
    `) : s.push(`
      @group(0) @binding(0) var<storage, read_write> result: array<${Tn(t.dtype, e.outputComponent)}>;
    `), e.variableNames.forEach((p, g) => {
    s.push(`
      @group(0) @binding(${1 + g}) var<storage, read> ${p}: array<${e.variableComponents ? Tn(n[g].dtype, e.variableComponents[g]) : Tn(n[g].dtype, e.outputComponent)}>;
        `);
  }), a !== "" && s.push(`
      @group(0) @binding(${1 + e.variableNames.length}) var<uniform> uniforms: Uniforms;
      `);
  const u = Rx(t.shape, e.dispatchLayout), c = [
    Tl,
    s.join(`
`) + Tx,
    Ao(t.shape),
    u,
    Lx(t.shape.length)
  ];
  e.atomic || c.push(Ox(t.shape, t.dtype, e.outputComponent)), e.variableNames.forEach((p, g) => {
    c.push(`${Ao(n[g].shape, p)}`);
  });
  const h = n.map((p, g) => Px(p, t.shape, e.variableComponents ? e.variableComponents[g] : e.outputComponent, e.dispatchLayout.x.length === t.shape.length)).join(`
`);
  c.push(h), c.push(e.getUserCode());
  const f = Nl(e);
  return c.push(kl(f, e)), c.join(`
`);
}
function kx(n, t, e) {
  let s = n.shaderKey;
  if (n.pixelsOpType != null)
    return s;
  const r = [], o = [];
  t.forEach((c) => {
    r.push(c.shape), o.push(c.dtype);
  }), r.push(e.shape), o.push(e.dtype);
  const i = t.map((c) => dr(c.shape, e.shape)), a = t.map((c) => oe(c.shape, e.shape)).join("_"), l = i.map((c) => c.join("_")).join(";"), u = sf(n) ? "flatDispatch" : "";
  return s += "_" + (n.workgroupSize ? n.workgroupSize.join(",") : "") + r.map((c) => c.length).join(",") + o.join(",") + n.variableNames.join(",") + l + a + u, s;
}
const Tl = `
  struct vec5 {x: i32, y: i32, z: i32, w: i32, u: i32};
  struct vec6 {x: i32, y: i32, z: i32, w: i32, u: i32, v: i32};

  // Checks whether coordinates lie within the bounds of the shape.
  fn coordsInBounds2D(coord : vec2<i32>, shape : vec2<i32>) -> bool {
    return all(coord >= vec2<i32>(0)) && all(coord < shape);
  }
  fn coordsInBounds3D(coord : vec3<i32>, shape : vec3<i32>) -> bool {
    return all(coord >= vec3<i32>(0)) && all(coord < shape);
  }
  fn coordsInBounds4D(coord : vec4<i32>, shape : vec4<i32>) -> bool {
    return all(coord >= vec4<i32>(0)) && all(coord < shape);
  }

  fn getIndexFromCoords1D(coord : i32, shape : i32) -> i32 {
    return coord;
  }
  fn getIndexFromCoords2D(coords : vec2<i32>, shape : vec2<i32>) -> i32 {
    return dot(coords, vec2<i32>(shape.y, 1));
  }
  fn getIndexFromCoords3D(coords : vec3<i32>, shape : vec3<i32>) -> i32 {
    return dot(coords, vec3<i32>(shape.y * shape.z, shape.z, 1));
  }
  fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
    return dot(coords, vec4<i32>(
        shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
  }
  fn getIndexFromCoords5D(coords : vec5, shape : vec5) -> i32 {
    let shapeStrides: vec5 = vec5(shape.y * shape.z * shape.w * shape.u, shape.z * shape.w * shape.u, shape.w * shape.u, shape.u, 1);
    return coords.x*shapeStrides.x + coords.y*shapeStrides.y + coords.z*shapeStrides.z + coords.w*shapeStrides.w + coords.u*shapeStrides.u;
  }
  fn getIndexFromCoords6D(coords : vec6, shape : vec6) -> i32 {
    let shapeStrides: vec6 = vec6(shape.y * shape.z * shape.w * shape.u * shape.v, shape.z * shape.w * shape.u * shape.v, shape.w * shape.u * shape.v, shape.u * shape.v, shape.v, 1);
    return coords.x*shapeStrides.x + coords.y*shapeStrides.y + coords.z*shapeStrides.z + coords.w*shapeStrides.w + coords.u*shapeStrides.u + coords.v*shapeStrides.v;
  }

  // NaN defination in IEEE 754-1985 is :
  //   - sign = either 0 or 1.
  //   - biased exponent = all 1 bits.
  //   - fraction = anything except all 0 bits (since all 0 bits represents infinity).
  // https://en.wikipedia.org/wiki/IEEE_754-1985#Representation_of_non-numbers
  fn isnan(val: f32) -> bool {
    let floatToUint: u32 = bitcast<u32>(val);
    return (floatToUint & 0x7fffffffu) > 0x7f800000u;
  }
  fn isnanVec4(val : vec4<f32>) -> vec4<bool> {
    let floatToUint: vec4<u32> = bitcast<vec4<u32>>(val);
    return (floatToUint & vec4<u32>(0x7fffffffu)) > vec4<u32>(0x7f800000u);
  }
`, Tx = `
  fn isinf(val: f32) -> bool {
    return abs(val) == uniforms.INFINITY;
  }
`;
function Ao(n, t = "") {
  const e = n.length, s = t !== "" ? `get${t.charAt(0).toUpperCase() + t.slice(1)}CoordsFromIndex` : "getCoordsFromIndex", r = t !== "" ? `${t.charAt(0).toLowerCase() + t.slice(1)}ShapeStrides` : "outShapeStrides";
  if (e <= 1)
    return `fn ${s}(index : i32) -> i32 { return index; }`;
  const o = Kt(n), i = Tt(e), a = [];
  for (let u = 0; u < e; u++)
    a.push(`d${u}`);
  if (o.length === 1)
    return `    fn ${s}(index : i32) -> vec2<i32> {
      let d0 = index / uniforms.${r}; let d1 = index - d0 * uniforms.${r};
      return vec2<i32>(d0, d1);
    }`;
  let l;
  return l = "var index2 = index;" + o.map((u, c) => {
    const h = `let ${a[c]} = index2 / uniforms.${r}.${cn(c)}`, f = c === o.length - 1 ? `let ${a[c + 1]} = index2 - ${a[c]} * uniforms.${r}.${cn(c)}` : `index2 = index2 - ${a[c]} * uniforms.${r}.${cn(c)}`;
    return `${h}; ${f};`;
  }).join(""), `
    fn ${s}(index : i32) -> ${i} {
      ${l}
      return ${i}(${a.join(",")});
    }
  `;
}
function Nx(n, t) {
  const e = n.name, s = n.shape.length, r = Tt(s), o = "get" + e.charAt(0).toUpperCase() + e.slice(1), i = ["d0", "d1", "d2", "d3", "d4", "d5"].slice(0, s), a = i.map((c) => `${c} : i32`).join(", ");
  if (s < 1)
    return `
      fn ${o}() -> ${K(t)} {
        return ${K(t)}(${e}[0]);
      }
    `;
  const l = `uniforms.${e.charAt(0).toLowerCase() + e.slice(1)}Shape`;
  let u = `${s}D`;
  return s === 0 && (u = "1D"), `
    fn ${o}(${a}) -> ${K(t)} {
      return ${K(t)}(${e}[getIndexFromCoords${u}(${r}(${i.join(",")}),
        ${l})${t === 1 ? "" : ` / ${t}`}]);
    }
   `;
}
function Dx(n, t, e, s) {
  const r = n.name, o = r.charAt(0).toUpperCase() + r.slice(1), i = "get" + o + "ByOutput", a = n.shape.length, l = t.length, u = Tt(l);
  if (oe(n.shape, t) && s)
    return `
    fn ${i}Index(globalIndex : i32) -> ${K(e)} {
      return ${K(e)}(${r}[globalIndex]);
    }

    fn ${i}Coords(coords : ${u}) -> ${K(e)} {
      return ${K(e)}(${r}[${l > 1 ? "getOutputIndexFromCoords(coords)" : "coords"}${e === 1 ? "" : ` / ${e}`}]);
    }
    `;
  const c = dr(n.shape, t), h = l - a;
  let f = "";
  if (a === 0)
    return `
    fn ${i}Index(globalIndex : i32) -> ${K(e)}{
      return get${o}();
    }

    fn ${i}Coords(coords : ${u}) -> ${K(e)}{
      return get${o}();
    }
  `;
  l < 2 && c.length >= 1 ? f = "coords = 0;" : f = c.map((m) => `coords.${cn(m + h)} = 0;`).join(`
`);
  let d = "";
  if (l < 2 && a > 0)
    d = "coords";
  else if (l > 1) {
    const m = Tt(a), b = n.shape.map((y, S) => `coords.${cn(S + h)}`).join(", ");
    d = `${m}(${b})`;
  } else
    d = "coords";
  const p = `uniforms.${r.charAt(0).toLowerCase() + r.slice(1)}Shape`, g = `${a}D`;
  return `
  fn ${i}Index(globalIndex : i32) -> ${K(e)} {
    var coords = getCoordsFromIndex(globalIndex);
    ${f}
    return ${K(e)}(${r}[getIndexFromCoords${g}(${d}, ${p})${e === 1 ? "" : ` / ${e}`}]);
  }

  fn ${i}Coords(coordsIn : ${u}) -> ${K(e)} {
    var coords = coordsIn;
    ${f}
    return ${K(e)}(${r}[getIndexFromCoords${g}(${d}, ${p})${e === 1 ? "" : ` / ${e}`}]);
  }
`;
}
function Px(n, t, e, s) {
  let r = Nx(n, e);
  return n.shape.length <= t.length && (r += Dx(n, t, e, s)), r;
}
function Rx(n, t) {
  const { x: e, y: s = [], z: r = [] } = t, o = n.length, i = e.length + s.length + r.length;
  if (i !== o)
    return "";
  if (e.length === o)
    return `fn getOutputCoords() -> ${Tt(o)}{
    let globalIndex = getGlobalIndex();
    return getCoordsFromIndex(globalIndex);
  }
  `;
  let a = "";
  const l = [e, s, r];
  for (let f = 0; f < l.length; f++) {
    const d = l[f];
    if (d.length !== 0)
      if (d.length === 1)
        a += `let d${d[0]} = i32(globalId[${f}]);`;
      else {
        const p = $x(d, "uniforms.outShape");
        a += `var index${f} = i32(globalId[${f}]);`;
        for (let g = 0; g < p.length; g++)
          a += `let d${d[g]} = index${f} / ${p[g]};`, g === p.length - 1 ? a += `let d${d[g + 1]} = index${f} - d${d[g]} * ${p[g]};` : a += `index${f} = index${f} - d${d[g]} * ${p[g]};`;
      }
  }
  const u = [];
  for (let f = 0; f < i; f++)
    u.push(`d${f}`);
  const c = Tt(i);
  let h = `fn getOutputCoords() -> ${c} {
  ${a}
`;
  return u.length === 0 ? h += `return ${c}(0); }` : h += `return ${c}(${u.join(",")}); }`, h;
}
function Lx(n) {
  let t = "";
  switch (n) {
    case 0:
    case 1:
      t += `
        fn getOutputIndexFromCoords(coords : i32) -> i32 {
          return coords;
        }
        `;
      break;
    case 2:
      t += `
        fn getOutputIndexFromCoords(coords : vec2<i32>) -> i32 {
          return dot(coords, vec2<i32>(uniforms.outShapeStrides, 1));
        }
        `;
      break;
    case 3:
      t += `
        fn getOutputIndexFromCoords(coords : vec3<i32>) -> i32 {
          return dot(coords, vec3<i32>(uniforms.outShapeStrides.x, uniforms.outShapeStrides.y, 1));
        }
        `;
      break;
    case 4:
      t += `
        fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
          return dot(coords, vec4<i32>(
            uniforms.outShapeStrides.x, uniforms.outShapeStrides.y, uniforms.outShapeStrides.z, 1));
        }
        `;
      break;
    case 5:
      t += `
        fn getOutputIndexFromCoords(coords : vec5) -> i32 {
          return coords.x * uniforms.outShapeStrides.x +
              coords.y * uniforms.outShapeStrides.y +
              coords.z * uniforms.outShapeStrides.z +
              coords.w * uniforms.outShapeStrides.w +
              coords.u;
        }
        `;
      break;
    case 6:
      t += `
        fn getOutputIndexFromCoords(coords : vec6) -> i32 {
          return coords.x * uniforms.outShapeStrides.x +
              coords.y * uniforms.outShapeStrides.y +
              coords.z * uniforms.outShapeStrides.z +
              coords.w * uniforms.outShapeStrides.w +
              coords.u * uniforms.outShapeStrides.u +
              coords.v;
        }
        `;
      break;
    default:
      w(!1, () => `Unsupported ${n}D shape`);
      break;
  }
  return t;
}
function sf(n) {
  return n.dispatch[1] === 1 && n.dispatch[2] === 1;
}
function Tn(n, t = 1) {
  if (n === "float32")
    return K(t, "f32");
  if (n === "int32" || n === "bool")
    return K(t, "i32");
  throw new Error(`type ${n} is not supported.`);
}
function Ox(n, t, e) {
  const s = n.length, r = Tn(t, e);
  let o = `fn setOutputAtIndex(flatIndex : i32, value : ${K(e)}) {
      result[flatIndex] = ${r}(value);
    }

    fn setOutputAtIndexI32(flatIndex : i32, value : ${K(e, "i32")}) {
      result[flatIndex] = ${r}(value);
    }
    `;
  if (s >= 2) {
    const i = ["d0", "d1", "d2", "d3", "d4", "d5"].slice(0, s), a = Tt(s);
    o += `
      fn setOutputAtCoords(${i.map((l) => `${l} : i32`).join(", ")}, value : ${K(e)}) {
        let flatIndex = getOutputIndexFromCoords(${a}(${i.join(", ")}));
        setOutputAtIndex(flatIndex${e === 1 ? "" : ` / ${e}`}, value);
      }
      fn setOutputAtCoordsI32(${i.map((l) => `${l} : i32`).join(", ")}, value : ${K(e, "i32")}) {
        let flatIndex = getOutputIndexFromCoords(${a}(${i.join(", ")}));
        setOutputAtIndexI32(flatIndex${e === 1 ? "" : ` / ${e}`}, value);
      }
    `;
  }
  return o;
}
function Mx(n) {
  const t = /(\w+)\s*:\s*vec(5|6)/g;
  n = n.replace(t, (s) => "@align(16) " + s);
  const e = /vec(5|6)\s*,\s*(\w+)/g;
  return n = n.replace(e, (s, r, o) => `vec${r}, @align(16) ${o}`), n;
}
function Nl(n) {
  return !(n.dispatchLayout.hasOwnProperty("y") && n.dispatchLayout.y.length !== 0 || n.dispatchLayout.hasOwnProperty("z") && n.dispatchLayout.z.length !== 0);
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const hn = (n) => {
  let t = 1;
  for (let e = 0; e < n.length; e++)
    t *= n[e];
  return t;
};
function $t(n, t, e = [1, 1, 1], s = [1, 1, 1]) {
  const [r, o, i] = [
    Math.ceil(hn(n.x.map((a) => t[a])) / (e[0] * s[0])),
    n.y ? Math.ceil(hn(n.y.map((a) => t[a])) / (e[1] * s[1])) : 1,
    n.z ? Math.ceil(hn(n.z.map((a) => t[a])) / (e[2] * s[2])) : 1
  ];
  return [r, o, i];
}
function Bx(n, t, e, s = !1) {
  const r = [8, 8, 1], o = [4, 4, 1];
  return s || (n <= 8 && (o[1] = 1), t <= 16 && e <= 16 && (r[0] = 4)), { workgroupSize: r, elementsPerThread: o };
}
function Fx(n, t, e = !1) {
  if (e)
    return [8, 8, 1];
  const s = hn(n.x.map((o) => t[o])), r = hn(n.y.map((o) => t[o]));
  return s <= 4 ? [4, 16, 1] : r <= 4 ? [16, 4, 1] : [16, 16, 1];
}
function zx(n, t, e = !1) {
  if (e)
    return [4, 4, 1];
  const s = hn(n.x.map((o) => t[o])), r = hn(n.y.map((o) => t[o]));
  return s <= 4 ? [1, 2, 1] : r <= 4 ? [2, 1, 1] : [2, 2, 1];
}
function ae(n) {
  return { x: n.map((t, e) => e) };
}
function Dl(n) {
  if (n === "float32" || n === "int32" || n === "bool" || n === "string")
    return 4;
  if (n === "complex64")
    return 8;
  throw new Error(`Unknown dtype ${n}`);
}
function rf() {
  return !!(typeof globalThis < "u" && globalThis.navigator && globalThis.navigator.gpu);
}
var Se;
(function(n) {
  n[n.MatMulReduceProgram = 0] = "MatMulReduceProgram", n[n.MatMulSplitKProgram = 1] = "MatMulSplitKProgram", n[n.MatMulSmallOutputSizeProgram = 2] = "MatMulSmallOutputSizeProgram", n[n.MatMulPackedProgram = 3] = "MatMulPackedProgram", n[n.MatMulMax = 4] = "MatMulMax";
})(Se || (Se = {}));
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Ux = V().getNumber("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD"), Wx = (n, t) => {
  const e = n.limits.maxComputeWorkgroupsPerDimension, s = t.dispatchLayout, r = t.dispatch;
  if (r.every((i) => i <= e))
    return r;
  w(r[0] > e && s.y === void 0 && s.z === void 0, () => "Dispatch size exceeds WebGPU limits in Y or Z dimension.");
  let o = Math.ceil(Math.sqrt(r[0]));
  return o > e ? (o = Math.ceil(Math.cbrt(r[0])), w(o <= e, () => "Total dispatch size exceeds WebGPU maximum."), [o, o, o]) : [o, o, 1];
};
class Fs extends Bl {
  nextDataId() {
    return Fs.nextDataId++;
  }
  constructor(t, e) {
    if (super(), this.commandQueueOwnedIds = /* @__PURE__ */ new WeakSet(), this.dispatchCountInPass = 0, this.disposed = !1, this.downloadWaitMs = 0, this.tensorDataPendingDisposal = [], this.queryResolveBuffer = null, this.querySet = null, this.querySetCount = 2, this.stagingPendingDisposal = [], this.uniformPendingDisposal = [], this.uploadWaitMs = 0, this.hasReadSyncWarned = !1, this.hasTimestampQueryWarned = !1, !rf())
      throw new Error("WebGPU is not supported on this device");
    this.pipelineCache = {}, this.device = t, this.queue = t.queue, this.commandEncoder = null, this.computePassEncoder = null, this.adapterInfo = new Sx(e), this.supportTimestampQuery = this.device.features.has("timestamp-query"), this.thresholdToIncreaseWorkgroups = this.adapterInfo.intelGPUGeneration >= 12 ? 16 : 8, this.bufferManager = new vx(this.device), this.textureManager = new Ix(this.device), this.tensorMap = new If(this, uo()), V().getBool("WEBGPU_USE_PROFILE_TOOL") && (this.dummyCanvas = document.createElement("canvas"), this.dummyCanvas.width = 1, this.dummyCanvas.height = 1, this.dummyContext = this.dummyCanvas.getContext("webgpu"), this.dummyContext.configure({
      device: t,
      format: "bgra8unorm"
    }), document.body.appendChild(this.dummyCanvas));
  }
  floatPrecision() {
    return 32;
  }
  /**
   * Dispose the memory if the dataId has 0 refCount. Return true if the memory
   * is released or delayed in this backend, false if there are still
   * references.
   * @param dataId
   * @oaram force Optional, remove the data regardless of refCount
   */
  disposeData(t, e = !1) {
    if (!this.tensorMap.has(t))
      return !0;
    const s = this.tensorMap.get(t);
    return e ? s.refCount = 0 : s.refCount--, s.refCount > 0 ? !1 : (s.complexTensorInfos != null && (this.disposeData(s.complexTensorInfos.real.dataId), this.disposeData(s.complexTensorInfos.imag.dataId)), this.commandQueueOwnedIds.has(t) ? (this.tensorDataPendingDisposal.push(t), !0) : (this.releaseResource(t), this.tensorMap.delete(t), !0));
  }
  memory() {
    return {
      numBytesInGPU: this.bufferManager.numBytesUsed,
      numBytesAllocatedInGPU: this.bufferManager.numBytesAllocated,
      unreliable: !1
    };
  }
  releaseResource(t) {
    const e = this.tensorMap.get(t);
    if (!(!e || !e.resource)) {
      if (e.external) {
        e.resource = null;
        return;
      }
      e.resource instanceof GPUBuffer ? this.bufferManager.releaseBuffer(e.resource) : e.resource instanceof GPUTexture && this.textureManager.releaseTexture(e.resource), e.resource = null;
    }
  }
  /** Return refCount of a `TensorData`. */
  refCount(t) {
    return this.tensorMap.has(t) ? this.tensorMap.get(t).refCount : 0;
  }
  /** Increase refCount of a `TensorData`. */
  incRef(t) {
    const e = this.tensorMap.get(t);
    e.refCount++;
  }
  /** Decrease refCount of a `TensorData`. */
  decRef(t) {
    if (this.tensorMap.has(t)) {
      const e = this.tensorMap.get(t);
      e.refCount--;
    }
  }
  write(t, e, s) {
    if (s === "complex64" && t != null)
      throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");
    const r = { id: this.nextDataId() };
    return this.tensorMap.set(r, { dtype: s, shape: e, values: t, refCount: 1 }), r;
  }
  move(t, e, s, r, o) {
    if (r === "complex64")
      throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");
    this.tensorMap.set(t, { dtype: r, shape: s, values: e, refCount: o });
  }
  submitQueue() {
    this.queue.submit([this.commandEncoder.finish()]), this.commandEncoder = null, this.dispatchCountInPass = 0, this.commandQueueOwnedIds = /* @__PURE__ */ new WeakSet(), this.tensorDataPendingDisposal.forEach((t) => {
      this.releaseResource(t), this.tensorMap.delete(t);
    }), this.uniformPendingDisposal.forEach((t) => this.bufferManager.releaseBuffer(t)), this.stagingPendingDisposal.forEach((t) => this.bufferManager.releaseBuffer(t, !1)), this.tensorDataPendingDisposal = [], this.uniformPendingDisposal = [], this.stagingPendingDisposal = [];
  }
  ensureCommandEncoderReady() {
    this.commandEncoder || (this.commandEncoder = this.device.createCommandEncoder());
  }
  endComputePassEncoder() {
    this.computePassEncoder && (this.computePassEncoder.end(), this.computePassEncoder = null);
  }
  // Check if parallel compilation is done.
  async checkCompileCompletionAsync() {
    let t;
    try {
      t = await Promise.all(Object.values(this.pipelineCache));
    } catch (e) {
      throw new Error(e.message);
    }
    Object.keys(this.pipelineCache).map((e, s) => {
      this.pipelineCache[e] = t[s];
    });
  }
  async getBufferData(t) {
    if (V().getBool("WEBGPU_ENGINE_COMPILE_ONLY"))
      return console.warn("The data may be invalid since WEBGPU_ENGINE_COMPILE_ONLY is true, this can only be called when WEBGPU_ENGINE_COMPILE_ONLY is false"), null;
    const e = t.size, s = this.bufferManager.acquireBuffer(e, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    this.ensureCommandEncoderReady(), this.endComputePassEncoder(), this.commandEncoder.copyBufferToBuffer(t, 0, s, 0, e), this.submitQueue(), await s.mapAsync(GPUMapMode.READ);
    const r = s.getMappedRange().slice(0);
    return s.unmap(), s != null && this.bufferManager.releaseBuffer(s), V().getBool("WEBGPU_USE_PROFILE_TOOL") && (w(this.dummyContext !== void 0, () => "Fail to get context for profiling tool"), this.dummyContext.getCurrentTexture()), r;
  }
  convertAndCacheOnCPU(t, e) {
    const s = this.tensorMap.get(t);
    return s.values = e, s.values;
  }
  readSync(t) {
    const e = this.tensorMap.get(t), { values: s, complexTensorInfos: r } = e;
    if (s != null || e.dtype === "string")
      return s;
    if (e.dtype === "complex64") {
      const g = this.readSync(r.real.dataId), m = this.readSync(r.imag.dataId), b = ro(Ma(g, m).buffer, "float32");
      return this.convertAndCacheOnCPU(t, b), b;
    }
    this.hasReadSyncWarned || (this.hasReadSyncWarned = !0, console.warn("The performance of synchronously reading data from GPU to CPU is poor on the webgpu backend, please use asynchronous APIs instead."));
    const o = ["opaque", "premultiplied"], i = e.resource, a = i.size;
    w(a % 4 === 0, () => "Because there is 4 bytes for one pixel, buffer size must be multiple of 4.");
    const l = a / 4, u = new ArrayBuffer(a), c = 256, h = 256, f = o.map((g) => new OffscreenCanvas(c, h)), d = new OffscreenCanvas(c, h);
    this.endComputePassEncoder(), f.map((g, m) => {
      const b = g.getContext("webgpu");
      return b.configure({
        device: this.device,
        format: "bgra8unorm",
        usage: GPUTextureUsage.COPY_DST,
        alphaMode: o[m]
      }), b.getCurrentTexture();
    }).map((g, m) => {
      const b = c * 4, y = (k, T, R) => {
        this.ensureCommandEncoderReady(), this.commandEncoder.copyBufferToTexture({
          buffer: i,
          bytesPerRow: b,
          offset: R
        }, {
          texture: g
        }, {
          width: k,
          height: T
        }), this.submitQueue();
        const B = d.getContext("2d", {
          willReadFrequently: !0
        });
        B.clearRect(0, 0, k, T), B.drawImage(f[m], 0, 0);
        const H = B.getImageData(0, 0, k, T).data, X = o[m], W = new Uint8ClampedArray(u, R, k * T * 4);
        for (let U = 0; U < W.length; U += 4)
          if (X === "premultiplied")
            W[U + 3] = H[U + 3];
          else {
            const j = H[U];
            W[U] = H[U + 2], W[U + 1] = H[U + 1], W[U + 2] = j;
          }
      }, S = Math.floor(l / (c * h));
      let x = c, v = h, E = 0;
      for (let k = 0; k < S; k++)
        y(x, v, E), E += c * h * 4;
      const D = l % (c * h);
      v = Math.floor(D / c), v > 0 && (y(x, v, E), E += v * (c * 4)), x = D % c, x > 0 && y(x, 1, E);
    });
    const p = ro(u, e.dtype);
    return this.convertAndCacheOnCPU(t, p), p;
  }
  async read(t) {
    if (!this.tensorMap.has(t))
      throw new Error(`Tensor ${t} was not registered!`);
    const e = this.tensorMap.get(t), { values: s } = e;
    if (s != null)
      return s;
    let r;
    if (e.dtype === "complex64") {
      const o = await Promise.all([
        this.read(e.complexTensorInfos.real.dataId),
        this.read(e.complexTensorInfos.imag.dataId)
      ]), i = o[0], a = o[1];
      r = Ma(i, a);
    } else {
      const o = await this.getBufferData(e.resource);
      r = ro(o, e.dtype);
    }
    return this.convertAndCacheOnCPU(t, r), r;
  }
  // The source GPUBuffer and destination GPUBuffer have the same size and
  // usage.
  copyBuffer(t) {
    const e = t.size, s = t.usage, r = this.bufferManager.acquireBuffer(e, s);
    return this.ensureCommandEncoderReady(), this.endComputePassEncoder(), this.commandEncoder.copyBufferToBuffer(t, 0, r, 0, e), this.submitQueue(), r;
  }
  /**
   * Create a TF.js tensor out of an existing WebGPU buffer.
   */
  createTensorFromGPUData(t, e, s) {
    let r = t.buffer;
    if (s === "complex64")
      throw new Error("Cannot write to a complex64 dtype. ");
    const o = { id: this.nextDataId() };
    this.tensorMap.set(o, {
      dtype: s,
      shape: e,
      values: null,
      refCount: 1,
      external: t.zeroCopy
    });
    const i = this.tensorMap.get(o), a = Dl(i.dtype) * z(i.shape);
    if (t.buffer.size < a)
      throw new Error(`GPUBuffer size(${t.buffer.size}) is smaller than tensor size(${a})!`);
    if ((t.buffer.usage & (GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC)) !== (GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC))
      throw new Error("GPUBuffer.usage should include GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC!");
    return t.zeroCopy !== !0 && (r = this.copyBuffer(r)), i.resource = r, uo().makeTensorFromDataId(o, e, s, this);
  }
  /**
   * Read tensor to a new GPUBuffer.
   * @param dataId The source tensor.
   */
  readToGPU(t) {
    const e = this.tensorMap.get(t), { values: s, dtype: r, shape: o, resource: i } = e;
    if (r === "complex64")
      throw new Error("Does not support reading buffer for complex64 dtype.");
    if (i == null)
      throw s != null ? new Error("Data is not on GPU but on CPU.") : new Error("There is no data on GPU or CPU.");
    const a = i, l = a.size, u = a.usage, c = this.bufferManager.acquireBuffer(l, u);
    this.ensureCommandEncoderReady(), this.endComputePassEncoder(), this.commandEncoder.copyBufferToBuffer(i, 0, c, 0, l), this.submitQueue();
    const h = this.makeTensorInfo(o, r), f = uo().makeTensorFromTensorInfo(h), d = this.tensorMap.get(h.dataId);
    return d.resource = c, { tensorRef: f, buffer: c };
  }
  bufferSync(t) {
    const e = this.readSync(t.dataId);
    if (t.dtype === "string")
      try {
        const s = e.map((r) => lr(r));
        return vt(t.shape, t.dtype, s);
      } catch {
        throw new Error("Failed to decode encoded string bytes into utf-8");
      }
    return vt(t.shape, t.dtype, e);
  }
  async time(t) {
    !this.supportTimestampQuery && !this.hasTimestampQueryWarned && (console.warn("This device doesn't support timestamp-query extension. Start Chrome browser with flag --enable-dawn-features=allow_unsafe_apis to try it again. Otherwise, zero will be shown for the kernel time when profiling mode is enabled."), this.hasTimestampQueryWarned = !0);
    const e = this.activeTimers, s = [];
    let r = !1;
    this.programTimersStack == null ? (this.programTimersStack = s, r = !0) : this.activeTimers.push(s), this.activeTimers = s, t();
    const o = fn(this.activeTimers.map((u) => u.query)).filter((u) => u != null), i = fn(this.activeTimers.map((u) => u.name)).filter((u) => u != null);
    this.activeTimers = e, r && (this.programTimersStack = null);
    const a = {
      uploadWaitMs: this.uploadWaitMs,
      downloadWaitMs: this.downloadWaitMs,
      kernelMs: null,
      wallMs: null
    }, l = await Promise.all(o);
    return a.kernelMs = Af(l), a.getExtraProfileInfo = () => l.map((u, c) => ({ name: i[c], ms: u })).map((u) => `${u.name}: ${u.ms}`).join(", "), this.uploadWaitMs = 0, this.downloadWaitMs = 0, a;
  }
  makeTensorInfo(t, e, s) {
    return e === "string" && s != null && s.length > 0 && Fr(s[0]) && (s = s.map((o) => nn(o))), { dataId: this.write(s, t, e), shape: t, dtype: e };
  }
  tensorToBinding(t) {
    if (!t)
      return null;
    const s = this.tensorMap.get(t.dataId).resource;
    return s instanceof GPUBuffer ? { buffer: s } : s instanceof GPUTexture ? s.createView() : s;
  }
  uploadToGPU(t) {
    const e = this.tensorMap.get(t);
    if (e.resource != null)
      return;
    const s = Dl(e.dtype) * z(e.shape);
    let r;
    const o = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    if (e.values) {
      if (r = this.bufferManager.acquireBuffer(s, o, !0), r.mapState === "unmapped") {
        const i = this.bufferManager.acquireBuffer(s, GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC, !0, !1), a = i.getMappedRange();
        e.dtype === "int32" || e.dtype === "bool" ? new Int32Array(a).set(e.values) : new Float32Array(a).set(e.values), i.unmap(), this.ensureCommandEncoderReady(), this.endComputePassEncoder(), this.commandEncoder.copyBufferToBuffer(i, 0, r, 0, s), this.stagingPendingDisposal.push(i);
      } else {
        const i = r.getMappedRange();
        e.dtype === "int32" || e.dtype === "bool" ? new Int32Array(i).set(e.values) : new Float32Array(i).set(e.values), r.unmap();
      }
      e.values = null;
    } else
      r = this.bufferManager.acquireBuffer(s, o);
    e.resource = r;
  }
  makeUniforms(t) {
    let e = 0, s = 0;
    const r = [];
    let o = 1;
    t.forEach((l) => {
      l.data.length === 0 && (l.data = [1]);
      let u;
      switch (l.data.length) {
        case 1:
          u = 4;
          break;
        case 2:
          u = 8;
          break;
        case 3:
          u = 16;
          break;
        case 4:
          u = 16;
          break;
        case 5:
          u = 16;
          break;
        case 6:
          u = 16;
          break;
        default:
          w(!1, () => `Unsupported ${l.data.length}D shape`);
      }
      (s === 5 || s === 6) && (u = 16), u > o && (o = u), e = Math.ceil(e / u) * u, s = l.data.length, r.push(e), e += l.data.length * 4;
    }), e = Math.ceil(e / o) * o;
    const i = new ArrayBuffer(e);
    t.forEach((l, u) => {
      const c = r[u];
      l.type === "int32" ? new Int32Array(i, c, l.data.length).set(l.data) : l.type === "uint32" ? new Uint32Array(i, c, l.data.length).set(l.data) : new Float32Array(i, c, l.data.length).set(l.data);
    });
    const a = this.bufferManager.acquireBuffer(e, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM);
    return this.queue.writeBuffer(a, 0, i, 0, e), this.uniformPendingDisposal.push(a), { offset: 0, size: e, buffer: a };
  }
  runWebGPUProgram(t, e, s, r, o) {
    if (o || (o = this.makeTensorInfo(t.outputShape, s)), z(o.shape) === 0)
      return this.tensorMap.get(o.dataId).values = Rn(o.dtype, 0), o;
    this.uploadToGPU(o.dataId), t.dispatch = Wx(this.device, t);
    const i = e.map((l, u) => {
      if (l.dtype === "complex64")
        throw new Error("GPGPUProgram does not support complex64 input. For complex64 dtypes, please separate the program into real and imaginary parts.");
      return this.uploadToGPU(l.dataId), {
        // Returning dtype from tensorMap because it reflects dtype
        // of underlying buffer, rather than abstract dtype.
        dtype: this.tensorMap.get(l.dataId).dtype,
        shape: l.shape,
        name: t.variableNames[u]
      };
    });
    t.shaderKey = kx(t, i, o);
    const a = V().getBool("WEBGPU_ENGINE_COMPILE_ONLY");
    return t.shaderKey in this.pipelineCache || (this.pipelineCache[t.shaderKey] = Ex(this.device, t, i, o, a)), t.pipeline = this.pipelineCache[t.shaderKey], a || this.recordAndSubmit(t, o, e, r), o;
  }
  recordAndSubmit(t, e, s, r) {
    if (t.pipeline instanceof Promise)
      throw new Error("Please call checkCompileCompletionAsync to ensure parallel compilation is done!");
    let o = [], i = [];
    const a = "int32";
    if (t.pixelsOpType == null) {
      o.push({ type: "float32", data: [NaN] }, { type: "float32", data: [1 / 0] }), i = s.concat(e).map((d) => d.shape);
      const f = "int32";
      i.map((d) => {
        o.push({ type: f, data: d });
        const p = Kt(d);
        o.push({ type: f, data: p });
      });
    } else {
      const f = Kt(e.shape);
      o.push({ type: a, data: f });
    }
    if (t.size) {
      const f = z(t.outputShape);
      o.push({
        type: a,
        data: [t.outputComponent ? f / t.outputComponent : f]
      });
    }
    r && (o = [...o, ...r]);
    const l = [
      this.tensorToBinding(e),
      ...s.map((f) => this.tensorToBinding(f)),
      this.makeUniforms(o)
    ];
    s.forEach((f) => {
      this.commandQueueOwnedIds.add(f.dataId);
    }), this.commandQueueOwnedIds.add(e.dataId);
    const u = this.device.createBindGroup({
      layout: t.pipeline.getBindGroupLayout(0),
      entries: l.map((f, d) => ({ binding: d, resource: f }))
    }), c = this.activeTimers != null;
    this.ensureCommandEncoderReady();
    const h = {};
    c && this.supportTimestampQuery ? (this.endComputePassEncoder(), this.querySet == null && (this.querySet = this.device.createQuerySet({
      type: "timestamp",
      count: this.querySetCount
    })), h.timestampWrites = {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1
    }, this.computePassEncoder = this.commandEncoder.beginComputePass(h)) : this.computePassEncoder || (this.computePassEncoder = this.commandEncoder.beginComputePass(h)), this.computePassEncoder.setPipeline(t.pipeline), this.computePassEncoder.setBindGroup(0, u), this.computePassEncoder.dispatchWorkgroups(t.dispatch[0], t.dispatch[1], t.dispatch[2]), this.dispatchCountInPass++, (c || V().get("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE") <= this.dispatchCountInPass || t.pixelsOpType === Or.DRAW) && (this.endComputePassEncoder(), c ? this.activeTimers.push({ name: t.constructor.name, query: this.getQueryTime() }) : this.submitQueue());
  }
  async getQueryTime() {
    if (!this.supportTimestampQuery)
      return 0;
    this.queryResolveBuffer == null && (this.queryResolveBuffer = this.bufferManager.acquireBuffer(this.querySetCount * 8, GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.QUERY_RESOLVE)), this.commandEncoder.resolveQuerySet(this.querySet, 0, this.querySetCount, this.queryResolveBuffer, 0);
    const t = this.bufferManager.acquireBuffer(this.querySetCount * 8, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer, 0, t, 0, this.querySetCount * 8), this.submitQueue(), await t.mapAsync(GPUMapMode.READ);
    const e = new BigUint64Array(t.getMappedRange()), s = Number(e[1] - e[0]) / 1e6;
    return t.unmap(), this.bufferManager.releaseBuffer(t), s;
  }
  shouldExecuteOnCPU(t, e = Ux) {
    return V().getBool("WEBGPU_CPU_FORWARD") && t.every((s) => this.tensorMap.get(s.dataId).resource == null && z(s.shape) < e);
  }
  numDataIds() {
    return this.tensorMap.numDataIds() - this.tensorDataPendingDisposal.length;
  }
  dispose() {
    this.disposed || (this.querySet != null && this.querySet.destroy(), this.bufferManager.dispose(), this.textureManager.dispose(), this.disposed = !0);
  }
}
Fs.nextDataId = 0;
/**
 * @license
 * Copyright 2022 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
rf() && Xp(
  "webgpu",
  async () => {
    const t = await navigator.gpu.requestAdapter(), e = {}, s = [];
    t.features.has("timestamp-query") && s.push("timestamp-query"), t.features.has("bgra8unorm-storage") && s.push(["bgra8unorm-storage"]), e.requiredFeatures = s;
    const r = t.limits;
    e.requiredLimits = {
      maxComputeWorkgroupStorageSize: r.maxComputeWorkgroupStorageSize,
      maxComputeWorkgroupsPerDimension: r.maxComputeWorkgroupsPerDimension,
      maxStorageBufferBindingSize: r.maxStorageBufferBindingSize,
      maxBufferSize: r.maxBufferSize,
      maxComputeWorkgroupSizeX: r.maxComputeWorkgroupSizeX,
      maxComputeInvocationsPerWorkgroup: r.maxComputeInvocationsPerWorkgroup
    };
    const o = await t.requestDevice(e), i = await t.requestAdapterInfo();
    return new Fs(o, i);
  },
  3
  /*priority*/
);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Gx {
  constructor(t, e, s) {
    this.uniforms = "", this.variableNames = ["x"], this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = e.map(
      (r, o) => r[0] + t[o] + r[1]
      /* afterPad */
    ), this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.xShape = t, e.map((r, o) => {
      this.uniforms += ` pad${o} : vec2<i32>,`;
    }), this.offset = s === "reflect" ? 0 : 1, this.shaderKey = `mirrorPad_${s}`;
  }
  getUserCode() {
    const t = this.xShape.length, e = this.xShape.map((u, c) => `uniforms.pad${c}[0]`).join(","), s = this.xShape.map((u, c) => `uniforms.pad${c}[0] + uniforms.xShape${t > 1 ? `[${c}]` : ""}`).join(","), r = t === 1 ? "start" : "start[i]", o = t === 1 ? "end" : "end[i]", i = t === 1 ? "outC" : "outC[i]", a = Tt(t), l = t > 1 ? ["coords[0]", "coords[1]", "coords[2]", "coords[3]"].slice(0, t) : "coords";
    return `
      ${wt("index")} {
        if (index < uniforms.size) {
          let start = ${a}(${e});
          let end = ${a}(${s});
          var outC = getCoordsFromIndex(index);
          for (var i = 0; i < ${t}; i = i + 1) {
            if (${i} < ${r}) {
              ${i} = ${r} * 2 - ${i} - ${this.offset};
            } else if(${i} >= ${o}) {
              ${i} = (${o} - 1) * 2 - ${i} + ${this.offset};
            }
          }
          let coords = outC - start;
          setOutputAtIndex(index, getX(${l}));
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Vx = {
  kernelName: kd,
  backendName: "webgpu",
  kernelFunc: ({ inputs: n, attrs: t, backend: e }) => {
    const { x: s } = n, { paddings: r, mode: o } = t, i = e, a = r.map((c) => ({ type: "int32", data: [c[0], c[1]] })), l = new Gx(s.shape, r, o);
    return i.runWebGPUProgram(l, [s], s.dtype, a);
  }
};
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function He(n) {
  const { inputs: t } = n, { x: e } = t;
  return n.backend.incRef(e.dataId), { dataId: e.dataId, shape: e.shape, dtype: e.dtype };
}
const qx = {
  kernelName: li,
  backendName: "webgpu",
  kernelFunc: He
};
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function jx(n, t = !1) {
  const e = n.length, s = Tt(e), r = n.map((h, f) => `uniforms.pad${f}[0]`).join(","), o = n.map((h, f) => `uniforms.pad${f}[0] + uniforms.xShape${e > 1 ? `[${f}]` : ""}`).join(","), i = e > 1 ? `${s}(${r})` : `${r}`, a = e > 1 ? `${s}(${o})` : `${o}`, l = e > 1 ? "any(paddedCoords < start)" : "paddedCoords < start", u = e > 1 ? "any(paddedCoords >= end)" : "paddedCoords >= end", c = e > 1 ? ["coords[0]", "coords[1]", "coords[2]", "coords[3]"].slice(0, e) : "coords";
  return `
        let start = ${i};
        let end = ${a};
        if (${l} || ${u}) {
          setOutputAtIndex(index, ${t ? 0 : "uniforms.constantValue"});
        } else {
          let coords = paddedCoords - start;
          setOutputAtIndex(index, getX(${c}));
        }
  `;
}
class Hx {
  constructor(t, e) {
    this.variableNames = ["x"], this.uniforms = "constantValue : f32,", this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = e.map(
      (s, r) => s[0] + t[r] + s[1]
      /* afterPad */
    ), this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), e.map((s, r) => {
      this.uniforms += ` pad${r} : vec2<i32>,`;
    }), this.xShape = t, this.shaderKey = "pad";
  }
  getUserCode() {
    return `
      ${wt("index")} {
        if (index < uniforms.size) {
          let paddedCoords = getCoordsFromIndex(index);
          ${jx(this.xShape)}
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Kx {
  constructor(t) {
    this.variableNames = [], this.outputShape = [], this.uniforms = "value : f32,", this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = t, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.shaderKey = "fill";
  }
  getUserCode() {
    return `
    ${wt("index")} {
      if (index < uniforms.size) {
        setOutputAtIndex(index, uniforms.value);
      }
    }
  `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function of(n) {
  const { backend: t, attrs: e } = n, { shape: s, value: r } = e;
  let { dtype: o } = e;
  if (o = o || Cs(r), o === "string") {
    const i = yt(o, z(s));
    return i.fill(r), t.makeTensorInfo(s, o, i);
  } else {
    const i = new Kx(s), a = [{ type: "float32", data: [r] }];
    return t.runWebGPUProgram(i, [], o, a);
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Yx = (n) => {
  const { inputs: t, backend: e, attrs: s } = n, { x: r } = t, { paddings: o, constantValue: i } = s;
  if (o.every((u) => oe(u, [0, 0])))
    return He({ inputs: { x: r }, backend: e });
  if (z(r.shape) === 0) {
    const u = o.map(
      (c, h) => c[0] + r.shape[h] + c[1]
      /* afterPad */
    );
    return of({
      backend: e,
      attrs: { shape: u, value: i, dtype: r.dtype }
    });
  }
  const a = [{ type: "float32", data: [i] }];
  o.map((u) => a.push({ type: "int32", data: [u[0], u[1]] }));
  const l = new Hx(r.shape, o);
  return e.runWebGPUProgram(l, [r], r.dtype, a);
}, Xx = {
  kernelName: Kl,
  backendName: "webgpu",
  kernelFunc: Yx
};
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Jx(n) {
  const t = new Float32Array(n.length);
  for (let e = 0; e < n.length; ++e)
    t[e] = Math.abs(n[e]);
  return t;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Lt(n) {
  return (t, e, s, r, o) => {
    const i = Wt(t, e), a = i.length, l = Kt(i), u = z(i), c = Rn(o, u), h = t.length, f = e.length, d = Kt(t), p = Kt(e), g = dr(t, i), m = dr(e, i);
    if (g.length + m.length === 0)
      for (let b = 0; b < c.length; ++b)
        c[b] = n(s[b % s.length], r[b % r.length]);
    else
      for (let b = 0; b < c.length; ++b) {
        const y = oi(b, a, l), S = y.slice(-h);
        g.forEach((D) => S[D] = 0);
        const x = To(S, h, d), v = y.slice(-f);
        m.forEach((D) => v[D] = 0);
        const E = To(v, f, p);
        c[b] = n(s[x], r[E]);
      }
    return [c, i];
  };
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Zx(n, t, e, s) {
  if (s === "int32") {
    const r = Int32Array.from(n);
    return [t, "int32", r];
  }
  if (s === "bool") {
    const r = Ur([0], e), [o, i] = Lt((a, l) => a !== l ? 1 : 0)(t, [], n, r, "bool");
    return [i, "bool", o];
  }
  throw new Error(`Error in Cast: failed to cast ${e} to ${s}`);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Qx = Lt((n, t) => n + t);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function tS(n, t, e, s, r) {
  const o = z(s), i = je(r, e);
  for (let a = 0; a < n.length; a++) {
    const l = n[a];
    if (l < 0)
      throw new Error("Input x must be non-negative!");
    l >= r || (o > 0 ? i[l] += t[a] : i[l] += 1);
  }
  return i;
}
function eS(n, t, e, s = !1) {
  const r = n.shape[0], o = n.shape[1], i = vt([r, e], t.dtype);
  for (let a = 0; a < r; a++)
    for (let l = 0; l < o; l++) {
      const u = n.get(a, l);
      if (u < 0)
        throw new Error("Input x must be non-negative!");
      u >= e || (s ? i.set(1, a, u) : t.size > 0 ? i.set(i.get(a, u) + t.get(a, l), a, u) : i.set(i.get(a, u) + 1, a, u));
    }
  return i;
}
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const nS = Lt((n, t) => n & t);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Be(n) {
  return (t, e, s) => {
    const r = yt(e, t.length);
    for (let o = 0; o < t.length; ++o)
      r[o] = n(t[o], s);
    return r;
  };
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const sS = Be((n) => Math.ceil(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function rS(n, t, e, s) {
  const r = yt(e, z(t));
  if (s && e !== "string") {
    let o = 0;
    n.forEach((i) => {
      const a = z(i.shape);
      r.set(i.vals, o), o += a;
    });
  } else {
    let o = 0;
    n.forEach((i) => {
      const a = e === "string" ? Ku(i.vals) : i.vals;
      let l = 0;
      for (let u = 0; u < i.shape[0]; ++u) {
        const c = u * t[1] + o;
        for (let h = 0; h < i.shape[1]; ++h)
          r[c + h] = a[l++];
      }
      o += i.shape[1];
    });
  }
  return r;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const oS = Lt((n, t) => n === t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const iS = Be((n) => Math.exp(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const aS = Be((n) => Math.expm1(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const lS = Be((n) => Math.floor(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const uS = Lt((n, t) => Math.floor(n / t));
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cS(n, t, e, s, r, o, i, a, l) {
  const u = vt([s, o], e);
  for (let c = 0; c < s; c++) {
    const h = [];
    let f = 0;
    for (let d = 0; d < r; d++) {
      const p = n[c * r + d];
      f += p * i[d], h.push(p);
    }
    if (f < 0 || f >= l / o)
      throw new Error(`Invalid indices: ${h} does not index into ${a}`);
    for (let d = 0; d < o; d++)
      u.values[c * o + d] = t.get(...t.indexToLoc(f * o + d));
  }
  return u;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function hS(n, t, e) {
  const s = vt(e, n.dtype);
  for (let r = 0; r < s.size; ++r) {
    const i = s.indexToLoc(r).slice(), a = i[0], l = i[2], u = t.locToIndex([a, l]);
    i[2] = t.values[u];
    const c = n.locToIndex(i);
    0 <= c && c < n.values.length && (s.values[r] = n.values[c]);
  }
  return s;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const fS = Lt((n, t) => n > t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const dS = Lt((n, t) => n >= t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const pS = Lt((n, t) => n < t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const mS = Lt((n, t) => n <= t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function gS(n, t, e) {
  const s = (t - n) / (e - 1), r = je(e, "float32");
  r[0] = n;
  for (let o = 1; o < r.length; o++)
    r[o] = r[o - 1] + s;
  return r;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const bS = Be((n) => Math.log(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function yS(n, t, e, s) {
  const r = Rn(s, z(e));
  for (let o = 0; o < r.length; ++o) {
    const i = o * t;
    let a = n[i];
    for (let l = 0; l < t; ++l) {
      const u = n[i + l];
      (Number.isNaN(u) || u > a) && (a = u);
    }
    r[o] = a;
  }
  return r;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const wS = Lt((n, t) => Math.max(n, t));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const xS = Lt((n, t) => Math.min(n, t));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const af = Lt((n, t) => n * t);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function SS(n, t, e) {
  const s = xp(-1, e);
  return af([], t, s, n, e);
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const vS = Lt((n, t) => n !== t ? 1 : 0);
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function IS(n, t, e, s, r) {
  const o = t.length, i = z(t), a = Kt(t), l = Kt(r), u = Rn(e, z(r));
  for (let c = 0; c < i; ++c) {
    const h = oi(c, o, a), f = new Array(h.length);
    for (let p = 0; p < f.length; p++)
      f[p] = h[s[p]];
    const d = To(f, o, l);
    u[d] = n[c];
  }
  return u;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function $S(n, t, e, s) {
  const [r, o] = bi(n, s), i = ci(t, "int32"), a = je(z(r), i), l = z(o);
  for (let u = 0; u < a.length; ++u) {
    const c = u * l;
    let h = 1;
    for (let f = 0; f < l; ++f)
      h *= e[c + f];
    a[u] = h;
  }
  return { outVals: a, outShape: r, outDtype: i };
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function AS(n, t, e) {
  n.forEach((s, r) => {
    if (s < 0 || s >= e) {
      const o = oi(r, t.length, Kt(t)).join(",");
      throw new Error(`indices[${o}] = ${s} is not in [0, ${e})`);
    }
  });
}
function ES(n, t) {
  for (let e = 0; e < n.length; ++e) {
    const s = n[e], r = e === n.length - 1 ? t : n[e + 1].length;
    if (s.length === 0)
      throw new Error("Ragged splits may not be empty");
    if (s[0] < 0)
      throw new Error("Ragged splits must be non-negative");
    if (s[s.length - 1] > r)
      throw new Error("Ragged splits must not point past values");
    for (let o = 1; o < s.length; ++o)
      if (s[o - 1] > s[o])
        throw new Error("Ragged splits must be sorted in ascending order");
  }
}
function _S(n, t, e, s) {
  const r = [];
  let o = 0;
  const i = t.length - 1 + e.length, a = new Array(i).fill(null).map(() => [0]);
  ES(e, s);
  let l = 1;
  for (let u = 0; u < t.length - 1; ++u) {
    l *= t[u];
    const c = t[u + 1];
    for (let h = 1; h < l + 1; ++h)
      a[u].push(h * c);
  }
  for (let u = 0; u < n.length; ++u) {
    let c = n[u], h = n[u] + 1;
    for (let f = 0; f < e.length; ++f) {
      const d = e[f], p = f + t.length - 1;
      if (p >= 0) {
        const g = a[p], m = g[g.length - 1] - d[c];
        for (let b = c; b < h; ++b)
          a[p].push(d[b + 1] + m);
      }
      c = d[c], h = d[h];
    }
    h !== c && (r.push([c, h]), o += h - c);
  }
  return { outSplits: a, valueSlices: r, numValues: o };
}
function CS(n) {
  const t = [];
  for (let e = 0; e < n.length; ++e) {
    const s = n[e].length, r = yt("int32", s);
    t.push(r), n[e].forEach((o, i) => r[i] = o);
  }
  return t;
}
function Pl(n, t) {
  const e = n.slice(0, t);
  for (; e.length < t; )
    e.push(1);
  for (let s = t; s < n.length; s++)
    e[t - 1] *= n[s];
  return e;
}
function kS(n, t, e, s, r, o) {
  const i = Pl(t, 2)[1], a = Pl(o, 2)[1];
  let l = 0;
  for (const u of e)
    for (let c = u[0]; c < u[1]; ++c) {
      for (let h = 0; h < s; ++h)
        r[l * a + h] = n[c * i + h];
      ++l;
    }
}
function TS(n, t, e, s, r) {
  const o = t.slice();
  o[0] = r;
  const i = yt(e, z(o)), a = n.length, l = a === 0 ? 0 : a / t[0];
  return kS(n, t, s, l, i, o), [i, o];
}
function NS(n, t, e, s, r, o, i, a) {
  if (n.length === 0)
    throw new Error("paramsNestedSplits must be non empty");
  if (t[0].length === 0)
    throw new Error("Split tensors must not be scalars");
  const l = t[0][0] - 1;
  if (AS(o, i, l), s.length === 0)
    throw new Error("params.rank must be nonzero");
  const u = s[0], { outSplits: c, valueSlices: h, numValues: f } = _S(o, i, n, u), d = CS(c), p = TS(e, s, r, h, f);
  return [d, p[0], p[1]];
}
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const Rl = 2147483647;
function DS(n, t, e, s, r, o, i) {
  if (t.length > 1)
    throw new Error("starts must be a scalar or vector");
  if (r.length > 1)
    throw new Error("limits must be a scalar or vector");
  if (i.length > 1)
    throw new Error("deltas must be a scalar or vector");
  const a = t.length === 0, l = r.length === 0, u = i.length === 0, c = [];
  a || c.push(t[0]), l || c.push(r[0]), u || c.push(i[0]);
  for (let m = 1; m < c.length; ++m)
    if (c[m] !== c[m - 1])
      throw new Error("starts, limits, and deltas must have the same shape");
  const h = c.length === 0 ? 1 : c[0], f = yt("int32", h + 1);
  f[0] = 0;
  for (let m = 0; m < h; ++m) {
    const b = a ? n[0] : n[m], y = l ? s[0] : s[m], S = u ? o[0] : o[m];
    if (S === 0)
      throw new Error("Requires delta != 0");
    let x;
    if (S > 0 && y < b || S < 0 && y > b)
      x = 0;
    else if (x = Math.ceil(Math.abs((y - b) / S)), x > Rl)
      throw new Error(`Requires ((limit - start) / delta) <= ${Rl}`);
    f[m + 1] = f[m] + x;
  }
  const d = f[h], p = yt(e, d);
  let g = 0;
  for (let m = 0; m < h; ++m) {
    const b = f[m + 1] - f[m];
    let y = a ? n[0] : n[m];
    const S = u ? o[0] : o[m];
    for (let x = 0; x < b; ++x)
      p[g++] = y, y += S;
  }
  return [f, p];
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var Zt = $e;
class Mr {
  constructor(t, e, s, r, o, i, a, l, u, c) {
    this.shape = t, this.shapeShape = e, this.values = s, this.valuesShape = r, this.valuesDType = o, this.defaultValue = i, this.defaultValueShape = a, this.rowPartitionValues = l, this.rowPartitionValuesShapes = u, this.rowPartitionTypes = dy(c), this.raggedRank = py(this.rowPartitionTypes);
  }
  getRowPartitionTypeByDimension(t) {
    return this.rowPartitionTypes[0] === Zt.FIRST_DIM_SIZE ? this.rowPartitionTypes[t + 1] : this.rowPartitionTypes[t];
  }
  // Returns the relationship between dimension and dimension + 1.
  getRowPartitionTensor(t) {
    return this.rowPartitionTypes[0] === Zt.FIRST_DIM_SIZE ? this.rowPartitionValues[t + 1] : this.rowPartitionValues[t];
  }
  getMaxWidth(t) {
    const e = this.getRowPartitionTensor(t - 1);
    switch (this.getRowPartitionTypeByDimension(t - 1)) {
      case Zt.VALUE_ROWIDS:
        return Mr.getMaxWidthValueRowID(e);
      case Zt.ROW_SPLITS:
        return Mr.getMaxWidthRowSplit(e);
      default:
        throw new Error(`Cannot handle partition type ${Zt[this.getRowPartitionTypeByDimension(t - 1)]}`);
    }
  }
  static getMaxWidthRowSplit(t) {
    const e = t.length;
    if (e === 0 || e === 1)
      return 0;
    let s = 0;
    for (let r = 0; r < e - 1; ++r) {
      const o = t[r + 1] - t[r];
      o > s && (s = o);
    }
    return s;
  }
  static getMaxWidthValueRowID(t) {
    const e = t.length;
    if (e === 0)
      return 0;
    let s = 0, r = t[0], o = 0;
    for (let i = 1; i < e; ++i) {
      const a = t[i];
      a !== r && (r = a, o = Math.max(i - s, o), s = i);
    }
    return Math.max(e - s, o);
  }
  tensorShapeFromTensor(t, e, s = !0) {
    if (e.length === 0) {
      if (t[0] === -1)
        return [];
      throw new Error("The only valid scalar shape tensor is the fully unknown shape specified as -1.");
    }
    return Ol(t, s);
  }
  calculateOutputSize(t) {
    const e = this.valuesShape, s = this.defaultValueShape;
    my(s, e);
    const r = this.tensorShapeFromTensor(this.shape, this.shapeShape), i = fy(this.raggedRank, r, e);
    i[0] < 0 && (i[0] = t);
    for (let a = 1; a <= this.raggedRank; ++a)
      i[a] < 0 && (i[a] = this.getMaxWidth(a));
    return i;
  }
  /**
   * The outputIndex represents the index in the output tensor
   * where the first element of a particular dimension would be written.
   * If it is -1, it indicates that the index is out of scope.
   * Example, given firstDimension = 10, firstDimensionOutput = 6,
   * and outputIndexMultiplier = 100:
   * result = [0 100 200 300 400 500 -1 -1 -1 -1]
   * If firstDimensionOutput = 11 instead, then:
   * result = [0 100 200 300 400 500 600 700 800 900]
   */
  calculateFirstParentOutputIndex(t, e, s) {
    const r = Math.min(t, s), o = [];
    let i = 0;
    for (let a = 0; a < r; ++a, i += e)
      o.push(i);
    for (let a = r; a < t; ++a)
      o.push(-1);
    return w(o.length === t, () => "Final length of result must be equal to firstDimension."), o;
  }
  calculateOutputIndexRowSplit(t, e, s, r) {
    const o = t.length, i = [];
    for (let a = 0; a < o - 1; ++a) {
      const l = t[a + 1] - t[a];
      let u = Math.min(r, l), c = e[a];
      c === -1 && (u = 0);
      for (let h = 0; h < u; ++h)
        i.push(c), c += s;
      for (let h = 0; h < l - u; ++h)
        i.push(-1);
    }
    if (o > 0 && i.length !== t[o - 1])
      throw new Error("Invalid row split size.");
    return i;
  }
  // Calculate the output index of the first element of a list.
  // The parentOutputIndex is the same computation for the previous list.
  // -1 indicates an element or list that is out of range.
  // The outputIndexMultiplier is the number of output indices one moves
  // forward for each column.
  // E.g., given:
  // valueRowIds:[0 1 2 2 2 3 5 5 6]
  // parentOutputIndex:[1000 1100 2000 2100 -1 3000 4000]
  // outputIndexMultiplier: 10
  // outputSize: 2
  // You get:
  // result = [1000 1100 2000 2010 -1 2100 -1 -1 3000]
  // result[0] = parentOutputIndex[valueRowIds[0]]
  // result[1] = parentOutputIndex[valueRowIds[1]]
  // result[2] = parentOutputIndex[valueRowIds[2]]
  // result[3] = parentOutputIndex[valueRowIds[2] + 10]
  // result[4] = -1 because it is the third element the size is 2.
  // result[5] = parentOutputIndex[valueRowIds[3]]
  // result[6] = -1 because parentOutputIndex[valueRowIds[6]] == -1
  // result[7] = -1 because parentOutputIndex[valueRowIds[6]] == -1
  // result[8] = parentOutputIndex[valueRowIds[7]]
  calculateOutputIndexValueRowID(t, e, s, r) {
    const o = t.length, i = [];
    if (o === 0)
      return [];
    let a = 0, l = t[0];
    if (l >= e.length)
      throw new Error(`Got currentValueRowId=${l}, which is not less than ${e.length}`);
    let u = e[l];
    i.push(u);
    for (let c = 1; c < o; ++c) {
      const h = t[c];
      if (h === l)
        u >= 0 && (++a, a < r ? u += s : u = -1);
      else {
        if (a = 0, l = h, h >= e.length)
          throw new Error(`Got nextValueRowId=${h} which is not less than ${e.length}`);
        u = e[h];
      }
      i.push(u);
    }
    if (i.length !== t.length)
      throw new Error("Invalid row ids.");
    return i;
  }
  calculateOutputIndex(t, e, s, r) {
    const o = this.getRowPartitionTensor(t), i = this.getRowPartitionTypeByDimension(t);
    switch (i) {
      case Zt.VALUE_ROWIDS:
        return this.calculateOutputIndexValueRowID(o, e, s, r);
      case Zt.ROW_SPLITS:
        if (o.length - 1 > e.length)
          throw new Error(`Row partition size is greater than output size: ${o.length - 1} > ${e.length}`);
        return this.calculateOutputIndexRowSplit(o, e, s, r);
      default:
        throw new Error(`Unsupported partition type: ${Zt[i]}`);
    }
  }
  getFirstDimensionSize() {
    const t = this.rowPartitionValues[0];
    if (this.rowPartitionTypes.length === 0)
      throw new Error("No row_partition_types given.");
    const e = this.rowPartitionTypes[0];
    switch (e) {
      case Zt.FIRST_DIM_SIZE:
        return t[0];
      case Zt.VALUE_ROWIDS:
        throw new Error("Cannot handle VALUE_ROWIDS in first dimension.");
      case Zt.ROW_SPLITS:
        return this.rowPartitionValuesShapes[0][0] - 1;
      default:
        throw new Error(`Cannot handle type ${Zt[e]}`);
    }
  }
  compute() {
    if (this.rowPartitionValues[0].length <= 0)
      throw new Error("Invalid first partition input. Tensor requires at least one element.");
    const e = this.getFirstDimensionSize(), s = this.calculateOutputSize(e), r = new Array(this.raggedRank + 1);
    r[r.length - 1] = 1;
    for (let l = r.length - 2; l >= 0; --l)
      r[l] = r[l + 1] * s[l + 1];
    const o = Ol(s, !1), i = yt(this.valuesDType, z(o));
    if (r[0] * s[0] > 0) {
      let l = this.calculateFirstParentOutputIndex(e, r[0], s[0]);
      for (let u = 1; u <= this.raggedRank; ++u)
        l = this.calculateOutputIndex(u - 1, l, r[u], s[u]);
      this.setOutput(this.raggedRank, l, i, o);
    }
    return [o, i];
  }
  setOutput(t, e, s, r) {
    if (s.length === 0)
      return;
    const o = this.values, i = s;
    let a = r.slice();
    a = a.slice(t + 1);
    const l = z(a), u = e.length;
    let c = this.defaultValue;
    if (c.length !== l && c.length !== 1) {
      const p = this.defaultValueShape;
      _(() => {
        const g = L(c, p);
        c = sr(g, a).dataSync();
      });
    }
    let h = 0, f = 0, d = 0;
    for (let p = 0; p <= u; ++p) {
      let g = p < u ? e[p] : -1;
      if (g === d) {
        ++d;
        continue;
      }
      if (f < d) {
        const m = o.subarray(h * l), b = i.subarray(f * l), y = (d - f) * l;
        Ll(b, m, y);
      }
      if (p >= u) {
        const m = s.length;
        g = Math.floor(m / l);
      }
      if (g > d)
        if (this.defaultValue.length === 1)
          i.subarray(d * l, g * l).fill(this.defaultValue[0]), d = g;
        else
          for (; g > d; ) {
            const m = i.slice(d * l);
            Ll(m, c, l), ++d;
          }
      g < 0 ? (h = p + 1, f = d) : (h = p, f = d, d = f + 1);
    }
  }
}
function Ll(n, t, e) {
  for (let s = 0; s < e; s++)
    n[s] = t[s];
}
function Ol(n, t) {
  const e = [];
  for (let s of n) {
    if (s < 0) {
      if (!t)
        throw new Error(`Dimension ${s} must be >= 0`);
      if (s < -1)
        throw new Error(`Dimension ${s} must be >= -1`);
      s = -1;
    }
    e.push(s);
  }
  return e;
}
function PS(n, t, e, s, r, o, i, a, l, u) {
  return new Mr(n, t, e, s, r, o, i, a, l, u).compute();
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function RS(n, t, e, s) {
  const r = n === t, o = n < t && e < 0, i = t < n && e > 1;
  if (r || o || i)
    return je(0, s);
  const a = Math.abs(Math.ceil((t - n) / e)), l = je(a, s);
  t < n && e === 1 && (e = -1), l[0] = n;
  for (let u = 1; u < l.length; u++)
    l[u] = l[u - 1] + e;
  return l;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const LS = Be((n) => 1 / Math.sqrt(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function OS(n, t, e, s, r, o, i, a, l, u) {
  const c = [s / r, r], h = n.values, f = t.values;
  if (s === 0)
    return vt(e, t.dtype);
  const d = l instanceof ur ? l : vt(c, t.dtype);
  typeof l == "string" || typeof l == "number" ? d.values.fill(l) : typeof l == "boolean" && d.values.fill(+l);
  for (let p = 0; p < o; p++) {
    const g = [];
    let m = 0;
    for (let b = 0; b < i; b++) {
      const y = h[p * i + b];
      g.push(y), m += y * a[b];
    }
    if (m < 0 || m >= s / r)
      throw new Error(`Invalid indices: ${g} does not index into ${e}`);
    for (let b = 0; b < r; b++)
      u ? d.values[m * r + b] += f[p * r + b] : d.values[m * r + b] = t.rank === 0 ? f[0] : f[p * r + b];
  }
  return d;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const MS = Be((n) => 1 / (1 + Math.exp(-n)));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function BS(n, t, e, s, r) {
  const o = oy(s, t, e), i = z(e), a = Kt(s);
  if (o) {
    const h = iy(t, a);
    return r === "string" ? n.slice(h, h + i) : n.subarray(h, h + i);
  }
  const l = r === "string" ? Ku(n) : n, u = vt(s, r, l), c = vt(e, r);
  for (let h = 0; h < c.size; ++h) {
    const f = c.indexToLoc(h), d = f.map((p, g) => p + t[g]);
    c.set(u.get(...d), ...f);
  }
  return r === "string" ? Ly(c.values) : c.values;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function FS(n, t, e, s, r, o, i) {
  const a = t[0], l = o[0], u = new Array(l), c = new Array(a), h = t[1];
  if (l === 0) {
    if (a !== 0)
      throw new Error($y(a));
    const m = yt(e, 0), b = yt(r, 0);
    return [
      m,
      [0, h],
      b,
      u,
      c
    ];
  }
  let f = !0, d = 0;
  const p = new Array(l).fill(0);
  for (let m = 0; m < a; ++m) {
    const b = n[m * h];
    if (b < 0)
      throw new Error(Ay(m, b));
    if (b >= l)
      throw new Error(Ey(m, b, l));
    ++p[b], f = f && b >= d, d = b;
  }
  let g = !0;
  for (let m = 0; m < l; ++m) {
    const b = p[m] === 0;
    u[m] = b, g = g && !b, p[m] = Math.max(p[m], 1), m > 0 && (p[m] += p[m - 1]);
  }
  if (g && f) {
    const m = n, b = s;
    for (let y = 0; y < a; ++y)
      c[y] = y;
    return [
      m,
      [a, h],
      b,
      u,
      c
    ];
  } else {
    const m = p[l - 1], b = yt(e, m * h), y = yt(r, m), S = new Array(l).fill(0);
    for (let x = 0; x < a; ++x) {
      const v = n[x * h], E = S[v], D = (v === 0 ? 0 : p[v - 1]) + E;
      S[v]++;
      for (let k = 0; k < h; ++k)
        b[D * h + k] = n[x * h + k];
      y[D] = s[x], c[x] = D;
    }
    for (let x = 0; x < l; ++x)
      if (S[x] === 0) {
        const E = x === 0 ? 0 : p[x - 1];
        b[E * h + 0] = x;
        for (let D = 1; D < h; ++D)
          b[E * h + D] = 0;
        y[E] = i;
      }
    return [
      b,
      [m, h],
      y,
      u,
      c
    ];
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function zS(n, t, e, s, r) {
  const o = z(s), i = t[0], a = r.length, l = [];
  let u = 1, c = -1;
  for (let m = 0; m < a; ++m) {
    const b = r[m];
    if (b === -1) {
      if (c !== -1)
        throw new Error(_y(c, m));
      c = m, l.push(1);
    } else {
      if (b < 0)
        throw new Error(Cy(m, b));
      u *= b, l.push(b);
    }
  }
  if (c !== -1) {
    if (u <= 0)
      throw new Error(ky());
    const m = Math.trunc(o / u);
    if (u * m !== o)
      throw new Error(Ty(s, l));
    l[c] = m;
  }
  if (z(l) !== o)
    throw new Error(Ny(s, l));
  const f = s.length, d = [];
  if (f > 0) {
    d[f - 1] = 1;
    for (let m = f - 2; m >= 0; --m)
      d[m] = d[m + 1] * s[m + 1];
  }
  const p = [];
  if (a > 0) {
    p[a - 1] = 1;
    for (let m = a - 2; m >= 0; --m)
      p[m] = p[m + 1] * l[m + 1];
  }
  const g = yt(e, i * a);
  for (let m = 0; m < i; ++m) {
    let b = 0;
    for (let y = 0; y < f; ++y)
      b += n[m * f + y] * d[y];
    for (let y = 0; y < a; ++y)
      g[m * a + y] = Math.trunc(b / p[y]), b %= p[y];
  }
  return [g, [i, a], l];
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function US(n, t, e, s, r, o = !1, i = 0) {
  const a = s.length, l = [t[0], n.length / t[0]], u = l[1], h = a > 0 ? r[a - 1] + 1 : 0;
  if (h < 0)
    throw new Error(Ba());
  const f = t.slice();
  f[0] = h;
  const d = f.reduce((S, x) => S * x, 1), p = yt(e, d);
  if (a === 0)
    return h > 0 && p.fill(i), [p, f];
  if (h <= 0)
    throw new Error(Ba());
  let g = 0, m = 1, b = 0, y = r[g];
  for (; ; ) {
    let S = 0;
    if (m < a) {
      if (S = r[m], y === S) {
        ++m;
        continue;
      }
      if (y >= S)
        throw new Error(Dy());
    }
    if (y < 0 || y >= h)
      throw new Error(Py(y, h));
    y > b && p.fill(i, b * u, y * u);
    for (let x = g; x < m; ++x) {
      const v = s[x];
      if (v < 0 || v >= l[0])
        throw new Error(Ry(x, s[x], l[0]));
      for (let E = 0; E < u; E++)
        p[y * u + E] += n[v * u + E];
    }
    if (o)
      for (let x = 0; x < u; x++)
        p[y * u + x] /= m - g;
    if (g = m, ++m, b = y + 1, y = S, m > a)
      break;
  }
  return b < h && p.fill(i, b * u, h * u), [p, f];
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an AS IS BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const WS = Be((n) => Math.sqrt(n));
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const GS = Lt((n, t) => {
  const e = n - t;
  return e * e;
});
/**
 * @license
 * Copyright 2023 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const VS = Be((n, t) => {
  const { pattern: e, replaceGlobal: s, rewrite: r } = t;
  return n.replace(new RegExp(e, s ? "g" : ""), r);
});
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function qS(n, t, e, s) {
  const r = vt(n, t.dtype);
  for (let o = 0; o < r.size; o++) {
    const i = r.indexToLoc(o), a = new Array(i.length);
    for (let l = 0; l < a.length; l++)
      a[l] = i[l] * e[l] + s[l];
    r.set(t.get(...a), ...i);
  }
  return r;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class jS {
  constructor(t, e, s, r, o, i) {
    this.separator = nn(t), this.nGramWidths = e, this.leftPad = nn(s), this.rightPad = nn(r), this.padWidth = o, this.preserveShort = i;
  }
  getPadWidth(t) {
    return Math.min(this.padWidth < 0 ? t - 1 : this.padWidth, t - 1);
  }
  getNumNGrams(t, e) {
    const s = this.getPadWidth(e);
    return Math.max(0, t + 2 * s - e + 1);
  }
  createNGrams(t, e, s, r, o, i) {
    for (let a = 0; a < o; ++a) {
      const l = this.getPadWidth(i), u = Math.max(0, l - a), c = Math.max(0, l - (o - (a + 1))), h = i - (u + c), f = e + (u > 0 ? 0 : a - l);
      let d = 0;
      d += u * this.leftPad.length;
      for (let y = 0; y < h; ++y)
        d += t[f + y].length;
      d += c * this.rightPad.length;
      const p = u + c + h - 1;
      d += p * this.separator.length, s[r + a] = new Uint8Array(d);
      const g = s[r + a];
      let m = 0;
      const b = (y) => y.forEach((S) => g[m++] = S);
      for (let y = 0; y < u; ++y)
        b(this.leftPad), b(this.separator);
      for (let y = 0; y < h - 1; ++y)
        b(t[f + y]), b(this.separator);
      if (h > 0) {
        b(t[f + h - 1]);
        for (let y = 0; y < c; ++y)
          b(this.separator), b(this.rightPad);
      } else {
        for (let y = 0; y < c - 1; ++y)
          b(this.rightPad), b(this.separator);
        b(this.rightPad);
      }
    }
  }
  // Data and splits together form the definition of the ragged tensor,
  // where data is 1 dimensional and contains the values of the tensor
  // and splits denotes the indices at which each row starts.
  compute(t, e) {
    const s = t.length, r = e.length;
    if (r > 0) {
      let l = e[0];
      if (l !== 0)
        throw new Error(`First split value must be 0, got ${l}`);
      for (let u = 1; u < r; ++u) {
        let c = e[u] >= l;
        if (c = c && e[u] <= s, !c)
          throw new Error(`Invalid split value ${e[u]}, must be in [${l}, ${s}]`);
        l = e[u];
      }
      if (l !== s)
        throw new Error(`Last split value must be data size. Expected ${s}, got ${l}`);
    }
    const o = r - 1, i = yt("int32", r);
    if (s === 0 || r === 0) {
      const l = new Array(s);
      for (let u = 0; u <= o; ++u)
        i[u] = 0;
      return [l, i];
    }
    i[0] = 0;
    for (let l = 1; l <= o; ++l) {
      const u = e[l] - e[l - 1];
      let c = 0;
      this.nGramWidths.forEach((h) => {
        c += this.getNumNGrams(u, h);
      }), this.preserveShort && u > 0 && c === 0 && (c = 1), i[l] = i[l - 1] + c;
    }
    const a = new Array(i[o]);
    for (let l = 0; l < o; ++l) {
      const u = e[l];
      let c = i[l];
      if (this.nGramWidths.forEach((h) => {
        const f = e[l + 1] - e[l], d = this.getNumNGrams(f, h);
        this.createNGrams(t, u, a, c, d, h), c += d;
      }), this.preserveShort && c === i[l]) {
        const h = e[l + 1] - e[l];
        if (h === 0)
          continue;
        const f = h + 2 * this.padWidth;
        this.createNGrams(t, u, a, c, 1, f);
      }
    }
    return [a, i];
  }
}
function HS(n, t, e, s, r, o, i, a) {
  return new jS(e, s, r, o, i, a).compute(n, t);
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function KS(n, t, e, s) {
  if (!n.length)
    return;
  if (t.length === 0) {
    for (let o = 0; o < n.length; ++o)
      s.push(n.subarray(o, o + 1));
    return;
  }
  if (t.length === 1) {
    const o = t[0];
    let i = n.indexOf(o);
    for (; i !== -1; ) {
      const a = n.subarray(0, i);
      (!e || a.length !== 0) && s.push(a), n = n.subarray(i + 1), i = n.indexOf(o);
    }
    (!e || n.length !== 0) && s.push(n);
    return;
  }
  let r = 0;
  for (let o = 0; o < n.length + 1; o++)
    if (o === n.length || t.indexOf(n[o]) !== -1) {
      const i = n.subarray(r, o);
      (!e || i.length !== 0) && s.push(i), r = o + 1;
    }
}
function YS(n, t, e) {
  const s = n.length, r = [];
  let o = 0, i = 0;
  const a = new Array(s);
  for (let f = 0; f < s; ++f) {
    const d = r.length;
    KS(n[f], t, e, r);
    const p = r.length - d;
    a[f] = p, o += p, i = Math.max(i, p);
  }
  const l = yt("int32", o * 2), u = new Array(o), c = [s, i];
  let h = 0;
  for (let f = 0; f < s; ++f)
    for (let d = 0; d < a[f]; ++d)
      l[h * 2] = f, l[h * 2 + 1] = d, u[h] = r[h], ++h;
  return [l, u, c];
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function XS(n, t) {
  const e = yt("int32", n.length);
  for (let s = 0; s < n.length; ++s)
    e[s] = wp(n[s]).modulo(t).getLowBitsUnsigned();
  return e;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const JS = Lt((n, t) => n - t);
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ZS(n, t) {
  const e = new Array(n.rank);
  for (let r = 0; r < e.length; r++)
    e[r] = n.shape[r] * t[r];
  const s = vt(e, n.dtype);
  for (let r = 0; r < s.values.length; ++r) {
    const o = s.indexToLoc(r), i = new Array(n.rank);
    for (let l = 0; l < i.length; l++)
      i[l] = o[l] % n.shape[l];
    const a = n.locToIndex(i);
    s.values[r] = n.values[a];
  }
  return s;
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const fs = (n, t) => {
  const e = t.value - n.value;
  return e === 0 ? n.index - t.index : e;
};
function lf(n, t, e = 0, s = n.length - 1) {
  for (; s > e; ) {
    if (s - e > 600) {
      const a = s - e + 1, l = t - e + 1, u = Math.log(a), c = 0.5 * Math.exp(2 * u / 3), h = 0.5 * Math.sqrt(u * c * (a - c) / a) * Math.sign(l - a / 2), f = Math.max(e, Math.floor(t - l * c / a + h)), d = Math.min(s, Math.floor(t + (a - l) * c / a + h));
      lf(n, t, f, d);
    }
    const r = n[t];
    let o = e, i = s;
    for (En(n, e, t), fs(n[s], r) > 0 && En(n, e, s); o < i; ) {
      for (En(n, o, i), o++, i--; fs(n[o], r) < 0; )
        o = o + 1;
      for (; fs(n[i], r) > 0; )
        i = i - 1;
    }
    fs(n[e], r) === 0 ? En(n, e, i) : (i = i + 1, En(n, i, s)), i <= t && (e = i + 1), t <= i && (s = i - 1);
  }
}
function QS(n, t, e, s, r) {
  const o = t[t.length - 1], [i, a] = [n.length / o, o], l = Rn(e, i * s), u = Rn("int32", i * s);
  for (let h = 0; h < i; h++) {
    const f = h * a, d = n.subarray(f, f + a);
    let p = new Array(d.length);
    d.forEach((y, S) => p[S] = { value: y, index: S }), s < p.length && (lf(p, s), p = p.slice(0, s)), r && p.sort(fs);
    const g = h * s, m = l.subarray(g, g + s), b = u.subarray(g, g + s);
    for (let y = 0; y < s; y++)
      m[y] = p[y].value, b[y] = p[y].index;
  }
  const c = t.slice();
  return c[c.length - 1] = s, [
    vt(c, e, l),
    vt(c, "int32", u)
  ];
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function t2(n, t, e, s) {
  const r = _s(t, e)[0], o = [1, e[0], 1];
  for (let p = 0; p < r; p++)
    o[0] *= e[p];
  o[1] = e[r];
  for (let p = r + 1; p < e.length; p++)
    o[2] *= e[p];
  const i = /* @__PURE__ */ new Map(), a = new Int32Array(e[r]), l = new ur(o, s, n), u = [], c = o[0] === 1 && o[2] === 1;
  for (let p = 0; p < e[r]; p++) {
    let g;
    if (c)
      g = n[p].toString();
    else {
      const b = [];
      for (let y = 0; y < o[0]; y++)
        for (let S = 0; S < o[2]; S++)
          b.push(l.get(y, p, S));
      g = b.join(",");
    }
    const m = i.get(g);
    if (m != null)
      a[p] = m;
    else {
      const b = i.size;
      i.set(g, b), a[p] = b, u.push(p);
    }
  }
  const h = o.slice();
  h[1] = i.size;
  const f = new ur(h, s);
  u.forEach((p, g) => {
    for (let m = 0; m < o[0]; m++)
      for (let b = 0; b < o[2]; b++)
        f.set(l.get(m, p, b), m, g, b);
  });
  const d = e.slice();
  return d[r] = h[1], {
    outputValues: f.values,
    outputShape: d,
    indices: a
  };
}
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const e2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addImpl: Qx,
  bincountImpl: tS,
  bincountReduceImpl: eS,
  bitwiseAndImpl: nS,
  castImpl: Zx,
  ceilImpl: sS,
  concatImpl: rS,
  equalImpl: oS,
  expImpl: iS,
  expm1Impl: aS,
  floorDivImpl: uS,
  floorImpl: lS,
  gatherNdImpl: cS,
  gatherV2Impl: hS,
  greaterEqualImpl: dS,
  greaterImpl: fS,
  lessEqualImpl: mS,
  lessImpl: pS,
  linSpaceImpl: gS,
  logImpl: bS,
  maxImpl: yS,
  maximumImpl: wS,
  minimumImpl: xS,
  multiplyImpl: af,
  negImpl: SS,
  notEqualImpl: vS,
  prodImpl: $S,
  raggedGatherImpl: NS,
  raggedRangeImpl: DS,
  raggedTensorToTensorImpl: PS,
  rangeImpl: RS,
  rsqrtImpl: LS,
  scatterImpl: OS,
  sigmoidImpl: MS,
  simpleAbsImpl: Jx,
  sliceImpl: BS,
  sparseFillEmptyRowsImpl: FS,
  sparseReshapeImpl: zS,
  sparseSegmentReductionImpl: US,
  sqrtImpl: WS,
  squaredDifferenceImpl: GS,
  staticRegexReplaceImpl: VS,
  stridedSliceImpl: qS,
  stringNGramsImpl: HS,
  stringSplitImpl: YS,
  stringToHashBucketFastImpl: XS,
  subImpl: JS,
  tileImpl: ZS,
  topKImpl: QS,
  transposeImpl: IS,
  uniqueImpl: t2
}, Symbol.toStringTag, { value: "Module" }));
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const { addImpl: EI, castImpl: _I, ceilImpl: CI, concatImpl: n2, equalImpl: kI, expImpl: TI, expm1Impl: NI, floorImpl: DI, floorDivImpl: PI, gatherNdImpl: RI, gatherV2Impl: LI, greaterEqualImpl: OI, greaterImpl: MI, lessEqualImpl: BI, lessImpl: FI, logImpl: zI, maxImpl: s2, maximumImpl: UI, minimumImpl: WI, multiplyImpl: GI, negImpl: VI, notEqualImpl: qI, prodImpl: r2, rangeImpl: jI, rsqrtImpl: HI, scatterImpl: KI, simpleAbsImpl: YI, sliceImpl: o2, stridedSliceImpl: XI, stringNGramsImpl: JI, subImpl: ZI, tileImpl: QI, topKImpl: t$, transposeImpl: i2, uniqueImpl: e$ } = e2;
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class a2 {
  constructor(t, e) {
    this.variableNames = ["source"], this.workPerThread = 1, this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = e, this.rank = e.length, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, [this.workPerThread, 1, 1]), this.start = t, this.uniforms = `start : ${Tt(t.length)}, `, this.shaderKey = "slice";
  }
  getUserCode() {
    const t = Tt(this.rank), e = l2(this.rank);
    let s;
    return this.start.length === 1 ? s = this.outputShape.map((o, i) => "sourceLoc = uniforms.start + coords;") : s = this.outputShape.map((o, i) => `sourceLoc.${ri[i]} = uniforms.start.${cn(i)} + coords.${ri[i]};`), `
      ${wt("index")} {
        if (index < uniforms.size) {
          var sourceLoc : ${t};
          let coords = getCoordsFromIndex(index);
          ${s.join(`
`)}
          setOutputAtIndex(index, getSource(${e}));
        }
      }
    `;
  }
}
const ri = ["x", "y", "z", "w", "u", "v"];
function l2(n) {
  if (n === 1)
    return "sourceLoc";
  if (n <= 6)
    return ri.slice(0, n).map((t) => `sourceLoc.${t}`).join(",");
  throw Error(`Slicing for rank ${n} is not yet supported`);
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function u2(n) {
  const { inputs: t, backend: e, attrs: s } = n, { x: r } = t, { begin: o, size: i } = s, [a, l] = ay(r, o, i);
  if (ry(r, a, l), e.shouldExecuteOnCPU([r]) || r.dtype === "string") {
    const h = e.tensorMap.get(r.dataId), f = o2(h.values, a, l, r.shape, r.dtype);
    return e.makeTensorInfo(l, r.dtype, f);
  }
  if (z(l) === 0)
    return e.makeTensorInfo(l, r.dtype, []);
  const u = new a2(a, l), c = [{ type: "int32", data: a }];
  return e.runWebGPUProgram(u, [r], r.dtype, c);
}
const c2 = {
  kernelName: Xl,
  backendName: "webgpu",
  kernelFunc: u2
};
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var it;
(function(n) {
  n[n.ADD = 0] = "ADD", n[n.ATAN2 = 1] = "ATAN2", n[n.COMPLEX_MULTIPLY_IMAG = 2] = "COMPLEX_MULTIPLY_IMAG", n[n.COMPLEX_MULTIPLY_REAL = 3] = "COMPLEX_MULTIPLY_REAL", n[n.DIV = 4] = "DIV", n[n.ELU_DER = 5] = "ELU_DER", n[n.EQUAL = 6] = "EQUAL", n[n.FLOOR_DIV = 7] = "FLOOR_DIV", n[n.GREATER = 8] = "GREATER", n[n.GREATER_EQUAL = 9] = "GREATER_EQUAL", n[n.LESS = 10] = "LESS", n[n.LESS_EQUAL = 11] = "LESS_EQUAL", n[n.LOGICAL_AND = 12] = "LOGICAL_AND", n[n.LOGICAL_OR = 13] = "LOGICAL_OR", n[n.MAX = 14] = "MAX", n[n.MIN = 15] = "MIN", n[n.MOD = 16] = "MOD", n[n.MUL = 17] = "MUL", n[n.NOT_EQUAL = 18] = "NOT_EQUAL", n[n.POW = 19] = "POW", n[n.PRELU = 20] = "PRELU", n[n.SQUARED_DIFFERENCE = 21] = "SQUARED_DIFFERENCE", n[n.SUB = 22] = "SUB";
})(it || (it = {}));
const h2 = "let resultTemp = a + b;", f2 = "let resultTemp = atan2(a, b);", d2 = "let resultTemp = areal * breal - aimag * bimag;", p2 = "let resultTemp = areal * bimag + aimag * breal;", m2 = "let resultTemp = a / b;", g2 = "let resultTemp = select(a * (b + 1.0), a, b >= b - b);", b2 = `
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a == b);
`, y2 = `
  let remainder =
      select(a % b, round(a % b), (round(a) == a) & (round(b) == b));
  let quotient = (a - remainder) / b;
  let resultTemp =
      round(select(quotient, quotient - 1, sign(remainder) == -sign(b)));
`, w2 = `
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a > b);
`, x2 = `
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a >= b);
`, S2 = `
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a < b);
`, v2 = `
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a <= b);
`, I2 = "return f32(a >= 1.0 && b >= 1.0);", $2 = `return (vec4<f32>(a >= vec4<f32>(1.0)) *
  vec4<f32>(b >= vec4<f32>(1.0)));`, A2 = "return f32(a >= 1.0 || b >= 1.0);", E2 = `return min(vec4<f32>(a >= vec4<f32>(1.0)) +
  vec4<f32>(b >= vec4<f32>(1.0)), vec4<f32>(1.0));`, _2 = "let resultTemp = max(a, b);", C2 = "let resultTemp = min(a, b);", k2 = `
  let isNaN = b == 0.;
  var resultTemp = a % b;
  resultTemp = select((resultTemp + b) % b, resultTemp,
      (a < 0. && b < 0.) || (a >= 0. && b > 0.));
`, T2 = `
  let isNaN = !vec4<bool>(b);
  var resultTemp = vec4<f32>(a % b);
  if (!((a[0] < 0. && b[0] < 0.) || (a[0] >= 0. && b[0] > 0.))) {
    resultTemp[0] = (resultTemp[0] + b[0]) % b[0];
  }
  if (!((a[1] < 0. && b[1] < 0.) || (a[1] >= 0. && b[1] > 0.))) {
    resultTemp[1] = (resultTemp[1] + b[1]) % b[1];
  }
  if (!((a[2] < 0. && b[2] < 0.) || (a[2] >= 0. && b[2] > 0.))) {
    resultTemp[2] = (resultTemp[2] + b[2]) % b[2];
  }
  if (!((a[3] < 0. && b[3] < 0.) || (a[3] >= 0. && b[3] > 0.))) {
    resultTemp[3] = (resultTemp[3] + b[3]) % b[3];
  }
`, N2 = "let resultTemp = a * b;", D2 = `
  var resultTemp = f32(a != b);
  let valueForNaN = 1.0;
`, P2 = `
  var resultTemp = vec4<f32>(a != b);
  let valueForNaN = 1.0;
`, R2 = `
  let isNaN = a < 0.0 && floor(b) < b;
  if (b == 0.0) {
    return 1.0;
  }
  var resultTemp = select(sign(a) * pow(abs(a), b), pow(abs(a), b),
      round(abs(b) % 2.0) != 1.0);
`, L2 = `
  let isModRound1Bool = vec4<i32>(round(abs(b) % vec4<f32>(2.0))) == vec4<i32>(1);
  let isModRound1 = vec4<f32>(isModRound1Bool);
  let multiplier = sign(a) * isModRound1 + (vec4<f32>(1.0) - isModRound1);
  var resultTemp = multiplier * pow(abs(a), b);

  // Ensure that a^0 = 1, including 0^0 = 1 as this correspond to TF and JS
  let isExpZero = b == vec4<f32>(0.0);
  if (isExpZero.r) {
    resultTemp.r = 1.0;
  }
  if (isExpZero.g) {
    resultTemp.g = 1.0;
  }
  if (isExpZero.b) {
    resultTemp.b = 1.0;
  }
  if (isExpZero.a) {
    resultTemp.a = 1.0;
  }
  let isNaN = (a < vec4<f32>(0.0)) & (floor(b) < b);
`, O2 = "if (a < 0.0) { return b * a; }  return a;", M2 = `
  let aLessThanZero = vec4<f32>(a < vec4<f32>(0.0));
  return (aLessThanZero * (b * a)) + ((vec4<f32>(1.0) - aLessThanZero) * a);
`, B2 = "let resultTemp = (a - b) * (a - b);", F2 = "let resultTemp = a - b;";
function z2(n, t) {
  let e;
  do {
    switch (n) {
      case it.ATAN2:
        e = f2;
        break;
      case it.MAX:
        e = _2;
        break;
      case it.MIN:
        e = C2;
        break;
      case it.MOD:
        e = t ? T2 : k2;
        break;
      case it.NOT_EQUAL:
        e = t ? P2 : D2;
        break;
      case it.POW:
        e = t ? L2 : R2;
        break;
      default:
        continue;
    }
    let s, r, o;
    return t ? (s = "isnanVec4", r = "vec4<f32>", o = "vec4<bool>") : (s = "isnan", r = "f32", o = "bool"), `
      let aIsNaN = ${s}(a);
      let aPostLegalization = select(a, ${r}(42), aIsNaN);
      let bIsNaN = ${s}(b);
      let bPostLegalization = select(b, ${r}(42), bIsNaN);
      let isNaN = false;
      let valueForNaN = uniforms.NAN;
      {
        let a = aPostLegalization;
        let b = bPostLegalization;
        ${e}
        return select(
            resultTemp, ${r}(valueForNaN),
            ${o}(isNaN) | aIsNaN | bIsNaN);
      }
    `;
  } while (!1);
  switch (n) {
    case it.ADD:
      e = h2;
      break;
    case it.COMPLEX_MULTIPLY_IMAG:
      e = p2;
      break;
    case it.COMPLEX_MULTIPLY_REAL:
      e = d2;
      break;
    case it.DIV:
      e = m2;
      break;
    case it.ELU_DER:
      e = g2;
      break;
    case it.EQUAL:
      e = b2;
      break;
    case it.FLOOR_DIV:
      e = y2;
      break;
    case it.GREATER:
      e = w2;
      break;
    case it.GREATER_EQUAL:
      e = x2;
      break;
    case it.LESS:
      e = S2;
      break;
    case it.LESS_EQUAL:
      e = v2;
      break;
    case it.LOGICAL_AND:
      return t ? $2 : I2;
    case it.LOGICAL_OR:
      return t ? E2 : A2;
    case it.MUL:
      e = N2;
      break;
    case it.PRELU:
      return t ? M2 : O2;
    case it.SQUARED_DIFFERENCE:
      e = B2;
      break;
    case it.SUB:
      e = F2;
      break;
  }
  return `
    ${e}
    return resultTemp;
  `;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var F;
(function(n) {
  n[n.ABS = 0] = "ABS", n[n.ACOS = 1] = "ACOS", n[n.ACOSH = 2] = "ACOSH", n[n.ASIN = 3] = "ASIN", n[n.ASINH = 4] = "ASINH", n[n.ATAN = 5] = "ATAN", n[n.ATANH = 6] = "ATANH", n[n.CEIL = 7] = "CEIL", n[n.COS = 8] = "COS", n[n.COSH = 9] = "COSH", n[n.ELU = 10] = "ELU", n[n.ERF = 11] = "ERF", n[n.EXP = 12] = "EXP", n[n.EXPM1 = 13] = "EXPM1", n[n.FLOOR = 14] = "FLOOR", n[n.IS_FINITE = 15] = "IS_FINITE", n[n.IS_INF = 16] = "IS_INF", n[n.IS_NAN = 17] = "IS_NAN", n[n.LINEAR = 18] = "LINEAR", n[n.LOG = 19] = "LOG", n[n.LOG1P = 20] = "LOG1P", n[n.LOGICAL_NOT = 21] = "LOGICAL_NOT", n[n.NEG = 22] = "NEG", n[n.RELU = 23] = "RELU", n[n.RELU6 = 24] = "RELU6", n[n.LEAKYRELU = 25] = "LEAKYRELU", n[n.RECIPROCAL = 26] = "RECIPROCAL", n[n.ROUND = 27] = "ROUND", n[n.RSQRT = 28] = "RSQRT", n[n.SELU = 29] = "SELU", n[n.SIGMOID = 30] = "SIGMOID", n[n.SIGN = 31] = "SIGN", n[n.SIN = 32] = "SIN", n[n.SINH = 33] = "SINH", n[n.SOFTPLUS = 34] = "SOFTPLUS", n[n.SQRT = 35] = "SQRT", n[n.SQUARE = 36] = "SQUARE", n[n.STEP = 37] = "STEP", n[n.TAN = 38] = "TAN", n[n.TANH = 39] = "TANH", n[n.TO_INT = 40] = "TO_INT";
})(F || (F = {}));
const U2 = "return abs(a);", W2 = `
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  return acos(a);
`, G2 = `
  if (a < 1.) {
    return uniforms.NAN;
  }
  return acosh(a);
`, V2 = `
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  return asin(a);
`, q2 = "return asinh(a);", j2 = `
  if (isnan(a)) {
    return uniforms.NAN;
  }
  return atan(a);
`, H2 = `
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  if (a == 1.) {
    return uniforms.INFINITY;
  }
  if (a == -1.) {
    return -uniforms.INFINITY;
  }
  return atanh(a);
`, K2 = "return ceil(a);", Y2 = "return cos(a);", X2 = `
  let e2x = exp(-a);
  return (e2x + 1.0 / e2x) / 2.0;
`, J2 = "return exp(a) - 1.0;", Z2 = "if (a >= 0.0) { return a; }  return (exp(a) - 1.0);", Q2 = `
  var resFloat = exp(a) - vec4<f32>(1.0);
  if (a.r >= 0.0) {
    resFloat.r = a.r;
  }
  if (a.g >= 0.0) {
    resFloat.g = a.g;
  }
  if (a.b >= 0.0) {
    resFloat.b = a.b;
  }
  if (a.a >= 0.0) {
    resFloat.a = a.a;
  }
  return resFloat;
`, tv = `
  // Error function is calculated approximately with elementary function.
  // See "Handbook of Mathematical Functions with Formulas,
  // Graphs, and Mathematical Tables", Abramowitz and Stegun.
  let p = ${yy};
  let a1 = ${wy};
  let a2 = ${xy};
  let a3 = ${Sy};
  let a4 = ${vy};
  let a5 = ${Iy};

  let sign = sign(a);
  let absA = abs(a);
  let t = 1.0 / (1.0 + p * absA);
  return sign * (1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-absA * absA));
`, ev = "return exp(a);", nv = "return floor(a);", sv = "return f32(!isnan(a) && !isinf(a));", rv = "return f32(isinf(a));", ov = "return f32(isnan(a));", iv = "return a;", av = `if (a < 0.0) { return uniforms.NAN; }
  return log(a);`, lv = `
  if (isnan(a)) { return a; }
  return log(1.0 + a);
`, uv = "return f32(!(a >= 1.0));", cv = "return -a;", hv = "if (a < 0.0) { return uniforms.alpha * a; } return a;", fv = `
  let aLessThanZero = vec4<f32>(a < vec4<f32>(0.0));
  return (aLessThanZero * (uniforms.alpha * a)) + ((vec4<f32>(1.0) - aLessThanZero) * a);
`, dv = "return 1.0 / a;", pv = "return select(a, 0.0, a < 0.0);", mv = "return clamp(a, 0.0, 6.0);", gv = "return clamp(a, vec4<f32>(0.0, 0.0, 0.0, 0.0), vec4<f32>(6.0, 6.0, 6.0, 6.0));", bv = `
  return select(a, vec4<f32>(0.0), a < vec4<f32>(0.0));
`, yv = "return round(a);", wv = "return inverseSqrt(a);", xv = `
  if (a >= 0.0) {
    return ${by} * a;
  } else {
    return ${gy} * (exp(a) - 1.0);
  }
`, Sv = "return 1.0 / (1.0 + exp(-1.0 * a));", vv = "return sign(a);", Iv = "return sin(a);", $v = `
  let e2x = exp(a);
  return (e2x - 1.0 / e2x) / 2.0;
`, Av = `
  let epsilon = 1.1920928955078125e-7;
  let threshold = log(epsilon) + 2.0;

  let too_large = a > -threshold;
  let too_small = a < threshold;
  let exp_a = exp(a);

  if (too_large) {
    return a;
  } else if (too_small) {
    return exp_a;
  } else {
    return log(exp_a + 1.0);
  }
`, Ev = "return sqrt(a);", _v = "return a * a;", Cv = `
  if (isnan(a)) {
    return a;
  }

  return select(uniforms.stepAlpha, 1.0, a > 0.0);
`, kv = "return tan(a);", Tv = `
  let e2x = exp(-2.0 * abs(a));
  return sign(a) * (1.0 - e2x) / (1.0 + e2x);
`, Nv = "return f32(i32((a)));";
function An(n, t) {
  switch (n) {
    case F.ABS:
      return U2;
    case F.ACOS:
      return W2;
    case F.ACOSH:
      return G2;
    case F.ASIN:
      return V2;
    case F.ASINH:
      return q2;
    case F.ATAN:
      return j2;
    case F.ATANH:
      return H2;
    case F.COS:
      return Y2;
    case F.COSH:
      return X2;
    case F.CEIL:
      return K2;
    case F.ELU:
      return t ? Q2 : Z2;
    case F.ERF:
      return tv;
    case F.EXP:
      return ev;
    case F.EXPM1:
      return J2;
    case F.FLOOR:
      return nv;
    case F.IS_FINITE:
      return sv;
    case F.IS_INF:
      return rv;
    case F.IS_NAN:
      return ov;
    case F.LINEAR:
      return iv;
    case F.LOG:
      return av;
    case F.LOG1P:
      return lv;
    case F.LOGICAL_NOT:
      return uv;
    case F.NEG:
      return cv;
    case F.LEAKYRELU:
      return t ? fv : hv;
    case F.RECIPROCAL:
      return dv;
    case F.RELU:
      return t ? bv : pv;
    case F.RELU6:
      return t ? gv : mv;
    case F.ROUND:
      return yv;
    case F.RSQRT:
      return wv;
    case F.SELU:
      return xv;
    case F.SIGMOID:
      return Sv;
    case F.SIGN:
      return vv;
    case F.SIN:
      return Iv;
    case F.SINH:
      return $v;
    case F.SOFTPLUS:
      return Av;
    case F.SQRT:
      return Ev;
    case F.SQUARE:
      return _v;
    case F.STEP:
      return Cv;
    case F.TAN:
      return kv;
    case F.TANH:
      return Tv;
    case F.TO_INT:
      return Nv;
    default:
      throw new Error(`BinaryType ${n} is not implemented!`);
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function es(n, t = !1, e = !1, s = 3) {
  if (n === null)
    return "";
  let r = "";
  if (n === "linear")
    r = An(F.LINEAR);
  else if (n === "relu")
    r = An(F.RELU, e);
  else if (n === "elu")
    r = An(F.ELU, e);
  else if (n === "relu6")
    r = An(F.RELU6, e);
  else if (n === "prelu")
    r = z2(it.PRELU, e);
  else if (n === "sigmoid")
    r = An(F.SIGMOID, e);
  else if (n === "leakyrelu")
    r = An(F.LEAKYRELU, e);
  else
    throw new Error(`Activation ${n} has not been implemented for the WebGPU backend.`);
  const i = K(e ? 4 : 1);
  let a = "";
  return t ? a = `
      fn activation(a : ${i}, coords : vec${s}<i32>) -> ${i} {
        let b = getPreluActivationWeightsByOutputCoords(coords);
        ${r}
      }` : a = `
      fn activation(a : ${i}, coords : vec${s}<i32>) -> ${i} {
        ${r}
      }`, a;
}
function so(n, t) {
  return `
      ${n ? "value = value + getBiasByOutputCoords(coords);" : ""}
      ${t ? "value = activation(value, coords);" : ""}
      `;
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function uf(n, t, e = !1, s = !1, r = !1, o = 1) {
  w(n && o === 1 || !n, () => `transposeA ${n} is not compatible with component size ${o}`);
  const i = `
      ${n ? "value = getA(batch, col, row);" : "value = getA(batch, row, col);"}

    `, a = t ? "value = getB(batch, col, row);" : "value = getB(batch, row, col);";
  return `
  fn mm_readA(batch: i32, row: i32, col: i32) -> ${K(o)} {
    var value = ${K(o)}(0.0);
    ${e && r ? i : `
    ${n ? "if(row < uniforms.dimAOuter && col < uniforms.dimInner)" : "if(row < uniforms.aShape[1] && col < uniforms.aShape[2])"}
    {
      ${i}
    }
    `}
    return value;
  }

  fn mm_readB(batch: i32, row: i32, col: i32) -> ${K(o)} {
    var value = ${K(o)}(0.0);
    ${a}
    return value;
  }
  `;
}
function ca(n, t, e, s, r = !1, o = !1, i = !1, a = 1) {
  return `
  ${uf(e, s, r, o, i, a)}
  fn mm_write(batch: i32, row: i32, col: i32, valueIn: ${K(a)}) {
    ${r && o ? "" : "if (row < uniforms.dimAOuter && col < uniforms.dimBOuter)"}
    {
      var value = valueIn;
      let coords = vec3<i32>(batch, row, col);
      ${so(n, t)}
      setOutputAtCoords(coords[0], coords[1], coords[2], value);
    }
  }
  `;
}
const Dv = (n, t) => n ? `
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          kStart + inputRow,
          globalRowStart + inputCol * ${t});
        ` : `
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          globalRow + innerRow,
          kStart + inputCol * ${t});
        `, Pv = (n, t, e, s) => {
  if (n)
    return `
      for (var k = 0; k < ${s}; k++) {
        let BCached0 = mm_Bsub[k][tileCol];
        let ACached0 = mm_Asub[k][localRow];
        for (var i = 0; i < ${e}; i++) {
          acc[i] = fma(BCached0, vec4<f32>(ACached0[i]), acc[i]);
        }
      }`;
  {
    let r = "", o = "";
    for (let i = 0; i < t; i++)
      r += `let BCached${i} = mm_Bsub[k * ${t} + ${i}][tileCol];`, o += `acc[i] = fma(BCached${i}, vec4<f32>(ACached[${i}]), acc[i]);`;
    return `
      for (var k = 0; k < ${s / t}; k++) {
        ${r}
        for (var i = 0; i < ${e}; i++) {
          let ACached = mm_Asub[tileRow + i][k];
          ${o}
        }
      }`;
  }
};
function ha(n, t, e = !1, s = 32, r = !1, o = 32, i = !1) {
  const a = t[1] * n[1], l = t[0] * n[0], u = e ? a : s, c = e ? s : a, h = u / t[0], f = s / t[1], d = n[1], p = n[0];
  return w((e && h === 4 && n[1] === 4 || !e && (h === 3 || h === 4)) && u % t[0] === 0 && s % t[1] === 0 && n[0] === 4, () => `If transposeA ${e} is true, innerElementSize ${h} and workPerThread[1] ${n[1]} must be 4.
          Otherwise, innerElementSize ${h} must be 3 or 4.
      tileAWidth ${u} must be divisible by workgroupSize[0]${t[0]}. tileInner ${s} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${n[0]} must be 4.`), `
  var<workgroup> mm_Asub : array<array<vec${h}<f32>, ${u / h}>, ${c}>;
  var<workgroup> mm_Bsub : array<array<vec4<f32>, ${l / n[0]}>, ${s}>;

  ${wt()} {
    let localRow = i32(localId.y);
    let tileRow = localRow * ${d};
    let tileCol = i32(localId.x);

    let globalRow = i32(globalId.y) * ${d};
    let globalCol = i32(globalId.x) * ${p};
    let batch = ${r ? "0" : "i32(globalId.z)"};
    let batchA = ${r || !i ? "batch" : "batch % uniforms.aShape[0]"};
    let batchB = ${r || !i ? "batch" : "batch % uniforms.bShape[0]"};
    let globalRowStart = i32(workgroupId.y) * ${a};

    let numTiles = ${r ? `${Math.ceil(o / s)}` : `(uniforms.dimInner - 1) / ${s} + 1`};
    var kStart = ${r ? `i32(globalId.z) * ${o}` : "0"};

    var acc: array<vec4<f32>, ${d}>;

    // Loop over shared dimension.
    let tileRowB = localRow * ${f};
    for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        for (var innerRow = 0; innerRow < ${d}; innerRow++) {
            let inputRow = tileRow + innerRow;
            let inputCol = tileCol;
            ${Dv(e, h)}
        }

        // Load one tile of B into local memory.
        for (var innerRow = 0; innerRow < ${f}; innerRow++) {
            let inputRow = tileRowB + innerRow;
            let inputCol = tileCol;
            mm_Bsub[inputRow][inputCol] = mm_readB(batchB, kStart + inputRow, globalCol);
        }
        kStart = kStart + ${s};
        workgroupBarrier();

        // Compute acc values for a single thread.
        ${Pv(e, h, d, s)}
        workgroupBarrier();
    }

    for (var innerRow = 0; innerRow < ${d}; innerRow++) {
        mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
    }
  }`;
}
const Ml = (n) => n ? `
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          kStart + inputRow,
          globalRowStart + inputCol);
        ` : `
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          globalRowStart + inputRow,
          kStart + inputCol);
        `, Rv = (n) => n ? "let ACached = mm_Asub[k][tileRow + innerRow];" : "let ACached = mm_Asub[tileRow + innerRow][k];";
function fa(n, t, e = !1, s = 32, r = !1, o = 32, i = !1, a = !1) {
  const l = n[1] * t[1], u = n[0] * t[0], c = e ? l : s, h = e ? s : l;
  w(h % t[1] === 0 && c % t[0] === 0 && s % t[1] === 0, () => `tileAHight ${h} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${c} must be divisible by workgroupSize[0]${t[0]}, tileInner ${s} must be divisible by workgroupSize[1]${t[1]}`);
  const f = h / t[1], d = c / t[0], p = s / t[1], g = n[1], m = n[0], b = i ? `
      let localRow = i32(localId.y);
      let localCol = i32(localId.x);
      let globalRowStart = i32(workgroupId.y) * ${l};
      let globalColStart = i32(workgroupId.x) * ${u};

      // Loop over shared dimension.
      for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        for (var inputRow = localRow; inputRow < ${h}; inputRow = inputRow + ${t[1]}) {
          for (var inputCol = localCol; inputCol < ${c}; inputCol = inputCol + ${t[0]}) {
            ${Ml(e)}
          }
        }
        // Load one tile of B into local memory.
        for (var inputRow = localRow; inputRow < ${s}; inputRow = inputRow + ${t[1]}) {
              for (var inputCol = localCol; inputCol < ${u}; inputCol = inputCol + ${t[0]}) {
            mm_Bsub[inputRow][inputCol] = mm_readB(batchB,
              kStart + inputRow,
              globalColStart + inputCol);
          }
        }
        kStart = kStart + ${s};
        workgroupBarrier();

        // Compute acc values for a single thread.
        var BCached : array<f32, ${m}>;
        for (var k = 0; k < ${s}; k++) {
          for (var inner = 0; inner < ${m}; inner++) {
            BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
          }
          for (var innerRow = 0; innerRow < ${g}; innerRow++) {
            let ACached = ${e ? `mm_Asub[k][localRow + innerRow * ${t[1]}];` : `mm_Asub[localRow + innerRow * ${t[1]}][k];`}
            for (var innerCol = 0; innerCol < ${m}; innerCol++) {
              acc[innerRow][innerCol] =
                  fma(ACached, BCached[innerCol], acc[innerRow][innerCol]);
            }
          }
        }
        workgroupBarrier();
      }
      for (var innerRow = 0; innerRow < ${g}; innerRow++) {
        let gRow = globalRowStart + localRow + innerRow * ${t[1]};
        for (var innerCol = 0; innerCol < ${m}; innerCol++) {
          let gCol = globalColStart + localCol + innerCol * ${t[0]};
          mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
        }
      }
      ` : `
  let tileRow = i32(localId.y) * ${g};
  let tileCol = i32(localId.x) * ${m};

  let globalRow = i32(globalId.y) * ${g};
  let globalCol = i32(globalId.x) * ${m};
  let globalRowStart = i32(workgroupId.y) * ${l};

  let tileRowA = i32(localId.y) * ${f};
  let tileColA = i32(localId.x) * ${d};
  let tileRowB = i32(localId.y) * ${p};
  // Loop over shared dimension.
  for (var t = 0; t < numTiles; t++) {
    // Load one tile of A into local memory.
    for (var innerRow = 0; innerRow < ${f}; innerRow++) {
      for (var innerCol = 0; innerCol < ${d}; innerCol++) {
        let inputRow = tileRowA + innerRow;
        let inputCol = tileColA + innerCol;
        ${Ml(e)}
      }
    }

    // Load one tile of B into local memory.
    for (var innerRow = 0; innerRow < ${p}; innerRow++) {
      for (var innerCol = 0; innerCol < ${m}; innerCol++) {
        let inputRow = tileRowB + innerRow;
        let inputCol = tileCol + innerCol;
        mm_Bsub[inputRow][inputCol] = mm_readB(batchB,
          kStart + inputRow,
          globalCol + innerCol);
      }
    }
    kStart = kStart + ${s};
    workgroupBarrier();

    // Compute acc values for a single thread.
    var BCached : array<f32, ${m}>;
    for (var k = 0; k < ${s}; k++) {
      for (var inner = 0; inner < ${m}; inner++) {
        BCached[inner] = mm_Bsub[k][tileCol + inner];
      }

      for (var innerRow = 0; innerRow < ${g}; innerRow++) {
        ${Rv(e)}
        for (var innerCol = 0; innerCol < ${m}; innerCol++) {
          acc[innerRow][innerCol] =
              fma(ACached, BCached[innerCol], acc[innerRow][innerCol]);
        }
      }
    }

    workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < ${g}; innerRow++) {
    for (var innerCol = 0; innerCol < ${m}; innerCol++) {
      mm_write(batch, globalRow + innerRow, globalCol + innerCol,
          acc[innerRow][innerCol]);
    }
  }
  `;
  return `
    var<workgroup> mm_Asub : array<array<f32, ${c}>, ${h}>;
    var<workgroup> mm_Bsub : array<array<f32, ${u}>, ${s}>;

    ${wt()} {
      let batch = ${r ? "0" : "i32(globalId.z)"};
      let batchA = ${r || !a ? "batch" : "batch % uniforms.aShape[0]"};
      let batchB = ${r || !a ? "batch" : "batch % uniforms.bShape[0]"};
      let numTiles = ${r ? `${Math.ceil(o / s)}` : `(uniforms.dimInner - 1) / ${s} + 1`};
      var kStart = ${r ? `i32(globalId.z) * ${o}` : "0"};

      var acc : array<array<f32, ${m}>, ${g}>;

      // Without this initialization strange values show up in acc.
      for (var innerRow = 0; innerRow < ${g}; innerRow++) {
        for (var innerCol = 0; innerCol < ${m}; innerCol++) {
          acc[innerRow][innerCol] = 0.0;
        }
      }
      ${b}
    }
  `;
}
const Lv = (n) => n ? `
      mm_readA(batchA, colA, globalRow),
      mm_readA(batchA, colA + 1, globalRow),
      mm_readA(batchA, colA + 2, globalRow),
      mm_readA(batchA, colA + 3, globalRow)
  ` : `
      mm_readA(batchA, globalRow, colA),
      mm_readA(batchA, globalRow, colA + 1),
      mm_readA(batchA, globalRow, colA + 2),
      mm_readA(batchA, globalRow, colA + 3)
  `;
function Ov(n, t = !1) {
  w(n[1] === 1 && n[2] === 1, () => `A linear work group size is required. But got ${n}.`);
  const e = n[0] * 4;
  return `
    var<workgroup> mm_Asub : array<vec4<f32>, ${n[0]}>;

    ${wt()} {
      let tileCol = i32(localId.x);
      let globalCol = i32(globalId.x);
      let globalRow = i32(globalId.y);

      let numTiles = (uniforms.dimInner - 1) / ${e} + 1;
      let batch = i32(globalId.z);
      let batchA = batch % uniforms.aShape[0];
      let batchB = batch % uniforms.bShape[0];
      // Without this initialization strange values show up in acc.
      var acc = 0.0;

      // Loop over shared dimension.
      for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        let colA = t * ${e} + tileCol * 4;
        mm_Asub[tileCol] = vec4<f32>(${Lv(t)});
        workgroupBarrier();

        // Compute acc values for a single thread.
        for (var k = 0; k < ${e / 4}; k++) {
          let rowB = t * ${e} + k * 4;
          let BCached = vec4<f32>(mm_readB(batchB, rowB, globalCol),
                              mm_readB(batchB, rowB + 1, globalCol),
                              mm_readB(batchB, rowB + 2, globalCol),
                              mm_readB(batchB, rowB + 3, globalCol));

          let ACached = mm_Asub[k];
          acc = acc + dot(ACached, BCached);
        }

        workgroupBarrier();
      }

      mm_write(batch, globalRow, globalCol, acc);
    }
  `;
}
class Mv {
  constructor(t, e, s = !1, r = !1, o = null, i = null, a = null, l = !1) {
    this.variableNames = ["A", "B"], this.uniforms = "dimAOuter : i32, dimBOuter : i32, dimInner : i32,", this.outputShape = e, this.dispatchLayout = { x: [2], y: [1], z: [0] };
    const u = s ? t[1] : t[2];
    if (this.isVec4 = (u % 4 === 0 && !s || e[1] % 4 === 0 && s) && e[2] % 4 === 0 && !r, this.outputComponent = this.isVec4 ? 4 : 1, this.isVectorA = e[1] === 1 && !s, !this.isVec4 && this.isVectorA)
      this.elementsPerThread = [1, 1, 1], this.workgroupSize = [32, 1, 1];
    else {
      const f = Bx(e[1], u, e[2], s);
      this.workgroupSize = f.workgroupSize, this.elementsPerThread = f.elementsPerThread;
    }
    this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, this.elementsPerThread);
    const c = o != null, h = a != null;
    c && this.variableNames.push("bias"), h && this.variableNames.push("preluActivationWeights"), this.sequentialAccessByThreads = l, this.transposeA = s, this.transposeB = r, this.addBias = c, this.activation = i, this.hasPreluActivationWeights = h, [this.fitAOuter, this.fitBOuter, this.fitInner] = this.getShapeFit(e[1], e[2], u), this.shaderKey = `matMulPacked_${this.elementsPerThread}_${s}_${r}_${this.activation}_${this.fitAOuter}_${this.fitBOuter}_${this.fitInner}_${this.isVec4}_${this.isVectorA}_${this.sequentialAccessByThreads}`;
  }
  getShapeFit(t, e, s) {
    const r = this.workgroupSize[1] * this.elementsPerThread[1], o = this.workgroupSize[0] * this.elementsPerThread[0];
    !this.isVec4 && this.isVectorA ? this.tileInner = this.workgroupSize[0] * 4 : this.tileInner = o;
    const i = t % r === 0, a = e % o === 0, l = s % this.tileInner === 0;
    return [i, a, l];
  }
  getUserCode() {
    return `
      ${es(this.activation, this.hasPreluActivationWeights, this.isVec4)}
      ${ca(this.addBias, this.activation, !1, this.transposeB, this.fitAOuter, this.fitBOuter, this.fitInner, this.isVec4 ? 4 : 1)}
      ${this.isVec4 ? ha(this.elementsPerThread, this.workgroupSize, this.transposeA, this.tileInner, !1, null, !0) : this.isVectorA ? Ov(this.workgroupSize, this.transposeA) : fa(this.elementsPerThread, this.workgroupSize, this.transposeA, this.tileInner, !1, null, this.sequentialAccessByThreads, !0)}
    `;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Bv(n, t, e, s, r = !1, o = null, i = !1, a = 4, l = 4, u = 4) {
  const c = (T) => {
    switch (T) {
      case 1:
        return "resData = f32(x[xIndex]);";
      case 3:
        return "resData = vec3<f32>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);";
      case 4:
        return "resData = vec4<f32>(x[xIndex / 4]);";
      default:
        throw new Error(`innerElementSize ${T} is not supported.`);
    }
  }, h = (T) => {
    switch (T) {
      case 1:
        return "return f32(W[row * uniforms.wShape[3] + col]);";
      case 4:
        return "return vec4<f32>(W[(row * uniforms.wShape[3] + col) / 4]);";
      default:
        throw new Error(`innerElementSize ${T} is not supported.`);
    }
  }, f = n ? `
      let coord = vec4<i32>(batch, xRow, xCol, xCh);
      ` : `
      let coord = vec4<i32>(batch, xCh, xRow, xCol);
      `, d = n ? `
      let coords = vec4<i32>(
        batch,
        row / outWidth,
        row % outWidth,
        col);
      ` : `
      let coords = vec4<i32>(
        batch,
        row,
        col / outWidth,
        col % outWidth);
      `, p = n ? "uniforms.xShape[1]" : "uniforms.xShape[2]", g = n ? "uniforms.xShape[2]" : "uniforms.xShape[3]", m = n ? "row" : "col", b = n ? "col" : "row", y = `
      let inChannels = uniforms.wShape[2];
      let outWidth = ${n ? "uniforms.outShape[2]" : "uniforms.outShape[3]"};
      let outRow = ${m} / outWidth;
      let outCol = ${m} % outWidth;

      let WRow = ${b} / (uniforms.filterDims[1] * inChannels);
      let WCol = ${b} / inChannels % uniforms.filterDims[1];
      let xRow = outRow * uniforms.strides[0] + uniforms.dilations[0] * WRow - uniforms.pads[0];
      let xCol = outCol * uniforms.strides[1] + uniforms.dilations[1] * WCol - uniforms.pads[1];
      let xCh = ${b} % inChannels;
      var resData = ${K(a)}(0.0);
      // The bounds checking is always needed since we use it to pad zero for
      // the 'same' padding type.
      if (xRow >= 0 && xRow < ${p} && xCol >= 0 && xCol < ${g}) {
        ${f}
        let xIndex = getIndexFromCoords4D(coord, uniforms.xShape);
        ${c(a)}
      }
      return resData;`, S = n ? t && s ? `
      ${y}` : `
      if (row < uniforms.dimAOuter && col < uniforms.dimInner) {
        ${y}
      }
      return ${K(a)}(0.0);` : s && e ? `
      ${y}` : `
      if (row < uniforms.dimInner && col < uniforms.dimBOuter) {
        ${y}
      }
      return ${K(a)}(0.0);`, x = `${h(l)}`, v = K(u), E = K(n ? a : l), D = K(n ? l : a);
  return `
      ${es(o, i, u === 4, 4)}
      fn mm_readA(batch: i32, row : i32, col : i32) -> ${E} {
        ${n ? S : x}
      }

      fn mm_readB(batch: i32, row : i32, col : i32) -> ${D} {
        ${n ? x : S}
      }

      fn mm_write(batch: i32, row : i32, col : i32, valueIn : ${v}) {
        if (row < uniforms.dimAOuter && col < uniforms.dimBOuter)
        {
        var value = valueIn;
        let outWidth = ${n ? "uniforms.outShape[2]" : "uniforms.outShape[3]"};
        ${d}
        ${so(r, o)}
        setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
        }
      }`;
}
class Fv {
  constructor(t, e, s, r, o = !1, i = null, a = !1, l = !1) {
    this.variableNames = ["x", "W"], this.uniforms = "filterDims : vec2<i32>, pads : vec2<i32>, strides : vec2<i32>, dilations : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32,", this.outputShape = t.outShape, this.isChannelsLast = t.dataFormat === "channelsLast", this.isVec4 = ((t.inChannels % 4 === 0 || t.inChannels % 3 === 0) && this.isChannelsLast || t.outWidth % 4 === 0 && !this.isChannelsLast) && t.outChannels % 4 === 0, this.dispatchLayout = this.isChannelsLast ? { x: [3], y: [1, 2], z: [0] } : { x: [2, 3], y: [1], z: [0] }, this.workgroupSize = Fx(this.dispatchLayout, this.outputShape, this.isVec4), this.elementsPerThread = zx(this.dispatchLayout, this.outputShape, this.isVec4), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, this.elementsPerThread), this.isVec4 ? (this.outputComponent = 4, this.isChannelsLast && t.inChannels % 4 !== 0 ? (this.innerElementSize = 3, this.variableComponents = [1, 4]) : (this.innerElementSize = 4, this.variableComponents = [4, 4]), o && (this.variableNames.push("bias"), this.variableComponents.push(4)), a && (this.variableNames.push("preluActivationWeights"), this.variableComponents.push(4))) : (this.innerElementSize = this.elementsPerThread[0], o && this.variableNames.push("bias"), a && this.variableNames.push("preluActivationWeights")), this.sequentialAccessByThreads = l, this.addBias = o, this.activation = i, this.hasPreluActivationWeights = a, this.tileAOuter = this.workgroupSize[1] * this.elementsPerThread[1], this.tileBOuter = this.workgroupSize[0] * this.elementsPerThread[0], this.tileInner = Math.max(this.workgroupSize[0] * this.innerElementSize, this.workgroupSize[1]), this.fitAOuter = e % this.tileAOuter === 0, this.fitBOuter = s % this.tileBOuter === 0, this.fitInner = r % this.tileInner === 0, this.shaderKey = `conv2DMM_${this.elementsPerThread}_${this.activation}}_${this.fitAOuter}_${this.fitBOuter}_${this.fitInner}_${this.isVec4}_${this.innerElementSize}_${this.isChannelsLast}_${this.sequentialAccessByThreads}`;
  }
  getUserCode() {
    const t = this.isVec4 ? ha(this.elementsPerThread, this.workgroupSize, !this.isChannelsLast, this.tileInner) : fa(this.elementsPerThread, this.workgroupSize, !this.isChannelsLast, this.tileInner, !1, null, this.sequentialAccessByThreads), e = this.isVec4 ? [this.innerElementSize, 4, 4] : [1, 1, 1];
    return `
    ${Bv(this.isChannelsLast, this.fitAOuter, this.fitBOuter, this.fitInner, this.addBias, this.activation, this.hasPreluActivationWeights, e[0], e[1], e[2])}
    ${t}
  `;
  }
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class zv {
  constructor(t, e = !1, s = null, r = !1) {
    this.variableNames = ["x", "W"], this.uniforms = "filterDims: vec2<i32>, pads: vec2<i32>, strides: vec2<i32>, dilations: vec2<i32>,", this.workgroupSize = [4, 4, 8], this.outputShape = t.outShape, this.isChannelsLast = t.dataFormat === "channelsLast", this.dispatchLayout = this.isChannelsLast ? { x: [2], y: [1], z: [0, 3] } : { x: [3], y: [2], z: [0, 1] }, this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.addBias = e, this.activation = s, this.hasPreluActivationWeights = r, e && this.variableNames.push("bias"), r && this.variableNames.push("preluActivationWeights"), this.shaderKey = `conv2dnaive_${this.activation}_${this.isChannelsLast}`;
  }
  getUserCode() {
    return `
       ${es(this.activation, this.hasPreluActivationWeights, !1, 4)}
       fn readInp(batch : i32, row : i32, col : i32, chan : i32) -> f32{
         let coords = vec4<i32>(batch, row, col, chan);
         if (coordsInBounds4D(coords, uniforms.xShape)) {
           return  getX(batch, row, col, chan);
         } else {
          return 0.0;
         }
       }
       fn readFilt(row : i32, col : i32, xChannel : i32, outChannel : i32) -> f32{
         let coords = vec4<i32>(row, col, xChannel, outChannel);
         if(coordsInBounds4D(coords, uniforms.wShape)) {
           return getW(row, col, xChannel, outChannel);
          } else {
            return 0.0;
          }
       }
       fn writeResult(batch : i32, row : i32, col : i32, chan : i32, valueIn : f32) {
         let coords = ${this.isChannelsLast ? "vec4<i32>(batch, row, col, chan);" : "vec4<i32>(batch, chan, row, col);"}
         if (coordsInBounds4D(coords, uniforms.outShape)) {
           var value = valueIn;
           ${so(this.addBias, this.activation)}
           setOutputAtCoords(coords.x, coords.y, coords.z, coords.w, value);
         }
       }
       ${wt("index")} {
         let coords = getOutputCoords();
         let batch = coords[0];
         let outChannel = ${this.isChannelsLast ? "coords[3];" : "coords[1];"}
         let outRow = ${this.isChannelsLast ? "coords[1];" : "coords[2];"}
         let outCol = ${this.isChannelsLast ? "coords[2];" : "coords[3];"}
         var acc : f32 = 0.0;
         for (var row = 0; row < uniforms.filterDims[0]; row = row + 1) {
           for (var col = 0; col < uniforms.filterDims[1]; col = col + 1) {
             let xRow = outRow * uniforms.strides[0] + uniforms.dilations[0] * row - uniforms.pads[0];
             let xCol = outCol * uniforms.strides[1] + uniforms.dilations[1] * col - uniforms.pads[1];
             for (var xChannel = 0; xChannel < ${this.isChannelsLast ? "uniforms.xShape[3];" : "uniforms.xShape[1];"} xChannel = xChannel + 1) {
               ${this.isChannelsLast ? "let v = readInp(batch, xRow, xCol, xChannel);" : "let v = readInp(batch, xChannel, xRow, xCol);"}
               let f = readFilt(row, col, xChannel, outChannel);
               acc = acc + v * f;
             }
           }
         }
         writeResult(batch, outRow, outCol, outChannel, acc);
       }
     `;
  }
}
/**
 * @license
 * Copyright 2022 Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Uv {
  constructor(t, e) {
    this.variableNames = ["x"], this.uniforms = `pads : vec2<i32>, strides : vec2<i32>, dilations : vec2<i32>, outWidth : i32, itemsPerBlockRow : i32,
       inChannels : i32,`, this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = t, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.isChannelsLast = e, this.shaderKey = `im2col_${this.isChannelsLast}`;
  }
  getUserCode() {
    const t = this.isChannelsLast ? 1 : 2, e = this.isChannelsLast ? 2 : 3, s = this.isChannelsLast ? "coords[1]" : "coords[2]", r = this.isChannelsLast ? "coords[2]" : "coords[1]", o = this.isChannelsLast ? "getX(batch, xRow, xCol, ch)" : "getX(batch, ch, xRow, xCol)";
    return `
    ${wt("index")} {
      let coords = getCoordsFromIndex(index);
      if(index < uniforms.size) {
        let batch = coords[0];
        let row = ${s};
        let col = ${r};
        let offsetY = (row / uniforms.outWidth) * uniforms.strides[0] - uniforms.pads[0];
        let xRow = offsetY + uniforms.dilations[0] * (col / uniforms.itemsPerBlockRow);
        var value = 0.0;
        if(xRow < uniforms.xShape[${t}] && xRow >= 0) {
          let offsetX = (row % uniforms.outWidth) * uniforms.strides[1] -
              uniforms.pads[1];
          let xCol = offsetX + uniforms.dilations[1] * ((col %
              uniforms.itemsPerBlockRow) / uniforms.inChannels);
          let ch = col % uniforms.inChannels;
          if(xCol < uniforms.xShape[${e}] && xCol >= 0) {
            value = ${o};
          }
        }
        setOutputAtIndex(index, value);
      }
    }
   `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Wv(n) {
  return `
    var<workgroup> sumValues : array<f32, ${n}>;
    ${wt()} {
      let coords = getOutputCoords();
      let batch = coords[0];
      let batchA = batch % uniforms.aShape[0];
      let batchB = batch % uniforms.bShape[0];
      let row = coords[1];
      let col = coords[2];
      var sum = 0.0;
      let Length = uniforms.dimInner;
      for (var k = i32(localId.x); k < Length; k = k + ${n}) {
        let dataA = mm_readA(batchA, row, k);
        let dataB = mm_readB(batchB, k, col);
        sum = sum + dataA * dataB;
      }
      sumValues[localId.x] = sum;
      workgroupBarrier();

      for(var currentSize = ${n / 2}u; currentSize > 1u;
          currentSize = currentSize / 2u) {
        if (localId.x < currentSize)
        {
          sumValues[localId.x] = sumValues[localId.x] + sumValues[localId.x + currentSize];
        }
        workgroupBarrier();
      }

      if (localId.x == 0u) {
        sum = sumValues[0] + sumValues[1];
        mm_write(batch, row, col, sum);
      }
    }
  `;
}
class Gv {
  constructor(t, e = !1, s = !1, r = null, o = null, i = null) {
    this.variableNames = ["A", "B"], this.uniforms = "dimAOuter : i32, dimBOuter : i32, dimInner : i32,", this.workgroupSize = [256, 1, 1], this.outputShape = t, this.dispatchLayout = { x: [], y: [1, 2], z: [0] }, this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize);
    const a = r != null, l = i != null;
    a && this.variableNames.push("bias"), l && this.variableNames.push("preluActivationWeights"), this.transposeA = e, this.transposeB = s, this.addBias = a, this.activation = o, this.hasPreluActivationWeights = l, this.shaderKey = `matMulReduce_${this.activation}_${e}_${s}`;
  }
  getUserCode() {
    return `
      ${es(this.activation, this.hasPreluActivationWeights)}
      ${ca(this.addBias, this.activation, this.transposeA, this.transposeB)}
      ${Wv(this.workgroupSize[0])}
    `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Vv(n) {
  const t = n[1], e = n[0], s = t > e ? t : e;
  return `
  var<workgroup> mm_Asub : array<array<f32, ${s}>, ${t}>;
  var<workgroup> mm_Bsub : array<array<f32, ${e}>, ${s}>;

  // If the output size is small for matrix multiplication, avoid to use vec4
  // and handle some elements per thread to optimally utilize the ALU.
  // Read data from global memory to registers firstly, then store them into
  // shared memory, so it is instruction-Level parallelism for arithmetic
  // operations and others handle IO operations between barrier api, makes ALU
  // and load/store units work simultaneously, could improves the performance.
  ${wt()} {
    let tileRow = i32(localId.y);
    let tileCol = i32(localId.x);
    let globalRow = i32(globalId.y);
    let globalCol = i32(globalId.x);
    let batch = i32(globalId.z);
    let batchA = batch % uniforms.aShape[0];
    let batchB = batch % uniforms.bShape[0];

    // uniforms.dimInner should be greater than 0.
    let numTiles = (uniforms.dimInner - 1) / ${s} + 1;
    var acc = 0.0;

    var globalColA = tileCol;
    var globalRowB = 0;
    var regA = mm_readA(batchA, globalRow, globalColA);
    var regB0 = mm_readB(batchB, globalRowB + 2 * tileRow, globalCol);
    var regB1 = mm_readB(batchB, globalRowB + 2 * tileRow + 1, globalCol);
    globalColA = globalColA + ${s};
    globalRowB = globalRowB + ${s};

    for (var t = 0; t < numTiles; t = t + 1) {
      mm_Asub[tileRow][tileCol] = regA;
      mm_Bsub[2 * tileRow][tileCol] = regB0;
      mm_Bsub[2 * tileRow + 1][tileCol] = regB1;

      workgroupBarrier();

      regA = mm_readA(batchA, globalRow, globalColA);
      regB0 = mm_readB(batchB, globalRowB + 2 * tileRow, globalCol);
      regB1 = mm_readB(batchB, globalRowB + 2 * tileRow + 1, globalCol);
      globalColA = globalColA + ${s};
      globalRowB = globalRowB + ${s};

      for (var k = 0; k < ${s}; k = k + 1) {
        acc = acc + mm_Asub[tileRow][k] * mm_Bsub[k][tileCol];
      }
      workgroupBarrier();
    }

    mm_write(batch, globalRow, globalCol, acc);
  }
  `;
}
class qv {
  constructor(t, e, s, r = !1, o = !1, i = null, a = null, l = null) {
    this.variableNames = ["A", "B"], this.uniforms = "dimAOuter : i32, dimBOuter : i32, dimInner : i32,", this.workgroupSize = [16, 8, 1], this.outputShape = s, this.dispatchLayout = { x: [2], y: [1], z: [0] }, this.dispatch = [
      Math.ceil(s[2] / this.workgroupSize[0]),
      Math.ceil(s[1] / this.workgroupSize[1]),
      s[0]
    ];
    const u = i != null;
    u && this.variableNames.push("bias");
    const c = l != null;
    c && this.variableNames.push("preluActivationWeights"), this.transposeA = r, this.transposeB = o, this.addBias = u, this.activation = a, this.hasPreluActivationWeights = c, this.shaderKey = `matMulSmallOutputSize_${this.activation}_${r}_${o}`;
  }
  getUserCode() {
    return `
      ${es(this.activation, this.hasPreluActivationWeights)}
      ${ca(this.addBias, this.activation, this.transposeA, this.transposeB)}
      ${Vv(this.workgroupSize)}
    `;
  }
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class jv {
  constructor(t, e, s = !1, r = !1) {
    this.variableNames = ["A", "B"], this.uniforms = "dimAOuter : i32, dimBOuter : i32, dimInner : i32,", this.workgroupSize = [8, 8, 1], this.atomic = !0, this.splitedDimInner = 128, w(t[0] === 1, () => "MatMulSplitKProgram only supports batch = 1."), this.outputShape = t, this.dispatchLayout = { x: [2], y: [1], z: [0, 3] };
    const o = (s && this.outputShape[1] % 4 === 0 || !s && e % 4 === 0) && this.outputShape[2] % 4 === 0;
    this.elementsPerThread = [4, 4, this.splitedDimInner], this.outputComponent = o ? 4 : 1, o || (this.outputShape[1] < 16 && (this.elementsPerThread[1] = 1), this.outputShape[2] < 16 && (this.elementsPerThread[0] = 1)), this.dispatch = $t(this.dispatchLayout, [
      this.outputShape[0],
      this.outputShape[1],
      this.outputShape[2],
      e
    ], this.workgroupSize, this.elementsPerThread), this.transposeA = s, this.transposeB = r, this.shaderKey = `matMulSplitK_${s}_${r}_${this.elementsPerThread}_${this.outputComponent}`;
  }
  getUserCode() {
    const t = this.outputComponent;
    return `
      ${uf(!1, this.transposeB, !1, !1, !1, t)}
      fn mm_write(batch: i32, row : i32, col : i32, value : ${K(t)}) {
        if (row < uniforms.dimAOuter && col < uniforms.dimBOuter) {
          let coords = vec3<i32>(batch, row, col);
          let flatIndex = getOutputIndexFromCoords(coords);
          // The problem is that we should initialize output to zero before using.
          // Otherwise, the original value will be added to the result.
          for (var i = 0; i < ${t}; i = i + 1) {
            ${Ax("&result[flatIndex + i]", `${t > 1 ? "value[i]" : "value"}`)}
          }
        }
      }
      ${t === 4 ? ha(this.elementsPerThread, this.workgroupSize, this.transposeA, 32, !0, this.splitedDimInner) : fa(this.elementsPerThread, this.workgroupSize, this.transposeA, 32, !0, this.splitedDimInner)}
    `;
  }
}
class Hv {
  constructor(t, e = null, s = null, r = null) {
    this.uniforms = "", this.variableNames = ["x"], this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = t, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.addBias = e != null, this.hasPreluActivationWeights = r != null, this.activation = s, this.addBias && this.variableNames.push("bias"), this.hasPreluActivationWeights && this.variableNames.push("preluActivationWeights"), this.shaderKey = `biasActivation_${s}`;
  }
  getUserCode() {
    return `
    ${es(this.activation, this.hasPreluActivationWeights)}
    ${wt("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        var value = getXByOutputIndex(index);
        ${so(this.addBias, this.activation)}
        setOutputAtIndex(index, value);
      }
    }
    `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function dt(n) {
  const { inputs: t, attrs: e } = n, { x: s } = t, { shape: r } = e, o = z(s.shape), i = _f(r, o), a = z(i);
  return w(o === a, () => `The new shape (${i}) has ${a} elements and the old shape (${s.shape}) has ${o} elements. The new shape and old shape must have the same number of elements.`), n.backend.incRef(s.dataId), { dataId: s.dataId, shape: i, dtype: s.dtype };
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cf({ a: n, b: t, transposeA: e, transposeB: s, backend: r, bias: o = null, preluActivationWeights: i = null, leakyreluAlpha: a = 0, activation: l = null }) {
  const u = n.shape.length, c = t.shape.length, h = e ? n.shape[u - 2] : n.shape[u - 1], f = s ? t.shape[c - 1] : t.shape[c - 2], d = e ? n.shape[u - 1] : n.shape[u - 2], p = s ? t.shape[c - 2] : t.shape[c - 1], g = n.shape.slice(0, -2), m = t.shape.slice(0, -2), b = z(g), y = z(m), x = Wt(n.shape.slice(0, -2), t.shape.slice(0, -2)).concat([d, p]);
  w(h === f, () => `Error in matMul: inner shapes (${h}) and (${f}) of Tensors with shapes ${n.shape} and ${t.shape} and transposeA=${e} and transposeB=${s} must match.`);
  const v = e ? [b, h, d] : [b, d, h], E = s ? [y, p, f] : [y, f, p], D = dt({ inputs: { x: n }, backend: r, attrs: { shape: v } }), k = dt({ inputs: { x: t }, backend: r, attrs: { shape: E } }), T = [D, k], R = Math.max(b, y), B = [D, k], H = [
    { type: "int32", data: [d] },
    { type: "int32", data: [p] },
    { type: "int32", data: [h] }
  ];
  let X, W;
  const U = [R, d, p];
  let j = V().get("WEBGPU_MATMUL_PROGRAM_TYPE");
  if (j < 0) {
    const Ot = V().getNumber("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL"), le = Ot > 0 ? Ot : r.thresholdToIncreaseWorkgroups, Mt = R * Math.ceil(d / 32) * Math.ceil(p / 32);
    Mt <= le || d <= 8 && Mt <= le * 2 ? R * d * p <= 128 ? j = Se.MatMulReduceProgram : R === 1 && f >= 2e3 ? j = Se.MatMulSplitKProgram : j = Se.MatMulSmallOutputSizeProgram : j = Se.MatMulPackedProgram;
  }
  switch (j) {
    case Se.MatMulReduceProgram:
      X = new Gv(U, e, s, o, l, i);
      break;
    case Se.MatMulSplitKProgram: {
      if (W = of({ backend: r, attrs: { shape: U, value: 0, dtype: n.dtype } }), X = new jv(U, f, e, s), o || l) {
        W = r.runWebGPUProgram(X, B, n.dtype, H, W);
        const le = new Hv(W.shape, o, l, i);
        let Mt = null;
        const ns = [W];
        o && ns.push(o), i && ns.push(i), l === "leakyrelu" && (Mt = [{ type: "float32", data: [a] }], le.uniforms += " alpha : f32,");
        const da = r.runWebGPUProgram(le, ns, W.dtype, Mt);
        T.push(W);
        const ff = dt({ inputs: { x: da }, backend: r, attrs: { shape: x } });
        T.push(da);
        for (const df of T)
          r.disposeData(df.dataId);
        return ff;
      }
      break;
    }
    case Se.MatMulSmallOutputSizeProgram:
      X = new qv(v, E, U, e, s, o, l, i);
      break;
    case Se.MatMulPackedProgram:
      const Ot = r.adapterInfo.isIntel();
      X = new Mv(v, U, e, s, o, l, i, Ot);
      break;
    default:
      throw new Error(`Unsupported MatMulProgramType ${j}.`);
  }
  o && B.push(o), i && B.push(i), l === "leakyrelu" && (H.push({ type: "float32", data: [a] }), X.uniforms += " alpha : f32,"), W = r.runWebGPUProgram(X, B, n.dtype, H, W);
  const jt = dt({ inputs: { x: W }, backend: r, attrs: { shape: x } });
  T.push(W);
  for (const Ot of T)
    r.disposeData(Ot.dataId);
  return jt;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Br(n, t) {
  const e = n.length;
  return e >= 3 ? t ? [
    ...n.slice(0, -3),
    n[e - 3] * n[e - 2],
    n[e - 1]
    /* channel */
  ] : [
    ...n.slice(0, -3),
    n[e - 3],
    n[e - 2] * n[e - 1]
    /* height * width */
  ] : !t && e === 1 && n[0] > 1 ? [n[0], 1] : null;
}
function Kv({ x: n, filter: t, convInfo: e, backend: s, bias: r = null, preluActivationWeights: o = null, leakyreluAlpha: i = 0, activation: a = null }) {
  const l = e.dataFormat === "channelsLast", u = !l, c = !1, h = l && e.filterHeight === e.inHeight && e.filterWidth === e.inWidth && e.padInfo.type === "VALID", f = [];
  let d, p;
  if (h) {
    const b = e.inHeight * e.inWidth * e.inChannels;
    d = dt({
      inputs: { x: n },
      backend: s,
      attrs: { shape: [1, e.batchSize, b] }
    }), p = dt({
      inputs: { x: t },
      backend: s,
      attrs: { shape: [1, b, e.outChannels] }
    });
  } else
    d = dt({
      inputs: { x: n },
      backend: s,
      attrs: {
        shape: l ? [
          e.batchSize,
          e.inHeight * e.inWidth,
          e.inChannels
        ] : [
          e.batchSize,
          e.inChannels,
          e.inHeight * e.inWidth
        ]
      }
    }), p = dt({
      inputs: { x: t },
      backend: s,
      attrs: { shape: [1, e.inChannels, e.outChannels] }
    });
  if (f.push(d), f.push(p), o != null) {
    const b = Br(o.shape, l);
    b != null && (o = dt({
      inputs: { x: o },
      backend: s,
      attrs: { shape: b }
    }), f.push(o));
  }
  if (r != null) {
    const b = Br(r.shape, l);
    b != null && (r = dt({ inputs: { x: r }, backend: s, attrs: { shape: b } }), f.push(r));
  }
  const g = cf({
    a: l ? d : p,
    b: l ? p : d,
    transposeA: u,
    transposeB: c,
    backend: s,
    bias: r,
    activation: a,
    preluActivationWeights: o,
    leakyreluAlpha: i
  }), m = dt({ inputs: { x: g }, backend: s, attrs: { shape: e.outShape } });
  f.push(g);
  for (const b of f)
    s.disposeData(b.dataId);
  return m;
}
function Yv({ x: n, filter: t, convInfo: e, backend: s, bias: r = null, preluActivationWeights: o = null, leakyreluAlpha: i = 0, activation: a = null }) {
  const { filterWidth: l, filterHeight: u, inChannels: c, strideWidth: h, strideHeight: f, padInfo: d, outWidth: p, outHeight: g, dilationWidth: m, dilationHeight: b, dataFormat: y } = e, S = y === "channelsLast", x = l * u * c, v = g * p, E = S ? [e.batchSize, v, x] : [e.batchSize, x, v], D = new Uv(E, S), k = [
    { type: "int32", data: [d.top, d.left] },
    { type: "int32", data: [f, h] },
    { type: "int32", data: [b, m] },
    { type: "int32", data: [p] },
    { type: "int32", data: [c * l] },
    { type: "int32", data: [c] }
  ], T = s.runWebGPUProgram(D, [n], n.dtype, k), R = [];
  R.push(T);
  const B = dt({ inputs: { x: t }, backend: s, attrs: { shape: [1, x, -1] } });
  if (R.push(B), o != null) {
    const j = Br(o.shape, S);
    j != null && (o = dt({
      inputs: { x: o },
      backend: s,
      attrs: { shape: j }
    }), R.push(o));
  }
  if (r != null) {
    const j = Br(r.shape, S);
    j != null && (r = dt({ inputs: { x: r }, backend: s, attrs: { shape: j } }), R.push(r));
  }
  const W = cf({
    a: S ? T : B,
    b: S ? B : T,
    transposeA: !S,
    transposeB: !1,
    backend: s,
    bias: r,
    activation: a,
    preluActivationWeights: o,
    leakyreluAlpha: i
  }), U = dt({ inputs: { x: W }, backend: s, attrs: { shape: e.outShape } });
  R.push(W);
  for (const j of R)
    s.disposeData(j.dataId);
  return U;
}
function Xv({ x: n, filter: t, convInfo: e, backend: s, bias: r = null, preluActivationWeights: o = null, leakyreluAlpha: i = 0, activation: a = null }) {
  const l = r != null, u = o != null, c = e.dataFormat === "channelsLast", h = c && e.filterHeight === e.inHeight && e.filterWidth === e.inWidth && e.padInfo.type === "VALID", f = V().getBool("WEBGPU_USE_NAIVE_CONV2D_DEBUG");
  if (!f && (h || e.filterHeight === 1 && e.filterWidth === 1 && e.dilationHeight === 1 && e.dilationWidth === 1 && e.strideHeight === 1 && e.strideWidth === 1 && (e.padInfo.type === "SAME" || e.padInfo.type === "VALID")))
    return Kv({
      x: n,
      filter: t,
      convInfo: e,
      backend: s,
      bias: r,
      activation: a,
      preluActivationWeights: o,
      leakyreluAlpha: i
    });
  const d = V().getNumber("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL"), p = d > -1 ? d : s.thresholdToIncreaseWorkgroups, g = e.batchSize * Math.ceil(e.outHeight * e.outWidth / 32) * Math.ceil(e.outChannels / 32);
  if (V().getBool("WEBGPU_CONV_SEPARATE_IM2COL_SHADER") || g <= p)
    return Yv({
      x: n,
      filter: t,
      convInfo: e,
      backend: s,
      bias: r,
      preluActivationWeights: o,
      leakyreluAlpha: i,
      activation: a
    });
  let m;
  const b = [e.padInfo.top, e.padInfo.left], y = [
    { type: "int32", data: [e.filterHeight, e.filterWidth] },
    { type: "int32", data: [...b] },
    { type: "int32", data: [e.strideHeight, e.strideWidth] },
    { type: "int32", data: [e.dilationHeight, e.dilationWidth] }
  ];
  if (f)
    m = new zv(e, l, a, u);
  else {
    const E = c ? e.outHeight * e.outWidth : e.outChannels, D = c ? e.outChannels : e.outHeight * e.outWidth, k = e.filterHeight * e.filterWidth * e.inChannels;
    y.push({ type: "int32", data: [E] }, { type: "int32", data: [D] }, { type: "int32", data: [k] });
    const T = s.adapterInfo.isIntel();
    m = new Fv(e, E, D, k, l, a, u, T);
  }
  const S = [], x = [n, t];
  l && (!c && r.shape.length === 1 && (r = dt({ inputs: { x: r }, backend: s, attrs: { shape: [r.shape[0], 1, 1] } }), S.push(r)), x.push(r)), u && (!c && o.shape.length === 1 && (o = dt({
    inputs: { x: o },
    backend: s,
    attrs: { shape: [o.shape[0], 1, 1] }
  }), S.push(o)), x.push(o)), a === "leakyrelu" && (y.push({ type: "float32", data: [i] }), m.uniforms += " alpha : f32,");
  const v = s.runWebGPUProgram(m, x, n.dtype, y);
  for (const E of S)
    s.disposeData(E.dataId);
  return v;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function Jv(n) {
  const { inputs: t, backend: e, attrs: s } = n, { x: r, filter: o, bias: i, preluActivationWeights: a } = t, { strides: l, pad: u, dataFormat: c, dilations: h, dimRoundingMode: f, activation: d, leakyreluAlpha: p } = s, g = Pm(c), m = di(r.shape, o.shape, l, h, u, f, !1, g);
  return Xv({
    x: r,
    filter: o,
    convInfo: m,
    backend: e,
    bias: i,
    preluActivationWeights: a,
    leakyreluAlpha: p,
    activation: d
  });
}
const Zv = {
  kernelName: No,
  backendName: "webgpu",
  kernelFunc: Jv
};
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class Qv {
  constructor(t) {
    this.variableNames = ["x"], this.uniforms = "strides : vec2<i32>,", this.workgroupSize = [256, 1, 1], this.size = !0, this.outputShape = t.outShape, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.shaderKey = "poolWithFilterSizeEqualsOne";
  }
  getUserCode() {
    return `
      ${wt("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let batch = coords[0];
          let d = coords[3];

          let xRCCorner = coords.yz * uniforms.strides;
          let xRCorner = xRCCorner.x;
          let xCCorner = xRCCorner.y;

          let value = getX(batch, xRCorner, xCCorner, d);
          setOutputAtIndex(index, value);
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class tI {
  constructor(t, e, s = !1, r = !1, o = !1) {
    if (this.variableNames = ["x"], this.uniforms = "strides : vec2<i32>, pads : vec2<i32>, dilations : vec2<i32>, convDims : vec2<i32>, filterDims : vec2<i32>,", this.workgroupSize = [128, 1, 1], this.size = !0, e === "avg" && s)
      throw new Error("Cannot compute positions for average pool.");
    this.outputShape = t.outShape, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.poolType = e, this.computePositions = s, this.flattenPositions = r, this.includeBatchIndex = o, this.shaderKey = `pool2D_${e}_${s}_${r}_${o}`;
  }
  getUserCode() {
    let t;
    this.poolType === "avg" ? t = "resultValue = resultValue + value; count = count + 1.0;" : this.computePositions ? t = `let currMaxValue = mix(value, maxValue, maxValueFound);
      if (value >= currMaxValue) {
        maxValue = value;
        maxValueFound = 1.0;
        maxPosition = ${this.flattenPositions ? this.includeBatchIndex ? "((batch * uniforms.xShape[1] + xR) * uniforms.xShape[2] + xC) * uniforms.xShape[3] + d" : "(xR * uniforms.xShape[2] + xC) * uniforms.xShape[3] + d" : "wR * uniforms.filterDims.y + wC"};
      }` : t = "resultValue = max(value, resultValue);";
    let e = "resultValue";
    return this.poolType === "avg" && (e = "resultValue / max(count, 1.0)"), `
      ${wt("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
          let batch = coords[0];
          let d = coords[3];
          let xRCCorner = vec2<i32>(coords.yz) * uniforms.strides - uniforms.pads;
          let xRCorner = xRCCorner.x;
          let xCCorner = xRCCorner.y;

          ${this.computePositions ? `var maxValue = 0.0;
            var maxValueFound = 0.0;
            var maxPosition = 0;` : `var resultValue = ${this.poolType === "avg" ? "0.0" : "-1.0 / pow(10.0, -20.0)"};`}

          var count = 0.0;
          for (var wR = 0; wR < uniforms.filterDims.x; wR = wR + uniforms.dilations.x) {
            let xR = xRCorner + wR;

            if (xR < 0 || xR >= uniforms.convDims.x) {
              continue;
            }

            for (var wC = 0; wC < uniforms.filterDims.y; wC = wC + uniforms.dilations.y) {
              let xC = xCCorner + wC;
              if (xC < 0 || xC >= uniforms.convDims.y) {
                continue;
              }

              let value = getX(batch, xR, xC, d);
              ${t}
            }
          }

          ${this.computePositions ? "setOutputAtIndexI32(index, maxPosition);" : `setOutputAtIndex(index, ${e});`}
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class eI {
  constructor(t, e) {
    this.variableNames = ["A"], this.workgroupSize = [16, 16, 1];
    const s = new Array(t.length);
    for (let r = 0; r < s.length; r++)
      s[r] = t[e[r]];
    this.outputShape = s, this.dispatchLayout = { x: [0], y: [1] }, this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, [1, 1, 1]), this.shaderKey = "transposeShared";
  }
  getUserCode() {
    w(this.workgroupSize[0] === this.workgroupSize[1], () => `Must be a square tile, current tile shape is ${this.workgroupSize[0]} x ${this.workgroupSize[1]}`);
    const t = this.workgroupSize[0];
    return `
      var<workgroup> tile : array<array<f32, ${this.workgroupSize[0] + 1}>, ${this.workgroupSize[0]}>;
      ${wt()} {
        var x = i32(workgroupId.x) * ${t} + i32(localId.x);
        var y = i32(workgroupId.y) * ${t} + i32(localId.y);
        let width = uniforms.outShape[0];
        let height = uniforms.outShape[1];
        if (x < width && y < height) {
          tile[localId.y][localId.x] = f32(A[y * width + x]);
        }
        workgroupBarrier();

        x = i32(workgroupId.y) * ${t} + i32(localId.x);
        y = i32(workgroupId.x) * ${t} + i32(localId.y);
        if (x < height && y < width) {
          setOutputAtIndex((y * height + x), tile[localId.x]
            [localId.y]);
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class nI {
  constructor(t, e) {
    this.variableNames = ["A"], this.workPerThread = 1, this.workgroupSize = [64, 1, 1], this.size = !0;
    const s = new Array(t.length);
    for (let r = 0; r < s.length; r++)
      s[r] = t[e[r]];
    this.outputShape = s, this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, [this.workPerThread, 1, 1]), this.newDim = e, this.shaderKey = `transpose_${e}`;
  }
  getUserCode() {
    const t = Tt(this.outputShape.length), e = sI(this.newDim);
    return `
      ${wt("index")} {
        for(var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < uniforms.size) {
            let coords = getCoordsFromIndex(flatIndex);
            setOutputAtIndex(flatIndex, A[getIndexFromCoords${this.outputShape.length}D(
              ${t}(${e}), uniforms.aShape)]);
          }
        }
      }
    `;
  }
}
function sI(n) {
  const t = n.length;
  if (t > 6)
    throw Error(`Transpose for rank ${t} is not yet supported`);
  const e = new Array(t);
  for (let s = 0; s < n.length; s++)
    e[n[s]] = `coords.${cn(s)}`;
  return e.join();
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function rI(n) {
  const { inputs: t, backend: e, attrs: s } = n, { x: r } = t, { perm: o } = s, i = e, a = r.shape.length, l = new Array(a);
  for (let c = 0; c < l.length; c++)
    l[c] = r.shape[o[c]];
  if (e.shouldExecuteOnCPU([r])) {
    const h = i.tensorMap.get(r.dataId).values, f = i2(h, r.shape, r.dtype, o, l);
    return e.makeTensorInfo(l, r.dtype, f);
  }
  if (r.shape.length === 2 && oe(o, [1, 0])) {
    const c = new eI(r.shape, o);
    return i.runWebGPUProgram(c, [r], r.dtype);
  }
  const u = new nI(r.shape, o);
  return i.runWebGPUProgram(u, [r], r.dtype);
}
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class oI {
  constructor(t, e, s) {
    this.variableNames = ["x"], this.uniforms = "reduceSize : i32,", this.size = !0, this.inputShape = [t.batchSize, t.inSize];
    const [r] = bi(this.inputShape, [1]);
    this.outputShape = r.length === 0 ? [1] : r, t.inSize >= 32768 && s >= 512 ? this.workgroupSize = [512, 1, 1] : t.inSize >= 4096 ? this.workgroupSize = [256, 1, 1] : this.workgroupSize = [64, 1, 1], this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, [1, 1, 1]), this.reduceType = e, this.shaderKey = `reduce_${e}`;
  }
  getUserCode() {
    let t = "", e = "0.0";
    const s = this.workgroupSize[0];
    this.reduceType === "min" || this.reduceType === "max" ? (t = `
         if (isnan(candidate)) {
          bestValue = uniforms.NAN;
         } else if (!isnan(bestValue) && candidate ${this.reduceType === "min" ? "<" : ">"} bestValue)
           {  bestValue = candidate; }`, e = "f32(x[offset])") : this.reduceType === "sum" || this.reduceType === "mean" ? t = " bestValue = bestValue + candidate; " : this.reduceType === "prod" ? (t = " bestValue = bestValue * candidate; ", e = "1.0") : this.reduceType === "all" ? (t = " bestValue = f32(bestValue >= 1.0 && candidate >= 1.0); ", e = "1.0") : this.reduceType === "any" && (t = " bestValue = f32(bestValue >= 1.0 || candidate >= 1.0); ", e = "0.0");
    const r = this.reduceType === "mean" ? (
      // tslint:disable-next-line:max-line-length
      "setOutputAtIndex(outputIndex, bestValue / f32(uniforms.reduceSize));"
    ) : "setOutputAtIndex(outputIndex, bestValue);";
    return `
       fn DIV_CEIL(a : u32, b : u32) -> u32 {
        return ((a - 1u) / b + 1u);
       }

       ${`
         var<workgroup> xBestValues : array<f32, ${s}>;
       `}
       fn getOffset(outputIndex : i32) -> i32 {
         let outputCoords = getCoordsFromIndex(outputIndex);
         let offset = ${this.outputShape.length === 1 ? "outputCoords" : "outputCoords[0]"} * uniforms.reduceSize;
          return offset;
       }
       ${wt("index")} {
         let outputIndex = index / ${s};
         let offset = getOffset(outputIndex);
         var bestValue = ${e};
         let Length = uniforms.reduceSize;
         let WorkPerThread = DIV_CEIL(u32(Length), ${s}u);
         for (var k = i32(localId.x); k < Length && outputIndex < uniforms.size;
             k = k + ${s}) {
           let candidate = f32(x[offset + k]);
           ${t}
         }
         xBestValues[localId.x] = bestValue;
         workgroupBarrier();

         var reduceSize = min(u32(Length), ${s}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (localId.x < currentSize) {
            let candidate = xBestValues[localId.x + interval];
            ${t}
            xBestValues[localId.x] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (localId.x == 0u && outputIndex < uniforms.size) {
          ${r}
        }
       }
     `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const iI = {
  mean: "float32",
  all: "bool",
  any: "bool"
};
function aI(n, t, e, s, r) {
  const o = n.shape.length, i = [], a = _s(t, n.shape);
  let l = a;
  const u = gg(l, o);
  let c = n;
  u != null && (c = rI({ inputs: { x: n }, attrs: { perm: u }, backend: r }), l = bg(l.length, o), i.push(c)), mg(s, l, o);
  const [h, f] = bi(c.shape, l);
  let d = h;
  e && (d = _u(h, a));
  let p;
  if (r.shouldExecuteOnCPU([c])) {
    const g = r.tensorMap.get(c.dataId).values;
    switch (s) {
      case "max":
        const m = s2(g, z(f), d, n.dtype);
        p = r.makeTensorInfo(d, n.dtype, m);
        break;
      case "prod":
        const { outVals: b, outShape: y, outDtype: S } = r2(c.shape, c.dtype, g, l);
        p = r.makeTensorInfo(y, S, b);
        break;
      default:
        throw new Error(`${s} CPU implementation is not yet supported.`);
    }
  } else {
    const g = z(f), b = z(c.shape) / g, y = { windowSize: g, inSize: g, batchSize: b, outSize: 1 }, S = iI[s] || Dp(n.dtype), x = [
      { type: "int32", data: [g] }
    ], v = new oI(y, s, r.device.limits.maxComputeWorkgroupSizeX), E = r.runWebGPUProgram(v, [c], S, x);
    i.push(E), p = dt({ inputs: { x: E }, attrs: { shape: d }, backend: r });
  }
  return i.forEach((g) => r.disposeData(g.dataId)), p;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function lI(n) {
  const { inputs: t, backend: e, attrs: s } = n, { x: r } = t, { reductionIndices: o, keepDims: i } = s;
  return aI(r, o, i, "max", e);
}
/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function uI(n, t, e, s) {
  if (t.filterWidth === 1 && t.filterHeight === 1 && oe(t.inShape, t.outShape))
    return He({ inputs: { x: n }, backend: s });
  if (t.filterWidth === t.inWidth && t.filterHeight === t.inHeight && t.batchSize === 1 && t.padInfo.type === "VALID") {
    const i = n.shape.length, a = dt({
      inputs: { x: n },
      backend: s,
      attrs: {
        shape: [
          n.shape[i - 3] * n.shape[i - 2],
          n.shape[i - 1]
          /* channel */
        ]
      }
    });
    let l;
    w(e === "max", () => `Invalid pool type ${e}`), l = lI({
      inputs: { x: a },
      backend: s,
      attrs: { reductionIndices: 0, keepDims: !1 }
    });
    const u = dt({ inputs: { x: l }, backend: s, attrs: { shape: t.outShape } });
    return s.disposeData(a.dataId), s.disposeData(l.dataId), u;
  }
  let r;
  const o = [{ type: "int32", data: [t.strideHeight, t.strideWidth] }];
  return t.filterHeight === 1 && t.filterWidth === 1 ? r = new Qv(t) : (w(e === "max", () => `Invalid pool type ${e}`), r = new tI(t, "max"), o.push({ type: "int32", data: [t.padInfo.top, t.padInfo.left] }, {
    type: "int32",
    data: [t.dilationHeight, t.dilationWidth]
  }, { type: "int32", data: [t.inHeight, t.inWidth] }, {
    type: "int32",
    data: [t.effectiveFilterHeight, t.effectiveFilterWidth]
  })), s.runWebGPUProgram(r, [n], n.dtype, o);
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function cI(n) {
  const { inputs: t, backend: e, attrs: s } = n, { x: r } = t, { filterSize: o, strides: i, pad: a, dimRoundingMode: l } = s, c = km(r.shape, o, i, 1, a, l);
  return uI(r, c, "max", e);
}
const hI = {
  kernelName: Hl,
  backendName: "webgpu",
  kernelFunc: cI
};
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class fI {
  constructor(t, e, s, r) {
    this.variableNames = ["x"], this.uniforms = "adjustHeightWidth : vec2<f32>, roundBase : f32,", this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = [t[0], e, s, t[3]], this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize), this.halfPixelCenters = r, this.shaderKey = `resizeNearest_${r}`;
  }
  getUserCode() {
    let t;
    return this.halfPixelCenters ? t = "max((vec2<f32>(rc) + vec2<f32>(0.5)) * effectiveInputOverOutputRatioRC, vec2<f32>(0.0))" : t = "vec2<f32>(rc) * effectiveInputOverOutputRatioRC", `
      ${wt("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let b = coords[0];
          let d = coords[3];
          let rc = coords.yz;

          let effectiveInSize = vec2<f32>(
            f32(uniforms.xShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.xShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveOutSize = vec2<f32>(
            f32(uniforms.outShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.outShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveInputOverOutputRatioRC =
              effectiveInSize / effectiveOutSize;

          // Fractional source index
          let sourceFracIndexRC = ${t};

          // Compute the coordinators of nearest neighbor point.
          let inputShapeRC = vec2<f32>(f32(uniforms.xShape.y), f32(uniforms.xShape.z));
          let sourceNearestRC = vec2<i32>(
            min(inputShapeRC - 1.0, floor(sourceFracIndexRC + uniforms.roundBase)));
          let newValue = getX(b, sourceNearestRC.x, sourceNearestRC.y, d);

          setOutputAtIndex(index, newValue);
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function dI(n) {
  const { inputs: t, backend: e, attrs: s } = n, { images: r } = t, { alignCorners: o, halfPixelCenters: i, size: a } = s, [l, u] = a, c = o && l > 1 ? 1 : 0, h = o && u > 1 ? 1 : 0, d = [
    { type: "float32", data: [c, h] },
    { type: "float32", data: [o ? 0.5 : 0] }
  ], p = new fI(r.shape, l, u, i);
  return e.runWebGPUProgram(p, [r], r.dtype, d);
}
const pI = {
  kernelName: Yl,
  backendName: "webgpu",
  kernelFunc: dI
};
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
class mI {
  constructor(t) {
    this.uniforms = "", this.workPerThread = 1, this.workgroupSize = [64, 1, 1], this.size = !0, this.outputShape = Ss(
      t,
      1
      /* axis */
    ), this.variableNames = t.map((e, s) => `T${s}`), this.dispatchLayout = ae(this.outputShape), this.dispatch = $t(this.dispatchLayout, this.outputShape, this.workgroupSize, [this.workPerThread, 1, 1]), this.offsetLength = t.length - 1;
    for (let e = 0; e < this.offsetLength; e++)
      this.uniforms += `offset${e} : i32,`;
    this.shaderKey = "concat";
  }
  getUserCode() {
    const t = [];
    if (this.offsetLength > 0) {
      t.push("if (yC < uniforms.offset0){ setOutputAtCoords(coords.x, coords.y, getT0(yR, yC)); }");
      for (let o = 1; o < this.offsetLength; o++)
        t.push(`else if (yC < uniforms.offset${[o]}){ setOutputAtCoords(coords.x, coords.y, getT${o}(yR, yC - uniforms.offset${o - 1})); }`);
      const s = this.offsetLength, r = this.offsetLength - 1;
      t.push(`else { setOutputAtCoords(coords.x, coords.y, getT${s}(yR, yC - uniforms.offset${r})); }`);
    } else
      t.push("setOutputAtCoords(coords.x, coords.y, getT0(yR, yC));");
    return `
      ${wt("index")} {
        for(var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < uniforms.size) {
            let coords = getCoordsFromIndex(flatIndex);
            let yR = coords.x;
            let yC = coords.y;

            ${t.join(`
        `)}
          }
        }
      }
    `;
  }
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function gI(n) {
  const { inputs: t, backend: e } = n, { real: s, imag: r } = t, o = e.makeTensorInfo(s.shape, "complex64"), i = e.tensorMap.get(o.dataId), a = He({ inputs: { x: s }, backend: e }), l = He({ inputs: { x: r }, backend: e });
  return i.complexTensorInfos = { real: a, imag: l }, o;
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function bI(n) {
  const { inputs: t, backend: e } = n, { input: s } = t, r = e.tensorMap.get(s.dataId);
  return He({ inputs: { x: r.complexTensorInfos.imag }, backend: e });
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function yI(n) {
  const { inputs: t, backend: e } = n, { input: s } = t, r = e.tensorMap.get(s.dataId);
  return He({ inputs: { x: r.complexTensorInfos.real }, backend: e });
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function ds(n, t, e) {
  const s = n[0].dtype;
  if (s === "complex64") {
    const p = n.map((S) => yI({ inputs: { input: S }, backend: e })), g = n.map((S) => bI({ inputs: { input: S }, backend: e })), m = ds(p, t, e), b = ds(g, t, e), y = gI({ inputs: { real: m, imag: b }, backend: e });
    return p.forEach((S) => e.disposeData(S.dataId)), g.forEach((S) => e.disposeData(S.dataId)), e.disposeData(m.dataId), e.disposeData(b.dataId), y;
  }
  let r = e.shouldExecuteOnCPU(n);
  if (s === "string" && (r = !0), r) {
    const p = n.map((v) => {
      const D = [-1, z(v.shape.slice(t))];
      return dt({ inputs: { x: v }, backend: e, attrs: { shape: D } });
    }), g = p.map((v) => ({ vals: e.readSync(v.dataId), shape: v.shape })), m = Ss(
      p.map((v) => v.shape),
      1
      /* axis */
    ), b = p[0].shape[0] === 1, y = n2(g, m, s, b), S = Ss(n.map((v) => v.shape), t), x = e.makeTensorInfo(S, s, y);
    return p.forEach((v) => e.disposeData(v.dataId)), x;
  }
  const o = e.device.limits.maxStorageBuffersPerShaderStage - 1;
  if (n.length > o) {
    const p = [];
    for (let m = 0; m < n.length; m += o) {
      const b = n.slice(m, m + o);
      p.push(ds(b, t, e));
    }
    const g = ds(p, t, e);
    for (const m of p)
      e.disposeData(m.dataId);
    return g;
  }
  const { tensors2D: i, outShape: a } = wI(n, t, e), l = i.map((p) => p.shape), u = new mI(l), c = [], h = new Array(l.length - 1);
  if (h.length > 0) {
    h[0] = l[0][1], c.push({ type: "int32", data: [h[0]] });
    for (let p = 1; p < h.length; p++)
      h[p] = h[p - 1] + l[p][1], c.push({ type: "int32", data: [h[p]] });
  }
  const f = e.runWebGPUProgram(u, i, i[0].dtype, c);
  i.forEach((p) => e.disposeData(p.dataId));
  const d = dt({ inputs: { x: f }, backend: e, attrs: { shape: a } });
  return e.disposeData(f.dataId), d;
}
function wI(n, t, e) {
  const s = Ss(n.map((o) => o.shape), t);
  return { tensors2D: n.map((o) => dt({
    inputs: { x: o },
    backend: e,
    attrs: {
      shape: [
        z(o.shape.slice(0, t)),
        z(o.shape.slice(t))
      ]
    }
  })), outShape: s };
}
/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
function xI(n) {
  const { inputs: t, backend: e, attrs: s } = n, { axis: r } = s, o = _s(r, t[0].shape)[0], i = t.map((u) => u.shape);
  hy(i, o);
  const a = Ss(t.map((u) => u.shape), o);
  if (z(a) === 0)
    return e.makeTensorInfo(a, t[0].dtype, []);
  const l = t.filter((u) => z(u.shape) > 0);
  return l.length === 1 ? He({ inputs: { x: l[0] }, backend: e }) : ds(l, o, e);
}
const SI = {
  kernelName: jl,
  backendName: "webgpu",
  kernelFunc: xI
}, vI = [
  Vx,
  Xx,
  c2,
  Zv,
  hI,
  pI,
  SI,
  qx
];
for (const n of vI)
  up({
    ...n,
    backendName: "webgpu-oidn"
  });
async function II() {
  var n;
  try {
    const e = await navigator.gpu.requestAdapter(), s = {}, r = [];
    e.features.has("timestamp-query") && r.push("timestamp-query"), e.features.has("bgra8unorm-storage") && r.push(["bgra8unorm-storage"]), s.requiredFeatures = r;
    const o = e.limits;
    s.requiredLimits = {
      maxComputeWorkgroupStorageSize: o.maxComputeWorkgroupStorageSize,
      maxComputeWorkgroupsPerDimension: o.maxComputeWorkgroupsPerDimension,
      maxStorageBufferBindingSize: o.maxStorageBufferBindingSize,
      maxBufferSize: o.maxBufferSize,
      maxComputeWorkgroupSizeX: o.maxComputeWorkgroupSizeX,
      maxComputeInvocationsPerWorkgroup: o.maxComputeInvocationsPerWorkgroup
    };
    const i = await e.requestDevice(s), a = (
      // requestAdapterInfo is deprecated
      // @ts-ignore
      e.info ?? await ((n = e.requestAdapterInfo) == null ? void 0 : n.call(e))
    );
    return hf(i, a);
  } catch {
  }
}
async function hf(n, t) {
  let e = A.findBackend("webgpu-oidn");
  return e != null || (e = new Fs(n, t), A.registerBackend("webgpu-oidn", () => e), await A.setBackend("webgpu-oidn")), e;
}
async function $I(n, t, e) {
  const s = await (t ? hf(
    t.device,
    t.adapterInfo
  ) : II()), r = xf(n);
  return new xx(r, s, e);
}
async function n$(n, t, e) {
  return fetch(n).then((s) => s.arrayBuffer()).then((s) => $I(s, t, e));
}
export {
  xx as UNet,
  $I as initUNetFromBuffer,
  n$ as initUNetFromURL,
  xf as parseTZA
};
