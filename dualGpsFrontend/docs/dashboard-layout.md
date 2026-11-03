# Dashboard orientation and layout

The app's [orientation setting](../app.json) allows portrait and landscape rotation, subject to the device's rotation settings.

The dashboard adapts to the usable screen dimensions, including safe-area insets and font scaling:

- Narrow screens stack the summary cards, terrain preview, and cross-section with scrolling.
- Wide screens place the summary cards and workspace panels side by side.
- Wide screens below 600 logical pixels in usable height use compact cards, a shorter chart, and a smaller toolbar when the font scale is at most 1.15.
- Larger text uses the regular layout with scrolling instead of shrinking its controls into the compact layout.

The compact toolbar retains 44-pixel minimum touch targets and accessible hints. Terrain filenames and full descriptions remain available through **Menu > Warstwy** and the terrain picker. The terrain and camera controllers stay mounted across orientation changes, preserving the selected surfaces and camera state.

The online toolbar provides **Połączenie**, **Ustawienia**, **Wyloguj**, and **Menu**. Camera, layer, and reset actions are available inside Menu. **Powrót** in camera and layer panels reopens Menu; **Połączenie** opens **Ustawienia > Debug**, while **Ustawienia** opens the Bluetooth section. The old connection setup screen has been removed. **Powrót** in settings returns to the dashboard. The built-in Home / Connection Setup / Settings tab bar is hidden on every screen; the dashboard keeps its own toolbar. Leaving the dashboard unmounts its native graphics canvas; returning creates a fresh graphics context while retaining the selected models, layer settings, and camera position.

## Updating an existing Android build

From `dualGpsFrontend`, with JDK 17 configured:

```powershell
npx expo prebuild --platform android --no-install
npx expo run:android
```

Prebuild synchronizes the orientation setting into the existing native project. Restarting Metro alone does not update the installed app's native orientation setting. The generated Android project is ignored by Git; commit `app.json` and the dashboard source changes.

## Device checks

After rebuilding, enable device auto-rotation and check portrait and landscape, with and without selected terrain. Rotate after moving the camera and hiding a layer; both settings should persist. Open **Menu > Widok** and **Menu > Warstwy** in both orientations, and check the larger-text scrolling layout.

Drag one finger inside the 3D viewport to orbit the camera in both axes. Small taps and movement outside that viewport retain their normal behavior. Camera elevation is bounded above the horizon; **Reset** restores the initial position, and **Menu > Widok** retains button controls for rotation and zoom.
