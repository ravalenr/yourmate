import cron from 'node-cron';
import { cleanupCompletedTasks } from './cleanupTasks';

/**
 * Runs daily rather than weekly on purpose. The cleanup condition is
 * "completed before this week started", which is self-correcting: if the server
 * happens to be down on Monday, Tuesday's run still clears the backlog. A
 * once-a-week job would silently skip that week entirely.
 */
export function startScheduledJobs() {
  cron.schedule('0 3 * * *', async () => {
    try {
      const removed = await cleanupCompletedTasks();
      if (removed > 0) {
        console.log(`Cleanup: removed ${removed} finished one-off task(s).`);
      }
    } catch (error) {
      // A failed cleanup must not take the server down; the next run retries.
      console.error('Cleanup job failed:', error);
    }
  });
}
