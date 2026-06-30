import { ArenaStreamerTyped } from "./ArenaStreamerTyped";
import { PinchButton } from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton";

@component
export class RefreshButtonTyped extends BaseScriptComponent {
  @input pinchButton: PinchButton;
  @input arenaStreamer: ArenaStreamerTyped;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.pinchButton || !this.arenaStreamer) {
        print("[RefreshButtonTyped] Assign pinchButton and arenaStreamer.");
        return;
      }
      this.pinchButton.onButtonPinched.add(() => this.arenaStreamer.refresh());
    });
  }
}
