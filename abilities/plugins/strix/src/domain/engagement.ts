/**
 * Whether the user has put Strix on the current turn.
 *
 * The composer chip is the only writer. The panel reads it for one decision: a host
 * turn that starts while the chip is on is *this* assessment, so the panel leaves the
 * launch screen and shows the run instead of waiting for a message of its own.
 *
 * Module scope on purpose — the tab mounts and unmounts, and the chip outlives it.
 */
let engaged = false;

export function setStrixEngaged(next: boolean): void {
	engaged = next;
}

export function isStrixEngaged(): boolean {
	return engaged;
}
