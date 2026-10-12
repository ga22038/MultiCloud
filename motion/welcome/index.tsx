import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from "remotion";

/** Decorative film only. Personal names remain accessible HTML in the application. */
function PolarisOrbitFilm() {
  const frame = useCurrentFrame();
  const travel = interpolate(frame, [0, 179], [0, 1], {
    easing: Easing.bezier(0.77, 0, 0.175, 1),
    extrapolateRight: "clamp",
  });
  const pathProgress = interpolate(frame, [8, 78], [0, 1], {
    easing: Easing.bezier(0.23, 1, 0.32, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Cubic travel follows the horizon and settles on the same four-point mark as the login.
  const u = 1 - pathProgress;
  const starX =
    u * u * u * 1570 +
    3 * u * u * pathProgress * 1510 +
    3 * u * pathProgress * pathProgress * 1020 +
    pathProgress * pathProgress * pathProgress * 960;
  const starY =
    u * u * u * 130 +
    3 * u * u * pathProgress * 120 +
    3 * u * pathProgress * pathProgress * 300 +
    pathProgress * pathProgress * pathProgress * 300;
  const settle = interpolate(frame, [58, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const trailOpacity = interpolate(frame, [8, 28, 75, 108], [0, 0.55, 0.3, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const starOpacity = interpolate(frame, [0, 12, 155, 179], [0.1, 1, 1, 0.2], {
    extrapolateRight: "clamp",
  });
  const halo = interpolate(frame, [60, 95, 160], [0.25, 0.7, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [170, 179], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#122b40", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundColor: "#142b40",
          transform: `translate(${20 - 40 * travel}px, ${16 - 30 * travel}px) scale(${1.12 - 0.07 * travel}) rotate(${-1.1 + 1.5 * travel}deg)`,
        }}
      >
        <Img
          src={staticFile("images/polaris-earth-v1.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 10%",
            mixBlendMode: "luminosity",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #142b4010 0%, #142b4040 40%, #10283dcc 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #cfdfec18, transparent 55%)",
          opacity: halo,
        }}
      />
      <svg
        viewBox="0 0 1920 1080"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <linearGradient
            id="trail"
            x1="1570"
            y1="130"
            x2="960"
            y2="300"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#d4e6f6" stopOpacity="0" />
            <stop offset="1" stopColor="#e0edf8" />
          </linearGradient>
          <radialGradient id="halo">
            <stop stopColor="#dcebf7" stopOpacity=".75" />
            <stop offset=".25" stopColor="#dcebf7" stopOpacity=".15" />
            <stop offset="1" stopColor="#dcebf7" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="M1570 130 C1510 120 1020 300 960 300"
          pathLength="1"
          stroke="url(#trail)"
          strokeWidth="1.8"
          fill="none"
          strokeDasharray="1"
          strokeDashoffset={1 - pathProgress}
          opacity={trailOpacity}
        />
        <circle
          cx={starX}
          cy={starY}
          r={85 + settle * 40}
          fill="url(#halo)"
          opacity={starOpacity * (0.5 + halo)}
        />
        <g
          transform={`translate(${starX} ${starY}) scale(${0.34 + 0.25 * settle})`}
          opacity={starOpacity}
        >
          <path
            d="M0 -48 C8 -9 9 -8 48 0 C9 8 8 9 0 48 C-8 9 -9 8 -48 0 C-9 -8 -8 -9 0 -48Z"
            fill="#e6eff7"
          />
          <circle r="4" fill="#fff" />
        </g>
      </svg>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: out }} />
    </AbsoluteFill>
  );
}

registerRoot(() => (
  <Composition
    id="PolarisWelcome"
    component={PolarisOrbitFilm}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={180}
  />
));
