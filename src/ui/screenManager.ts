//!strict

import { uiController, type UiScreen } from "./uiController";

/**
 * Screen manager
 */
class ScreenManager {
	/**
	 * Initializes the screen manager
	 *
	 * @public
	 * @returns {void} Resolves when the manager is ready
	 */
	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	public init(initialScreenCallback: () => UiScreen): void {
		const initialScreen = initialScreenCallback();

		uiController.appendScreen(initialScreen);
	}
}

/**
 * Screen manager singleton
 */
export const screenManager: ScreenManager = new ScreenManager();
