import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/browser', timeout:60000, workers:1,
  use:{baseURL:process.env.GAME_TEST_URL || 'http://127.0.0.1:5173',headless:true,viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:process.env.GAME_TEST_URL?undefined:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
