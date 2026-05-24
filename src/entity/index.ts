//!strict

import { Players } from "@rbxts/services";
import { prepareClient, preparePlayer } from "./player.js";

/**
 * Initializes all players
 *
 * @export
 */
export function initPlayers(): Promise<void> {
	// prepare other players
	Players.PlayerAdded.Connect((player) => {
		preparePlayer(player);
	});

	// prepare client
	return prepareClient();
}
