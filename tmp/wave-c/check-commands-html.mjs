const html = await (await fetch("http://127.0.0.1:3001/commands/creovixstudio")).text();
const card = html.includes("--card-h:170px") || html.includes("--card-h: 170px");
const grid = html.includes("repeat(6,minmax(0,1fr)") || html.includes("repeat(6, minmax(0, 1fr)");
console.log(JSON.stringify({ bytes: html.length, card, grid, search: html.includes("type=\"search\"") || html.includes("search") }));
