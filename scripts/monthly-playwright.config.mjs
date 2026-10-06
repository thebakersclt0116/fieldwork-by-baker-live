import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'monthly-progress.browser.mjs',workers:1,retries:0,timeout:45000,reporter:'list',use:{baseURL:'http://127.0.0.1:4173',acceptDownloads:true,trace:'off',screenshot:'off'},webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false}});
