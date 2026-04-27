<!-- Static visual approximation of the Prezl IDE shell, used as the home-page
     hero image. Not a live editor — just colored spans inside a styled frame
     so the home page shows the kind of output the reader will get. Icons are
     inline SVG copies of the Lucide glyphs the real app uses. -->
<script setup lang="ts">
// No script behaviour — the component is purely presentational.
</script>

<template>
  <div class="prezl-hero">
   <div class="prezl-hero-inner">
    <!-- TopBar -->
    <div class="pz-titlebar">
      <div class="pz-tile">
        <svg viewBox="0 0 80 100" fill="currentColor">
          <path d="M29.29 0C21.759 0 14.233 2.806 8.54 8.42c-11.387 11.226-11.387 29.694 0 40.92l.662.654-.662.653c-11.387 11.227-11.387 29.706 0 40.933 11.386 11.227 30.113 11.227 41.5 0l.67-.661.15.148a9.159 9.03 0 0 0 12.956 0 9.159 9.03 0 0 0 0-12.775l-.15-.148 7.798-7.684a28.52 28.52 0 0 0 8.002-14.925 29 29 0 0 0-.666-13.8 28.5 28.5 0 0 0-7.336-12.208l-7.802-7.684.166-.163a9.159 9.03 0 0 0 0-12.775 9.159 9.03 0 0 0-12.952 0l-.17.167-.667-.653C44.346 2.806 36.821 0 29.29 0m0 17.9c2.79 0 5.58 1.092 7.797 3.278l.67.661L22.16 37.22l-.663-.653c-4.435-4.373-4.435-11.015 0-15.388C23.714 18.992 26.5 17.9 29.29 17.9m21.424 16.71 7.793 7.688c2.08 2.05 3.184 4.599 3.313 7.179q.013.259.012.517c0 2.754-1.107 5.505-3.325 7.692l-7.793 7.688-15.603-15.38zM22.159 62.764l15.599 15.384-.67.661c-4.436 4.373-11.157 4.373-15.592 0-4.435-4.372-4.435-11.019 0-15.391z"/>
        </svg>
      </div>
      <div class="pz-title">Dashboard Demo</div>
      <div class="pz-sep" />
      <div class="pz-branch">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
        </svg>
        <span>feature/dashboard-shell</span>
      </div>
      <div class="pz-spacer" />
      <div class="pz-run">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="6 3 20 12 6 21 6 3"/>
        </svg>
        <span>Run</span>
      </div>
      <div class="pz-winbtn" />
      <div class="pz-winbtn" />
      <div class="pz-winbtn close" />
    </div>

    <div class="pz-body">
      <!-- Explorer -->
      <div class="pz-explorer">
        <div class="pz-group-header">
          <svg class="pz-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="pz-glyph">TS</span>
          <span class="pz-groupname">Frontend</span>
        </div>
        <ul class="pz-files">
          <li>
            <svg class="pz-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            <svg class="pz-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v2"/><path d="M2 10h20"/></svg>
            <span>src</span>
          </li>
          <li class="indent">
            <svg class="pz-icon code-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5z"/></svg>
            <span>main.ts</span>
          </li>
          <li class="indent active">
            <svg class="pz-icon code-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5z"/></svg>
            <span>dashboard.ts</span>
          </li>
          <li class="indent">
            <svg class="pz-icon code-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5z"/></svg>
            <span>api.ts</span>
          </li>
        </ul>
      </div>

      <!-- Editor -->
      <div class="pz-editor">
        <div class="pz-tabs">
          <div class="pz-tab active">
            <span>dashboard.ts</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
          <div class="pz-tab">
            <span>main.ts</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </div>
        </div>
        <div class="pz-code">
          <div class="pz-line focus"><span class="ln">10</span><span class="kw">export</span> <span class="kw">function</span> <span class="fn">registerDashboard</span>(<span class="var">app</span>: <span class="type">App</span>) <span class="punct">{</span></div>
          <div class="pz-line focus"><span class="ln">11</span>  <span class="kw">const</span> <span class="var">dashboard</span> = <span class="fn">createDashboard</span>()</div>
          <div class="pz-line focus"><span class="ln">12</span>  <span class="var">dashboard</span>.<span class="fn">register</span>(<span class="var">app</span>)</div>
          <div class="pz-line"><span class="ln">13</span><span class="punct">}</span></div>
          <div class="pz-line"><span class="ln">14</span></div>
          <div class="pz-line collapsed"><span class="ln">15</span><span class="chev-sq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></span><span class="dim">…</span></div>
          <div class="pz-line"><span class="ln">24</span><span class="punct">}</span></div>
        </div>
      </div>
    </div>

    <!-- StatusBar -->
    <div class="pz-statusbar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
      <span>feature/dashboard-shell</span>
      <span class="dim">typescript</span>
      <span class="pz-spacer" />
      <span class="dim">Ready</span>
    </div>
   </div>
  </div>
</template>

<style scoped>
/* Every inline SVG defaults to 12x12 stroke-based glyph. Containers override
   size/color when needed. */
svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.pz-titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e1e22;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  padding: 0 8px;
  height: 34px;
  font-size: 11px;
}
.pz-tile {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.22);
  color: #a5b4fc;
}
.pz-tile svg { width: 13px; height: 13px; }
.pz-title { font-weight: 600; color: #e4e4e7; }
.pz-sep { width: 1px; height: 14px; background: rgba(148, 163, 184, 0.2); margin: 0 2px; }
.pz-branch { display: flex; align-items: center; gap: 5px; color: #a1a1aa; }
.pz-spacer { flex: 1; }
.pz-run {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #27272a;
  color: #e4e4e7;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 10px;
  border: 1px solid rgba(148, 163, 184, 0.14);
}
.pz-winbtn { width: 10px; height: 10px; border-radius: 50%; background: #52525b; margin-left: 4px; }
.pz-winbtn.close { background: #ef4444; }

.pz-body {
  display: grid;
  grid-template-columns: 185px 1fr;
  min-height: 0;
  height: calc(100% - 34px - 20px);
}

.pz-explorer {
  background: #1e1e22;
  padding: 4px 0;
  border-right: 1px solid rgba(148, 163, 184, 0.08);
  overflow: hidden;
}
.pz-group-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 5px 6px;
  border-left: 2px solid #818cf8;
  background: rgba(129, 140, 248, 0.05);
}
.pz-chev { color: #a1a1aa; }
.pz-glyph {
  display: inline-block;
  width: 18px;
  height: 14px;
  background: rgba(129, 140, 248, 0.22);
  color: #a5b4fc;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  line-height: 14px;
  border-radius: 2px;
}
.pz-groupname { color: #e4e4e7; font-weight: 600; }
.pz-files { list-style: none; padding: 2px 0 0; margin: 0; }
.pz-files li {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  color: #a1a1aa;
  font-size: 11px;
}
.pz-files li.indent { padding-left: 28px; }
.pz-files li.active { background: rgba(255, 255, 255, 0.04); color: #e4e4e7; }

.pz-icon { color: #a1a1aa; }
.pz-icon.folder { color: #a1a1aa; }
.pz-icon.code-blue { color: #60a5fa; }

.pz-editor { display: flex; flex-direction: column; background: #1a1a1e; min-height: 0; }
.pz-tabs { display: flex; border-bottom: 1px solid rgba(148, 163, 184, 0.08); }
.pz-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  color: #a1a1aa;
  border-right: 1px solid rgba(148, 163, 184, 0.08);
}
.pz-tab svg { color: #71717a; width: 10px; height: 10px; }
.pz-tab.active { background: #27272a; color: #e4e4e7; }

.pz-code { padding: 6px 0; overflow: hidden; }
/* white-space: pre preserves both single spaces between tokens and the
   leading indentation on lines 11/12. Flex would strip them — anonymous
   flex items that contain only whitespace are removed by the layout
   (CSS Flexbox §4), which collapses `</span> <span>` into `</span><span>`
   and produces "exportfunctionregisterDashboard". */
.pz-line { padding: 1px 0; color: #e4e4e7; white-space: pre; }
.pz-line .ln {
  display: inline-block;
  width: 28px;
  text-align: right;
  padding-right: 10px;
  color: #52525b;
  user-select: none;
}
.pz-line.focus { background: rgba(250, 204, 21, 0.07); }
.pz-line.focus .ln { border-left: 2px solid #eab308; padding-left: 0; margin-left: -2px; }
.pz-line.collapsed { color: #52525b; }
.pz-line.collapsed .chev-sq {
  display: inline-grid;
  place-items: center;
  width: 13px;
  height: 13px;
  border: 1px solid #52525b;
  border-radius: 3px;
  margin-right: 8px;
  background: #27272a;
  color: #a1a1aa;
  /* No flex parent any more, so align with the text x-height instead of
     sitting on the baseline (which would push the box above "…"). */
  vertical-align: middle;
}
.pz-line.collapsed .chev-sq svg { width: 8px; height: 8px; }

.dim { color: #71717a; }
.kw { color: #c084fc; }
.fn { color: #60a5fa; }
.var { color: #e4e4e7; }
.type { color: #5eead4; }
.punct { color: #a1a1aa; }

.pz-statusbar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #1e1e22;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  padding: 0 8px;
  height: 20px;
  font-size: 10px;
  color: #a1a1aa;
}
.pz-statusbar svg { width: 11px; height: 11px; color: #a1a1aa; }
</style>
