# Solar-Tool Architecture Guidelines

## Critical Principles for Future Development

### 1. State Isolation Principle
**NEVER modify main Grid properties during calculations or auxiliary operations.**

❌ **BAD:**
```js
async auxiliaryCalculation() {
  this.rows = temporaryValue;     // Corrupts main state!
  this.cols = otherValue;         // Race condition risk!
  const result = await calculate();
  this.rows = originalValue;      // Async timing issues!
}
```

✅ **GOOD:**
```js
async auxiliaryCalculation() {
  const isolatedData = {
    rows: temporaryValue,         // Isolated parameters
    cols: otherValue,
    selection: [...this.selection] // Deep copies
  };
  const result = await calculateWithIsolatedData(isolatedData);
}
```

### 2. Data Flow Separation
**Separate Read-Only operations from State-Modifying operations.**

- **Read-Only:** Summary calculations, PDF generation, analytics
- **State-Modifying:** User interactions, configuration loading, grid modifications

### 3. Race Condition Prevention
**Any async operation that reads Grid state must use snapshots.**

```js
// Take snapshot at function start
const stateSnapshot = {
  rows: this.rows,
  cols: this.cols,
  selection: this.selection.map(row => [...row])
};

// Use snapshot for all calculations
await processWithSnapshot(stateSnapshot);
```

### 4. Configuration Management Best Practices

#### Safe Configuration Loading:
```js
loadConfig(idx) {
  // 1. Save current if needed
  if (this.currentConfig !== null) {
    this.updateConfig();
  }
  
  // 2. Load new config data
  const config = this.configs[idx];
  this.currentConfig = idx;
  
  // 3. Apply state changes atomically
  this.applyConfigState(config);
  
  // 4. Update UI last
  this.updateUI();
}
```

#### Atomic State Updates:
```js
applyConfigState(config) {
  // Apply all changes together to prevent partial states
  this.rows = config.rows;
  this.cols = config.cols;
  this.selection = config.selection.map(row => [...row]);
  this.wIn.value = config.cellWidth;
  this.hIn.value = config.cellHeight;
  // ... all other properties
}
```

### 5. Function Responsibility Boundaries

#### Clear Separation:
- **renderProductSummary():** ONLY calculates and displays summary
- **loadConfig():** ONLY manages configuration switching
- **updateConfig():** ONLY saves current state to configs array
- **calculateParts():** ONLY performs calculations with given parameters

#### No Cross-Concerns:
❌ Don't let display functions modify core state
❌ Don't let calculation functions trigger UI updates
❌ Don't let async operations interfere with synchronous state

### 6. Testing Anti-Patterns

#### Common Issues to Test For:
1. **Configuration Cross-Contamination:** Switch configs rapidly, verify each maintains unique data
2. **Race Conditions:** Trigger async operations during config switches
3. **State Corruption:** Verify that display updates don't affect stored configs
4. **Memory Leaks:** Ensure deep copies prevent reference sharing

### 7. Code Review Checklist

Before merging any changes that touch Grid state:

- [ ] Does this function modify `this.rows`, `this.cols`, `this.selection`?
- [ ] If yes, is it the primary responsibility of this function?
- [ ] Are all modifications atomic (all-or-nothing)?
- [ ] Are there any async operations between state reads and writes?
- [ ] Are temporary values properly isolated from main state?
- [ ] Is error handling robust (try/finally for state restoration)?

### 8. Future Architecture Considerations

#### Potential Improvements:
1. **State Manager Class:** Centralize all state operations
2. **Immutable State:** Use immutable data structures
3. **Event System:** Decouple components with events instead of direct calls
4. **Configuration Validation:** Ensure configs have required properties
5. **Type Safety:** Add TypeScript for better compile-time checks

### 9. Emergency Debugging Guide

#### When configurations are corrupted:
1. Check if any async function modifies `this.rows/cols/selection`
2. Look for race conditions between `loadConfig()` and calculations
3. Verify `updateConfig()` isn't called during temporary state changes
4. Check for missing `finally` blocks in state-modifying operations

#### Red Flags in Code:
- `this.rows =` inside calculation functions
- Missing `finally` blocks after `this.selection =`
- Async operations without state snapshots
- Direct property assignments during display updates

---

## Summary

The core principle is **separation of concerns with strict state isolation**. Summary calculations, PDF generation, and other auxiliary operations must NEVER modify the main Grid state directly. Instead, they should work with isolated copies of the data.

This prevents race conditions, configuration corruption, and makes the codebase more maintainable and debuggable.