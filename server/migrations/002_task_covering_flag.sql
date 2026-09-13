-- Records that a rotational task came back to the person who just completed it
-- because every other housemate was on holiday. Lets the app show "you're covering
-- while others are away" instead of silently handing them every chore.
-- Recalculated on each completion, so it clears itself when housemates return.

ALTER TABLE tasks
  ADD COLUMN assigned_while_covering BOOLEAN NOT NULL DEFAULT FALSE;
