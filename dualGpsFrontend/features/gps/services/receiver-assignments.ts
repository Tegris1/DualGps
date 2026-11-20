// Shared by the two receiver controllers, including pending native connections.
export class ReceiverAssignments {
  private readonly addresses = new Set<string>();

  reserve(address: string): (() => void) | null {
    const key = address.toUpperCase();
    if (this.addresses.has(key)) return null;
    this.addresses.add(key);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.addresses.delete(key);
    };
  }
}
