// render/ — WebGL shader pipeline die elk frame tekent.

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Kan shader niet laden: ' + url);
  return r.text();
}

export async function createRenderer(canvas, { vert, frag }) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const [vs, fs] = await Promise.all([fetchText(vert), fetchText(frag)]);

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const locs = new Map();
  const loc = name => { if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name)); return locs.get(name); };

  const textures = new Map();
  function setTexture(name, unit, source) {
    let t = textures.get(name);
    if (!t) {
      t = gl.createTexture(); textures.set(name, t);
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(loc(name), unit);
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
  function resize(scale = 1) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    const w = Math.max(64, Math.round(innerWidth * dpr)), h = Math.max(64, Math.round(innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    return [w, h];
  }

  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return { gl, setTexture, setUniforms, resize, draw };
}
