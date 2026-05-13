import type { LayerKey } from "@codewiz/sdk";

const LAYER_COLOR: Record<LayerKey, string> = {
  ui:       "var(--cyan)",
  state:    "var(--violet)",
  api:      "var(--green)",
  service:  "var(--amber)",
  data:     "var(--pink)",
  external: "#5b6577",
};

export function LayerDot({ layer, size = 8 }: { layer: LayerKey; size?: number }) {
  return (
    <span
      className="layer-dot"
      style={{ width: size, height: size, background: LAYER_COLOR[layer], display: "inline-block", borderRadius: "50%" }}
    />
  );
}

export const LAYER_LABEL: Record<LayerKey, string> = {
  ui: "UI", state: "State", api: "API edge",
  service: "Service", data: "Data", external: "External",
};

export { LAYER_COLOR };
