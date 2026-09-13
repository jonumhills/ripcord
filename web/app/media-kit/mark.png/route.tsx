import { ImageResponse } from "next/og";

/** Raster download for the media kit page — same circle as public/logo/ripcord-mark.svg,
 * rendered to a 512x512 transparent PNG on request instead of needing a separate image tool. */
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 420, height: 420, borderRadius: "50%", background: "#33e667", display: "flex" }} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
