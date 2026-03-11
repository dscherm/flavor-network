# Spec: Walkthrough Demo Feature

## Overview
Interactive guided tour showing first-time users how to navigate and use the app.

## Trigger
- Auto-launches on first visit (localStorage flag `flavor-network-toured`)
- Manually re-triggered via "?" help button in bottom-right corner
- Can be dismissed at any step with "Skip Tour" button

## Tour Steps

### Step 1: Welcome
- Overlay: "Welcome to Flavor Network — a neural map of ingredient relationships"
- Brief: "Each glowing node is an ingredient. Connections show flavor pairings."
- Highlight: full 3D scene (dim overlay around it)

### Step 2: Navigation
- "Drag to rotate. Scroll to zoom. Shift+drag to pan."
- Prompt user to try rotating the scene
- Wait for user interaction (mousedown + mousemove) before advancing
- Highlight: 3D canvas

### Step 3: Explore a Node
- Auto-fly camera to a visually interesting ingredient (e.g., "garlic" — high connectivity)
- "Click any node to see its flavor profile"
- Auto-click garlic to demonstrate
- Highlight: the garlic node (pulse it)

### Step 4: Ingredient Panel
- "Here you'll find pairings, cuisines, taste profiles, and similar ingredients"
- Highlight: IngredientPanel sections one by one
- Point out "Similar Ingredients" powered by ML embeddings

### Step 5: Activation Spread
- "Notice how connected ingredients light up — brighter = stronger pairing"
- Highlight: activated neighbor nodes
- "This is the neural network in action"

### Step 6: Search
- "Use the search bar to find any ingredient instantly"
- Highlight: SearchBar
- Auto-type "basil" to demonstrate autocomplete
- Select result to show fly-to animation

### Step 7: Comparison Mode
- "Select two ingredients to see what they share"
- Demo: select basil + tomatoes, show shared pairings panel
- Highlight: comparison UI

### Step 8: Filters
- "Filter by cuisine, taste, or season to focus your exploration"
- Highlight: Controls panel
- Toggle a cuisine filter to demonstrate

### Step 9: Done
- "You're ready to explore! Click ? anytime to replay this tour."
- Set localStorage flag
- Dismiss overlay

## Implementation
- Use a lightweight step-based tour system (custom, not a library)
- Each step: { target: CSS selector or 3D object ID, content, position, action }
- Spotlight effect: dark overlay with cutout around highlighted element
- For 3D highlights: temporarily override node material to pulse/glow brighter
- Smooth transitions between steps (fade + camera moves)
- Progress dots at bottom of overlay
- "Next" / "Skip Tour" buttons on each step

## Responsive
- On mobile: steps are full-width bottom sheet instead of positioned tooltip
- Touch instructions instead of mouse ("Pinch to zoom, swipe to rotate")
