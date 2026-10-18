import fs from "node:fs";

const file = "E:/Store/Cylix/CylixStudio-Demo/src/hooks/useWidgetStream.ts";
const replacement = fs.readFileSync("E:/Store/Cylix/CylixStudio-Demo/tmp/overlay-stream-effect.ts", "utf8");
const source = fs.readFileSync(file, "utf8");
const start = source.indexOf("  useEffect(() => {\n    if (!publicToken || isDemoToken(publicToken)) return;\n    let source:");
const end = source.indexOf("  const shownFrame =");
if (start < 0 || end < 0 || end <= start) {
  console.log(JSON.stringify({ start, end }));
  process.exit(1);
}
fs.writeFileSync(file, source.slice(0, start) + replacement + source.slice(end));
console.log("spliced", start, end);
