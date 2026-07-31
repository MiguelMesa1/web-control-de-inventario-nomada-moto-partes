export const PLASTIC_KIT_LINES = [
  { key: "boxer-ct-100", label: "Boxer CT 100", ids: [1088, 1089, 1090, 1091, 1092, 1093, 1094, 1095, 1096, 1097] },
  { key: "pulsar-180", label: "Pulsar 180", ids: [1098, 1099, 1100, 1101, 1102, 1103, 1104, 1105, 1106, 1107, 1180, 1181, 1182, 1183] },
  { key: "pulsar-200-220", label: "Pulsar 200–220", ids: [1108, 1109, 1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117] },
  { key: "xtz-125", label: "Yamaha XTZ 125", ids: [1118, 1119, 1120, 1121, 1122, 1123, 1167, 1168, 1169, 1170, 1184, 1185, 1186, 1187, 1188, 1189, 1190, 1191, 1192, 1196, 1197, 1198, 1199] },
  { key: "xtz-150", label: "Yamaha XTZ 150", ids: [1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237] },
  { key: "ns-125-160", label: "Pulsar NS 125/150/160", ids: [1333, 1334, 1335, 1336, 1337, 1338, 1339, 1340, 1341, 1342] },
  { key: "ns-160-fi", label: "Pulsar NS 160 FI", ids: [1343, 1344, 1345, 1346, 1347, 1348, 1349, 1350, 1351, 1352] },
  { key: "ns-200", label: "Pulsar NS 200", ids: [1353, 1354, 1355, 1356, 1357, 1358, 1359, 1360, 1361, 1362] },
  { key: "ns-200-fi", label: "Pulsar NS 200 FI", ids: [1363, 1364, 1365, 1366, 1367, 1368, 1369, 1370, 1371, 1372] },
] as const;

export type PlasticKitLineKey = (typeof PLASTIC_KIT_LINES)[number]["key"];
export type PlasticKitColor =
  | "Negro"
  | "Rojo cherry"
  | "Rojo"
  | "Blanco"
  | "Azul"
  | "Verde"
  | "Gris"
  | "Arena"
  | "Transparente"
  | "Sin color";

const kitLineById = new Map(
  PLASTIC_KIT_LINES.flatMap((line) => line.ids.map((id) => [String(id), line] as const)),
);

export const PLASTIC_KIT_IDS = new Set(kitLineById.keys());

export function getPlasticKitLine(sku: string) {
  return kitLineById.get(sku.trim());
}

export function getPlasticKitColor(productName: string): PlasticKitColor {
  const name = productName.toLocaleUpperCase("es");
  const candidates: Array<{ label: PlasticKitColor; index: number }> = [
    { label: "Rojo cherry", index: name.indexOf("ROJO CHERRY") },
    { label: "Transparente", index: name.indexOf("TRANSPARENTE") },
    { label: "Negro", index: name.indexOf("NEGRO") },
    { label: "Rojo", index: name.indexOf("ROJO") },
    { label: "Blanco", index: name.indexOf("BLANCO") },
    { label: "Azul", index: name.indexOf("AZUL") },
    { label: "Verde", index: name.indexOf("VERDE") },
    { label: "Gris", index: name.indexOf("GRIS") },
    { label: "Arena", index: name.indexOf("ARENA") },
  ];
  return (
    candidates
      .filter((candidate) => candidate.index >= 0)
      .sort((a, b) => a.index - b.index || b.label.length - a.label.length)[0]
      ?.label ?? "Sin color"
  );
}
