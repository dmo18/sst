export class RequestOwnership {
    private active?: AbortController;
    private sequence = 0;
    begin(): {
        controller: AbortController;
        sequence: number;
    } | undefined { if (this.active)
        return; const controller = new AbortController(); this.active = controller; return { controller, sequence: ++this.sequence }; }
    owns(controller: AbortController, sequence: number): boolean { return this.active === controller && this.sequence === sequence && !controller.signal.aborted; }
    finish(controller: AbortController): void { if (this.active === controller)
        this.active = undefined; }
    cancel(): void { const owned = this.active; this.active = undefined; owned?.abort(); }
}
