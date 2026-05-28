import { Players, ReplicatedStorage } from "@rbxts/services";
import type { StarterTaskArgs, Tasks } from "../system/tickManager";
import type { GenericAlert, GenericEventCaller } from "../utils";

const resFolder = ReplicatedStorage.FindFirstChild("src")?.FindFirstChild("res") as Folder;

const eventsFolder = resFolder.FindFirstChild("events") as Folder;

const initFolder = eventsFolder.FindFirstChild("init") as Folder;

const threadFolder = eventsFolder.FindFirstChild("thread") as Folder;

const initScriptsFolder = resFolder.FindFirstChild("tasks")?.FindFirstChild("init") as Folder;

export const client: Player = Players.LocalPlayer;

export const clientTasks: Tasks = {
	cameraPromise: {
		fun: initScriptsFolder.FindFirstChild("cameraPromise") as ModuleScript,
		event: initFolder.FindFirstChild("cameraPromise") as BindableEvent
	} as const,
	viewportSizePromise: {
		fun: initScriptsFolder.FindFirstChild("viewportSizePromise") as ModuleScript,
		event: initFolder.FindFirstChild("viewportSizePromise") as BindableEvent
	} as const
} as const;

export interface CameraPromiseTaskArgs extends StarterTaskArgs {
	readonly camera: Camera | undefined;
	readonly uiLoadedAlert: GenericAlert;
}

export interface ViewportSizePromiseTaskArgs extends StarterTaskArgs {
	readonly camera: Camera;
	readonly screenSizeChangeCallback: () => void;
	readonly onViewportInitCaller: GenericEventCaller<[]>;
}

export { threadFolder };
