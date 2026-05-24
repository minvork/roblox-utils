//!strict

import { StarterGui, Workspace } from "@rbxts/services";
import { GenericAlert } from "../utils.js";
import { tickManager } from "../system/tickManager.js";
import { client, clientTasks, type CameraPromiseTaskArgs } from "../res/definitions.js";

/**
 * Makes the given player immortal
 *
 * @export
 * @param {Player} player Target {@link Player}
 */
export function preparePlayer(player: Player): void {
	const character = player.Character || player.CharacterAdded.Wait()[0];
	const humanoid: Humanoid = character.FindFirstChild("Humanoid") as Humanoid;

	humanoid.SetStateEnabled(Enum.HumanoidStateType.Dead, false);
}

/**
 * Initializes the client
 *
 * @export
 */
export function prepareClient(): Promise<void> {
	const uiPreparingAlert: GenericAlert = new GenericAlert("UiPreparingAlert", "Ui is loading...");
	const uiLoadedAlert: GenericAlert = new GenericAlert("UiLoadedAlert", "Ui has finished loading");

	const camera = Workspace.CurrentCamera;

	uiPreparingAlert.fire();

	const fun = clientTasks.cameraPromise;

	const cameraWaitService = tickManager.createService({
		task: fun,
		threadSafe: true,
		args: {
			camera,
			uiLoadedAlert
		} as CameraPromiseTaskArgs
	});

	return new Promise((resolve) => {
		const event = fun.event?.Event.Connect(() => {
			event?.Disconnect();

			tickManager.removeService(cameraWaitService);

			uiLoadedAlert.fire();

			preparePlayer(client);

			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.All, false);
			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, true);
			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Chat, true);

			resolve();
		});
	});
}
