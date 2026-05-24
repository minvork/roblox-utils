//!strict

import { screenManager } from "./screenManager";
import { uiController, type UiScreen } from "./uiController";
import { uiInitializer } from "./helpers";
import { client } from "../res/definitions";
import { UnrealError } from "../utils";

/**
 * Initializes the gui
 *
 * @export
 * @returns {Promise<void>} Resolves when the gui is ready
 */
export async function initGui(initialScreenCallback: () => UiScreen): Promise<void> {
	const gui: PlayerGui = client.FindFirstChild("PlayerGui") as PlayerGui;

	try {
		await uiInitializer.init();

		// define gui
		uiController.init(gui);

		return screenManager.init(initialScreenCallback);
	} catch (e) {
		// biome-ignore lint/nursery/useErrorCause: included
		throw new UnrealError(e as string);
	}
}
