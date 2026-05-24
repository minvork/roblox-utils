//!strict

import type { CameraPromiseTaskArgs } from "../../definitions";

export = (args: CameraPromiseTaskArgs): void => {
	if (args.camera) {
		args.event?.Fire();
	}
}
