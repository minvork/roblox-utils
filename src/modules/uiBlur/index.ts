//!strict

import { RunService, Workspace } from "@rbxts/services";

interface BindingInfo {
	uid: string;
	parts: Part[];
	folder: Folder;
	event: RBXScriptConnection;
}

class BlurController {
	private readonly thickness = 0.05;
	private readonly depthBase = 1;
	private readonly depthFactor = 0.05;
	private readonly sizeMultiplier = 0.968_75;
	private readonly epsilon = 0.01;
	private readonly half = 0.5;
	private readonly fullCircle = 180;
	private readonly pi = math.pi;

	private readonly camera: Camera;
	private readonly binds = new Map<GuiObject, BindingInfo>();
	private readonly root: Folder;
	private id = 0;

	public constructor() {
		this.camera = Workspace.CurrentCamera as Camera;
		this.root = new Instance("Folder");
		this.root.Name = "neon";
		this.root.Parent = this.camera;
	}

	public bindFrame(frame: GuiObject, properties?: Partial<InstanceProperties<Part>>): Part[] {
		const existing = this.binds.get(frame);

		if (existing) {
			return existing.parts;
		}

		const uid = this.genUid();
		const parts: Part[] = [];
		const folder = new Instance("Folder");
		folder.Name = frame.Name;
		folder.Parent = this.root;

		const parents = this.getGuiParents(frame);

		const updateOrientation = (fetchProps?: boolean): void => {
			let rot = 0;
			for (const v of parents) {
				rot += v.Rotation;
			}

			const tlAbs = frame.AbsolutePosition;
			const size = frame.AbsoluteSize;
			const center = tlAbs.add(size.mul(0.5));

			let scaledSize = size.mul(this.sizeMultiplier);

			if (this.camera.ViewportSize.Y > 540) {
				scaledSize = scaledSize.mul(new Vector2(0.968_75, 1));
			}

			const newTl = center.sub(scaledSize.mul(0.5));
			const newBr = center.add(scaledSize.mul(0.5));

			let tl = newTl;
			let br = newBr;
			let tr = new Vector2(br.X, tl.Y);
			let bl = new Vector2(tl.X, br.Y);

			if (rot !== 0 && rot % this.fullCircle !== 0) {
				const mid = tl.Lerp(br, this.half);
				tl = this.rotatePoint(tl, mid, rot);
				tr = this.rotatePoint(tr, mid, rot);
				bl = this.rotatePoint(bl, mid, rot);
				br = this.rotatePoint(br, mid, rot);
			}

			const depth = this.depthBase + this.depthFactor * frame.ZIndex;

			this.drawQuad({
				v1: this.camera.ScreenPointToRay(tl.X, tl.Y, depth).Origin,
				v2: this.camera.ScreenPointToRay(tr.X, tr.Y, depth).Origin,
				v3: this.camera.ScreenPointToRay(bl.X, bl.Y, depth).Origin,
				v4: this.camera.ScreenPointToRay(br.X, br.Y, depth).Origin,
				parts,
			});

			if (fetchProps && properties) {
				for (const pt of parts) {
					pt.Parent = folder;
				}
				this.applyProperties(parts, properties);
			}
		};

		updateOrientation(true);
		const event = RunService.PreRender.Connect(() => updateOrientation());

		const binding: BindingInfo = { uid, parts, folder, event };
		this.binds.set(frame, binding);
		return binding.parts;
	}

	public unbindFrame(frame: GuiObject): void {
		const binding = this.binds.get(frame);

		if (binding) {
			binding.event.Disconnect();
			for (const part of binding.parts) {
				part.Destroy();
			}
			binding.folder.Destroy();
			this.binds.delete(frame);
		} else {
			warn(`No part bindings exist for ${frame.GetFullName()}`);
		}
	}

	private genUid(): string {
		this.id += 1;
		return `neon::${this.id}`;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private createWedgePart(): Part {
		const part = new Instance("Part");
		part.TopSurface = Enum.SurfaceType.Smooth;
		part.BottomSurface = Enum.SurfaceType.Smooth;
		part.Anchored = true;
		part.CanCollide = false;
		part.Material = Enum.Material.Glass;
		part.Size = new Vector3(1, 1, 1);
		const mesh = new Instance("SpecialMesh");
		mesh.MeshType = Enum.MeshType.Wedge;
		mesh.Name = "WedgeMesh";
		mesh.Parent = part;
		return part;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private updateWedgePart(part: Part, scale: Vector3, cf: CFrame): void {
		const mesh = part.FindFirstChild("WedgeMesh") as SpecialMesh;
		mesh.Scale = scale;
		part.CFrame = cf;
	}

	private getTriangleOrientation(v1: Vector3, v2: Vector3, v3: Vector3): [Vector3, Vector3, Vector3] {
		const s1 = v1.sub(v2).Magnitude;
		const s2 = v2.sub(v3).Magnitude;
		const s3 = v3.sub(v1).Magnitude;
		const smax = math.max(s1, s2, s3);

		if (math.abs(s1 - smax) < this.epsilon) {
			return [v1, v2, v3];
		}

		if (math.abs(s2 - smax) < this.epsilon) {
			return [v2, v3, v1];
		}

		return [v3, v1, v2];
	}

	private drawTriangle(
		v1: Vector3,
		v2: Vector3,
		v3: Vector3,
		parts: { p0?: Part; p1?: Part } = {},
	): [Part, Part] {
		const [a, b, c] = this.getTriangleOrientation(v1, v2, v3);

		const baseLen = a.sub(b).Magnitude;
		if (baseLen < this.epsilon) {
			const dummy = this.createWedgePart();
			return [dummy, dummy.Clone()];
		}

		const para = (b.sub(a).Dot(c.sub(a))) / baseLen;
		const perp = math.sqrt(c.sub(a).Magnitude ** 2 - para * para);
		const difPara = baseLen - para;

		const st = new CFrame(b, a);
		const za = CFrame.Angles(this.pi / 2, 0, 0);

		let cf0 = st;
		const topLook = cf0.mul(za).LookVector;
		const midPoint = a.add(new CFrame(a, b).LookVector.mul(para));
		const neededLook = new CFrame(midPoint, c).LookVector;
		let dot = topLook.Dot(neededLook);
		dot = math.clamp(dot, -1, 1);
		const angle = math.acos(dot);

		const ac = CFrame.Angles(0, 0, angle);
		cf0 = cf0.mul(ac);
		if (cf0.mul(za).LookVector.sub(neededLook).Magnitude > this.epsilon) {
			cf0 = cf0.mul(CFrame.Angles(0, 0, -2 * angle));
		}
		cf0 = cf0.mul(new CFrame(0, perp / 2, -(difPara + para / 2)));

		let cf1 = st.mul(ac).mul(CFrame.Angles(0, this.pi, 0));
		if (cf1.mul(za).LookVector.sub(neededLook).Magnitude > this.epsilon) {
			cf1 = cf1.mul(CFrame.Angles(0, 0, 2 * angle));
		}
		cf1 = cf1.mul(new CFrame(0, perp / 2, difPara / 2));

		let { p0, p1 } = parts;

		if (!p0) {
			p0 = this.createWedgePart();
		}

		this.updateWedgePart(p0, new Vector3(this.thickness, perp, para), cf0);

		if (!p1) {
			p1 = p0.Clone();
		}

		this.updateWedgePart(p1, new Vector3(this.thickness, perp, difPara), cf1);

		return [p0, p1];
	}

	private drawQuad(vertices: {
		v1: Vector3;
		v2: Vector3;
		v3: Vector3;
		v4: Vector3;
		parts: Part[];
	}): void {
		const { v1, v2, v3, v4, parts } = vertices;
		[parts[0], parts[1]] = this.drawTriangle(v1, v2, v3, { p0: parts[0], p1: parts[1] });
		[parts[2], parts[3]] = this.drawTriangle(v3, v2, v4, { p0: parts[2], p1: parts[3] });
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private getGuiParents(frame: GuiObject): GuiObject[] {
		const parents: GuiObject[] = [];

		const add = (child: Instance): void => {
			if (child.IsA("GuiObject")) {
				parents.push(child);

				if (child.Parent) {
					add(child.Parent);
				}
			}
		}

		add(frame);

		return parents;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private rotatePoint(point: Vector2, mid: Vector2, rot: number): Vector2 {
		const s = math.sin(math.rad(rot));
		const c = math.cos(math.rad(rot));
		return new Vector2(
			c * (point.X - mid.X) - s * (point.Y - mid.Y),
			s * (point.X - mid.X) + c * (point.Y - mid.Y),
		).add(mid);
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private applyProperties(parts: Part[], properties: Partial<InstanceProperties<Part>>): void {
		for (const [propName, propValue] of pairs(properties)) {
			for (const pt of parts) {
				(pt as unknown as Record<string, unknown>)[propName] = propValue;
			}
		}
	}
}

export const blurController = new BlurController();
