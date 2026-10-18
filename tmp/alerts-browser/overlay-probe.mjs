import puppeteer from 'puppeteer-core';
const data=await (await fetch('http://127.0.0.1:3001/api/demo/alert-studio')).json();
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
page.on('pageerror',e=>console.log('ERROR',e.message));
page.on('response',r=>{if(r.url().includes('/overlay/'))console.log('HTTP',r.status(),r.url().split('/').at(-1));});
await page.goto('http://127.0.0.1:3001/overlay/demo-alerts/'+data.token,{waitUntil:'domcontentloaded'});
await page.bringToFront();
for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,4000));console.log('BODY',await page.evaluate(()=>document.body.innerText));}
await page.screenshot({path:'E:/Store/Cylix/CylixStudio-Demo/.demo-data/overlay-probe.png'});
await browser.close();
