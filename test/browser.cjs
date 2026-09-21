// Optional smoke test: PLAYWRIGHT_PATH may point to an existing Playwright install.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {createPreview}=require('../scripts/preview');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
  const server=createPreview();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],apiRequests=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.url().includes('/api/'))apiRequests.push(req.url());});
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base);await page.locator('h1').waitFor();assert.match(await page.locator('h1').innerText(),/Custom websites/);
    assert.ok(await page.locator('.logo__img').first().evaluate(el=>el.complete&&el.naturalWidth>0));
    await page.goto(base+'/services/web-design/');assert.ok(await page.locator('.logo__img').first().evaluate(el=>el.complete&&el.naturalWidth>0));
    const artwork=await page.locator('.art').first().evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(artwork,/url\(/);
    await page.goto(base+'/admin/');assert.equal(await page.getByRole('link',{name:/Open website editor/}).getAttribute('href'),'https://app.pagescms.org/');assert.equal(await page.locator('input[type="password"]').count(),0);
    fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-output/hosted-cms-admin.png')});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    // A direct file:// load proves production has no backend requirement.
    await page.goto(pathToFileURL(path.join(__dirname,'../dist/index.html')).href);await page.locator('h1').waitFor();assert.ok(await page.locator('.logo__img').first().evaluate(el=>el.complete&&el.naturalWidth>0));
    await page.goto(base+'/contact/');await page.locator('input[name="name"]').fill('Preview User');await page.locator('input[name="email"]').fill('preview@example.com');
    await page.locator('form[data-contact-form]').evaluate(form=>form.setAttribute('data-form-endpoint','https://forms.example.test/submit'));
    await page.route('https://forms.example.test/submit',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
    await page.locator('form[data-contact-form] button[type="submit"]').click();await page.getByText('Thank you. Your enquiry has been received.').waitFor();
    assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);
    console.log('Browser passed: frontend, inner-page assets, hosted admin link, mobile layout, direct file access and mocked hosted form.');
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
