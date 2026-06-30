// =============================================================================
// ArenaStreamerTyped.ts — Cyber Cowboys typed obstacle + path renderer
// -----------------------------------------------------------------------------
// Uses DB snapshots from wss://cybercowboys.fly.dev and renders:
//   Obstacles.OBJECT_TYPE -> matching prefab (cone, pole, barrel, vertical,
//                            cavaletti, pause/stop, startline, finishline)
//   OBJECT_TYPE 'numbertag' -> floating text of the `number_tag` column value,
//                            drawn in the assigned font and lifted to sight level
//                            (NOT placed on the floor, no FBX).
//   Paths -> pathTrianglePrefab, blue-triangle.png floor decal (all waypoints)
//
// Lens Studio units: centimetres. Your DB/editor units are canvas pixels.
// =============================================================================

@component
export class ArenaStreamerTyped extends BaseScriptComponent {
  // Connection
  @input internetModule: InternetModule;
  @input websocketUrl: string = "wss://cybercowboys.fly.dev/";

  // Scene
  @input arenaRoot: SceneObject;
  @input @allowUndefined camera: SceneObject;

  // Typed obstacle prefabs. Create prefabs from the FBX assets, then drag them here.
  @input @allowUndefined conePrefab: ObjectPrefab;
  @input @allowUndefined polePrefab: ObjectPrefab;
  @input @allowUndefined barrelPrefab: ObjectPrefab;
  @input @allowUndefined verticalPrefab: ObjectPrefab;
  @input @allowUndefined cavalettiPrefab: ObjectPrefab;
  @input @allowUndefined pauseZonePrefab: ObjectPrefab; // flat stop-arena.png floor decal
  @input @allowUndefined
  @hint("FBX prefab for the START line. Import startline.fbx, make a prefab, drag it here. Placed on the floor like any obstacle.")
  startLinePrefab: ObjectPrefab;
  @input @allowUndefined
  @hint("FBX prefab for the FINISH line. Import finishline.fbx, make a prefab, drag it here. Placed on the floor like any obstacle.")
  finishLinePrefab: ObjectPrefab;
  @input @allowUndefined defaultObstaclePrefab: ObjectPrefab;

  // Path floor decals / markers
  @input @allowUndefined pathTrianglePrefab: ObjectPrefab; // blue-triangle.png floor decal

  // ── Number tags ────────────────────────────────────────────────────────────
  // 'numbertag' rows are NOT given an FBX. Instead we render the value of the
  // DB column `number_tag` as floating text, lifted to sight level.
  @input @allowUndefined
  @hint("Zilla Slab font asset. Import ZillaSlab-Bold.ttf into Assets, then drag the Font asset here.")
  numberTagFont: Font;
  @input
  @hint("How high the number floats off the floor, in arena-metres. ~1.5 ≈ eye / sight level at full arenaScale.")
  numberTagHeightMeters: number = 1.5;
  @input
  @hint("Overall size multiplier for the floating number. Increase if the digits read too small.")
  numberTagScale: number = 1.0;
  @input
  @hint("Keep each number turned toward the wearer (yaw only, stays upright). Off = the number faces into the arena.")
  numberTagFaceCamera: boolean = true;
  @input
  @hint("Spin the number by this many degrees if it ends up facing away from you (try 180).")
  numberTagYawOffsetDeg: number = 0;

  // Tuning
  @input targetSession: number = 0; // 0 = newest session
  @input arenaScale: number = 1.0;
  @input obstacleBaseScale: number = 1.0;
  @input triangleSizeMeters: number = 0.75;
  @input groundOffsetCm: number = 0.8;
  @input flipHandedness: boolean = false;
  @input triangleYawOffsetDeg: number = 0;
  @input obstacleYawOffsetDeg: number = 0;
  @input enableLogging: boolean = true;
  @input logTypes: boolean = true;

  // Optional proximity sound
  @input @allowUndefined alertAudio: AudioComponent;
  @input proximityRadiusMeters: number = 1.5;

  private socket: WebSocket | null = null;
  private isOpen = false;
  private reconnectEvent: DelayedCallbackEvent | null = null;

  private obstacleRows: any[] = [];
  private pathRows: any[] = [];
  private dimsBySession: { [sid: number]: { dx: number; dy: number } } = {};
  private highWaterSession = 0;

  private liveObstacles: { [id: number]: { so: SceneObject; inside: boolean; type: string } } = {};
  // Floating number-tag text objects, kept apart from liveObstacles so they never
  // trigger the proximity sound (they're labels, not solid obstacles).
  private liveNumberTags: { [id: number]: { so: SceneObject; text: Text } } = {};
  private pathContainer: SceneObject | null = null;

  onAwake() {
    if (this.alertAudio) this.alertAudio.playbackMode = Audio.PlaybackMode.LowLatency;
    this.createEvent("OnStartEvent").bind(() => this.connect());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  refresh() {
    if (this.isOpen) this.send({ type: "subscribeDb" });
    else this.connect();
  }

  private connect() {
    if (!this.internetModule) { this.log("ERROR: assign Internet Module."); return; }
    this.log("Connecting: " + this.websocketUrl);
    this.socket = this.internetModule.createWebSocket(this.websocketUrl);
    this.socket.binaryType = "blob";

    this.socket.onopen = () => {
      this.isOpen = true;
      this.log("WebSocket open. Subscribing to DB.");
      this.send({ type: "subscribeDb" });
    };

    this.socket.onmessage = async (event: WebSocketMessageEvent) => {
      let text = "";
      if (event.data instanceof Blob) text = await event.data.text();
      else text = event.data as string;
      this.handleMessage(text);
    };

    this.socket.onerror = () => this.log("WebSocket error.");
    this.socket.onclose = (event: WebSocketCloseEvent) => {
      this.isOpen = false;
      this.log("WebSocket closed code " + event.code + ". Reconnecting in 3s.");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectEvent) return;
    this.reconnectEvent = this.createEvent("DelayedCallbackEvent");
    this.reconnectEvent.bind(() => { this.reconnectEvent = null; this.connect(); });
    this.reconnectEvent.reset(3.0);
  }

  private send(obj: object) {
    if (this.socket && this.isOpen) this.socket.send(JSON.stringify(obj));
  }

  private handleMessage(text: string) {
    let msg: any;
    try { msg = JSON.parse(text); } catch (e) { this.log("Bad JSON from server."); return; }
    if (msg.type !== "dbSnapshot") return;

    if (msg.table === "Obstacles") {
      this.obstacleRows = msg.rows || [];
      if (this.logTypes) this.printObjectTypes();
    } else if (msg.table === "Paths") {
      this.pathRows = msg.rows || [];
      if (this.logTypes) this.printPointTypes();
    } else if (msg.table === "arenaDimensions") {
      this.dimsBySession = {};
      (msg.rows || []).forEach((r: any) => {
        this.dimsBySession[Number(r.session_ID)] = {
          dx: Number(r.dimension_x) || 60,
          dy: Number(r.dimension_y) || 20,
        };
      });
    } else {
      return;
    }
    this.rebuild();
  }

  private printObjectTypes() {
    const counts: { [key: string]: number } = {};
    this.obstacleRows.forEach((o) => {
      const t = this.norm(o.object_type || o.OBJECT_TYPE || "none");
      counts[t] = (counts[t] || 0) + 1;
    });
    this.log("OBJECT_TYPE values: " + Object.keys(counts).map(k => k + " x" + counts[k]).join(", "));
  }

  private printPointTypes() {
    const counts: { [key: string]: number } = {};
    this.pathRows.forEach((p) => {
      const t = this.norm(p.point_type || p.POINT_TYPE || "point");
      counts[t] = (counts[t] || 0) + 1;
    });
    this.log("POINT_TYPE values: " + Object.keys(counts).map(k => k + " x" + counts[k]).join(", "));
  }

  private rebuild() {
    if (!this.arenaRoot) { this.log("ERROR: assign arenaRoot."); return; }
    const session = this.resolveSession();
    if (session === 0) return;
    const dims = this.dimsFor(session);
    this.updateObstacles(session, dims.dx, dims.dy);
    this.updatePaths(session, dims.dx, dims.dy);
  }

  private resolveSession(): number {
    if (this.targetSession > 0) return this.targetSession;
    let s = 0;
    for (const k in this.dimsBySession) { const id = Number(k); if (id > s) s = id; }
    this.obstacleRows.forEach((o) => { const id = Number(o.session_ID || o.SESSION_ID); if (id > s) s = id; });
    this.pathRows.forEach((p) => { const id = Number(p.session_ID || p.SESSION_ID); if (id > s) s = id; });
    if (s > this.highWaterSession) this.highWaterSession = s;
    return this.highWaterSession;
  }

  private dimsFor(session: number): { dx: number; dy: number } {
    return this.dimsBySession[session] || { dx: 60, dy: 20 };
  }

  // DB rows can arrive as lower-case or upper-case depending on your server serialization.
  private get(row: any, lower: string, upper: string): any {
    const v = row[lower];
    return (v === undefined || v === null) ? row[upper] : v;
  }

  private num(row: any, lower: string, upper: string, fallback: number = 0): number {
    const v = this.get(row, lower, upper);
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }

  private coord(row: any, calLower: string, calUpper: string, rawLower: string, rawUpper: string): number {
    const cal = this.get(row, calLower, calUpper);
    if (cal !== undefined && cal !== null && cal !== "") return Number(cal) || 0;
    return this.num(row, rawLower, rawUpper, 0);
  }

  private toLocalCm(px: number, py: number, dx: number, dy: number): vec3 {
    const CANVAS_W = 600;
    const ratio = Math.max(0.2, Math.min(1.2, dy / dx));
    const canvasH = Math.round(CANVAS_W * ratio);
    const metresPerPxX = dx / CANVAS_W;
    const metresPerPxY = dy / canvasH;
    const rightM = px * metresPerPxX - dx / 2;
    let forwardM = py * metresPerPxY;
    if (this.flipHandedness) forwardM = -forwardM;
    const u = 100 * this.arenaScale;
    return new vec3(rightM * u, this.groundOffsetCm, -forwardM * u);
  }

  private yRotation(degFromDb: number): quat {
    let deg = this.flipHandedness ? degFromDb : -degFromDb;
    deg += this.obstacleYawOffsetDeg;
    return quat.angleAxis((deg * Math.PI) / 180, vec3.up());
  }

  private updateObstacles(session: number, dx: number, dy: number) {
    const rows = this.obstacleRows.filter((o) => Number(o.session_ID || o.SESSION_ID) === session);
    const seen: { [id: number]: boolean } = {};

    rows.forEach((o) => {
      const id = Number(o.obstacle_ID || o.OBSTACLE_ID);
      if (!id) return;
      seen[id] = true;

      const type = this.norm(o.object_type || o.OBJECT_TYPE || "");

      // Number tags get floating text instead of an FBX — handle and bail out.
      if (type === "numbertag" || type === "number-tag" || type === "tag") {
        this.updateNumberTag(id, o, dx, dy);
        return;
      }

      const prefab = this.prefabForObjectType(type);
      if (!prefab) { this.log("No prefab for OBJECT_TYPE='" + type + "'."); return; }

      let entry = this.liveObstacles[id];
      // If the same DB row changes type, destroy and recreate with the right prefab.
      if (entry && entry.type !== type) {
        entry.so.destroy();
        delete this.liveObstacles[id];
        entry = null;
      }
      if (!entry) {
        const so = prefab.instantiate(this.arenaRoot);
        so.name = (o.object_name || o.OBJECT_NAME || type || "obstacle") + " #" + id;
        entry = { so: so, inside: false, type: type };
        this.liveObstacles[id] = entry;
      }

      const pos = this.toLocalCm(
        this.coord(o, "cal_position_x", "CAL_POSITION_X", "position_x", "POSITION_X"),
        this.coord(o, "cal_position_y", "CAL_POSITION_Y", "position_y", "POSITION_Y"),
        dx, dy
      );
      const rotZ = this.coord(o, "cal_rotate_z", "CAL_ROTATE_Z", "rotate_z", "ROTATE_Z");
      const scale = new vec3(
        this.coord(o, "cal_scale_x", "CAL_SCALE_X", "scale_x", "SCALE_X") || 1,
        this.coord(o, "cal_scale_y", "CAL_SCALE_Y", "scale_y", "SCALE_Y") || 1,
        this.coord(o, "cal_scale_z", "CAL_SCALE_Z", "scale_z", "SCALE_Z") || 1
      ).uniformScale(this.obstacleBaseScale * this.arenaScale);

      const tr = entry.so.getTransform();
      tr.setLocalPosition(pos);
      tr.setLocalRotation(this.yRotation(rotZ));
      tr.setLocalScale(scale);
    });

    Object.keys(this.liveObstacles).forEach((k) => {
      const id = Number(k);
      if (!seen[id]) {
        this.liveObstacles[id].so.destroy();
        delete this.liveObstacles[id];
      }
    });

    // Remove number tags whose rows are gone from this session too.
    Object.keys(this.liveNumberTags).forEach((k) => {
      const id = Number(k);
      if (!seen[id]) {
        this.liveNumberTags[id].so.destroy();
        delete this.liveNumberTags[id];
      }
    });
  }

  private updatePaths(session: number, dx: number, dy: number) {
    if (this.pathContainer) { this.pathContainer.destroy(); this.pathContainer = null; }
    const rows = this.pathRows
      .filter((p) => Number(p.session_ID || p.SESSION_ID) === session)
      .sort((a, b) => Number(a.point_number || a.POINT_NUMBER) - Number(b.point_number || b.POINT_NUMBER));
    if (rows.length === 0) return;

    this.pathContainer = global.scene.createSceneObject("TypedPath");
    this.pathContainer.setParent(this.arenaRoot);

    // Every path waypoint is now rendered as a directional triangle decal,
    // regardless of POINT_TYPE. No more point dots or connecting lines.
    rows.forEach((p) => {
      const pos = this.toLocalCm(
        this.coord(p, "cal_position_x", "CAL_POSITION_X", "position_x", "POSITION_X"),
        this.coord(p, "cal_position_y", "CAL_POSITION_Y", "position_y", "POSITION_Y"),
        dx, dy
      );
      const arrowRot = this.num(p, "arrow_rotation", "ARROW_ROTATION", 0);
      this.spawnPathTriangle(pos, arrowRot);
    });
  }

  private spawnPathTriangle(pos: vec3, arrowRotationDeg: number) {
    if (!this.pathTrianglePrefab || !this.pathContainer) return;
    const so = this.pathTrianglePrefab.instantiate(this.pathContainer);
    so.name = "path triangle";
    const s = this.triangleSizeMeters * 100 * this.arenaScale;

    // ARROW_ROTATION is already calculated by your server/editor. Convert canvas Z-rotation to floor yaw.
    let yawDeg = this.flipHandedness ? arrowRotationDeg : -arrowRotationDeg;
    yawDeg += this.triangleYawOffsetDeg;
    const floorRot = quat.angleAxis((yawDeg * Math.PI) / 180, vec3.up())
      .multiply(quat.angleAxis(-Math.PI / 2, vec3.right()));

    const tr = so.getTransform();
    tr.setLocalPosition(new vec3(pos.x, this.groundOffsetCm, pos.z));
    tr.setLocalRotation(floorRot);
    tr.setLocalScale(new vec3(s, s, s));
  }

  // Render (or refresh) one floating number tag. No FBX: a Text component shows
  // the `number_tag` column value, lifted to sight level instead of the floor.
  private updateNumberTag(id: number, o: any, dx: number, dy: number) {
    // Prefer the dedicated column; fall back to the first digits in the name.
    let value = this.get(o, "number_tag", "NUMBER_TAG");
    if (value === undefined || value === null || (value + "") === "") {
      const name = (o.object_name || o.OBJECT_NAME || "") + "";
      const m = name.match(/\d+/);
      value = m ? m[0] : "";
    }
    const label = (value + "").trim();

    let entry = this.liveNumberTags[id];
    if (!entry) {
      const so = global.scene.createSceneObject("numbertag #" + id);
      so.setParent(this.arenaRoot);
      const text = so.createComponent("Component.Text") as Text;
      if (this.numberTagFont) text.font = this.numberTagFont;
      // Centre the glyphs on the anchor so the number sits over its map spot.
      try { text.horizontalAlignment = HorizontalAlignment.Center; } catch (e) {}
      try { text.verticalAlignment = VerticalAlignment.Center; } catch (e) {}
      entry = { so: so, text: text };
      this.liveNumberTags[id] = entry;
    }
    if (this.numberTagFont && entry.text.font !== this.numberTagFont) {
      entry.text.font = this.numberTagFont;
    }
    entry.text.text = label;

    // Same X/Z as any obstacle, but Y is the sight-level float height, not the floor.
    const pos = this.toLocalCm(
      this.coord(o, "cal_position_x", "CAL_POSITION_X", "position_x", "POSITION_X"),
      this.coord(o, "cal_position_y", "CAL_POSITION_Y", "position_y", "POSITION_Y"),
      dx, dy
    );
    const heightCm = this.numberTagHeightMeters * 100 * this.arenaScale;
    const s = this.numberTagScale * this.arenaScale;

    const tr = entry.so.getTransform();
    tr.setLocalPosition(new vec3(pos.x, heightCm, pos.z));
    tr.setLocalScale(new vec3(s, s, s));
    // When not billboarding, leave the number facing the arena's forward axis.
    if (!this.numberTagFaceCamera) tr.setLocalRotation(quat.quatIdentity());
  }

  private prefabForObjectType(type: string): ObjectPrefab {
    if (type === "cone" && this.conePrefab) return this.conePrefab;
    if ((type === "pole" || type === "equestrian-pole") && this.polePrefab) return this.polePrefab;
    if ((type === "barrel" || type === "wooden-barrel") && this.barrelPrefab) return this.barrelPrefab;
    if ((type === "vertical" || type === "jump" || type === "fence" || type === "equestrian-vertical") && this.verticalPrefab) return this.verticalPrefab;
    if ((type === "cavaletti" || type === "equestrian-cavaletti") && this.cavalettiPrefab) return this.cavalettiPrefab;
    if ((type === "stop" || type === "pause" || type === "pause-zone" || type === "stop-zone" || type === "pause_zone") && this.pauseZonePrefab) return this.pauseZonePrefab;
    if ((type === "startline" || type === "start-line" || type === "start") && this.startLinePrefab) return this.startLinePrefab;
    if ((type === "finishline" || type === "finish-line" || type === "finish") && this.finishLinePrefab) return this.finishLinePrefab;
    if (this.defaultObstaclePrefab) return this.defaultObstaclePrefab;
    return null;
  }

  private norm(v: any): string {
    return (v === undefined || v === null ? "" : (v + "")).trim().toLowerCase().replace(/_/g, "-");
  }

  private onUpdate() {
    if (!this.camera) return;
    const camPos = this.camera.getTransform().getWorldPosition();

    // Billboard each floating number toward the wearer (yaw only, stays upright).
    if (this.numberTagFaceCamera) {
      const yawOff = (this.numberTagYawOffsetDeg * Math.PI) / 180;
      for (const k in this.liveNumberTags) {
        const so = this.liveNumberTags[k].so;
        const p = so.getTransform().getWorldPosition();
        const dx = camPos.x - p.x;
        const dz = camPos.z - p.z;
        if (dx * dx + dz * dz > 0.0001) {
          const yaw = Math.atan2(dx, dz) + yawOff;
          so.getTransform().setWorldRotation(quat.angleAxis(yaw, vec3.up()));
        }
      }
    }

    // Proximity sound — solid obstacles only; number tags are intentionally excluded.
    if (!this.alertAudio) return;
    const radius = this.proximityRadiusMeters * 100;
    const exitRadius = radius * 1.4;

    for (const k in this.liveObstacles) {
      const entry = this.liveObstacles[k];
      const p = entry.so.getTransform().getWorldPosition();
      const dx = camPos.x - p.x;
      const dz = camPos.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (!entry.inside && dist < radius) {
        entry.inside = true;
        this.alertAudio.play(1);
      } else if (entry.inside && dist > exitRadius) {
        entry.inside = false;
      }
    }
  }

  private log(m: string) {
    if (this.enableLogging) print("[ArenaStreamerTyped] " + m);
  }
}