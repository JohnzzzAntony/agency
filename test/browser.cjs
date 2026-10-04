// Optional browser smoke test: set PLAYWRIGHT_PATH to an installed Playwright module.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {createServer}=require('../server');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'duoonex-browser-'));
  const secret=crypto.randomBytes(32).toString('hex');
  const server=createServer({secret,dataDir,production:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/admin/');
    await page.locator('#password').fill(secret);await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.locator('#fields .field').first().waitFor({timeout:90000});
    assert.ok(await page.locator('#pages button').count()>60);
    await page.locator('#field-search').fill('h1 · Custom');
    const heading=page.locator('#fields textarea').first();await heading.fill('Browser-tested custom website heading ');
    await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Draft saved'));
    const publicPage=await browser.newPage();await publicPage.goto(base);assert.ok(!(await publicPage.locator('h1').innerText()).includes('Browser-tested'));
    await page.getByRole('button',{name:'Preview draft',exact:true}).click();
    const frame=page.frameLocator('#preview-frame');await frame.locator('h1').waitFor();assert.ok((await frame.locator('h1').innerText()).includes('Browser-tested'));
    await frame.locator('h1').click();await page.locator('#preview-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.field.selected').count(),1);
    await page.getByRole('button',{name:'Publish page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Published.'));
    await publicPage.reload();assert.ok((await publicPage.locator('h1').innerText()).includes('Browser-tested'));
    await page.locator('#type-filter').selectOption('image');
    await page.getByRole('button',{name:'Choose image'}).first().click();
    await page.locator('#upload').setInputFiles({name:'test-image.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=','base64')});
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Images uploaded.');
    await page.getByRole('button',{name:'Use this image'}).first().click();await page.getByRole('button',{name:'Publish page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Published.'));
    await publicPage.reload();assert.match(await publicPage.locator('.logo__img').first().getAttribute('src'),/^\/media\//);
    await publicPage.goto(base+'/contact/');await publicPage.locator('input[name="name"]').fill('Browser Client');await publicPage.locator('input[name="email"]').fill('browser@example.com');await publicPage.locator('textarea[name="message"]').fill('Custom site enquiry');await publicPage.locator('[data-contact-form] button[type="submit"]').click();await publicPage.getByText('Thank you. Your enquiry has been received.').waitFor();
    await page.getByRole('button',{name:'Enquiries',exact:true}).click();await page.getByRole('heading',{name:'Browser Client',exact:true}).waitFor();
    await page.getByRole('button',{name:'Pages',exact:true}).click();
    fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-output/admin-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../test-output/admin-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    assert.deepEqual(errors,[]);console.log('Browser smoke passed: login, editing, preview, publish, upload, enquiry inbox and mobile layout.');
  } finally {
    if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    if(path.dirname(path.resolve(dataDir))===path.resolve(os.tmpdir())&&path.basename(dataDir).startsWith('duoonex-browser-'))fs.rmSync(dataDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
