/* Field illustrations. All coordinates are in a 1000 × 414 print block. */
(function () {
  "use strict";

  const ink = "#292b25", dark = "#49483a", cinnabar = "#a74730";
  const paper = "#e9e2cb", bone = "#d5c8a4", gold = "#b39757";
  const cache = new WeakMap();

  function seeded(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function mark(ctx, shape, fill, stroke, weight = 1.25) {
    const path = typeof shape === "string" ? new Path2D(shape) : shape;
    if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = weight; ctx.stroke(path); }
    return path;
  }

  function oval(ctx, x, y, rx, ry, color, outline, angle = 0) {
    const p = new Path2D();
    p.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    return mark(ctx, p, color, outline);
  }

  function hatching(ctx, p, color, spacing = 8, angle = 0.48) {
    ctx.save();
    ctx.clip(p);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let y = -1000; y < 1100; y += spacing) {
      ctx.moveTo(-1050, y);
      ctx.bezierCurveTo(-360, y + 8, 340, y - 7, 1600, y + 5);
    }
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  function cloud(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(size, size);
    mark(ctx, "M-137 20 Q-58 21 -44 14 Q-26 4 -52 7 Q-66 7 -64 -2 Q-61 -13 -44 -9 Q-27 -33 -8 -13 Q6 -14 7 -6 Q21 -17 29 -5 Q44 -5 46 2 Q46 8 26 10 L110 11 M-108 26 L-35 25 Q-17 24 -8 18 L74 18 M-45 1 Q-36 -2 -39 -7 M-26 -8 Q-20 -16 -11 -10", null, "#a79f86", 1.35);
    ctx.restore();
  }

  function ridge(ctx, baseline, amplitude, seed, fill) {
    const rand = seeded(seed);
    const p = new Path2D();
    p.moveTo(-40, 435);
    let height = baseline;
    for (let x = -40; x <= 1060; x += 11) {
      height += (rand() - 0.49) * 13;
      const y = height + Math.sin(x / 62 + seed) * amplitude;
      p.lineTo(x, y);
    }
    p.lineTo(1060, 435); p.closePath();
    mark(ctx, p, fill, "#b4aa8e", 0.9);
    hatching(ctx, p, "#b5ab8e", 9, -0.94);
  }

  function pagoda(ctx, x, y, k) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    mark(ctx, "M-3 -132 L0 -145 L3 -132 L3 -122 L8 -118 L6 -114 L7 -109 L10 -106 L8 -101 L27 -85 Q38 -79 48 -83 Q44 -75 23 -73 L20 -67 L20 -55 Q40 -42 53 -47 Q48 -40 24 -36 L22 -30 L22 -15 Q46 -2 63 -9 Q57 1 27 5 L26 28 L-26 28 L-27 5 Q-57 1 -63 -9 Q-46 -2 -22 -15 L-22 -30 L-24 -36 Q-48 -40 -53 -47 Q-40 -42 -20 -55 L-20 -67 L-23 -73 Q-44 -75 -48 -83 Q-38 -79 -27 -85 L-8 -101 L-10 -106 L-7 -109 L-6 -114 L-8 -118 L-3 -122 Z", "#8d8972");
    for (const row of [-65, -30, 8]) {
      for (const col of [-12, 0, 12]) {
        mark(ctx, "M"+(col-2)+" "+(row+1)+" q2 -5 4 0 v8 h-4z", "#c7bda1");
      }
    }
    ctx.restore();
  }

  function landscape(ctx, floor) {
    ctx.fillStyle = paper; ctx.fillRect(0, 0, 1000, 414);
    const solarX = [0, 675, 676, 618][floor];
    const sun = oval(ctx, solarX, 139, 103, 103, "#b65b3f");
    hatching(ctx, sun, "#d18d68", 4.8, 0.02);
    oval(ctx, solarX, 139, 111, 111, null, "#c99a76");
    cloud(ctx, 165, 74, 0.88); cloud(ctx, 801, 94, 0.8);
    cloud(ctx, 79, 191, 0.54); cloud(ctx, 910, 189, 1.02);
    ridge(ctx, 300, 35, 23 + floor, "#d1c8ac");
    pagoda(ctx, floor === 3 ? 183 : 835, 338, 0.73);
    ridge(ctx, 366, 19, 57, "#c8bfa2");
    const rand = seeded(9184);
    ctx.fillStyle = "rgba(85,70,46,0.18)";
    for (let i = 0; i < 4800; i++) {
      const x = rand() * 1000, y = rand() * 414;
      ctx.fillRect(x, y, rand() * 1.6 + 0.3, 0.65);
    }
  }

  function moth(ctx) {
    ctx.save(); ctx.translate(503, 187); ctx.rotate(-0.09);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1);
      const hind = mark(ctx, "M12 13 Q82 4 148 43 Q170 68 149 99 Q137 127 117 111 Q104 103 92 123 Q75 159 66 162 Q54 158 64 133 Q67 112 52 109 Q29 108 18 71 Z", bone, ink, 3);
      hatching(ctx, hind, "#91805f", 4.9, 0.7);
      mark(ctx, "M16 40 Q82 60 126 77 Q144 85 148 94 M19 56 Q62 82 93 118 M23 66 Q61 99 67 134", null, dark, 2);
      const wing = mark(ctx, "M11 9 Q37 -47 112 -78 Q174 -107 263 -124 Q248 -104 244 -88 Q238 -67 221 -53 Q231 -44 210 -24 Q196 -14 180 -16 Q184 5 166 19 Q149 25 138 20 Q128 38 105 40 Q60 40 13 25 Z", ink, ink, 4);
      hatching(ctx, wing, "#726d53", 5, -0.55);
      mark(ctx, "M25 9 Q89 -58 232 -109 Q195 -78 171 -60 Q143 -32 139 -13 Q123 3 109 8 Q67 19 25 15 Z", bone, ink, 2.5);
      mark(ctx, "M29 11 Q112 -34 219 -95 M42 6 Q115 -31 168 -43 M60 8 Q123 -14 146 -23 M61 -8 Q106 -45 127 -66", null, dark, 1.8);
      mark(ctx, "M28 17 Q93 -6 112 -5 Q93 16 66 23 Z", cinnabar);
      for (let j=0; j<9; j++) {
        const x = 150 + j * 9.6, y = -18 - j * 9.6;
        oval(ctx, x, y, 3.7, 1.6, bone, null, -0.7);
      }
      ctx.save(); ctx.translate(133,-48); ctx.rotate(-0.5);
      oval(ctx,0,0,24,13,ink,gold); oval(ctx,0,0,17,8.5,cinnabar);
      oval(ctx,0,0,7,7,bone); oval(ctx,1,-1,3,5,ink); ctx.restore();
      mark(ctx,"M8 -16 Q22 -69 64 -76 M19 -47 Q29 -53 39 -52 M24 -56 Q35 -63 45 -60 M30 -63 Q40 -69 51 -68 M36 -68 Q46 -76 58 -74",null, ink,2);
      ctx.restore();
    }
    mark(ctx,"M-13 -14 Q-29 3 -11 34 Q-12 61 1 83 Q16 59 12 35 Q30 4 13 -14 Z",ink,ink,2);
    oval(ctx,0,-15,13,12,ink); oval(ctx,-7,-16,3,3,cinnabar); oval(ctx,7,-16,3,3,cinnabar);
    for (let j = 0; j < 6; j++) {
      const y=6+j*10, w=12-j;
      mark(ctx,`M-${w} ${y} Q0 ${y+8} ${w} ${y}`,null,gold,2.5);
    }
    // The moth carries a signal lantern suspended from its abdomen.
    mark(ctx,"M1 81 V96 M-8 99 L0 93 L9 99 Z M-8 118 L9 118 L5 123 H-4 Z",ink,ink,1.6);
    mark(ctx,"M-8 99 Q-16 109 -8 118 H9 Q16 109 9 99 Z",cinnabar,ink,2);
    mark(ctx,"M0 100 Q-3 109 0 116 M1 123 V144 M4 125 Q8 135 6 140",null,gold,2.3);
    ctx.restore();
  }

  function fox(ctx) {
    ctx.save(); ctx.translate(450, 199);
    const tail = "M5 31 C-43 65 -70 52 -102 25 C-148 -11 -177 -8 -222 4 C-188 -23 -199 -38 -229 -69 C-171 -53 -160 -92 -163 -118 C-144 -87 -104 -102 -81 -77 C-46 -40 -80 -7 -18 0 Z";
    for (const [x,y,a,k] of [[-8,22,-0.63,0.72],[10,0,0.39,0.85],[-8,0,-0.09,1.03]]) {
      ctx.save(); ctx.translate(x,y); ctx.rotate(a); ctx.scale(k,k);
      const p=mark(ctx,tail,ink,ink,2.6); hatching(ctx,p,"#766e55",6,0.54);
      mark(ctx,"M-215 -58 Q-196 -48 -183 -56 Q-168 -68 -163 -91 Q-150 -62 -123 -68 Q-150 -51 -139 -24 Q-157 -38 -180 -27 Q-175 -41 -215 -58Z",bone);
      mark(ctx,"M-143 -66 Q-116 -49 -126 -29 Q-126 -11 -105 4 M-115 -63 Q-97 -46 -108 -26 Q-113 -9 -88 14 M-93 -47 Q-83 -34 -90 -20 Q-93 -8 -71 11",null,gold,2);
      ctx.restore();
    }
    mark(ctx,"M-42 20 Q-20 -15 36 -6 Q73 5 94 -18 L113 -48 L145 -65 L151 -30 Q170 -7 149 9 Q128 17 117 43 Q100 72 69 75 L51 109 L37 138 L16 139 L23 129 L31 124 L43 68 Q16 66 0 70 Q-21 83 -43 79 L-75 108 L-110 117 L-119 110 L-114 102 L-88 95 L-52 46 Z",ink,ink,3);
    mark(ctx,"M78 55 Q95 41 99 24 L114 18 Q121 67 97 83 L95 117 L73 130 L59 127 L69 116 L78 112 Z M-21 64 Q-35 89 -65 91 L-75 125 L-99 131 L-104 124 L-90 115 L-84 80 L-53 41 Z",dark,ink,2.3);
    mark(ctx,"M96 -28 L98 -86 L131 -62 L151 -70 L171 -106 L170 -53 Q181 -26 214 -18 L226 -17 L204 -1 L176 11 L155 29 L153 45 L138 32 L127 48 L123 35 L108 47 L108 28 L97 35 L103 11 L91 14 Z",bone,ink,3);
    mark(ctx,"M103 -75 L110 -45 L122 -58 Z M153 -58 L166 -90 L163 -55 Z",cinnabar,ink,1.6);
    mark(ctx,"M141 -30 Q159 -36 176 -28 L159 -14 L146 -15 L135 -7 L139 -23 L123 -20 Z",ink);
    mark(ctx,"M149 -24 L164 -27 L156 -19 Z",paper);
    mark(ctx,"M207 -16 Q216 -19 225 -16 L215 -9 Z",ink);
    mark(ctx,"M179 -2 Q190 2 205 -7 M127 -41 Q120 -43 104 -37 M127 -34 Q111 -35 100 -29 M125 -25 Q109 -26 102 -22",null,dark,1.4);
    mark(ctx,"M94 20 Q112 38 137 35 L141 43 Q115 50 90 30 Z",cinnabar,ink,1.5);
    mark(ctx,"M112 39 Q111 72 127 81 Q145 72 144 44",null,gold,2.4);
    mark(ctx,"M119 81 L132 77 L143 105 L129 110Z",cinnabar,ink);
    mark(ctx,"M123 85 L130 83 L136 101 L130 104Z",null,bone,1);
    for (let j=0; j<10; j++) {
      mark(ctx,`M${-31+j*10} ${15+Math.sin(j)*3} q12 7 17 5`,null,gold,1.2);
    }
    ctx.restore();
  }

  function bellBeast(ctx) {
    ctx.save(); ctx.translate(486, 227);
    mark(ctx,"M-126 35 Q-176 29 -187 1 Q-199 -19 -186 -46 Q-203 -35 -206 -20 Q-213 -64 -183 -82 Q-194 -54 -179 -39 Q-165 -20 -159 2 L-122 1Z",ink,ink,3);
    const body=mark(ctx,"M-150 23 Q-145 -28 -95 -43 Q-37 -75 47 -55 Q91 -49 120 -26 Q156 -25 179 2 L154 42 L112 67 L95 106 L102 128 L72 130 L56 112 L61 59 Q24 81 -35 69 L-71 106 L-86 129 L-126 127 L-115 112 L-106 81 Q-149 68 -150 23Z",ink,ink,4);
    hatching(ctx,body,"#655e49",4.4,-0.85);
    mark(ctx,"M-98 48 L-65 63 L-85 95 L-94 120 H-126 L-122 109 L-115 101 Z M75 50 L102 47 L113 87 L135 112 L132 123 H106 L91 101Z",dark,ink,3);
    const head=mark(ctx,"M93 -32 Q132 -64 161 -33 L186 -25 L176 -17 L201 -5 L185 0 L206 18 L196 21 L207 40 Q210 51 190 60 L166 55 L152 74 L142 63 L134 81 L126 66 L112 73 L112 51 L94 57 L100 34 L84 39 L91 17 L77 18 L89 -3 L75 -1Z",dark,ink,3.3);
    hatching(ctx,head,"#82795d",5.3,-0.93);
    mark(ctx,"M106 -29 C70 -45 67 -75 86 -98 C80 -73 100 -59 131 -61 L141 -39Z M142 -41 Q140 -82 180 -95 Q159 -78 167 -52 L161 -35Z",bone,ink,3);
    mark(ctx,"M143 -6 Q159 -15 177 -4 L162 9 L150 6 Z",ink);
    oval(ctx,159,-1,6,3,cinnabar); oval(ctx,161,-1,2.5,1.6,bone);
    mark(ctx,"M182 33 Q196 26 205 36 L198 46 L188 45Z",ink);
    mark(ctx,"M198 50 Q196 70 184 78 Q188 65 182 55Z",bone,ink,2);
    // Raised engraved bell on the beast's back.
    oval(ctx,-21,-122,21,28,null,ink); oval(ctx,-21,-122,15,22,null,gold);
    const bell=mark(ctx,"M-52 -111 Q-28 -126 4 -111 Q15 -104 15 -87 Q16 -47 44 -20 L54 -10 Q51 5 -9 8 Q-71 12 -96 -6 L-86 -20 Q-59 -44 -58 -81 Q-60 -101 -52 -111Z",dark,ink,3.5);
    hatching(ctx,bell,"#877a57",4.4,0.68);
    mark(ctx,"M-55 -98 Q-25 -110 13 -98 L15 -89 Q-28 -99 -57 -87Z M-82 -25 Q-26 -9 36 -28 L42 -21 Q-14 -1 -87 -18Z M-94 -9 Q-30 9 50 -12 L52 -7 Q-21 17 -94 -3Z",gold,ink,1.4);
    mark(ctx,"M-24 -85 L-7 -66 L-23 -45 L-41 -65Z",cinnabar,bone,2);
    mark(ctx,"M-22 -79 L-15 -68 L-25 -56 L-29 -65Z",null,bone,1.4);
    for (const x of [-47,1]) {
      for (let j=0; j<3; j++) oval(ctx,x,-78+j*12,3.5,2.7,gold,ink);
    }
    mark(ctx,"M-85 -16 Q-58 17 -57 61 M35 -15 Q11 12 5 62",null,gold,5);
    mark(ctx,"M-76 1 Q-30 29 20 4",null,bone,2);
    ctx.restore();
  }

  window.paintTower = function paintTower(canvas, floor, phase) {
    if (!canvas) return;
    const level = Math.max(1, Math.min(3, Math.trunc(Number(floor)) || 1));
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 1000;
    const height = rect.height || width * 414 / 1000;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75, 1800 / width);
    const px = Math.max(1, Math.round(width*dpr)), py = Math.max(1, Math.round(height*dpr));
    const key = [px, py, level].join("/");
    if (cache.get(canvas) === key) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width=px; canvas.height=py;
    ctx.setTransform(px/1000,0,0,py/414,0,0);
    ctx.lineJoin="round"; ctx.lineCap="round";
    landscape(ctx,level);
    [moth,fox,bellBeast][level-1](ctx);
    cache.set(canvas,key);
  };
})();
