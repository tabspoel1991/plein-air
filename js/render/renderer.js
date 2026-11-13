// render/ — WebGL shader pipeline die elk frame tekent.
// Eén hoofdprogramma (het schilderij) plus optioneel extra programma's (bijv. de kamer in de demo),
// en render targets (framebuffers) om een pass in een texture te tekenen.

async function fetchText(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Kan shader niet laden: ' + url);
      return await r.text();
    } catch (e) { if (i >= tries) throw e; await new Promise(res => setTimeout(res, 300 * i)); }
  }
}

export async function createRenderer(canvas, { vert, frag, preserve = false }) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: preserve, powerPreference: preserve ? 'high-performance' : 'low-power' });
  if (!gl) return null;
  const [vs, fs] = await Promise.all([fetchText(vert), fetchText(frag)]);

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  function makeProgram(fsrc) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    return { prog, locs: new Map(), aLoc: gl.getAttribLocation(prog, 'a') };
  }
  const programs = new Map([['main', makeProgram(fs)]]);
  let cur;
  function use(name) {
    cur = programs.get(name);
    gl.useProgram(cur.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(cur.aLoc); gl.vertexAttribPointer(cur.aLoc, 2, gl.FLOAT, false, 0, 0);
  }
  use('main');
  async function addProgram(name, fragUrl) { programs.set(name, makeProgram(await fetchText(fragUrl))); use('main'); }

  const loc = name => { if (!cur.locs.has(name)) cur.locs.set(name, gl.getUniformLocation(cur.prog, name)); return cur.locs.get(name); };

  const textures = new Map();
  function newTexture() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  function setTexture(name, unit, source) {
    let t = textures.get(name);
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (!t) { t = newTexture(); textures.set(name, t); }
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (source.data) // ruwe RGBA-bytes (masks): elk kanaal is een los mask, dus geen alpha-voorvermenigvuldiging
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    else
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(loc(name), unit);
  }
  // een bestaande texture (bijv. van een render target) aan een sampler van het huidige programma koppelen
  function bindTexture(name, unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc(name), unit);
  }

  // render target: tekent een pass in een texture in plaats van op het scherm
  function createTarget() {
    gl.activeTexture(gl.TEXTURE7);   // eigen unit: niet de textures van het schilderij (0-3) overschrijven
    const tex = newTexture(), fb = gl.createFramebuffer();
    return { tex, fb, w: 0, h: 0 };
  }
  function target(t, w, h) {
    if (t && (t.w !== w || t.h !== h)) {
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      t.w = w; t.h = h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? w : canvas.width, t ? h : canvas.height);
  }

  // Waarden: getal → float, [x,y] → vec2, [x,y,z] → vec3, [x,y,z,w] → vec4,
  // Float32Array → vec4-array (naam eindigt op [0]), {int: n} → int.
  function setUniforms(obj) {
    for (const name in obj) {
      const v = obj[name], l = loc(name);
      if (l === null) continue;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v instanceof Float32Array) gl.uniform4fv(l, v);
      else if (v && typeof v.int === 'number') gl.uniform1i(l, v.int);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    }
  }

  // scale = deel van de schermresolutie (frame-modus verlaagt dit als het hapert)
  // fixed = [w, h]: vaste resolutie (voor het renderen van de film)
  let fixed = null;
  function resize(scale = 1) {
    let w, h;
    if (fixed) [w, h] = fixed;
    else {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
      w = Math.max(64, Math.round(innerWidth * dpr)); h = Math.max(64, Math.round(innerHeight * dpr));
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height); // elk frame: blijft kloppen na zoom/rotatie
    return [canvas.width, canvas.height];
  }
  const setFixedSize = size => { fixed = size; };

  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return { gl, setTexture, bindTexture, setUniforms, resize, setFixedSize, draw, use, addProgram, createTarget, target };
}
