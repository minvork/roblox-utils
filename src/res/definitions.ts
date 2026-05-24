import { Players, ReplicatedStorage } from "@rbxts/services";
import type { StarterTaskArgs, Tasks } from "../system/tickManager";
import type { GenericAlert, GenericEventCaller } from "../utils";

const initFolder = ReplicatedStorage.FindFirstChild("core")?.FindFirstChild("node_modules")?.FindFirstChild("@jabko")?.FindFirstChild("utils")?.FindFirstChild("src")?.FindFirstChild("res")?.FindFirstChild("events")?.FindFirstChild("init") as Folder;

const initScriptsFolder = ReplicatedStorage.FindFirstChild("core")?.FindFirstChild("node_modules")?.FindFirstChild("@jabko")?.FindFirstChild("utils")?.FindFirstChild("src")?.FindFirstChild("res")?.FindFirstChild("tasks")?.FindFirstChild("init") as Folder;

if (!initFolder.FindFirstChild("cameraPromise")) {
	new Instance("BindableEvent", initFolder).Name = "cameraPromise";

	new Instance("BindableEvent", initFolder).Name = "viewportSizePromise";

	new Instance("BindableEvent", initFolder.Parent?.FindFirstChild("thread") as Folder).Name = "threadFinished";

	new Instance("BindableEvent", initFolder.Parent?.FindFirstChild("thread") as Folder).Name = "workerReady";
}

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

export { initFolder };
