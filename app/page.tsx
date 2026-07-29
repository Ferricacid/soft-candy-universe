"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clamp,
  createCandyMembrane,
  polygonArea,
  radialInfluence,
  smoothRing,
  type MembranePoint,
  type Point,
} from "./jelly-physics";

type SoundKind = "bubble" | "puff" | "boing" | "off";

type MotionState = {
  held: boolean;
  startedAt: number;
  pressure: number;
  pressureVelocity: number;
  pointerX: number;
  pointerY: number;
  pressId: number;
};

const colorPresets = [
  { name: "莓果", value: "#ff72aa" },
  { name: "葡萄", value: "#9d8cff" },
  { name: "薄荷", value: "#65d9ae" },
  { name: "汽水", value: "#ffae69" },
];

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3
    ? clean.split("").map((part) => part + part).join("")
    : clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mix(hex: string, target: [number, number, number], amount: number) {
  const source = hexToRgb(hex);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return `rgb(${channel(source.r, target[0])} ${channel(source.g, target[1])} ${channel(source.b, target[2])})`;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const settingsRef = useRef({ rebound: 6, charge: 5, color: "#ff72aa", text: "今天也软软的" });
  const motionRef = useRef<MotionState>({
    held: false,
    startedAt: 0,
    pressure: 0,
    pressureVelocity: 0,
    pointerX: 0,
    pointerY: 0,
    pressId: 0,
  });

  const [rebound, setRebound] = useState(6);
  const [charge, setCharge] = useState(5);
  const [color, setColor] = useState("#ff72aa");
  const [label, setLabel] = useState("今天也软软的");
  const [sound, setSound] = useState<SoundKind>("bubble");
  const [holding, setHolding] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);

  useEffect(() => {
    settingsRef.current = { rebound, charge, color, text: label || " " };
  }, [rebound, charge, color, label]);

  const playSound = (phase: "press" | "release", strength = 0.5) => {
    if (sound === "off") return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const audio = audioRef.current ?? new AudioContextClass();
    audioRef.current = audio;
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    const volume = 0.025 + strength * 0.045;

    if (sound === "bubble") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(phase === "press" ? 170 : 260 + strength * 100, now);
      oscillator.frequency.exponentialRampToValueAtTime(phase === "press" ? 82 : 520, now + 0.13);
      filter.type = "lowpass";
      filter.frequency.value = 900;
    } else if (sound === "puff") {
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(phase === "press" ? 95 : 135, now);
      oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      filter.type = "lowpass";
      filter.frequency.value = 360;
    } else {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(phase === "press" ? 120 : 180, now);
      oscillator.frequency.exponentialRampToValueAtTime(phase === "press" ? 70 : 760, now + 0.2);
      filter.type = "bandpass";
      filter.frequency.value = 620;
      filter.Q.value = 1.5;
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(filter).connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let previous = performance.now();
    let lastMeter = -1;
    let radiusX = 1;
    let radiusY = 1;
    let baseArea = 1;
    let handledPressId = 0;
    let membrane: MembranePoint[] = [];

    const resize = () => {
      const rect = surface.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      radiusX = Math.min(width * 0.33, 220);
      radiusY = Math.min(height * 0.29, 116);
      membrane = createCandyMembrane(radiusX, radiusY);
      baseArea = polygonArea(membrane);
      motionRef.current.pointerX = width / 2;
      motionRef.current.pointerY = height / 2 - 2;
    };

    const roundedPath = (points: Point[]) => {
      context.beginPath();
      const last = points[points.length - 1];
      context.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
      for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
      }
      context.closePath();
    };

    const pointerState = (motion: MotionState, centerX: number, centerY: number) => {
      const x = motion.pointerX - centerX;
      const y = motion.pointerY - centerY;
      const exponent = 4.3;
      const insideMetric = (
        Math.pow(Math.abs(x) / radiusX, exponent)
        + Math.pow(Math.abs(y) / radiusY, exponent)
      );
      return {
        x,
        y,
        insideWeight: motion.held ? clamp((1.12 - insideMetric) / 0.14, 0, 1) : 0,
      };
    };

    const heldOffsets = (motion: MotionState, pressure: number, centerX: number, centerY: number) => {
      const pointer = pointerState(motion, centerX, centerY);
      const shapeScale = Math.max(0.72, radiusY / 27);
      const holdAmount = pointer.insideWeight * (0.28 + pressure * 0.72);
      const bulgeAmount = 10.8 * shapeScale * 0.9;
      const haloAmount = bulgeAmount * (2.65 / 10.8);
      const localWidth = radiusY * (38 / 27);
      const haloWidth = radiusY * (70 / 27);

      return membrane.map((point) => {
        const influence = radialInfluence(
          point,
          pointer.x,
          pointer.y,
          radiusX,
          radiusY,
          localWidth,
          haloWidth,
        );
        return holdAmount * (bulgeAmount * influence.local - haloAmount * influence.halo);
      });
    };

    const surfacePoints = (offsets: number[]) => {
      const displacement = membrane.map((point) => point.displacement);
      const smoothedDisplacement = displacement.map((_, index) => smoothRing(displacement, index));
      const total = smoothedDisplacement.map((value, index) => value + offsets[index]);
      const smoothedTotal = total.map((_, index) => smoothRing(total, index));

      return membrane.map((point, index) => {
        const previous = smoothedTotal[(index - 1 + membrane.length) % membrane.length];
        const next = smoothedTotal[(index + 1) % membrane.length];
        const tangentSlide = (next - previous) * 0.05;
        return {
          x: point.x + point.nx * smoothedTotal[index] - point.ny * tangentSlide,
          y: point.y + point.ny * smoothedTotal[index] + point.nx * tangentSlide,
        };
      });
    };

    const applyPressImpulse = (motion: MotionState, centerX: number, centerY: number) => {
      if (!motion.held || motion.pressId === handledPressId) return;
      handledPressId = motion.pressId;
      const pointer = pointerState(motion, centerX, centerY);
      const localWidth = radiusY * (38 / 27);
      const haloWidth = radiusY * (70 / 27);

      membrane.forEach((point) => {
        const influence = radialInfluence(
          point,
          pointer.x,
          pointer.y,
          radiusX,
          radiusY,
          localWidth,
          haloWidth,
        );
        point.velocity += 430 * pointer.insideWeight * (influence.local - influence.halo * 0.18);
        point.velocity = clamp(point.velocity, -410, 410);
      });
    };

    const updateMembrane = (
      elapsed: number,
      motion: MotionState,
      pressure: number,
      settings: typeof settingsRef.current,
      centerX: number,
      centerY: number,
    ) => {
      const steps = Math.max(1, Math.ceil(elapsed / (1 / 58)));
      const step = elapsed / steps;
      const shapeScale = Math.max(0.72, radiusY / 27);
      const membraneSpring = 54 + settings.rebound * 7;
      const membraneDamping = 20 - settings.rebound * 0.65;
      const waveCoupling = 90 + settings.rebound * 9;
      const localWidth = radiusY * (38 / 27);
      const haloWidth = radiusY * (70 / 27);

      for (let substep = 0; substep < steps; substep += 1) {
        const offsets = heldOffsets(motion, pressure, centerX, centerY);
        const area = polygonArea(surfacePoints(offsets));
        const areaError = clamp((baseArea - area) / baseArea, -0.08, 0.08);
        const pointer = pointerState(motion, centerX, centerY);
        const acceleration = membrane.map((point, index) => {
          const previousPoint = membrane[(index - 1 + membrane.length) % membrane.length];
          const nextPoint = membrane[(index + 1) % membrane.length];
          const laplacian = previousPoint.displacement + nextPoint.displacement - 2 * point.displacement;
          let value = (
            -point.displacement * membraneSpring
            + laplacian * waveCoupling
            - point.velocity * membraneDamping
            + areaError * 620
          );

          if (pointer.insideWeight > 0.02) {
            const influence = radialInfluence(
              point,
              pointer.x,
              pointer.y,
              radiusX,
              radiusY,
              localWidth,
              haloWidth,
            );
            value += 48 * shapeScale * pointer.insideWeight * (
              influence.local - influence.halo * 0.18
            );
          }
          return value;
        });

        membrane.forEach((point, index) => {
          point.velocity += acceleration[index] * step;
          point.displacement += point.velocity * step;
          point.displacement = clamp(point.displacement, -8 * shapeScale, 24 * shapeScale);
          point.velocity = clamp(point.velocity, -410, 410);
        });

        const average = membrane.reduce((sum, point) => sum + point.displacement, 0) / membrane.length;
        membrane.forEach((point) => {
          point.displacement -= average * 0.1;
        });
      }
    };

    const draw = (now: number) => {
      const elapsed = Math.min(0.033, (now - previous) / 1000);
      const delta = elapsed * 60;
      previous = now;
      const motion = motionRef.current;
      const settings = settingsRef.current;
      const chargeDuration = 1900 - settings.charge * 145;
      const heldFor = motion.held ? now - motion.startedAt : 0;
      const heldPressure = motion.held ? Math.min(1, heldFor / chargeDuration) : 0;
      const target = motion.held ? 0.16 + heldPressure * 0.84 : 0;
      const spring = 0.035 + settings.rebound * 0.006;
      const damping = 0.67 + (10 - settings.rebound) * 0.012;
      motion.pressureVelocity += (target - motion.pressure) * spring * delta;
      motion.pressureVelocity *= Math.pow(damping, delta);
      motion.pressure += motion.pressureVelocity * delta;
      motion.pressure = Math.max(-0.12, Math.min(1.12, motion.pressure));

      const meter = Math.round(Math.max(0, heldPressure) * 100);
      if (meter !== lastMeter && (motion.held || lastMeter !== 0)) {
        lastMeter = meter;
        setChargeLevel(meter);
      }

      context.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2 - 2;
      const pressure = Math.max(0, motion.pressure);
      applyPressImpulse(motion, centerX, centerY);
      updateMembrane(elapsed, motion, pressure, settings, centerX, centerY);
      const localSurface = surfacePoints(heldOffsets(motion, pressure, centerX, centerY));
      const points = localSurface.map((point) => ({ x: centerX + point.x, y: centerY + point.y }));
      const pointer = pointerState(motion, centerX, centerY);
      const textX = motion.held ? clamp(pointer.x / radiusX, -1, 1) : 0;
      const textY = motion.held ? clamp(pointer.y / radiusY, -1, 1) : 0;

      context.save();
      context.filter = "blur(16px)";
      context.globalAlpha = 0.18 + pressure * 0.05;
      context.fillStyle = "#6f455a";
      context.beginPath();
      context.ellipse(centerX, centerY + 126 - pressure * 19, 164 + pressure * 20, 27 - pressure * 7, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      roundedPath(points);
      const body = context.createLinearGradient(centerX - 180, centerY - 105, centerX + 180, centerY + 120);
      body.addColorStop(0, mix(settings.color, [255, 255, 255], 0.46));
      body.addColorStop(0.38, settings.color);
      body.addColorStop(1, mix(settings.color, [86, 35, 67], 0.4));
      context.fillStyle = body;
      context.shadowColor = `${settings.color}88`;
      context.shadowBlur = 28 + pressure * 12;
      context.shadowOffsetY = 16 - pressure * 5;
      context.fill();
      context.clip();

      const glow = context.createRadialGradient(centerX - 86, centerY - 67, 2, centerX - 82, centerY - 62, 150);
      glow.addColorStop(0, "rgba(255,255,255,.82)");
      glow.addColorStop(0.2, "rgba(255,255,255,.34)");
      glow.addColorStop(0.66, "rgba(255,255,255,.05)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const lowerShade = context.createLinearGradient(0, centerY, 0, centerY + 125);
      lowerShade.addColorStop(0, "rgba(85,28,60,0)");
      lowerShade.addColorStop(1, "rgba(85,28,60,.25)");
      context.fillStyle = lowerShade;
      context.fillRect(0, centerY, width, 150);

      context.save();
      context.translate(
        centerX + textX * pressure * 24,
        centerY + 10 + pressure * 10 + textY * pressure * 12,
      );
      context.transform(
        1 + pressure * 0.08,
        textY * pressure * 0.18,
        textX * pressure * 0.22,
        1 - pressure * 0.2,
        0,
        0,
      );
      const fontSize = Math.max(22, Math.min(32, width / 18));
      context.font = `600 ${fontSize}px "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "rgba(255,255,255,.94)";
      context.shadowColor = "rgba(83,34,62,.25)";
      context.shadowBlur = 8;
      context.shadowOffsetY = 2;
      context.fillText(settings.text, 0, 0, Math.min(width * 0.48, 320));
      context.restore();
      context.restore();

      context.save();
      context.globalAlpha = 0.45;
      context.strokeStyle = "rgba(255,255,255,.7)";
      context.lineWidth = 2;
      roundedPath(points);
      context.stroke();
      context.restore();

      frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const localPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  };

  const beginPress = (x: number, y: number, width: number, height: number) => {
    const radiusX = Math.min(width * 0.33, 220);
    const radiusY = Math.min(height * 0.29, 116);
    const localX = x - width / 2;
    const localY = y - (height / 2 - 2);
    const insideMetric = (
      Math.pow(Math.abs(localX) / radiusX, 4.3)
      + Math.pow(Math.abs(localY) / radiusY, 4.3)
    );
    if (insideMetric > 1.08) return false;

    const motion = motionRef.current;
    motion.held = true;
    motion.startedAt = performance.now();
    motion.pointerX = x;
    motion.pointerY = y;
    motion.pressId += 1;
    setHolding(true);
    playSound("press", 0.35);
    navigator.vibrate?.(8);
    return true;
  };

  const releasePress = () => {
    const motion = motionRef.current;
    if (!motion.held) return;
    const strength = Math.max(0.15, Math.min(1, (performance.now() - motion.startedAt) / (1900 - charge * 145)));
    motion.held = false;
    motion.pressureVelocity -= 0.035 * strength * rebound;
    setHolding(false);
    setChargeLevel(0);
    playSound("release", strength);
    navigator.vibrate?.([8, 22, 10]);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const point = localPointer(event);
    if (!beginPress(point.x, point.y, point.width, point.height)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!motionRef.current.held) return;
    const point = localPointer(event);
    motionRef.current.pointerX = point.x;
    motionRef.current.pointerY = point.y;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releasePress();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !motionRef.current.held) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      beginPress(rect.width / 2, rect.height / 2, rect.width, rect.height);
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      releasePress();
    }
  };

  return (
    <main className="soft-universe">
      <header className="topbar">
        <a className="brand" href="#playground" aria-label="软糖小宇宙首页">
          <span className="brand-dot" aria-hidden="true" />
          软糖小宇宙
        </a>
        <span className="top-note">SOFT PLAYGROUND · 01</span>
      </header>

      <section className="workspace" id="playground">
        <div className="intro">
          <span className="eyebrow">给今天一点柔软</span>
          <h1>捏一块<br />属于你的软糖</h1>
          <p>按住得越久，手感越深。松手之后，看文字和软糖一起慢慢弹回来。</p>
          <div className="tiny-tip">
            <span aria-hidden="true">↘</span>
            鼠标、触摸或空格键都可以捏
          </div>
        </div>

        <div className="stage-column">
          <div className="stage-aura" aria-hidden="true" />
          <button
            ref={surfaceRef}
            className="squishy-surface"
            type="button"
            aria-label="按住并拖动这块软糖"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={releasePress}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
          >
            <canvas ref={canvasRef} aria-hidden="true" />
          </button>
          <div className="pressure-readout" aria-live="polite">
            <div className="pressure-copy">
              <span>{holding ? "蓄力中" : "等你来捏"}</span>
              <strong>{holding ? `${chargeLevel}%` : "PRESS & HOLD"}</strong>
            </div>
            <div className="pressure-track" aria-hidden="true">
              <span style={{ width: `${holding ? Math.max(4, chargeLevel) : 0}%`, background: color }} />
            </div>
          </div>
        </div>

        <aside className="controls" aria-label="软糖设置">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">捏捏配方</span>
              <h2>调成你喜欢的手感</h2>
            </div>
            <span className="recipe-number">№ 01</span>
          </div>

          <label className="control-block">
            <span className="control-label"><b>回弹速度</b><output>{rebound}</output></span>
            <input type="range" min="1" max="10" value={rebound} onChange={(event) => setRebound(Number(event.target.value))} />
            <span className="range-ends"><i>慢悠悠</i><i>脆弹</i></span>
          </label>

          <label className="control-block">
            <span className="control-label"><b>蓄力速度</b><output>{charge}</output></span>
            <input type="range" min="1" max="10" value={charge} onChange={(event) => setCharge(Number(event.target.value))} />
            <span className="range-ends"><i>慢慢陷</i><i>一捏到底</i></span>
          </label>

          <div className="control-block">
            <span className="control-label"><b>软糖颜色</b><output>{color.toUpperCase()}</output></span>
            <div className="color-row">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-swatch ${color === preset.value ? "selected" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  aria-label={`选择${preset.name}色`}
                  aria-pressed={color === preset.value}
                  onClick={() => setColor(preset.value)}
                />
              ))}
              <label className="custom-color" aria-label="自定义颜色">
                <span>＋</span>
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </label>
            </div>
          </div>

          <label className="control-block">
            <span className="control-label"><b>软糖上的字</b><output>{label.length}/12</output></span>
            <input
              className="text-input"
              type="text"
              maxLength={12}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="写点软乎乎的话"
            />
          </label>

          <label className="control-block">
            <span className="control-label"><b>捏下去的声音</b><output>{sound === "off" ? "关闭" : "开启"}</output></span>
            <select className="sound-select" value={sound} onChange={(event) => setSound(event.target.value as SoundKind)}>
              <option value="bubble">啵啵气泡</option>
              <option value="puff">软噗一声</option>
              <option value="boing">果冻弹簧</option>
              <option value="off">安静模式</option>
            </select>
          </label>
        </aside>
      </section>

      <footer>
        <span>今天的硬邦邦，到这里就结束了。</span>
        <span aria-hidden="true">●　○　○</span>
      </footer>
    </main>
  );
}
