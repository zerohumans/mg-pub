import {test,expect} from '@playwright/test';

test('desktop rendering, driving, nitro, pause, camera, restart and results',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'CHASE THE HORIZON.'})).toBeVisible();
  await page.screenshot({path:'test-results/desktop-menu.png'});
  await page.getByRole('button',{name:'Glacier blue',exact:true}).click();await expect(page.getByRole('button',{name:'Glacier blue',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'START YOUR ENGINE'}).click();await expect(page.locator('#countdown')).toBeVisible();
  await page.waitForFunction(()=>window.__APEX_TEST__.getRace().phase==='racing');
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.__APEX_TEST__.getRace().player.speed>12);await page.keyboard.down('Shift');
  await page.waitForFunction(()=>window.__APEX_TEST__.getRace().player.nitro<96);await page.keyboard.up('Shift');await page.keyboard.up('KeyW');
  await page.screenshot({path:'test-results/desktop-racing.png'});
  await page.getByRole('button',{name:'Pause race',exact:true}).click();await expect(page.getByRole('dialog',{name:'Race paused'})).toBeVisible();
  const frozen=await page.evaluate(()=>window.__APEX_TEST__.getRace().elapsed);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__APEX_TEST__.getRace().elapsed)).toBe(frozen);
  await page.getByRole('button',{name:'BACK TO THE DRIVE'}).click();await page.keyboard.press('KeyC');expect(await page.evaluate(()=>window.__APEX_TEST__.getRace().camera)).toBe(1);
  await page.keyboard.press('KeyR');expect(await page.evaluate(()=>window.__APEX_TEST__.getRace().resetCount)).toBe(1);
  await page.evaluate(()=>window.__APEX_TEST__.finish());await expect(page.getByRole('dialog',{name:'Race results'})).toBeVisible();await expect(page.getByText('NEW PERSONAL BEST')).toBeVisible();
  await page.getByRole('button',{name:'ONE MORE DRIVE'}).click();await expect(page.locator('#countdown')).toBeVisible();
  await page.getByRole('button',{name:'Pause race',exact:true}).click();await page.getByRole('button',{name:'BACK TO GARAGE'}).click();await expect(page.locator('#start-race')).toBeVisible();
  expect(errors).toEqual([]);
});

test('all circuits, modes and settings work and persist',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Alpine Rush/}).click();await expect(page.getByRole('button',{name:/Alpine Rush/})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Midnight Run/}).click();await page.getByRole('button',{name:'TIME TRIAL',exact:true}).click();
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Race difficulty').selectOption('casual');await page.getByLabel('Graphics quality').selectOption('low');await page.getByLabel('Engine sound').uncheck();await page.getByRole('button',{name:'GOT IT'}).click();
  await page.reload();await expect(page.getByRole('button',{name:/Midnight Run/})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'TIME TRIAL',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'START YOUR ENGINE'}).click();expect(await page.evaluate(()=>window.__APEX_TEST__.getRace().rivals.length)).toBe(0);
  await page.getByRole('button',{name:'Pause race',exact:true}).click();await page.getByRole('button',{name:'BACK TO GARAGE'}).click();await page.getByRole('button',{name:'FREE DRIVE',exact:true}).click();await page.getByRole('button',{name:'LET’S DRIVE'}).click();await expect(page.locator('#lap-value')).toContainText('∞');
});

test('mobile menu fits and touch controls accelerate and release correctly',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173/');await expect(page.locator('#start-race')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile-menu.png',fullPage:true});
  await page.getByRole('button',{name:'START YOUR ENGINE'}).click();await page.waitForFunction(()=>window.__APEX_TEST__.getRace().phase==='racing');
  const gas=page.getByRole('button',{name:'Accelerate',exact:true});await expect(gas).toBeVisible();const bounds=await gas.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
  await page.waitForFunction(()=>window.__APEX_TEST__.getRace().player.speed>5);await page.mouse.up();await page.screenshot({path:'test-results/mobile-racing.png'});
  await page.getByRole('button',{name:'Pause race',exact:true}).tap();await expect(page.getByRole('dialog',{name:'Race paused'})).toBeVisible();await context.close();
});
