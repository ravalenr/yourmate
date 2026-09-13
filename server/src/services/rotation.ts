export type RotationMember = { id: string; holidayMode: boolean };

export type RotationResult = {
  assigneeId: string;
  /** True when the task came back to its current holder because everyone else is away. */
  covering: boolean;
};

/**
 * Works out who takes a rotational task next. See ARCHITECTURE.md section 6.2.
 *
 * `members` must already be in join order — that ordering *is* the rotation.
 * `currentAssigneeId` is whoever holds the task now; rotation walks forward from
 * them so the sequence is preserved even if somebody else marked it done.
 */
export function nextAssignee(
  members: RotationMember[],
  currentAssigneeId: string | null,
): RotationResult {
  if (members.length === 0) {
    throw new Error('Cannot rotate a task in a household with no members');
  }

  // -1 when the task has no holder, or their membership ended: the walk below then
  // starts from the first member instead.
  const start = members.findIndex((member) => member.id === currentAssigneeId);
  const at = (offset: number) => members[(start + offset + members.length) % members.length];

  // Walk the whole way round, skipping anyone on holiday. Because the walk starts
  // one past the current holder, they are the last candidate considered — so they
  // only get it again if nobody else is available.
  for (let step = 1; step <= members.length; step++) {
    const candidate = at(step);
    if (!candidate.holidayMode) {
      return {
        assigneeId: candidate.id,
        // Not "covering" in a one-person household: there is nobody to cover for.
        covering: candidate.id === currentAssigneeId && members.length > 1,
      };
    }
  }

  // Everyone is away, the current holder included. Pass it on rather than handing it
  // straight back; it waits with them until they return.
  return { assigneeId: at(1).id, covering: false };
}
