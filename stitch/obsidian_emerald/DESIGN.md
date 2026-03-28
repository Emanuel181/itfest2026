```markdown
# Design System Document: AI-Native IDE Architecture

## 1. Overview & Creative North Star
**Creative North Star: The Luminescent Obsidian**

This design system is built to transform the chaotic nature of software development into a focused, editorial experience. We reject the "dashboard fatigue" common in IDEs. Instead, we treat the code and its AI-generated insights as high-end content. 

The system moves beyond standard dark modes by utilizing **Tonal Depth** and **Asymmetric Balance**. We avoid a rigid, boxy grid in favor of "floating" functional zones. By emphasizing density in information but breathability in layout, we create a tool that feels like a premium workspace—intentional, quiet, and profoundly powerful.

---

## 2. Colors & Surface Logic

The color palette is rooted in absolute blacks and emerald luminaries. The goal is to minimize eye strain while highlighting the "living" parts of the code.

### The Palette
- **Core Background:** `surface` (#131313)
- **Primary Action:** `primary` (#4edea3) / `primary_container` (#10b981)
- **Secondary/Utility:** `secondary` (#c8c6c5)
- **Accents:** `tertiary` (#4ae176) for AI-suggested states.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for layout sectioning. In this system, boundaries are defined by **Background Color Shifts**.
- To separate a sidebar from the editor, place a `surface_container_low` panel against the `surface` background.
- Structural separation must be achieved through the `Spacing Scale` (using `spacing-4` or `spacing-6`) rather than lines.

### Surface Hierarchy & Nesting
Treat the UI as physical layers. Each deeper interaction level must rise in "altitude" using our container tokens:
1. **Base Layer:** `surface_dim` (#131313) - The primary IDE background.
2. **Intermediate Layer:** `surface_container` (#201f1f) - Used for sidebars or file trees.
3. **Active/Top Layer:** `surface_container_highest` (#353534) - Used for active code blocks or floating AI command palettes.

### The "Glass & Gradient" Rule
To add "soul" to the IDE, use **Glassmorphism** for transient elements (modals, hover cards). Apply `surface_container_low` at 70% opacity with a `backdrop-blur-md` effect. For primary CTAs, use a subtle linear gradient from `primary` (#4edea3) to `primary_container` (#10b981) at a 135-degree angle.

---

## 3. Typography: The Editorial Engineer

We pair the technical precision of **Inter** with the authoritative, slightly academic feel of **Roboto Slab**.

- **Display & Headlines (Roboto Slab):** Used for high-level project names and AI-generated summaries. It adds an "editorial" layer that makes the IDE feel like a curated publication of your logic.
- **Body & Labels (Inter):** The workhorse. Used for code, logs, and UI controls. Its high x-height ensures readability at small scales (`label-sm`: 0.6875rem).

| Level | Token | Font | Size | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Headline** | `headline-md` | Roboto Slab | 1.75rem | Major View Titles (e.g., "Architecture Overview") |
| **Title** | `title-sm` | Inter | 1rem | File names, Panel headers |
| **Body** | `body-md` | Inter | 0.875rem | Code snippets, standard descriptions |
| **Label** | `label-sm` | Inter | 0.6875rem | Metadata, Git hashes, line numbers |

---

## 4. Elevation & Depth

### The Layering Principle
Hierarchy is achieved by stacking tones. 
*Example:* A "Commit" card (`surface_container_lowest`) should sit inside a "Source Control" panel (`surface_container_low`). This creates a soft, natural inset effect without artificial drop shadows.

### Ambient Shadows
For floating elements like "AI Code Suggestions," use a signature shadow:
- **X/Y:** 0, 8px | **Blur:** 24px
- **Color:** `on_surface` (#e5e2e1) at 4% opacity. 
- This mimics natural light reflecting off a dark surface.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., input fields), use the **Ghost Border**:
- `outline_variant` (#3c4a42) at **20% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
- **Primary:** Gradient-filled (`primary` to `primary_container`), `rounded-xl`, with a subtle white inner-glow (top-edge) at 10% opacity.
- **Secondary:** `surface_container_high` background with `on_surface` text. No border.
- **Tertiary:** Transparent background, `primary` colored text.

### Input Fields & AI Prompts
- Use `surface_container_lowest` for the input area to create a "recessed" look.
- **Corners:** Always `rounded-xl` or `rounded-2xl`.
- **Focus State:** Instead of a thick border, use a 2px outer "glow" using `primary` at 30% opacity.

### AI Suggestion Chips
- **Aesthetic:** Glassmorphic backgrounds (`surface_bright` at 40% opacity).
- **Motion:** Suggestion chips should "float" with a 0.5s ease-in-out transition.

### Cards & Code Blocks
- **Prohibited:** Horizontal/Vertical dividers.
- **Separation:** Use `spacing-6` (1.3rem) of vertical white space or a subtle shift from `surface` to `surface_container_low`.

---

## 6. Do’s and Don'ts

### Do
*   **Do** use asymmetrical layouts for AI responses to distinguish them from human-written code.
*   **Do** use `rounded-2xl` for large containers to soften the "technical" edge of the IDE.
*   **Do** leverage the `tertiary` (#4ae176) green for anything AI-powered to create a mental map of "System" vs. "Intelligence."

### Don’t
*   **Don't** use 100% white (#FFFFFF). Always use `on_surface` (#FAFAFA/E5E2E1) to prevent "retina burn" in dark environments.
*   **Don't** use standard "drop shadows" on cards; stick to Tonal Layering.
*   **Don't** cram icons. If a label is clear, let the typography lead. This system is editorial, not purely symbolic.

---

## 7. Spacing Logic
Density is key for an SDLC tool, but it must be structured.
- **Outer Margins:** Always `spacing-6` (1.3rem).
- **Component Padding:** `spacing-4` (0.9rem) for internal card padding.
- **Tight Grouping:** `spacing-2` (0.4rem) for buttons and related metadata.