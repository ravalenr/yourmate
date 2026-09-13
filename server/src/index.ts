import { createApp } from './app';
import { env } from './env';
import { startScheduledJobs } from './jobs/schedule';

createApp().listen(env.port, () => {
  console.log(`yourmate API listening on http://localhost:${env.port}`);
});

// Started here rather than in createApp so tests don't spin up cron timers.
startScheduledJobs();
