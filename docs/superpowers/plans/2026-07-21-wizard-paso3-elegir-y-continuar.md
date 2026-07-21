# Paso 3 (Internet) del wizard — click expande, botón explícito para avanzar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Internet-plan step of the "elegir plan" wizard, clicking a plan card expands its details instead of immediately selecting the plan and advancing; a new "Elegir y continuar" button inside the expanded details is the only way to advance. Only one card can be expanded at a time (accordion).

**Architecture:** `OptionCard.svelte` gets an optional "controlled expand" mode (`expanded` + `onToggleExpand` props) used only when the card has `details`; when controlled, whole-card click/Enter/Space toggles expand instead of firing `onclick`, and a new button inside the expanded block fires `onclick`. `Step3Internet.svelte` owns a single `expandedPlan` key in local state and wires it into each `OptionCard` to get accordion behavior. No other step (`Step1Tipo`, `Step5Adicionales`, `Step4TV`) is touched — they don't pass `details`/`expanded`, so `OptionCard`'s existing uncontrolled behavior is unchanged for them.

**Tech Stack:** Svelte 5 (runes: `$state`, `$props`, `$derived`), Vitest for `data.js`/`data.test.js` (unaffected here), Playwright/browser MCP for manual verification (no existing component-test harness for `OptionCard`/`Step3Internet` — see spec's Testing section).

**Spec:** `docs/superpowers/specs/2026-07-21-wizard-paso3-elegir-y-continuar-design.md`

---

### Task 1: Add controlled-expand mode + "Elegir y continuar" button to `OptionCard`

**Files:**
- Modify: `src/lib/components/elegirplan/OptionCard.svelte`

- [ ] **Step 1: Add the new props**

In the `$props()` destructure (currently lines 9-27), add `expanded`, `onToggleExpand`, and `ctaLabel`:

```js
let {
    title,
    subtitle = '',
    subtitleStrong = false,
    price = '',
    tag = '',
    logo = '',
    icon = '',
    features = [],
    details = [],
    selected = false,
    multi = false,
    showCheck = true,
    disabled = false,
    onclick,
    onSymmetricInfo = null,
    // Controlled-expand mode: pass both to let the parent own expand state
    // (e.g. accordion across a list of cards). If either is omitted, the
    // card manages its own internal `expanded` state (existing behavior).
    expanded: expandedProp = undefined,
    onToggleExpand = null,
    ctaLabel = 'Elegir y continuar'
} = $props();
```

- [ ] **Step 2: Derive the effective expanded state and a single toggle function**

Replace the existing `let expanded = $state(false);` (line 30) with:

```js
let consultar = $derived(price === 'Consultar');

let isControlled = $derived(onToggleExpand !== null);
let internalExpanded = $state(false);
let expanded = $derived(isControlled ? !!expandedProp : internalExpanded);

function toggleExpanded() {
    if (isControlled) {
        onToggleExpand();
    } else {
        internalExpanded = !internalExpanded;
    }
}
```

Remove the old `toggleDetails` function (lines 42-45) — it's replaced by `toggleExpanded`. Update its one call site (the "Más información" button's `onclick`, currently `onclick={toggleDetails}` around line 82) to `onclick={(e) => { e.stopPropagation(); toggleExpanded(); }}` (the button already stopped propagation via the old `toggleDetails`'s first line — keep that behavior inline now that the function no longer takes the event).

- [ ] **Step 3: Make the whole-card click/keyboard toggle expand when there are `details`, otherwise keep firing `onclick`**

Replace the outer `<div class="opt" ...>` handlers (lines 48-58):

```svelte
<div
    class="opt"
    class:selected
    class:disabled
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-pressed={selected}
    aria-disabled={disabled}
    onclick={() => { if (disabled) return; details.length ? toggleExpanded() : onclick?.(); }}
    onkeydown={handleKey}
>
```

And update `handleKey` (lines 32-40) to match:

```js
function handleKey(e) {
    if (disabled) return;
    // Ignorar teclas originadas en controles internos (ej. botón "Más información").
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        details.length ? toggleExpanded() : onclick?.();
    }
}
```

- [ ] **Step 4: Add the "Elegir y continuar" button inside the expanded details block**

The existing expanded block (lines 109-124):

```svelte
{#if details.length && expanded}
    <div class="details" transition:slide={{ duration: 200 }}>
        <ul class="detail-list">
            {#each details as d}<li>{d}</li>{/each}
        </ul>
        {#if onSymmetricInfo}
            <button
                class="sym-link"
                type="button"
                onclick={(e) => { e.stopPropagation(); onSymmetricInfo(); }}
            >
                ¿Qué es simétrico?
            </button>
        {/if}
    </div>
{/if}
```

becomes:

```svelte
{#if details.length && expanded}
    <div class="details" transition:slide={{ duration: 200 }}>
        <ul class="detail-list">
            {#each details as d}<li>{d}</li>{/each}
        </ul>
        {#if onSymmetricInfo}
            <button
                class="sym-link"
                type="button"
                onclick={(e) => { e.stopPropagation(); onSymmetricInfo(); }}
            >
                ¿Qué es simétrico?
            </button>
        {/if}
        <button
            class="btn-primary btn-full cta-confirm"
            type="button"
            onclick={(e) => { e.stopPropagation(); onclick?.(); }}
        >
            {ctaLabel}
        </button>
    </div>
{/if}
```

`.btn-primary`/`.btn-full` are global utility classes already used elsewhere in this wizard (e.g. `Step5Adicionales.svelte:26`) — confirm they're available globally (not scoped) by checking `src/lib/global.css` before relying on them; if they're scoped elsewhere instead, define equivalent local styles in the next step.

- [ ] **Step 5: Add a small top margin so the new button doesn't crowd the symmetric link / detail list**

Add to the `<style>` block, near `.sym-link` (around line 295-310):

```css
.cta-confirm {
    margin-top: 0.75rem;
}
```

- [ ] **Step 6: Verify no other consumer of `OptionCard` breaks**

Run: `grep -rn "OptionCard" src/lib/components/elegirplan/steps/`
Expected: `Step1Tipo.svelte` and `Step5Adicionales.svelte` don't pass `details`, `expanded`, or `onToggleExpand` — so `isControlled` is `false` for them and `details.length` is `0`, meaning their whole-card click still calls `onclick?.()` directly, unchanged from current behavior.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/elegirplan/OptionCard.svelte
git commit -m "feat: OptionCard soporta modo de expansión controlado y botón de confirmación"
```

---

### Task 2: Wire accordion expand state + confirm button into `Step3Internet`

**Files:**
- Modify: `src/lib/components/elegirplan/steps/Step3Internet.svelte`

- [ ] **Step 1: Add local accordion state**

In the `<script>` block (after the existing `let showSimetrico = $state(false);` on line 9), add:

```js
// Acordeón: solo un plan puede estar expandido a la vez.
let expandedPlan = $state(null);
```

- [ ] **Step 2: Wire the new props into the `OptionCard` loop**

Replace the `<OptionCard ... />` block (lines 32-43):

```svelte
<OptionCard
    title={plan.label}
    subtitle={speedLabel(plan.mb)}
    subtitleStrong={true}
    tag={plan.tag}
    price={formatPrice(wizard.precios[plan.key])}
    details={plan.features}
    showCheck={false}
    onSymmetricInfo={isSymmetric(plan) ? () => (showSimetrico = true) : null}
    selected={wizard.internetPlan === plan.key}
    expanded={expandedPlan === plan.key}
    onToggleExpand={() => (expandedPlan = expandedPlan === plan.key ? null : plan.key)}
    ctaLabel="Elegir y continuar"
    onclick={() => { setInternetPlan(plan.key); next(); }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/elegirplan/steps/Step3Internet.svelte
git commit -m "feat: Paso 3 del wizard expande info al click y confirma con botón explícito"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open the wizard**

Use the browser MCP's `preview_start` with the project's dev command (check `.claude/launch.json`; if absent, create it with `npm run dev`), then navigate to the route that mounts `ElegirPlanWizard.svelte` (check `src/routes/` for the page that renders it, e.g. via grep: `grep -rln "ElegirPlanWizard" src/routes/`).

- [ ] **Step 2: Drive to Paso 3 (Internet)**

From Paso 1, pick "Solo Internet" (or "Internet + TV" then skip promo if offered) to reach the Internet-plan step.

- [ ] **Step 3: Verify expand-on-click and accordion behavior**

Click a plan card body (not the price, not any button). Expected: the card expands showing its feature list and the new "Elegir y continuar" button; the wizard does NOT advance to the next step. Click a second card. Expected: the first collapses, the second expands (only one open at a time).

- [ ] **Step 4: Verify the confirm button advances**

With a card expanded, click "Elegir y continuar". Expected: wizard advances to the next step (Paso 4 TV or Adicionales depending on branch) with that plan selected.

- [ ] **Step 5: Verify keyboard interaction**

Tab to a collapsed card and press Enter or Space. Expected: it expands (does not advance). Tab into the "Elegir y continuar" button and press Enter. Expected: it advances.

- [ ] **Step 6: Verify Paso 1 and Paso 5 are unaffected**

Reload the wizard from the start. On Paso 1, click "Solo Internet" or "Internet + TV". Expected: advances immediately (no expand), same as before this change. Continue to Paso 5 (Adicionales) if reachable, click an addon card. Expected: toggles selection immediately (no expand), "Ver resumen" button still present.

- [ ] **Step 7: Check browser console for errors**

Use the browser MCP's `read_console_messages` with `onlyErrors: true`. Expected: no new errors introduced by this change.

---

## Self-Review Notes

- Spec coverage: controlled-expand mode ✓ (Task 1), accordion via parent-owned state ✓ (Task 1 + 2), "Elegir y continuar" button inside expanded block ✓ (Task 1 Step 4), Paso 1/5 unaffected ✓ (Task 1 Step 6, Task 3 Step 6), keyboard parity ✓ (Task 1 Step 3, Task 3 Step 5).
- No new automated tests added, matching the spec's Testing section: this component tree has no existing Svelte component test harness, so verification is manual/browser-based (Task 3).
