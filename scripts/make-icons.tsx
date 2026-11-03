// Renders the app icon to PNGs for the Home Screen and the web manifest.
// Run with: npx tsx --tsconfig tsconfig.json scripts/make-icons.tsx
import { writeFileSync } from "node:fs";
import { ImageResponse } from "next/og";

const BOLT =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";

// Full-bleed square (iOS and Android round the corners themselves); the bolt stays
// inside the central safe zone so maskable crops never clip it.
function Icon({ size }: { size: number }) {
  const bolt = size * 0.5;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7a6bf0 0%, #4a3bc4 100%)",
      }}
    >
      <svg width={bolt} height={bolt} viewBox="0 0 24 24">
        <path fill="#fff" d={BOLT} />
      </svg>
    </div>
  );
}

async function render(size: number, file: string) {
  const res = new ImageResponse(<Icon size={size} />, { width: size, height: size });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

async function main() {
  await render(180, "src/app/apple-icon.png");
  await render(192, "public/icons/icon-192.png");
  await render(512, "public/icons/icon-512.png");
}
main();
