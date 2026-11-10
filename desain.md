# ConDeck --- UI/UX Design Specification

**Document:** `desain.md`\
**Project:** ConDeck --- Virtual Stream Deck for Windows\
**Scope:** Redesign keseluruhan UI menjadi interactive 3D Stream Deck\
**Status:** Design proposal for implementation\
**Primary platform:** Windows Desktop (Electron + React)\
**Visual reference:** `Meshy_AI_streamdeck_concept.png` and current
ConDeck sidebar screenshot

------------------------------------------------------------------------

## 1. Product Vision

ConDeck should feel like a virtual hardware Stream Deck, not a
conventional admin dashboard.

The primary screen presents a single interactive 3D Stream Deck device
as the visual focus. Users interact directly with its physical-looking
buttons. Configuration tools appear only when needed, keeping the
default experience clean and distraction-free.

The application must retain the existing ConDeck capabilities and
backend integrations. This is a UI/UX redesign, not a rewrite of the
Action Engine, profile system, database, OBS integration, or mobile
remote architecture.

### Core principles

1.  **Device-first:** The virtual Stream Deck is the main interface.
2.  **Clean by default:** No permanent sidebar, dashboard cards, or
    always-visible properties panel on the main screen.
3.  **Progressive disclosure:** Menus and properties appear only when
    requested.
4.  **Direct manipulation:** Click a physical-looking button to select
    and configure it.
5.  **Flexible layout:** Users can configure the number of rows and
    columns rather than being restricted to 3×3.
6.  **Preserve existing functionality:** Existing actions, profiles,
    integrations, logs, and remote-device features must continue to
    work.
7.  **Responsive and usable:** The interface must remain practical at
    different window sizes and display scales.

------------------------------------------------------------------------

## 2. Main Application Layout

### 2.1 Default state

The default screen should contain only:

-   A compact top bar or floating hamburger button.
-   The ConDeck 3D device, centered in the available workspace.
-   Optional small status indicators, such as active profile and OBS
    connection state, only if they do not compete with the device.

Do not show the old permanent left sidebar.

The 3D device should be the dominant visual element. Use a dark, neutral
background with subtle gradients and restrained ambient lighting. Avoid
excessive neon, glass effects, decorative cards, and unnecessary
dashboard widgets.

### 2.2 Suggested layout

``` text
┌─────────────────────────────────────────────────────────────┐
│  [☰]                                      [Profile] [Status] │
│                                                             │
│                                                             │
│                    ┌─────────────────────┐                  │
│                    │                     │                  │
│                    │   3D STREAM DECK    │                  │
│                    │                     │                  │
│                    │   [ ][ ][ ][ ]      │                  │
│                    │   [ ][ ][ ][ ]      │                  │
│                    │   [ ][ ][ ][ ]      │                  │
│                    │                     │                  │
│                    └─────────────────────┘                  │
│                                                             │
│                 [Optional zoom controls]                    │
└─────────────────────────────────────────────────────────────┘
```

This is a structural guide, not a pixel-perfect mockup.

### 2.3 Hamburger navigation

Place a hamburger icon in the upper-left corner.

On click, open a compact drawer or floating navigation panel. The menu
should contain:

-   Dashboard / Overview
-   My Deck
-   Profiles
-   Integrations
-   Remote Devices
-   Activity Logs
-   Settings

The menu should:

-   Overlay the workspace rather than permanently occupy screen width.
-   Close when the user selects a destination, clicks outside, or
    presses Escape.
-   Clearly indicate the active destination.
-   Use the existing routes/pages wherever possible.
-   Avoid duplicating navigation logic.

The device view should remain the default landing page. The existing
Dashboard can remain accessible from the hamburger menu.

------------------------------------------------------------------------

## 3. Interactive 3D Stream Deck

### 3.1 Device appearance

Use the supplied 3D Stream Deck image as the visual direction:

-   Matte black or graphite chassis.
-   Slightly raised, beveled physical buttons.
-   Perspective view from a front three-quarter angle.
-   Subtle shadows and ambient occlusion.
-   Controlled RGB illumination around buttons.
-   Clear labels and recognizable icons.
-   Realistic depth without making the interface visually noisy.

The device should be centered and scale to the available workspace. Keep
enough margin around it so the device does not touch the window edges.

### 3.2 Recommended implementation approach

Prefer a real-time 3D scene using **Three.js with React Three Fiber**
(and Drei helpers where useful), provided the implementation remains
compatible with the current Electron + Vite setup.

The 3D scene should consist of:

-   A chassis mesh.
-   Individual button meshes.
-   Button face materials.
-   Optional emissive edge/light treatment.
-   Camera, lighting, and shadows.

Each button must be an independent interactive object. Use
raycasting/pointer events to identify which button was clicked.

Do not use the supplied reference image as one flat background with
invisible click regions. The final result must behave like an actual
interactive device.

If a full 3D implementation causes unacceptable performance or
complexity, a CSS 3D / 2.5D implementation may be used as a fallback,
but the device and buttons must still be individually interactive.

### 3.3 Camera and interaction

Default camera:

-   Front three-quarter perspective.
-   Device centered.
-   No automatic camera movement.
-   No excessive perspective distortion.

Optional interaction:

-   Gentle hover feedback on a button.
-   Subtle press animation on click.
-   Limited orbit/rotation only if it does not make button selection
    difficult.
-   Zoom in/out controls if needed.

Do not allow free camera movement to make the device disappear, flip
upside down, or become difficult to use. Provide a reset-view action if
camera controls are implemented.

### 3.4 Button visual states

Each button should support these visual states:

  -----------------------------------------------------------------------
  State                               Appearance
  ----------------------------------- -----------------------------------
  Idle                                Normal button material and subtle
                                      edge lighting

  Hover                               Slightly brighter edge and small
                                      elevation

  Selected                            Clear selection outline or stronger
                                      glow

  Pressed                             Brief downward press animation

  Configured                          Displays assigned icon and label

  Empty                               Neutral placeholder appearance with
                                      an add indicator on hover

  Disabled                            Reduced brightness and clear
                                      disabled treatment
  -----------------------------------------------------------------------

Do not rely on color alone to communicate state.

------------------------------------------------------------------------

## 4. Flexible Grid System

The grid must not be hardcoded to 3×3.

### 4.1 User-configurable dimensions

Allow the user to configure:

-   Number of columns.
-   Number of rows.
-   Button spacing.
-   Button size, within supported limits.
-   Optional layout preset.

Provide an **Edit Layout** or **Deck Layout** action in the device
toolbar or hamburger menu.

### 4.2 No fixed 3×3 limitation

The layout system should support configurable dimensions and must not
assume a fixed number of buttons in components, database queries, or UI
rendering.

Use a data-driven grid. Render buttons from the active profile/page
configuration.

The UI should support larger layouts through:

-   Responsive device scaling.
-   Camera zoom or device zoom.
-   Scroll/pan when the configured layout exceeds the visible workspace.
-   A clear reset-to-fit action.

Do not shrink buttons indefinitely to fit every possible layout.
Maintain a practical minimum button size and switch to zoom/scroll
behavior when necessary.

### 4.3 Add, remove, and reorder buttons

Users should be able to:

-   Add a button to an empty slot.
-   Configure an existing button.
-   Clear or remove a button assignment.
-   Move/reorder buttons, if supported by the existing data model.
-   Add or remove rows and columns.
-   Preserve button assignments when changing grid dimensions where
    possible.

When reducing rows or columns, warn the user if occupied slots would be
removed. Never silently discard configured actions.

### 4.4 Layout persistence

Grid dimensions and button positions should persist with the appropriate
deck page/profile configuration.

Before implementation, inspect the existing database schema and
profile/page model. Extend the existing model through migrations if
required. Do not create a parallel configuration store or hardcode
layout dimensions in the renderer.

------------------------------------------------------------------------

## 5. Button Properties Panel

### 5.1 Opening behavior

The properties panel must be hidden by default.

When the user clicks a 3D button:

1.  Mark the clicked button as selected.
2.  Show a Properties panel.
3.  Display the selected button's current configuration.
4.  Allow the user to edit the configuration.
5.  Save changes using the existing application data flow.

Clicking another button should switch the selection and update the
panel.

Clicking the selected button again may close the panel, but this
behavior must be consistent and should not cause accidental loss of
unsaved changes.

### 5.2 Panel presentation

Use a floating panel or side sheet that overlays the workspace. It
should not permanently resize the device or bring back the old sidebar
layout.

Suggested panel structure:

``` text
┌────────────────────────────────┐
│ Button Properties          [×] │
│ Slot 04                        │
├────────────────────────────────┤
│ Preview                         │
│ [ Icon ]  Button label          │
│                                │
│ Label                          │
│ [________________________]     │
│                                │
│ Icon                           │
│ [ Choose icon ]                │
│                                │
│ Action                         │
│ [ Select action          ▼ ]   │
│                                │
│ Action settings                │
│ [ Existing action fields ]     │
│                                │
│ Button appearance              │
│ [ Color ] [ Glow ]              │
│                                │
│ [ Clear ]             [ Save ]  │
└────────────────────────────────┘
```

### 5.3 Properties fields

Reuse the existing button editor and Action Engine capabilities. The
panel should expose only fields supported by the selected action type.

Potential fields, subject to existing model support:

-   Button label.
-   Icon selection.
-   Action type.
-   Action-specific settings.
-   Button color.
-   Glow/emissive intensity.
-   Optional confirmation behavior.
-   Shortcut or hotkey settings, if already supported.

Do not invent new action types or claim a field is supported before
verifying the existing Action Engine.

### 5.4 Empty button behavior

Clicking an empty slot should open the same Properties panel in an **Add
Button** state.

The panel should allow the user to assign an action and configure the
button. It should not require a separate legacy editor page.

### 5.5 Save and cancel

-   Save persists changes through the existing data layer.
-   Cancel/close should preserve the last saved configuration.
-   If there are unsaved changes, ask before discarding them.
-   Show a concise success or error state.
-   Avoid saving every keystroke unless the current architecture
    explicitly uses safe autosave.

------------------------------------------------------------------------

## 6. Device Toolbar

A small toolbar may appear near the device when the user hovers over the
device or enters edit mode.

Suggested controls:

-   Active profile/page selector.
-   Edit Layout.
-   Zoom in.
-   Zoom out.
-   Fit to screen.
-   Reset view.

Keep the toolbar compact. Do not turn it into a second navigation bar.

The active profile and page must continue to use the existing
profile/page system.

------------------------------------------------------------------------

## 7. Existing Application Pages

The redesign must not remove existing application capabilities.

### My Deck

-   Becomes the default device-first 3D workspace.
-   Shows the active deck page as a 3D device.
-   Supports button selection and properties editing.
-   Supports flexible grid dimensions.

### Dashboard

-   Remains accessible from the hamburger menu.
-   May be simplified into an overview/status page.
-   Must not replace the device-first landing screen.

### Profiles

-   Retain profile creation, activation, and management.
-   Selecting a profile should update the active deck shown in the main
    workspace.

### Integrations

-   Retain OBS integration and connection configuration.
-   Display connection status in a compact, unobtrusive way where
    appropriate.

### Remote Devices

-   Retain device pairing, QR code, and authorization workflows.
-   Keep the page accessible from the hamburger menu.

### Activity Logs

-   Retain activity history and existing log functionality.

### Settings

-   Retain application settings.
-   Include visual/device preferences only where supported, such as
    default zoom or preferred device view.

All existing navigation destinations and functionality must be checked
before implementation. Do not delete existing pages simply because the
main UI is changing.

------------------------------------------------------------------------

## 8. Visual Design System

### 8.1 Overall style

-   Dark graphite / near-black background.
-   Matte black device body.
-   Restrained purple accent inspired by the current ConDeck identity.
-   RGB button colors used primarily to represent button customization,
    not as decoration everywhere.
-   Subtle shadows and depth.
-   Clean typography with clear hierarchy.

### 8.2 Suggested design tokens

These are starting values; refine them against the running application.

  Token               Suggested value
  ------------------- --------------------------
  App background      `#0B0D12`
  Secondary surface   `#11151D`
  Elevated surface    `#191F2A`
  Primary text        `#F4F6FA`
  Secondary text      `#929BAA`
  Accent              `#7657FF`
  Border              `rgba(255,255,255,0.09)`
  Device body         `#17191E`
  Button face         `#10141B`

Avoid excessive gradients, blur, neon outlines, and glassmorphism. The
physical device should provide the visual depth.

### 8.3 Motion

Use short, restrained transitions:

-   Button hover: approximately 120--180 ms.
-   Button press: approximately 100--160 ms.
-   Properties panel: approximately 180--240 ms.
-   Navigation drawer: approximately 180--240 ms.

Respect reduced-motion preferences. Avoid continuous idle animations
that distract or waste GPU resources.

------------------------------------------------------------------------

## 9. Technical Architecture and Constraints

### 9.1 Preserve existing architecture

Before coding, inspect:

-   Current React renderer structure.
-   Existing routing/navigation.
-   Deck, page, profile, and button data models.
-   Button editor components.
-   Action Engine interfaces.
-   Database schema and migrations.
-   Existing state management.
-   Electron security boundaries and preload API.

Reuse existing components and services where possible.

### 9.2 3D rendering boundary

Keep 3D rendering isolated in a dedicated component/module, for example:

``` text
apps/desktop/src/
  components/
    stream-deck/
      StreamDeckScene.tsx
      StreamDeckDevice.tsx
      StreamDeckButton3D.tsx
      StreamDeckToolbar.tsx
      ButtonPropertiesPanel.tsx
      DeckLayoutEditor.tsx
```

This is a suggested organization only. Follow the actual repository
conventions if they differ.

The 3D scene should receive serializable deck/page/button data and emit
user interactions such as:

-   Button selected.
-   Empty slot selected.
-   Button pressed.
-   Layout changed.
-   View reset.

Do not put database access or Electron privileged APIs inside 3D mesh
components.

### 9.3 Performance

-   Avoid recreating the full 3D scene on every text-field keystroke.
-   Use stable keys for button meshes.
-   Update only affected button materials/state where practical.
-   Dispose of geometries, materials, and textures when no longer
    needed.
-   Avoid unnecessary real-time shadows or expensive post-processing.
-   Test with larger grids, not only a 3×3 layout.
-   Provide a graceful fallback if WebGL is unavailable.

### 9.4 Security

Preserve Electron's existing security model:

-   Keep `contextIsolation` enabled.
-   Keep `nodeIntegration` disabled.
-   Use the existing preload bridge for privileged operations.
-   Do not expose raw Node.js or database access to renderer components.

------------------------------------------------------------------------

## 10. Interaction and Acceptance Criteria

The redesign is not complete until all of the following are verified.

### Main workspace

-   [ ] The application opens directly into the 3D Stream Deck
    workspace.
-   [ ] No permanent left sidebar is visible.
-   [ ] Hamburger navigation opens and closes correctly.
-   [ ] Navigation still reaches all existing pages.
-   [ ] The device is centered and scales correctly.

### 3D device

-   [ ] Chassis and individual buttons render as a 3D device.
-   [ ] Each button can be individually hovered and selected.
-   [ ] Button labels and icons match the saved configuration.
-   [ ] Selected and pressed states are visually distinct.
-   [ ] Clicking a configured button in edit mode selects it without
    accidentally executing its action.
-   [ ] Actual action execution remains available in the appropriate
    normal/operational mode.

### Properties

-   [ ] Properties panel is hidden initially.
-   [ ] Clicking a configured button opens its properties.
-   [ ] Clicking an empty slot opens Add Button mode.
-   [ ] Switching selection updates the panel.
-   [ ] Save persists the configuration.
-   [ ] Cancel and unsaved-change handling work.
-   [ ] Existing Action Engine action types remain functional.

### Flexible layout

-   [ ] User can change row count.
-   [ ] User can change column count.
-   [ ] Grid is not hardcoded to 3×3.
-   [ ] Buttons remain associated with the correct slots after layout
    changes.
-   [ ] Reducing dimensions warns about occupied slots that would be
    removed.
-   [ ] Larger layouts can be navigated using zoom/scroll/pan or an
    equivalent fit strategy.
-   [ ] Layout persists after application restart.

### Regression

-   [ ] Profiles still work.
-   [ ] OBS integration still works.
-   [ ] Remote Devices and pairing still work.
-   [ ] Activity Logs still work.
-   [ ] Settings still work.
-   [ ] Existing database records and user data are preserved.
-   [ ] Windows development and production builds succeed.

------------------------------------------------------------------------

## 11. Implementation Plan

Implement in small, reviewable steps. Do not replace the entire
application in one pass.

### Step 1 --- Repository inspection

-   Inspect existing UI structure and data flow.
-   Identify the current My Deck screen and button editor.
-   Identify the existing profile/page/grid data model.
-   Identify which parts can be reused.
-   Report any schema limitations before changing them.

**Deliverable:** A short implementation map and list of files expected
to change.

### Step 2 --- Main workspace shell

-   Replace the permanent sidebar on the main workspace with hamburger
    navigation.
-   Make the device-first workspace the default landing screen.
-   Preserve access to all existing pages.

**Deliverable:** Clean main workspace with working navigation.

### Step 3 --- 3D device prototype

-   Add the 3D scene and chassis.
-   Render data-driven individual buttons.
-   Add hover, selected, and pressed states.
-   Connect button selection events to React state.

**Deliverable:** Interactive 3D device using real deck data, not a
static reference image.

### Step 4 --- Properties panel

-   Open the panel only after selecting a button.
-   Reuse existing button editor/action configuration logic.
-   Support empty-slot Add Button mode.
-   Persist through existing application services.

**Deliverable:** End-to-end button editing from the 3D workspace.

### Step 5 --- Flexible layout

-   Add configurable rows and columns.
-   Preserve button positions and assignments.
-   Add occupied-slot warnings.
-   Add fit/zoom/scroll behavior for larger layouts.
-   Persist layout using the existing profile/page model or a safe
    migration.

**Deliverable:** User-configurable grid without a fixed 3×3 assumption.

### Step 6 --- Polish and regression testing

-   Refine lighting, materials, spacing, and animation.
-   Test different window sizes and display scaling.
-   Test larger grids.
-   Test all existing application modules.
-   Test WebGL fallback and performance.
-   Build and run the Windows application.

**Deliverable:** A stable, usable 3D ConDeck interface.

------------------------------------------------------------------------

## 12. Instructions for the Implementation Agent

Treat this document as the UI/UX target, not permission to rewrite
unrelated parts of the project.

1.  Work from the current GitHub repository and the latest `main`
    branch.
2.  Read the existing project documentation and inspect the current code
    before making changes.
3.  Do not assume the database schema or action model; verify them.
4.  Preserve existing features, data, integrations, and Electron
    security.
5.  Do not replace the Stream Deck with a static image.
6.  Do not hardcode a 3×3 grid.
7.  Do not show the Properties panel until a button is selected.
8.  Do not keep the old permanent sidebar on the main workspace.
9.  Do not invent unsupported action types or silently discard existing
    button assignments.
10. Implement in small steps and run the relevant typecheck, tests, and
    Windows build checks.
11. Report new dependencies and why they are needed before adding them.
12. If a requirement conflicts with the existing architecture, explain
    the conflict and propose the smallest safe change rather than
    silently rewriting the architecture.

**Final objective:** When ConDeck opens, the user sees a clean,
realistic, interactive 3D Stream Deck. The hamburger menu provides
access to the rest of the application, and selecting a physical-looking
button reveals its configuration panel. The grid is flexible and
data-driven, while all existing ConDeck functionality remains intact.
