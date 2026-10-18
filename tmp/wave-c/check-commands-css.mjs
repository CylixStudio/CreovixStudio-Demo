const html = await (await fetch("http://127.0.0.1:3001/commands/creovixstudio")).text();
const hrefs = [...html.matchAll(/href="([^"]+\.css)"/g)].map((match) => match[1]);
const found = [];
for (const href of hrefs) {
  const css = await (await fetch(`http://127.0.0.1:3001${href}`)).text();
  if (css.includes("--card-h") || css.includes("repeat(6")) {
    found.push({
      href,
      card: css.includes("--card-h:170px") || css.includes("--card-h: 170px"),
      grid: css.includes("repeat(6"),
    });
  }
}
console.log(JSON.stringify({ stylesheets: hrefs.length, found }, null, 2));
