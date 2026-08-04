import { normalizeInventoryText } from "./priority-lines";

const kitColorStyles = [
  {
    names: ["negro", "black"],
    border: "rgb(23 23 23 / 0.9)",
    borderDark: "rgb(0 0 0 / 0.96)",
    surface: "rgb(23 23 23 / 0.22)",
    surfaceDark: "rgb(0 0 0 / 0.34)",
  },
  {
    names: ["gris", "gray", "grey", "plata"],
    border: "rgb(115 115 115 / 0.9)",
    borderDark: "rgb(163 163 163 / 0.9)",
    surface: "rgb(115 115 115 / 0.22)",
    surfaceDark: "rgb(115 115 115 / 0.3)",
  },
  {
    names: ["blanco", "white"],
    border: "rgb(203 213 225 / 0.92)",
    borderDark: "rgb(255 255 255 / 0.86)",
    surface: "rgb(241 245 249 / 0.55)",
    surfaceDark: "rgb(255 255 255 / 0.22)",
  },
  {
    names: ["rojo cherry", "cherry", "vinotinto"],
    border: "rgb(190 18 60 / 0.82)",
    borderDark: "rgb(251 113 133 / 0.82)",
    surface: "rgb(190 18 60 / 0.13)",
    surfaceDark: "rgb(251 113 133 / 0.14)",
  },
  {
    names: ["rojo", "red"],
    border: "rgb(239 68 68 / 0.84)",
    borderDark: "rgb(248 113 113 / 0.84)",
    surface: "rgb(239 68 68 / 0.13)",
    surfaceDark: "rgb(248 113 113 / 0.14)",
  },
  {
    names: ["azul", "blue"],
    border: "rgb(59 130 246 / 0.88)",
    borderDark: "rgb(96 165 250 / 0.88)",
    surface: "rgb(59 130 246 / 0.14)",
    surfaceDark: "rgb(96 165 250 / 0.16)",
  },
  {
    names: ["verde", "green"],
    border: "rgb(16 185 129 / 0.84)",
    borderDark: "rgb(52 211 153 / 0.84)",
    surface: "rgb(16 185 129 / 0.13)",
    surfaceDark: "rgb(52 211 153 / 0.14)",
  },
  {
    names: ["amarillo", "yellow"],
    border: "rgb(251 191 36 / 0.9)",
    borderDark: "rgb(252 211 77 / 0.86)",
    surface: "rgb(251 191 36 / 0.16)",
    surfaceDark: "rgb(252 211 77 / 0.15)",
  },
  {
    names: ["naranja", "orange"],
    border: "rgb(249 115 22 / 0.84)",
    borderDark: "rgb(251 146 60 / 0.84)",
    surface: "rgb(249 115 22 / 0.14)",
    surfaceDark: "rgb(251 146 60 / 0.14)",
  },
  {
    names: ["arena", "beige", "dorado", "gold"],
    border: "rgb(217 119 6 / 0.78)",
    borderDark: "rgb(251 191 36 / 0.8)",
    surface: "rgb(217 119 6 / 0.13)",
    surfaceDark: "rgb(251 191 36 / 0.14)",
  },
  {
    names: ["morado", "violeta", "purple"],
    border: "rgb(139 92 246 / 0.84)",
    borderDark: "rgb(167 139 250 / 0.84)",
    surface: "rgb(139 92 246 / 0.13)",
    surfaceDark: "rgb(167 139 250 / 0.14)",
  },
  {
    names: ["transparente", "transparent"],
    border: "rgb(125 211 252 / 0.9)",
    borderDark: "rgb(186 230 253 / 0.72)",
    surface: "rgb(186 230 253 / 0.28)",
    surfaceDark: "rgb(186 230 253 / 0.13)",
  },
] as const;

export function getPlasticKitColorStyle(color: string) {
  const normalizedColor = normalizeInventoryText(color);
  const matchedStyle = kitColorStyles.find(({ names }) =>
    names.some((name) => normalizedColor.includes(name)),
  );
  if (matchedStyle) {
    return {
      ...matchedStyle,
      emphasis: matchedStyle.names[0] === "negro" ? "black" : "standard",
    } as const;
  }

  return {
    border: "hsl(var(--primary) / 0.62)",
    borderDark: "hsl(var(--primary) / 0.7)",
    surface: "hsl(var(--primary) / 0.11)",
    surfaceDark: "hsl(var(--primary) / 0.12)",
    emphasis: "standard",
  };
}
