export type Point = {
  x: number;
  y: number;
};

export type MembranePoint = Point & {
  nx: number;
  ny: number;
  displacement: number;
  velocity: number;
};

export type RadialInfluence = {
  local: number;
  halo: number;
};

export type LimitedPointer = Point & {
  stretch: number;
};

export type ReboundPhysics = {
  pace: number;
  membraneSpring: number;
  membraneDamping: number;
  waveCoupling: number;
  areaPressure: number;
  averageCorrection: number;
  pressureSpring: number;
  pressureDamping: number;
  releaseImpulse: number;
};

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function limitPointerReach(
  pointerX: number,
  pointerY: number,
  radiusX: number,
  radiusY: number,
  maximumRadius = 1.65,
): LimitedPointer {
  const normalizedRadius = Math.hypot(pointerX / radiusX, pointerY / radiusY);
  const limitedRadius = Math.min(normalizedRadius, maximumRadius);
  const scale = normalizedRadius > maximumRadius ? maximumRadius / normalizedRadius : 1;

  return {
    x: pointerX * scale,
    y: pointerY * scale,
    stretch: clamp((limitedRadius - 0.55) / (maximumRadius - 0.55), 0, 1),
  };
}

export function reboundPhysics(level: number): ReboundPhysics {
  const normalized = clamp((level - 1) / 9, 0, 1);
  const pace = Math.pow(normalized, 3.5);

  return {
    pace,
    membraneSpring: 0.5 + pace * 123.5,
    membraneDamping: 1.4 + pace * 12.1,
    waveCoupling: 8 + pace * 172,
    areaPressure: 8 + pace * 612,
    averageCorrection: 0.004 + pace * 0.096,
    pressureSpring: 0.00015 + pace * 0.09485,
    pressureDamping: 0.975 - pace * 0.305,
    releaseImpulse: 0.0004 + pace * 0.0346,
  };
}

export function heldPhysics(): ReboundPhysics {
  return {
    pace: 1,
    membraneSpring: 96,
    membraneDamping: 16.1,
    waveCoupling: 144,
    areaPressure: 620,
    averageCorrection: 0.1,
    pressureSpring: 0.071,
    pressureDamping: 0.718,
    releaseImpulse: 0,
  };
}

function gaussian(distance: number, width: number) {
  return Math.exp(-(distance * distance) / (2 * width * width));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function wrap(index: number, length: number) {
  return (index + length) % length;
}

function softenedNormals(points: MembranePoint[]) {
  const length = points.length;
  let normals = points.map((_, index) => {
    const previous = points[wrap(index - 1, length)];
    const next = points[wrap(index + 1, length)];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const normalLength = Math.hypot(tangentY, -tangentX) || 1;
    return { nx: tangentY / normalLength, ny: -tangentX / normalLength };
  });

  for (let pass = 0; pass < 3; pass += 1) {
    normals = normals.map((normal, index) => {
      const previous = normals[wrap(index - 1, length)];
      const next = normals[wrap(index + 1, length)];
      const nx = previous.nx * 0.22 + normal.nx * 0.56 + next.nx * 0.22;
      const ny = previous.ny * 0.22 + normal.ny * 0.56 + next.ny * 0.22;
      const normalLength = Math.hypot(nx, ny) || 1;
      return { nx: nx / normalLength, ny: ny / normalLength };
    });
  }

  points.forEach((point, index) => {
    point.nx = normals[index].nx;
    point.ny = normals[index].ny;
  });
}

export function createCandyMembrane(radiusX: number, radiusY: number, samples = 144) {
  const denseSamples = 720;
  const exponent = 4.3;
  const dense: Point[] = [];

  for (let index = 0; index < denseSamples; index += 1) {
    const angle = (index / denseSamples) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    dense.push({
      x: Math.sign(cosine) * Math.pow(Math.abs(cosine), 2 / exponent) * radiusX,
      y: Math.sign(sine) * Math.pow(Math.abs(sine), 2 / exponent) * radiusY,
    });
  }

  const cumulative = [0];
  let perimeter = 0;
  for (let index = 0; index < dense.length; index += 1) {
    const point = dense[index];
    const next = dense[(index + 1) % dense.length];
    perimeter += Math.hypot(next.x - point.x, next.y - point.y);
    cumulative.push(perimeter);
  }

  const membrane: MembranePoint[] = [];
  let segmentIndex = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const targetDistance = (sample / samples) * perimeter;
    while (segmentIndex < dense.length - 1 && cumulative[segmentIndex + 1] < targetDistance) {
      segmentIndex += 1;
    }
    const point = dense[segmentIndex];
    const next = dense[(segmentIndex + 1) % dense.length];
    const segmentLength = Math.max(cumulative[segmentIndex + 1] - cumulative[segmentIndex], 0.0001);
    const amount = (targetDistance - cumulative[segmentIndex]) / segmentLength;
    membrane.push({
      x: point.x + (next.x - point.x) * amount,
      y: point.y + (next.y - point.y) * amount,
      nx: 0,
      ny: 0,
      displacement: 0,
      velocity: 0,
    });
  }

  softenedNormals(membrane);
  return membrane;
}

export function radialInfluence(
  point: Point,
  pointerX: number,
  pointerY: number,
  radiusX: number,
  radiusY: number,
  localWidth: number,
  haloWidth: number,
): RadialInfluence {
  const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
  const local = gaussian(distance, localWidth);
  const halo = gaussian(distance, haloWidth);
  const pointerRadius = clamp(Math.hypot(pointerX / radiusX, pointerY / radiusY), 0, 1);
  const edgeBoost = 1 + smoothstep(0.12, 0.82, pointerRadius) * 0.44;

  return {
    local: local * edgeBoost,
    halo: Math.max(halo - local * 0.34, 0),
  };
}

export function smoothRing(values: number[], index: number) {
  const length = values.length;
  return (
    values[wrap(index - 2, length)] * 0.06
    + values[wrap(index - 1, length)] * 0.2
    + values[index] * 0.48
    + values[wrap(index + 1, length)] * 0.2
    + values[wrap(index + 2, length)] * 0.06
  );
}

export function polygonArea(points: Point[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  }
  return Math.abs(area) * 0.5;
}
