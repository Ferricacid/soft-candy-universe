"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type SoundKind = "bubble" | "puff" | "boing" | "off";

type MotionState = {
  held: boolean;
  startedAt: number;
  pressure: number;
  pressureVelocity: number;
  pointerX: number;
  pointerY: number;
  downX: number;
  downY: number;
  grabbedIndex: number;
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
    downX: 0,
    downY: 0,
    grabbedIndex: 0,
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
    const pointCount = 52;
    let basePoints: Array<{ x: number; y: number }> = [];

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
      basePoints = [];
      const rx = Math.min(width * 0.33, 220);
      const ry = Math.min(height * 0.29, 116);
      for (let index = 0; index < pointCount; index += 1) {
        const angle = (index / pointCount) * Math.PI * 2;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const exponent = 4.3;
        basePoints.push({
          x: Math.sign(cosine) * Math.pow(Math.abs(cosine), 2 / exponent) * rx,
          y: Math.sign(sine) * Math.pow(Math.abs(sine), 2 / exponent) * ry,
        });
      }
      motionRef.current.pointerX = width / 2;
      motionRef.current.pointerY = height / 2;
    };

    const roundedPath = (points: Array<{ x: number; y: number }>) => {
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

    const draw = (now: number) => {
      const delta = Math.min(2, (now - previous) / 16.67);
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
      const dragX = motion.held ? (motion.pointerX - motion.downX) / Math.max(width, 1) : 0;
      const dragY = motion.held ? (motion.pointerY - motion.downY) / Math.max(height, 1) : 0;
      const points = basePoints.map((point, index) => {
        const ringDistance = Math.min(
          Math.abs(index - motion.grabbedIndex),
          pointCount - Math.abs(index - motion.grabbedIndex),
        );
        const local = Math.exp(-(ringDistance * ringDistance) / 16) * pressure;
        const targetX = motion.pointerX - centerX;
        const targetY = motion.pointerY - centerY;
        const centralPress = Math.hypot(targetX, targetY) < 42;
        const dent = centralPress ? 0.08 : 0.22;
        return {
          x: centerX
            + point.x * (1 + pressure * 0.12)
            + targetX * local * dent
            + dragX * Math.abs(point.y) * 0.7,
          y: centerY
            + point.y * (1 - pressure * 0.3)
            + pressure * 22
            + targetY * local * dent
            + dragY * Math.abs(point.x) * 0.35,
        };
      });

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
      context.translate(centerX + dragX * pressure * 64, centerY + 10 + pressure * 13);
      context.transform(
        1 + pressure * 0.11,
        dragY * pressure * 0.5,
        dragX * pressure * 0.55,
        1 - pressure * 0.29,
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
    const motion = motionRef.current;
    motion.held = true;
    motion.startedAt = performance.now();
    motion.pointerX = x;
    motion.pointerY = y;
    motion.downX = x;
    motion.downY = y;
    const angle = Math.atan2(y - height / 2, x - width / 2);
    motion.grabbedIndex = Math.round((((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 52) % 52;
    setHolding(true);
    playSound("press", 0.35);
    navigator.vibrate?.(8);
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
    beginPress(point.x, point.y, point.width, point.height);
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
